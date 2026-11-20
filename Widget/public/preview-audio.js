(function(){
  if(new URLSearchParams(location.search).get('editorPreview')!=='1')return;
  const NativeAudio=window.Audio,playing=new Set();
  window.Audio=function(...args){const audio=new NativeAudio(...args);playing.add(audio);for(const event of ['ended','error'])audio.addEventListener(event,()=>playing.delete(audio),{once:true});return audio;};window.Audio.prototype=NativeAudio.prototype;
  window.studioStopPreviewAudio=()=>{for(const audio of playing)audio.pause();};
  window.addEventListener('pagehide',window.studioStopPreviewAudio);
})();
