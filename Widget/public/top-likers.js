const topLikersList = document.querySelector('#top-likers-list');
const topLikersWidget = document.querySelector('.top-likers-widget');
const topLikersStatus = document.querySelector('#status');
const topLikersParams = readTopLikersParams();
const savedTopLikersConfig = loadTopLikersConfig();
const topLikersMilestoneSetting = topLikersParams.get('likeMilestone') ?? topLikersParams.get('milestone') ?? topLikersParams.get('milestoneLikes') ?? savedTopLikersConfig.likeMilestone ?? 500;
const topLikersMilestoneAnnouncementMs = 4600;
const topLikersMilestoneLeadInMs = 760;
const topLikersMilestoneReturnMs = 480;
const topLikersMilestoneTotalMs = topLikersMilestoneLeadInMs
  + topLikersMilestoneAnnouncementMs
  + topLikersMilestoneReturnMs;
const topLikersOvertakeAnimationMs = 1100;
const topLikersLeadAnimationMs = 3200;
const topLikersRelayMode = topLikersParams.get('relay') === '1';
const topLikersPreviewMode = topLikersParams.get('preview') === '1';

const topLikersConfig = {
  endpoint: topLikersParams.get('endpoint') || window.creatorLiveEndpoint || 'ws://localhost:21213/',
  limit: clampNumber(Number(topLikersParams.get('limit') || savedTopLikersConfig.limit || 3), 1, 10),
  showAvatar: readToggle(topLikersParams, ['avatar', 'avatars', 'profile', 'profiles'], savedTopLikersConfig.showAvatar !== false),
  showNames: readToggle(topLikersParams, ['names', 'name', 'handles'], savedTopLikersConfig.showNames !== false),
  showHeart: readToggle(topLikersParams, ['heart', 'hearts', 'icon'], savedTopLikersConfig.showHeart !== false),
  layout: normalizeTopLikersLayout(topLikersParams.get('layout') || savedTopLikersConfig.layout || 'stacked'),
  likeMilestone: clampNumber(Number(topLikersMilestoneSetting), 0, 1000000000),
  medalHearts: readToggle(topLikersParams, ['medalHearts', 'placeHearts', 'rankHearts'], savedTopLikersConfig.medalHearts !== false),
  resetOnConnect: readToggle(topLikersParams, ['resetOnConnect'], savedTopLikersConfig.resetOnConnect !== false),
  width: clampNumber(Number(topLikersParams.get('width') || savedTopLikersConfig.width || 390), 260, 1000),
  height: clampNumber(Number(topLikersParams.get('height') || savedTopLikersConfig.height || 260), 120, 900),
  showShell: readToggle(topLikersParams, ['shell', 'outerBox', 'box'], savedTopLikersConfig.showShell !== false),
  showTitle: readToggle(topLikersParams, ['title', 'heading'], savedTopLikersConfig.showTitle !== false),
  showTiles: readToggle(topLikersParams, ['tiles', 'tileBackgrounds', 'columns'], savedTopLikersConfig.showTiles !== false),
  backgroundStart: readColor(topLikersParams, ['backgroundStart', 'bgStart'], savedTopLikersConfig.backgroundStart),
  backgroundEnd: readColor(topLikersParams, ['backgroundEnd', 'bgEnd'], savedTopLikersConfig.backgroundEnd),
  backgroundBase: readColor(topLikersParams, ['backgroundBase', 'bgBase'], savedTopLikersConfig.backgroundBase),
  border: readColor(topLikersParams, ['border', 'borderColor'], savedTopLikersConfig.border),
  tile: readColor(topLikersParams, ['tile', 'tileColor'], savedTopLikersConfig.tile),
  tileBorder: readColor(topLikersParams, ['tileBorder'], savedTopLikersConfig.tileBorder),
  title: readColor(topLikersParams, ['titleColor'], savedTopLikersConfig.title),
  text: readColor(topLikersParams, ['text', 'textColor'], savedTopLikersConfig.text),
  muted: readColor(topLikersParams, ['muted', 'mutedColor'], savedTopLikersConfig.muted),
  glow: readColor(topLikersParams, ['glow', 'glowColor'], savedTopLikersConfig.glow),
  firstPlaceAccent:savedTopLikersConfig.firstPlaceAccent,firstPlaceText:savedTopLikersConfig.firstPlaceText,
  milestoneCard: readColor(topLikersParams, ['milestoneCard', 'milestoneCardColor'], savedTopLikersConfig.milestoneCard),
  milestoneText: readColor(topLikersParams, ['milestoneText', 'milestoneTextColor'], savedTopLikersConfig.milestoneText),
  opacity: clampDecimal(Number(topLikersParams.get('opacity') || savedTopLikersConfig.opacity), 0, 1),
  tileOpacity: clampDecimal(Number(topLikersParams.get('tileOpacity') || savedTopLikersConfig.tileOpacity), 0, 1),
  test: topLikersParams.get('test') === '1'
};

