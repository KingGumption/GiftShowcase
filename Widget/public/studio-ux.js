/* Editor-only workflow. Selection and view changes never publish or restyle a saved widget. */
(function(global){
  'use strict';
  const editor=global.rewardConfigEditor;if(!editor)return;
  const frames={carousel:'carousel-preview',rows:'rows-preview','side-gifts':'side-gifts-preview',goal:'goal-preview','top-likers':'top-likers-preview'};
  const mobile=matchMedia('(max-width:700px)');
  const selectionDocs=new WeakSet();let selectionRaf=0;
  function cardItems(kind){const config=editor.getConfigForKind(kind);return kind==='carousel'?config.rewards:kind==='rows'?config.rowsOverlay.gifts:kind==='side-gifts'?config.sideGifts.gifts:[];}
  function selectedWorkspace(){return document.querySelector('[data-editor-panel]:not([hidden]) .rows-workspace')||document.querySelector('.rows-workspace:not([hidden])');}
  function focusCard(){if(!mobile.matches)return;const workspace=cardEditorList();workspace.dataset.mobileEditor='card';workspace.querySelector('.rows-inspector')?.scrollIntoView({block:'start',behavior:'instant'});workspace.querySelector('[data-back-to-cards]')?.focus({preventScroll:true});}
  function backToCards(workspace){workspace.dataset.mobileEditor='list';workspace.querySelector('.rows-action.is-selected .rows-action-select')?.focus({preventScroll:false});}
  document.addEventListener('click',event=>{const select=event.target.closest('.rows-action-select');if(select)queueMicrotask(focusCard);},true);
  document.addEventListener('input',event=>{if(event.target.matches('[data-edit="title"]')){const heading=event.target.closest('.rows-inspector')?.querySelector('h3');if(heading)heading.textContent=event.target.value||'Card settings';}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){const workspace=document.querySelector('.rows-workspace[data-mobile-editor="card"]');if(workspace){event.preventDefault();backToCards(workspace);}}});
  function enhanceInspector(){
    document.querySelectorAll('.rows-inspector').forEach(panel=>{
      if(panel.querySelector('[data-back-to-cards]'))return;
      const back=document.createElement('button');back.type='button';back.dataset.backToCards='';back.className='studio-back-to-cards';back.textContent='← Back to cards';back.onclick=()=>backToCards(panel.closest('.rows-workspace'));panel.prepend(back);
      const trigger=panel.querySelector('.rows-trigger-section'),label=panel.querySelector('[data-edit="title"]')?.closest('label');if(trigger&&label)label.before(trigger);
      const heading=panel.querySelector('h3');if(heading&&rowsSelectedGift)heading.textContent=rowsSelectedGift.title||'Card settings';
      const actions=panel.querySelector('.rows-card-options');if(actions)actions.querySelector('summary').textContent='More card options';
    });
    queueSelection();
  }
  for(const id of ['reward-list','rows-gift-list','side-gift-list']){
    const list=document.getElementById(id);if(list)new MutationObserver(enhanceInspector).observe(list,{childList:true,subtree:true});
  }
  function queueSelection(){if(selectionRaf)return;selectionRaf=requestAnimationFrame(()=>{selectionRaf=0;paintSelection();});}
  function paintSelection(){
    const kind=editor.getActiveOverlayKind(),frame=document.getElementById(frames[kind]);if(!frame?.contentDocument)return;
    const index=editor.getSelection(kind);frame.contentDocument.querySelectorAll('[data-studio-card-index]').forEach(tile=>{const selected=Number(tile.dataset.studioCardIndex)===index;tile.classList.toggle('studio-card-selected',selected);tile.setAttribute('aria-pressed',String(selected));});
  }
  function bindPreview(kind,frame){
    const doc=frame.contentDocument;if(!doc?.head||selectionDocs.has(doc))return;selectionDocs.add(doc);
    const style=doc.createElement('style');style.textContent='[data-studio-card-index]{cursor:pointer!important}[data-studio-card-index]:hover{filter:brightness(1.08)}.studio-card-selected{outline:none!important}[data-studio-card-index]:focus-visible{outline:2px solid #ffffff!important;outline-offset:-3px!important}';doc.head.append(style);
    const source=cardItems(kind),enabled=source.map((gift,index)=>({gift,index})).filter(item=>item.gift.enabled!==false);
    let tiles=[];
    if(kind==='carousel')tiles=[...doc.querySelectorAll('[data-reward-index]')];
    else tiles=[...doc.querySelectorAll('[data-editor-card-index]')];
    const seen=new Set();
    for(const tile of tiles){
      const index=kind==='carousel'?enabled[Number(tile.dataset.rewardIndex)]?.index:Number(tile.dataset.editorCardIndex);
      if(!Number.isInteger(index)||!source[index])continue;
      tile.dataset.studioCardIndex=String(index);tile.setAttribute('role','button');tile.setAttribute('aria-label','Edit card: '+source[index].title);
      // Duplicated scrolling tiles share one keyboard stop per source card.
      tile.tabIndex=seen.has(index)?-1:0;seen.add(index);
    }
    function select(event){const tile=event.target.closest('[data-studio-card-index]');if(!tile)return;if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopPropagation();if(editor.getActiveOverlayKind()!==kind)return;
      const nav=document.querySelector('[data-editor-nav="'+(kind==='carousel'?'original':kind)+'"] [data-editor-section-tab="cards"]');nav?.click();editor.selectCard(Number(tile.dataset.studioCardIndex));enhanceInspector();paintSelection();focusCard();if(!mobile.matches)requestAnimationFrame(()=>cardEditorList().querySelector('.rows-action.is-selected')?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'}));
    }
    doc.addEventListener('click',select);doc.addEventListener('keydown',select);queueSelection();
  }
  for(const [kind,id] of Object.entries(frames)){
    const frame=document.getElementById(id),box=frame?.parentElement;if(!frame)continue;
    const section=box.parentElement,rail=section.querySelector('.studio-preview-tools');if(!rail)continue;
    rail.classList.add('studio-preview-rail');rail.setAttribute('role','group');rail.setAttribute('aria-label','Preview controls');
    const test=document.getElementById((kind==='carousel'?'carousel':kind)+'-preview-test');if(test)rail.prepend(test.closest('label'));
    const mute=document.getElementById((kind==='carousel'?'carousel':kind)+'-preview-mute');if(mute)rail.append(mute.closest('label'));
    const footer=section.querySelector('.editor-preview-footer'),choices=footer?.querySelector('.preview-background-choices');if(choices)rail.append(choices);if(footer)footer.hidden=true;rail.append(rail.querySelector('[data-preview-size]'));
    section.querySelector('h2').textContent='Stream preview';
    const helper=document.createElement('p');helper.className='studio-preview-selection-help';helper.textContent=['carousel','rows','side-gifts'].includes(kind)?'Select a card in the preview or the card list to edit it.':'Sample activity is for this preview only.';box.before(helper);
    frame.addEventListener('load',()=>bindPreview(kind,frame));bindPreview(kind,frame);
  }
  global.addEventListener('rewardconfig:tabchanged',()=>{queueSelection();enhanceInspector();});
  global.addEventListener('rewardconfig:changed',queueSelection);enhanceInspector();
  const title=document.querySelector('[data-current-design]');if(title){const button=document.createElement('button');button.type='button';button.dataset.currentDesign='';button.className='studio-design-title';button.textContent=title.textContent;button.title='Rename or name this design';button.setAttribute('aria-label','Rename or name this design');title.replaceWith(button);button.onclick=()=>{if(studioDesigns.selected())document.querySelector('#cloud-rename-variant').click();else studioDesigns.save();};}
  const canvasPlacement=document.querySelector('.studio-canvas-placement'),placementMessage=document.querySelector('#design-placement-status');if(canvasPlacement&&placementMessage)canvasPlacement.append(placementMessage);
  const status=document.querySelector('#cloud-config-status'),summary=document.querySelector('[data-save-summary]');
  if(status&&summary)new MutationObserver(()=>{if(/^Added .+ to .+; arrange/.test(status.textContent)&&canvasPlacement)canvasPlacement.open=false;if(status.classList.contains('is-error'))summary.textContent=document.querySelector('#cloud-retry-session:not([hidden])')?'Connection interrupted · edits kept':'Needs attention · see message below';else if(/Connecting/.test(status.textContent))summary.textContent='Reconnecting to saved designs…';}).observe(status,{childList:true,attributes:true,attributeFilter:['class']});
  const layouts={
    carousel:[['Single card','one',c=>{c.visibleNext=0;}],['Stack','stack',c=>{c.visibleNext=3;}]],
    rows:[['One row','row',c=>{c.rowsOverlay.rows=1;c.rowsOverlay.gifts.forEach(g=>g.row=1);c.rowsOverlay.perRow=String(Math.min(12,c.rowsOverlay.gifts.length)||1);}],['Two rows','rows',c=>{const items=c.rowsOverlay.gifts;c.rowsOverlay.rows=2;const half=Math.max(1,Math.ceil(items.length/2));items.forEach((g,i)=>g.row=i<half?1:2);c.rowsOverlay.perRow=[Math.min(12,half),Math.min(12,Math.max(1,items.length-half))].join(',');}]],
    'side-gifts':[['Both edges','edges',c=>{c.sideGifts.side='both';const half=Math.ceil(c.sideGifts.gifts.length/2);c.sideGifts.gifts.forEach((g,i)=>g.side=i<half?'left':'right');}],['Left edge','left',c=>{c.sideGifts.side='left';c.sideGifts.gifts.forEach(g=>g.side='left');}],['Right edge','right',c=>{c.sideGifts.side='right';c.sideGifts.gifts.forEach(g=>g.side='right');}]],
    goal:[['Compact bar','bar',c=>{c.goalBar.width=720;c.goalBar.height=44;}],['Wide bar','wide',c=>{c.goalBar.width=1080;c.goalBar.height=44;}]],
    'top-likers':[['Name above likes','stack',c=>{c.topLikers.layout='stacked';}],['Likes on right','row',c=>{c.topLikers.layout='inline';}]]
  };
  function thumb(shape){return '<svg viewBox="0 0 120 48" aria-hidden="true">'+({one:'<rect x="44" y="5" width="32" height="38" rx="5"/>',stack:'<rect x="43" y="3" width="34" height="14" rx="4"/><rect x="47" y="21" width="26" height="9" rx="3"/><rect x="49" y="34" width="22" height="8" rx="3"/>',row:'<rect x="6" y="15" width="31" height="20" rx="4"/><rect x="44" y="15" width="31" height="20" rx="4"/><rect x="82" y="15" width="31" height="20" rx="4"/>',rows:'<path d="M8 8h104v13H8Zm0 20h104v13H8Z"/>',edges:'<path d="M8 5h15v38H8Zm89 0h15v38H97Z"/>',left:'<path d="M8 5h15v38H8Z"/>',right:'<path d="M97 5h15v38H97Z"/>',bar:'<rect x="25" y="19" width="70" height="10" rx="4"/>',wide:'<rect x="6" y="19" width="108" height="10" rx="4"/>'}[shape]||'')+'</svg>';}
  for(const [kind,options] of Object.entries(layouts)){
    const tabKind=kind==='carousel'?'original':kind,section=document.querySelector('[data-editor-panel="'+tabKind+'"][data-editor-section="settings"]');if(!section)continue;
    const group=document.createElement('section');group.className='studio-layout-choices';group.innerHTML='<h2>Layout</h2><p>Choose a starting arrangement. Cards, triggers, sounds and colours stay with this design. You can undo the change.</p><div class="studio-layout-grid"></div>';
    for(const [label,shape,apply] of options){const button=document.createElement('button');button.type='button';button.dataset.layoutShape=shape;button.innerHTML=thumb(shape)+'<span>'+label+'</span>';button.onclick=()=>{const config=editor.getConfigForKind(kind);apply(config);editor.loadConfigForKind(kind,config,'Layout changed — unsaved');markDirty();};group.querySelector('div').append(button);}const nav=document.querySelector('[data-editor-nav="'+tabKind+'"]');
      if(!editorSectionChoices.has(tabKind))editorSectionChoices.set(tabKind,nav.querySelector('[aria-selected="true"]')?.dataset.editorSectionTab||'settings');
      const layoutTab=document.createElement('button');layoutTab.type='button';layoutTab.id='editor-tab-'+tabKind+'-layout';layoutTab.dataset.editorSectionTab='layout';layoutTab.setAttribute('role','tab');layoutTab.setAttribute('aria-controls','editor-panel-'+tabKind+'-layout');layoutTab.innerHTML='<span class="editor-tab-icon" aria-hidden="true">'+'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M10 3v18M10 10h11"/></svg>'+'</span>Layout';
      nav.querySelector('[data-editor-section-tab="settings"]').before(layoutTab);
      group.classList.add('config-section');group.dataset.editorPanel=tabKind;group.dataset.editorSection='layout';group.id='editor-panel-'+tabKind+'-layout';group.setAttribute('role','tabpanel');group.setAttribute('aria-labelledby',layoutTab.id);section.before(group);updateEditorSections();
    function updateLayouts(){const c=editor.getConfigForKind(kind);const selected=kind==='carousel'?(c.visibleNext===0?'one':c.visibleNext===3?'stack':''):kind==='rows'?(c.rowsOverlay.rows===1?'row':c.rowsOverlay.rows===2?'rows':''):kind==='side-gifts'?(c.sideGifts.side==='both'?'edges':c.sideGifts.side):kind==='goal'?(c.goalBar.width===720?'bar':c.goalBar.width===1080?'wide':''):(c.topLikers.layout==='inline'?'row':'stack');group.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.layoutShape===selected)));}
    global.addEventListener('studio:designloaded',updateLayouts);global.addEventListener('rewardconfig:changed',updateLayouts);global.addEventListener('rewardconfig:tabchanged',updateLayouts);updateLayouts();
    const style=document.querySelector('[data-editor-panel="'+tabKind+'"][data-editor-section="style"] .studio-look-button');if(style){style.textContent='Choose a Style preset';style.title='Change colours and effects without changing the layout';}
  }
})(window);
