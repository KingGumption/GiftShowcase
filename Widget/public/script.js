const likeCount = document.querySelector('#like-count');
const likeGoal = document.querySelector('#like-goal');
const likePercent = document.querySelector('#like-percent');
const progress = document.querySelector('#like-progress');
const progressBar = document.querySelector('.bar');
const counter = document.querySelector('.counter');
const supporter = document.querySelector('#supporter');
const giftDetail = document.querySelector('#gift-detail');
const supportAvatar = document.querySelector('#support-avatar');
const giftIcon = document.querySelector('#gift-icon');
const supportWidget = document.querySelector('.support-widget') || document.querySelector('.support-panel');
const status = document.querySelector('#status');

const params = new URLSearchParams(window.location.search);
const isThinGoalSource = document.body.classList.contains('thin-source');
const goalConfig = loadGoalBarConfig();
const goalType = isThinGoalSource ? goalConfig.type : 'likes';
const tikfinityUrl = params.get('endpoint') || 'ws://localhost:21213/';
const likeGoalStep = Math.max(1, Number(params.get('step') || goalConfig.step || 5000));
const initialGoalTarget = Math.max(1, Number(params.get('target') || goalConfig.target || goalConfig.step || 5000));
const startingLikes = Math.max(0, Number(params.get('start') || goalConfig.start || 0));
const resetOnConnect = params.has('resetOnConnect') ? params.get('resetOnConnect') !== '0' : goalConfig.resetOnConnect;
const useLiveFollowerCount = goalType !== 'followers' || (params.has('liveFollowers') ? params.get('liveFollowers') !== '0' : goalConfig.useLiveFollowerCount !== false);
const storageKey = `tiktok-goal-widget:${goalType}:${initialGoalTarget}:${likeGoalStep}:${useLiveFollowerCount ? 'live' : 'session'}`;
const debugTikfinity = params.get('debug') === '1';
const debugTikfinityLimit = Math.max(1, Math.min(200, Number(params.get('debugLimit') || 30) || 30));

let reconnectTimer;
let state = loadState();
let likeBursts = [];
let lastSupportKey = '';
let pendingGiftStreaks = new Map();
let countedSupportStreaks = new Map();
let debugTikfinityCount = 0;

const streakSettleDelay = 2400;

connect();
applyGoalBarConfig(goalConfig);
render(state);
setInterval(updateLikeHeat, 500);

function connect() {
  const ws = new WebSocket(tikfinityUrl);

  ws.addEventListener('open', () => {
    if (resetOnConnect) {
      resetStateForNewConnection();
    }

    state.connected = true;
    state.status = 'Connected to TikFinity';
    saveState();
    render(state);
  });

  ws.addEventListener('message', event => {
    const message = parseMessage(event.data);
    logTikfinityDebugMessage(event.data, message);

    if (!message) {
      return;
    }

    handleTikfinityEvent(message.event, message.data || {});
  });

  ws.addEventListener('close', () => {
    state.connected = false;
    state.status = 'Waiting for TikFinity';
    render(state);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 1500);
  });
}

function logTikfinityDebugMessage(rawMessage, parsedMessage) {
  if (!debugTikfinity || debugTikfinityCount >= debugTikfinityLimit) {
    return;
  }

  debugTikfinityCount += 1;

  const eventName = parsedMessage?.event || 'unparsed';
  const interestingFields = parsedMessage ? findInterestingTikfinityFields(parsedMessage) : [];

  console.groupCollapsed(`[TikFinity debug ${debugTikfinityCount}/${debugTikfinityLimit}] ${eventName}`);
  console.log('Raw message:', rawMessage);
  console.log('Parsed message:', parsedMessage);

  if (interestingFields.length) {
    console.table(interestingFields);
  } else {
    console.log('No obvious broadcaster/follower fields found in this message.');
  }

  if (debugTikfinityCount === debugTikfinityLimit) {
    console.info(`TikFinity debug limit reached. Add debugLimit=100 to the URL to log more messages.`);
  }

  console.groupEnd();
}