const topLikersDockStateKey = topLikersParams.get('stateKey') || '';
const topLikersStorageKey = topLikersDockStateKey
  ? `tiktok-top-likers:dock:${topLikersDockStateKey}`
  : `tiktok-top-likers:${topLikersConfig.limit}`;
const topLikersRetentionMs = 7 * 24 * 60 * 60 * 1000;
const topLikers = new Map();
const previousRanks = new Map();
let topLikersReconnectTimer;
let topLikersAnimationTimer;
let topLikersAnimationBusyUntil = 0;
let topLikersGoldMilestoneTimer;
let topLikersGoldLeaderId = '';
let topLikersGoldUntil = 0;
let currentLeaderId = '';

applyTopLikersConfig();
loadTopLikersState();
renderTopLikers();
document.body.classList.add('top-likers-ready');

if (topLikersPreviewMode) {
  startTopLikersTestMode({ statusText: 'Preview', animate: topLikersParams.get('editor') !== '1' });
} else if (topLikersConfig.test) {
  startTopLikersTestMode();
} else if (topLikersRelayMode) {
  setupTopLikersDockRelay();
} else {
  connectTopLikers();
}

function connectTopLikers() {
  const ws = (window.KGCreatorLive?.socket(topLikersConfig.endpoint) || new WebSocket(topLikersConfig.endpoint));

  ws.addEventListener('open', () => {
    if (topLikersConfig.resetOnConnect) {
      topLikers.clear();
      saveTopLikersState();
      renderTopLikers();
    }

    updateTopLikersStatus('Connected to live activity', true);
  });

  ws.addEventListener('message', event => {
    window.creatorGiftDiscovery?.observe(event.data);
    const message = parseMessage(event.data);

    if (!message) {
      return;
    }

    handleTopLikersEvent(message.event, message.data || {});
  });

  ws.addEventListener('close', () => {
    updateTopLikersStatus('', true);
    clearTimeout(topLikersReconnectTimer);
    topLikersReconnectTimer = setTimeout(connectTopLikers, 1500);
  });
}

function setupTopLikersDockRelay() {
  updateTopLikersStatus('Connected through Stream Output', true);
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.type !== 'dock:tiktok-raw') return;
    const message = parseMessage(event.data.data);
    if (message) handleTopLikersEvent(message.event, message.data || {});
  });
  window.parent.postMessage({ type: 'dock:renderer-ready' }, '*');
}

function handleTopLikersEvent(eventName, data) {
  if (String(eventName || '').toLowerCase() !== 'like') {
    return;
  }

  const liker = normalizeLiker(data);

  if (!liker) {
    return;
  }

  recordTopLiker(liker);
}

function recordTopLiker(liker, { deferRender = false } = {}) {
  const existing = topLikers.get(liker.id) || {
    id: liker.id,
    name: liker.name,
    username: liker.username,
    avatarUrl: '',
    likes: 0,
    milestonePulseUntil: 0,
    milestoneStartedAt: 0,
    milestoneValue: 0,
    pendingMilestoneValue: 0,
    updatedAt: 0
  };
  const previousLikes = existing.likes;
  const addedLikes = Math.max(1, Math.floor(Number(liker.likeCount || 1)));

  existing.name = liker.name || existing.name;
  existing.username = liker.username || existing.username;
  existing.avatarUrl = liker.avatarUrl || existing.avatarUrl;
  existing.likes += addedLikes;
  const reachedMilestone = getReachedTopLikerMilestone(previousLikes, existing.likes);
  if (reachedMilestone) {
    existing.pendingMilestoneValue = Math.max(
      Number(existing.pendingMilestoneValue || 0),
      reachedMilestone
    );
  }
  existing.updatedAt = Date.now();
  topLikers.set(existing.id, existing);

  if (!deferRender) {
    saveTopLikersState();
    renderTopLikers();
  }
}

function getReachedTopLikerMilestone(previousLikes, nextLikes) {
  const milestone = topLikersConfig.likeMilestone;

  if (!milestone) {
    return 0;
  }

  const previousMilestone = Math.floor(previousLikes / milestone);
  const nextMilestone = Math.floor(nextLikes / milestone);
  return nextMilestone > previousMilestone ? nextMilestone * milestone : 0;
}

function isTopLikersAnimationBusy() {
  return topLikersAnimationBusyUntil > Date.now();
}

function holdTopLikersOrderFor(duration) {
  clearTimeout(topLikersAnimationTimer);
  topLikersAnimationBusyUntil = Date.now() + duration;
  topLikersAnimationTimer = setTimeout(() => {
    topLikersAnimationBusyUntil = 0;
    renderTopLikers();
  }, duration + 40);
}

