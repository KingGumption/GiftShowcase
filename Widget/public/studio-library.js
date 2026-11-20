(function(global){
  'use strict';
  const designs=global.studioDesigns;if(!designs)return;
  const labels={carousel:'Gift Carousel',rows:'Reward Rows','side-gifts':'Side Gifts',goal:'Goal Bar','top-likers':'Top Likers'};
  const toolbar=document.createElement('div');toolbar.className='studio-sticky-toolbar';toolbar.setAttribute('aria-label','Current design actions');
  toolbar.innerHTML='<div><strong data-current-design>New design</strong><small data-save-summary></small></div><button type="button" id="studio-design-library" data-toolbar-library>Designs</button><button type="button" data-toolbar-save class="btn-primary">Save</button><button type="button" data-toolbar-test>Test</button><button type="button" data-toolbar-link>Direct link</button>';
  document.querySelector('.reward-config-header').after(toolbar);
  toolbar.querySelector('[data-toolbar-save]').onclick=()=>designs.save();
  toolbar.querySelector('[data-toolbar-link]').onclick=()=>document.querySelector('#cloud-direct-link').click();
  toolbar.querySelector('[data-toolbar-test]').onclick=()=>{const button=document.querySelector('.rows-inspector [data-test-card]');if(button&&!button.closest('[hidden]'))button.click();else global.studioPreviewSample?.();};
  let paint=0;
  function update(){if(paint)return;paint=requestAnimationFrame(()=>{paint=0;const state=designs.state(),selected=designs.selected();toolbar.hidden=!overlayCloud.signedIn||document.body.classList.contains('studio-output-active');toolbar.querySelector('[data-current-design]').textContent=selected?.name||'Untitled design';toolbar.querySelector('[data-save-summary]').textContent=(state.dirty?'Unpublished draft':selected?'Saved Â· revision '+selected.revision:'Not saved')+(state.live?' Â· Live editing enabled':'');toolbar.title=state.placement;});}
  global.addEventListener('rewardconfig:changed',update);global.addEventListener('rewardconfig:tabchanged',update);global.addEventListener('overlaycloud:session',update);
  new MutationObserver(update).observe(document.querySelector('#cloud-variant-select'),{childList:true});new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['class']});update();
  const libraryButton=toolbar.querySelector('#studio-design-library');
  const legacyRow=document.querySelector('.cloud-version-row');legacyRow.hidden=true;
  const more=document.querySelector('#cloud-version-menu');more.querySelector('summary').setAttribute('aria-label','More design actions');more.querySelector('summary').title='More design actions';toolbar.append(more);
  const history=document.querySelector('.studio-recovery-tools');history.setAttribute('role','group');history.setAttribute('aria-label','Edit history');toolbar.querySelector('[data-toolbar-library]').before(history);
  const assignment=document.querySelector('.cloud-output-assignment');
  const canvasDetails=document.createElement('details');canvasDetails.className='studio-canvas-placement';canvasDetails.innerHTML='<summary>Add to canvas</summary>';assignment.before(canvasDetails);canvasDetails.append(assignment);
  const direct=document.querySelector('#cloud-direct-link');legacyRow.append(direct);
  document.querySelector('.studio-advanced > summary').textContent='More editor options';
  const freshButton=document.createElement('button');freshButton.type='button';freshButton.textContent='New design';freshButton.id='studio-new-design';freshButton.onclick=()=>global.studioStartNewDesign?global.studioStartNewDesign():designs.fresh();document.querySelector('.cloud-version-menu-popover').prepend(freshButton);
  const rotate=document.createElement('button');rotate.type='button';rotate.textContent='Replace Direct link';rotate.id='studio-rotate-direct-link';rotate.onclick=async()=>{try{await designs.rotate();}catch(error){designs.status(error.message,true);}};document.querySelector('.cloud-version-menu-popover').append(rotate);
  libraryButton.onclick=async()=>{
    const dialog=studioDialog(labels[designs.state().kind]+' designs','<p>Designs for this overlay, recently edited first. A saved design can be shared by several canvases and Direct links.</p><div class="studio-library-filters"><label>Find a design<input data-library-search type="search" placeholder="Search design names"></label><label><input data-show-archive type="checkbox"> Include archived</label><button type="button" data-library-new>New design</button></div><p data-library-status role="status"></p><div class="studio-design-grid"></div>');
    const list=dialog.querySelector('.studio-design-grid'),status=dialog.querySelector('[data-library-status]');
    function draw(){
      const focusedDesign=document.activeElement?.closest('.studio-design-card')?.dataset.designId;
      const query=dialog.querySelector('[data-library-search]').value.toLowerCase(),archive=dialog.querySelector('[data-show-archive]').checked;
      const items=designs.all().filter(item=>item.overlayKind===designs.state().kind&&!global.KGGraphics?.definition(item.overlayKind,item.config)?.live&&(archive||!item.archived)&&(item.name+' '+labels[item.overlayKind]).toLowerCase().includes(query)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
      status.textContent=items.length+' designs';list.replaceChildren();
      for(const design of items){
        const card=document.createElement('article');card.className='studio-design-card';card.dataset.designId=design.id;const thumb=document.createElement('div');thumb.className='studio-design-thumb';
        const gifts=design.overlayKind==='carousel'?design.config.rewards||[]:design.overlayKind==='rows'?design.config.rowsOverlay?.gifts||[]:design.overlayKind==='side-gifts'?design.config.sideGifts?.gifts||[]:[];
        for(const gift of gifts.filter(item=>item.enabled!==false).slice(0,3)){const image=document.createElement('img');image.src=resolveRewardImageUrl(getTriggerIcon(gift)||gift.image||'');image.alt='';image.loading='lazy';if(image.getAttribute('src'))thumb.append(image);}
        if(!thumb.children.length){const bar=document.createElement('span');bar.className='studio-design-sample-bar';bar.style.backgroundColor=design.config.goalBar?.accent||design.config.topLikers?.title||'#a78bca';thumb.append(bar);}
        const heading=document.createElement('h3');heading.textContent=design.name;const detail=document.createElement('p');detail.textContent=labels[design.overlayKind]+' Â· '+new Date(design.updatedAt).toLocaleDateString()+(design.archived?' Â· Archived':'');card.append(thumb,heading,detail);
        const actions=document.createElement('div');actions.className='studio-library-actions';const primary=document.createElement('div');primary.className='studio-library-primary-actions';const menu=document.createElement('details');menu.className='studio-library-menu';const menuLabel=document.createElement('summary');menuLabel.textContent='More';menuLabel.setAttribute('aria-label','More actions for '+design.name);menu.append(menuLabel,actions);menu.addEventListener('toggle',()=>{if(menu.open)dialog.querySelectorAll('.studio-library-menu').forEach(other=>{if(other!==menu)other.open=false;});});menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;menuLabel.focus();}});
        for(const label of ['Open','Duplicate','Rename',design.archived?'Unarchive':'Archive','Copy editor link','History']){
          const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=async()=>{
            button.disabled=true;
            try{
              if(label==='Open'||label==='History'){designs.open(design.id);dialog.close();if(label==='History')document.querySelector('#cloud-revision-history').click();return;}
              if(label==='Duplicate'){await designs.duplicate(design.id);await designs.refresh();draw();}
              else if(label==='Rename'){const name=prompt('Design name',design.name);if(name?.trim())await designs.rename(design.id,name.trim());draw();}
              else if(label==='Archive'||label==='Unarchive'){await designs.archive(design.id,!design.archived);draw();}
              else{const url=new URL('/studio/',location.origin);url.searchParams.set('design',design.id);url.searchParams.set('kind',design.overlayKind);await navigator.clipboard.writeText(url.href);status.textContent='Editor link copied. Sign-in is required to open it.';}
            }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
          };if(label==='Open'){button.className='btn-primary';primary.append(button);}else actions.append(button);
        }
        primary.append(menu);card.append(primary);list.append(card);
      }
      if(focusedDesign){const next=[...list.children].find(card=>card.dataset.designId===focusedDesign);(next?.querySelector('button')||dialog.querySelector('[data-library-search]')).focus({preventScroll:true});}
      if(!items.length)list.textContent='No designs match. Start a new design or include archived designs.';
    }
    dialog.querySelector('[data-library-search]').oninput=draw;dialog.querySelector('[data-show-archive]').onchange=draw;dialog.querySelector('[data-library-new]').onclick=()=>{dialog.close();global.studioStartNewDesign?global.studioStartNewDesign():designs.fresh();};dialog.showModal();dialog.querySelector('input').focus();
    try{await designs.refresh();draw();}catch(error){status.textContent=error.message;}
  };
})(window);
