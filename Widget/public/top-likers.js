const topLikersList = document.querySelector('#top-likers-list');
const topLikersWidget = document.querySelector('.top-likers-widget');
const topLikersStatus = document.querySelector('#status');
const topLikersParams = readTopLikersParams();
const savedTopLikersConfig = loadTopLikersConfig();
const topLikersMilestoneSetting = topLikersParams.get('likeMilestone') ?? topLikersParams.get('milestone') ?? topLikersParams.get('milestoneLikes') ?? savedTopLikersConfig.likeMilestone ?? 500;

const topLikersConfig = {
  endpoint: topLikersParams.get('endpoint') || 'ws://localhost:21213/',
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
  opacity: clampDecimal(Number(topLikersParams.get('opacity') || savedTopLikersConfig.opacity), 0, 1),
  tileOpacity: clampDecimal(Number(topLikersParams.get('tileOpacity') || savedTopLikersConfig.tileOpacity), 0, 1),
  test: topLikersParams.get('test') === '1'
};

const topLikersStorageKey = `tiktok-top-likers:${topLikersConfig.limit}`;
const topLikers = new Map();
const previousRanks = new Map();
let topLikersReconnectTimer;
let topLikersMilestoneRenderTimer;
let currentLeaderId = '';

applyTopLikersConfig();
loadTopLikersState();
renderTopLikers();

if (topLikersConfig.test) {
  startTopLikersTestMode();
} else {
  connectTopLikers();
}