function renderTopLikers() {
  if (isTopLikersAnimationBusy()) {
    startPendingVisibleMilestones();
    updateVisibleTopLikerCounts();
    return;
  }

  const beforeRects = readTopLikerRects();
  const leaders = getSortedTopLikers();
  const nextRanks = new Map();
  let improvedId = '';
  let leadChangeId = '';
  let hasOrderMovement = false;

  leaders.forEach((liker, index) => {
    const rank = index + 1;
    const oldRank = previousRanks.get(liker.id);
    nextRanks.set(liker.id, rank);

    if (oldRank && rank !== oldRank) {
      hasOrderMovement = true;
      if (rank < oldRank && !improvedId) {
        improvedId = liker.id;
      }
    }
  });

  if (leaders[0]?.id && leaders[0].id !== currentLeaderId) {
    if (currentLeaderId) {
      leadChangeId = leaders[0].id;
    }
    improvedId = leaders[0].id;
    currentLeaderId = leaders[0].id;
  }

  const orderAnimationDuration = leadChangeId
    ? topLikersLeadAnimationMs
    : (hasOrderMovement ? topLikersOvertakeAnimationMs : 0);
  const milestoneLikers = leaders.filter(liker => (
    Number(liker.pendingMilestoneValue || 0) > 0
    && liker.id !== leadChangeId
  ));
  let milestoneAnimationDuration = 0;

  if (milestoneLikers.length) {
    const milestoneStartedAt = Date.now();
    milestoneLikers.forEach(liker => {
      liker.milestoneValue = Number(liker.pendingMilestoneValue);
      liker.pendingMilestoneValue = 0;
      liker.milestoneStartedAt = milestoneStartedAt;
      liker.milestonePulseUntil = milestoneStartedAt + topLikersMilestoneTotalMs;
    });
    milestoneAnimationDuration = topLikersMilestoneTotalMs;
  }

  const animationDuration = Math.max(orderAnimationDuration, milestoneAnimationDuration);

  previousRanks.clear();
  nextRanks.forEach((rank, id) => previousRanks.set(id, rank));
  document.body.classList.toggle('top-likers-empty', leaders.length === 0);

  topLikersList.innerHTML = leaders.length
    ? leaders.map((liker, index) => renderTopLikerRow(liker, index, liker.id === improvedId, liker.id === leadChangeId)).join('')
    : '';

  requestAnimationFrame(() => {
    animateTopLikerRows(beforeRects);
  });
  fitTopLikerNames();

  if (leadChangeId) {
    scheduleTopLikerGoldMilestone(leadChangeId);
  }

  if (animationDuration) {
    holdTopLikersOrderFor(animationDuration);
  }
}

function scheduleTopLikerGoldMilestone(likerId) {
  clearTimeout(topLikersGoldMilestoneTimer);
  topLikersGoldLeaderId = likerId;
  topLikersGoldUntil = Date.now() + topLikersLeadAnimationMs;
  topLikersGoldMilestoneTimer = setTimeout(() => {
    topLikersGoldUntil = 0;
    startPendingVisibleMilestones();
    topLikersGoldLeaderId = '';
  }, topLikersLeadAnimationMs + 40);
}

function startPendingVisibleMilestones() {
  const now = Date.now();
  const rows = [...topLikersList.querySelectorAll('.top-liker-row[data-key]')];
  let started = false;

  rows.forEach((row, index) => {
    const liker = topLikers.get(row.dataset.key);

    if (
      !liker
      || Number(liker.pendingMilestoneValue || 0) <= 0
      || (liker.id === topLikersGoldLeaderId && topLikersGoldUntil > now)
    ) {
      return;
    }

    liker.milestoneValue = Number(liker.pendingMilestoneValue);
    liker.pendingMilestoneValue = 0;
    liker.milestoneStartedAt = now;
    liker.milestonePulseUntil = now + topLikersMilestoneTotalMs;
    row.outerHTML = renderTopLikerRow(liker, index, false, false);
    started = true;
  });

  if (started) {
    fitTopLikerNames();
    holdTopLikersOrderFor(topLikersMilestoneTotalMs);
  }

  return started;
}

function updateVisibleTopLikerCounts() {
  topLikersList.querySelectorAll('.top-liker-row[data-key]').forEach(row => {
    const liker = topLikers.get(row.dataset.key);
    const count = row.querySelector('.top-liker-like > span');

    if (liker && count) {
      count.textContent = formatNumber(liker.likes);
    }
  });
}

