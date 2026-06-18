const rewardRowsWidget = document.querySelector('#reward-rows-widget');
const savedRowsConfig = loadRowsOverlayConfig();
const params = new URLSearchParams(window.location.search);
const tikfinityUrl = params.get('endpoint') || 'ws://localhost:21213/';
const testMode = params.get('test') === '1';
const previewMode = params.get('preview') === '1';
const muteMode = params.get('mute') === '1';
const highlightMs = clampInteger(Number(params.get('highlightMs') || 2600), 900, 9000);

const catalogGifts = normalizeCatalog(window.rewardImageCatalog || []);
const configuredRowsGifts = normalizeRowsGifts(savedRowsConfig.gifts || []);
const gifts = configuredRowsGifts.length ? configuredRowsGifts : catalogGifts;

const rowCount = clampInteger(savedRowsConfig.rows || 2, 1, 8);
const perRowValues = getListParam(savedRowsConfig.perRow).map(value => clampInteger(Number(value), 1, 12));
const directionValues = getListParam(savedRowsConfig.directions).map(normalizeDirection);
const speedValues = getListParam(savedRowsConfig.speeds).map(value => clampInteger(Number(value), 8, 180));
const scrollRows = getScrollRows();
const gap = clampInteger(savedRowsConfig.gap ?? 0, 0, 32);
const rowHeight = clampInteger(savedRowsConfig.rowHeight || 96, 64, 160);
const showNames = savedRowsConfig.names !== false;
let highlightTimer;
let releaseFocusTimer;
let reconnectTimer;
let lastTestGiftIndex = -1;
const rowScrollStates = new WeakMap();
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

applyThemeToDocument(savedRowsConfig.theme);
renderRows();
setupRowsGiftSimulator();

if (previewMode) {
  // Static config preview only.
} else if (testMode) {
  startRowsTestMode();
} else {
  connectRows();
}

// Listen for live title updates from the config editor (parent) and update tile text without reload.
window.addEventListener('message', event => {
  try {
    const msg = event.data;
    if (!msg || msg.type !== 'rows:updateTitles' || !Array.isArray(msg.updates)) return;

    msg.updates.forEach(update => {
      const keys = Array.isArray(update.keys) ? update.keys : [];
      const title = String(update.title || '');
      if (!keys.length) return;

      [...document.querySelectorAll('.reward-gift-tile')].forEach(tile => {
        const tileKeys = String(tile.dataset.giftKeys || '').split('|').filter(Boolean);
        if (keys.some(k => tileKeys.includes(k))) {
          const strong = tile.querySelector('strong');
          if (strong) strong.textContent = title;
        }
      });
    });
  } catch (err) {
    // ignore
  }
});

function renderRows() {
  rewardRowsWidget.style.setProperty('--reward-row-gap', `${gap}px`);
  rewardRowsWidget.style.setProperty('--reward-row-height', `${rowHeight}px`);
  rewardRowsWidget.innerHTML = '';

  if (!gifts.length) {
    rewardRowsWidget.innerHTML = '<p class="reward-rows-empty">No gifts in catalogue</p>';
    return;
  }

  const rowGiftGroups = getGiftGroupsForRows(gifts, rowCount);

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const visibleCount = getRowVisibleCount(rowIndex);
    const isScrolling = scrollRows.has(rowIndex + 1);
    const direction = getRowDirection(rowIndex);
    const speed = getRowSpeed(rowIndex);
    const rowGifts = rowGiftGroups[rowIndex] || [];
    const loopGifts = isScrolling ? getLoopableRowGifts(rowGifts, visibleCount) : rowGifts;

    const row = document.createElement('section');
    row.className = `reward-gift-row${isScrolling ? ' is-scrolling' : ''}`;
    row.style.setProperty('--row-gift-count', String(visibleCount));
    row.style.setProperty('--row-scroll-duration', `${speed}s`);
    row.dataset.direction = direction;
    row.setAttribute('aria-label', `Gift row ${rowIndex + 1}`);

    const track = document.createElement('div');
    track.className = 'reward-gift-row-track';
    track.innerHTML = isScrolling
      ? getRowMarkup(loopGifts) + getRowMarkup(loopGifts) + getRowMarkup(loopGifts)
      : getRowMarkup(loopGifts);

    row.append(track);
    rewardRowsWidget.append(row);
    if (isScrolling) {
      setupRowScrollLoop(row, track, loopGifts.length);
    }
  }
}