function findInterestingTikfinityFields(value) {
  const matches = [];
  const seen = new Set();
  const interestingPattern = /(anchor|author|broadcaster|creator|follow|follower|host|owner|room|streamer|uniqueid|userid|user_id)/i;

  function visit(nextValue, path, depth) {
    if (!nextValue || typeof nextValue !== 'object' || depth > 5 || seen.has(nextValue)) {
      return;
    }

    seen.add(nextValue);

    Object.entries(nextValue).forEach(([key, child]) => {
      const childPath = path ? `${path}.${key}` : key;

      if (interestingPattern.test(key)) {
        matches.push({
          path: childPath,
          value: summarizeDebugValue(child)
        });
      }

      if (child && typeof child === 'object') {
        visit(child, childPath, depth + 1);
      }
    });
  }

  visit(value, '', 0);
  return matches.slice(0, 80);
}

function summarizeDebugValue(value) {
  if (value == null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return `[array:${value.length}]`;
  }

  return `{${Object.keys(value).slice(0, 10).join(', ')}}`;
}

function handleTikfinityEvent(eventName, data) {
  const event = String(eventName || '').toLowerCase();

  if (goalType === 'followers') {
    const previousFollowers = state.likes;
    const totalFollowers = useLiveFollowerCount ? getFollowerTotal(data) : 0;

    if (totalFollowers > 0) {
      state.likes = totalFollowers;
      state.likeGoal = nextLikeGoal(state.likes);
      recordLikeBurst(Math.max(0, totalFollowers - previousFollowers));
      if (debugTikfinity) {
        console.info('Follower goal synced from TikFinity follower total:', {
          event,
          totalFollowers,
          previousFollowers,
          delta: totalFollowers - previousFollowers,
          nextGoal: state.likeGoal
        });
      }
      saveState();
      render(state);
      return;
    }

    if (isFollowerGoalIncrementEvent(event, data)) {
      state.likes = Math.max(state.likes + 1, startingLikes);
      state.likeGoal = nextLikeGoal(state.likes);
      recordLikeBurst(1);
      if (debugTikfinity) {
        console.info('Follower goal incremented from TikFinity event:', { event, data });
      }
      saveState();
      render(state);
      return;
    }
  }

  if (event === 'like') {
    if (goalType !== 'likes') {
      return;
    }

    const previousLikes = state.likes;
    const totalLikes = Number(data.totalLikeCount || data.totalLikes || data.likeCountTotal || 0);
    const increment = Number(data.likeCount || data.likes || 0);
    state.likes = Math.max(state.likes, totalLikes || state.likes + increment);
    recordLikeBurst(Math.max(0, state.likes - previousLikes || increment));
    state.likeGoal = nextLikeGoal(state.likes);
    saveState();
    render(state);
    return;
  }

  if (event === 'gift') {
    handleGiftEvent(data);
  }
}

function isFollowerGoalIncrementEvent(event, data) {
  if (event === 'follow' || event === 'follower' || event === 'newfollow') {
    return true;
  }

  if (event !== 'social') {
    return false;
  }

  const actionText = [
    data?.action,
    data?.actionType,
    data?.displayType,
    data?.label,
    data?.type,
    data?.socialType,
    data?.event
  ]
    .filter(value => value != null)
    .map(value => String(value).toLowerCase())
    .join(' ');

  return /\bfollow(?:ed|s|ing)?\b/.test(actionText);
}

function handleGiftEvent(data) {
  if (isStreakableGift(data) && data.repeatEnd !== true) {
    queueGiftStreak(data);
    return;
  }

  const support = normalizeGift(data);

  if (!support) {
    return;
  }

  clearGiftStreak(support.streakKey);
  processSupportGift(support, { dedupeStreak: support.giftType === 1 });
}

function getFollowerTotal(data) {
  const candidates = [
    data.totalFollowerCount,
    data.totalFollowers,
    data.followerCount,
    data.followers,
    data.currentFollowers,
    data.currentFollowerCount,
    data.roomInfo?.followerCount,
    data.roomInfo?.followers,
    data.room?.followerCount,
    data.room?.followers,
    data.stats?.followerCount,
    data.stats?.followers
  ];

  for (const candidate of candidates) {
    const total = Number(candidate);

    if (Number.isFinite(total) && total > 0) {
      return Math.floor(total);
    }
  }

  return 0;
}

