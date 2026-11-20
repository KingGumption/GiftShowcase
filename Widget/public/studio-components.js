/* Shared, lightweight editor interactions. All writes still pass through normal save APIs. */
function studioDialog(title,body){
  const dialog=document.createElement('dialog');dialog.className='studio-modal';const heading='studio-dialog-'+crypto.randomUUID();
  dialog.setAttribute('aria-labelledby',heading);dialog.innerHTML='<header><h2 id="'+heading+'">'+escapeHtml(title)+'</h2><button type="button" data-modal-close aria-label="Close">×</button></header>'+body;
  dialog.querySelector('[data-modal-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);return dialog;
}
function openAddCard(context){
  const dialog=studioDialog('Add a card','<p>Choose what activates this card. Its sound is set separately.</p><div class="event-card-choices">'+['gift','follow','likes','share'].map(type=>'<button type="button" data-event-choice="'+type+'">'+rowsIcon(type)+'<strong>'+type[0].toUpperCase()+type.slice(1)+'</strong><span>'+(type==='gift'?'Choose a gift':type==='likes'?'Every 50 likes':type==='share'?'When the live is shared':'When someone follows')+'</span></button>').join('')+'</div>');
  dialog.querySelectorAll('[data-event-choice]').forEach(button=>button.onclick=()=>{
    const type=button.dataset.eventChoice;dialog.close();if(type==='gift'){openRowsGiftPicker(context);return;}
    const normalize=activeConfigTab==='original'?normalizeReward:activeConfigTab==='side-gifts'?normalizeSideGift:normalizeRowsGift;
    const gift=normalize({title:type==='likes'?'50 likes':type==='share'?'Share the live':'New follower',triggerType:type,likesRequired:50,row:context.row||1,enabled:true,giftIds:[],giftNames:[],image:'',sound:'',volume:.85});
    cardEditorItems().push(gift);rowsSelectedGift=gift;markDirty();renderRowsWorkspace();cardEditorList().querySelector('[data-edit="title"]')?.focus();
  });dialog.showModal();dialog.querySelector('[data-event-choice]').focus();
}
function readRecentGifts(){try{const items=JSON.parse(localStorage.getItem('kg-recent-gifts:v1')||'[]');return Array.isArray(items)?items.slice(0,40):[];}catch{return [];}}
function rememberRecentGifts(images){const keys=images.map(image=>{const entry=getImageCatalogEntry(image);return entry?.id?'id:'+entry.id:image;});try{localStorage.setItem('kg-recent-gifts:v1',JSON.stringify([...new Set([...keys,...readRecentGifts()])].slice(0,40)));}catch{}}
function renderPickerSelection(dialog){
  const strip=dialog.querySelector('.gift-selected-strip');if(!strip)return;
  strip.innerHTML=[...rowsPickerSelection].map(image=>{const entry=getImageCatalogEntry(image);return '<button type="button" data-selected-gift="'+escapeAttribute(image)+'" aria-label="Remove '+escapeAttribute(entry?.label||'gift')+' from selection"><img src="'+escapeAttribute(resolveRewardImageUrl(image))+'" alt="">'+escapeHtml(entry?.label||'Gift')+' ×</button>';}).join('');
  strip.querySelectorAll('button').forEach(button=>button.onclick=()=>{rowsPickerSelection.delete(button.dataset.selectedGift);renderRowsPickerGifts();dialog.querySelector('[data-picker-count]').textContent=rowsPickerSelection.size+' selected';dialog.querySelector('[data-picker-apply]').disabled=!rowsPickerSelection.size;});
}
