/* Reward Rows uses the existing config objects and save/direct-link pipeline. */
let rowsSelectedGift = null;
let cardEditorPreviousMode = 'rows';
const cardEditorSelections = new Map();
function cardEditorMode() { return activeConfigTab; }
function cardEditorItems() { return activeConfigTab==='original'?draftConfig.rewards:activeConfigTab==='side-gifts'?draftConfig.sideGifts.gifts:draftConfig.rowsOverlay.gifts; }
function cardEditorList() { return activeConfigTab==='original'?rewardList:activeConfigTab==='side-gifts'?sideGiftList:rowsGiftList; }
function cardEditorAction(action,index) { return activeConfigTab==='original'?handleRewardAction(action,index):activeConfigTab==='side-gifts'?handleSideGiftAction(action,index):handleRowsGiftAction(action,index); }
function cardEditorStats() { updateRewardStats();updateRowsGiftStats();updateSideGiftStats(); }
function cardEditorMove(source,targetRow,before=null,after=false) {
  if(activeConfigTab==='rows')return moveRowsGift(source,targetRow,before,after);
  const gifts=cardEditorItems(),gift=gifts[source],target=before===null?gifts.length:before+(after?1:0);
  if(!gift||before===source)return;
  gifts.splice(source,1);gifts.splice(target>source?target-1:target,0,gift);markDirty();renderRowsWorkspace();
}

let rowsPickerContext = null;
const rowsPickerSelection = new Set();
let rowsPickerLimit = 120;
let rowsPickerFavorites = false;