function queueGiftStreak(data) {
  const support = normalizeGift(data);

  if (!support) {
    return;
  }

  const pending = pendingGiftStreaks.get(support.streakKey);

  if (pending && isNewGiftStreakInstance(pending.support, support)) {
    clearGiftStreak(support.streakKey);
    processSupportGift(pending.support, { dedupeStreak: true });
  } else {
    clearGiftStreak(support.streakKey);
  }

  if (!pending && support.repeatCount <= 1) {
    countedSupportStreaks.delete(getSupportCountKey(support));
  }

  const timer = setTimeout(() => {
    pendingGiftStreaks.delete(support.streakKey);
    processSupportGift(support, { dedupeStreak: true });
  }, streakSettleDelay);

  pendingGiftStreaks.set(support.streakKey, { support, timer });
}

function clearGiftStreak(streakKey) {
  const pending = pendingGiftStreaks.get(streakKey);

  if (!pending) {
    return;
  }

  clearTimeout(pending.timer);
  pendingGiftStreaks.delete(streakKey);
}

function processSupportGift(support, options = {}) {
  recordStreamSupportCoins(support, options);
  applySupportGift(support);
}

function applySupportGift(support) {
  if (!state.biggestSupport || support.totalCoins > state.biggestSupport.totalCoins) {
    state.biggestSupport = support;
    saveState();
    render(state);
  }
}

function recordStreamSupportCoins(support, options = {}) {
  if (goalType !== 'support') {
    return;
  }

  const coins = Math.max(0, Math.floor(Number(support.totalCoins || 0)));
  let delta = coins;

  if (options.dedupeStreak) {
    const countKey = getSupportCountKey(support);
    const previous = getCountedSupportStreak(countKey);
    delta = Math.max(0, coins - previous.coins);

    countedSupportStreaks.set(countKey, {
      coins: Math.max(coins, previous.coins),
      updatedAt: Date.now()
    });
  }

  if (!delta) {
    return;
  }

  state.likes = Math.max(startingLikes, Number(state.likes || 0) + delta);
  state.likeGoal = nextLikeGoal(state.likes);
  recordLikeBurst(Math.min(50, Math.max(1, delta / 10)));
  saveState();
  render(state);
}

function getCountedSupportStreak(streakKey) {
  const counted = countedSupportStreaks.get(streakKey);
  const now = Date.now();

  if (!counted || now - counted.updatedAt > 10000) {
    return { coins: 0, updatedAt: now };
  }

  return counted;
}

function getSupportCountKey(support) {
  return support.messageId || support.streakKey;
}

function isNewGiftStreakInstance(previousSupport, nextSupport) {
  if (!previousSupport?.messageId || !nextSupport?.messageId) {
    return false;
  }

  return previousSupport.messageId !== nextSupport.messageId &&
    Number(nextSupport.repeatCount || 1) <= Number(previousSupport.repeatCount || 1);
}

function recordLikeBurst(count) {
  const likes = Math.min(50, Math.max(0, Number(count || 0)));

  if (!likes) {
    return;
  }

  likeBursts.push({
    at: Date.now(),
    likes
  });

  updateLikeHeat();
}

function updateLikeHeat() {
  const now = Date.now();
  likeBursts = likeBursts.filter(burst => now - burst.at < 4000);

  const weightedLikes = likeBursts.reduce((total, burst) => {
    const age = now - burst.at;
    const weight = Math.max(0, 1 - age / 4000);
    return total + burst.likes * weight;
  }, 0);
  const likesPerSecond = weightedLikes / 4;
  const heat = Math.max(0, Math.min(100, likesPerSecond * 45));

  document.body.style.setProperty('--like-heat', heat.toFixed(1));
  document.body.style.setProperty('--like-hue', String(Math.round(174 - heat * 1.38)));
  document.body.classList.toggle('likes-hot', heat > 38);
  document.body.classList.toggle('likes-hype', heat > 62);
}