function renderTopLikerRow(liker, index, isOvertaking, isLeadChange) {
  const rank = index + 1;
  const medalClass = rank <= 3 ? ['is-gold', 'is-silver', 'is-bronze'][rank - 1] : '';
  const heartClass = topLikersConfig.medalHearts ? medalClass : '';
  const isLikeMilestone = Number(liker.milestonePulseUntil || 0) > Date.now();
  const milestoneStartedAt = Number(liker.milestoneStartedAt || 0)
    || (Number(liker.milestonePulseUntil || 0) - topLikersMilestoneTotalMs);
  const milestoneElapsed = isLikeMilestone
    ? Math.max(0, Date.now() - milestoneStartedAt)
    : 0;
  const announcementElapsed = milestoneElapsed - topLikersMilestoneLeadInMs;
  const announcementDelay = announcementElapsed < 0
    ? `${Math.abs(announcementElapsed)}ms`
    : `-${Math.min(topLikersMilestoneAnnouncementMs, announcementElapsed)}ms`;
  const milestoneStyle = isLikeMilestone
    ? ` style="--top-liker-milestone-delay: ${announcementDelay}; --top-liker-milestone-state-delay: -${Math.min(topLikersMilestoneTotalMs, milestoneElapsed)}ms"`
    : '';

  return `
    <li class="top-liker-row ${medalClass} ${isOvertaking && !isLikeMilestone ? 'is-overtaking' : ''} ${isLeadChange && !isLikeMilestone ? 'is-lead-change' : ''} ${isLikeMilestone ? 'is-like-milestone' : ''}" data-key="${escapeAttribute(liker.id)}"${milestoneStyle}>
      <span class="top-liker-rank top-liker-standard-content">${rank}</span>
      <span class="top-liker-avatar top-liker-standard-content" aria-hidden="true">${renderTopLikerAvatar(liker)}</span>
      <span class="top-liker-copy top-liker-standard-content">
        <strong class="top-liker-name"><span>${escapeHtml(liker.name || 'Unknown')}</span></strong>
      </span>
      <span class="top-liker-like top-liker-standard-content">
        <svg class="top-liker-heart ${heartClass}" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s-7-4.4-9.3-8.6C.8 8.9 2.7 5 6.5 5c2.1 0 3.7 1.2 4.5 2.8C11.8 6.2 13.4 5 15.5 5c3.8 0 5.7 3.9 3.8 7.4C17 16.6 12 21 12 21Z"/>
        </svg>
        <span>${formatNumber(liker.likes)}</span>
      </span>
      ${isLikeMilestone ? renderTopLikerMilestoneAnnouncement(liker) : ''}
    </li>
  `;
}

function renderTopLikerMilestoneAnnouncement(liker) {
  const milestone = Math.max(
    topLikersConfig.likeMilestone,
    Number(liker.milestoneValue || 0)
  );

  return `
    <span class="top-liker-milestone-announcement">
      <svg class="top-liker-milestone-heart" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-7-4.4-9.3-8.6C.8 8.9 2.7 5 6.5 5c2.1 0 3.7 1.2 4.5 2.8C11.8 6.2 13.4 5 15.5 5c3.8 0 5.7 3.9 3.8 7.4C17 16.6 12 21 12 21Z"/>
      </svg>
      <span class="top-liker-milestone-copy">
        <strong class="top-liker-milestone-result">${formatCompactNumber(milestone)} LIKES!</strong>
        <span class="top-liker-milestone-name" title="${escapeAttribute(liker.name || 'Top liker')}">&nbsp;—&nbsp;${escapeHtml(liker.name || 'Top liker')}</span>
      </span>
    </span>
  `;
}

function renderTopLikerAvatar(liker) {
  if (liker.avatarUrl) {
    return `<img alt="" src="${escapeAttribute(liker.avatarUrl)}">`;
  }

  const initials = String(liker.name || liker.username || '?').trim().slice(0, 2).toUpperCase();

  return `<span>${escapeHtml(initials || '?')}</span>`;
}