function setupRowScrollLoop(row, track, loopCount, options = {}) {
  row.dataset.loopCount = String(loopCount);

  requestAnimationFrame(() => {
    const firstTile = track.children[0];
    const firstDuplicateTile = track.children[loopCount];

    if (!firstTile || !firstDuplicateTile) {
      return;
    }

    const distance = firstDuplicateTile.offsetLeft - firstTile.offsetLeft;
    const scrollDistance = Math.max(0, distance);
    const offset = Number.isFinite(options.startOffset)
      ? options.startOffset
      : -scrollDistance;

    stopRowScroll(row);
    row.style.setProperty('--row-scroll-distance', `${scrollDistance}px`);
    rowScrollStates.set(row, {
      track,
      loopCount,
      distance: scrollDistance,
      offset: normalizeRowOffset(row, offset, scrollDistance),
      speed: scrollDistance / (Math.max(1, getRowScrollDuration(row)) * 1000),
      direction: row.dataset.direction === 'right' ? 'right' : 'left',
      rafId: 0,
      lastFrame: 0,
      running: false
    });

    applyRowScrollOffset(row);
    startRowScroll(row);
  });
}

function getRowScrollDuration(row) {
  return parseFloat(getComputedStyle(row).getPropertyValue('--row-scroll-duration')) || 28;
}

function startRowScroll(row) {
  const state = rowScrollStates.get(row);
  if (!state || !state.distance || prefersReducedMotion) {
    return;
  }

  state.running = true;
  state.lastFrame = performance.now();
  state.rafId = requestAnimationFrame(time => updateRowScroll(row, time));
}

function updateRowScroll(row, time) {
  const state = rowScrollStates.get(row);
  if (!state || !state.running) {
    return;
  }

  const elapsed = Math.max(0, time - state.lastFrame);
  state.lastFrame = time;
  state.offset += state.direction === 'right'
    ? state.speed * elapsed
    : -state.speed * elapsed;
  state.offset = normalizeRowOffset(row, state.offset, state.distance);
  applyRowScrollOffset(row);
  state.rafId = requestAnimationFrame(nextTime => updateRowScroll(row, nextTime));
}

function stopRowScroll(row) {
  const state = rowScrollStates.get(row);
  if (!state) {
    return null;
  }

  state.running = false;
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  return state;
}

function normalizeRowOffset(row, offset, distance) {
  if (!distance) {
    return offset;
  }

  const direction = row.dataset.direction === 'right' ? 'right' : 'left';

  if (direction === 'right') {
    while (offset >= 0) offset -= distance;
    while (offset < -distance) offset += distance;
    return offset;
  }

  while (offset > -distance) offset -= distance;
  while (offset <= -distance * 2) offset += distance;
  return offset;
}

function applyRowScrollOffset(row) {
  const state = rowScrollStates.get(row);
  if (!state) {
    return;
  }

  state.track.style.transform = `translateX(${state.offset}px)`;
}

function getLoopableRowGifts(rowGifts, visibleCount) {
  if (!rowGifts.length) {
    return [];
  }

  const minimumLoopCount = Math.max(rowGifts.length, visibleCount * 2);
  const loopGifts = [];

  while (loopGifts.length < minimumLoopCount) {
    loopGifts.push(...rowGifts);
  }

  return loopGifts;
}

function getRowMarkup(rowGifts) {
  return rowGifts.map((gift, index) => `
    <article class="reward-gift-tile" data-gift-index="${index}" data-gift-keys="${escapeAttribute(gift.keys.join('|'))}" data-sound="${escapeAttribute(gift.sound)}" data-volume="${escapeAttribute(gift.volume)}">
      <img src="${escapeAttribute(gift.image)}" alt="">
      ${showNames ? `<strong>${escapeHtml(gift.label)}</strong>` : ''}
    </article>
  `).join('');
}

function getGiftGroupsForRows(list, totalRows) {
  if (list.some(gift => Number.isInteger(Number(gift.row)))) {
    return Array.from({ length: totalRows }, (_, rowIndex) => {
      const row = rowIndex + 1;
      return list.filter(gift => clampInteger(Number(gift.row || 1), 1, totalRows) === row);
    });
  }

  const chunkSize = Math.ceil(list.length / totalRows);

  return Array.from({ length: totalRows }, (_, rowIndex) => {
    const start = rowIndex * chunkSize;
    return list.slice(start, start + chunkSize);
  });
}