function render(nextState) {
  const likes = Number(nextState.likes || 0);
  const goal = Number(nextState.likeGoal || 5000);
  const percent = Math.max(0, Math.min(100, Math.floor((likes / goal) * 100)));

  if (likeCount && likeGoal && likePercent && progress && progressBar && counter) {
    const countText = formatNumber(likes);
    likeCount.textContent = countText;
    likeGoal.textContent = formatNumber(goal);
    likePercent.textContent = `(${percent}%)`;
    updateThinCounterWidth(countText);
    fitCounter();
    progress.style.width = `${percent}%`;
    progressBar.style.setProperty('--progress', `${percent}%`);
    progressBar.setAttribute('aria-valuenow', String(percent));
  }

  if (!supporter || !giftDetail || !supportAvatar || !giftIcon) {
    updateStatus(nextState.status || 'Ready', nextState.connected);
    return;
  }

  if (nextState.biggestSupport) {
    const supportKey = getSupportKey(nextState.biggestSupport);
    if (lastSupportKey && supportKey !== lastSupportKey) {
      triggerSupportLeadAnimation();
    }
    lastSupportKey = supportKey;
    setSupporterName(nextState.biggestSupport.supporter || 'Unknown');
    giftDetail.textContent = describeGift(nextState.biggestSupport);
    setSupportImages(nextState.biggestSupport.avatarUrl, nextState.biggestSupport.imageUrl);
    fitSupportText();
  } else {
    lastSupportKey = '';
    setSupporterName('Waiting...');
    giftDetail.textContent = 'No gifts yet';
    setSupportImages('', '');
    fitSupportText();
  }

  updateStatus(nextState.status || 'Ready', nextState.connected);
}

function getSupportKey(support) {
  return [
    support.supporter || 'Unknown',
    support.totalCoins || 0,
    support.giftName || 'Gift',
    support.repeatCount || 1
  ].join('|');
}

function triggerSupportLeadAnimation() {
  if (!supportWidget) {
    return;
  }

  supportWidget.classList.remove('support-takeover');
  void supportWidget.offsetWidth;
  supportWidget.classList.add('support-takeover');
}

function describeGift(support) {
  const gift = support.giftName || 'Gift';
  const count = Number(support.repeatCount || 1);
  const coins = Number(support.totalCoins || 0);
  const parts = [gift];

  if (count > 1) {
    parts.push(`x${formatNumber(count)}`);
  }

  if (coins > 0) {
    parts.push(`${formatNumber(coins)} coins`);
  }

  return parts.join(' - ');
}

function normalizeGift(data) {
  const repeatCount = Math.max(1, Number(data.repeatCount || data.repeat || data.amount || 1));
  const diamondCount = Number(
    data.diamondCount ||
    data.giftDetails?.diamondCount ||
    data.gift?.diamondCount ||
    data.extendedGiftInfo?.diamond_count ||
    data.extendedGiftInfo?.cost ||
    data.gift?.cost ||
    data.gift?.coins ||
    0
  );
  const totalCoins = Number(data.totalCoins || data.totalDiamondCount || data.value || diamondCount * repeatCount);

  return {
    supporter: data.user?.nickname || data.user?.uniqueId || data.nickname || data.uniqueId || data.username || 'Unknown',
    giftName: data.giftDetails?.giftName || data.gift?.name || data.giftName || data.extendedGiftInfo?.name || 'Gift',
    repeatCount,
    diamondCount,
    totalCoins,
    avatarUrl: findAvatarImage(data),
    imageUrl: findGiftImage(data),
    giftType: getGiftType(data),
    streakKey: getGiftStreakKey(data),
    messageId: getGiftMessageId(data),
    receivedAt: Date.now()
  };
}

function isStreakableGift(data) {
  return getGiftType(data) === 1;
}

