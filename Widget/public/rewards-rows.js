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
let reconnectTimer;

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

    const row = document.createElement('section');
    row.className = `reward-gift-row${isScrolling ? ' is-scrolling' : ''}`;
    row.style.setProperty('--row-gift-count', String(visibleCount));
    row.style.setProperty('--row-scroll-duration', `${speed}s`);
    row.dataset.direction = direction;
    row.setAttribute('aria-label', `Gift row ${rowIndex + 1}`);

    const track = document.createElement('div');
    track.className = 'reward-gift-row-track';
    track.innerHTML = getRowMarkup(rowGifts);

    if (isScrolling) {
      track.innerHTML += getRowMarkup(rowGifts);
    }

    row.append(track);
    rewardRowsWidget.append(row);
  }
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
    label: getDisplayLabel(gift.giftNames?.[0] || gift.title || gift.image || 'Gift'),
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
  let testIndex = 0;

  window.setTimeout(sendTestGift, 700);

  function sendTestGift() {
    const gift = gifts[testIndex % gifts.length];
    if (gift) {
      highlightGift({
        giftName: gift.label,
        giftId: gift.id
      });
    }

    testIndex += 1;
    window.setTimeout(sendTestGift, highlightMs + 900);
  }
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

  clearTimeout(highlightTimer);
  focusGiftTile(matchingTiles[0]);
  playRowsGiftSound(matchingTiles[0]);
  rewardRowsWidget.querySelectorAll('.reward-gift-tile.is-hit').forEach(tile => {
    tile.classList.remove('is-hit');
  });

  matchingTiles.forEach(tile => {
    void tile.offsetWidth;
    tile.classList.add('is-hit');
  });

  highlightTimer = setTimeout(() => {
    matchingTiles.forEach(tile => tile.classList.remove('is-hit'));
  }, highlightMs);
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

  const trackWidth = row.classList.contains('is-scrolling') ? track.scrollWidth / 2 : track.scrollWidth;
  const maxOffset = Math.max(0, trackWidth - row.clientWidth);
  const centeredOffset = tile.offsetLeft - ((row.clientWidth - tile.clientWidth) / 2);
  const focusOffset = Math.min(maxOffset, Math.max(0, centeredOffset));

  row.classList.add('is-focusing');
  row.style.setProperty('--row-focus-x', `${-focusOffset}px`);
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
