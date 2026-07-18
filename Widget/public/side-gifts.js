const sideGiftsWidget = document.querySelector('#side-gifts-widget');
const sideGiftParams = readSideGiftParams();
const remoteSideGiftImageBase = 'https://pub-099cf604176d4f20bce0cd8bb2c4d3c6.r2.dev/';
const sideGiftConfigBundle = loadSideGiftConfig();
const sideGiftConfig = normalizeSideGiftConfig(sideGiftConfigBundle.sideGifts || {});
const sideGiftRowsConfig = sideGiftConfigBundle.rowsOverlay || {};
const sideGiftCatalog = normalizeSideGiftCatalog(window.rewardImageCatalog || []);
const configuredSideGifts = normalizeSideGifts(sideGiftConfigBundle.sideGifts?.gifts || []);
const configuredRowsFallbackGifts = normalizeSideGifts(sideGiftRowsConfig.gifts || []);
const sideGifts = configuredSideGifts.length ? configuredSideGifts : configuredRowsFallbackGifts.length ? configuredRowsFallbackGifts : sideGiftCatalog;
const sideGiftEndpoint = sideGiftParams.get('endpoint') || 'ws://localhost:21213/';
const sideGiftTestMode = sideGiftParams.get('test') === '1';
const sideGiftPreviewMode = sideGiftParams.get('preview') === '1';
const sideGiftPreviewFit = sideGiftParams.get('previewFit') === '1';
const sideGiftHighlightMs = Math.max(900, Number(sideGiftParams.get('highlightMs') || sideGiftConfigBundle.holdOnGiftMs || sideGiftConfig.hitMs || 6500) || 6500);
let sideGiftReconnectTimer;
let sideGiftHighlightTimer;
let sideGiftLikeTotal = 0;

applySideGiftConfig();
renderSideGifts();

if (sideGiftPreviewMode) {
  // Static preview only.
} else if (sideGiftTestMode) {
  startSideGiftTestMode();
} else {
  connectSideGifts();
}

function applySideGiftConfig() {
  document.documentElement.style.setProperty('--side-gifts-width', sideGiftPreviewFit ? '100vw' : `${sideGiftConfig.width}px`);
  document.documentElement.style.setProperty('--side-gifts-layout-width', '100vw');
  document.documentElement.style.setProperty('--side-gifts-height', sideGiftPreviewFit ? '100vh' : `${sideGiftConfig.height}px`);
  document.documentElement.style.setProperty('--side-gifts-icon-size', `${sideGiftConfig.iconSize}px`);
  document.documentElement.style.setProperty('--side-gifts-gap', `${sideGiftConfig.gap}px`);
  document.documentElement.style.setProperty('--side-gifts-inset-x', `${sideGiftConfig.insetX}px`);
  document.documentElement.style.setProperty('--side-gifts-inset-y', `${sideGiftConfig.insetY}px`);
  document.documentElement.style.setProperty('--side-gifts-profile-duration', `${sideGiftHighlightMs}ms`);
  document.documentElement.style.setProperty('--side-gifts-label-size', `${sideGiftConfig.labelSize}px`);
  document.documentElement.style.setProperty('--side-gifts-label-color', sideGiftConfig.labelColor);
  document.documentElement.style.setProperty('--side-gifts-gifter-label-color', sideGiftConfig.gifterLabelColor);
  document.documentElement.style.setProperty('--side-gifts-outline-size', `${sideGiftConfig.outlineSize}px`);
  document.documentElement.style.setProperty('--side-gifts-gift-outline-size', `${sideGiftConfig.giftOutlineSize}px`);
  document.documentElement.style.setProperty('--side-gifts-outline-rgb', hexToRgb(sideGiftConfig.outlineColor));
  document.documentElement.style.setProperty('--side-gifts-gift-outline-rgb', hexToRgb(sideGiftConfig.giftOutlineColor));
  document.documentElement.style.setProperty('--side-gifts-tile-rgb', hexToRgb(sideGiftConfig.tileColor));
  document.documentElement.style.setProperty('--side-gifts-tile-opacity', sideGiftConfig.tileOpacity);
  document.documentElement.style.setProperty('--side-gifts-tile-border-rgb', hexToRgb(sideGiftConfig.tileBorderColor));
  document.documentElement.style.setProperty('--side-gifts-glow-rgb', hexToRgb(sideGiftConfig.glow));
  document.documentElement.style.setProperty('--side-gifts-hit-rgb', hexToRgb(sideGiftConfig.hitColor));
  document.body.classList.toggle('side-gifts-left-only', sideGiftConfig.side === 'left');
  document.body.classList.toggle('side-gifts-right-only', sideGiftConfig.side === 'right');
  document.body.classList.toggle('side-gifts-show-labels', sideGiftConfig.showLabels);
  document.body.classList.toggle('side-gifts-strong-outlines', sideGiftConfig.outlinesEnabled);
  document.body.classList.toggle('side-gifts-text-outlines', sideGiftConfig.outlinesEnabled && sideGiftConfig.outlineSize > 0);
  document.body.classList.toggle('side-gifts-gift-outlines', sideGiftConfig.outlinesEnabled && sideGiftConfig.giftOutlineSize > 0);
  document.body.classList.toggle('side-gifts-two-line-labels', sideGiftConfig.labelTwoLines);
  document.body.classList.toggle('side-gifts-show-tiles', sideGiftConfig.tilesEnabled);
  document.body.classList.toggle('side-gifts-idle-glow', sideGiftConfig.idleGlowEnabled);
  sideGiftsWidget.classList.toggle('received-animations-disabled', sideGiftConfig.animationsEnabled === false);
}