function rowsIcon(name) {
  const paths = {cards:'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',settings:'M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3M1 14h6M9 8h6M17 16h6',style:'m15 4 5 5M4 20l5-1L21 7l-4-4L5 15l-1 5Z',gift:'M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7H7a3 3 0 1 1 3-3l2 3Zm0 0h5a3 3 0 1 0-3-3l-2 3Z',follow:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 7h6M19 4v6M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',likes:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',share:'m15 17 5-5-5-5M4 18v-2a4 4 0 0 1 4-4h12',sound:'M11 5 6 9H3v6h3l5 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',play:'m8 5 11 7-11 7Z',grip:'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',coin:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM14 8h-3a4 4 0 0 0 0 8h3'};
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(paths[name]||paths.gift).split('Z').map((d,i,a)=>d?`<path d="${d}${i<a.length-1?'Z':''}"/>`:'').join('')}</svg>`;
}
function rowsArtwork(gift) {
  const src = getTriggerIcon(gift) || (gift.image ? resolveRewardImageUrl(gift.image) : '');
  return src ? `<img src="${escapeAttribute(src)}" alt="">` : rowsIcon('gift');
}
function rowsTriggerLabel(gift) {
  return gift.triggerType === 'gift' ? (gift.giftNames?.[0] || 'Choose a gift') : gift.triggerType === 'likes' ? `Every ${gift.likesRequired} likes` : gift.triggerType === 'share' ? 'On a share' : 'On a follow';
}
function rowsCoin(entry) {
  if (entry && (entry.coins === null || entry.coins === undefined)) {
    const current = getGiftCatalogEntries().find(candidate => entry.id && candidate.id === entry.id) || getGiftCatalogEntries().find(candidate => normalizeName(candidate.label) === normalizeName(entry.label));
    if (current?.coins !== null && current?.coins !== undefined) entry = current;
  }
  return entry?.coins !== null && entry?.coins !== undefined ? `<span class="rows-coins" aria-label="${escapeAttribute(entry.coins)} coins">${rowsIcon('coin')}${Number(entry.coins).toLocaleString()}</span>` : '<span class="rows-coins" aria-label="Coin amount unknown">—</span>';
}
function renderRowsWorkspace() {
  const oldFocus = document.activeElement;
  const hadFocus = cardEditorList().contains(oldFocus);
  const focusIndex = oldFocus?.closest('[data-index]')?.dataset.index;
  const focusTrigger = oldFocus?.dataset.trigger;
  const focusAction = oldFocus?.dataset.cardAction;
  const focusSetting=oldFocus?.dataset.rowSetting,focusRow=oldFocus?.closest('[data-row-settings]')?.dataset.rowSettings;

  const isRows=activeConfigTab==='rows';
  if(cardEditorPreviousMode!==activeConfigTab){cardEditorSelections.set(cardEditorPreviousMode,rowsSelectedGift);rowsSelectedGift=cardEditorSelections.get(activeConfigTab)||null;cardEditorPreviousMode=activeConfigTab;}
  if(isRows)ensureRowsGiftRows();
  const gifts = cardEditorItems();
  if (!gifts.includes(rowsSelectedGift)) rowsSelectedGift = gifts[0] || null;
  cardEditorList().className = 'rows-workspace';
  cardEditorList().innerHTML = '<div class="rows-action-list"><p class="rows-guide">Choose a card to edit. Drag to reorder, or use Move in the card settings.</p></div><aside class="rows-inspector" aria-label="Selected card settings"></aside>';
  const list = cardEditorList().querySelector('.rows-action-list');
  for (let row = 1; row <= (isRows?draftConfig.rowsOverlay.rows:1); row++) {
    const items = gifts.map((gift,index)=>({gift,index})).filter(x=>!isRows||x.gift.row===row);
    const section = document.createElement('section'); section.className='rows-list-section';
    section.innerHTML=`<header><h3>${isRows?'Row '+row:'Your cards'} <small>${items.length} ${items.length===1?'card':'cards'}</small></h3>${isRows?`<details class="rows-options"><summary>Row settings</summary>${getRowsGiftSettingsMarkup(row)}<button type="button" data-delete-row>Delete row</button></details>`:''}</header><div class="rows-compact-dropzone" data-row-dropzone></div><button type="button" class="rows-add">+ Add card${isRows?' to row '+row:''}</button>`;
    if(isRows)setupRowsGiftSettings(section,row);
    if(isRows)section.querySelector('[data-delete-row]').onclick=()=>deleteRowsBoardRow(row);
    section.querySelector('.rows-add').onclick=()=>openAddCard({row});
    const zone=section.querySelector('[data-row-dropzone]');
    // A vertical list needs its own midpoint calculation; existing model reordering is retained.
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('is-drag-over')});
    zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('is-drag-over')});
    zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('is-drag-over');const raw=e.dataTransfer.getData('application/x-rows-gift-index');if(!/^\d+$/.test(raw))return;const target=e.target.closest('[data-index]');cardEditorMove(Number(raw),row,target?Number(target.dataset.index):null,target?e.clientY>target.getBoundingClientRect().top+target.offsetHeight/2:false)});
    for(const {gift,index} of items) {
      const card=document.createElement('div');card.className='rows-action'+(gift===rowsSelectedGift?' is-selected':'')+(gift.enabled===false?' is-disabled':'');card.dataset.index=index;card.draggable=true;
      const entry=gift.triggerType==='gift'?getSelectedGiftEntry(gift):null;
      card.innerHTML=`<span class="rows-drag" title="Drag to reorder">${rowsIcon('grip')}</span><button type="button" class="rows-action-select" aria-pressed="${gift===rowsSelectedGift}"><span class="rows-art">${rowsArtwork(gift)}</span><span class="rows-action-copy"><strong>${escapeHtml(gift.title)}</strong><small>${escapeHtml(rowsTriggerLabel(gift))}${gift.enabled===false?' · Disabled':''}</small></span></button>${gift.triggerType==='gift'?rowsCoin(entry):'<span class="rows-coins">—</span>'}<span class="rows-sound-status" title="${gift.sound?'Sound attached':'No sound'}">${rowsIcon('sound')}<span>${gift.sound?'On':'Off'}</span></span>`;
      card.querySelector('button').onclick=()=>{rowsSelectedGift=gift;renderRowsWorkspace();if(innerWidth<=1100)cardEditorList().querySelector('.rows-inspector').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})};
      card.addEventListener('dragstart',e=>{e.dataTransfer.setData('application/x-rows-gift-index',String(index));e.dataTransfer.effectAllowed='move'});
      zone.append(card);
    }
    if(isRows&&items.length>Number(getCsvValue(draftConfig.rowsOverlay.perRow,row,6))){
      const notice=document.createElement('div');notice.className='rows-overflow-notice';
      const visible=Number(getCsvValue(draftConfig.rowsOverlay.perRow,row,6));
      notice.innerHTML='<p>'+items.length+' cards · '+visible+' visible at once. Extra cards '+(getScrollingRowsSet().has(row)?'scroll into view.':'appear when activated.')+'</p><button type="button" data-fit-row>Fit all</button><button type="button" data-scroll-row>Scroll this row</button><button type="button" data-move-overflow>Move extra cards</button>';
      notice.querySelector('[data-fit-row]').onclick=()=>{if(items.length>12){setState('Rows show up to 12 cards at once. Scroll or move extra cards.');return;}draftConfig.rowsOverlay.perRow=setCsvValue(draftConfig.rowsOverlay.perRow,row,items.length,6);rowsPerRow.value=draftConfig.rowsOverlay.perRow;markDirty();renderRowsWorkspace();};
      notice.querySelector('[data-scroll-row]').onclick=()=>{const rows=getScrollingRowsSet();rows.add(row);draftConfig.rowsOverlay.scrollRows=[...rows].join(',');rowsScrolling.value=draftConfig.rowsOverlay.scrollRows;markDirty();renderRowsWorkspace();};
      notice.querySelector('[data-move-overflow]').onclick=()=>{if(draftConfig.rowsOverlay.rows>=8){setState('Move cards using the selected card settings; eight rows is the maximum.');return;}const target=++draftConfig.rowsOverlay.rows;items.slice(visible).forEach(({gift})=>gift.row=target);rowsCount.value=String(target);markDirty();render();};
      section.append(notice);
    }
    if(!items.length)zone.innerHTML='<p class="rows-guide">Drop a card here or add your first gift.</p>';
    list.append(section);
  }
  if(isRows){const add=document.createElement('button');add.type='button';add.className='rows-add-row';add.textContent='+ Add row';add.disabled=draftConfig.rowsOverlay.rows>=8;add.onclick=addRowsBoardRow;list.append(add);}
  renderRowsInspector();cardEditorStats();
  if(hadFocus) {
    const target=focusSetting?cardEditorList().querySelector('[data-row-settings="'+focusRow+'"] [data-row-setting="'+focusSetting+'"]'):focusTrigger ? cardEditorList().querySelector('[data-trigger="'+focusTrigger+'"]') : focusAction ? cardEditorList().querySelector('[data-card-action="'+focusAction+'"]:not(:disabled)') : cardEditorList().querySelector('[data-index="'+(focusIndex ?? gifts.indexOf(rowsSelectedGift))+'"] .rows-action-select');
    (target || cardEditorList().querySelector('.rows-action-select') || cardEditorList().querySelector('.rows-add'))?.focus({preventScroll:true});
  }
}
function renderRowsInspector() {
  const panel=cardEditorList().querySelector('.rows-inspector'),gift=rowsSelectedGift;
  if(!gift){panel.innerHTML='<h3>Make it yours</h3><p>Add a gift to start building your overlay.</p>';return}
  const index=cardEditorItems().indexOf(gift);
  panel.innerHTML=`<header class="rows-inspector-heading"><span class="rows-art">${rowsArtwork(gift)}</span><div><small>${activeConfigTab==='rows'?'ROW '+gift.row+' · ':''}CARD ${index+1}</small><h3>Card settings</h3></div><label class="rows-enabled"><input data-edit="enabled" type="checkbox" ${gift.enabled!==false?'checked':''}> Enabled</label></header>
    <label class="rows-field">Action label<input data-edit="title" maxlength="160" value="${escapeAttribute(gift.title)}"></label>
    <fieldset class="rows-trigger-section"><legend>Triggered by</legend><div class="rows-trigger-buttons">${['gift','follow','likes','share'].map(type=>`<button type="button" data-trigger="${type}" aria-pressed="${gift.triggerType===type}">${rowsIcon(type)}${type[0].toUpperCase()+type.slice(1)}</button>`).join('')}</div>
    <p class="rows-guide">${gift.triggerType==='gift'?'This gift activates the card and supplies its image.':gift.triggerType==='likes'?'Activates again whenever this many new likes arrive.':`Activates when someone ${gift.triggerType==='share'?'shares the live':'follows'}. No gift needed.`}</p>
    ${gift.triggerType==='gift'?`<button class="rows-chosen-gift" type="button" data-change-gift><span class="rows-art">${rowsArtwork(gift)}</span><span>${escapeHtml(gift.giftNames?.[0]||'Choose a gift')}</span>${rowsCoin(getSelectedGiftEntry(gift))}<b>Change</b></button>`:''}
    ${gift.triggerType==='likes'?`<label class="rows-field">Likes required<input data-edit="likesRequired" type="number" min="1" max="1000000000" value="${gift.likesRequired}"></label><details class="rows-art-options"><summary>Heart and number style</summary>${[['likesHeartColor','Heart colour','color'],['likesNumberColor','Number colour','color'],['likesHeartSize','Heart size (%)','number'],['likesNumberSize','Number size','number']].map(([key,label,type])=>`<label class="rows-field">${label}<input data-edit="${key}" type="${type}" value="${gift[key]}" ${type==='number'?`min="${key==='likesHeartSize'?40:16}" max="${key==='likesHeartSize'?160:96}"`:''}></label>`).join('')}</details>`:''}</fieldset>
    <fieldset class="rows-audio-section"><legend>${rowsIcon('sound')} Sound</legend><p class="rows-guide">Plays when this card activates. Your card image stays separate.</p><label class="rows-field">Sound<select data-field="sound" data-edit="sound" aria-label="Card sound"></select></label><div class="rows-audio-controls"><button data-preview-sound type="button" ${gift.sound?'':'disabled'}>${rowsIcon('play')} Preview</button><label>Volume <input data-edit="volume" type="range" min="0" max="1" step="0.05" value="${gift.volume}" aria-label="Sound volume"></label><output>${Math.round(gift.volume*100)}%</output></div><button type="button" data-open-sounds>Choose or upload sound</button></fieldset>
    <button class="rows-test" data-test-card type="button">${rowsIcon('play')} Test this card</button><p class="rows-guide">See the animation in your preview${(activeConfigTab==='rows'?rowsPreviewMute:activeConfigTab==='original'?carouselPreviewMute:document.querySelector('#side-gifts-preview-mute'))?.checked?' · sound muted':''}.</p>
    <details class="rows-card-options"><summary>Move, duplicate or remove</summary>${activeConfigTab==='rows'?`<label class="rows-field">Move to row<select data-move-row>${Array.from({length:draftConfig.rowsOverlay.rows},(_,i)=>`<option value="${i+1}" ${gift.row===i+1?'selected':''}>Row ${i+1}</option>`).join('')}</select></label>`:''}${activeConfigTab==='side-gifts'?`<label class="rows-field">Placement<select data-edit="side"><option value="auto" ${gift.side==='auto'?'selected':''}>Automatic</option><option value="left" ${gift.side==='left'?'selected':''}>Left</option><option value="right" ${gift.side==='right'?'selected':''}>Right</option></select></label>`:''}<div class="rows-card-actions"><button type="button" data-card-action="up" ${index===0?'disabled':''}>Move up</button><button type="button" data-card-action="down" ${index===cardEditorItems().length-1?'disabled':''}>Move down</button><button type="button" data-card-action="duplicate">Duplicate</button><button type="button" data-card-action="delete">Remove</button></div></details>`;
  populateSoundSelect(panel,gift.sound);
  panel.querySelector('[data-field="sound"]').value=gift.sound;
  panel.querySelectorAll('[data-trigger]').forEach(button=>button.onclick=()=>{gift.triggerType=button.dataset.trigger;markDirty();renderRowsWorkspace()});
  panel.querySelector('[data-change-gift]')?.addEventListener('click',()=>openRowsGiftPicker({gift}));
  panel.querySelectorAll('[data-edit]').forEach(input=>input.addEventListener('input',()=>{
    const key=input.dataset.edit;
    if(key==='enabled')gift.enabled=input.checked;
    else if(['likesRequired','likesHeartSize','likesNumberSize','volume'].includes(key)){gift[key]=clamp(Number(input.value)||Number(input.min)||0,Number(input.min),Number(input.max))}
    else gift[key]=input.value;
    markDirty();cardEditorStats();
    // Preserve the focused input while keeping the list and artwork in step.
    cardEditorList().querySelector(`.rows-action[data-index="${index}"] strong`).textContent=gift.title;
    cardEditorList().querySelector(`.rows-action[data-index="${index}"]`).classList.toggle('is-disabled',gift.enabled===false);
    if(key.startsWith('likes')){panel.querySelector('.rows-inspector-heading .rows-art').innerHTML=rowsArtwork(gift);cardEditorList().querySelector(`.rows-action[data-index="${index}"] .rows-art`).innerHTML=rowsArtwork(gift);cardEditorList().querySelector(`.rows-action[data-index="${index}"] small`).textContent=rowsTriggerLabel(gift)}
    if(key==='volume')panel.querySelector('output').textContent=Math.round(gift.volume*100)+'%';
    if(key==='sound'){panel.querySelector('[data-preview-sound]').disabled=!gift.sound;cardEditorList().querySelector(`.rows-action[data-index="${index}"] .rows-sound-status span`).textContent=gift.sound?'On':'Off'}
  }));
  panel.querySelector('[data-open-sounds]').onclick=()=>window.openStudioSounds?.(gift);
  panel.querySelector('[data-preview-sound]').onclick=()=>playSoundPreview(panel,gift);
  panel.querySelector('[data-test-card]').onclick=()=>{
    // Flush pending changes, then test the renderer once its current config has loaded.
    const frame=activeConfigTab==='rows'?rowsPreview:activeConfigTab==='original'?carouselPreview:sideGiftsPreview;
    const mode=activeConfigTab;
    const test=()=>{const win=frame.contentWindow,options={triggerType:gift.triggerType,giftName:gift.triggerType==='gift'?gift.giftNames?.[0]:'',giftId:gift.triggerType==='gift'?gift.giftIds?.[0]:'',likesRequired:gift.likesRequired};if(mode==='rows')win?.simulateRowsGift?.(options);else if(mode==='original')win?.simulateRewardGift?.({...options,rewardIndex:index});else win?.handleSideGiftEvent?.(gift.triggerType==='likes'?'like':gift.triggerType,{giftId:options.giftId,giftName:options.giftName,likeCount:gift.likesRequired})};
    clearTimeout(previewRefreshTimer);const previous=frame.src;frame.addEventListener('load',test,{once:true});refreshOverlayPreviews();if(frame.src===previous){frame.removeEventListener('load',test);test()}frame.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
  };
  if(panel.querySelector('[data-move-row]'))panel.querySelector('[data-move-row]').onchange=e=>moveRowsGift(index,Number(e.target.value));
  panel.querySelectorAll('[data-card-action]').forEach(button=>button.onclick=()=>cardEditorAction(button.dataset.cardAction,index));
}
function openRowsGiftPicker(context) {
  rowsPickerContext=context;rowsPickerSelection.clear();rowsPickerLimit=120;rowsPickerFavorites=false;
  let dialog=document.querySelector('#rows-gift-picker');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='rows-gift-picker';dialog.className='rows-gift-picker';dialog.setAttribute('aria-labelledby','rows-picker-title');document.body.append(dialog)}
  dialog.innerHTML=`<header><div><h2 id="rows-picker-title">${context.gift?'Change gift':activeConfigTab==='rows'?'Add gifts to row '+context.row:'Add gifts'}</h2><p>Choose the images your viewers will see.</p></div><button type="button" data-picker-close aria-label="Close gift picker">×</button></header><div class="rows-picker-tools"><label class="rows-field">Find a gift<input type="search" data-picker-search placeholder="Name, ID or coins (e.g. 100–500)"></label><button type="button" data-picker-favorites aria-pressed="false">☆ Favourites</button></div><p class="rows-picker-status" role="status"></p><div class="rows-picker-grid"></div><footer><span data-picker-count>None selected</span><button type="button" data-picker-cancel>Cancel</button><button type="button" class="btn-primary" data-picker-apply disabled>${context.gift?'Use gift':'Add gifts'}</button></footer>`;
  const filters=document.createElement('div');filters.className='gift-price-filters';filters.innerHTML='<label>View<select data-gift-view><option value="all">All gifts</option><option value="recent">Recent</option></select></label><label>Min coins<input type="number" min="0" data-price-min placeholder="Any"></label><label>Max coins<input type="number" min="0" data-price-max placeholder="Any"></label>';dialog.querySelector('.rows-picker-tools').after(filters);
  const selected=document.createElement('div');selected.className='gift-selected-strip';selected.setAttribute('aria-label','Selected gifts');filters.after(selected);
  filters.querySelectorAll('input,select').forEach(input=>input.oninput=()=>{rowsPickerLimit=120;renderRowsPickerGifts();});
  dialog.querySelector('[data-picker-close]').onclick=()=>dialog.close();dialog.querySelector('[data-picker-cancel]').onclick=()=>dialog.close();
  dialog.querySelector('[data-picker-search]').oninput=()=>{rowsPickerLimit=120;renderRowsPickerGifts()};
  dialog.querySelector('[data-picker-favorites]').onclick=e=>{rowsPickerFavorites=!rowsPickerFavorites;e.currentTarget.setAttribute('aria-pressed',String(rowsPickerFavorites));renderRowsPickerGifts()};
  dialog.querySelector('[data-picker-apply]').onclick=()=>{
    for(const image of rowsPickerSelection){const entry=getImageCatalogEntry(image);if(!entry)continue;let gift=context.gift;if(!gift){gift=(activeConfigTab==='original'?normalizeReward:activeConfigTab==='side-gifts'?normalizeSideGift:normalizeRowsGift)({enabled:true,title:entry.name||entry.label,row:context.row,image:entry.image,giftNames:[entry.name||entry.label],giftIds:entry.id?[entry.id]:[],volume:.85});cardEditorItems().push(gift)}else{gift.image=entry.image;gift.giftNames=[entry.name||entry.label];gift.giftIds=entry.id?[entry.id]:[];gift.triggerType='gift';if(!gift.title||gift.title==='New Row Gift')gift.title=entry.name||entry.label}rowsSelectedGift=gift}
    rememberRecentGifts([...rowsPickerSelection]);markDirty();renderRowsWorkspace();dialog.close();
  };
  renderRowsPickerGifts();dialog.showModal();dialog.querySelector('input').focus();
}
function renderRowsPickerGifts() {
  const dialog=document.querySelector('#rows-gift-picker'),query=dialog.querySelector('input').value;
  const min=dialog.querySelector('[data-price-min]').value,max=dialog.querySelector('[data-price-max]').value,recent=readRecentGifts(),onlyRecent=dialog.querySelector('[data-gift-view]').value==='recent';
  const entries=sortGiftEntriesForPicker(getGiftCatalogEntries().filter(e=>matchesGiftSearch(e,query)&&(!rowsPickerFavorites||isGiftFavorite(e.image))&&(!onlyRecent||recent.includes(e.id?'id:'+e.id:e.image))&&((min===''&&max==='')||(e.coins!==null&&e.coins!==undefined&&(min===''||e.coins>=Number(min))&&(max===''||e.coins<=Number(max))))),normalizeName(query));
  if(onlyRecent)entries.sort((a,b)=>recent.indexOf(a.id?'id:'+a.id:a.image)-recent.indexOf(b.id?'id:'+b.id:b.image));
  renderPickerSelection(dialog);
  dialog.querySelector('.rows-picker-status').textContent=`${entries.length.toLocaleString()} gifts${query?' match your search':''}${giftCatalogueOffline?' · Showing your last available list; updates are temporarily unavailable.':''}`;
  dialog.querySelector('.rows-picker-grid').innerHTML=entries.slice(0,rowsPickerLimit).map(entry=>`<div class="rows-picker-tile"><button type="button" data-picker-gift="${escapeAttribute(entry.image)}" aria-pressed="${rowsPickerSelection.has(entry.image)}"><img src="${escapeAttribute(resolveRewardImageUrl(entry.image))}" alt="" loading="lazy"><strong>${escapeHtml(entry.label)}</strong>${rowsCoin(entry)}</button><button type="button" class="rows-star" data-picker-star="${escapeAttribute(entry.image)}" aria-label="${isGiftFavorite(entry.image)?'Remove from':'Add to'} favourites">${isGiftFavorite(entry.image)?'★':'☆'}</button></div>`).join('')+(entries.length>rowsPickerLimit?'<button type="button" class="rows-load-more">Show more gifts</button>':!entries.length?'<p>No matches. Try another name, ID or price range. Some creator and regional gifts may be unavailable. <a href="/help/#missing-gift">Missing a gift?</a></p>':'');
  dialog.querySelectorAll('[data-picker-gift]').forEach(button=>button.onclick=()=>{const image=button.dataset.pickerGift;if(rowsPickerSelection.has(image))rowsPickerSelection.delete(image);else{if(rowsPickerContext.gift)rowsPickerSelection.clear();rowsPickerSelection.add(image)}dialog.querySelectorAll('[data-picker-gift]').forEach(b=>b.setAttribute('aria-pressed',String(rowsPickerSelection.has(b.dataset.pickerGift))));dialog.querySelector('[data-picker-count]').textContent=rowsPickerSelection.size+' selected';dialog.querySelector('[data-picker-apply]').disabled=!rowsPickerSelection.size;renderPickerSelection(dialog)});
  dialog.querySelectorAll('[data-picker-star]').forEach(button=>button.onclick=()=>{toggleGiftFavorite(button.dataset.pickerStar);renderRowsPickerGifts()});
  dialog.querySelector('.rows-load-more')?.addEventListener('click',()=>{rowsPickerLimit+=120;renderRowsPickerGifts()});
}