function animateTopLikerRows(beforeRects) {
  topLikersList.querySelectorAll('.top-liker-row[data-key]').forEach(row => {
    const before = beforeRects.get(row.dataset.key);

    if (!before) {
      row.animate([
        { opacity: 0, transform: 'translateX(28px) scale(0.96)' },
        { opacity: 1, transform: 'translateX(0) scale(1)' }
      ], {
        duration: 520,
        easing: 'cubic-bezier(0.18, 0.9, 0.24, 1.12)'
      });
      return;
    }

    const after = row.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      return;
    }

    row.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(1.02)` },
      { transform: 'translate(0, 0) scale(1)' }
    ], {
      duration: 720,
      easing: 'cubic-bezier(0.18, 0.9, 0.24, 1.12)'
    });
  });
}

function readTopLikerRects() {
  const rects = new Map();

  topLikersList.querySelectorAll('.top-liker-row[data-key]').forEach(row => {
    rects.set(row.dataset.key, row.getBoundingClientRect());
  });

  return rects;
}

function getSortedTopLikers() {
  return [...topLikers.values()]
    .sort((a, b) => b.likes - a.likes || b.updatedAt - a.updatedAt || a.name.localeCompare(b.name))
    .slice(0, topLikersConfig.limit);
}

function normalizeLiker(data) {
  const user = data.user || {};
  const id = String(
    user.userId ||
    user.uniqueId ||
    data.userId ||
    data.uniqueId ||
    data.username ||
    data.nickname ||
    ''
  ).trim();

  if (!id) {
    return null;
  }

  const uniqueId = String(user.uniqueId || data.uniqueId || data.username || '').trim();
  const nickname = String(user.nickname || data.nickname || uniqueId || 'Unknown').trim();
  const likeCount = Number(data.likeCount || data.likes || data.like_count || 1);

  return {
    id,
    name: nickname,
    username: '',
    avatarUrl: findTopLikerAvatar(data),
    likeCount: Number.isFinite(likeCount) && likeCount > 0 ? likeCount : 1
  };
}

function findTopLikerAvatar(data) {
  const user = data.user || {};
  const image =
    data.profilePictureUrl ||
    data.avatarUrl ||
    data.profilePicture?.url ||
    firstUrl(data.profilePicture?.urlList) ||
    user.profilePictureUrl ||
    user.avatarUrl ||
    user.profilePicture?.url ||
    firstUrl(user.profilePicture?.urlList) ||
    firstUrl(user.avatarThumb?.urlList) ||
    firstUrl(user.avatarMedium?.urlList) ||
    firstUrl(user.avatarLarger?.urlList);

  return image || '';
}

function startTopLikersTestMode({ animate = true, statusText = 'Test mode' } = {}) {
  updateTopLikersStatus(statusText, true);
  topLikers.clear();
  previousRanks.clear();
  currentLeaderId = '';

  const testUsers = [
    createTestLiker('nova', 'Nova Ray Hyperdrive Champion', '#03f5d8', '#c447ff'),
    createTestLiker('luna', 'Luna Byte With A Very Long Name', '#ffd83d', '#ef476f'),
    createTestLiker('kai', 'Kai Spark The Like Machine', '#55ffb1', '#2f7cff'),
    createTestLiker('mira', 'Mira Vale Extraordinarily Supportive', '#ff8b3d', '#7f5cff'),
    createTestLiker('zara', 'Zara Glow Queen Of The Tap Hearts', '#ffffff', '#03f5d8')
  ];
  let tick = 0;
  const milestoneSeed = topLikersConfig.likeMilestone > 0 ? Math.max(1, topLikersConfig.likeMilestone - 42) : 12;
  const milestoneGap = topLikersConfig.likeMilestone > 0
    ? Math.max(12, Math.floor(topLikersConfig.likeMilestone * 0.18))
    : 6;

  testUsers.slice(0, topLikersConfig.limit).forEach((user, index) => {
    recordTopLiker({ ...user, likeCount: Math.max(1, milestoneSeed - index * milestoneGap) });
  });

  window.simulateTopLiker = (index = null, likes = null) => {
    const user = testUsers[Number.isFinite(Number(index)) ? Number(index) % testUsers.length : Math.floor(Math.random() * testUsers.length)];
    recordTopLiker({
      ...user,
      likeCount: Math.max(1, Math.floor(Number(likes || 8 + Math.random() * 26)))
    });
  };

  if (!animate) return;

  setInterval(() => {
    if(window.editorPreviewActive===false)return;
    tick += 1;
    const podium = getSortedTopLikers().slice(0, Math.min(3, topLikersConfig.limit));
    const animationBusy = isTopLikersAnimationBusy();
    const shouldSwitchLeader = podium.length > 1 && tick % 3 === 0;
    const boosts = new Map(podium.map((liker, index) => {
      const normalLikes = 7 + Math.floor(Math.random() * 30);
      const burstLikes = (tick + index * 3) % 9 === 0
        ? 40 + Math.floor(Math.random() * 61)
        : 0;
      return [liker.id, normalLikes + burstLikes];
    }));

    if (!animationBusy && shouldSwitchLeader) {
      const switchNumber = Math.floor(tick / 3) - 1;
      const challengerRank = 1 + (switchNumber % (podium.length - 1));
      const leader = podium[0];
      const challenger = podium[challengerRank];
      const leaderAfterBatch = leader.likes + Number(boosts.get(leader.id) || 0);
      boosts.set(
        challenger.id,
        Math.max(
          Number(boosts.get(challenger.id) || 0),
          leaderAfterBatch - challenger.likes + 30 + Math.floor(Math.random() * 51)
        )
      );
    }

    podium.forEach(liker => {
      const user = testUsers.find(candidate => candidate.id === liker.id) || liker;
      recordTopLiker({
        ...user,
        likeCount: boosts.get(liker.id) || 1
      }, { deferRender: true });
    });

    saveTopLikersState();
    renderTopLikers();
  }, 650);
}

function createTestLiker(id, name, accent, glow) {
  const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${accent}"/>
          <stop offset="1" stop-color="${glow}"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="48" fill="url(#g)"/>
      <circle cx="30" cy="28" r="20" fill="rgba(255,255,255,0.22)"/>
      <text x="48" y="58" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="900" fill="#fff">${initials}</text>
    </svg>
  `;

  return {
    id,
    name,
    username: '',
    avatarUrl: window.studioDemoViewers?.byName(id).avatarUrl || `data:image/svg+xml,${encodeURIComponent(svg)}`
  };
}

function fitTopLikerNames() {
  topLikersList.querySelectorAll('.top-liker-name').forEach(name => {
    const inner = name.querySelector('span');

    if (!inner) {
      return;
    }

    name.classList.remove('is-marquee');
    name.style.removeProperty('--marquee-distance');
    name.style.removeProperty('--top-liker-name-pan-duration');
    name.style.removeProperty('--top-liker-name-pan-delay');

    requestAnimationFrame(() => {
      const overflow = inner.scrollWidth - name.clientWidth;

      if (overflow > 2) {
        const duration = Math.max(5.5, Math.min(12, 4.8 + overflow / 18));
        const delay = -((Date.now() % Math.round(duration * 1000)) / 1000);

        name.style.setProperty('--marquee-distance', `${overflow}px`);
        name.style.setProperty('--top-liker-name-pan-duration', `${duration.toFixed(1)}s`);
        name.style.setProperty('--top-liker-name-pan-delay', `${delay.toFixed(2)}s`);
        name.classList.add('is-marquee');
      }
    });
  });
}

function applyTopLikersConfig() {
  document.body.classList.toggle('hide-top-liker-avatars', !topLikersConfig.showAvatar);
  document.body.classList.toggle('hide-top-liker-names', !topLikersConfig.showNames);
  document.body.classList.toggle('hide-top-liker-hearts', !topLikersConfig.showHeart);
  document.body.classList.toggle('top-likers-layout-stacked', topLikersConfig.layout === 'stacked');
  document.body.classList.toggle('top-likers-layout-inline', topLikersConfig.layout !== 'stacked');
  document.body.classList.toggle('plain-top-liker-hearts', !topLikersConfig.medalHearts);
  document.body.classList.toggle('hide-top-liker-shell', !topLikersConfig.showShell);
  document.body.classList.toggle('hide-top-liker-title', !topLikersConfig.showTitle);
  document.body.classList.toggle('hide-top-liker-tiles', !topLikersConfig.showTiles);
  document.documentElement.style.setProperty('--top-likers-count', String(topLikersConfig.limit));
  document.documentElement.style.setProperty('--top-likers-width', `${topLikersConfig.width}px`);
  document.documentElement.style.setProperty('--top-likers-height', `${getEffectiveTopLikersHeight()}px`);
  document.documentElement.style.setProperty('--top-likers-bg-start', hexToRgb(topLikersConfig.backgroundStart));
  document.documentElement.style.setProperty('--top-likers-bg-end', hexToRgb(topLikersConfig.backgroundEnd));
  document.documentElement.style.setProperty('--top-likers-bg-base', hexToRgb(topLikersConfig.backgroundBase));
  document.documentElement.style.setProperty('--top-likers-border-rgb', hexToRgb(topLikersConfig.border));
  document.documentElement.style.setProperty('--top-likers-tile-rgb', hexToRgb(topLikersConfig.tile));
  document.documentElement.style.setProperty('--top-likers-tile-border-rgb', hexToRgb(topLikersConfig.tileBorder));
  document.documentElement.style.setProperty('--top-likers-title-color', topLikersConfig.title);
  document.documentElement.style.setProperty('--top-likers-text-color', topLikersConfig.text);
  document.documentElement.style.setProperty('--top-likers-muted-color', topLikersConfig.muted);
  document.documentElement.style.setProperty('--top-likers-glow-rgb', hexToRgb(topLikersConfig.glow));
  const first=topLikersConfig.firstPlaceAccent;
  document.body.classList.toggle('top-likers-custom-first',Boolean(first));
  if(first){document.documentElement.style.setProperty('--top-likers-first-rgb',hexToRgb(first));document.documentElement.style.setProperty('--top-likers-first',first);const star='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="'+first+'" d="M12 0c1 8 3 11 12 12-9 1-11 4-12 12-1-8-3-11-12-12 9-1 11-4 12-12Z"/></svg>';document.documentElement.style.setProperty('--top-likers-first-star','url("data:image/svg+xml,'+encodeURIComponent(star)+'")');}
  document.documentElement.style.setProperty('--top-likers-first-text',topLikersConfig.firstPlaceText||topLikersConfig.text);
  document.documentElement.style.setProperty('--top-likers-milestone-card-rgb', hexToRgb(topLikersConfig.milestoneCard));
  document.documentElement.style.setProperty('--top-likers-milestone-text', topLikersConfig.milestoneText);
  document.documentElement.style.setProperty('--top-likers-opacity', String(topLikersConfig.opacity));
  document.documentElement.style.setProperty('--top-likers-tile-opacity', String(topLikersConfig.tileOpacity));
}

function loadTopLikersState() {
  if (topLikersConfig.test) {
    return;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(topLikersStorageKey) || '[]');

    if (!Array.isArray(saved)) {
      return;
    }

    const cutoff = Date.now() - topLikersRetentionMs;
    saved.forEach(liker => {
      if (liker?.id && Number(liker.updatedAt || 0) >= cutoff) {
        topLikers.set(liker.id, {
          id: String(liker.id),
          name: String(liker.name || 'Unknown'),
          username: String(liker.username || ''),
          avatarUrl: String(liker.avatarUrl || ''),
          likes: Math.max(0, Math.floor(Number(liker.likes || 0))),
          updatedAt: Number(liker.updatedAt || 0)
        });
      }
    });
    if (topLikers.size !== saved.length) saveTopLikersState();
  } catch {
    topLikers.clear();
  }
}

