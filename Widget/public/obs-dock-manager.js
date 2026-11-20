(function initializeDockManager(global) {
  'use strict';

  const cloud = global.overlayCloud;
  const isStudioEmbed = new URLSearchParams(global.location.search).get('embed') === '1';
  document.body.classList.toggle('studio-output-embedded', isStudioEmbed);
  const status = document.querySelector('#dock-manager-status');
  const disabled = document.querySelector('#dock-manager-disabled');
  const auth = document.querySelector('#dock-manager-auth');
  const email = document.querySelector('#dock-manager-email');
  const password = document.querySelector('#dock-manager-password');
  const register = document.querySelector('#dock-manager-register');
  const registrationNote = document.querySelector('#dock-registration-note');
  const account = document.querySelector('#dock-manager-account');
  const accountEmail = document.querySelector('#dock-manager-account-email');
  const signOut = document.querySelector('#dock-manager-sign-out');
  const createForm = document.querySelector('#dock-create-form');
  const createName = document.querySelector('#dock-create-name');
  const createPreset = document.querySelector('#dock-create-preset');
  const createWidth = document.querySelector('#dock-create-width');
  const createHeight = document.querySelector('#dock-create-height');
  const refresh = document.querySelector('#dock-manager-refresh');
  const list = document.querySelector('#dock-manager-list');
  const template = document.querySelector('#dock-card-template');
  const copyDialog = document.querySelector('#dock-copy-dialog');
  const copyWidth = document.querySelector('#dock-copy-width');
  const copyHeight = document.querySelector('#dock-copy-height');
  const rendererPages = {
    carousel: 'index-rewards.html',
    rows: 'index-rewards-rows.html',
    'side-gifts': 'index-side-gifts.html',
    goal: 'index-thin.html',
    'top-likers': 'index-top-likers.html'
  };
  const overlayLabels = {
    carousel: 'Gift Carousel', rows: 'Rows Overlay', 'side-gifts': 'Side Gifts', goal: 'Goal Bar', 'top-likers': 'Top Likers'
  };
  const presetSizes = { horizontal: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] };
  const expandedDockIds = new Set();
  const selectedItems = new Map();
  const selectedLayers=new Map(),canvasViews=new Map(),renderedDockSignatures=new WeakMap();
  const savingSampleActivity = new Set();

  let liveSocket;
  document.querySelector('#check-live-connection').addEventListener('click', () => {
    if (liveSocket) liveSocket.close();
    const status = document.querySelector('#live-connection-status');
    status.textContent = 'Connecting to TikFinity…';
    liveSocket = new WebSocket('ws://localhost:21213/');
    liveSocket.addEventListener('open', () => { status.textContent = 'TikFinity connected — waiting for live activity'; });
    liveSocket.addEventListener('message', () => { status.textContent = 'TikFinity connected — last event ' + new Date().toLocaleTimeString(); });
    liveSocket.addEventListener('error', () => { status.textContent = 'TikFinity unavailable. Enable the Event API on this computer and retry.'; });
    liveSocket.addEventListener('close', () => { status.textContent = 'TikFinity disconnected. Check the Event API and retry.'; });
  });
  global.addEventListener('beforeunload', () => liveSocket?.close());

  let variants = [];
  let docks = [];
  let suppressLayerClickUntil = 0;
  const canvasHistories=new Map();
  const canvasSnapshot=dock=>JSON.parse(JSON.stringify({width:dock.width,height:dock.height,items:dock.items}));
  function rememberCanvas(dock){
    let h=canvasHistories.get(dock.id);
    if(!h){canvasHistories.set(dock.id,{steps:[canvasSnapshot(dock)],at:0});return;}
    const next=canvasSnapshot(dock);
    if(JSON.stringify(next)===JSON.stringify(h.steps[h.at]))return;
    h.steps=h.steps.slice(0,h.at+1);h.steps.push(next);h.at++;
    if(h.steps.length>30){h.steps.shift();h.at--;}
  }
  async function travelCanvas(dock,card,direction){
    const h=canvasHistories.get(dock.id),target=h?.steps[h.at+direction];if(!target)return;
    setBusy(true);
    try{
      const result=await cloud.restoreDockLayout(dock.id,{...target,expectedItems:dock.items,expectedWidth:dock.width,expectedHeight:dock.height});
      h.at+=direction;Object.assign(dock,result.dock);renderComposer(card,dock);
      setStatus((direction<0?'Undid':'Redid')+' canvas change · output URL unchanged');
    }catch(error){setStatus(error.message,true);}finally{setBusy(false);}
  }

  if (!cloud?.enabled) {
    disabled.hidden = false;
    status.textContent = 'Cloud API not configured';
    return;
  }

  auth.addEventListener('submit', event => { event.preventDefault(); authenticate(authMode); });
  let authMode = 'login';
  register.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    auth.querySelector('button[type="submit"]').textContent = authMode === 'register' ? 'Create account' : 'Sign in';
    register.textContent = authMode === 'register' ? 'Already have an account? Sign in' : 'Create an account';
    password.minLength=authMode==='register'?15:10;
    password.autocomplete = authMode === 'register' ? 'new-password' : 'current-password';
    auth.querySelector('h2').textContent = authMode === 'register' ? 'Create your Studio account' : 'Sign in to manage your outputs';
    email.focus();
  });
  signOut.addEventListener('click', logout);
  createForm.addEventListener('submit', createDock);
  createPreset.addEventListener('change', applyCreatePreset);
  refresh.addEventListener('click', loadManagerData);
  global.addEventListener('overlaycloud:session', event => renderSession(event.detail));
  let canvasResizeRaf=0;
  global.addEventListener('resize',()=>{if(!canvasResizeRaf)canvasResizeRaf=global.requestAnimationFrame(()=>{canvasResizeRaf=0;updateAllCanvasPreviewScales()})});
  global.addEventListener('message', event => {
    if (!isStudioEmbed || event.origin !== global.location.origin || event.data?.type !== 'studio:activate-output') return;
    cloud.session = cloud.readSession();
    renderSession(cloud.session);
    if (cloud.signedIn) loadManagerData();
  });
  loadServiceConfig();
  restoreSession();

  async function loadServiceConfig() {
    try {
      const serviceConfig = await cloud.getServiceConfig();
      register.hidden = !serviceConfig.registrationEnabled;
      if (registrationNote) {
        registrationNote.firstChild.textContent = serviceConfig.registrationEnabled
          ? 'Read the '
          : 'New account registration is currently invite-only. ';
      }
    } catch {
      register.hidden = true;
    }
  }

  async function restoreSession() {
    if (!cloud.signedIn) return renderSession(null);
    try {
      const result = await cloud.me();
      renderSession({ ...cloud.session, user: result.user });
      await loadManagerData();
    } catch (error) {
      renderSession(null);
      setStatus(error.message, true);
    }
  }

  async function authenticate(mode) {
    if (!email.value.trim() || (mode==='register'?[...password.value].length:password.value.length) < (mode==='register'?15:10)) {
      setStatus('Enter an email and a password of at least '+(mode==='register'?15:10)+' characters', true);
      return;
    }
    setBusy(true);
    try {
      const result = mode === 'register'
        ? await cloud.register(email.value.trim(), password.value)
        : await cloud.login(email.value.trim(), password.value);
      password.value = '';
      if (!result.session) {
        setStatus(result.message || 'Try signing in with those details');
        return;
      }
      renderSession(result.session);
      await loadManagerData();
      setStatus(mode === 'register' ? 'Account created with vertical and horizontal outputs' : 'Signed in');
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await cloud.logout();
      variants = [];
      docks = [];
      renderSession(null);
      renderDocks();
      setStatus('Signed out');
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  function renderSession(session) {
    const signedIn = Boolean(session?.token && session?.user);
    auth.hidden = signedIn;
    document.body.classList.toggle('cloud-authenticated', signedIn);
    account.hidden = !signedIn;
    accountEmail.textContent = session?.user?.email || '';
    if (!signedIn) status.textContent = 'Sign in to manage canvases';
  }

  async function loadManagerData() {
    setBusy(true);
    try {
      const [variantResult, dockResult] = await Promise.all([cloud.listVariants(), cloud.listDocks()]);
      variants = variantResult.variants || [];
      const previousDocks=new Map(docks.map(dock=>[dock.id,dock]));
      docks = (dockResult.docks || []).map(next=>Object.assign(previousDocks.get(next.id)||{},next));
      canvasHistories.clear();docks.forEach(rememberCanvas);
      renderDocks();
      setStatus(`Loaded ${docks.length} output${docks.length === 1 ? '' : 's'} with ${docks.reduce((sum, dock) => sum + dock.items.length, 0)} overlay layer${docks.reduce((sum, dock) => sum + dock.items.length, 0) === 1 ? '' : 's'}`);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  function applyCreatePreset() {
    const size = presetSizes[createPreset.value];
    if (!size) return;
    [createWidth.value, createHeight.value] = size;
  }

  async function createDock(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await cloud.createDock({ name: createName.value, width: createWidth.value, height: createHeight.value });
      docks.push(result.dock);
      expandedDockIds.add(result.dock.id);
      createName.value = '';
      renderDocks();
      setStatus(`Created ${result.dock.name}; add overlays, then copy its Browser Source URL into your streaming software`);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  function renderDocks() {
    const previousCards=new Map([...list.querySelectorAll('[data-dock-id]')].map(card=>[card.dataset.dockId,card]));
    if (!docks.length) {
      list.innerHTML = '<div class="dock-empty-state"><span class="dock-empty-icon" aria-hidden="true">◇</span><strong>No canvases yet</strong><p>Open New canvas below to create your first layout.</p></div>';
      return;
    }

    docks.forEach(dock => {
      const existing=previousCards.get(dock.id);previousCards.delete(dock.id);
      const signature=JSON.stringify([dock,variants.filter(variant=>dock.items.some(item=>item.variantId===variant.id)).map(variant=>[variant.id,variant.revision,variant.name])]);
      if(existing){
        if(renderedDockSignatures.get(existing)===signature)return;
        existing.querySelector('[data-role="name"]').textContent=dock.name;
        for(const field of ['name','width','height'])existing.querySelector('[data-field="'+field+'"]').value=dock[field];
        existing.querySelector('[data-role="format"]').textContent=dock.width+' × '+dock.height;
        existing.querySelector('[data-role="layers"]').textContent=dock.items.length+' layers';
        existing.querySelector('[data-role="url"]').value=cloud.getDockUrl(dock.publicToken);
        existing.querySelector('.output-mode-status').textContent=dock.sampleActivity?'Sample activity is on — turn it off before going live':'Live mode — sample activity is off';
        if(expandedDockIds.has(dock.id))renderComposer(existing,dock);
        renderedDockSignatures.set(existing,signature);return;
      }
      list.querySelector('.dock-empty-state')?.remove();
      const card = template.content.firstElementChild.cloneNode(true);
      renderedDockSignatures.set(card,signature);
      card.dataset.dockId = dock.id;
      card.querySelector('[data-role="name"]').textContent = dock.name;
      card.querySelector('[data-field="name"]').value = dock.name;
      card.querySelector('[data-field="width"]').value = dock.width;
      card.querySelector('[data-field="height"]').value = dock.height;
      card.querySelector('[data-role="format"]').textContent = `${dock.width} × ${dock.height}`;
      card.querySelector('[data-role="layers"]').textContent = `${dock.items.length} layer${dock.items.length === 1 ? '' : 's'}`;
      card.querySelector('[data-role="url"]').value = cloud.getDockUrl(dock.publicToken);
      const mode = document.createElement('p');
      mode.className = 'output-mode-status';
      mode.textContent = dock.sampleActivity ? 'Sample activity is on — turn it off before going live' : 'Live mode — sample activity is off';
      card.querySelector('.dock-card-heading').after(mode);
      const jump = document.createElement('button');
      jump.type = 'button';
      jump.className = 'canvas-jump';
      jump.textContent = 'Go to canvas';
      jump.onclick = () => {
        if (!expandedDockIds.has(dock.id)) card.querySelector('[data-action="toggle-editor"]').click();
        const current = list.querySelector('[data-dock-id="' + dock.id + '"]');
        current?.querySelector('[data-role="canvas"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      card.querySelector('.dock-card-primary-actions').append(jump);
      const composer = card.querySelector('[data-role="composer"]');
      const expanded = expandedDockIds.has(dock.id);
      composer.hidden = !expanded;
      card.querySelector('[data-action="toggle-editor"]').setAttribute('aria-expanded', String(expanded));
      const addVariant = card.querySelector('[data-role="add-variant"]');
      const addKind = card.querySelector('[data-role="add-kind"]');
      populateVariantSelect(addVariant, 'Choose a saved design', addKind.value);
      addKind.addEventListener('change', () => {
        populateVariantSelect(addVariant, 'Choose a saved design', addKind.value);
      });
      card.addEventListener('click', event => handleDockAction(event, dock.id, card));
      card.addEventListener('input', event => previewInspectorScale(event, docks.find(item=>item.id===dock.id)||dock, card));
      list.append(card);
      if (expanded) renderComposer(card, dock);
    });
    previousCards.forEach(card=>card.remove());
  }

  function renderComposer(card, dock) {
    const canvas = card.querySelector('[data-role="canvas"]');
    initializeCanvasTools(card,dock,canvas);
    const testPreviewToggle = card.querySelector('[data-role="test-preview"]');
    const showSampleActivity = Boolean(dock.sampleActivity);
    testPreviewToggle.checked = showSampleActivity;
    testPreviewToggle.disabled = savingSampleActivity.has(dock.id);
    testPreviewToggle.onchange = () => saveSampleActivity(dock, testPreviewToggle.checked);
    const previousLayers=new Map([...canvas.querySelectorAll('.dock-canvas-layer')].map(layer=>[layer.dataset.itemId,layer]));
    canvas.querySelectorAll('.dock-canvas-overhang-shade').forEach(shade=>shade.remove());
    canvas.style.aspectRatio = `${dock.width} / ${dock.height}`;
    const zoom=canvasViews.get(dock.id)?.zoom||'fit';
    canvas.style.width = zoom==='fit'?`min(100%, ${Math.round(600 * dock.width / dock.height)}px)`:(Math.round(dock.width*Number(zoom))+'px');
    canvas.style.maxWidth=zoom==='fit'?'100%':'none';canvas.style.maxHeight=zoom==='fit'?'620px':'none';canvas.style.flexShrink='0';
    canvas.dataset.outputWidth = String(dock.width);
    updateCanvasPreviewScale(canvas, dock.width);

    if(!dock.items.some(item=>item.id===selectedItems.get(dock.id))&&dock.items[0])selectedItems.set(dock.id,dock.items[0].id);
    const ordered = [...dock.items].sort((a, b) => a.zIndex - b.zIndex);
    const previewItems = [];
    ordered.forEach(item => {
      const variant = variants.find(entry => entry.id === item.variantId);
      const displayItem = variant ? withUniformScale(item, getNaturalOverlaySize(item.overlayKind, variant.config)) : item;
      previewItems.push(displayItem);
      const layer = previousLayers.get(item.id)||document.createElement('div');
      previousLayers.delete(item.id);
      layer.className = 'dock-canvas-layer';
      layer.dataset.itemId = item.id;
      layer.classList.toggle('is-selected', (selectedLayers.get(dock.id)?.has(item.id))||selectedItems.get(dock.id) === item.id);
      layer.classList.toggle('is-hidden-layer', !item.visible);
      layer.classList.toggle('is-locked', item.locked);
      positionLayer(layer, dock, displayItem);
      if (variant && rendererPages[item.overlayKind]) {
        const url=buildRendererUrl(item,variant.config,showSampleActivity);
        let frame=layer.querySelector('iframe');
        if(!frame||frame.dataset.rendererUrl!==url){
          frame?.remove();frame=document.createElement('iframe');
          frame.title=`${variant.name} ${overlayLabels[item.overlayKind]} preview`;
          frame.loading='lazy';frame.dataset.rendererUrl=url;frame.src=url;layer.prepend(frame);
        }
        sizeCanvasPreviewFrame(frame,displayItem,variant.config);
      }else{layer.querySelector('iframe')?.remove();}
      let label=layer.querySelector('.dock-layer-label');
      if(!label){label=document.createElement('span');label.className='dock-layer-label';layer.append(label)}
      label.textContent=`${overlayLabels[item.overlayKind]} · ${item.variantName}`;
      if(!layer.querySelector('.dock-layer-resize')){const handle=document.createElement('span');handle.className='dock-layer-resize';handle.dataset.resize='true';handle.setAttribute('aria-hidden','true');layer.append(handle)}
      layer.onpointerdown=event=>beginLayerDrag(event,dock,item,layer,canvas,card);
      if(layer.parentElement!==canvas)canvas.append(layer);
    });
    previousLayers.forEach(layer=>layer.remove());
    appendCanvasCropShades(canvas, dock, previewItems);
    global.requestAnimationFrame?.(() => updateCanvasPreviewScale(canvas, dock.width));
    renderLayerPanel(card, dock);
  }

  function selectedEditable(dock){const ids=selectedLayers.get(dock.id)||new Set([selectedItems.get(dock.id)]);return dock.items.filter(item=>ids.has(item.id)&&!item.locked);}
  async function commitCanvasTools(card,dock,next,message){
    setBusy(true);
    try{const result=await cloud.restoreDockLayout(dock.id,{width:dock.width,height:dock.height,items:next,expectedItems:dock.items,expectedWidth:dock.width,expectedHeight:dock.height});Object.assign(dock,result.dock);rememberCanvas(dock);renderComposer(card,dock);setStatus(message+' · saved to the live canvas');}
    catch(error){setStatus(error.message,true);}finally{setBusy(false);}
  }
  function initializeCanvasTools(card,dock,canvas){
    if(card.querySelector('.canvas-precision-tools'))return;
    let view={zoom:'fit',grid:false,safe:false,snap:false};try{view={...view,...JSON.parse(localStorage.getItem('kg-canvas-view:'+dock.id)||'{}')};}catch{}canvasViews.set(dock.id,view);
    const tools=makeElement('div','canvas-precision-tools');
    tools.innerHTML='<p>Ctrl/Cmd-click layers to select several. Arrow keys move unlocked selections; Shift moves 10 px. Edits update your live canvas.</p><div class="canvas-view-controls" role="group" aria-label="Canvas view tools"><strong>View only</strong><label>Zoom<select data-canvas-zoom><option value="fit">Fit</option><option value="0.5">50%</option><option value="1">100%</option></select></label><label><input type="checkbox" data-canvas-grid> Grid</label><label><input type="checkbox" data-canvas-safe> Safe area</label><label><input type="checkbox" data-canvas-snap> Snap to edges / centre</label></div><div class="canvas-layout-controls" role="group" aria-label="Live canvas layout"><strong>Live layout · updates your stream</strong><label>Align to<select data-align-target><option value="canvas">Canvas</option><option value="selection">Selection</option></select></label></div><div class="canvas-align-actions">'+[['left','Left'],['center','Centre horizontally'],['right','Right'],['top','Top'],['middle','Centre vertically'],['bottom','Bottom'],['horizontal','Distribute horizontally'],['vertical','Distribute vertically']].map(([action,label])=>'<button type="button" data-canvas-align="'+action+'">'+label+'</button>').join('')+'</div>';
    canvas.closest('.dock-canvas-viewport').before(tools);
    const guide=makeElement('div','dock-editor-guides');guide.setAttribute('aria-hidden','true');guide.innerHTML='<span class="canvas-safe-area"></span><span class="canvas-centre-x"></span><span class="canvas-centre-y"></span>';canvas.append(guide);
    canvas.tabIndex=0;canvas.setAttribute('role','region');canvas.setAttribute('aria-label','Canvas. Arrow keys move selected unlocked layers. Shift moves ten pixels.');
    function apply(){canvas.classList.toggle('has-grid',view.grid);canvas.classList.toggle('has-safe-area',view.safe);canvas.classList.toggle('has-snap',view.snap);canvas.dataset.snap=String(view.snap);try{localStorage.setItem('kg-canvas-view:'+dock.id,JSON.stringify(view));}catch{}}
    tools.querySelector('[data-canvas-zoom]').value=view.zoom;
    tools.querySelector('[data-canvas-zoom]').onchange=event=>{view.zoom=event.target.value;apply();renderComposer(card,dock);};
    for(const option of ['grid','safe','snap']){const input=tools.querySelector('[data-canvas-'+option+']');input.checked=view[option];input.onchange=()=>{view[option]=input.checked;apply();};}apply();
    tools.querySelectorAll('[data-canvas-align]').forEach(button=>button.onclick=()=>{
      const selected=selectedEditable(dock);if(!selected.length)return setStatus('Select an unlocked layer first.',true);
      const next=dock.items.map(item=>({...item})),ids=new Set(selected.map(item=>item.id)),action=button.dataset.canvasAlign;
      if(action==='horizontal'||action==='vertical'){
        if(selected.length<3)return setStatus('Select at least three unlocked layers to distribute.',true);
        const key=action==='horizontal'?'x':'y',size=key==='x'?'width':'height',sorted=[...selected].sort((a,b)=>a[key]-b[key]),start=sorted[0][key],end=sorted.at(-1)[key]+sorted.at(-1)[size],space=(end-start-selected.reduce((sum,item)=>sum+item[size],0))/(selected.length-1);
        if(space<0)return setStatus('Spread the first and last layers further apart before distributing.',true);
        let position=start;for(const item of sorted){next.find(value=>value.id===item.id)[key]=Math.round(position);position+=item[size]+space;}
      }else{
        const own=tools.querySelector('[data-align-target]').value==='selection';
        const bounds=own?{left:Math.min(...selected.map(i=>i.x)),top:Math.min(...selected.map(i=>i.y)),right:Math.max(...selected.map(i=>i.x+i.width)),bottom:Math.max(...selected.map(i=>i.y+i.height))}:{left:0,top:0,right:dock.width,bottom:dock.height};
        for(const item of next.filter(item=>ids.has(item.id))){if(action==='left')item.x=bounds.left;if(action==='center')item.x=Math.round((bounds.left+bounds.right-item.width)/2);if(action==='right')item.x=bounds.right-item.width;if(action==='top')item.y=bounds.top;if(action==='middle')item.y=Math.round((bounds.top+bounds.bottom-item.height)/2);if(action==='bottom')item.y=bounds.bottom-item.height;}
      }
      commitCanvasTools(card,dock,next,button.textContent);
    });
    let nudgeTimer=0,pending=null,committing=false;
    canvas.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||event.target!==canvas||committing)return;
      event.preventDefault();const selected=selectedEditable(dock);if(!selected.length)return;
      pending??=dock.items.map(item=>({...item}));const ids=new Set(selected.map(item=>item.id)),step=event.shiftKey?10:1;
      for(const item of pending.filter(item=>ids.has(item.id))){item.x=clampLayerPosition(item.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),item.width,dock.width);item.y=clampLayerPosition(item.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0),item.height,dock.height);const layer=[...canvas.querySelectorAll('.dock-canvas-layer')].find(layer=>layer.dataset.itemId===item.id);if(layer)positionLayer(layer,dock,item);}
      clearTimeout(nudgeTimer);nudgeTimer=setTimeout(async()=>{const next=pending;pending=null;committing=true;await commitCanvasTools(card,dock,next,'Moved selection');committing=false;canvas.focus({preventScroll:true});},160);
    });
  }

  function appendCanvasCropShades(canvas, dock, items) {
    updateCanvasCropShadeBounds(canvas, dock, items);
    ['top', 'right', 'bottom', 'left'].forEach(edge => {
      const shade = document.createElement('span');
      shade.className = `dock-canvas-overhang-shade is-${edge}`;
      shade.setAttribute('aria-hidden', 'true');
      canvas.append(shade);
    });
  }

  function updateCanvasCropShadeBounds(canvas, dock, items) {
    const overhang = items.reduce((largest, item) => ({
      top: Math.max(largest.top, -Number(item.y)),
      right: Math.max(largest.right, Number(item.x) + Number(item.width) - Number(dock.width)),
      bottom: Math.max(largest.bottom, Number(item.y) + Number(item.height) - Number(dock.height)),
      left: Math.max(largest.left, -Number(item.x))
    }), { top: 0, right: 0, bottom: 0, left: 0 });
    canvas.style.setProperty('--dock-overhang-top', `${overhang.top / dock.height * 100}%`);
    canvas.style.setProperty('--dock-overhang-right', `${overhang.right / dock.width * 100}%`);
    canvas.style.setProperty('--dock-overhang-bottom', `${overhang.bottom / dock.height * 100}%`);
    canvas.style.setProperty('--dock-overhang-left', `${overhang.left / dock.width * 100}%`);
  }

  function getCanvasPreviewItems(dock) {
    return dock.items.map(item => {
      const variant = variants.find(entry => entry.id === item.variantId);
      return variant ? withUniformScale(item, getNaturalOverlaySize(item.overlayKind, variant.config)) : item;
    });
  }

  function renderLayerPanel(card, dock) {
    const panel = card.querySelector('[data-role="layer-panel"]');
    panel.innerHTML = '';
    const heading = makeElement('div', 'dock-layer-panel-heading');
    heading.append(makeElement('strong', '', 'Overlay layers'), makeElement('span', '', String(dock.items.length)));
    const h=canvasHistories.get(dock.id);
    for(const [label,direction] of [['Undo',-1],['Redo',1]]){const control=makeElement('button','',label);control.type='button';control.disabled=!h||!h.steps[h.at+direction];control.onclick=()=>travelCanvas(dock,card,direction);heading.append(control);}
    panel.append(heading, makeElement('p', 'dock-layer-order-hint', 'Top appears in front · Drag or use the order buttons'));


    if (!dock.items.length) {
      panel.append(makeElement('p', 'dock-layer-panel-empty', variants.length ? 'Choose a variant above and add your first overlay.' : 'Save a design in the Overlay Editor first.'));
      return;
    }

    const layers = makeElement('div', 'dock-layer-list');
    getLayerStack(dock).forEach(item => {
      const button = makeElement('button', `dock-layer-list-item${selectedItems.get(dock.id) === item.id ? ' is-active' : ''}`);
      button.type = 'button';
      button.setAttribute('aria-pressed',String(selectedLayers.get(dock.id)?.has(item.id)||selectedItems.get(dock.id)===item.id));
      button.draggable = dock.items.length > 1;
      button.dataset.action = 'select-item';
      button.dataset.itemId = item.id;
      button.title = dock.items.length > 1 ? 'Drag to reorder. Top layers appear in front.' : 'This is the only layer.';
      button.append(makeElement('span', 'dock-layer-visibility', item.visible ? '●' : '○'));
      const text = makeElement('span');
      text.append(makeElement('strong', '', overlayLabels[item.overlayKind]), makeElement('small', '', item.variantName));
      const grip = makeElement('span', 'dock-layer-grip', '⠿');
      grip.setAttribute('aria-hidden', 'true');
      button.append(text, grip);
      button.addEventListener('dragstart', event => beginLayerOrderDrag(event, item, button));
      button.addEventListener('dragover', event => previewLayerOrderDrop(event, item, button));
      button.addEventListener('dragleave', event => clearLayerDropTarget(event, button));
      button.addEventListener('drop', event => dropLayerOrder(event, dock, card, item));
      button.addEventListener('dragend', () => clearLayerOrderDrag(card));
      layers.append(button);
    });
    panel.append(layers);

    let selected = dock.items.find(item => item.id === selectedItems.get(dock.id));
    if (!selected) {
      selected = dock.items[0];
      selectedItems.set(dock.id, selected.id);
    }
    panel.append(buildInspector(selected, dock, card));
  }

  function buildInspector(item, dock, card) {
    const inspector = makeElement('div', 'dock-layer-inspector');
    inspector.dataset.itemId = item.id;
    inspector.append(makeElement('span', 'dock-panel-kicker', 'Selected layer'));
    const variantLabel = makeElement('label', 'dock-field');
    variantLabel.append(makeElement('span', '', 'Variant'));
    const variantSelect = document.createElement('select');
    variantSelect.dataset.itemField = 'variantId';
    variantSelect.dataset.currentVariantId=item.variantId;
    populateVariantSelect(variantSelect, '', item.overlayKind);
    variantSelect.value = item.variantId;
    variantLabel.append(variantSelect);
    const kindLabel = makeElement('label', 'dock-field');
    kindLabel.append(makeElement('span', '', 'Overlay type'));
    const kindSelect = document.createElement('select');
    kindSelect.dataset.itemField = 'overlayKind';
    Object.entries(overlayLabels).forEach(([value, label]) => kindSelect.add(new Option(label, value)));
    kindSelect.value = item.overlayKind;
    kindSelect.addEventListener('change', () => {
      populateVariantSelect(variantSelect, 'Choose a matching variant', kindSelect.value);
    });
    kindLabel.append(kindSelect);
    inspector.append(variantLabel, kindLabel);
    const order=makeElement('div','dock-layer-order-buttons');
    const stack=getLayerStack(dock),index=stack.findIndex(entry=>entry.id===item.id);
    for(const [label,direction] of [['Bring forward',-1],['Send backward',1]]){
      const button=makeElement('button','',label);button.type='button';button.disabled=!stack[index+direction];
      button.onclick=()=>moveLayerByButton(dock,card,item,direction,label);order.append(button);
    }
    inspector.append(order);

    const geometry = makeElement('div', 'dock-layer-geometry');
    [['x', 'X'], ['y', 'Y']].forEach(([field, label]) => {
      const control = makeElement('label', 'dock-field');
      control.append(makeElement('span', '', label));
      const input = document.createElement('input');
      input.type = 'number';
      input.dataset.itemField = field;
      input.value = item[field];
      control.append(input);
      geometry.append(control);
    });
    const natural = getNaturalOverlaySize(item.overlayKind, getVariantConfig(item.variantId));
    const bounds = getScaleBounds(natural, dock);
    const scale = clamp(getUniformScale(item, natural), bounds.min, bounds.max);
    const scaleControl = makeElement('label', 'dock-field dock-scale-field');
    scaleControl.append(makeElement('span', '', 'Scale (%)'));
    const scaleInput = document.createElement('input');
    scaleInput.type = 'number';
    const minimumPercent = Math.max(1, Math.floor(bounds.min * 100));
    const maximumPercent = Math.max(minimumPercent, Math.ceil(bounds.max * 100));
    scaleInput.min = String(minimumPercent);
    scaleInput.max = String(maximumPercent);
    scaleInput.step = '5';
    scaleInput.value = String(Math.round(scale * 100));
    scaleInput.dataset.itemScale = 'true';
    const size = getScaledDimensions(natural, scale);
    const sizeReadout = makeElement('small', 'dock-scale-readout', `${natural.width} × ${natural.height} native → ${size.width} × ${size.height} output`);
    scaleControl.append(scaleInput, sizeReadout);
    geometry.append(scaleControl);
    inspector.append(geometry);
    const toggles = makeElement('div', 'dock-layer-toggles');
    [['visible', 'Visible'], ['locked', 'Lock position']].forEach(([field, label]) => {
      const control = makeElement('label', 'dock-toggle');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.itemField = field;
      input.checked = item[field];
      input.addEventListener('change', () => saveItemToggle(dock, item, field, input.checked, input, card));
      control.append(input, makeElement('span', '', label));
      toggles.append(control);
    });
    inspector.append(toggles);
    const actions = makeElement('div', 'dock-layer-actions');
    const save = makeElement('button', 'btn-success', 'Save Layer');
    save.type = 'button';
    save.dataset.action = 'save-item';
    const remove = makeElement('button', 'btn-danger', 'Remove');
    remove.type = 'button';
    remove.dataset.action = 'delete-item';
    actions.append(save, remove);
    inspector.append(actions);
    return inspector;
  }

  async function handleDockAction(event, dockId, card) {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;
    const dock = docks.find(item => item.id === dockId);
    if (!dock) return;

    if (action === 'toggle-editor') {
      expandedDockIds.has(dockId) ? expandedDockIds.delete(dockId) : expandedDockIds.add(dockId);
      const expanded=expandedDockIds.has(dockId);
      card.querySelector('[data-role="composer"]').hidden=!expanded;
      trigger.setAttribute('aria-expanded',String(expanded));
      if(expanded)renderComposer(card,dock);
      else card.querySelectorAll('.dock-canvas-layer iframe').forEach(frame=>frame.remove());
      return;
    }
    if (action === 'select-item') {
      if (Date.now() < suppressLayerClickUntil) return;
      if(event.shiftKey||event.ctrlKey||event.metaKey){const selected=selectedLayers.get(dockId)||new Set([selectedItems.get(dockId)]);selected.has(trigger.dataset.itemId)?selected.delete(trigger.dataset.itemId):selected.add(trigger.dataset.itemId);selectedLayers.set(dockId,selected);}else selectedLayers.set(dockId,new Set([trigger.dataset.itemId]));
      selectedItems.set(dockId, trigger.dataset.itemId);
      const keyboard=event.detail===0;
      renderComposer(card, dock);
      if(keyboard)card.querySelector('.dock-layer-list-item.is-active')?.focus({preventScroll:true});
      return;
    }
    if (action === 'copy') {
      await copyText(card.querySelector('[data-role="url"]').value);
      setStatus(`Copied ${dock.name} Browser Source URL`);
      showCopyDimensions(dock);
      return;
    }
    if (action === 'open') {
      global.open(card.querySelector('[data-role="url"]').value, '_blank', 'noopener');
      return;
    }
    if (action === 'add-item') return addDockItem(dock, card);
    if (action === 'save-item') return saveDockItem(dock, card);
    if (action === 'delete-item') return deleteDockItem(dock, card);
    if (action === 'delete' && !confirm(`Delete canvas "${dock.name}"? Its Browser Source URL will stop working.`)) return;
    if (action === 'rotate' && !confirm(`Rotate the URL for "${dock.name}"? You will need to replace its URL in your streaming software once.`)) return;

    setBusy(true);
    try {
      if (action === 'save-output') {
        const result = await cloud.updateDock(dockId, readDockCard(card));
        replaceDock(result.dock);rememberCanvas(result.dock);
        setStatus(`Saved ${result.dock.name}; its Browser Source output will update automatically`);
      } else if (action === 'rotate') {
        const result = await cloud.rotateDockToken(dockId);
        replaceDock(result.dock);
        setStatus(`Rotated ${result.dock.name}; replace its Browser Source URL in your streaming software`);
      } else if (action === 'delete') {
        await cloud.deleteDock(dockId);
        docks = docks.filter(item => item.id !== dockId);
        expandedDockIds.delete(dockId);
        setStatus(`Deleted ${dock.name}`);
      }
      renderDocks();
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  function showCopyDimensions(dock) {
    copyWidth.textContent = String(dock.width);
    copyHeight.textContent = String(dock.height);
    if (typeof copyDialog.showModal === 'function') {
      copyDialog.showModal();
    } else {
      alert(`Link copied. Set your Browser or Link source to ${dock.width} × ${dock.height}. The width and height must match this output.`);
    }
  }

  async function addDockItem(dock, card) {
    const variantId = card.querySelector('[data-role="add-variant"]').value;
    const overlayKind = card.querySelector('[data-role="add-kind"]').value;
    if (!variantId) {
      setStatus('Choose a saved design before adding an overlay', true);
      return;
    }
    setBusy(true);
    try {
      const result = await cloud.createDockItem(dock.id, { variantId, overlayKind });
      dock.items.push(result.item);rememberCanvas(dock);
      selectedItems.set(dock.id, result.item.id);
      renderDocks();
      setStatus(`Added ${overlayLabels[overlayKind]} to ${dock.name}`);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function saveSampleActivity(dock, enabled) {
    if (savingSampleActivity.has(dock.id)) return;
    const previous = Boolean(dock.sampleActivity);
    dock.sampleActivity = enabled;
    savingSampleActivity.add(dock.id);
    renderDocks();
    try {
      const result = await cloud.updateDock(dock.id, { sampleActivity: enabled });
      replaceDock(result.dock);
      setStatus(enabled
        ? `Showing sample activity in ${result.dock.name}'s Browser Source`
        : `${result.dock.name} is live and listening for activity`);
    } catch (error) {
      dock.sampleActivity = previous;
      setStatus(error.message, true);
    } finally {
      savingSampleActivity.delete(dock.id);
      renderDocks();
    }
  }

  async function saveItemToggle(dock, item, field, enabled, input, card) {
    const previous = Boolean(item[field]);
    item[field] = enabled;
    input.disabled = true;
    const layer = [...card.querySelectorAll('.dock-canvas-layer')].find(entry => entry.dataset.itemId === item.id);
    layer?.classList.toggle(field === 'locked' ? 'is-locked' : 'is-hidden-layer', field === 'visible' ? !enabled : enabled);
    try {
      const result = await cloud.updateDockItem(dock.id, item.id, { [field]: enabled });
      replaceDockItem(dock, result.item);rememberCanvas(dock);
      setStatus(`${field === 'locked' ? 'Position lock' : 'Visibility'} ${enabled ? 'enabled' : 'disabled'} for ${item.variantName}`);
    } catch (error) {
      item[field] = previous;
      setStatus(error.message, true);
    } finally {
      renderComposer(card, dock);
    }
  }

  async function saveDockItem(dock, card) {
    const inspector = card.querySelector('.dock-layer-inspector');
    if (!inspector) return;
    const itemId = inspector.dataset.itemId;
    const input = {};
    inspector.querySelectorAll('[data-item-field]').forEach(control => {
      input[control.dataset.itemField] = control.type === 'checkbox' ? control.checked : control.value;
    });
    const natural = getNaturalOverlaySize(input.overlayKind, getVariantConfig(input.variantId));
    const bounds = getScaleBounds(natural, dock);
    const scale = clamp(Number(inspector.querySelector('[data-item-scale]')?.value) / 100 || 1, bounds.min, bounds.max);
    const size = getScaledDimensions(natural, scale);
    input.width = size.width;
    input.height = size.height;
    setBusy(true);
    try {
      const result = await cloud.updateDockItem(dock.id, itemId, input);
      replaceDockItem(dock, result.item);rememberCanvas(dock);
      renderDocks();
      setStatus(`Saved overlay layer in ${dock.name}`);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDockItem(dock, card) {
    const itemId = card.querySelector('.dock-layer-inspector')?.dataset.itemId;
    const item = dock.items.find(entry => entry.id === itemId);
    if (!item || !confirm(`Remove ${overlayLabels[item.overlayKind]} from ${dock.name}?`)) return;
    setBusy(true);
    try {
      await cloud.deleteDockItem(dock.id, itemId);
      dock.items = dock.items.filter(entry => entry.id !== itemId);rememberCanvas(dock);
      selectedItems.delete(dock.id);
      renderDocks();
      setStatus(`Removed overlay from ${dock.name}`);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  function getLayerStack(dock) {
    return [...dock.items].sort((a, b) => b.zIndex - a.zIndex);
  }

  function reorderLayerStack(items, sourceId, targetId, after) {
    const sourceItem = items.find(item => item.id === sourceId);
    const targetItem = items.find(item => item.id === targetId);
    if (!sourceItem || !targetItem || sourceId === targetId) return [...items].sort((a, b) => b.zIndex - a.zIndex);
    const stack = [...items].sort((a, b) => b.zIndex - a.zIndex).filter(item => item.id !== sourceId);
    const targetIndex = stack.findIndex(item => item.id === targetId);
    stack.splice(targetIndex + (after ? 1 : 0), 0, sourceItem);
    return stack.map((item, index) => ({ ...item, zIndex: stack.length - index - 1 }));
  }

  async function moveLayerByButton(dock,card,item,direction,label){
    const stack=getLayerStack(dock),index=stack.findIndex(entry=>entry.id===item.id),target=stack[index+direction];if(!target)return;
    await persistLayerOrder(dock,card,item,reorderLayerStack(dock.items,item.id,target.id,direction>0));
    const focus=[...card.querySelectorAll('.dock-layer-order-buttons button')].find(button=>button.textContent===label&&!button.disabled);
    (focus||card.querySelector('.dock-layer-list-item.is-active'))?.focus({preventScroll:true});
  }

  function beginLayerOrderDrag(event, item, button) {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.id);
    button.classList.add('is-dragging');
  }

  function previewLayerOrderDrop(event, targetItem, button) {
    if (!event.dataTransfer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const sourceId = event.dataTransfer.getData('text/plain');
    if (sourceId && sourceId === targetItem.id) return;
    const after = event.clientY >= button.getBoundingClientRect().top + (button.offsetHeight / 2);
    button.classList.toggle('is-drop-before', !after);
    button.classList.toggle('is-drop-after', after);
  }

  function clearLayerDropTarget(event, button) {
    if (event.relatedTarget && button.contains(event.relatedTarget)) return;
    button.classList.remove('is-drop-before', 'is-drop-after');
  }

  function clearLayerOrderDrag(card) {
    card.querySelectorAll('.dock-layer-list-item').forEach(button => {
      button.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
    });
  }

  async function dropLayerOrder(event, dock, card, targetItem) {
    event.preventDefault();
    const sourceId = event.dataTransfer?.getData('text/plain') || '';
    const sourceItem = dock.items.find(item => item.id === sourceId);
    clearLayerOrderDrag(card);
    if (!sourceItem || sourceItem.id === targetItem.id) return;

    const targetButton = event.currentTarget;
    const after = event.clientY >= targetButton.getBoundingClientRect().top + (targetButton.offsetHeight / 2);
    const stack = reorderLayerStack(dock.items, sourceId, targetItem.id, after);
    return persistLayerOrder(dock,card,sourceItem,stack);
  }

  async function persistLayerOrder(dock,card,sourceItem,stack) {
    const nextZIndexes = new Map(stack.map(item => [item.id, item.zIndex]));
    const changes = dock.items
      .filter(item => item.zIndex !== nextZIndexes.get(item.id))
      .map(item => ({ item, zIndex: nextZIndexes.get(item.id) }));
    if (!changes.length) return;

    dock.items = dock.items.map(item => ({ ...item, zIndex: nextZIndexes.get(item.id) }));
    selectedItems.set(dock.id, sourceItem.id);
    suppressLayerClickUntil = Date.now() + 250;
    renderComposer(card, dock);
    setBusy(true);
    try {
      const results = await Promise.all(changes.map(change => cloud.updateDockItem(dock.id, change.item.id, { zIndex: change.zIndex })));
      results.forEach(result => replaceDockItem(dock, result.item));rememberCanvas(dock);
      renderComposer(card, dock);
      setStatus(`Layer order saved in ${dock.name}; top appears in front`);
    } catch (error) {
      setStatus(error.message, true);
      await loadManagerData();
    } finally {
      setBusy(false);
    }
  }

  function beginLayerDrag(event, dock, item, layer, canvas, card) {
    if (event.button !== 0) return;
    event.preventDefault();
    if(event.ctrlKey||event.metaKey){const selected=selectedLayers.get(dock.id)||new Set([selectedItems.get(dock.id)]);selected.has(item.id)?selected.delete(item.id):selected.add(item.id);selectedLayers.set(dock.id,selected);selectedItems.set(dock.id,item.id);renderComposer(card,dock);canvas.focus({preventScroll:true});return;}
    if(!selectedLayers.get(dock.id)?.has(item.id))selectedLayers.set(dock.id,new Set([item.id]));
    selectedItems.set(dock.id, item.id);canvas.focus({preventScroll:true});
    if (item.locked) {
      renderComposer(card, dock);
      return;
    }
    const resizing = Boolean(event.target.closest('[data-resize]'));
    const expectedBefore=JSON.parse(JSON.stringify(dock.items));
    const movingGroup=resizing?[]:selectedEditable(dock).map(value=>({item:value,x:value.x,y:value.y,layer:[...canvas.querySelectorAll('.dock-canvas-layer')].find(layer=>layer.dataset.itemId===value.id)}));
    if(resizing)selectedLayers.set(dock.id,new Set([item.id]));
    const rect = canvas.getBoundingClientRect();
    const scaleX = dock.width / rect.width;
    const scaleY = dock.height / rect.height;
    const natural = getNaturalOverlaySize(item.overlayKind, getVariantConfig(item.variantId));
    const startScale = getUniformScale(item, natural);
    const startSize = getScaledDimensions(natural, startScale);
    item.width = startSize.width;
    item.height = startSize.height;
    const start = { clientX: event.clientX, clientY: event.clientY, x: item.x, y: item.y, width: item.width, height: item.height, scale: startScale };
    const frame = layer.querySelector('iframe');
    let paintFrame = 0;
    canvas.classList.add('is-interacting');
    layer.classList.add('is-dragging');

    const paint = () => {
      paintFrame = 0;
      if (resizing) {
        if (frame) sizeCanvasPreviewFrame(frame, item);
        positionLayer(layer, dock, item);
        return;
      }
      const translateX = (item.x - start.x) / scaleX;
      const translateY = (item.y - start.y) / scaleY;
      layer.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
      if(movingGroup.length>1)for(const entry of movingGroup)if(entry.layer)entry.layer.style.transform=`translate3d(${translateX}px, ${translateY}px, 0)`;
    };

    const schedulePaint = () => {
      if (paintFrame) return;
      if (typeof global.requestAnimationFrame === 'function') {
        paintFrame = global.requestAnimationFrame(paint);
      } else {
        paint();
      }
    };

    const move = moveEvent => {
      const dx = Math.round((moveEvent.clientX - start.clientX) * scaleX);
      const dy = Math.round((moveEvent.clientY - start.clientY) * scaleY);
      if (resizing) {
        const bounds = getScaleBounds(natural, { width: dock.width - item.x, height: dock.height - item.y });
        const horizontalChange = dx / natural.width;
        const verticalChange = dy / natural.height;
        const scaleChange = Math.abs(horizontalChange) >= Math.abs(verticalChange) ? horizontalChange : verticalChange;
        const nextScale = clamp(start.scale + scaleChange, bounds.min, bounds.max);
        const size = getScaledDimensions(natural, nextScale);
        item.width = size.width;
        item.height = size.height;
      } else {
        const freeX = clampLayerPosition(start.x + dx, item.width, dock.width);
        const freeY = clampLayerPosition(start.y + dy, item.height, dock.height);
        item.x = (moveEvent.shiftKey||canvas.dataset.snap==='true') ? snapLayerPosition(freeX, item.width, dock.width, 14 * scaleX) : freeX;
        item.y = (moveEvent.shiftKey||canvas.dataset.snap==='true') ? snapLayerPosition(freeY, item.height, dock.height, 14 * scaleY) : freeY;
        if(movingGroup.length>1){
          const dx=clamp(item.x-start.x,Math.max(...movingGroup.map(entry=>-entry.item.width-entry.x)),Math.min(...movingGroup.map(entry=>dock.width-entry.x)));
          const dy=clamp(item.y-start.y,Math.max(...movingGroup.map(entry=>-entry.item.height-entry.y)),Math.min(...movingGroup.map(entry=>dock.height-entry.y)));
          for(const entry of movingGroup){entry.item.x=entry.x+dx;entry.item.y=entry.y+dy;}
        }
      }
      schedulePaint();
    };
    const finish = async () => {
      global.removeEventListener('pointermove', move);
      global.removeEventListener('pointerup', finish);
      if (paintFrame && typeof global.cancelAnimationFrame === 'function') global.cancelAnimationFrame(paintFrame);
      paintFrame = 0;
      paint();
      canvas.classList.remove('is-interacting');
      layer.classList.remove('is-dragging');
      updateCanvasCropShadeBounds(canvas, dock, getCanvasPreviewItems(dock));
      if(movingGroup.length>1)setBusy(true);
      try {
        if(movingGroup.length>1){
          const result=await cloud.restoreDockLayout(dock.id,{width:dock.width,height:dock.height,items:dock.items,expectedItems:expectedBefore,expectedWidth:dock.width,expectedHeight:dock.height});
          Object.assign(dock,result.dock);for(const entry of movingGroup)if(entry.layer)entry.layer.style.transform='';rememberCanvas(dock);renderComposer(card,dock);setStatus('Position saved for '+movingGroup.length+' layers in '+dock.name);return;
        }
        const result = await cloud.updateDockItem(dock.id, item.id, { x: item.x, y: item.y, width: item.width, height: item.height });
        Object.assign(item, result.item);rememberCanvas(dock);
        layer.style.transform = '';
        positionLayer(layer, dock, item);
        if (frame) sizeCanvasPreviewFrame(frame, item);
        syncInspectorGeometry(card, dock, item);
        updateCanvasCropShadeBounds(canvas, dock, getCanvasPreviewItems(dock));
        setStatus(`Position saved in ${dock.name}`);
      } catch (error) {
        setStatus(error.message, true);
        await loadManagerData();setStatus(error.message,true);
      }finally{if(movingGroup.length>1)setBusy(false);}
    };
    global.addEventListener('pointermove', move);
    global.addEventListener('pointerup', finish, { once: true });
  }

  function syncInspectorGeometry(card, dock, item) {
    const inspector = card.querySelector(`.dock-layer-inspector[data-item-id="${item.id}"]`);
    if (!inspector) return;
    ['x', 'y'].forEach(field => {
      const input = inspector.querySelector(`[data-item-field="${field}"]`);
      if (input) input.value = item[field];
    });
    const natural = getNaturalOverlaySize(item.overlayKind, getVariantConfig(item.variantId));
    const scale = getUniformScale(item, natural);
    const scaleInput = inspector.querySelector('[data-item-scale]');
    if (scaleInput) scaleInput.value = String(Math.round(scale * 100));
    const readout = inspector.querySelector('.dock-scale-readout');
    if (readout) readout.textContent = `${natural.width} × ${natural.height} native → ${item.width} × ${item.height} output`;
  }

  function positionLayer(layer, dock, item) {
    layer.style.left = `${item.x / dock.width * 100}%`;
    layer.style.top = `${item.y / dock.height * 100}%`;
    layer.style.width = `${item.width / dock.width * 100}%`;
    layer.style.height = `${item.height / dock.height * 100}%`;
    layer.style.zIndex = String(item.zIndex + 1);
  }

  function sizeCanvasPreviewFrame(frame, item, config = null) {
    const natural = config
      ? getNaturalOverlaySize(item.overlayKind, config)
      : { width: Number(frame.dataset.naturalWidth), height: Number(frame.dataset.naturalHeight) };
    const overscan = global.KGGraphics?.definition(item.overlayKind,config)?0:config ? getRendererOverscan(item.overlayKind) : Number(frame.dataset.overscan) || 0;
    frame.dataset.naturalWidth = String(natural.width);
    frame.dataset.naturalHeight = String(natural.height);
    frame.dataset.overscan = String(overscan);
    frame.dataset.targetWidth = String(item.width);
    frame.dataset.targetHeight = String(item.height);
    frame.style.width = `${natural.width + (overscan * 2)}px`;
    frame.style.height = `${natural.height + (overscan * 2)}px`;
    applyCanvasPreviewFrameScale(frame);
  }

  function updateCanvasPreviewScale(canvas, outputWidth = Number(canvas.dataset.outputWidth)) {
    if (!canvas || !outputWidth) return;
    const scale = canvas.clientWidth / outputWidth;
    if (scale > 0) {
      canvas.dataset.previewScale = String(scale);
      canvas.querySelectorAll('.dock-canvas-layer iframe').forEach(applyCanvasPreviewFrameScale);
    }
  }

  function applyCanvasPreviewFrameScale(frame) {
    const canvasScale = Number(frame.closest('.dock-layout-canvas')?.dataset.previewScale) || 1;
    const naturalWidth = Number(frame.dataset.naturalWidth) || 1;
    const naturalHeight = Number(frame.dataset.naturalHeight) || 1;
    const targetWidth = Number(frame.dataset.targetWidth) || naturalWidth;
    const targetHeight = Number(frame.dataset.targetHeight) || naturalHeight;
    const overscan = Number(frame.dataset.overscan) || 0;
    const layerScale = Math.min(targetWidth / naturalWidth, targetHeight / naturalHeight);
    frame.style.transform = `scale(${canvasScale * layerScale}) translate(-${overscan}px, -${overscan}px)`;
  }

  function updateAllCanvasPreviewScales() {
    const measured=[...document.querySelectorAll('.dock-layout-canvas[data-output-width]')].filter(canvas=>!canvas.closest('[hidden]')).map(canvas=>({canvas,scale:canvas.clientWidth/Number(canvas.dataset.outputWidth)}));
    measured.forEach(({canvas,scale})=>{if(scale>0&&Number(canvas.dataset.previewScale)!==scale){canvas.dataset.previewScale=String(scale);canvas.querySelectorAll('.dock-canvas-layer iframe').forEach(applyCanvasPreviewFrameScale)}});
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

  function getVariantConfig(variantId) {
    return variants.find(variant => variant.id === variantId)?.config || {};
  }

  function getUniformScale(item, natural) {
    const widthScale = Number(item.width) / natural.width;
    const heightScale = Number(item.height) / natural.height;
    const scales = [widthScale, heightScale].filter(value => Number.isFinite(value) && value > 0);
    if (item?.overlayKind === 'rows' && Number.isFinite(widthScale) && widthScale > 0) return widthScale;
    return scales.length ? Math.min(...scales) : 1;
  }

  function getScaledDimensions(natural, scale) {
    return {
      width: Math.max(1, Math.round(natural.width * scale)),
      height: Math.max(1, Math.round(natural.height * scale))
    };
  }

  function withUniformScale(item, natural) {
    return { ...item, ...getScaledDimensions(natural, getUniformScale(item, natural)) };
  }

  function getScaleBounds(natural, area) {
    const max = Math.max(0.01, Math.min(Number(area.width) / natural.width, Number(area.height) / natural.height, 20));
    const desiredMin = Math.max(32 / natural.width, 24 / natural.height, 0.05);
    return { min: Math.min(desiredMin, max), max };
  }

  function previewInspectorScale(event, dock, card) {
    if (!event.target.matches('[data-item-scale]')) return;
    const inspector = event.target.closest('.dock-layer-inspector');
    const item = dock.items.find(entry => entry.id === inspector?.dataset.itemId);
    const layer = [...card.querySelectorAll('.dock-canvas-layer')].find(entry => entry.dataset.itemId === item?.id);
    if (!item || !layer) return;
    const natural = getNaturalOverlaySize(item.overlayKind, getVariantConfig(item.variantId));
    const bounds = getScaleBounds(natural, dock);
    const enteredScale = Number(event.target.value) / 100;
    if (!Number.isFinite(enteredScale) || enteredScale <= 0) return;
    const scale = clamp(enteredScale, bounds.min, bounds.max);
    const previewItem = { ...item, ...getScaledDimensions(natural, scale) };
    positionLayer(layer, dock, previewItem);
    const frame = layer.querySelector('iframe');
    if (frame) sizeCanvasPreviewFrame(frame, previewItem);
    const readout = inspector.querySelector('.dock-scale-readout');
    if (readout) readout.textContent = `${natural.width} × ${natural.height} native → ${previewItem.width} × ${previewItem.height} output`;
  }

  function buildRendererUrl(item, config, showSampleActivity = true) {
    const url = new URL(global.KGGraphics?.definition(item.overlayKind,config)?'index-graphic.html':rendererPages[item.overlayKind], global.location.href);
    const search = new URLSearchParams({ relay: '1', savedConfig: '0', mute: '1', kind:item.overlayKind, stateKey: `manager:${item.id}` });
    if(global.KGGraphics?.definition(item.overlayKind,config)){search.set('preview','1');search.set('sampleEvents',showSampleActivity?'1':'0');}
    if (showSampleActivity) {
      search.set('preview', '1');
      search.set('editor', '1');
    }
    url.search = search.toString();
    url.hash = `config=${encodeConfig(config)}`;
    return url.toString();
  }

  function encodeConfig(config) {
    const bytes = new TextEncoder().encode(JSON.stringify(config));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function populateVariantSelect(select, placeholder = '', overlayKind = '') {
    select.innerHTML = '';
    if (placeholder) select.add(new Option(placeholder, ''));
    variants
      .filter(variant => (!overlayKind || variant.overlayKind === overlayKind)&&(!variant.archived||variant.id===select.dataset.currentVariantId))
      .forEach(variant => select.add(new Option(`${variant.name}`, variant.id)));
  }

  function readDockCard(card) {
    return {
      name: card.querySelector('[data-field="name"]').value,
      width: card.querySelector('[data-field="width"]').value,
      height: card.querySelector('[data-field="height"]').value
    };
  }

  function replaceDock(nextDock) {
    const current=docks.find(dock=>dock.id===nextDock.id);if(current)Object.assign(current,nextDock);else docks.push(nextDock);
  }

  function replaceDockItem(dock, nextItem) {
    dock.items = dock.items.map(item => item.id === nextItem.id ? nextItem : item);
  }

  function makeElement(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampLayerPosition(value, layerSize, outputSize) {
    return clamp(value, -Math.max(1, Number(layerSize) || 1), Math.max(0, Number(outputSize) || 0));
  }

  function snapLayerPosition(value, layerSize, outputSize, threshold) {
    const candidates = [0, Number(outputSize) - Number(layerSize)];
    const nearest = candidates.reduce((best, candidate) => (
      Math.abs(value - candidate) < Math.abs(value - best) ? candidate : best
    ));
    return Math.abs(value - nearest) <= Math.max(0, Number(threshold) || 0) ? nearest : value;
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const input = document.createElement('textarea');
    input.value = value;
    document.body.append(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    if (!copied) throw new Error('Could not copy URL');
  }

  function setBusy(busy) {
    document.querySelectorAll('button').forEach(button=>{if(busy){if(!button.hasAttribute('data-busy-disabled'))button.dataset.busyDisabled=String(button.disabled);button.disabled=true;}else if(button.hasAttribute('data-busy-disabled')){button.disabled=button.dataset.busyDisabled==='true';delete button.dataset.busyDisabled;}});
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }
})(window);