function getRowVisibleCount(rowIndex) {
  return perRowValues[rowIndex] || perRowValues[perRowValues.length - 1] || 6;
}

function getRowDirection(rowIndex) {
  return directionValues[rowIndex] || directionValues[directionValues.length - 1] || 'left';
}

function getRowSpeed(rowIndex) {
  return speedValues[rowIndex] || speedValues[speedValues.length - 1] || 28;
}

function getScrollRows() {
  const value = String(savedRowsConfig.scrollRows || '').trim().toLowerCase();

  if (!value || value === 'none' || value === '0' || value === 'false') {
    return new Set();
  }

  if (value === 'all' || value === 'true') {
    return new Set(Array.from({ length: rowCount }, (_, index) => index + 1));
  }

  return new Set(value.split(',').map(item => Number(item.trim())).filter(number => Number.isInteger(number) && number >= 1 && number <= rowCount));
}

function normalizeCatalog(list) {
  return list.map(item => ({
    id: normalizeId(item.id || item.giftId || ''),
    label: getDisplayLabel(item.label || item.name || item.image || 'Gift'),
    image: String(item.image || item.path || item.url || ''),
    row: Number.isInteger(Number(item.row)) ? Number(item.row) : undefined,
    sound: String(item.sound || ''),
    volume: clampDecimal(Number(item.volume ?? 0.85), 0, 1),
    keys: getGiftKeys({
      ids: [item.id || item.giftId],
      names: [item.name, item.label]
    })
  })).filter(gift => gift.image);
}

function normalizeRowsGifts(list) {
  return dedupeGifts(list.filter(gift => gift.enabled !== false).map(gift => ({
    id: normalizeId(gift.giftIds?.[0] || ''),
    label: getDisplayLabel(gift.title || gift.giftNames?.[0] || gift.image || 'Gift'),
    image: getCatalogImageForGift(gift),
    row: Number.isInteger(Number(gift.row)) ? Number(gift.row) : undefined,
    sound: String(gift.sound || ''),
    volume: clampDecimal(Number(gift.volume ?? 0.85), 0, 1),
    keys: getGiftKeys({
      ids: gift.giftIds || [],
      names: [...(gift.giftNames || []), gift.title]
    })
  })).filter(gift => gift.image));
}

function dedupeGifts(list) {
  const seen = new Set();

  return [...list].reverse().filter(gift => {
    const key = getGiftIdentity(gift);

    if (!key) {
      return true;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  }).reverse();
}

function getGiftIdentity(gift) {
  if (gift.id) {
    return `id:${gift.id}`;
  }

  return gift.label ? `name:${normalizeName(gift.label)}` : '';
}

function connectRows() {
  const ws = new WebSocket(tikfinityUrl);

  ws.addEventListener('message', event => {
    const message = parseMessage(event.data);
    if (!message || String(message.event || '').toLowerCase() !== 'gift') {
      return;
    }

    highlightGift(normalizeGiftEvent(message.data || {}));
  });

  ws.addEventListener('close', () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectRows, 1500);
  });
}

function setupRowsGiftSimulator() {
  window.simulateRowsGift = (giftNameOrOptions = '') => {
    const options = typeof giftNameOrOptions === 'object' && giftNameOrOptions !== null
      ? giftNameOrOptions
      : { giftName: giftNameOrOptions };
    const fallbackGift = gifts[0] || {};

    highlightGift({
      giftName: options.giftName || options.name || fallbackGift.label || 'Gift',
      giftId: options.giftId || options.id || fallbackGift.id || ''
    });
  };
}

function startRowsTestMode() {
  window.setTimeout(sendTestGift, getRandomTestDelay(500, 1700));

  function sendTestGift() {
    const gift = getRandomTestGift();
    if (gift) {
      highlightGift({
        giftName: gift.label,
        giftId: gift.id
      });
    }

    window.setTimeout(sendTestGift, getRandomTestDelay(highlightMs + 450, highlightMs + 2600));
  }
}

function getRandomTestDelay(min, max) {
  return Math.round(min + (Math.random() * (max - min)));
}