function saveTopLikersState() {
  if (topLikersConfig.test) {
    return;
  }

  localStorage.setItem(topLikersStorageKey, JSON.stringify(getSortedTopLikers()));
}

function updateTopLikersStatus(text, connected = false) {
  topLikersStatus.textContent = text;
  document.body.classList.toggle('show-status', !connected);
}

function parseMessage(message) {
  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
}

function readToggle(params, keys, fallback) {
  for (const key of keys) {
    if (params.has(key)) {
      const value = String(params.get(key)).toLowerCase();
      return value !== '0' && value !== 'false' && value !== 'off';
    }
  }

  return fallback;
}

function readTopLikersParams() {
  const params = new URLSearchParams(window.location.search);
  const scriptUrl = document.currentScript?.src || '';
  const scriptQuery = scriptUrl.includes('?') ? scriptUrl.slice(scriptUrl.indexOf('?') + 1) : '';
  const scriptParams = new URLSearchParams(scriptQuery);

  scriptParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });

  return params;
}

function loadTopLikersConfig() {
  return normalizeTopLikersConfig(readOverlayConfigFromHash()?.topLikers ||
    readSavedOverlayConfig()?.topLikers ||
    window.rewardOverlayConfig?.topLikers ||
    {});
}

function readOverlayConfigFromHash() {
  if (window.directWidgetConfig) return window.directWidgetConfig;
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get('config');

  if (!encoded) {
    return null;
  }

  try {
    const config = JSON.parse(decodeURIComponent(escape(atob(toBase64(encoded)))));

    if (config?._ === 'r2') {
      return {
        topLikers: expandCompactTopLikers(config.w)
      };
    }

    return config;
  } catch {
    return null;
  }
}

