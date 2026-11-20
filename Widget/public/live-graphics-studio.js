(function(g){'use strict';const cloud=g.overlayCloud,G=g.KGGraphics,$=id=>document.getElementById(id),form=$('live-form'),dialog=$('live-dialog'),requested=G.byId[new URLSearchParams(location.search).get('type')];let pageType=requested?.live?requested.id:null;let variants=[],docks=[],selected=null,variant=pageType||'combo',liveState=null,dirty=false,busy=false,pollTimer,draftTimer,leaving=false,previewRevision=0;
 if(top===g&&!new URLSearchParams(location.search).has('embed')){const url=new URL('/studio/',location.origin);url.searchParams.set('overlay',pageType||'combo');const id=new URLSearchParams(location.search).get('design');if(id)url.searchParams.set('design',id);location.replace(url);return;}
 const field={label:'graphic-label',hold:'graphic-hold',duration:'graphic-duration',giftId:'graphic-gift',hp:'graphic-hp',damage:'graphic-damage',damageMode:'graphic-damage-mode',aName:'graphic-a-name',bName:'graphic-b-name',aGift:'graphic-a-gift',bGift:'graphic-b-gift',weight:'graphic-weight',sound:'graphic-sound',volume:'graphic-volume'};
 function status(message,error=false){$('live-status').textContent=message;$('live-status').classList.toggle('error',error);}
 function showDialog(title,build){$('live-dialog-title').textContent=title;$('live-dialog-body').replaceChildren();build($('live-dialog-body'));dialog.showModal();}
 $('live-dialog-close').onclick=()=>dialog.close();
 function confirmAction(title,message,action){showDialog(title,body=>{const p=document.createElement('p');p.textContent=message;const footer=document.createElement('footer'),cancel=document.createElement('button'),confirm=document.createElement('button');cancel.textContent='Keep editing';cancel.onclick=()=>dialog.close();confirm.textContent=title;confirm.className='primary';confirm.onclick=()=>{dialog.close();action();};footer.append(cancel,confirm);body.append(p,footer);cancel.focus();});}
 function setBusy(value){busy=value;for(const b of document.querySelectorAll('main button'))b.disabled=value;syncButtons();}
 function syncButtons(){historyButtons();const d=G.byId[variant];$('live-save').disabled=busy||!d?.live;$('live-revert').disabled=busy||!selected||!dirty;$('live-direct').disabled=busy||!selected;$('live-canvas').disabled=busy||!selected;document.querySelectorAll('[data-command]').forEach(b=>{const phase=liveState?.phase;b.disabled=busy||!selected||(b.dataset.command==='pause'&&phase!=='running')||(b.dataset.command==='resume'&&phase!=='paused');});$('live-adjust-apply').disabled=busy||!selected;}
 function stepRow(value={label:'Next quest',type:'like',target:5000,giftId:''}){const row=document.createElement('div');row.className='step';for(const [key,label,type]of [['label','Step label','text'],['type','Event','select'],['target','Target','number'],['giftId','Gift ID (optional)','text']]){const wrap=document.createElement('label');wrap.textContent=label;let input;if(type==='select'){input=document.createElement('select');for(const event of ['like','follow','share','gift'])input.add(new Option(event,event));}else{input=document.createElement('input');input.type=type;if(type==='number'){input.min=1;input.max=10000000;}else input.maxLength=key==='label'?60:30;}input.dataset.step=key;input.value=value[key]??'';wrap.append(input);row.append(wrap);}const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.onclick=()=>{row.remove();changed();};row.append(remove);$('quest-steps').append(row);}
 $('quest-add').onclick=()=>{if($('quest-steps').children.length<8){stepRow();changed();}};
 function options(){const o={variant,align:$('graphic-align')?.value||'center',look:$('graphic-style').value};for(const [key,id]of Object.entries(field))o[key]=$(id).value;o.steps=[...$('quest-steps').children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-step]')].map(i=>[i.dataset.step,i.value])));o.aImage=$('graphic-a-gift').dataset.giftImage||(selected?.config?.goalBar?.graphic?.aGift===o.aGift?selected.config.goalBar.graphic.aImage:'')||'';o.bImage=$('graphic-b-gift').dataset.giftImage||(selected?.config?.goalBar?.graphic?.bGift===o.bGift?selected.config.goalBar.graphic.bImage:'')||'';return {...G.options(o),sound:o.sound,volume:Number(o.volume)||0};}
 function config(){const c=structuredClone(selected?.config||{goalBar:{type:'likes',target:1000,start:0,text:'#ffffff',accent:'#add8c8',glow:'#add8c8'}});c.goalBar={...c.goalBar,graphic:options(),text:$('graphic-text').value,accent:$('graphic-accent').value,glow:$('graphic-accent').value};const clear=$('graphic-style').value!=='glass';if(clear)c.goalBar.appearance={...(c.goalBar.appearance||{}),enabled:true,noBackground:true,label:c.goalBar.text,counterText:c.goalBar.text};else if(c.goalBar.appearance)delete c.goalBar.appearance.noBackground;return c;}
 function encode(c){let b='';new TextEncoder().encode(JSON.stringify(c)).forEach(v=>b+=String.fromCharCode(v));return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
 function preview(){const c=selected&&!G.byId[variant]?.live?selected.config:config(),d=G.byId[variant],kind=selected?.overlayKind||'goal';if(!d)return;const u=new URL('./index-graphic.html',location.href);u.search=new URLSearchParams({kind,preview:'1',mute:$('live-mute').checked?'1':'0',sampleEvents:'1',render:String(++previewRevision)}).toString();u.hash='config='+encode(c);$('live-preview').src=u.href;const frame=$('live-preview'),box=frame.parentElement;const fit=()=>{const scale=Math.min((box.clientWidth-24)/d.width,(box.clientHeight-20)/d.height,1);frame.style.width=d.width+'px';frame.style.height=d.height+'px';frame.style.transform='translate(-50%,-50%) scale('+scale+')';};fit();$('live-dimensions').textContent='Source '+d.width+' × '+d.height+' px';}
 new ResizeObserver(()=>{const d=G.byId[variant];if(!d)return;const frame=$('live-preview'),scale=Math.min((frame.parentElement.clientWidth-24)/d.width,170/d.height,1);frame.style.transform='translate(-50%,-50%) scale('+scale+')';}).observe($('live-preview').parentElement);
 const historyEntries=[];
 let historyIndex=0,restoring=false;
 function snapshot(){
  return JSON.stringify({name:$('graphic-name').value,config:config()});
 }
 function historyButtons(){
  $('live-undo').disabled=busy||historyIndex===0;
  $('live-redo').disabled=busy||historyIndex>=historyEntries.length-1;
 }
 function recordChange(){
  const state=snapshot();
  if(state===historyEntries[historyIndex])return;
  historyEntries.splice(historyIndex+1);
  historyEntries.push(state);
  if(historyEntries.length>80)historyEntries.shift();
  historyIndex=historyEntries.length-1;
 }
 let savedSnapshot='';
 function restoreEdit(offset){
  historyIndex+=offset;
  restoring=true;
  try{load(selected,JSON.parse(historyEntries[historyIndex]));}finally{restoring=false;}
  dirty=historyEntries[historyIndex]!==savedSnapshot;
  status(dirty?'Unsaved changes':selected?'Saved':'New design');
  syncButtons();
 }
 $('live-undo').onclick=()=>restoreEdit(-1);
 $('live-redo').onclick=()=>restoreEdit(1);
 function changed(){recordChange();dirty=snapshot()!==savedSnapshot;status(dirty?'Unsaved changes':selected?'Saved':'New design');syncButtons();clearTimeout(draftTimer);draftTimer=setTimeout(()=>{preview();},220);}
 form.addEventListener('input',changed);form.addEventListener('change',changed);form.onsubmit=e=>e.preventDefault();
 $('graphic-style').onchange=()=>{const colors={glass:['#ffffff','#add8c8'],pearl:['#ffffff','#c9e1df'],mint:['#d8fff0','#73dfbd'],gold:['#fff1c9','#edc76e'],ice:['#ddf4ff','#8cceef']}[$('graphic-style').value];$('graphic-text').value=colors[0];$('graphic-accent').value=colors[1];changed();};
 function load(v,override){clearTimeout(draftTimer);selected=v||null;const c=override?.config||v?.config||{goalBar:{graphic:{variant},text:'#ffffff',accent:'#add8c8'}},kind=v?.overlayKind||'goal',o=G.options(G.config(kind,c));variant=o.variant;document.querySelector('.heading h1').textContent=G.byId[variant].name;document.title=G.byId[variant].name+' | King Gumption Studio';liveState=null;$('live-summary').textContent='';$('live-phase').textContent=v?'Loading session…':'Save a design first';dirty=Boolean(override);if($('graphic-align'))$('graphic-align').value=o.align;$('graphic-name').value=override?.name||v?.name||G.byId[variant].name;$('live-design').value=v?.id||'';for(const [key,id]of Object.entries(field))$(id).value=G.config(kind,c)?.[key]??o[key]??(key==='volume'?85:'');$('graphic-text').value=c.goalBar?.text||'#ffffff';$('graphic-accent').value=c.goalBar?.accent||'#add8c8';$('graphic-style').value=G.config(kind,c)?.look||(c.goalBar?.appearance?.noBackground?'pearl':'glass');$('quest-steps').replaceChildren();o.steps.forEach(stepRow);document.querySelectorAll('[data-for]').forEach(el=>el.hidden=!el.dataset.for.split(' ').includes(variant));const editable=G.byId[variant].live;$('live-edit').hidden=!editable;$('live-classic').hidden=editable;$('live-create').hidden=Boolean(selected);$('live-edit-original').href='/studio/?design='+encodeURIComponent(v?.id||'')+'&kind='+encodeURIComponent(kind);document.querySelectorAll('[data-live-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.liveType===variant)));$('live-adjust-choice-wrap').hidden=variant!=='vote';g.dispatchEvent(new Event('livegraphic:loaded'));if(top!==g)parent.postMessage({type:'studio:overlay-selection',designId:selected?.id||''},location.origin);if(!restoring){
   savedSnapshot=snapshot();
   historyEntries.splice(0,historyEntries.length,savedSnapshot);
   historyIndex=0;
  }
  preview();syncButtons();status(dirty?'Unsaved changes. Save to update your overlay.':selected?'Saved · revision '+selected.revision:'New design · Not saved');sections();if(selected)readState();}
 function renderSelect(){const id=selected?.id||'';$('live-design').replaceChildren(new Option('New design',''));for(const v of variants.filter(v=>G.definition(v.overlayKind,v.config)&&(!pageType||G.definition(v.overlayKind,v.config).id===pageType)&&!v.archived).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)))$('live-design').add(new Option(v.name,v.id));$('live-design').value=id;}
 async function refresh(){const result=await cloud.listVariants();variants=result.variants;renderSelect();}
 $('live-design').onchange=()=>{const next=$('live-design').value,go=()=>{if(!next)variant=pageType||'combo';load(variants.find(v=>v.id===next));};if(dirty){$('live-design').value=selected?.id||'';confirmAction('Switch designs','Discard your unsaved changes and switch designs?',go);}else go();};
 for(const d of G.definitions.filter(d=>d.live)){const b=document.createElement('button');b.type='button';b.dataset.liveType=d.id;b.innerHTML='<span class="type-icon" aria-hidden="true">'+({combo:'✦',boss:'♛',vote:'⇄',quest:'✓'})[d.id]+'</span><strong>'+d.name+'</strong><small>'+d.width+' × '+d.height+'</small>';b.onclick=()=>{const choose=()=>{if(pageType){pageType=d.id;const url=new URL(location.href);url.searchParams.set('type',d.id);url.searchParams.delete('design');history.replaceState(null,'',url);}variant=d.id;load(null);renderSelect();changed();};dirty?confirmAction('Change overlay type','Start this graphic? Save current unpublished settings first if you want to keep them.',choose):choose();};$('live-types').append(b);}
 $('live-new').onclick=()=>{const start=()=>{variant=pageType||'combo';load(null);};dirty?confirmAction('New design','Discard unsaved changes and create a new design?',start):start();};
 $('live-save').onclick=async()=>{if(!form.reportValidity())return;const name=$('graphic-name').value.trim();if(!name)return status('Enter a design name.',true);clearTimeout(draftTimer);const c=config();if(variant==='vote'&&(!c.goalBar.graphic.aGift||!c.goalBar.graphic.bGift||c.goalBar.graphic.aGift===c.goalBar.graphic.bGift))return status('Choose two different gifts for voting before saving.',true);setBusy(true);try{const result=selected?await cloud.updateVariant(selected.id,{name,overlayKind:'goal',config:c,expectedRevision:selected.revision}):await cloud.createVariant({name,overlayKind:'goal',config:c});await refresh();load(result.variant);status('Saved · revision '+result.variant.revision);}catch(e){status(e.status===409?'A newer save exists. Your settings are kept. Revert to the newest save or create a new design.':e.message,true);}finally{setBusy(false);}};
 $('live-revert').onclick=()=>{if(!selected)return;confirmAction('Revert to last save','Replace this graphic’s unpublished settings with its latest saved version?',async()=>{setBusy(true);try{const id=selected.id;await refresh();const v=variants.find(v=>v.id===id);if(!v)throw Error('Saved graphic unavailable. Your settings are kept.');load(v);}catch(e){status(e.message,true);}finally{setBusy(false);}});};
 function applyPreviewControls(){
  const win=$('live-preview').contentWindow;
  if(!win)return;
  win.editorPreviewActive=$('live-pause').getAttribute('aria-pressed')!=='true'&&!document.hidden;
  win.editorSampleEvents=$('live-auto').checked;
  win.studioSetPreviewMute?.($('live-mute').checked);
 }
 $('live-preview').addEventListener('load',applyPreviewControls);
 document.addEventListener('visibilitychange',applyPreviewControls);
 $('live-auto').onchange=$('live-mute').onchange=applyPreviewControls;
 $('live-pause').onclick=()=>{
  const button=$('live-pause'),paused=button.getAttribute('aria-pressed')!=='true';
  button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'Resume':'Pause';
  applyPreviewControls();
 };
 const backdropButtons=document.querySelectorAll('[data-backdrop]');
 function backdrop(mode){
  document.querySelector('.preview').dataset.background=mode;
  for(const button of backdropButtons)button.setAttribute('aria-pressed',String(button.dataset.backdrop===mode));
 }
 const backdropKey='kg-preview-backdrop:'+pageType;
 try{backdrop(localStorage.getItem(backdropKey)||'dark');}catch{}
 for(const button of backdropButtons)button.onclick=()=>{
  backdrop(button.dataset.backdrop);
  try{localStorage.setItem(backdropKey,button.dataset.backdrop);}catch{}
 };
 $('live-sample').onclick=()=>$('live-preview').contentWindow?.studioSampleEvent?.();
 $('live-direct').onclick=async()=>{if(!selected)return;setBusy(true);try{const link=await cloud.getDirectLink(selected.id),url=cloud.getWidgetUrl(link.publicToken);showDialog('Direct link',body=>{const p=document.createElement('p');p.textContent='Add this URL as a Browser Source in your streaming software. Source size: '+link.width+' × '+link.height+' pixels. Keep this link private.';const input=document.createElement('input');input.readOnly=true;input.value=url;input.setAttribute('aria-label','Browser Source URL');const copy=document.createElement('button');copy.textContent='Copy link';copy.onclick=async()=>{try{await navigator.clipboard.writeText(url);copy.textContent='Copied';}catch{input.select();}};body.append(p,input,copy);});}catch(e){status(e.message,true);}finally{setBusy(false);}};
 $('live-canvas').onclick=async()=>{if(!selected)return;try{docks=(await cloud.listDocks()).docks;showDialog('Add to canvas',body=>{const select=document.createElement('select');select.setAttribute('aria-label','Canvas');for(const d of docks)select.add(new Option(d.name,d.id));const button=document.createElement('button');button.textContent='Add to canvas';button.disabled=!docks.length;button.onclick=async()=>{button.disabled=true;try{const d=G.byId[variant];await cloud.createDockItem(select.value,{variantId:selected.id,overlayKind:selected.overlayKind,x:24,y:24,width:d.width,height:d.height,zIndex:0,visible:true});dialog.close();status('Added to canvas. Arrange it in Canvas Designer.');}catch(e){status(e.message,true);button.disabled=false;}};const link=document.createElement('a');link.href='/studio/?workspace=outputs';link.textContent='Open Canvas Designer ↗';body.append(select,button,document.createElement('p'),link);});}catch(e){status(e.message,true);}};
 async function readState(){if(!selected||busy)return;const id=selected.id;try{const result=await cloud.request('/v1/variants/'+encodeURIComponent(id)+'/live');if(selected?.id!==id)return;liveState=result.state;$('live-phase').textContent=result.state.phase+(result.state.visible?' · visible':' · hidden');const s=result.state;$('live-summary').textContent=variant==='boss'?Math.ceil(s.hp).toLocaleString()+' health remaining':variant==='vote'?s.counts.join(' / ')+' votes':variant==='quest'?'Step '+Math.min(s.step+1,s.options.steps.length)+' of '+s.options.steps.length+' · '+s.stepValue:variant==='combo'?s.total+' gifts in current combo':s.queue.length+' reactions queued';syncButtons();}catch(e){status('Live controls unavailable: '+e.message,true);}}
 async function command(action,extra={}){if(!selected)return;if(dirty&&['start','reset'].includes(action))return status('Save your settings before starting or resetting a session.',true);setBusy(true);try{liveState=(await cloud.request('/v1/variants/'+encodeURIComponent(selected.id)+'/live',{method:'POST',body:{action,...extra}})).state;status('Session updated ('+action+').');}catch(e){status(e.message,true);}finally{setBusy(false);await readState();}}
 document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>{const action=b.dataset.command;['reset','start','end'].includes(action)?confirmAction(action==='reset'?'Reset session':action==='start'?'Start session':'End round',action==='reset'?'Clear this session’s totals, reaction queue and deduplication history? Saved design and source link are kept.':action==='start'?'Start a fresh session using the saved rules? This replaces the current live totals.':'Close the current round and stop counting events?',()=>command(action)):command(action);});
 $('live-adjust-apply').onclick=()=>command('adjust',{value:Number($('live-adjust').value),choice:Number($('live-adjust-choice').value)});
 g.studioOverlayDirty=()=>dirty;
 g.studioOverlayDiscard=()=>{clearTimeout(draftTimer);load(selected);dirty=false;syncButtons();};
 g.addEventListener('beforeunload',e=>{if(dirty&&!leaving&&top===g){e.preventDefault();e.returnValue='';}});
 async function init(){if(!cloud?.signedIn){$('live-auth').hidden=false;return;}$('live-app').hidden=false;setBusy(true);try{await cloud.me();try{localStorage.removeItem('kg-live-graphic-draft:'+cloud.session.user.id);}catch{}await refresh();const sounds=(await cloud.request('/v1/sounds')).sounds||[];for(const s of sounds.filter(s=>!s.removed))$('graphic-sound').add(new Option(s.name,s.url));const id=new URLSearchParams(location.search).get('design'),saved=variants.find(v=>v.id===id&&(!pageType||G.definition(v.overlayKind,v.config)?.id===pageType));load(saved);}catch(e){status('Unable to load saved overlays. Your sign-in is kept. '+e.message,true);}finally{setBusy(false);}pollTimer=setInterval(readState,2000);}
 const previewCard=document.querySelector('.preview-card'),tabs=document.createElement('nav');tabs.className='overlay-editor-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Overlay editor sections');
 const layout=document.createElement('section');layout.className='edit-card';layout.dataset.overlayPanel='layout';layout.innerHTML='<h2>Layout</h2><label>Title alignment<select id="graphic-align"><option value="start">Left</option><option value="center">Centre</option><option value="end">Right</option></select></label>';
 previewCard.after(tabs,layout);const style=document.createElement('section');style.className='edit-card';style.dataset.overlayPanel='style';style.innerHTML='<h2>Style</h2><div class="fields"></div>';layout.after(style);
 for(const id of ['graphic-style','graphic-text','graphic-accent'])style.querySelector('.fields').append($(id).closest('label'));
 const settings=$('live-edit');settings.dataset.overlayPanel='settings';settings.querySelector('h2').textContent='Settings';const controls=document.querySelector('.controls-card');controls.dataset.overlayPanel='controls';controls.querySelector('h2').textContent='Session controls';
 document.querySelector('.live-header').hidden=true;document.querySelector('#live-create').hidden=true;$('live-new').textContent='+ New design';$('live-save').before($('live-new'));
 let section='settings';function sections(){for(const panel of document.querySelectorAll('[data-overlay-panel]'))panel.hidden=panel.dataset.overlayPanel!==section;tabs.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.overlayTab===section));b.tabIndex=b.dataset.overlayTab===section?0:-1;});}
 for(const [id,label]of [['layout','Layout'],['settings','Settings'],['style','Style'],['controls','Session controls']]){const button=document.createElement('button');button.type='button';button.setAttribute('role','tab');button.dataset.overlayTab=id;button.id='overlay-tab-'+id;button.setAttribute('aria-controls','overlay-panel-'+id);const panel=document.querySelector('[data-overlay-panel="'+id+'"]');panel.id=panel.id||'overlay-panel-'+id;button.setAttribute('aria-controls',panel.id);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);button.textContent=label;button.onclick=()=>{section=id;sections();};tabs.append(button);}
 tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...tabs.children],i=buttons.indexOf(document.activeElement),n=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[n].focus();buttons[n].click();};
 function choiceGroup(select,label,swatches){
  const field=select.closest('label'),group=document.createElement('fieldset');
  const legend=document.createElement('legend');legend.textContent=label;group.append(legend);
  group.className='overlay-choices';field.after(group);field.hidden=true;
  const refresh=()=>{for(const button of group.querySelectorAll('button')){
   button.setAttribute('aria-pressed',String(button.value===select.value));
  }};
  for(const option of select.options){
   const button=document.createElement('button');button.type='button';button.value=option.value;
   if(swatches){
    const sample=document.createElement('span');sample.className='preset-swatch';
    sample.style.setProperty('--tint',swatches[option.value]);button.append(sample);
   }
   button.append(option.textContent);button.onclick=()=>{
    select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));refresh();
   };
   group.append(button);
  }
  g.addEventListener('livegraphic:loaded',refresh);refresh();
 }
 choiceGroup($('graphic-align'),'Title alignment');
 choiceGroup($('graphic-style'),'Style preset',{glass:'#add8c8',pearl:'#c9e1df',mint:'#73dfbd',gold:'#edc76e',ice:'#8cceef'});
 const tabPaths={
  layout:'M3 3h18v18H3z M10 3v18 M10 10h11',
  settings:'M4 21V14 M4 10V3 M12 21V12 M12 8V3 M20 21V16 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  style:'m15 4 5 5 M4 20l5-1L21 7l-4-4L5 15l-1 5Z',
  controls:'M4 6h16v12H4z M10 9l5 3-5 3z'
 };
 for(const tab of tabs.children){
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
  icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');
  const path=document.createElementNS(icon.namespaceURI,'path');
  path.setAttribute('d',tabPaths[tab.dataset.overlayTab]);icon.append(path);tab.prepend(icon);
 }
 layout.querySelector('select').onchange=changed;style.addEventListener('input',changed);style.addEventListener('change',changed);sections();
 const embed=new URLSearchParams(location.search).has('embed');document.body.classList.toggle('overlay-embedded',embed);new ResizeObserver(()=>{if(embed)parent.postMessage({type:'studio:overlay-height',height:Math.ceil(document.querySelector('main').getBoundingClientRect().height)},location.origin);}).observe(document.body);
 g.addEventListener('pagehide',()=>clearInterval(pollTimer));init();
})(window);