function getGiftType(data) {
  const giftType = Number(
    data.giftDetails?.giftType ||
    data.gift?.giftType ||
    data.extendedGiftInfo?.gift_type ||
    data.extendedGiftInfo?.giftType ||
    data.giftType ||
    0
  );

  return Number.isFinite(giftType) ? giftType : 0;
}

function getGiftStreakKey(data) {
  return [
    data.user?.uniqueId || data.uniqueId || data.username || data.user?.nickname || data.nickname || 'Unknown',
    data.giftId || data.gift?.id || data.giftDetails?.giftId || data.extendedGiftInfo?.id || data.giftName || data.giftDetails?.giftName || 'Gift'
  ].join('|');
}

function getGiftMessageId(data) {
  return String(data.msgId || data.messageId || data.id || data.gift?.msgId || data.giftDetails?.msgId || '').trim();
}

function findAvatarImage(data) {
  const user = data.user || {};
  const image =
    data.profilePictureUrl ||
    data.avatarUrl ||
    data.profilePicture?.url ||
    data.profilePicture?.urlList?.[0] ||
    user.profilePictureUrl ||
    user.avatarUrl ||
    user.profilePicture?.url ||
    firstUrl(user.profilePicture?.urlList) ||
    firstUrl(user.avatarThumb?.urlList) ||
    firstUrl(user.avatarMedium?.urlList) ||
    firstUrl(user.avatarLarger?.urlList);

  return image || '';
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

function nextLikeGoal(likes) {
  const count = Number(likes || 0);

  if (count < initialGoalTarget) {
    return initialGoalTarget;
  }

  return initialGoalTarget + Math.ceil((count - initialGoalTarget + 1) / likeGoalStep) * likeGoalStep;
}

function applyGoalBarConfig(config) {
  if (!document.body.classList.contains('thin-source')) {
    return;
  }

  const label = document.querySelector('.thin-source .heading span');
  const icon = document.querySelector('.thin-source .heading-icon');
  if (label) {
    label.textContent = config.label || 'Like Goal';
  }

  if (icon) {
    icon.innerHTML = getGoalIconSvg(config.type);
  }

  const root = document.documentElement;
  root.style.setProperty('--thin-goal-width', `${config.width || 1080}px`);
  root.style.setProperty('--thin-goal-height', `${config.height || 44}px`);
  root.style.setProperty('--thin-goal-accent', config.accent || '#03f5d8');
  root.style.setProperty('--thin-goal-glow', config.glow || '#c447ff');
  root.style.setProperty('--thin-goal-text', config.text || '#ffffff');
}

function loadGoalBarConfig() {
  const defaults = {
    type: 'likes',
    label: 'Like Goal',
    target: 5000,
    step: 5000,
    start: 0,
    resetOnConnect: true,
    useLiveFollowerCount: true,
    width: 1080,
    height: 44,
    accent: '#03f5d8',
    glow: '#c447ff',
    text: '#ffffff'
  };
  const urlConfig = readOverlayConfigFromHash();
  const savedConfig = readSavedOverlayConfig();
  const fallbackConfig = window.rewardOverlayConfig || {};

  return normalizeGoalBarConfig(
    urlConfig?.goalBar ||
    savedConfig?.goalBar ||
    fallbackConfig.goalBar ||
    {},
    defaults
  );
}

function readSavedOverlayConfig() {
  if (new URLSearchParams(window.location.search).get('savedConfig') === '0') {
    return null;
  }

  try {
    return JSON.parse(localStorage.getItem('reward-overlay-config:v1') || 'null');
  } catch {
    return null;
  }
}

function readOverlayConfigFromHash() {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get('config');

  if (!encoded) {
    return null;
  }

  try {
    const config = JSON.parse(decodeURIComponent(escape(atob(toBase64(encoded)))));

    if (config?._ === 'r2') {
      return {
        goalBar: expandCompactGoalBar(config.q)
      };
    }

    return config;
  } catch {
    return null;
  }
}

function expandCompactGoalBar(goal) {
  if (!goal) {
    return undefined;
  }

  return {
    label: goal.a,
    step: goal.b,
    start: goal.c,
    resetOnConnect: goal.d === 0 ? false : goal.d === 1 ? true : undefined,
    width: goal.e,
    height: goal.f,
    accent: goal.g,
    glow: goal.h,
    text: goal.i,
    type: goal.j,
    target: goal.l,
    useLiveFollowerCount: goal.m === 0 ? false : undefined
  };
}

function normalizeGoalBarConfig(config, defaults) {
  const type = normalizeGoalType(config.type);
  const defaultLabel = defaultGoalLabel(type, defaults);
  const legacyStep = Math.max(1, Math.floor(Number(config.step || defaults.step)));
  return {
    type,
    label: String(config.label || defaultLabel).replace(/\s+/g, ' ').trim().slice(0, 32) || defaultLabel,
    target: Math.max(1, Math.floor(Number(config.target || legacyStep))),
    step: legacyStep,
    start: Math.max(0, Math.floor(Number(config.start || defaults.start))),
    resetOnConnect: typeof config.resetOnConnect === 'boolean' ? config.resetOnConnect : defaultGoalResetOnConnect(type),
    useLiveFollowerCount: config.useLiveFollowerCount !== false,
    width: clampNumber(Number(config.width || defaults.width), 320, 1920),
    height: clampNumber(Number(config.height || defaults.height), 30, 120),
    accent: normalizeGoalHex(config.accent, defaults.accent),
    glow: normalizeGoalHex(config.glow, defaults.glow),
    text: normalizeGoalHex(config.text, defaults.text)
  };
}

function normalizeGoalHex(value, fallback) {
  const text = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function normalizeGoalType(type) {
  const value = String(type || '').toLowerCase();
  return value === 'followers' || value === 'support' ? value : 'likes';
}

function defaultGoalLabel(type, defaults) {
  const goalType = normalizeGoalType(type);

  if (goalType === 'followers') {
    return 'Follower Goal';
  }

  if (goalType === 'support') {
    return 'Gift Goal';
  }

  return defaults?.label || 'Like Goal';
}

function defaultGoalResetOnConnect(type) {
  return normalizeGoalType(type) !== 'followers';
}

function getGoalIconSvg(type) {
  const goalType = normalizeGoalType(type);

  if (goalType === 'followers') {
    return '<path d="M9.5 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M2.8 20.5c.8-4.1 3.1-6.1 6.7-6.1 2.2 0 3.9.8 5 2.3"/><path d="M18 8v7"/><path d="M14.5 11.5h7"/>';
  }

  if (goalType === 'support') {
    return '<path d="M20 7h-3.2c.5-.5.8-1.2.8-2 0-1.7-1.3-3-3-3-1.2 0-2.2.7-2.7 1.7C11.4 2.7 10.4 2 9.2 2c-1.7 0-3 1.3-3 3 0 .8.3 1.5.8 2H4v6h1v8h14v-8h1V7Zm-5.4-3c.6 0 1 .4 1 1s-.4 1-1 1h-1.8c.2-1.1.8-2 1.8-2ZM8.2 5c0-.6.4-1 1-1 1 0 1.6.9 1.8 2H9.2c-.6 0-1-.4-1-1ZM6 9h5v3H6V9Zm1 5h4v5H7v-5Zm10 5h-4v-5h4v5Zm1-7h-5V9h5v3Z"/>';
  }

  return '<path d="M12 21s-7-4.4-9.3-8.6C.8 8.9 2.7 5 6.5 5c2.1 0 3.7 1.2 4.5 2.8C11.8 6.2 13.4 5 15.5 5c3.8 0 5.7 3.9 3.8 7.4C17 16.6 12 21 12 21Z"/>';
}

function clampNumber(value, min, max) {
  const number = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, number));
}

