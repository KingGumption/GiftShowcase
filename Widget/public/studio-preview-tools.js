(function(global){
  'use strict';
  const kinds={'carousel-preview':'carousel','rows-preview':'rows','side-gifts-preview':'side-gifts','goal-preview':'goal','top-likers-preview':'top-likers'};
  global.studioPreviewSample=()=>{const kind=rewardConfigEditor.getActiveOverlayKind(),frame=Object.keys(kinds).map(id=>document.getElementById(id)).find(frame=>kinds[frame.id]===kind);frame?.contentWindow?.studioSampleEvent?.();};
  for(const [id,kind] of Object.entries(kinds)){
    const frame=document.getElementById(id),box=frame?.parentElement;if(!frame)continue;
    const controls=document.createElement('div');controls.className='studio-preview-tools';controls.setAttribute('aria-label',kind+' preview controls');
    controls.innerHTML='<button type="button" data-sample-event>Trigger sample</button><button type="button" data-preview-pause aria-pressed="false">Pause</button><span data-preview-size></span>';
    let samples=document.getElementById((kind==='carousel'?'carousel':kind)+'-preview-test');
    if(!samples){const label=document.createElement('label');label.className='preview-test-toggle';samples=document.createElement('input');samples.type='checkbox';samples.id=kind+'-preview-test';samples.checked=true;label.append(samples,document.createTextNode(' Auto-play samples'));const heading=box.parentElement.querySelector('.section-header-row');heading.append(label);samples.onchange=()=>refreshOverlayPreviews();}
    let mute=document.getElementById((kind==='carousel'?'carousel':kind)+'-preview-mute');
    if(kind==='side-gifts'&&!mute){const label=document.createElement('label');mute=document.createElement('input');mute.type='checkbox';mute.id='side-gifts-preview-mute';mute.checked=true;label.append(mute,document.createTextNode(' Mute'));controls.append(label);mute.onchange=()=>{frame.contentWindow?.studioSetPreviewMute?.(mute.checked);if(rowsSelectedGift&&activeConfigTab==='side-gifts')renderRowsInspector();};}
    box.after(controls);
    controls.querySelector('[data-sample-event]').onclick=()=>frame.contentWindow?.studioSampleEvent?.();
    controls.querySelector('[data-preview-pause]').onclick=event=>{const paused=frame.dataset.previewPaused!=='true';frame.dataset.previewPaused=String(paused);event.currentTarget.textContent=paused?'Resume':'Pause';event.currentTarget.setAttribute('aria-pressed',String(paused));syncEditorPreviewActivity();};
    let raf=0,observedWidth=0;
    function fit(){
      if(raf||!frame.hasAttribute('src')||box.closest('[hidden]'))return;
      raf=requestAnimationFrame(()=>{
        raf=0;const config=rewardConfigEditor.getConfigForKind(kind);let width=1080,height;const graphic=window.KGGraphics?.definition(kind,config);if(graphic&&fitCompactGraphicPreview(frame)){controls.querySelector('[data-preview-size]').textContent='Source '+graphic.width+' × '+graphic.height+' px';return;}
        if(kind==='carousel'||kind==='rows'){
          // Renderer-owned geometry must never be replaced with a provisional 0px height.
          fitEditorPreview(frame);height=editorPreviewStates.get(frame)?.nativeHeight;
        }else{
          if(kind==='side-gifts'){width=config.sideGifts.width;height=getEffectiveSideGiftsPreviewHeight(config.sideGifts);}
          else if(kind==='goal'){width=config.goalBar.width;height=config.goalBar.height;}
          else{width=config.topLikers.width;height=getEffectiveTopLikersHeight(config.topLikers);}
          const available=box.clientWidth;if(available<=32||!height)return;
          const scale=Math.min(1,(available-32)/width),stageHeight=Math.max(240,height*scale+32),left=Math.max(16,(available-width*scale)/2),top=Math.max(16,(stageHeight-height*scale)/2);
          frame.style.cssText='position:absolute;margin:0;left:'+left+'px;top:'+top+'px;max-width:none;transform-origin:top left;width:'+width+'px;height:'+height+'px;transform:scale('+scale+')';
          box.style.cssText='position:relative;display:block;padding:0;min-height:0;height:'+Math.ceil(stageHeight)+'px;overflow:hidden';
        }
        controls.querySelector('[data-preview-size]').textContent=height?'Source '+width+' × '+height+' px':'';
      });
    }
    new ResizeObserver(entries=>{const width=Math.floor(entries[0].contentRect.width);if(width!==observedWidth){observedWidth=width;fit();}}).observe(box);
    frame.addEventListener('load',()=>{mute&&frame.contentWindow?.studioSetPreviewMute?.(mute.checked);fit();});
    global.addEventListener('rewardconfig:tabchanged',fit);
    fit();
  }
})(window);