function renderSideGifts() {
  if (!sideGifts.length) {
    sideGiftsWidget.innerHTML = '';
    return;
  }

  const leftGifts = sideGifts.filter((gift, index) => getSideForGift(gift, index) === 'left');
  const rightGifts = sideGifts.filter((gift, index) => getSideForGift(gift, index) === 'right');
  const slotCount = Math.max(leftGifts.length, rightGifts.length, 1);

  sideGiftsWidget.innerHTML = `
    <section class="side-gifts-column side-gifts-column-left" aria-label="Left gift column">
      ${renderSideGiftColumn(leftGifts, slotCount)}
    </section>
    <section class="side-gifts-column side-gifts-column-right" aria-label="Right gift column">
      ${renderSideGiftColumn(rightGifts, slotCount)}
    </section>
  `;
}

function renderSideGiftColumn(gifts, slotCount) {
  return Array.from({ length: slotCount }, (_, index) => (
    gifts[index] ? renderSideGiftTile(gifts[index]) : '<article class="side-gift-tile side-gift-placeholder" aria-hidden="true"></article>'
  )).join('');
}

function renderSideGiftTile(gift) {
  return `
    <article class="side-gift-tile side-gift-trigger-${escapeAttribute(gift.triggerType)}" data-gift-keys="${escapeAttribute(gift.keys.join('|'))}" data-gift-image-keys="${escapeAttribute(gift.giftImageKeys.join('|'))}" data-use-gift-image="${gift.useGiftImage ? '1' : '0'}" data-sound="${escapeAttribute(gift.sound || '')}" data-volume="${escapeAttribute(gift.volume)}" data-original-label="${escapeAttribute(gift.label)}">
      <img class="side-gift-image" src="${escapeAttribute(resolveSideGiftImageUrl(gift.image))}" alt="">
      <strong><span class="side-gift-label-original">${escapeHtml(gift.label)}</span><span class="side-gift-label-profile" aria-hidden="true"></span></strong>
    </article>
  `;
}

function getSideForGift(gift, index) {
  const configured = String(gift.side || '').toLowerCase();
  if ((sideGiftConfig.side === 'left' || sideGiftConfig.side === 'right') && configured !== sideGiftConfig.side) {
    return '';
  }

  if (configured === 'left' || configured === 'right') {
    return configured;
  }

  if (sideGiftConfig.side === 'left' || sideGiftConfig.side === 'right') {
    return '';
  }

  const row = Number(gift.row || 0);
  if (row === 1) return 'left';
  if (row === 2) return 'right';
  return index % 2 === 0 ? 'left' : 'right';
}

function connectSideGifts() {
  const ws = new WebSocket(sideGiftEndpoint);

  ws.addEventListener('message', event => {
    const message = parseMessage(event.data);
    if (!message) return;
    handleSideGiftEvent(String(message.event || '').toLowerCase(), message.data || {});
  });

  ws.addEventListener('close', () => {
    clearTimeout(sideGiftReconnectTimer);
    sideGiftReconnectTimer = setTimeout(connectSideGifts, 1500);
  });
}

function handleSideGiftEvent(eventName, data) {
  if (eventName === 'gift') {
    highlightSideGift(normalizeSideGiftEvent(data));
    return;
  }

  if (eventName === 'follow') {
    highlightSideGift({ triggerType: 'follow' });
    return;
  }

  if (eventName !== 'like') return;

  const increment = Math.max(0, Math.floor(Number(data.likeCount || data.likes || data.count || 0)));
  if (!increment) return;

  const previousTotal = sideGiftLikeTotal;
  sideGiftLikeTotal += increment;
  sideGifts.filter(gift => gift.triggerType === 'likes').forEach(gift => {
    if (Math.floor(previousTotal / gift.likesRequired) < Math.floor(sideGiftLikeTotal / gift.likesRequired)) {
      highlightSideGift({ triggerKey: getSideGiftTriggerKey(gift) });
    }
  });
}

