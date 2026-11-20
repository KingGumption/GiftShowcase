(function(global){
  'use strict';
  global.createStudioRevisions=function({cloud,editor,selected,restored,status,dirty,flush}){
    const button=document.createElement('button');button.type='button';button.id='cloud-revision-history';button.textContent='Version history';
    document.querySelector('.cloud-version-menu-popover').append(button);
    const dialog=document.createElement('dialog');dialog.className='studio-history-dialog';dialog.setAttribute('aria-labelledby','studio-history-heading');
    dialog.innerHTML='<header><div><h2 id="studio-history-heading">Version history</h2><p>Preview an earlier save, then restore it as a new revision. Your Direct link stays the same.</p></div><button type="button" data-history-close aria-label="Close version history">×</button></header><label>Saved version<select data-history-select></select></label><p data-history-status role="status"></p><div class="studio-history-preview"><iframe title="Saved version preview" sandbox="allow-scripts allow-same-origin"></iframe></div><footer><button type="button" data-history-cancel>Cancel</button><button type="button" data-history-restore class="btn-primary" disabled>Restore as new revision</button></footer>';
    document.body.append(dialog);
    const select=dialog.querySelector('select'),frame=dialog.querySelector('iframe'),restore=dialog.querySelector('[data-history-restore]'),note=dialog.querySelector('[data-history-status]');
    let variant=null,revision=null,sequence=0;
    let previewHeight=300,fitRaf=0;
    const previewBox=frame.parentElement;
    function fit(){
      if(fitRaf||!dialog.open)return;
      fitRaf=requestAnimationFrame(()=>{fitRaf=0;if(!dialog.open)return;const scale=Math.min((previewBox.clientWidth-24)/1080,(previewBox.clientHeight-24)/previewHeight,1);frame.style.transform='translate(-50%,-50%) scale('+scale+')';});
    }
    frame.addEventListener('load',()=>{
      try{const root=frame.contentDocument.querySelector('#reward-rows-widget,#rewards-widget,#side-gifts-widget,main,.thin-widget');previewHeight=Math.max(44,Math.ceil(root?.getBoundingClientRect().bottom||300)+20);frame.style.height=previewHeight+'px';fit();}catch{}
    });
    new ResizeObserver(fit).observe(previewBox);
    for(const el of dialog.querySelectorAll('[data-history-close],[data-history-cancel]'))el.onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{sequence++;frame.src='about:blank';revision=null;});
    button.onclick=async()=>{
      variant=selected();if(!variant){status('Save or choose a design to view its history.',true);return;}
      document.querySelector('#cloud-version-menu').open=false;select.innerHTML='';restore.disabled=true;note.textContent='Loading saved versions…';dialog.showModal();
      const request=++sequence;
      try{
        const result=await cloud.listVariantRevisions(variant.id);if(request!==sequence)return;if(result.currentRevision)variant={...variant,revision:result.currentRevision};
        for(const item of result.revisions){const option=new Option('Revision '+item.revision+' · '+new Date(item.createdAt).toLocaleString()+(item.revision===variant.revision?' · Current':''),String(item.revision));select.add(option);}
        if(!select.options.length){note.textContent='No saved versions available.';return;}
        await preview();select.focus();
      }catch(error){note.textContent=error.message;}
    };
    async function preview(){
      const request=++sequence;revision=null;restore.disabled=true;note.textContent='Loading preview…';
      try{
        const result=await cloud.getVariantRevision(variant.id,select.value);if(request!==sequence)return;
        revision=Number(select.value);
        const pages={carousel:'index-rewards.html',rows:'index-rewards-rows.html','side-gifts':'index-side-gifts-test.html',goal:'index-thin.html','top-likers':'index-top-likers-test.html'};
        const previewUrl=getUrlForPage(pages[variant.overlayKind],normalizeConfig(result.config),{preview:true,mute:true,previewFit:true});
        previewUrl.searchParams.set('historyRevision',variant.id+':'+revision);
        frame.src=String(previewUrl);
        note.textContent='Previewing revision '+revision+'. Restoring updates every browser source using this design.';
        restore.disabled=revision===variant.revision;
      }catch(error){if(request===sequence)note.textContent=error.message;}
    }
    select.onchange=preview;
    restore.onclick=async()=>{
      if(!revision)return;
      if(dirty()){note.textContent='Save your draft, or use Save as new, before restoring a saved revision.';return;}
      if(!confirm('Restore revision '+revision+' as a new saved version? Existing browser sources will update.'))return;
      flush();restore.disabled=true;select.disabled=true;
      try{const result=await cloud.restoreVariantRevision(variant.id,revision,variant.revision);await restored(result.variant);dialog.close();}
      catch(error){note.textContent=error.message;restore.disabled=false;}
      finally{select.disabled=false;}
    };
    return {button};
  };
})(window);