function getRandomTestGift() {
  if (!gifts.length) {
    return null;
  }

  if (gifts.length === 1) {
    lastTestGiftIndex = 0;
    return gifts[0];
  }

  let nextIndex = lastTestGiftIndex;
  while (nextIndex === lastTestGiftIndex) {
    nextIndex = Math.floor(Math.random() * gifts.length);
  }

  lastTestGiftIndex = nextIndex;
  return gifts[nextIndex];
}

function highlightGift(gift) {
  const keys = getGiftKeys({
    ids: [gift.giftId],
    names: [gift.giftName]
  });

  if (!keys.length) {
    return;
  }

  const matchingTiles = [...rewardRowsWidget.querySelectorAll('.reward-gift-tile')].filter(tile => {
    const tileKeys = String(tile.dataset.giftKeys || '').split('|').filter(Boolean);
    return keys.some(key => tileKeys.includes(key));
  });

  if (!matchingTiles.length) {
    return;
  }

  const focusTile = getBestFocusTile(matchingTiles);

  clearTimeout(highlightTimer);
  clearTimeout(releaseFocusTimer);
  focusGiftTile(focusTile);
  playRowsGiftSound(focusTile);
  rewardRowsWidget.querySelectorAll('.reward-gift-tile.is-hit').forEach(tile => {
    tile.classList.remove('is-hit');
  });

  matchingTiles.forEach(tile => {
    void tile.offsetWidth;
    tile.classList.add('is-hit');
  });

  highlightTimer = setTimeout(() => {
    matchingTiles.forEach(tile => tile.classList.remove('is-hit'));
    releaseFocusTimer = setTimeout(() => {
      rewardRowsWidget.querySelectorAll('.reward-gift-row.is-focusing').forEach(row => {
        releaseFocusedRow(row, focusTile);
      });
    }, 240);
  }, highlightMs);
}

function getBestFocusTile(tiles) {
  return tiles.reduce((bestTile, tile) => {
    if (!bestTile) {
      return tile;
    }

    return getFocusScore(tile) < getFocusScore(bestTile) ? tile : bestTile;
  }, null);
}

function getFocusScore(tile) {
  const row = tile?.closest('.reward-gift-row');
  const track = tile?.closest('.reward-gift-row-track');
  if (!row || !track) {
    return Number.POSITIVE_INFINITY;
  }

  return getVisibleDistanceFromRowCenter(tile);
}

function getVisibleDistanceFromRowCenter(tile) {
  const row = tile?.closest('.reward-gift-row');
  const track = tile?.closest('.reward-gift-row-track');

  if (!row || !track) {
    return Number.POSITIVE_INFINITY;
  }

  const translateX = getCurrentTrackX(row, track);
  const rowCenter = row.clientWidth / 2;
  const tileCenter = tile.offsetLeft + (tile.offsetWidth / 2) + translateX;

  return Math.abs(tileCenter - rowCenter);
}

function getTranslateX(transform) {
  if (!transform || transform === 'none') {
    return 0;
  }

  const matrix = transform.match(/^matrix\((.+)\)$/);
  if (matrix) {
    return Number(matrix[1].split(',')[4]) || 0;
  }

  const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
  if (matrix3d) {
    return Number(matrix3d[1].split(',')[12]) || 0;
  }

  return 0;
}

function playRowsGiftSound(tile) {
  if (previewMode || muteMode || savedRowsConfig.soundsEnabled === false) {
    return;
  }

  const sound = tile?.dataset.sound || '';
  if (!sound) {
    return;
  }

  const audio = new Audio(sound);
  audio.volume = clampDecimal(Number(tile.dataset.volume || 0.85), 0, 1);
  audio.play().catch(() => {});
}

function focusGiftTile(tile) {
  const row = tile?.closest('.reward-gift-row');
  const track = tile?.closest('.reward-gift-row-track');

  if (!row || !track) {
    return;
  }

  const isScrolling = row.classList.contains('is-scrolling');
  const state = isScrolling ? stopRowScroll(row) : null;
  const currentX = state?.offset ?? getTranslateX(getComputedStyle(track).transform);
  const focusX = getCenteredTrackX(row, track, tile, isScrolling);

  track.style.transition = 'none';
  track.style.transform = `translateX(${currentX}px)`;
  void track.offsetWidth;
  row.classList.add('is-focusing');
  track.style.removeProperty('transition');
  requestAnimationFrame(() => {
    track.style.transform = `translateX(${focusX}px)`;
  });
}

