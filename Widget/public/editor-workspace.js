/* Indexed lookups and editor-only preview sizing. Public widget routes are unchanged. */
let editorCatalogueRevision = 0;
let editorCatalogueCache = null;
let editorLegacyCache = null;
function invalidateEditorCatalogue() { editorCatalogueRevision++; editorCatalogueCache = null; }
function editorCatalogueViews() {
  if (editorCatalogueCache?.revision === editorCatalogueRevision) return editorCatalogueCache;
  const entries = [...imageCatalog.values()].sort((a,b)=>a.label.localeCompare(b.label));
  const byId = new Map(), byName = new Map();
  for(const entry of entries) {if(entry.id&&!byId.has(String(entry.id)))byId.set(String(entry.id),entry);const name=normalizeName(entry.name||entry.label);if(!byName.has(name))byName.set(name,entry)}
  return editorCatalogueCache = {revision:editorCatalogueRevision,entries,byId,byName};
}
function editorLegacyCatalogueViews() {
  const source=window.rewardImageCatalog||[];
  if(editorLegacyCache?.source===source&&editorLegacyCache.length===source.length)return editorLegacyCache;
  const byImage=new Map(),byId=new Map(),byName=new Map();
  const add=(map,key,entry)=>{if(key)map.set(key,[...(map.get(key)||[]),entry])};
  for(const entry of source){const image=entry.image||entry.path||entry.url||'';byImage.set(normalizePath(image).toLowerCase(),entry);add(byId,normalizeId(entry.id||entry.giftId||getIdFromImagePath(image)),entry);add(byName,normalizeName(entry.name||entry.label||getImageLabel(entry.image)),entry)}
  return editorLegacyCache={source,length:source.length,byImage,byId,byName};
}
function encodeEditorPreviewConfig(page,config) {
  const fullGift=(gift,compact)=>({...compact,m:gift.image});
  if(page==='index-rewards-rows.html')return encodeCompactConfig({_: 'r2',o:{...compactRowsOverlayForUrl(config.rowsOverlay),j:config.rowsOverlay.gifts.map(g=>fullGift(g,compactRowsGiftForUrl(g)))},v:compactThemeForUrl(config.rowsTheme)});
  if(page.startsWith('index-side-gifts'))return encodeCompactConfig({_: 'r2',z:{...compactSideGiftsForUrl(config.sideGifts),m:config.sideGifts.gifts.map(g=>fullGift(g,compactSideGiftForUrl(g)))}});
  if(page.startsWith('index-top-likers'))return encodeCompactConfig({_: 'r2',w:compactTopLikersForUrl(config.topLikers)});
  if(page==='index-rewards.html')return encodeCompactConfig(removeEmptyUrlFields({_: 'r2',a:config.rotateMs,b:config.holdOnGiftMs,c:config.labelMs,d:config.visibleNext,e:config.soundsEnabled===false?0:undefined,f:config.animationsEnabled===false?0:undefined,h:config.profileAnimationEnabled?1:undefined,i:config.profileAnimationEnabled&&config.profileNameEnabled?1:undefined,t:compactThemeForUrl(config.theme),u:compactThemeForUrl(config.carouselTheme),g:config.rewards.map(g=>fullGift(g,compactRewardForUrl(g)))}));
  return encodeConfig(config);
}
const editorSectionChoices = new Map();
let editorSectionsReady = false;
function initializeEditorSections() {
  if(editorSectionsReady)return;
  editorSectionsReady=true;
  initializePreviewBackgroundControls();
  const styleHeading=/^(first place|preset|glass|text.*edges|effects|labels|outlines|tiles.*glow|colou?rs|font sizes|appearance|medals|background|tile colou?rs|text.*glow|opacity|shell|individual colou?rs)/i;
  for(const kind of ['original','rows','side-gifts','goal','top-likers']){
    const panels=[...document.querySelectorAll(`[data-config-panel="${kind}"]`)];
    const preview=panels.find(p=>p.querySelector('iframe'));
    if(!preview)continue;
    const cards=panels.find(p=>p.querySelector('#reward-list, #rows-gift-list, #side-gift-list'));
    if(cards)cards.dataset.editorSection='cards';
    const nav=document.createElement('div');nav.className='editor-section-tabs';nav.dataset.editorNav=kind;nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Editor sections');
    const sections=cards?['cards','settings','style']:['settings','style'];
    nav.innerHTML=sections.map(key=>`<button type="button" role="tab" id="editor-tab-${kind}-${key}" data-editor-section-tab="${key}" aria-selected="false" aria-controls="editor-panel-${kind}-${key}"><span class="editor-tab-icon" aria-hidden="true">${rowsIcon(key)}</span>${key==='cards'?'Cards':key==='style'?'Style':'Settings'}</button>`).join('');
    preview.after(nav);
    for(const panel of panels.filter(p=>p.matches('details.config-collapse'))){
      const style=/theme|appearance|styling/i.test(panel.getAttribute('aria-label')||'');
      panel.dataset.editorSection=style?'style':'settings';panel.open=true;
      // Split existing groups without cloning inputs or changing field IDs/handlers.
      if(!style){const grid=panel.querySelector('.config-globals');if(grid){let target=null;const stylePanel=document.createElement('section');stylePanel.className='config-section editor-style-panel';stylePanel.dataset.configPanel=kind;stylePanel.dataset.editorSection='style';stylePanel.innerHTML='<h2 class="section-title">Appearance</h2><div class="config-globals grouped-config-grid"></div>';const styleGrid=stylePanel.lastElementChild;for(const child of [...grid.children]){if(child.classList.contains('config-group-heading'))target=styleHeading.test(child.textContent.trim())?styleGrid:null;if(target)target.append(child)}if(styleGrid.children.length)panel.after(stylePanel)}}
    }
    for(const key of sections){const wrapper=document.createElement('div');wrapper.className='editor-section-panel';wrapper.dataset.editorPanel=kind;wrapper.dataset.editorSection=key;wrapper.id=`editor-panel-${kind}-${key}`;wrapper.setAttribute('role','tabpanel');wrapper.setAttribute('aria-labelledby',`editor-tab-${kind}-${key}`);nav.after(wrapper);for(const panel of document.querySelectorAll(`[data-config-panel="${kind}"][data-editor-section="${key}"]`))wrapper.append(panel)}
    nav.addEventListener('click',e=>{const button=e.target.closest('[data-editor-section-tab]');if(!button)return;editorSectionChoices.set(kind,button.dataset.editorSectionTab);updateEditorSections()});
    nav.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...nav.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();buttons[next].click()});
  }
}
function updateEditorSections() {
  initializeEditorSections();
  for(const nav of document.querySelectorAll('[data-editor-nav]')){const kind=nav.dataset.editorNav,active=kind===activeConfigTab;nav.hidden=!active;const key=editorSectionChoices.get(kind)||nav.querySelector('button').dataset.editorSectionTab;nav.querySelectorAll('button').forEach(button=>{const selected=button.dataset.editorSectionTab===key;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1});document.querySelectorAll(`[data-editor-panel="${kind}"]`).forEach(panel=>{panel.hidden=!active||panel.dataset.editorSection!==key;panel.querySelectorAll('[data-config-panel]').forEach(section=>section.hidden=!active||panel.dataset.editorSection!==key)})}
  syncEditorPreviewActivity();
  requestAnimationFrame(()=>document.querySelectorAll('[data-config-panel]:not([hidden]) iframe[src]').forEach(fitEditorPreview));
}
const editorPreviewStates = new WeakMap();
const pendingEditorPreviewFits = new Set();
let editorPreviewFitRaf = 0;
function queueEditorPreviewFit(frame, width) {
  const state=editorPreviewStates.get(frame);
  if(!state)return;
  if(Number.isFinite(width))state.availableWidth=width;
  pendingEditorPreviewFits.add(frame);
  if(editorPreviewFitRaf)return;
  editorPreviewFitRaf=requestAnimationFrame(()=>{
    editorPreviewFitRaf=0;
    const frames=[...pendingEditorPreviewFits];pendingEditorPreviewFits.clear();
    // All geometry reads precede writes; height-only observer notifications do no work.
    const work=frames.filter(frame=>frame.isConnected&&!frame.closest('[hidden]')).map(frame=>({frame,state:editorPreviewStates.get(frame),width:Math.floor(editorPreviewStates.get(frame).availableWidth||frame.parentElement.clientWidth)}));
    for(const {frame,state,width} of work){
      if(width<=32||state.paintedWidth===width)continue;
      state.paintedWidth=width;
      const scale=frame.dataset.previewZoom==='native'?1:Math.min(1,(width-32)/1080);
      frame.style.transform=`scale(${scale})`;
      state.box.style.height=Math.ceil(state.frameHeight*scale+32)+'px';
      state.caption.textContent=`Source size 1080 × ${state.nativeHeight} · ${Math.round(scale*100)}% preview${frame.id==='carousel-preview'?' · carousel card is narrower than the stage':''}`;
    }
  });
}
function fitCompactGraphicPreview(frame){
 const kind=({'carousel-preview':'carousel','rows-preview':'rows','side-gifts-preview':'side-gifts','goal-preview':'goal','top-likers-preview':'top-likers'})[frame?.id],d=kind&&window.KGGraphics?.definition(kind,draftConfig);
 if(!d||!frame.contentDocument?.querySelector('#graphic-root'))return false;const box=frame.parentElement,available=box.clientWidth;if(available<32)return true;
 const scale=Math.min(1,(available-32)/d.width),height=Math.max(180,d.height*scale+32),left=(available-d.width*scale)/2,top=(height-d.height*scale)/2;
 frame.style.cssText='position:absolute;margin:0;left:'+left+'px;top:'+top+'px;width:'+d.width+'px;height:'+d.height+'px;max-width:none;transform-origin:top left;transform:scale('+scale+')';
 box.style.cssText='position:relative;display:block;padding:0;min-height:0;height:'+Math.ceil(height)+'px;overflow:hidden';const caption=box.parentElement.querySelector('.editor-preview-caption');if(caption)caption.hidden=true;return true;
}
function fitEditorPreview(frame) {
  if(fitCompactGraphicPreview(frame))return;
  if(!frame?.contentDocument||!frame.parentElement?.clientWidth)return;
  const isRows=frame.id==='rows-preview',isCarousel=frame.id==='carousel-preview';
  if(!isRows&&!isCarousel)return;
  const doc=frame.contentDocument,root=doc.querySelector('#reward-rows-widget,#rewards-widget');
  if(!root)return;
  const box=frame.parentElement;
  const previousCaption=box.parentElement.querySelector('.editor-preview-caption');if(previousCaption)previousCaption.hidden=false;
  let state=editorPreviewStates.get(frame);
  if(!state||state.doc!==doc){
    state?.observer.disconnect();
    frame.style.cssText='position:absolute;left:16px;top:16px;margin:0;width:1080px;max-width:none;transform-origin:top left;will-change:transform';
    const nativeHeight=Math.ceil(root.getBoundingClientRect().height);
    const frameHeight=nativeHeight+(isRows?24:40);
    frame.style.height=frameHeight+'px';
    box.style.cssText+=';min-height:0;display:block;overflow:clip;padding:0;contain:layout paint';
    let caption=box.parentElement.querySelector('.editor-preview-caption');
    if(!caption){caption=document.createElement('span');caption.className='editor-preview-caption';box.after(caption)}
    state={doc,box,caption,nativeHeight,frameHeight,availableWidth:box.clientWidth,paintedWidth:0,observedWidth:0};
    state.observer=new ResizeObserver(entries=>{const width=Math.floor(entries[0].contentRect.width);if(width===state.observedWidth)return;state.observedWidth=width;queueEditorPreviewFit(frame,width)});
    editorPreviewStates.set(frame,state);state.observer.observe(box);
  }else{state.availableWidth=box.clientWidth;}
  queueEditorPreviewFit(frame);
}