function readSavedOverlayConfig() {
  if (topLikersParams.get('savedConfig') === '0') {
    return null;
  }

  try {
    return JSON.parse(localStorage.getItem('reward-overlay-config:v1') || 'null');
  } catch {
    return null;
  }
}

function expandCompactTopLikers(likers) {
  if (!likers) {
    return undefined;
  }

  return {
    limit: likers.a,
    showAvatar: likers.b === 0 ? false : undefined,
    showNames: likers.z === 0 ? false : undefined,
    showHeart: likers.c === 0 ? false : undefined,
    layout: likers.r,
    likeMilestone: likers.q,
    medalHearts: likers.d === 0 ? false : undefined,
    resetOnConnect: likers.e === 0 ? false : undefined,
    width: likers.f,
    height: likers.g,
    showShell: typeof likers.h === 'number' ? likers.h !== 0 : undefined,
    showTitle: typeof likers.i === 'number' ? likers.i !== 0 : undefined,
    showTiles: typeof likers.y === 'number' ? likers.y !== 0 : undefined,
    backgroundStart: likers.j,
    backgroundEnd: likers.k,
    backgroundBase: likers.l,
    border: likers.m,
    tile: likers.n,
    tileBorder: likers.o,
    title: likers.p,
    text: likers.s,
    muted: likers.t,
    glow: likers.u,
    opacity: likers.v,
    tileOpacity: likers.x,
    firstPlaceAccent:likers.ac,firstPlaceText:likers.ad,
    milestoneCard: likers.aa,
    milestoneText: likers.ab
  };
}

