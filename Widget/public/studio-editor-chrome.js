(function(global){
  'use strict';
  const designs=global.studioDesigns,toolbar=document.querySelector('.studio-sticky-toolbar');if(!designs||!toolbar)return;
  const left=toolbar.querySelector('div'),type=document.getElementById('studio-current-title'),header=document.querySelector('.reward-config-header');
  if(type&&header){
    header.classList.add('studio-overlay-heading');
    header.replaceChildren(type);
    header.hidden=false;
  }
  toolbar.querySelector('[data-toolbar-test]')?.remove();
  const menu=document.getElementById('cloud-version-menu'),popover=menu.querySelector('.cloud-version-menu-popover'),summary=menu.querySelector('summary');summary.textContent='Options';summary.title='Design and editor options';summary.setAttribute('aria-label','Design and editor options');
  document.querySelectorAll('.studio-recovery-tools button').forEach((button,i)=>{button.setAttribute('aria-label',i?'Redo':'Undo');button.title=i?'Redo (Ctrl+Shift+Z)':'Undo (Ctrl+Z)';button.innerHTML='<span aria-hidden="true">'+(i?'↷':'↶')+'</span>';});
  const panel=document.getElementById('cloud-config-panel'),home=document.createComment('Editor options portal');panel.before(home);panel.hidden=true;
  const status=document.getElementById('cloud-config-status'),retry=document.getElementById('cloud-retry-session'),saveSummary=toolbar.querySelector('[data-save-summary]');left.append(status);if(retry)left.append(retry);
  function message(){saveSummary.hidden=!status.hidden&&Boolean(status.textContent);toolbar.classList.toggle('has-editor-message',!status.hidden&&Boolean(status.textContent));}
  new MutationObserver(message).observe(status,{attributes:true,childList:true,attributeFilter:['hidden','class']});message();
  let activePortal=null;
  function openOptions(mode){
    menu.open=false;const dialog=studioDialog(mode==='canvas'?'Add this design to a canvas':'Editor options','<div class="studio-options-host"></div>');dialog.classList.add('studio-options-modal');dialog.dataset.optionsMode=mode;
    const host=dialog.querySelector('.studio-options-host');host.append(panel);panel.hidden=false;
    const canvas=panel.querySelector('.studio-canvas-placement'),advanced=panel.querySelector('.studio-advanced');canvas.open=mode==='canvas';advanced.open=mode==='advanced';
    activePortal={dialog,mode};
    dialog.addEventListener('close',()=>{home.after(panel);panel.hidden=true;canvas.open=false;advanced.open=false;if(activePortal?.dialog===dialog)activePortal=null;},{once:true});
    dialog.showModal();(mode==='canvas'?panel.querySelector('#cloud-output-select'):panel.querySelector('#cloud-live-updates')).focus();
  }
  const canvasButton=document.createElement('button');canvasButton.type='button';canvasButton.dataset.openCanvasOptions='';canvasButton.textContent='Add to canvas';canvasButton.onclick=()=>openOptions('canvas');
  const advancedButton=document.createElement('button');advancedButton.type='button';advancedButton.dataset.openEditorOptions='';advancedButton.textContent='Editor options';advancedButton.onclick=()=>openOptions('advanced');popover.prepend(advancedButton);const saveButton=toolbar.querySelector('[data-toolbar-save]');saveButton.after(canvasButton);canvasButton.className='studio-action-canvas';const directButton=toolbar.querySelector('[data-toolbar-link]');directButton.className='studio-action-direct';directButton.insertAdjacentHTML('afterbegin','<span aria-hidden="true">↗</span> ');const freshButton=document.getElementById('studio-new-design');freshButton.className='studio-action-new';freshButton.textContent='+ New design';toolbar.querySelector('[data-toolbar-library]').after(freshButton);global.studioStartNewDesign=(kind=designs.state().kind)=>{if(!global.studioGuardOverlayChange?.(()=>designs.fresh(kind,{confirmed:true})))designs.fresh(kind,{confirmed:true});};freshButton.onclick=()=>global.studioStartNewDesign();
  const picker=document.querySelector('label[for="cloud-variant-select"]');
  left.prepend(picker);
  const library=toolbar.querySelector('[data-toolbar-library]');
  library.textContent='Browse designs';
  popover.prepend(library);
  library.addEventListener('click',()=>{menu.open=false;});
  new MutationObserver(()=>{if(activePortal?.mode==='canvas'&&/^Added .+ to .+; arrange/.test(status.textContent))activePortal.dialog.close();}).observe(status,{childList:true});
  function syncPublishing(){const busy=designs.state().busy;toolbar.querySelectorAll('[data-toolbar-save],[data-toolbar-link],[data-toolbar-library],#studio-new-design,[data-open-canvas-options]').forEach(button=>button.disabled=busy);}
  global.addEventListener('studio:busy',syncPublishing);syncPublishing();
  const revert=document.createElement('button');revert.type='button';revert.id='studio-revert-saved';revert.textContent='Revert to last save';toolbar.querySelector('[data-toolbar-save]').before(revert);revert.className='studio-revert-action';
  function syncRevert(){revert.disabled=designs.state().busy||!designs.selected()||!designs.state().dirty;revert.title=!designs.selected()?'Save this overlay design first.':!designs.state().dirty?'This overlay matches its saved version.':'Discard only this overlay’s unpublished edits.';}
  global.addEventListener('rewardconfig:changed',()=>{syncRevert();if(!status.classList.contains('is-error'))status.textContent='';});global.addEventListener('rewardconfig:tabchanged',syncRevert);global.addEventListener('studio:designloaded',syncRevert);new MutationObserver(syncRevert).observe(document.querySelector('#cloud-variant-select'),{childList:true});syncRevert();
  revert.onclick=()=>{
    menu.open=false;const selected=designs.selected();if(!selected)return;
    const dialog=studioDialog('Revert this overlay?','<p>Your unpublished edits to <strong>'+escapeHtml(selected.name)+'</strong> will be replaced by its latest saved version. Saved history and Direct links stay intact.</p><p data-revert-status role="status"></p><div class="studio-decision-actions"><button type="button" data-revert-cancel>Keep editing</button><button type="button" data-revert-confirm class="btn-primary">Revert to last save</button></div>');dialog.classList.add('studio-decision-dialog');dialog.querySelector('[data-revert-cancel]').onclick=()=>dialog.close();dialog.querySelector('[data-revert-confirm]').onclick=async event=>{event.currentTarget.disabled=true;try{await designs.revert();dialog.close();}catch(error){dialog.querySelector('[data-revert-status]').textContent=error.message;event.currentTarget.disabled=false;}};dialog.showModal();dialog.querySelector('[data-revert-cancel]').focus();
  };
  let navigating=false;
  global.studioRequestNavigation=async action=>{
    if(navigating)return false;
    const embedded=global.studioActiveOverlayEditor?.(),dirty=embedded?.studioOverlayDirty?.()||global.studioHasUnsavedEdits?.();
    if(!dirty){action();return true;}
    return new Promise(resolve=>{const dialog=studioDialog('Discard unsaved changes?','<p>Your changes have not been saved. Discard them to continue, or keep editing.</p><div class="studio-decision-actions"><button type="button" data-discard-cancel class="btn-primary">Keep editing</button><button type="button" data-discard-confirm>Discard changes</button></div>');dialog.classList.add('studio-decision-dialog');
      dialog.querySelector('[data-discard-cancel]').onclick=()=>{dialog.close();resolve(false);};dialog.querySelector('[data-discard-confirm]').onclick=()=>{embedded?.studioOverlayDiscard?.();designs.discard();dialog.close();navigating=true;try{action();}finally{navigating=false;}resolve(true);};dialog.showModal();dialog.querySelector('[data-discard-cancel]').focus();});
  };
  global.studioGuardOverlayChange=action=>{if(navigating||!global.studioHasUnsavedEdits?.())return false;global.studioRequestNavigation(action);return true;};
  document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(event.defaultPrevented||!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||link.target==='_blank'||link.hasAttribute('download')||link.closest('dialog')||link.hasAttribute('data-graphic-menu'))return;const url=new URL(link.href,location.href);if(!['http:','https:'].includes(url.protocol)||url.href===location.href||!global.studioHasUnsavedEdits?.())return;event.preventDefault();global.studioRequestNavigation(()=>{global.studioAllowNavigation=true;location.assign(url.href);});});
})(window);