function getCenteredTrackX(row, track, tile, isScrolling) {
  const targetX = getFocusTargetX(tile);

  if (isScrolling) {
    return normalizeRowOffset(row, targetX, getRowScrollDistance(row));
  }

  const minX = Math.min(0, row.clientWidth - track.scrollWidth);
  return Math.max(minX, Math.min(0, targetX));
}

function getFocusTargetX(tile) {
  const row = tile?.closest('.reward-gift-row');

  if (!row || !tile) {
    return 0;
  }

  return (row.clientWidth / 2) - (tile.offsetLeft + (tile.offsetWidth / 2));
}

function releaseFocusedRow(row, focusedTile = null) {
  const track = row.querySelector('.reward-gift-row-track');
  if (!track) {
    row.classList.remove('is-focusing');
    return;
  }

  const currentX = getCurrentTrackX(row, track);
  track.style.transition = 'none';
  track.style.transform = `translateX(${currentX}px)`;
  void track.offsetWidth;

  const restartOffset = restartRowFromFocusedGift(row, track, focusedTile);
  if (Number.isFinite(restartOffset)) {
    track.style.transform = `translateX(${restartOffset}px)`;
  }

  row.classList.remove('is-focusing');
  void track.offsetWidth;
  track.style.removeProperty('transition');

  if (!row.classList.contains('is-scrolling')) {
    track.style.removeProperty('transform');
    return;
  }

  if (!Number.isFinite(restartOffset)) {
    startRowScroll(row);
  }
}

function restartRowFromFocusedGift(row, track, focusedTile) {
  if (!row.classList.contains('is-scrolling') || !focusedTile) {
    return null;
  }

  const loopCount = Number(row.dataset.loopCount || 0);
  if (!loopCount) {
    return null;
  }

  const firstStrip = [...track.children].slice(0, loopCount);
  const focusedKeys = focusedTile.dataset.giftKeys;
  const startIndex = firstStrip.findIndex(tile => tile.dataset.giftKeys === focusedKeys);

  if (startIndex < 0) {
    return resetRowToMiddleStripStart(row, track);
  }

  const ordered = [
    ...firstStrip.slice(startIndex),
    ...firstStrip.slice(0, startIndex)
  ];

  track.innerHTML = getClonedTilesMarkup(ordered, 3);
  const restartOffset = getRowStartOffsetFromTile(row, track, track.children[loopCount]);
  setupRowScrollLoop(row, track, loopCount, { startOffset: restartOffset });
  return restartOffset;
}

function resetRowToMiddleStripStart(row, track) {
  const loopCount = Number(row.dataset.loopCount || 0);
  const restartOffset = getRowStartOffsetFromTile(row, track, track.children[loopCount]);
  setupRowScrollLoop(row, track, loopCount, { startOffset: restartOffset });
  return restartOffset;
}

function getRowStartOffsetFromTile(row, track, tile) {
  const fallback = -getRowScrollDistance(row);
  const offset = tile ? getCenteredTrackX(row, track, tile, false) : fallback;

  return row.classList.contains('is-scrolling')
    ? normalizeRowOffset(row, offset, getRowScrollDistance(row))
    : offset;
}

function getClonedTilesMarkup(tiles, copies) {
  const markup = tiles.map(tile => tile.outerHTML).join('');
  return Array.from({ length: copies }, () => markup).join('');
}

function getRowScrollDistance(row) {
  return rowScrollStates.get(row)?.distance || parseFloat(getComputedStyle(row).getPropertyValue('--row-scroll-distance')) || 0;
}

function getCurrentTrackX(row, track) {
  const state = rowScrollStates.get(row);
  return Number.isFinite(state?.offset) ? state.offset : getTranslateX(getComputedStyle(track).transform);
}

function normalizeGiftEvent(data) {
  return {
    giftName: data.giftDetails?.giftName || data.gift?.name || data.giftName || data.extendedGiftInfo?.name || 'Gift',
    giftId: normalizeId(data.giftId || data.gift?.id || data.gift?.giftId || data.giftDetails?.giftId || data.extendedGiftInfo?.id || data.extendedGiftInfo?.gift_id || '')
  };
}