function connectTopLikers() {
  const ws = new WebSocket(topLikersConfig.endpoint);

  ws.addEventListener('open', () => {
    if (topLikersConfig.resetOnConnect) {
      topLikers.clear();
      saveTopLikersState();
      renderTopLikers();
    }

    updateTopLikersStatus('Connected to TikFinity', true);
  });

  ws.addEventListener('message', event => {
    const message = parseMessage(event.data);

    if (!message) {
      return;
    }

    handleTopLikersEvent(message.event, message.data || {});
  });

  ws.addEventListener('close', () => {
    updateTopLikersStatus('Waiting for TikFinity', false);
    clearTimeout(topLikersReconnectTimer);
    topLikersReconnectTimer = setTimeout(connectTopLikers, 1500);
  });
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

function recordTopLiker(liker) {
  const existing = topLikers.get(liker.id) || {
    id: liker.id,
    name: liker.name,
    username: liker.username,
    avatarUrl: '',
    likes: 0,
    milestonePulseUntil: 0,
    updatedAt: 0
  };
  const previousLikes = existing.likes;
  const addedLikes = Math.max(1, Math.floor(Number(liker.likeCount || 1)));

  existing.name = liker.name || existing.name;
  existing.username = liker.username || existing.username;
  existing.avatarUrl = liker.avatarUrl || existing.avatarUrl;
  existing.likes += addedLikes;
  if (didCrossTopLikerMilestone(previousLikes, existing.likes)) {
    existing.milestonePulseUntil = Date.now() + 2800;
    scheduleTopLikerMilestoneRender();
  }
  existing.updatedAt = Date.now();
  topLikers.set(existing.id, existing);

  saveTopLikersState();
  renderTopLikers();
}

function didCrossTopLikerMilestone(previousLikes, nextLikes) {
  const milestone = topLikersConfig.likeMilestone;

  if (!milestone) {
    return false;
  }

  return Math.floor(previousLikes / milestone) < Math.floor(nextLikes / milestone);
}

function scheduleTopLikerMilestoneRender() {
  clearTimeout(topLikersMilestoneRenderTimer);
  topLikersMilestoneRenderTimer = setTimeout(renderTopLikers, 2900);
}

function renderTopLikers() {
  const beforeRects = readTopLikerRects();
  const leaders = getSortedTopLikers();
  const nextRanks = new Map();
  let improvedId = '';
  let leadChangeId = '';

  leaders.forEach((liker, index) => {
    const rank = index + 1;
    const oldRank = previousRanks.get(liker.id);
    nextRanks.set(liker.id, rank);

    if (oldRank && rank < oldRank && !improvedId) {
      improvedId = liker.id;
    }
  });

  if (leaders[0]?.id && leaders[0].id !== currentLeaderId) {
    if (currentLeaderId) {
      leadChangeId = leaders[0].id;
    }
    improvedId = leaders[0].id;
    currentLeaderId = leaders[0].id;
  }

  previousRanks.clear();
  nextRanks.forEach((rank, id) => previousRanks.set(id, rank));
  document.body.classList.toggle('top-likers-empty', leaders.length === 0);

  topLikersList.innerHTML = leaders.length
    ? leaders.map((liker, index) => renderTopLikerRow(liker, index, liker.id === improvedId, liker.id === leadChangeId)).join('')
    : '';

  requestAnimationFrame(() => {
    syncTopLikerBorderPulses();
    animateTopLikerRows(beforeRects);
  });
  fitTopLikerNames();
}

function renderTopLikerRow(liker, index, isOvertaking, isLeadChange) {
  const rank = index + 1;
  const medalClass = rank <= 3 ? ['is-gold', 'is-silver', 'is-bronze'][rank - 1] : '';
  const heartClass = topLikersConfig.medalHearts ? medalClass : '';
  const isLikeMilestone = Number(liker.milestonePulseUntil || 0) > Date.now();

  return `
    <li class="top-liker-row ${medalClass} ${isOvertaking ? 'is-overtaking' : ''} ${isLeadChange ? 'is-lead-change' : ''} ${isLikeMilestone ? 'is-like-milestone' : ''}" data-key="${escapeAttribute(liker.id)}">
      ${isLikeMilestone ? renderTopLikerBorderPulse() : ''}
      <span class="top-liker-rank">${rank}</span>
      <span class="top-liker-avatar" aria-hidden="true">${renderTopLikerAvatar(liker)}</span>
      <span class="top-liker-copy">
        <strong class="top-liker-name"><span>${escapeHtml(liker.name || 'Unknown')}</span></strong>
      </span>
      <span class="top-liker-like">
        <svg class="top-liker-heart ${heartClass}" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s-7-4.4-9.3-8.6C.8 8.9 2.7 5 6.5 5c2.1 0 3.7 1.2 4.5 2.8C11.8 6.2 13.4 5 15.5 5c3.8 0 5.7 3.9 3.8 7.4C17 16.6 12 21 12 21Z"/>
        </svg>
        <span>${formatNumber(liker.likes)}</span>
      </span>
    </li>
  `;
}

function renderTopLikerBorderPulse() {
  return `
    <svg class="top-liker-border-pulse" aria-hidden="true">
      <rect class="top-liker-border-pulse-beam" pathLength="100"></rect>
    </svg>
  `;
}

function syncTopLikerBorderPulses() {
  topLikersList.querySelectorAll('.top-liker-row .top-liker-border-pulse').forEach(svg => {
    const row = svg.closest('.top-liker-row');
    const beam = svg.querySelector('.top-liker-border-pulse-beam');

    if (!row || !beam) {
      return;
    }

    const width = row.clientWidth;
    const height = row.clientHeight;
    const styles = getComputedStyle(row);
    const borderWidth = Math.max(1, parseFloat(styles.borderTopWidth) || 1);
    const radius = Math.max(0, parseFloat(styles.borderTopLeftRadius) || 0);
    const center = borderWidth / 2;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    beam.setAttribute('x', String(center));
    beam.setAttribute('y', String(center));
    beam.setAttribute('width', String(Math.max(0, width - borderWidth)));
    beam.setAttribute('height', String(Math.max(0, height - borderWidth)));
    beam.setAttribute('rx', String(Math.max(0, radius - center)));
    beam.setAttribute('ry', String(Math.max(0, radius - center)));
  });
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

function startTopLikersTestMode() {
  updateTopLikersStatus('Test mode', true);

  const testUsers = [
    createTestLiker('nova', 'Nova Ray Hyperdrive Champion', '#03f5d8', '#c447ff'),
    createTestLiker('luna', 'Luna Byte With A Very Long Name', '#ffd83d', '#ef476f'),
    createTestLiker('kai', 'Kai Spark The Like Machine', '#55ffb1', '#2f7cff'),
    createTestLiker('mira', 'Mira Vale Extraordinarily Supportive', '#ff8b3d', '#7f5cff'),
    createTestLiker('zara', 'Zara Glow Queen Of The Tap Hearts', '#ffffff', '#03f5d8')
  ];
  let tick = 0;
  const milestoneSeed = topLikersConfig.likeMilestone > 0 ? Math.max(1, topLikersConfig.likeMilestone - 42) : 12;

  testUsers.slice(0, topLikersConfig.limit).forEach((user, index) => {
    recordTopLiker({ ...user, likeCount: Math.max(1, milestoneSeed - index * 18) });
  });

  window.simulateTopLiker = (index = null, likes = null) => {
    const user = testUsers[Number.isFinite(Number(index)) ? Number(index) % testUsers.length : Math.floor(Math.random() * testUsers.length)];
    recordTopLiker({
      ...user,
      likeCount: Math.max(1, Math.floor(Number(likes || 8 + Math.random() * 26)))
    });
  };

  setInterval(() => {
    tick += 1;
    const chaseIndex = tick % 5 === 0 ? 2 + (tick % 3) : Math.floor(Math.random() * testUsers.length);
    const user = testUsers[chaseIndex % testUsers.length];
    const boost = tick % 5 === 0 ? 34 : 4 + Math.random() * 18;

    recordTopLiker({
      ...user,
      likeCount: boost
    });
  }, 1500);
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
    avatarUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`
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

    saved.forEach(liker => {
      if (liker?.id) {
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
    tileOpacity: likers.x
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
