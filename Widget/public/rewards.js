const rewardStorageKey = 'reward-overlay-config:v1';
const rewardConfig = loadRewardConfig();
const rewardTrack = document.querySelector('#rewards-track');
const rewardWidget = document.querySelector('#rewards-widget');
const rewardCallout = document.querySelector('#reward-callout');
const rewardGifter = document.querySelector('#reward-gifter');
const rewardAction = document.querySelector('#reward-action');
const status = document.querySelector('#status');

const params = new URLSearchParams(window.location.search);
const tikfinityUrl = params.get('endpoint') || 'ws://localhost:21213/';
const testMode = params.get('test') === '1';
const previewMode = params.get('preview') === '1';
const muteMode = params.get('mute') === '1';
const rotateMs = Math.max(1200, Number(params.get('rotateMs') || rewardConfig.rotateMs || 2600));
const holdOnGiftMs = Math.max(2200, Number(params.get('holdMs') || rewardConfig.holdOnGiftMs || 6500));
const labelMs = Math.max(900, Number(params.get('labelMs') || rewardConfig.labelMs || 2600));
const rewards = normalizeRewards(rewardConfig.rewards || []);
const visibleNext = clampNumber(Number(params.get('visibleNext') ?? rewardConfig.visibleNext ?? 3), 0, 3);
const visibleCount = visibleNext + 1;

let activeIndex = 0;
let visualIndex = rewards.length;
let rotateTimer;
let holdTimer;
let hitTimer;
let labelTimer;
let presentationTimer;
let reconnectTimer;
let pendingGiftStreaks = new Map();
let giftQueue = [];
let isPresentingGift = false;
let pendingSoundReward = null;
let audioUnlocked = false;
let rewardAudio = new Map();
let receivedLikeCount = 0;

const streakSettleDelay = 2400;
const rewardTransitionMs = 820;

applyThemeToDocument(rewardConfig.carouselTheme || rewardConfig.theme);
rewardWidget.classList.toggle('received-animations-disabled', rewardConfig.animationsEnabled === false);
renderRewards();
setVisibleRewardCount();
setInitialReward(0);
startRotation();
setupGiftSimulator();

if (previewMode) {
  updateStatus('Preview', true);
} else if (testMode) {
  if (!muteMode) {
    setupRewardAudio();
    setupRewardAudioUnlock();
  }
  startTestMode();
} else {
  setupRewardAudio();
  setupRewardAudioUnlock();
  connect();
}

function loadRewardConfig() {
  const fallbackConfig = window.rewardOverlayConfig || {};
  const urlConfig = readConfigFromHash();

  if (urlConfig) {
    return normalizeRewardConfig(urlConfig, fallbackConfig);
  }

  if (new URLSearchParams(window.location.search).get('savedConfig') === '0') {
    return normalizeRewardConfig(fallbackConfig, fallbackConfig);
  }

  try {
    const saved = JSON.parse(localStorage.getItem(rewardStorageKey) || 'null');
    return saved ? normalizeRewardConfig(saved, fallbackConfig) : normalizeRewardConfig(fallbackConfig, fallbackConfig);
  } catch {
    return normalizeRewardConfig(fallbackConfig, fallbackConfig);
  }
}

function readConfigFromHash() {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get('config');

  if (!encoded) {
    return null;
  }

  try {
    const config = JSON.parse(decodeURIComponent(escape(atob(toBase64(encoded)))));
    const expanded = expandCompactConfig(config);
    return expanded && typeof expanded === 'object' ? expanded : null;
  } catch {
    return null;
  }
}

function toBase64(value) {
  const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
}

function expandCompactConfig(config) {
  if (!config || config._ !== 'r2') {
    return config;
  }

  return removeEmptyUrlFields({
    rotateMs: config.a,
    holdOnGiftMs: config.b,
    labelMs: config.c,
    visibleNext: config.d,
    soundsEnabled: config.e === 0 ? false : undefined,
    animationsEnabled: config.f === 0 ? false : undefined,
    theme: expandCompactTheme(config.t),
    carouselTheme: expandCompactTheme(config.u),
    rowsTheme: expandCompactTheme(config.v),
    rowsOverlay: expandCompactRowsOverlay(config.o),
    rewards: Array.isArray(config.g) ? config.g.map(expandCompactReward) : undefined
  });
}