function getGiftKeys({ ids = [], names = [] }) {
  const keys = [];

  ids.map(normalizeId).filter(Boolean).forEach(id => keys.push(`id:${id}`));
  names.filter(Boolean).forEach(name => keys.push(`name:${normalizeName(name)}`));

  return [...new Set(keys)];
}

function getDisplayLabel(label) {
  return String(label || '')
    .replace(/^\.\/rewards\//, '')
    .replace(/\.(avif|gif|jpe?g|png|svg|webp)$/i, '')
    .replace(/^\d+[_ -]+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function normalizeId(id) {
  const value = String(id || '').trim();
  return /^\d+$/.test(value) ? String(Number(value)) : value;
}

function getCatalogImageForGift(gift) {
  const currentImage = String(gift.image || '');
  const match = findCatalogEntryForGift(gift);
  return match?.image || currentImage;
}

function findCatalogEntryForGift(gift) {
  if (!catalogGifts.length) {
    return null;
  }

  const ids = [
    ...(gift.giftIds || []),
    getIdFromImagePath(gift.image)
  ].map(normalizeId).filter(Boolean);
  const names = [
    ...(gift.giftNames || []),
    gift.title,
    getDisplayLabel(gift.image)
  ].map(normalizeName).filter(Boolean);

  return catalogGifts.find(entry => ids.includes(normalizeId(entry.id))) ||
    catalogGifts.find(entry => names.includes(normalizeName(entry.label)));
}

function getIdFromImagePath(imagePath) {
  const filename = String(imagePath || '').split('/').pop() || '';
  const match = filename.match(/^(\d+)[_ -]+/);
  return match ? match[1] : '';
}

function getListParam(value = '') {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function loadRowsOverlayConfig() {
  const urlConfig = readConfigFromHash();
  if (urlConfig?.rowsOverlay) {
    return {
      ...urlConfig.rowsOverlay,
      theme: urlConfig.rowsTheme || urlConfig.theme || urlConfig.carouselTheme
    };
  }

  const fallback = window.rewardOverlayConfig?.rowsOverlay || {};

  try {
    const saved = JSON.parse(localStorage.getItem('reward-overlay-config:v1') || 'null');
    return {
      ...(saved?.rowsOverlay || fallback),
      theme: saved?.rowsTheme || saved?.theme || saved?.carouselTheme || window.rewardOverlayConfig?.rowsTheme || window.rewardOverlayConfig?.theme
    };
  } catch {
    return {
      ...fallback,
      theme: window.rewardOverlayConfig?.rowsTheme || window.rewardOverlayConfig?.theme
    };
  }
}

function readConfigFromHash() {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get('config');

  if (!encoded) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch {
    return null;
  }
}

function applyThemeToDocument(theme = {}) {
  const defaults = {
    accent: '#03f5d8',
    secondary: '#531c7b',
    background: '#363a3d',
    card: '#0d0f14',
    text: '#ffffff',
    border: '#ffffff',
    glow: '#c447ff',
    opacity: 0.78,
    glowStrength: 1
  };
  const normalized = {
    preset: theme.preset || 'custom',
    accent: normalizeHex(theme.accent, defaults.accent),
    secondary: normalizeHex(theme.secondary, defaults.secondary),
    background: normalizeHex(theme.background, defaults.background),
    card: normalizeHex(theme.card, defaults.card),
    text: normalizeHex(theme.text, defaults.text),
    border: normalizeHex(theme.border, defaults.border),
    glow: normalizeHex(theme.glow, defaults.glow),
    opacity: clampDecimal(Number(theme.opacity ?? defaults.opacity), 0.35, 1),
    glowStrength: clampDecimal(Number(theme.glowStrength ?? defaults.glowStrength), 0, 1.5)
  };
  const themeTargets = [document.documentElement, rewardRowsWidget].filter(Boolean);
  const root = {
    style: {
      setProperty(name, value) {
        themeTargets.forEach(target => target.style.setProperty(name, value));
      }
    }
  };
  const opacity = normalized.opacity;
  const glow = normalized.glowStrength;

  root.style.setProperty('--reward-theme-accent', normalized.accent);
  root.style.setProperty('--reward-theme-accent-soft', hexToRgba(normalized.accent, 0.18));
  root.style.setProperty('--reward-theme-accent-strong', hexToRgba(normalized.accent, 0.76));
  root.style.setProperty('--reward-theme-secondary', normalized.secondary);
  root.style.setProperty('--reward-theme-secondary-soft', hexToRgba(normalized.secondary, 0.2));
  root.style.setProperty('--reward-theme-background', hexToRgba(normalized.background, opacity));
  root.style.setProperty('--reward-theme-background-deep', hexToRgba(normalized.background, Math.min(0.95, opacity + 0.1)));
  root.style.setProperty('--reward-theme-card', hexToRgba(normalized.card, Math.min(0.9, opacity + 0.04)));
  root.style.setProperty('--reward-theme-card-soft', hexToRgba(normalized.card, Math.max(0.38, opacity - 0.16)));
  root.style.setProperty('--reward-theme-text', normalized.text);
  root.style.setProperty('--reward-theme-muted', hexToRgba(normalized.text, 0.74));
  root.style.setProperty('--reward-theme-border', hexToRgba(normalized.border, 0.34));
  root.style.setProperty('--reward-theme-border-strong', hexToRgba(normalized.border, 0.68));
  root.style.setProperty('--reward-theme-glow', hexToRgba(normalized.glow, 0.5 * glow));
  root.style.setProperty('--reward-theme-glow-soft', hexToRgba(normalized.glow, 0.22 * glow));
  root.style.setProperty('--reward-theme-glow-strong', hexToRgba(normalized.glow, 0.78 * glow));
  root.style.setProperty('--reward-theme-shine', hexToRgba(normalized.text, 0.18));

  if (normalized.preset === 'glass-purple') {
    root.style.setProperty('--reward-theme-widget-border', hexToRgba(normalized.border, 0.28));
    root.style.setProperty('--reward-theme-widget-glow', hexToRgba(normalized.glow, 0.44 * glow));
    root.style.setProperty('--reward-theme-widget-inset-shine', hexToRgba(normalized.text, 0.16));
    root.style.setProperty('--reward-theme-widget-shine', hexToRgba(normalized.text, 0.2));
    root.style.setProperty('--reward-theme-widget-side-shine-left', hexToRgba(normalized.text, 0.2));
    root.style.setProperty('--reward-theme-widget-side-shine-right', hexToRgba(normalized.text, 0.16));
    root.style.setProperty('--reward-theme-widget-radial-shine', hexToRgba(normalized.text, 0.22));
    root.style.setProperty('--reward-theme-widget-top-shine', hexToRgba(normalized.text, 0.22));
    root.style.setProperty('--reward-theme-widget-bottom-shine', hexToRgba(normalized.text, 0.12));
    root.style.setProperty('--reward-theme-widget-after-left-shine', hexToRgba(normalized.text, 0.2));
    root.style.setProperty('--reward-theme-widget-after-right-shine', hexToRgba(normalized.text, 0.14));
    root.style.setProperty('--reward-theme-widget-top', hexToRgba(normalized.background, Math.min(0.92, opacity - 0.06)));
    root.style.setProperty('--reward-theme-widget-mid', hexToRgba(normalized.card, opacity));
    root.style.setProperty('--reward-theme-widget-bottom', hexToRgba(normalized.secondary, Math.max(0.35, opacity - 0.1)));
    root.style.setProperty('--reward-theme-widget-base', hexToRgba(normalized.card, Math.max(0.35, opacity - 0.16)));
    root.style.setProperty('--reward-theme-card-border', hexToRgba(normalized.border, 0.2));
    root.style.setProperty('--reward-theme-card-shine', hexToRgba(normalized.text, 0.16));
    root.style.setProperty('--reward-theme-card-base', hexToRgba(normalized.card, Math.max(0.35, opacity - 0.2)));
    root.style.setProperty('--reward-theme-card-text', hexToRgba(normalized.text, 0.96));
    root.style.setProperty('--reward-theme-card-active-glow', hexToRgba(normalized.glow, 0.38 * glow));
    root.style.setProperty('--reward-theme-card-active-accent', hexToRgba(normalized.accent, 0.18));
    root.style.setProperty('--reward-theme-callout-border', hexToRgba(normalized.border, 0.26));
    root.style.setProperty('--reward-theme-callout-start', hexToRgba(normalized.accent, 0.22));
    root.style.setProperty('--reward-theme-callout-end', hexToRgba(normalized.glow, 0.34 * glow));
    root.style.setProperty('--reward-theme-callout-base', hexToRgba(normalized.card, Math.min(0.94, opacity + 0.06)));
    root.style.setProperty('--reward-theme-callout-glow', hexToRgba(normalized.glow, 0.48 * glow));
    return;
  }

  root.style.setProperty('--reward-theme-widget-border', hexToRgba(normalized.border, 0.7));
  root.style.setProperty('--reward-theme-widget-glow', hexToRgba(normalized.glow, 1 * glow));
  root.style.setProperty('--reward-theme-widget-inset-shine', hexToRgba(normalized.accent, 0.34));
  root.style.setProperty('--reward-theme-widget-shine', hexToRgba(normalized.accent, 0.54));
  root.style.setProperty('--reward-theme-widget-side-shine-left', hexToRgba(normalized.accent, 0.48));
  root.style.setProperty('--reward-theme-widget-side-shine-right', hexToRgba(normalized.secondary, 0.52));
  root.style.setProperty('--reward-theme-widget-radial-shine', hexToRgba(normalized.accent, 0.46));
  root.style.setProperty('--reward-theme-widget-top-shine', hexToRgba(normalized.text, 0.18));
  root.style.setProperty('--reward-theme-widget-bottom-shine', hexToRgba(normalized.secondary, 0.44));
  root.style.setProperty('--reward-theme-widget-after-left-shine', hexToRgba(normalized.accent, 0.46));
  root.style.setProperty('--reward-theme-widget-after-right-shine', hexToRgba(normalized.secondary, 0.5));
  root.style.setProperty('--reward-theme-widget-top', hexToRgba(normalized.background, Math.min(0.98, opacity + 0.12)));
  root.style.setProperty('--reward-theme-widget-mid', hexToRgba(normalized.secondary, 0.46));
  root.style.setProperty('--reward-theme-widget-bottom', hexToRgba(normalized.accent, 0.34));
  root.style.setProperty('--reward-theme-widget-base', hexToRgba(normalized.card, Math.max(0.82, opacity)));
  root.style.setProperty('--reward-theme-card-border', hexToRgba(normalized.border, 0.64));
  root.style.setProperty('--reward-theme-card-shine', hexToRgba(normalized.accent, 0.38));
  root.style.setProperty('--reward-theme-card-base', hexToRgba(normalized.card, Math.max(0.82, opacity)));
  root.style.setProperty('--reward-theme-card-text', hexToRgba(normalized.text, 0.96));
  root.style.setProperty('--reward-theme-card-active-glow', hexToRgba(normalized.glow, 0.78 * glow));
  root.style.setProperty('--reward-theme-card-active-accent', hexToRgba(normalized.accent, 0.54));
  root.style.setProperty('--reward-theme-callout-border', hexToRgba(normalized.border, 0.42));
  root.style.setProperty('--reward-theme-callout-start', hexToRgba(normalized.accent, 0.48));
  root.style.setProperty('--reward-theme-callout-end', hexToRgba(normalized.secondary, 0.62));
  root.style.setProperty('--reward-theme-callout-base', hexToRgba(normalized.background, Math.min(0.96, opacity + 0.1)));
  root.style.setProperty('--reward-theme-callout-glow', hexToRgba(normalized.glow, 0.62 * glow));
}

function normalizeHex(value, fallback = '#ffffff') {
  const text = String(value || '').trim();
  const fallbackHex = /^#[0-9a-f]{6}$/i.test(String(fallback || '')) ? fallback.toLowerCase() : '#ffffff';

  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(text)) {
    const [, r, g, b] = text.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text.toLowerCase()}`;
  if (/^[0-9a-f]{3}$/i.test(text)) {
    const [r, g, b] = text.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return fallbackHex;
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeHex(hex);
  const red = parseInt(normalized.slice(1, 3), 16);
  const green = parseInt(normalized.slice(3, 5), 16);
  const blue = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clampDecimal(Number(alpha), 0, 1)})`;
}

function normalizeDirection(value) {
  const direction = String(value || '').trim().toLowerCase();
  return direction === 'right' ? 'right' : direction === 'left' ? 'left' : '';
}

function clampInteger(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function clampDecimal(value, min, max) {
  if (!Number.isFinite(value)) return max;
  return Math.min(max, Math.max(min, value));
}

function parseMessage(message) {
  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
}

function escapeAttribute(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
