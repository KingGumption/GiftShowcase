(function(global){
  'use strict';
  const cloud=global.overlayCloud;let userId='',inflight=null;global.studioSoundLibrary=[];
  async function refresh(){
    if(!cloud?.signedIn){global.studioSoundLibrary=[];return {sounds:[],usedBytes:0,maxBytes:10485760};}
    if(inflight)return inflight;
    const owner=userId;const request=cloud.request('/v1/sounds').then(result=>{if(userId!==owner)throw Error('Account changed; reopen the sound library.');global.studioSoundLibrary=result.sounds;return result;}).finally(()=>{if(inflight===request)inflight=null;});inflight=request;return request;
  }
  global.addEventListener('overlaycloud:session',event=>{const next=event.detail?.user?.id||'';if(next!==userId){userId=next;inflight=null;global.studioSoundLibrary=[];document.querySelectorAll('.sound-library-dialog').forEach(dialog=>dialog.close());if(next)refresh().then(()=>{const panel=document.querySelector('.rows-inspector');if(panel&&rowsSelectedGift)populateSoundSelect(panel,rowsSelectedGift.sound);}).catch(()=>{});}});
  if(cloud?.signedIn){userId=cloud.session.user.id;refresh().then(()=>{const panel=document.querySelector('.rows-inspector');if(panel&&rowsSelectedGift)populateSoundSelect(panel,rowsSelectedGift.sound);}).catch(()=>{});}
  global.openStudioSounds=async function(gift){
    const dialog=studioDialog('Choose a sound','<p>Bundled sounds and your uploads. Sound never changes the card image.</p><label>Find a sound<input type="search" data-sound-search></label><p role="status" data-sound-status>Loading…</p><p class="sound-storage-meter" data-sound-storage></p><div class="sound-library-list"></div><details><summary>Upload and trim a sound</summary><p>MP3, WAV or OGG source, up to 8 MiB. Choose up to 30 seconds. Uploads are converted to mono WAV; 10 MiB and 50 sounds per account. Only upload audio you have permission to use.</p><label>Audio file<input data-sound-file type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4"></label><label>Sound name<input data-sound-name maxlength="80"></label><div class="sound-trim-fields"><label>Start (seconds)<input data-sound-start type="number" min="0" step="0.1" value="0"></label><label>End (seconds)<input data-sound-end type="number" min="0.1" step="0.1" value="10"></label><label>Volume<input data-sound-volume type="range" min="0" max="1" step="0.05" value="0.85"></label></div><button type="button" data-sound-trim-preview disabled>Preview trim</button><p class="sound-size-estimate" data-sound-estimate role="status"></p><button type="button" data-sound-upload disabled>Upload sound</button></details><label><input type="checkbox" data-sounds-removed> Show archived sounds</label><p>Archived sounds stay available to existing designs and history and still count towards storage. Restore an archived sound to use it again. Account deletion removes stored audio.</p>');
    dialog.classList.add('sound-library-dialog');dialog.querySelector('[data-sound-volume]').value=String(gift.volume??.85);const status=dialog.querySelector('[data-sound-status]'),list=dialog.querySelector('.sound-library-list');let catalog={sounds:[],usedBytes:0,maxBytes:10485760},decoded=null,audio=null,audioUrl='',context=null;
    dialog.addEventListener('close',()=>{audio?.pause();if(audioUrl)URL.revokeObjectURL(audioUrl);context?.close();});
    const showStatus=message=>status.textContent=message;
    async function load(){try{catalog=await refresh();render();}catch(error){showStatus(error.message);}}
    function render(){
      const query=dialog.querySelector('[data-sound-search]').value.toLowerCase(),removed=dialog.querySelector('[data-sounds-removed]').checked;
      const items=[...soundCatalog.map(item=>({name:item.label,url:item.sound,bundled:true})),...catalog.sounds.filter(item=>removed||!item.removed)].filter(item=>item.name.toLowerCase().includes(query));
      list.replaceChildren();
      for(const item of items){
        const row=document.createElement('div');row.className='sound-library-row';const text=document.createElement('span');text.textContent=item.name+(item.removed?' · Archived':'')+(item.durationMs?' · '+(item.durationMs/1000).toFixed(1)+'s':'');row.append(text);
        if(item.url){const preview=document.createElement('button');preview.type='button';preview.textContent='Preview';preview.onclick=()=>{audio?.pause();audio=new Audio(item.url);audio.volume=Number(dialog.querySelector('[data-sound-volume]').value);audio.play().catch(()=>showStatus('Audio could not play. Check the file and browser sound permission.'));};row.append(preview);}
        const choose=document.createElement('button');choose.type='button';choose.textContent=item.removed?'Restore':'Use';choose.onclick=async()=>{
          if(item.removed){await cloud.request('/v1/sounds/'+encodeURIComponent(item.id),{method:'PATCH',body:{restore:true}});await load();return;}
          gift.sound=item.url;gift.volume=Number(dialog.querySelector('[data-sound-volume]').value);markDirty();renderRowsWorkspace();dialog.close();
        };row.append(choose);
        if(!item.bundled&&!item.removed){const remove=document.createElement('button');remove.type='button';remove.textContent='Archive';remove.onclick=async()=>{try{await cloud.request('/v1/sounds/'+encodeURIComponent(item.id),{method:'DELETE'});await load();}catch(error){showStatus(error.message);}};row.append(remove);}
        list.append(row);
      }
      dialog.querySelector('[data-sound-storage]').textContent=(catalog.usedBytes/1048576).toFixed(2)+' / 10 MiB used · '+(Math.max(0,catalog.maxBytes-catalog.usedBytes)/1048576).toFixed(2)+' MiB available · '+catalog.sounds.length+' / 50 stored sounds (including archived).';showStatus(items.length+' matching sounds');updateEstimate();
    }
    dialog.querySelector('[data-sound-search]').oninput=render;dialog.querySelector('[data-sounds-removed]').onchange=render;
    dialog.querySelector('[data-sound-file]').onchange=async event=>{
      decoded=null;const file=event.target.files[0];dialog.querySelector('[data-sound-upload]').disabled=dialog.querySelector('[data-sound-trim-preview]').disabled=true;if(!file)return;
      try{if(file.size>8*1024*1024)throw Error('Choose a source file smaller than 8 MiB.');context??=new AudioContext();decoded=await context.decodeAudioData(await file.arrayBuffer());dialog.querySelector('[data-sound-name]').value=file.name.replace(/\.[^.]+$/,'').slice(0,80);dialog.querySelector('[data-sound-end]').value=String(Math.min(30,decoded.duration).toFixed(2));showStatus('Decoded '+decoded.duration.toFixed(1)+'s. Choose the section to upload.');dialog.querySelector('[data-sound-upload]').disabled=dialog.querySelector('[data-sound-trim-preview]').disabled=false;updateEstimate();}
      catch(error){showStatus(error.message||'This audio format could not be decoded. Try MP3, WAV or OGG.');}
    };
    function updateEstimate(){
      const output=dialog.querySelector('[data-sound-estimate]'),button=dialog.querySelector('[data-sound-upload]');if(!decoded){output.textContent='';return;}
      const start=Number(dialog.querySelector('[data-sound-start]').value),end=Number(dialog.querySelector('[data-sound-end]').value),duration=end-start;
      const valid=Number.isFinite(duration)&&start>=0&&end<=decoded.duration+.05&&duration>0&&duration<=30,bytes=44+Math.min(720000,Math.floor(Math.max(0,duration)*24000))*2,remaining=Math.max(0,catalog.maxBytes-catalog.usedBytes);
      const fits=valid&&bytes<=remaining&&catalog.sounds.length<50;button.disabled=!fits;output.classList.toggle('is-error',!fits);output.textContent=!valid?'Choose a valid section of up to 30 seconds.':duration.toFixed(1)+'s · estimated WAV '+(bytes/1048576).toFixed(2)+' MiB · '+(remaining/1048576).toFixed(2)+' MiB available'+(catalog.sounds.length>=50?' · 50 stored-sound limit reached.':bytes>remaining?' · Not enough available storage.':'');
    }
    for(const name of ['start','end'])dialog.querySelector('[data-sound-'+name+']').addEventListener('input',updateEstimate);
    function trimmed(){
      if(!decoded)throw Error('Choose a supported audio file first.');const start=Number(dialog.querySelector('[data-sound-start]').value),end=Number(dialog.querySelector('[data-sound-end]').value);
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>decoded.duration+.05||end<=start||end-start>30)throw Error('Choose a valid section of up to 30 seconds within the file.');
      const samples=Math.min(720000,Math.floor((end-start)*24000)),bytes=new Uint8Array(44+samples*2),view=new DataView(bytes.buffer),put=(offset,text)=>[...text].forEach((c,i)=>bytes[offset+i]=c.charCodeAt(0));
      put(0,'RIFF');view.setUint32(4,bytes.length-8,true);put(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,24000,true);view.setUint32(28,48000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);put(36,'data');view.setUint32(40,samples*2,true);
      const channels=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i));
      for(let i=0;i<samples;i++){const position=(start+i/24000)*decoded.sampleRate,low=Math.floor(position),fraction=position-low;let value=0;for(const data of channels)value+=((data[low]||0)*(1-fraction)+(data[low+1]||0)*fraction)/channels.length;view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,value))*32767),true);}
      return bytes;
    }
    dialog.querySelector('[data-sound-trim-preview]').onclick=()=>{try{const bytes=trimmed();audio?.pause();if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));audio=new Audio(audioUrl);audio.volume=Number(dialog.querySelector('[data-sound-volume]').value);audio.play().catch(()=>showStatus('Could not play audio.'));}catch(error){showStatus(error.message);}};
    dialog.querySelector('[data-sound-upload]').onclick=async event=>{
      const button=event.currentTarget;button.disabled=true;
      try{const bytes=trimmed(),name=dialog.querySelector('[data-sound-name]').value.trim();if(!name)throw Error('Enter a sound name.');let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));await cloud.request('/v1/sounds',{method:'POST',body:{name,data:'data:audio/wav;base64,'+btoa(binary)}});await load();showStatus('Uploaded. Choose Use to assign the sound.');}catch(error){showStatus(error.message);}finally{button.disabled=false;updateEstimate();}
    };
    dialog.showModal();dialog.querySelector('input').focus();await load();
  };
})(window);