function toBase64(value) {
  const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const likes = Math.max(Number(saved.likes || 0), startingLikes);

    return {
      connected: false,
      status: 'Waiting for TikFinity',
      likes,
      likeGoal: nextLikeGoal(likes),
      biggestSupport: saved.biggestSupport || null
    };
  } catch {
    return {
      connected: false,
      status: 'Waiting for TikFinity',
      likes: startingLikes,
      likeGoal: nextLikeGoal(startingLikes),
      biggestSupport: null
    };
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({
    likes: state.likes,
    biggestSupport: state.biggestSupport
  }));
}

function resetStateForNewConnection() {
  state.likes = startingLikes;
  state.likeGoal = nextLikeGoal(startingLikes);
  state.biggestSupport = null;
  countedSupportStreaks.clear();
}

function parseMessage(message) {
  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
}

function fitCounter() {
  counter.style.fontSize = '';

  let size = Number.parseFloat(getComputedStyle(counter).fontSize);
  const minSize = document.body.classList.contains('thin-source') ? 10 : 18;

  while (counter.scrollWidth > counter.clientWidth && size > minSize) {
    size -= 1;
    counter.style.fontSize = `${size}px`;
  }
}

function updateThinCounterWidth(text) {
  if (!document.body.classList.contains('thin-source')) {
    return;
  }

  const width = Math.max(44, Math.min(168, String(text).length * 10 + 34));
  counter.style.setProperty('--thin-counter-width', `${width}px`);
}

