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
const tikfinityUrl = params.get('endpoint') || 'ws://localhost:21213/';
const likeGoalStep = Math.max(1, Number(params.get('step') || 5000));
const startingLikes = Math.max(0, Number(params.get('start') || 0));
const resetOnConnect = params.get('resetOnConnect') !== '0';
const storageKey = `tiktok-goal-widget:${likeGoalStep}`;

let reconnectTimer;
let state = loadState();
let likeBursts = [];
let lastSupportKey = '';
let pendingGiftStreaks = new Map();

const streakSettleDelay = 2400;

connect();
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

function handleTikfinityEvent(eventName, data) {
  const event = String(eventName || '').toLowerCase();

  if (event === 'like') {
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
  applySupportGift(support);
}

function queueGiftStreak(data) {
  const support = normalizeGift(data);

  if (!support) {
    return;
  }

  clearGiftStreak(support.streakKey);

  const timer = setTimeout(() => {
    pendingGiftStreaks.delete(support.streakKey);
    applySupportGift(support);
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

function applySupportGift(support) {
  if (!state.biggestSupport || support.totalCoins > state.biggestSupport.totalCoins) {
    state.biggestSupport = support;
    saveState();
    render(state);
  }
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
    likeCount.textContent = formatNumber(likes);
    likeGoal.textContent = formatNumber(goal);
    likePercent.textContent = `(${percent}%)`;
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
  return Math.max(likeGoalStep, Math.ceil((Number(likes || 0) + 1) / likeGoalStep) * likeGoalStep);
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