function normalizeTopLikersConfig(config) {
  return {
    limit: clampNumber(Number(config.limit || 3), 1, 10),
    showAvatar: config.showAvatar !== false,
    showNames: config.showNames !== false,
    showHeart: config.showHeart !== false,
    layout: normalizeTopLikersLayout(config.layout),
    likeMilestone: clampNumber(Number(config.likeMilestone ?? 500), 0, 1000000000),
    medalHearts: config.medalHearts !== false,
    resetOnConnect: config.resetOnConnect !== false,
    width: clampNumber(Number(config.width || 390), 260, 1000),
    height: clampNumber(Number(config.height || 260), 120, 900),
    showShell: typeof config.showShell === 'boolean' ? config.showShell : false,
    showTitle: typeof config.showTitle === 'boolean' ? config.showTitle : false,
    showTiles: typeof config.showTiles === 'boolean' ? config.showTiles : false,
    backgroundStart: normalizeHex(config.backgroundStart, '#102c34'),
    backgroundEnd: normalizeHex(config.backgroundEnd, '#461f68'),
    backgroundBase: normalizeHex(config.backgroundBase, '#0c0a14'),
    border: normalizeHex(config.border, '#03f5d8'),
    tile: normalizeHex(config.tile, '#080b12'),
    tileBorder: normalizeHex(config.tileBorder, '#ffffff'),
    title: normalizeHex(config.title, '#03f5d8'),
    text: normalizeHex(config.text, '#ffffff'),
    muted: normalizeHex(config.muted, '#ffffff'),
    glow: normalizeHex(config.glow, '#c447ff'),
    ...(config.firstPlaceAccent?{firstPlaceAccent:normalizeHex(config.firstPlaceAccent,'#ffd83d')}:{}),
    ...(config.firstPlaceText?{firstPlaceText:normalizeHex(config.firstPlaceText,'#ffffff')}:{}),
    milestoneCard: normalizeHex(config.milestoneCard, '#7b2cff'),
    milestoneText: normalizeHex(config.milestoneText, '#ffffff'),
    opacity: clampDecimal(Number(config.opacity ?? 0.8), 0, 1),
    tileOpacity: clampDecimal(Number(config.tileOpacity ?? 0.6), 0, 1)
  };
}

function normalizeTopLikersLayout(value) {
  return String(value || 'stacked').toLowerCase() === 'inline' ? 'inline' : 'stacked';
}

function getEffectiveTopLikersHeight() {
  const rowHeight = 58;
  const rowGap = 8;
  const headerHeight = topLikersConfig.showTitle ? 52 : 0;
  const shellPadding = 56;
  const rowsHeight = (topLikersConfig.limit * rowHeight) + (Math.max(0, topLikersConfig.limit - 1) * rowGap);
  const naturalHeight = rowsHeight + headerHeight + shellPadding;
  const titleAdjustment = topLikersConfig.showTitle ? 0 : 52;
  const configuredHeight = Math.max(1, topLikersConfig.height - titleAdjustment);

  return Math.max(naturalHeight, configuredHeight);
}

function toBase64(value) {
  const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
}

function firstUrl(urls) {
  return Array.isArray(urls) ? urls[0] : '';
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.floor(Number(value || 0)));
}

function formatCompactNumber(value) {
  const number = Math.max(0, Math.floor(Number(value || 0)));
  const units = [
    { value: 1000000000, suffix: 'B' },
    { value: 1000000, suffix: 'M' },
    { value: 1000, suffix: 'K' }
  ];
  const unit = units.find(candidate => number >= candidate.value);

  if (!unit) return formatNumber(number);

  const scaled = number / unit.value;
  const decimals = scaled < 10 && !Number.isInteger(scaled) ? 1 : 0;
  return `${scaled.toFixed(decimals).replace(/\.0$/, '')}${unit.suffix}`;
}

function readColor(params, keys, fallback) {
  for (const key of keys) {
    if (params.has(key)) {
      return normalizeHex(params.get(key), fallback);
    }
  }

  return normalizeHex(fallback, '#ffffff');
}

function normalizeHex(value, fallback = '#ffffff') {
  const text = String(value || '').trim();
  const fallbackHex = /^#[0-9a-f]{6}$/i.test(String(fallback || '')) ? fallback.toLowerCase() : '#ffffff';

  if (/^#[0-9a-f]{6}$/i.test(text)) {
    return text.toLowerCase();
  }

  if (/^[0-9a-f]{6}$/i.test(text)) {
    return `#${text.toLowerCase()}`;
  }

  return fallbackHex;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  return `${parseInt(normalized.slice(1, 3), 16)}, ${parseInt(normalized.slice(3, 5), 16)}, ${parseInt(normalized.slice(5, 7), 16)}`;
}

function clampNumber(value, min, max) {
  const number = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function clampDecimal(value, min, max) {
  const number = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, number));
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

if(new URLSearchParams(window.location?.search||'').get('editorPreview')==='1'){window.studioSampleEvent=()=>window.simulateTopLiker?.(0,100);}
