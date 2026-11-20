// Full legacy lookup is retained only for configurations that need it.
(function(){
  let explicit=new URLSearchParams(location.search).get('editorPreview')==='1';
  if(!explicit){try{
    const encoded=new URLSearchParams(location.hash.slice(1)).get('config');
    const hash=encoded?JSON.parse(decodeURIComponent(escape(atob(encoded.replace(/-/g,'+').replace(/_/g,'/'))))):null;
    const config=hash||window.rewardOverlayConfig;
    const lists=config?config._==='r2'?[config.g,config.o?.j,config.z?.m]:[config.rewards,config.rowsOverlay?.gifts,config.sideGifts?.gifts]:[];
    const present=lists.filter(Array.isArray);
    explicit=present.length>0&&present.every(list=>list.every(g=>config._==='r2'?typeof g.m==='string':typeof g.image==='string'&&!g.useGiftImage));
  }catch{}}
  if(explicit)window.rewardImageCatalog=[];
  else document.write('<script src="./reward-image-catalog.js?v=20260701-3"><\/script>');
})();
