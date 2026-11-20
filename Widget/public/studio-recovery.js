/* Local recovery and bounded edit history. Nothing here publishes a design. */
(function(global) {
  'use strict';
  global.createStudioRecovery = function({editor,cloud,status,revision=()=>null,latest=()=>null}) {
    let owner='', key='', pack=null, timer=0, restoring=false;
    const histories=new Map();
    const copy=value=>JSON.parse(JSON.stringify(value));
    const toolbar=document.createElement('div');toolbar.className='studio-recovery-tools';
    const undo=document.createElement('button'),redo=document.createElement('button');
    undo.type=redo.type='button';undo.textContent='↶ Undo';redo.textContent='↷ Redo';
    undo.title='Undo edit (Ctrl+Z outside text fields)';redo.title='Redo edit (Ctrl+Shift+Z outside text fields)';
    toolbar.append(undo,redo);document.querySelector('#cloud-variant-controls').append(toolbar);
    let currentKind='carousel', selections=new Map(), dirty=new Set();
    function entryKey(kind=currentKind,id=selections.get(kind)||'') {return kind+':'+id;}
    function baseline(kind=currentKind) {histories.set(entryKey(kind),{steps:[editor.getConfigForKind(kind)],at:0,last:0,field:null});updateButtons();}
    function updateButtons(){const h=histories.get(entryKey());undo.disabled=!h||h.at===0;redo.disabled=!h||h.at===h.steps.length-1;}
    function flush() {
      clearTimeout(timer);
      if(!pack||!key||restoring)return;
      pack.kind=currentKind;pack.selections=Object.fromEntries(selections);
      pack.entries[entryKey()]={baseRevision:pack.entries[entryKey()]?.baseRevision??revision(),config:editor.getConfigForKind(currentKind),dirty:dirty.has(currentKind),selection:editor.getSelection(currentKind),updatedAt:Date.now()};
      // Keep the most recent 40 working copies, never let recovery grow without bound.
      const entries=Object.entries(pack.entries).sort((a,b)=>b[1].updatedAt-a[1].updatedAt);
      pack.entries=Object.fromEntries(entries.slice(0,40));
      try{localStorage.setItem(key,JSON.stringify(pack));}catch{status('Local draft could not be stored. Save your design before leaving.',true);}
    }
    function changed() {
      if(restoring||!pack)return;
      dirty.add(currentKind);
      const config=editor.getConfigForKind(currentKind), k=entryKey();
      let h=histories.get(k);if(!h){baseline();h=histories.get(k);}
      const field=document.activeElement;
      if(JSON.stringify(h.steps[h.at])!==JSON.stringify(config)) {
        h.steps=h.steps.slice(0,h.at+1);
        if(h.at>0&&field===h.field&&field?.matches('input,textarea')&&Date.now()-h.last<600)h.steps[h.at]=config;
        else {h.steps.push(config);h.at++;if(h.steps.length>50){h.steps.shift();h.at--;}}
        h.last=Date.now();h.field=field;
      }
      updateButtons();clearTimeout(timer);timer=setTimeout(flush,250);
    }
    function travel(direction) {
      const h=histories.get(entryKey());if(!h||!h.steps[h.at+direction])return;
      h.at+=direction;h.last=0;restoring=true;
      try{editor.loadConfigForKind(currentKind,copy(h.steps[h.at]),'Unsaved changes');}finally{restoring=false;}
      dirty.add(currentKind);global.dispatchEvent(new CustomEvent('rewardconfig:changed'));flush();updateButtons();
    }
    undo.onclick=()=>travel(-1);redo.onclick=()=>travel(1);
    global.addEventListener('keydown',event=>{
      if(!(event.ctrlKey||event.metaKey)||event.altKey||event.target.closest('input,textarea,select,[contenteditable="true"],dialog'))return;
      if(event.key.toLowerCase()==='z'){event.preventDefault();travel(event.shiftKey?1:-1);}
    });
    global.addEventListener('pagehide',flush);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
    global.addEventListener('beforeunload',event=>{flush();if(dirty.size&&!global.studioAllowNavigation){event.preventDefault();event.returnValue='';}});
    global.studioHasUnsavedEdits=()=>dirty.size>0;
    return {
      changed,flush,
      get dirtyCount(){return dirty.size;},
      hasUntitled(kind){return Boolean(pack?.entries[kind+':']?.dirty);},
      baseRevision(id){return pack?.entries[currentKind+':'+id]?.baseRevision??null;},
      rebase(id,value){if(pack?.entries[currentKind+':'+id])pack.entries[currentKind+':'+id].baseRevision=value;},
      restore(selectedIds,dirtyKinds,kind) {
        const nextOwner=cloud.session?.user?.id;if(!nextOwner)return;
        selections=selectedIds;dirty=dirtyKinds;currentKind=kind;
        if(owner===nextOwner)return;
        try{const previousOwner=localStorage.getItem('kg-studio-working-owner');if(previousOwner&&previousOwner!==nextOwner)editor.resetLocal();localStorage.setItem('kg-studio-working-owner',nextOwner);}catch{}
        owner=nextOwner;key='kg-studio-drafts:v1:'+owner;histories.clear();
        try{pack=JSON.parse(localStorage.getItem(key)||'null');}catch{}
        if(!pack||pack.version!==1)pack={version:1,entries:{},selections:{},kind};
        let recovered=false;restoring=true;
        try{
          for(const [k,id] of Object.entries(pack.selections||{}))if(['carousel','rows','side-gifts','goal','top-likers'].includes(k)){
            selections.set(k,id);const entry=pack.entries[k+':'+id];
            if(entry?.config){const saved=latest(id);editor.loadConfigForKind(k,entry.dirty?entry.config:(saved?.config||entry.config));if(!entry.dirty&&saved)entry.baseRevision=saved.revision;if(entry.dirty){dirty.add(k);recovered=true;}}
          }
          if(['carousel','rows','side-gifts','goal','top-likers'].includes(pack.kind))editor.setActiveKind(pack.kind);
        }finally{restoring=false;}
        currentKind=editor.getActiveOverlayKind();editor.selectCard(pack.entries[entryKey()]?.selection);baseline();
        if(recovered){status('Recovered local edits. Save to publish them.');editor.setState('Recovered draft — unsaved changes');}
      },
      switchKind(kind){flush();currentKind=kind;if(!histories.has(entryKey()))baseline();updateButtons();},
      loaded(){if(pack?.entries[entryKey()])pack.entries[entryKey()].baseRevision=revision();baseline();flush();},
      saved(kind,id,config){
        if(!pack)return;
        const previous=histories.get(kind+':'+(pack.selections?.[kind]||''));
        if(previous&&!histories.has(kind+':'+id))histories.set(kind+':'+id,previous);
        pack.entries[kind+':'+id]={baseRevision:revision(),config:copy(config),dirty:dirty.has(kind),selection:editor.getSelection(currentKind),updatedAt:Date.now()};flush();updateButtons();
      },
      recoverSelection(kind,id){const entry=pack?.entries[kind+':'+id];if(!entry?.config||!entry.dirty)return false;editor.loadConfigForKind(kind,entry.config,entry.dirty?'Recovered draft — unsaved changes':'Saved design loaded');if(entry.dirty)dirty.add(kind);else dirty.delete(kind);editor.selectCard(entry.selection);baseline(kind);return true;},
      resetOwner(){clearTimeout(timer);owner='';key='';pack=null;histories.clear();dirty.clear();updateButtons();},
      get restoring(){return restoring;}
    };
  };
})(window);