// Cached editor previews stop animation and sample updates while hidden or during a resize.
const managedPreviewActivity=new WeakMap();
const observedOutputDocuments=new WeakSet();
let editorWindowResizing=false,editorResizeIdle;
function setManagedPreviewActive(frame,active) {
  active=active&&frame.dataset.previewPaused!=='true';
  try {
    const doc=frame.contentDocument,win=frame.contentWindow;
    if(!doc?.head||!win)return;
    const previous=managedPreviewActivity.get(frame);
    if(previous?.doc===doc&&previous.active===active)return;
    if(!doc.querySelector('#editor-preview-pause-style')){const style=doc.createElement('style');style.id='editor-preview-pause-style';style.textContent='html[data-editor-paused] *,html[data-editor-paused] *::before,html[data-editor-paused] *::after{animation-play-state:paused!important;transition:none!important}';doc.head.append(style)}
    doc.documentElement.toggleAttribute('data-editor-paused',!active);win.editorPreviewActive=active;
    if(typeof win.stopRowScroll==='function')doc.querySelectorAll('.reward-gift-row.is-scrolling').forEach(row=>active?win.startRowScroll(row):win.stopRowScroll(row));
    managedPreviewActivity.set(frame,{doc,active});
    if(!previous)frame.addEventListener('load',syncEditorPreviewActivity);
  }catch{/* Only same-origin application previews are managed. */}
}
function syncEditorPreviewActivity() {
  const outputActive=document.body.classList.contains('studio-output-active');const extendedActive=document.body.classList.contains('studio-extended-active');
  document.querySelectorAll('[data-config-panel] iframe[src]').forEach(frame=>setManagedPreviewActive(frame,!document.hidden&&!editorWindowResizing&&!outputActive&&!extendedActive&&!frame.closest('[hidden]')));
  const output=document.querySelector('#studio-output-frame');
  try {
    const doc=output?.contentDocument,list=doc?.querySelector('#dock-manager-list');
    if(list&&!observedOutputDocuments.has(doc)){observedOutputDocuments.add(doc);new MutationObserver(syncEditorPreviewActivity).observe(list,{childList:true,subtree:true})}
    list?.querySelectorAll('.dock-canvas-layer iframe').forEach(frame=>setManagedPreviewActive(frame,!document.hidden&&!editorWindowResizing&&outputActive&&!frame.closest('[hidden]')));
  }catch{}
}
window.addEventListener('resize',()=>{if(!editorWindowResizing){editorWindowResizing=true;syncEditorPreviewActivity()}clearTimeout(editorResizeIdle);editorResizeIdle=setTimeout(()=>{editorWindowResizing=false;syncEditorPreviewActivity()},160)});
document.addEventListener('visibilitychange',syncEditorPreviewActivity);
document.addEventListener('DOMContentLoaded',()=>document.querySelector('#studio-output-frame')?.addEventListener('load',syncEditorPreviewActivity),{once:true});