function highlightSideGift(gift) {
  const keys = getSideGiftKeys({
    ids: [gift.giftId],
    names: [gift.giftName],
    triggers: gift.triggerKey ? [gift.triggerKey] : gift.triggerType ? [gift.triggerType] : []
  });

  if (!keys.length) return;

  const matchingTiles = [...sideGiftsWidget.querySelectorAll('.side-gift-tile')].filter(tile => {
    const tileKeys = String(tile.dataset.giftKeys || '').split('|').filter(Boolean);
    return keys.some(key => tileKeys.includes(key));
  });

  if (!matchingTiles.length) return;

  clearSideGiftProfileAnimations();
  updateSideGiftImages(matchingTiles, gift);
  playSideGiftSound(matchingTiles[0]);
  runSideGiftProfileAnimation(matchingTiles, gift);
  runSideGiftHitAnimation(matchingTiles);
}

function runSideGiftHitAnimation(tiles) {
  clearTimeout(sideGiftHighlightTimer);
  sideGiftsWidget.querySelectorAll('.side-gift-tile.is-hit').forEach(tile => {
    tile.classList.remove('is-hit');
  });

  if (sideGiftConfig.animationsEnabled === false) {
    return;
  }

  tiles.forEach(tile => {
    void tile.offsetWidth;
    tile.classList.add('is-hit');
  });

  sideGiftHighlightTimer = window.setTimeout(() => {
    tiles.forEach(tile => tile.classList.remove('is-hit'));
  }, sideGiftHighlightMs);
}

function updateSideGiftImages(tiles, gift) {
  if (gift?.triggerType !== 'gift' || !gift.imageUrl) return;

  tiles.filter(tile => shouldUseSideGiftImage(tile, gift)).forEach(tile => {
    const image = tile.querySelector('img.side-gift-image');
    if (image) image.src = gift.imageUrl;
  });
}

function runSideGiftProfileAnimation(tiles, gift) {
  if (sideGiftConfig.animationsEnabled === false ||
      sideGiftConfig.profileAnimationEnabled === false ||
      gift?.triggerType !== 'gift') {
    return;
  }

  tiles.forEach(tile => {
    clearTimeout(tile.profileAnimationTimer);
    restoreSideGiftProfileName(tile);
    tile.classList.add('profile-animation-active');
    tile.classList.toggle('profile-has-avatar', Boolean(gift.avatarUrl));
    tile.querySelectorAll('.side-gift-profile-image').forEach(image => image.remove());
    runSideGiftProfileNameAnimation(tile, gift);

    if (gift.avatarUrl) {
      const profileImage = document.createElement('img');
      profileImage.className = 'side-gift-profile-image';
      profileImage.alt = '';
      profileImage.src = gift.avatarUrl;
      profileImage.addEventListener('error', () => profileImage.remove(), { once: true });
      tile.append(profileImage);
    }

    tile.profileAnimationTimer = window.setTimeout(() => {
      tile.classList.remove('profile-animation-active');
      tile.classList.remove('profile-has-avatar');
      tile.querySelectorAll('.side-gift-profile-image').forEach(image => image.remove());
      restoreSideGiftProfileName(tile);
      tile.profileAnimationTimer = null;
    }, sideGiftHighlightMs);
  });
}

function clearSideGiftProfileAnimations() {
  sideGiftsWidget.querySelectorAll('.side-gift-tile.profile-animation-active, .side-gift-tile.profile-has-avatar').forEach(tile => {
    clearTimeout(tile.profileAnimationTimer);
    tile.profileAnimationTimer = null;
    tile.classList.remove('profile-animation-active');
    tile.classList.remove('profile-has-avatar');
    restoreSideGiftProfileName(tile);
  });
  sideGiftsWidget.querySelectorAll('.side-gift-profile-image').forEach(image => image.remove());
}

function runSideGiftProfileNameAnimation(tile, gift) {
  if (sideGiftConfig.profileNameEnabled !== true || !gift?.supporter) {
    return;
  }

  const label = tile.querySelector('strong');
  const profileLabel = label?.querySelector('.side-gift-label-profile');
  if (label && profileLabel) {
    profileLabel.textContent = gift.supporter;
    label.classList.add('profile-name-active');
  }
}