function fitSupportText() {
  fitElementText(giftDetail, getElementFontSize(giftDetail), 8);
  updateSupporterNameMotion();
}

function setSupporterName(name) {
  supporter.innerHTML = `<span class="support-name-scroll">${escapeHtml(name)}</span>`;
}

function updateSupporterNameMotion() {
  const name = supporter.querySelector('.support-name-scroll');

  if (!name) {
    return;
  }

  supporter.classList.remove('is-marquee');
  supporter.style.removeProperty('--marquee-distance');

  requestAnimationFrame(() => {
    const overflow = name.scrollWidth - supporter.clientWidth;

    if (overflow > 2) {
      supporter.style.setProperty('--marquee-distance', `${overflow}px`);
      supporter.classList.add('is-marquee');
    }
  });
}

function fitElementText(element, startSize, minSize) {
  element.style.fontSize = `${startSize}px`;

  let size = startSize;
  while (element.scrollWidth > element.clientWidth && size > minSize) {
    size -= 1;
    element.style.fontSize = `${size}px`;
  }
}

function getElementFontSize(element) {
  element.style.fontSize = '';
  return Number.parseFloat(getComputedStyle(element).fontSize);
}

function setSupportImages(avatarUrl, giftUrl) {
  if (avatarUrl) {
    supportAvatar.innerHTML = `<img alt="" src="${escapeAttribute(avatarUrl)}">`;
  } else {
    supportAvatar.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12c2.3 0 4.2-1.9 4.2-4.2S14.3 3.6 12 3.6 7.8 5.5 7.8 7.8 9.7 12 12 12Zm0 2.1c-3.1 0-6.8 1.7-6.8 3.9v1.4h13.6V18c0-2.2-3.7-3.9-6.8-3.9Z"/>
      </svg>
    `;
  }

  if (giftUrl) {
    giftIcon.innerHTML = `<img alt="" src="${escapeAttribute(giftUrl)}">`;
    return;
  }

  giftIcon.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 7h-3.2c.5-.5.8-1.2.8-2 0-1.7-1.3-3-3-3-1.2 0-2.2.7-2.7 1.7C11.4 2.7 10.4 2 9.2 2c-1.7 0-3 1.3-3 3 0 .8.3 1.5.8 2H4v6h1v8h14v-8h1V7Zm-5.4-3c.6 0 1 .4 1 1s-.4 1-1 1h-1.8c.2-1.1.8-2 1.8-2ZM8.2 5c0-.6.4-1 1-1 1 0 1.6.9 1.8 2H9.2c-.6 0-1-.4-1-1ZM6 9h5v3H6V9Zm1 5h4v5H7v-5Zm10 5h-4v-5h4v5Zm1-7h-5V9h5v3Z"/>
    </svg>
  `;
}

function updateStatus(text, connected = false) {
  status.textContent = text;
  document.body.classList.toggle('show-status', !connected);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.floor(Number(value || 0)));
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
