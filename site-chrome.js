(function initializeSiteChrome(global) {
  'use strict';

  if (new URLSearchParams(global.location.search).get('embed') === '1') return;

  const apiBaseUrl = `${global.location.origin}/api`;
  const refreshMilliseconds = 60000;

  const banner = document.createElement('aside');
  banner.className = 'kg-live-banner';
  banner.setAttribute('aria-label', 'King Gumption live status');
  banner.hidden = true;

  const message = document.createElement('span');
  message.className = 'kg-live-message';
  const dot = document.createElement('i');
  dot.className = 'kg-live-dot';
  dot.setAttribute('aria-hidden', 'true');
  const label = document.createElement('strong');
  label.textContent = 'KingGumption is live now';
  message.append(dot, label);

  const platformLinks = document.createElement('span');
  platformLinks.className = 'kg-live-platforms';
  banner.append(message, platformLinks);
  document.body.prepend(banner);

  const kofi = document.createElement('a');
  kofi.className = 'kg-kofi-link';
  kofi.href = 'https://ko-fi.com/kinggumption';
  kofi.target = '_blank';
  kofi.rel = 'noopener noreferrer';
  kofi.innerHTML = '<svg class="kg-coffee-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h12v7a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8Zm12 1h1a3 3 0 1 1 0 6h-1M3 21h17"/><path class="kg-coffee-steam" d="M8 5V3m5 2V2"/></svg><span>Buy me a coffee</span>';
  kofi.setAttribute('aria-label', 'Support King Gumption on Ko-fi (opens in a new tab)');
  const accountPanel = document.querySelector('.studio-account-panel');
  if (accountPanel) {
    const support = document.createElement('section');
    support.className = 'studio-support sidebar-auth-only';
    support.setAttribute('aria-label', 'Support Studio');
    support.innerHTML = '<strong>Made for your stream.</strong><p>Enjoying Studio? Help keep it growing.</p>';
    support.append(kofi);
    accountPanel.before(support);
  } else { document.body.append(kofi); }

  function showStatus(payload) {
    const livePlatforms = Array.isArray(payload?.platforms)
      ? payload.platforms.filter(platform => platform?.isLive && platform?.url)
      : [];

    platformLinks.replaceChildren();
    livePlatforms.forEach(platform => {
      const link = document.createElement('a');
      link.className = 'kg-live-platform';
      link.href = platform.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = platform.label || platform.platform;
      link.setAttribute('aria-label', `Watch KingGumption live on ${link.textContent}`);
      platformLinks.append(link);
    });

    const isLive = livePlatforms.length > 0;
    banner.hidden = !isLive;
    document.body.classList.toggle('kg-live-visible', isLive);
  }

  let statusPending=false;
  async function refreshStatus() {
    if(document.hidden||statusPending)return;
    statusPending=true;
    try {
      const response = await fetch(`${apiBaseUrl}/v1/live-status`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Live status request failed (${response.status})`);
      showStatus(await response.json());
    } catch {
      showStatus({ platforms: [] });
    } finally { statusPending=false; }
  }

  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshStatus()});
  refreshStatus();
  global.setInterval(refreshStatus, refreshMilliseconds);
})(window);

// Only the selected, visible sample owns a renderer; hidden samples do no background work.
(() => {
  const articles=[...document.querySelectorAll('.example-grid article')];
  const buttons=[...document.querySelectorAll('[data-example]')];
  if(!articles.length)return;
  let selected=0,paintRaf=0;
  const visible=new Set(),pending=new Set(),lastWidths=new WeakMap();
  function updateSample(stage) {
    const frame=stage.querySelector('iframe');
    if(!frame)return;
    const active=articles[selected]?.contains(stage)&&visible.has(stage)&&!document.hidden;
    if(active&&!frame.hasAttribute('src')){frame.style.visibility='hidden';frame.onload=()=>{frame.style.visibility='visible';};frame.src=frame.dataset.src;}
    else if(!active&&frame.hasAttribute('src'))frame.removeAttribute('src');
  }
  function schedule(stage) {
    pending.add(stage);if(paintRaf)return;
    paintRaf=requestAnimationFrame(()=>{paintRaf=0;const measured=[...pending].filter(s=>!s.closest('[hidden]')).map(stage=>({stage,width:stage.clientWidth,height:Number(stage.dataset.height),nativeWidth:stage.dataset.responsive==='true'?stage.clientWidth:Number(stage.dataset.width)}));pending.clear();for(const {stage,width,height,nativeWidth} of measured){if(lastWidths.get(stage)===width)continue;lastWidths.set(stage,width);const frame=stage.querySelector('iframe'),scale=Math.min(1,width/nativeWidth,340/height),stageHeight=Math.max(240,height*scale);frame.style.width=nativeWidth+'px';frame.style.height=height+'px';frame.style.transform='scale('+scale+')';stage.style.height=stageHeight+'px';frame.style.left=Math.max(0,(width-nativeWidth*scale)/2)+'px';frame.style.top=Math.max(0,(stageHeight-height*scale)/2)+'px'}});
  }
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)visible.add(entry.target);else visible.delete(entry.target);updateSample(entry.target)}},{rootMargin:'120px'});
  const resize=new ResizeObserver(entries=>entries.forEach(entry=>schedule(entry.target)));
  const stages=articles.map(article=>article.querySelector('.example-stage'));
  stages.forEach(stage=>{observer.observe(stage);resize.observe(stage)});
  function select(index){selected=index;articles.forEach((article,i)=>article.hidden=i!==index);buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));stages.forEach(stage=>{updateSample(stage);schedule(stage)})}
  buttons.forEach(button=>button.addEventListener('click',()=>select(Number(button.dataset.example))));
  document.addEventListener('visibilitychange',()=>stages.forEach(updateSample));
  select(Math.max(0,buttons.findIndex(button=>button.getAttribute('aria-pressed')==='true')));
})();