function expandCompactTheme(theme) {
  if (!theme) {
    return undefined;
  }

  return removeEmptyUrlFields({
    preset: theme.p || 'glass-purple',
    accent: theme.a,
    secondary: theme.b,
    background: theme.c,
    card: theme.d,
    text: theme.e,
    border: theme.f,
    glow: theme.g,
    opacity: theme.h,
    glowStrength: theme.i
  });
}

function expandCompactRowsOverlay(rows) {
  if (!rows) {
    return undefined;
  }

  return removeEmptyUrlFields({
    rows: rows.a,
    perRow: rows.b,
    scrollRows: rows.c,
    directions: rows.d,
    speeds: rows.e,
    rowHeight: rows.f,
    gap: rows.g,
    names: rows.h === 0 ? false : undefined,
    soundsEnabled: rows.i === 0 ? false : undefined,
    animationsEnabled: rows.k === 0 ? false : undefined,
    gifts: Array.isArray(rows.j) ? rows.j.map(expandCompactRowsGift) : undefined
  });
}

function expandCompactRowsGift(gift) {
  return {
    ...expandCompactGift(gift),
    row: gift?.r
  };
}

function expandCompactReward(gift) {
  return {
    ...expandCompactGift(gift),
    useGiftImage: gift?.u === 1,
    giftImageNames: Array.isArray(gift?.x) ? gift.x : [],
    giftImageIds: Array.isArray(gift?.y) ? gift.y : []
  };
}

function expandCompactGift(gift = {}) {
  return removeEmptyUrlFields({
    enabled: gift.e === 0 ? false : undefined,
    title: gift.t,
    giftNames: Array.isArray(gift.n) ? gift.n : [],
    giftIds: Array.isArray(gift.i) ? gift.i : [],
    image: gift.m,
    sound: gift.s,
    volume: gift.v,
    triggerType: gift.q,
    likesRequired: gift.l,
    likesHeartColor: gift.j,
    likesNumberColor: gift.k,
    likesHeartSize: gift.o,
    likesNumberSize: gift.p
  });
}

function removeEmptyUrlFields(value) {
  Object.keys(value).forEach(key => {
    if (value[key] === undefined || value[key] === null) {
      delete value[key];
    }
  });

  return value;
}

function normalizeRewardConfig(config = {}, fallback = {}) {
  const rewards = Array.isArray(config.rewards) && config.rewards.length
    ? config.rewards
    : Array.isArray(fallback.rewards)
      ? fallback.rewards
      : [];

  return {
    ...fallback,
    ...config,
    theme: {
      ...(fallback.theme || {}),
      ...(config.theme || {})
    },
    carouselTheme: {
      ...(fallback.carouselTheme || fallback.theme || {}),
      ...(config.carouselTheme || config.theme || {})
    },
    rewards
  };
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
    opacity: clampNumber(Number(theme.opacity ?? defaults.opacity), 0.35, 1),
    glowStrength: clampNumber(Number(theme.glowStrength ?? defaults.glowStrength), 0, 1.5)
  };
  const themeTargets = [document.documentElement, rewardWidget].filter(Boolean);
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

function connect() {
  const ws = new WebSocket(tikfinityUrl);

  ws.addEventListener('open', () => {
    updateStatus('Connected to TikFinity', true);
  });

  ws.addEventListener('message', event => {
    const message = parseMessage(event.data);
    if (!message) {
      return;
    }

    handleTikTokEvent(String(message.event || '').toLowerCase(), message.data || {});
  });

  ws.addEventListener('close', () => {
    updateStatus('Waiting for TikFinity', false);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 1500);
  });
}

function handleTikTokEvent(eventName, data) {
  if (eventName === 'gift') {
    handleGiftEvent(data);
    return;
  }

  if (eventName === 'follow') {
    applyEventReward('follow', data, 1);
    return;
  }

  if (eventName === 'like') {
    const increment = getLikeIncrement(data);
    if (increment > 0) {
      receivedLikeCount += increment;
      applyEventReward('likes', data, increment);
    }
  }
}