let previewBackgroundModes={};
try {const saved=JSON.parse(localStorage.getItem('kg-preview-backgrounds')||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))previewBackgroundModes=saved;}catch{}
function previewBackgroundFor(frameId) {return ['dark','neutral','light'].includes(previewBackgroundModes[frameId])?previewBackgroundModes[frameId]:'dark';}
function applyPreviewBackground() {
  document.querySelectorAll('.overlay-preview-frame').forEach(box=>box.dataset.previewBackground=previewBackgroundFor(box.querySelector('iframe')?.id));
  document.querySelectorAll('[data-preview-background-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.previewBackgroundChoice===previewBackgroundFor(button.dataset.previewFrame))));
}
function initializePreviewBackgroundControls() {
  document.querySelectorAll('.overlay-preview-frame').forEach(box=>{
    if(box.parentElement.querySelector('.preview-background-choices'))return;
    const frameId=box.querySelector('iframe')?.id;
    const footer=document.createElement('div');footer.className='editor-preview-footer';
    footer.innerHTML='<span class="editor-preview-caption">Transparent background</span><div class="preview-background-choices" role="group" aria-label="Preview background">'+['dark','neutral','light'].map(mode=>'<button type="button" data-preview-frame="'+frameId+'" data-preview-background-choice="'+mode+'" aria-label="'+mode[0].toUpperCase()+mode.slice(1)+' preview background" title="'+mode[0].toUpperCase()+mode.slice(1)+' preview background"><span class="preview-background-swatch is-'+mode+'" aria-hidden="true"></span><span>'+mode[0].toUpperCase()+mode.slice(1)+'</span></button>').join('')+'</div>';
    box.after(footer);
    footer.querySelector('.preview-background-choices').addEventListener('click',event=>{const button=event.target.closest('[data-preview-background-choice]');if(!button)return;previewBackgroundModes[frameId]=button.dataset.previewBackgroundChoice;try{localStorage.setItem('kg-preview-backgrounds',JSON.stringify(previewBackgroundModes))}catch{}applyPreviewBackground()});
  });
  applyPreviewBackground();
}
