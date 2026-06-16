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

const streakSettleDelay = 2400;
const rewardTransitionMs = 820;

renderRewards();
setVisibleRewardCount();
setInitialReward(0);
startRotation();
setupGiftSimulator();

if (previewMode) {
  updateStatus('Preview', true);
} else if (testMode) {
  setupRewardAudio();
  setupRewardAudioUnlock();
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
    return urlConfig;
  }

  if (new URLSearchParams(window.location.search).get('savedConfig') === '0') {
    return fallbackConfig;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(rewardStorageKey) || 'null');
    return saved && Array.isArray(saved.rewards) ? saved : fallbackConfig;
  } catch {
    return fallbackConfig;
  }
}

function readConfigFromHash() {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get('config');

  if (!encoded) {
    return null;
  }

  try {
    const config = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    return config && Array.isArray(config.rewards) ? config : null;
  } catch {
    return null;
  }
}

function connect() {
  const ws = new WebSocket(tikfinityUrl);

  ws.addEventListener('open', () => {
    updateStatus('Connected to TikFinity', true);
  });

  ws.addEventListener('message', event => {
    const message = parseMessage(event.data);
    if (!message || String(message.event || '').toLowerCase() !== 'gift') {
      return;
    }

    handleGiftEvent(message.data || {});
  });

  ws.addEventListener('close', () => {
    updateStatus('Waiting for TikFinity', false);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 1500);
  });
}

function renderRewards() {
  const loopedRewards = Array.from({ length: 5 }, () => rewards).flat();

  rewardTrack.innerHTML = loopedRewards.map((reward, index) => `
    <article class="reward-card" data-reward-index="${index % rewards.length}">
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
  void rewardWidget.offsetWidth;
  rewardWidget.classList.add('reward-hit');

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
  rewardWidget.classList.add('reward-hold');

  presentationTimer = setTimeout(resumeRotation, holdOnGiftMs);
}

function playRewardSound(reward) {
  if (rewardConfig.soundsEnabled === false || !reward?.sound) {
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

  window.setTimeout(sendTestGift, 900);

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
      streakKey: `test|${giftId || giftName}`
    });

    lastRewardIndex = nextRewardIndex;
    testIndex += 1;
    window.setTimeout(sendTestGift, holdOnGiftMs + 1200);
  }
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

    applyGift({
      supporter: options.supporter || options.user || 'Test Gifter',
      giftName,
      giftId,
      imageUrl: options.imageUrl || options.image || '',
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
  return rewards.findIndex(reward => {
    const giftId = normalizeId(gift.giftId);
    const giftName = normalizeName(gift.giftName);

    return reward.giftIds.includes(giftId) || reward.giftNames.includes(giftName);
  });
}

function normalizeRewards(nextRewards) {
  const list = Array.isArray(nextRewards) ? nextRewards : [];
  const normalized = list.filter(reward => reward.enabled !== false).map(reward => ({
    enabled: true,
    title: String(reward.title || 'Reward'),
    image: getCatalogImageForReward(reward),
    useGiftImage: Boolean(reward.useGiftImage),
    sound: String(reward.sound || ''),
    volume: clampDecimal(Number(reward.volume ?? 0.85), 0, 1),
    giftImageNames: (reward.giftImageNames || []).map(normalizeName),
    giftImageIds: (reward.giftImageIds || []).map(normalizeId).filter(Boolean),
    giftNames: (reward.giftNames || []).map(normalizeName),
    giftIds: (reward.giftIds || []).map(normalizeId).filter(Boolean)
  }));

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