function applyEventReward(triggerType, data, increment) {
  rewards.forEach((reward, rewardIndex) => {
    if (reward.triggerType !== triggerType) {
      return;
    }

    if (triggerType === 'likes') {
      const previousTotal = receivedLikeCount - increment;
      const previousMilestone = Math.floor(previousTotal / reward.likesRequired);
      const currentMilestone = Math.floor(receivedLikeCount / reward.likesRequired);

      for (let milestone = previousMilestone; milestone < currentMilestone; milestone += 1) {
        applyGift({
          supporter: getSupporterName(data, 'TikTok viewers'),
          giftName: reward.title,
          giftId: '',
          imageUrl: '',
          triggerType,
          rewardIndex,
          streakKey: `likes|${rewardIndex}|${milestone + 1}`
        });
      }
      return;
    }

    applyGift({
      supporter: getSupporterName(data, 'New follower'),
      giftName: reward.title,
      giftId: '',
      imageUrl: '',
      triggerType,
      rewardIndex,
      streakKey: `${triggerType}|${rewardIndex}|${Date.now()}`
    });
  });
}

function getLikeIncrement(data) {
  return Math.max(0, Math.floor(Number(data.likeCount || data.likes || data.count || 0)));
}

function getSupporterName(data, fallback) {
  return data.user?.nickname || data.user?.uniqueId || data.nickname || data.uniqueId || data.username || fallback;
}

function renderRewards() {
  const loopedRewards = Array.from({ length: 5 }, () => rewards).flat();

  rewardTrack.innerHTML = loopedRewards.map((reward, index) => `
    <article class="reward-card reward-trigger-${escapeAttribute(reward.triggerType)}" data-reward-index="${index % rewards.length}">
      <div class="reward-image">
        ${getRewardImageMarkup(reward)}
      </div>
      <strong>${escapeHtml(reward.title)}</strong>
    </article>
  `).join('');
}

function getRewardImageMarkup(reward) {
  return reward.image ? `<img alt="" src="${escapeAttribute(reward.image)}">` : getFallbackIcon();
}

function setVisibleRewardCount() {
  rewardWidget.style.setProperty('--reward-visible-count', visibleCount);
}

function startRotation() {
  clearInterval(rotateTimer);

  rotateTimer = setInterval(() => {
    advanceToReward((activeIndex + 1) % rewards.length);
  }, rotateMs);
}

function resumeRotation() {
  isPresentingGift = false;
  rewardWidget.classList.remove('reward-hold');

  const nextGift = giftQueue.shift();

  if (nextGift) {
    presentGift(nextGift);
    return;
  }

  startRotation();
}

function setInitialReward(index) {
  activeIndex = wrapIndex(index);
  visualIndex = rewards.length * 2 + activeIndex;
  rewardWidget.style.setProperty('--reward-visual-index', visualIndex);
  updateActiveCard();
}

function advanceToReward(index, giftEvent = null) {
  const nextIndex = wrapIndex(index);
  const distance = (nextIndex - activeIndex + rewards.length) % rewards.length;

  activeIndex = nextIndex;
  visualIndex += distance || (giftEvent ? 0 : rewards.length);
  rewardWidget.style.setProperty('--reward-visual-index', visualIndex);
  updateActiveCard();

  if (!giftEvent) {
    scheduleVisualReset();
    return;
  }

  const reward = rewards[activeIndex];
  clearTimeout(hitTimer);
  clearTimeout(labelTimer);
  rewardWidget.classList.remove('reward-hit');
  if (rewardConfig.animationsEnabled !== false) {
    void rewardWidget.offsetWidth;
    rewardWidget.classList.add('reward-hit');
  }

  rewardGifter.textContent = giftEvent.supporter;
  rewardAction.textContent = reward.title;
  rewardCallout.classList.remove('is-visible');
  void rewardCallout.offsetWidth;
  rewardCallout.classList.add('is-visible');
  hitTimer = setTimeout(() => {
    rewardWidget.classList.remove('reward-hit');
  }, 1700);
  labelTimer = setTimeout(() => {
    rewardCallout.classList.remove('is-visible');
  }, labelMs);
  scheduleVisualReset();
}

function updateActiveCard() {
  rewardTrack.querySelectorAll('.reward-card').forEach((card, cardIndex) => {
    card.classList.toggle('is-active', cardIndex === visualIndex);
  });
}

function scheduleVisualReset() {
  window.setTimeout(() => {
    if (visualIndex < rewards.length * 3) {
      return;
    }

    visualIndex = rewards.length * 2 + activeIndex;
    rewardTrack.classList.add('is-resetting');
    rewardWidget.style.setProperty('--reward-visual-index', visualIndex);
    updateActiveCard();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rewardTrack.classList.remove('is-resetting');
      });
    });
  }, rewardTransitionMs);
}