function restoreSideGiftProfileName(tile) {
  const labels = tile ? tile.querySelectorAll('strong') : sideGiftsWidget.querySelectorAll('.side-gift-tile strong');
  labels.forEach(label => {
    label.classList.remove('profile-name-active');
    const profileLabel = label.querySelector('.side-gift-label-profile');
    if (profileLabel) {
      profileLabel.textContent = '';
    }
  });
}

function playSideGiftSound(tile) {
  if (sideGiftConfig.soundsEnabled === false || !tile?.dataset.sound) {
    return;
  }

  const volume = Math.min(1, Math.max(0, Number(tile.dataset.volume || 0.85)));
  try {
    const audio = new Audio(tile.dataset.sound);
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {
    // ignore sound errors
  }
}

function shouldUseSideGiftImage(tile, gift) {
  if (tile.dataset.useGiftImage !== '1') return false;

  const configuredKeys = String(tile.dataset.giftImageKeys || '').split('|').filter(Boolean);
  if (!configuredKeys.length) return true;

  const giftKeys = getSideGiftKeys({
    ids: [gift.giftId],
    names: [gift.giftName]
  });
  return giftKeys.some(key => configuredKeys.includes(key));
}

function startSideGiftTestMode() {
  const testGifts = sideGifts.length ? sideGifts : sideGiftCatalog.slice(0, 10);
  let index = 0;

  window.simulateSideGift = (giftName = '') => {
    const gift = testGifts[index % testGifts.length];
    highlightSideGift({
      giftName: giftName || gift?.label || 'Gift',
      giftId: gift?.id || '',
      triggerType: gift?.triggerType || 'gift',
      triggerKey: gift ? getSideGiftTriggerKey(gift) : '',
      supporter: `Test Gifter ${index + 1}`,
      avatarUrl: getTestAvatarImage(index)
    });
    index += 1;
  };

  window.setTimeout(sendTestSideGift, getRandomSideGiftTestDelay(500, 1700));

  function sendTestSideGift() {
    window.simulateSideGift();
    window.setTimeout(sendTestSideGift, getRandomSideGiftTestDelay(sideGiftHighlightMs + 450, sideGiftHighlightMs + 2600));
  }
}

function getRandomSideGiftTestDelay(min, max) {
  return Math.round(min + (Math.random() * (max - min)));
}

function normalizeSideGiftEvent(data) {
  return {
    triggerType: 'gift',
    giftName: data.giftDetails?.giftName || data.gift?.name || data.giftName || data.extendedGiftInfo?.name || 'Gift',
    giftId: normalizeSideGiftId(data.giftId || data.gift?.id || data.gift?.giftId || data.giftDetails?.giftId || data.extendedGiftInfo?.id || data.extendedGiftInfo?.gift_id || ''),
    supporter: getSideGiftSupporterName(data, 'Unknown'),
    imageUrl: findSideGiftImage(data),
    avatarUrl: findSideGiftAvatarImage(data)
  };
}

function normalizeSideGiftCatalog(list) {
  return list.map(item => ({
    id: normalizeSideGiftId(item.id || item.giftId || ''),
    label: getSideGiftDisplayLabel(item.label || item.name || item.image || 'Gift'),
    triggerType: 'gift',
    image: String(item.image || item.path || item.url || ''),
    row: Number.isInteger(Number(item.row)) ? Number(item.row) : undefined,
    side: String(item.side || ''),
    likesRequired: 50,
    useGiftImage: false,
    giftImageKeys: [],
    sound: '',
    volume: 0.85,
    keys: getSideGiftKeys({
      ids: [item.id || item.giftId],
      names: [item.name, item.label]
    })
  })).filter(gift => gift.image);
}

function normalizeSideGifts(list) {
  return list.filter(gift => gift.enabled !== false).map(gift => {
    const triggerType = normalizeSideGiftTriggerType(gift.triggerType);
    const hasUseGiftImage = Object.prototype.hasOwnProperty.call(gift, 'useGiftImage');
    const likesRequired = clampSideGiftInteger(Number(gift.likesRequired || 50), 1, 1000000000);

    return {
      id: normalizeSideGiftId(gift.giftIds?.[0] || ''),
      label: getSideGiftDisplayLabel(gift.title || gift.giftNames?.[0] || gift.image || 'Gift'),
      triggerType,
      likesRequired,
      image: getSideGiftTriggerIcon({
        triggerType,
        likesRequired,
        likesHeartColor: gift.likesHeartColor,
        likesNumberColor: gift.likesNumberColor,
        likesHeartSize: gift.likesHeartSize,
        likesNumberSize: gift.likesNumberSize
      }) || getSideGiftCatalogImage(gift),
      row: Number.isInteger(Number(gift.row)) ? Number(gift.row) : undefined,
      side: String(gift.side || ''),
      sound: String(gift.sound || ''),
      volume: clampSideGiftNumber(Number(gift.volume ?? 0.85), 0, 1),
      useGiftImage: triggerType === 'gift' && (gift.useGiftImage === true || (!hasUseGiftImage && isSideHeartMeGift(gift))),
      giftImageKeys: getSideGiftKeys({
        ids: gift.giftImageIds || [],
        names: gift.giftImageNames || []
      }),
      keys: getSideGiftKeys({
        ids: gift.giftIds || [],
        names: [...(gift.giftNames || []), gift.title],
        triggers: [getSideGiftTriggerKey({ triggerType, likesRequired })]
      })
    };
  }).filter(gift => gift.image);
}

function isSideHeartMeGift(gift) {
  const ids = (gift.giftIds || []).map(normalizeSideGiftId).filter(Boolean);
  const names = [
    ...(gift.giftNames || []),
    gift.title,
    gift.name
  ].map(normalizeSideGiftName).filter(Boolean);
  return ids.includes('33') || names.includes('heart me');
}

function loadSideGiftConfig() {
  const hashConfig = readSideGiftConfigFromHash();
  const fallback = window.rewardOverlayConfig || {};
  const saved = readSavedSideGiftConfig();
  return {
    sideGifts: {
      ...(fallback.sideGifts || {}),
      ...(saved?.sideGifts || {}),
      ...(hashConfig?.sideGifts || {}),
      ...readSideGiftQueryConfig()
    },
    rowsOverlay: hashConfig?.rowsOverlay || saved?.rowsOverlay || fallback.rowsOverlay || {}
  };
}

function readSideGiftQueryConfig() {
  return removeEmptySideGiftFields({
    side: sideGiftParams.get('side'),
    width: sideGiftParams.get('width'),
    height: sideGiftParams.get('height'),
    iconSize: sideGiftParams.get('iconSize'),
    gap: sideGiftParams.get('gap'),
    insetX: sideGiftParams.get('insetX'),
    insetY: sideGiftParams.get('insetY'),
    showLabels: sideGiftParams.has('labels') ? sideGiftParams.get('labels') !== '0' : undefined,
    outlinesEnabled: sideGiftParams.has('outlines') ? sideGiftParams.get('outlines') === '1' : undefined,
    tilesEnabled: sideGiftParams.has('tiles') ? sideGiftParams.get('tiles') === '1' : undefined,
    idleGlowEnabled: sideGiftParams.has('idleGlow') ? sideGiftParams.get('idleGlow') === '1' : undefined,
    labelSize: sideGiftParams.get('labelSize'),
    labelTwoLines: sideGiftParams.has('labelTwoLines') ? sideGiftParams.get('labelTwoLines') === '1' : undefined,
    labelColor: sideGiftParams.get('labelColor'),
    gifterLabelColor: sideGiftParams.get('gifterLabelColor'),
    outlineColor: sideGiftParams.get('outlineColor'),
    outlineSize: sideGiftParams.get('outlineSize'),
    giftOutlineColor: sideGiftParams.get('giftOutlineColor'),
    giftOutlineSize: sideGiftParams.get('giftOutlineSize'),
    tileColor: sideGiftParams.get('tileColor'),
    tileOpacity: sideGiftParams.get('tileOpacity'),
    tileBorderColor: sideGiftParams.get('tileBorderColor'),
    soundsEnabled: sideGiftParams.has('sounds') ? sideGiftParams.get('sounds') !== '0' : undefined,
    animationsEnabled: sideGiftParams.has('animations') ? sideGiftParams.get('animations') !== '0' : undefined,
    profileAnimationEnabled: sideGiftParams.has('profileAnimation') ? sideGiftParams.get('profileAnimation') !== '0' : undefined,
    profileNameEnabled: sideGiftParams.has('profileName') ? sideGiftParams.get('profileName') === '1' : undefined
  });
}

function normalizeSideGiftConfig(config) {
  const side = String(config.side || 'both').toLowerCase();
  return {
    side: side === 'left' || side === 'right' ? side : 'both',
    width: clampSideGiftInteger(Number(config.width || 1080), 180, 1920),
    height: clampSideGiftInteger(Number(config.height || 960), 240, 1920),
    iconSize: clampSideGiftInteger(Number(config.iconSize || 65), 24, 120),
    gap: clampSideGiftInteger(Number(config.gap ?? 26), 0, 40),
    insetX: clampSideGiftInteger(Number(config.insetX ?? 8), 0, 160),
    insetY: clampSideGiftInteger(Number(config.insetY ?? 34), 0, 240),
    hitMs: clampSideGiftInteger(Number(config.hitMs || 6500), 300, 10000),
    showLabels: config.showLabels !== false,
    outlinesEnabled: config.outlinesEnabled === true,
    tilesEnabled: config.tilesEnabled === true,
    idleGlowEnabled: config.idleGlowEnabled === true,
    labelSize: clampSideGiftInteger(Number(config.labelSize || 10), 8, 28),
    labelTwoLines: config.labelTwoLines === true,
    labelColor: normalizeSideGiftHex(config.labelColor, '#ffffff'),
    gifterLabelColor: normalizeSideGiftHex(config.gifterLabelColor, '#ffffff'),
    outlineColor: normalizeSideGiftHex(config.outlineColor, '#10131b'),
    outlineSize: clampSideGiftNumber(Number(config.outlineSize ?? 0.45), 0, 4),
    giftOutlineColor: normalizeSideGiftHex(config.giftOutlineColor, '#10131b'),
    giftOutlineSize: clampSideGiftNumber(Number(config.giftOutlineSize ?? 2), 0, 8),
    soundsEnabled: config.soundsEnabled !== false,
    animationsEnabled: config.animationsEnabled !== false,
    profileAnimationEnabled: config.profileAnimationEnabled !== false,
    profileNameEnabled: config.profileAnimationEnabled !== false && config.profileNameEnabled !== false,
    glow: normalizeSideGiftHex(config.glow, '#03f5d8'),
    hitColor: normalizeSideGiftHex(config.hitColor, '#ffd83d'),
    tileColor: normalizeSideGiftHex(config.tileColor, '#0d0f14'),
    tileOpacity: clampSideGiftNumber(Number(config.tileOpacity ?? 0.82), 0, 1),
    tileBorderColor: normalizeSideGiftHex(config.tileBorderColor, '#ffffff')
  };
}

function readSideGiftConfigFromHash() {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get('config');
  if (!encoded) return null;

  try {
    const config = JSON.parse(decodeURIComponent(escape(atob(toSideGiftBase64(encoded)))));
    if (config?._ === 'r2') {
      return {
        rowsOverlay: expandCompactSideRowsOverlay(config.o),
        sideGifts: expandCompactSideGifts(config.z)
      };
    }
    return config;
  } catch {
    return null;
  }
}

function readSavedSideGiftConfig() {
  if (sideGiftParams.get('savedConfig') === '0') return null;

  try {
    return JSON.parse(localStorage.getItem('reward-overlay-config:v1') || 'null');
  } catch {
    return null;
  }
}

function expandCompactSideGifts(config) {
  if (!config) return undefined;
  return removeEmptySideGiftFields({
    side: config.a,
    width: config.b,
    height: config.c,
    iconSize: config.d,
    gap: config.e,
    insetX: config.f,
    insetY: config.g,
    showLabels: config.h === 0 ? false : undefined,
    glow: config.i,
    hitColor: config.j,
    hitMs: config.k,
    outlinesEnabled: config.aa === 1 ? true : undefined,
    tilesEnabled: config.ab === 1 ? true : undefined,
    idleGlowEnabled: config.am === 1 ? true : undefined,
    labelSize: config.ac,
    labelTwoLines: config.ak === 1 ? true : undefined,
    labelColor: config.ad,
    gifterLabelColor: config.an,
    outlineColor: config.ae,
    giftOutlineColor: config.af,
    outlineSize: config.ai,
    giftOutlineSize: config.aj,
    soundsEnabled: config.l === 0 ? false : undefined,
    animationsEnabled: config.n === 0 ? false : undefined,
    profileAnimationEnabled: config.o === 0 ? false : undefined,
    profileNameEnabled: config.p === 0 ? false : config.p === 1 ? true : undefined,
    tileColor: config.ag,
    tileBorderColor: config.ah,
    tileOpacity: config.ao,
    gifts: Array.isArray(config.m) ? config.m.map(expandCompactSideGift) : undefined
  });
}

function expandCompactSideGift(gift) {
  return {
    ...expandCompactSideRowsGift(gift),
    side: gift?.r,
    useGiftImage: gift?.u === 1,
    giftImageNames: Array.isArray(gift?.x) ? gift.x : [],
    giftImageIds: Array.isArray(gift?.y) ? gift.y : []
  };
}

function expandCompactSideRowsOverlay(rows) {
  if (!rows) return undefined;
  return removeEmptySideGiftFields({
    gifts: Array.isArray(rows.j) ? rows.j.map(expandCompactSideRowsGift) : undefined
  });
}

function expandCompactSideRowsGift(gift) {
  return {
    enabled: gift?.e === 0 ? false : undefined,
    title: gift?.t,
    giftNames: Array.isArray(gift?.n) ? gift.n : [],
    giftIds: Array.isArray(gift?.i) ? gift.i : [],
    image: gift?.m,
    triggerType: gift?.q,
    likesRequired: gift?.l,
    likesHeartColor: gift?.j,
    likesNumberColor: gift?.k,
    likesHeartSize: gift?.o,
    likesNumberSize: gift?.p,
    row: gift?.r,
    useGiftImage: gift?.u === 1,
    giftImageNames: Array.isArray(gift?.x) ? gift.x : [],
    giftImageIds: Array.isArray(gift?.y) ? gift.y : []
  };
}

function readSideGiftParams() {
  const params = new URLSearchParams(window.location.search);
  const scriptUrl = document.currentScript?.src || '';
  const scriptQuery = scriptUrl.includes('?') ? scriptUrl.slice(scriptUrl.indexOf('?') + 1) : '';
  const scriptParams = new URLSearchParams(scriptQuery);
  scriptParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

function resolveSideGiftImageUrl(image) {
  const value = String(image || '');
  if (window.location.hostname.endsWith('github.io') && value.startsWith('./rewards/')) {
    return `${remoteSideGiftImageBase}${encodeURIComponent(value.replace('./rewards/', ''))}`;
  }
  return value;
}

function findSideGiftImage(data) {
  return data.giftPictureUrl ||
    data.giftImageUrl ||
    data.gift?.imageUrl ||
    data.gift?.pictureUrl ||
    firstSideGiftUrl(data.giftDetails?.giftImage?.urlList) ||
    firstSideGiftUrl(data.giftDetails?.image?.urlList) ||
    firstSideGiftUrl(data.extendedGiftInfo?.image?.urlList) ||
    firstSideGiftUrl(data.extendedGiftInfo?.icon?.urlList) ||
    '';
}

function getSideGiftSupporterName(data, fallback) {
  return data.user?.nickname || data.user?.uniqueId || data.nickname || data.uniqueId || data.username || fallback;
}

function findSideGiftAvatarImage(data) {
  const user = data.user || {};
  return data.profilePictureUrl ||
    data.avatarUrl ||
    data.profilePicture?.url ||
    firstSideGiftUrl(data.profilePicture?.urlList) ||
    user.profilePictureUrl ||
    user.avatarUrl ||
    user.profilePicture?.url ||
    firstSideGiftUrl(user.profilePicture?.urlList) ||
    firstSideGiftUrl(user.avatarThumb?.urlList) ||
    firstSideGiftUrl(user.avatarMedium?.urlList) ||
    firstSideGiftUrl(user.avatarLarger?.urlList) ||
    '';
}

function getTestAvatarImage(index = 0) {
  const colors = ['03f5d8', 'c447ff', 'ffd83d', 'fe2c55'];
  const color = colors[index % colors.length];
  const label = String(index + 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#${color}"/><circle cx="80" cy="62" r="30" fill="rgba(255,255,255,.9)"/><path d="M28 146c6-38 26-58 52-58s46 20 52 58" fill="rgba(255,255,255,.9)"/><text x="80" y="86" text-anchor="middle" fill="#10131b" font-family="Arial,sans-serif" font-size="42" font-weight="900">${escapeHtml(label)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getSideGiftCatalogImage(gift) {
  const currentImage = String(gift.image || '');
  const match = findSideGiftCatalogEntry(gift);
  return match?.image || currentImage;
}

function findSideGiftCatalogEntry(gift) {
  if (!sideGiftCatalog.length) return null;

  const currentImage = String(gift.image || '');
  const ids = [
    ...(gift.giftIds || []),
    getSideGiftIdFromImagePath(gift.image)
  ].map(normalizeSideGiftId).filter(Boolean);
  const names = [
    ...(gift.giftNames || []),
    gift.title,
    getSideGiftDisplayLabel(gift.image)
  ].map(normalizeSideGiftName).filter(Boolean);

  const imageMatch = currentImage
    ? sideGiftCatalog.find(entry => String(entry.image || '') === currentImage)
    : null;
  if (imageMatch) {
    return imageMatch;
  }

  const nameMatches = sideGiftCatalog.filter(entry => names.includes(normalizeSideGiftName(entry.label)));
  if (nameMatches.length === 1) {
    return nameMatches[0];
  }

  const idMatches = sideGiftCatalog.filter(entry => ids.includes(normalizeSideGiftId(entry.id)));
  return idMatches.length === 1 ? idMatches[0] : null;
}

function getSideGiftTriggerIcon(item) {
  const type = normalizeSideGiftTriggerType(item?.triggerType || item);
  if (type === 'gift') return '';

  const isFollow = type === 'follow';
  const likes = Math.max(1, Math.floor(Number(item?.likesRequired || 50)));
  const heartColor = normalizeSideGiftHex(item?.likesHeartColor, '#ef233c');
  const numberColor = normalizeSideGiftHex(item?.likesNumberColor, '#ffffff');
  const heartScale = clampSideGiftInteger(Number(item?.likesHeartSize || 160), 40, 160) / 100;
  const numberSize = clampSideGiftInteger(Number(item?.likesNumberSize || 96), 16, 96);
  const canvasWidth = Math.max(300, Math.ceil(180 + (String(likes).length * numberSize * 0.68)));
  const svg = isFollow
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 104"><circle cx="42" cy="31" r="17" fill="#25f4ee"/><path d="M13 86c2-24 14-37 29-37s27 13 29 37" fill="#25f4ee"/><circle cx="78" cy="61" r="20" fill="#fe2c55"/><path d="M78 49v24M66 61h24" stroke="white" stroke-width="7" stroke-linecap="round"/></svg>'
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} 160"><g transform="translate(40 27)"><g transform="translate(50 53) scale(${heartScale}) translate(-50 -53)"><path d="M50 91C21 73 8 58 8 40c0-14 10-24 24-24 8 0 15 4 18 11 3-7 10-11 18-11 14 0 24 10 24 24 0 18-13 33-42 51Z" fill="${heartColor}"/></g></g><text x="180" y="80" fill="${numberColor}" font-family="Arial, sans-serif" font-size="${numberSize}" font-weight="800" dominant-baseline="middle">${likes}</text></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getSideGiftKeys({ ids = [], names = [], triggers = [] }) {
  const keys = [];
  ids.map(normalizeSideGiftId).filter(Boolean).forEach(id => keys.push(`id:${id}`));
  names.filter(Boolean).forEach(name => keys.push(`name:${normalizeSideGiftName(name)}`));
  triggers.map(normalizeSideGiftName).filter(type => type && type !== 'gift').forEach(type => keys.push(`trigger:${type}`));
  return [...new Set(keys)];
}

function getSideGiftTriggerKey(gift) {
  const type = normalizeSideGiftTriggerType(gift?.triggerType);
  return type === 'likes' ? `likes:${gift.likesRequired}` : type;
}

function normalizeSideGiftTriggerType(value) {
  const type = String(value || '').trim().toLowerCase();
  return type === 'follow' || type === 'likes' ? type : 'gift';
}

function getSideGiftDisplayLabel(label) {
  return String(label || '')
    .replace(/^\.\/rewards\//, '')
    .replace(/\.(avif|gif|jpe?g|png|svg|webp)$/i, '')
    .replace(/^\d+[_ -]+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSideGiftIdFromImagePath(imagePath) {
  const filename = String(imagePath || '').split('/').pop() || '';
  const match = filename.match(/^(\d+)[_ -]+/);
  return match ? match[1] : '';
}

function normalizeSideGiftName(name) {
  return String(name || '').trim().toLowerCase();
}

function normalizeSideGiftId(id) {
  const value = String(id || '').trim();
  return /^\d+$/.test(value) ? String(Number(value)) : value;
}

function normalizeSideGiftHex(value, fallback = '#ffffff') {
  const text = String(value || '').trim();
  const fallbackHex = /^#[0-9a-f]{6}$/i.test(String(fallback || '')) ? fallback.toLowerCase() : '#ffffff';
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text.toLowerCase()}`;
  return fallbackHex;
}

function hexToRgb(hex) {
  const normalized = normalizeSideGiftHex(hex);
  return `${parseInt(normalized.slice(1, 3), 16)}, ${parseInt(normalized.slice(3, 5), 16)}, ${parseInt(normalized.slice(5, 7), 16)}`;
}

function firstSideGiftUrl(urls) {
  return Array.isArray(urls) ? urls[0] : '';
}

function removeEmptySideGiftFields(value) {
  Object.keys(value).forEach(key => {
    if (value[key] === undefined || value[key] === null || value[key] === '') delete value[key];
  });
  return value;
}

function toSideGiftBase64(value) {
  const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
}

function clampSideGiftInteger(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function clampSideGiftNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
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
