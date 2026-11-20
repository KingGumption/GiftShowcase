(function initializeDockRuntime(global) {
  'use strict';

  const cloud = global.overlayCloud;
  const params = new URLSearchParams(global.location.search);
  const pathToken = String(global.location.pathname || '').match(/^\/output\/([^/]+)\/?$/)?.[1] || '';
  const dockToken = params.get('dock') || (pathToken ? decodeURIComponent(pathToken) : '');
  const tikfinityEndpoint = params.get('endpoint') || 'ws://localhost:21213/';
  const stage = document.querySelector('#dock-stage');
  const status = document.querySelector('#dock-status');
  const rendererPages = {
    carousel: 'index-rewards.html', rows: 'index-rewards-rows.html', 'side-gifts': 'index-side-gifts.html', goal: 'index-thin.html', 'top-likers': 'index-top-likers.html'
  };

  const activeFrames = new Map();
  let currentDock;
  let tikfinitySocket;
  let tikfinityReconnectTimer;
  let stopped = false;
  let unsubscribeDock;

  if (!cloud?.enabled) return setStatus('Cloud API is not configured');
  if (!dockToken) return setStatus('This Browser Source URL is missing its source token');

  global.addEventListener('beforeunload', stop);
  let resizeFrame=0;
  global.addEventListener('resize',()=>{if(!resizeFrame)resizeFrame=global.requestAnimationFrame(()=>{resizeFrame=0;resizeStage()})});
  loadDock({ allowCached: true });
  unsubscribeDock = cloud.subscribeDock(dockToken, {
    onChange: event => {
      if(event.type==='graphic.state'){activeFrames.forEach(entry=>entry.frame.contentWindow?.postMessage({type:'graphic:state',variantId:event.variantId,state:event.state},location.origin));return;}
      if (event.type === 'dock.deleted' || event.type === 'dock.token.rotated') {
        clearOutput();
        setStatus(event.type === 'dock.deleted' ? 'This output was deleted' : 'This Browser Source URL was rotated');
        return;
      }
      loadDock({ allowCached: false });
    },
    onError: () => setStatus('Live update channel reconnecting…')
  });

  async function loadDock({ allowCached }) {
    try {
      const payload = await cloud.getPublicDock(dockToken);
      cacheDock(payload);
      await applyDock(payload);
    } catch (error) {
      if (error.status === 404) clearOutput();
      const cached = allowCached && error.status !== 404 ? readCachedDock() : null;
      if (cached) {
        await applyDock(cached);
        setStatus('Using the last saved output layout — cloud is unavailable');
      } else {
        setStatus(error.message || 'Could not load output');
      }
    }
  }

  async function applyDock(payload) {
    if (!payload?.dock || !Array.isArray(payload.items)) throw new Error('Output configuration is invalid');
    currentDock = payload.dock;
    syncTikfinityConnection();
    resizeStage();
    const incomingIds = new Set(payload.items.filter(item => item.visible).map(item => item.id));
    for (const [itemId, entry] of activeFrames) {
      if (!incomingIds.has(itemId)) {
        entry.frame.remove();
        activeFrames.delete(itemId);
      }
    }

    await Promise.all(payload.items.filter(item => item.visible).map(applyItem));
    if (!payload.items.some(item => item.visible)) {
      setStatus('No overlays are assigned to this output');
    } else {
      hideStatus();
    }
  }

  async function applyItem(item) {
    const page = global.KGGraphics?.definition(item.overlayKind,item.variant?.config)?'index-graphic.html':rendererPages[item.overlayKind];
    if (!page || !item.variant?.config) return;
    const revisionKey = `${item.variant.revision || 0}:${item.overlayKind}:${item.updatedAt || ''}:${isSampleActivityEnabled() ? 'sample' : 'live'}`;
    const existing = activeFrames.get(item.id);
    if (existing?.revisionKey === revisionKey) {
      positionFrame(existing.frame, item);
      return;
    }

    const frame = document.createElement('iframe');
    frame.className = 'dock-renderer is-loading';
    frame.title = `${item.variant.name || 'Overlay'} ${item.overlayKind} renderer`;
    frame.setAttribute('allow', 'autoplay');
    positionFrame(frame, item);
    frame.src = buildRendererUrl(page, item.variant.config, item.id,item.overlayKind,item.variantId);
    stage.append(frame);
    await waitForFrame(frame);

    const previous = activeFrames.get(item.id)?.frame;
    activeFrames.set(item.id, { frame, revisionKey });
    frame.classList.remove('is-loading');
    previous?.remove();
  }

  function waitForFrame(frame) {
    return new Promise((resolve, reject) => {
      const timer = global.setTimeout(() => reject(new Error('Overlay renderer took too long to load')), 15000);
      frame.addEventListener('load', () => { global.clearTimeout(timer); resolve(); }, { once: true });
    });
  }

  function positionFrame(frame, item) {
    const natural = getNaturalOverlaySize(item.overlayKind, item.variant?.config || {});
    const scale = getUniformScale(item, natural);
    const overscan = global.KGGraphics?.definition(item.overlayKind,item.variant?.config)?0:getRendererOverscan(item.overlayKind);
    frame.style.left = `${item.x}px`;
    frame.style.top = `${item.y}px`;
    frame.style.width = `${natural.width + (overscan * 2)}px`;
    frame.style.height = `${natural.height + (overscan * 2)}px`;
    frame.style.transform = `scale(${scale}) translate(-${overscan}px, -${overscan}px)`;
    frame.style.transformOrigin = 'top left';
    frame.style.zIndex = String(item.zIndex + 1);
  }

  function getNaturalOverlaySize(kind, config = {}) {
    const compact=global.KGGraphics?.definition(kind,config);if(compact)return {width:compact.width,height:compact.height};
    if (kind === 'carousel') return { width: 112, height: 318 };
    if (kind === 'rows') return { width: 1080, height: getRowsNaturalHeight(config.rowsOverlay) };
    if (kind === 'side-gifts') {
      const dimensions = dimensionsFromConfig(config.sideGifts, 1080, 960);
      return { ...dimensions, height: getSideGiftsNaturalHeight(config.sideGifts, dimensions.height) };
    }
    if (kind === 'goal') return dimensionsFromConfig(config.goalBar, 1080, 44);
    if (kind === 'top-likers') return dimensionsFromConfig(config.topLikers, 390, 260);
    return { width: 1080, height: 240 };
  }

  function getRowsNaturalHeight(config) {
    config = config || {};
    const rows = Math.min(8, Math.max(1, Math.floor(Number(config.rows) || 2)));
    const rowHeight = Math.min(160, Math.max(64, Math.floor(Number(config.rowHeight) || 96)));
    const gap = Math.min(32, Math.max(0, Math.floor(Number(config.gap) || 0)));
    return (rows * rowHeight) + ((rows - 1) * gap);
  }

  function getSideGiftsNaturalHeight(config, fallbackHeight = 960) {
    config = config || {};
    if (!Array.isArray(config.gifts)) return fallbackHeight;
    const gifts = config.gifts.filter(gift => gift?.enabled !== false);
    const side = ['left', 'right'].includes(String(config.side).toLowerCase()) ? String(config.side).toLowerCase() : 'both';
    const leftCount = gifts.filter((gift, index) => getSideGiftLayoutSide(gift, index, side) === 'left').length;
    const rightCount = gifts.filter((gift, index) => getSideGiftLayoutSide(gift, index, side) === 'right').length;
    const slotCount = Math.max(leftCount, rightCount, 1);
    const iconSize = Math.max(24, Number(config.iconSize) || 65);
    const labelSize = Math.max(8, Number(config.labelSize) || 10);
    const labelLines = config.labelTwoLines === true ? 2 : 1;
    const labelHeight = config.showLabels === false ? 0 : Math.ceil(labelSize * 1.18 * labelLines);
    const tileExtra = config.tilesEnabled === true ? 18 : 4;
    const gap = Math.max(0, Number(config.gap) || 0);
    const edgePadding = 88;
    return Math.min(7680, (slotCount * (iconSize + labelHeight + tileExtra)) + (Math.max(0, slotCount - 1) * gap) + edgePadding);
  }

  function getSideGiftLayoutSide(gift, index, globalSide) {
    const giftSide = String(gift?.side || '').toLowerCase();
    if ((globalSide === 'left' || globalSide === 'right') && giftSide !== globalSide) return '';
    if (giftSide === 'left' || giftSide === 'right') return giftSide;
    if (globalSide === 'left' || globalSide === 'right') return '';
    const row = Number(gift?.row || 0);
    if (row === 1) return 'left';
    if (row === 2) return 'right';
    return index % 2 === 0 ? 'left' : 'right';
  }

  function getRendererOverscan(kind) {
    return kind === 'side-gifts' || kind === 'rows' ? 0 : 40;
  }

  function dimensionsFromConfig(config, fallbackWidth, fallbackHeight) {
    return {
      width: Math.max(1, Number(config?.width) || fallbackWidth),
      height: Math.max(1, Number(config?.height) || fallbackHeight)
    };
  }

  function getUniformScale(item, natural) {
    const widthScale = Number(item.width) / natural.width;
    const heightScale = Number(item.height) / natural.height;
    const scales = [widthScale, heightScale].filter(value => Number.isFinite(value) && value > 0);
    if (item?.overlayKind === 'rows' && Number.isFinite(widthScale) && widthScale > 0) return widthScale;
    return scales.length ? Math.min(...scales) : 1;
  }

  function resizeStage() {
    if (!currentDock) return;
    const width = Number(currentDock.width);
    const height = Number(currentDock.height);
    const viewportWidth = Number(global.innerWidth) || width;
    const viewportHeight = Number(global.innerHeight) || height;
    const scale = Math.min(viewportWidth / width, viewportHeight / height);
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    stage.style.transform = `translate(${Math.max(0, (viewportWidth - width * scale) / 2)}px, ${Math.max(0, (viewportHeight - height * scale) / 2)}px) scale(${scale})`;
  }

  function buildRendererUrl(page, config, itemId,kind,variantId) {
    const url = new URL(page, global.location.href);
    const search = new URLSearchParams({ relay: '1', savedConfig: '0', stateKey: `${dockToken}:${itemId}` });
    if (isSampleActivityEnabled()) search.set('test', '1');
    if (params.get('mute') === '1' || currentDock?.sampleActivity) search.set('mute', '1');
    if(global.KGGraphics?.definition(kind,config)){search.set('kind',kind);search.set('graphicToken',dockToken);search.set('graphicDesign',variantId);}
    url.search = search.toString();
    url.hash = `config=${encodeConfig(config)}`;
    return url.toString();
  }

  function connectTikfinity() {
    if (stopped || isSampleActivityEnabled()) return;
    if (tikfinitySocket && (tikfinitySocket.readyState === WebSocket.CONNECTING || tikfinitySocket.readyState === WebSocket.OPEN)) return;
    try {
      tikfinitySocket = new WebSocket(tikfinityEndpoint);
    } catch {
      scheduleTikfinityReconnect();
      return;
    }
    tikfinitySocket.addEventListener('message', event => {
      global.creatorGiftDiscovery?.observe(event.data);
      activeFrames.forEach(entry => entry.frame.contentWindow?.postMessage({ type: 'dock:tiktok-raw', data: event.data }, '*'));
    });
    tikfinitySocket.addEventListener('close', scheduleTikfinityReconnect);
  }

  function scheduleTikfinityReconnect() {
    global.clearTimeout(tikfinityReconnectTimer);
    if (!stopped && !isSampleActivityEnabled()) tikfinityReconnectTimer = global.setTimeout(connectTikfinity, 1500);
  }

  function syncTikfinityConnection() {
    global.clearTimeout(tikfinityReconnectTimer);
    if (isSampleActivityEnabled()) {
      const socket = tikfinitySocket;
      tikfinitySocket = null;
      socket?.close();
      return;
    }
    connectTikfinity();
  }

  function isSampleActivityEnabled() {
    return params.get('test') === '1' || Boolean(currentDock?.sampleActivity);
  }

  function stop() {
    stopped = true;
    global.clearTimeout(tikfinityReconnectTimer);
    unsubscribeDock?.();
    tikfinitySocket?.close();
  }

  function encodeConfig(config) {
    const bytes = new TextEncoder().encode(JSON.stringify(config));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function clearOutput() {
    for (const { frame } of activeFrames.values()) frame.remove();
    activeFrames.clear();
    try { localStorage.removeItem('reward-overlay-dock-cache:' + dockToken); } catch { /* Optional cache. */ }
  }

  function cacheDock(payload) {
    try { localStorage.setItem(`reward-overlay-dock-cache:${dockToken}`, JSON.stringify({ payload, cachedAt: Date.now() })); } catch { /* Optional cache. */ }
  }

  function readCachedDock() {
    try {
      const cached = JSON.parse(localStorage.getItem(`reward-overlay-dock-cache:${dockToken}`) || 'null');
      if (!cached) return null;
      if (cached.payload && Date.now() - Number(cached.cachedAt || 0) <= 24 * 60 * 60 * 1000) return cached.payload;
      localStorage.removeItem(`reward-overlay-dock-cache:${dockToken}`);
      return null;
    } catch { return null; }
  }

  function setStatus(message, connected = false) {
    status.textContent = message;
    status.classList.toggle('is-connected', connected);
  }

  function hideStatus() {
    setStatus('', true);
  }
})(window);