function handleGiftEvent(data) {
  if (isStreakableGift(data) && data.repeatEnd !== true) {
    queueGiftStreak(data);
    return;
  }

  const gift = normalizeGift(data);
  clearGiftStreak(gift.streakKey);
  applyGift(gift);
}

function queueGiftStreak(data) {
  const gift = normalizeGift(data);
  clearGiftStreak(gift.streakKey);

  const timer = setTimeout(() => {
    pendingGiftStreaks.delete(gift.streakKey);
    applyGift(gift);
  }, streakSettleDelay);

  pendingGiftStreaks.set(gift.streakKey, { gift, timer });
}

function clearGiftStreak(streakKey) {
  const pending = pendingGiftStreaks.get(streakKey);

  if (!pending) {
    return;
  }

  clearTimeout(pending.timer);
  pendingGiftStreaks.delete(streakKey);
}

function applyGift(gift) {
  const rewardIndex = findRewardIndex(gift);

  if (rewardIndex === -1) {
    return;
  }

  const matchedGift = { gift, rewardIndex };

  if (isPresentingGift) {
    giftQueue.push(matchedGift);
    return;
  }

  presentGift(matchedGift);
}

function presentGift({ gift, rewardIndex }) {
  isPresentingGift = true;
  clearInterval(rotateTimer);
  clearTimeout(holdTimer);
  clearTimeout(presentationTimer);

  updateRewardGiftImage(rewardIndex, gift);
  advanceToReward(rewardIndex, gift);
  playRewardSound(rewards[rewardIndex]);
  if (rewardConfig.animationsEnabled !== false) {
    rewardWidget.classList.add('reward-hold');
  }

  presentationTimer = setTimeout(resumeRotation, holdOnGiftMs);
}

function playRewardSound(reward) {
  if (muteMode || rewardConfig.soundsEnabled === false || !reward?.sound) {
    return;
  }

  pendingSoundReward = reward;

  const audio = getRewardAudio(reward);
  if (!audio) {
    return;
  }

  audio.pause();
  audio.currentTime = 0;
  audio.volume = reward.volume;

  audio.play().then(() => {
    audioUnlocked = true;
    pendingSoundReward = null;
  }).catch(() => {
    updateStatus(audioUnlocked ? `Could not play sound: ${reward.sound}` : 'Click or press a key to enable reward sounds', false);
  });
}

function setupRewardAudio() {
  rewards.forEach(reward => {
    if (!reward.sound || rewardAudio.has(reward.sound)) {
      return;
    }

    const audio = new Audio(reward.sound);
    audio.preload = 'auto';
    audio.addEventListener('error', () => {
      updateStatus(`Missing or unsupported sound: ${reward.sound}`, false);
    });
    rewardAudio.set(reward.sound, audio);
  });
}

function setupRewardAudioUnlock() {
  if (!rewards.some(reward => reward.sound)) {
    return;
  }

  window.addEventListener('pointerdown', unlockRewardAudio);
  window.addEventListener('keydown', unlockRewardAudio);
}

function unlockRewardAudio() {
  window.removeEventListener('pointerdown', unlockRewardAudio);
  window.removeEventListener('keydown', unlockRewardAudio);
  audioUnlocked = true;

  const unlocks = [...rewardAudio.values()].map(audio => {
    const previousVolume = audio.volume;
    audio.volume = 0;
    audio.muted = true;
    audio.currentTime = 0;

    return audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = previousVolume;
    }).catch(() => {
      audio.muted = false;
      audio.volume = previousVolume;
    });
  });

  Promise.allSettled(unlocks).then(() => {
    if (pendingSoundReward) {
      playRewardSound(pendingSoundReward);
      return;
    }

    updateStatus(testMode ? 'Test mode' : 'Reward sounds enabled', true);
  });
}

function getRewardAudio(reward) {
  const audio = rewardAudio.get(reward.sound);

  if (!audio) {
    updateStatus(`Missing sound config: ${reward.sound}`, false);
  }

  return audio;
}

function startTestMode() {
  updateStatus('Test mode', true);

  const matchingRewards = rewards.filter(reward => reward.giftNames.length || reward.giftIds.length);
  const testRewards = matchingRewards.length ? matchingRewards : rewards;
  let testIndex = 0;
  let lastRewardIndex = -1;

  window.setTimeout(sendTestGift, getRandomTestDelay(700, 1800));

  function sendTestGift() {
    const nextRewardIndex = getRandomTestRewardIndex(testRewards, lastRewardIndex);
    const reward = testRewards[nextRewardIndex];
    const giftName = reward.giftImageNames[0] || reward.giftNames[0] || reward.title;
    const giftId = reward.giftImageIds[0] || reward.giftIds[0] || '';

    applyGift({
      supporter: `Test Gifter ${testIndex + 1}`,
      giftName,
      giftId,
      imageUrl: reward.useGiftImage ? getTestGiftImage(reward, testIndex) : '',
      triggerType: reward.triggerType,
      rewardIndex: rewards.indexOf(reward),
      streakKey: `test|${giftId || giftName}`
    });

    lastRewardIndex = nextRewardIndex;
    testIndex += 1;
    window.setTimeout(sendTestGift, getRandomTestDelay(holdOnGiftMs + 700, holdOnGiftMs + 3200));
  }
}

function getRandomTestDelay(min, max) {
  return Math.round(min + (Math.random() * (max - min)));
}

function setupGiftSimulator() {
  window.simulateRewardGift = (giftNameOrOptions = '') => {
    const options = typeof giftNameOrOptions === 'object' && giftNameOrOptions !== null
      ? giftNameOrOptions
      : { giftName: giftNameOrOptions };
    const requestedName = normalizeName(options.giftName || options.name || '');
    const requestedId = String(options.giftId || options.id || '');
    const fallbackIndex = rewards.findIndex(reward => reward.giftNames.length || reward.giftIds.length);
    const rewardIndex = rewards.findIndex(reward => {
      return (requestedName && reward.giftNames.includes(requestedName)) ||
        (requestedId && reward.giftIds.includes(requestedId));
    });
    const reward = rewards[rewardIndex !== -1 ? rewardIndex : Math.max(fallbackIndex, 0)];
    const giftName = options.giftName || options.name || reward.giftNames[0] || reward.title;
    const giftId = options.giftId || options.id || reward.giftIds[0] || '';
    const triggerType = normalizeTriggerType(options.triggerType || options.trigger || reward.triggerType);

    applyGift({
      supporter: options.supporter || options.user || 'Test Gifter',
      giftName,
      giftId,
      imageUrl: options.imageUrl || options.image || '',
      triggerType,
      rewardIndex: rewards.indexOf(reward),
      streakKey: `manual|${giftId || giftName}`
    });

    updateStatus(`Simulated gift: ${giftName}`, true);
  };
}

function getRandomTestRewardIndex(testRewards, lastRewardIndex) {
  if (testRewards.length <= 1) {
    return 0;
  }

  let nextIndex = lastRewardIndex;

  while (nextIndex === lastRewardIndex) {
    nextIndex = Math.floor(Math.random() * testRewards.length);
  }

  return nextIndex;
}

function getTestGiftImage(reward, index) {
  if (reward.image) {
    return reward.image;
  }

  const hue = (index * 76) % 360;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <radialGradient id="g" cx="35%" cy="25%" r="72%">
          <stop offset="0" stop-color="white"/>
          <stop offset="0.36" stop-color="hsl(${hue} 100% 72%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 55) % 360} 94% 48%)"/>
        </radialGradient>
      </defs>
      <rect width="96" height="96" rx="24" fill="rgba(15,10,24,0.95)"/>
      <path d="M48 78C33 66 22 56 22 43c0-9 6-16 15-16 5 0 9 2 11 6 2-4 6-6 11-6 9 0 15 7 15 16 0 13-11 23-26 35Z" fill="url(#g)"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function updateRewardGiftImage(rewardIndex, gift) {
  const reward = rewards[rewardIndex];

  if (!reward?.useGiftImage || !gift.imageUrl || !shouldUseGiftImage(reward, gift)) {
    return;
  }

  reward.image = gift.imageUrl;

  rewardTrack.querySelectorAll(`[data-reward-index="${rewardIndex}"] .reward-image`).forEach(image => {
    image.innerHTML = getRewardImageMarkup(reward);
  });
}

function shouldUseGiftImage(reward, gift) {
  if (!reward.giftImageNames.length && !reward.giftImageIds.length) {
    return true;
  }

  return reward.giftImageNames.includes(normalizeName(gift.giftName)) || reward.giftImageIds.includes(normalizeId(gift.giftId));
}

function findRewardIndex(gift) {
  if (Number.isInteger(gift.rewardIndex) && rewards[gift.rewardIndex]?.triggerType === gift.triggerType) {
    return gift.rewardIndex;
  }

  return rewards.findIndex(reward => {
    if (reward.triggerType !== 'gift') {
      return false;
    }

    const giftId = normalizeId(gift.giftId);
    const giftName = normalizeName(gift.giftName);

    return reward.giftIds.includes(giftId) || reward.giftNames.includes(giftName);
  });
}

function normalizeRewards(nextRewards) {
  const list = Array.isArray(nextRewards) ? nextRewards : [];
  const normalized = list.filter(reward => reward.enabled !== false).map(reward => {
    const triggerType = normalizeTriggerType(reward.triggerType);
    return {
      enabled: true,
      title: String(reward.title || 'Reward'),
      triggerType,
      likesRequired: clampNumber(Number(reward.likesRequired || 50), 1, 1000000000),
      likesHeartColor: normalizeHex(reward.likesHeartColor, '#ef233c'),
      likesNumberColor: normalizeHex(reward.likesNumberColor, '#ffffff'),
      likesHeartSize: clampNumber(Number(reward.likesHeartSize || 160), 40, 160),
      likesNumberSize: clampNumber(Number(reward.likesNumberSize || 96), 16, 96),
      image: getTriggerIcon({
        triggerType,
        likesRequired: reward.likesRequired,
        likesHeartColor: reward.likesHeartColor,
        likesNumberColor: reward.likesNumberColor,
        likesHeartSize: reward.likesHeartSize,
        likesNumberSize: reward.likesNumberSize
      }) || getCatalogImageForReward(reward),
      useGiftImage: triggerType === 'gift' && Boolean(reward.useGiftImage),
      sound: String(reward.sound || ''),
      volume: clampDecimal(Number(reward.volume ?? 0.85), 0, 1),
      giftImageNames: (reward.giftImageNames || []).map(normalizeName),
      giftImageIds: (reward.giftImageIds || []).map(normalizeId).filter(Boolean),
      giftNames: (reward.giftNames || []).map(normalizeName),
      giftIds: (reward.giftIds || []).map(normalizeId).filter(Boolean)
    };
  });

  return normalized.length ? normalized : [{
    title: 'Reward',
    image: '',
    giftNames: [],
    giftIds: []
  }];
}

function normalizeGift(data) {
  return {
    supporter: data.user?.nickname || data.user?.uniqueId || data.nickname || data.uniqueId || data.username || 'Unknown',
    giftName: data.giftDetails?.giftName || data.gift?.name || data.giftName || data.extendedGiftInfo?.name || 'Gift',
    giftId: normalizeId(data.giftId || data.gift?.id || data.gift?.giftId || data.giftDetails?.giftId || data.extendedGiftInfo?.id || data.extendedGiftInfo?.gift_id || ''),
    imageUrl: findGiftImage(data),
    streakKey: getGiftStreakKey(data)
  };
}

function normalizeTriggerType(value) {
  const type = String(value || '').trim().toLowerCase();
  return type === 'follow' || type === 'likes' ? type : 'gift';
}

function getTriggerIcon(item) {
  const type = normalizeTriggerType(item?.triggerType || item);
  if (type === 'gift') {
    return '';
  }

  const isFollow = type === 'follow';
  const likes = Math.max(1, Math.floor(Number(item?.likesRequired || 50)));
  const heartColor = normalizeHex(item?.likesHeartColor, '#ef233c');
  const numberColor = normalizeHex(item?.likesNumberColor, '#ffffff');
  const heartScale = clampNumber(Number(item?.likesHeartSize || 160), 40, 160) / 100;
  const numberSize = clampNumber(Number(item?.likesNumberSize || 96), 16, 96);
  const canvasWidth = Math.max(300, Math.ceil(180 + (String(likes).length * numberSize * 0.68)));
  const svg = isFollow
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 104"><circle cx="42" cy="31" r="17" fill="#25f4ee"/><path d="M13 86c2-24 14-37 29-37s27 13 29 37" fill="#25f4ee"/><circle cx="78" cy="61" r="20" fill="#fe2c55"/><path d="M78 49v24M66 61h24" stroke="white" stroke-width="7" stroke-linecap="round"/></svg>'
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} 160"><g transform="translate(40 27)"><g transform="translate(50 53) scale(${heartScale}) translate(-50 -53)"><path d="M50 91C21 73 8 58 8 40c0-14 10-24 24-24 8 0 15 4 18 11 3-7 10-11 18-11 14 0 24 10 24 24 0 18-13 33-42 51Z" fill="${heartColor}"/></g></g><text x="180" y="80" fill="${numberColor}" font-family="Arial, sans-serif" font-size="${numberSize}" font-weight="800" dominant-baseline="middle">${likes}</text></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function findGiftImage(data) {
  const image =
    data.giftPictureUrl ||
    data.giftImageUrl ||
    data.gift?.imageUrl ||
    data.gift?.pictureUrl ||
    firstUrl(data.giftDetails?.giftImage?.urlList) ||
    firstUrl(data.giftDetails?.image?.urlList) ||
    firstUrl(data.extendedGiftInfo?.image?.urlList) ||
    firstUrl(data.extendedGiftInfo?.icon?.urlList);

  return image || '';
}

function firstUrl(urls) {
  return Array.isArray(urls) ? urls[0] : '';
}

function isStreakableGift(data) {
  const giftType = Number(
    data.giftDetails?.giftType ||
    data.gift?.giftType ||
    data.extendedGiftInfo?.gift_type ||
    data.extendedGiftInfo?.giftType ||
    data.giftType ||
    0
  );

  return giftType === 1;
}

function getGiftStreakKey(data) {
  return [
    data.user?.uniqueId || data.uniqueId || data.username || data.user?.nickname || data.nickname || 'Unknown',
    data.giftId || data.gift?.id || data.giftDetails?.giftId || data.extendedGiftInfo?.id || data.giftName || data.giftDetails?.giftName || 'Gift'
  ].join('|');
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function normalizeId(id) {
  const value = String(id || '').trim();
  return /^\d+$/.test(value) ? String(Number(value)) : value;
}

function getCatalogImageForReward(reward) {
  const currentImage = String(reward.image || '');
  const match = findCatalogEntryForReward(reward);
  return match?.image || currentImage;
}

function findCatalogEntryForReward(reward) {
  const catalog = Array.isArray(window.rewardImageCatalog) ? window.rewardImageCatalog : [];
  if (!catalog.length) {
    return null;
  }

  const ids = [
    ...(reward.giftIds || []),
    ...(reward.giftImageIds || []),
    getIdFromImagePath(reward.image)
  ].map(normalizeId).filter(Boolean);
  const names = [
    ...(reward.giftNames || []),
    ...(reward.giftImageNames || []),
    reward.title,
    getDisplayNameFromImagePath(reward.image)
  ].map(normalizeName).filter(Boolean);

  return catalog.find(entry => ids.includes(normalizeId(entry.id || entry.giftId))) ||
    catalog.find(entry => names.includes(normalizeName(entry.name || entry.label || getDisplayNameFromImagePath(entry.image))));
}

function getIdFromImagePath(imagePath) {
  const filename = String(imagePath || '').split('/').pop() || '';
  const match = filename.match(/^(\d+)[_ -]+/);
  return match ? match[1] : '';
}

function getDisplayNameFromImagePath(imagePath) {
  return String(imagePath || '')
    .split('/')
    .pop()
    .replace(/\.(avif|gif|jpe?g|png|svg|webp)$/i, '')
    .replace(/^\d+[_ -]+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapIndex(index) {
  return ((index % rewards.length) + rewards.length) % rewards.length;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return max;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function clampDecimal(value, min, max) {
  if (!Number.isFinite(value)) {
    return max;
  }

  return Math.min(max, Math.max(min, value));
}

function parseMessage(message) {
  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
}

function updateStatus(text, connected = false) {
  status.textContent = text;
  document.body.classList.toggle('show-status', !connected);
}

function getFallbackIcon() {
  return `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M52 20h-8.2A9.5 9.5 0 0 0 32 8.7 9.5 9.5 0 0 0 20.2 20H12v13h3v23h34V33h3V20ZM39.4 13.5A4.5 4.5 0 0 1 39.8 22H34c.6-4.8 2.5-8.1 5.4-8.5ZM24.6 13.5c2.9.4 4.8 3.7 5.4 8.5h-5.8a4.5 4.5 0 0 1 .4-8.5ZM18 26h12v7H18v-7Zm3 13h9v11h-9V39Zm22 11h-9V39h9v11Zm3-17H34v-7h12v7Z"/>
    </svg>
  `;
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
