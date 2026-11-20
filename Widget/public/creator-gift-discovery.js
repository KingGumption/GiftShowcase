(function(global){
  'use strict';
  function extract(raw) {
    try {
      const message=typeof raw==='string'?JSON.parse(raw):raw;
      if(String(message?.event||'').toLowerCase()!=='gift') return null;
      const data=message.data||{};
      const sources=[data.extendedGiftInfo,data.giftDetails,data.gift].filter(gift=>gift&&typeof gift==='object');
      const id=String(data.giftId??data.gift_id??sources.map(g=>g.id??g.giftId??g.gift_id).find(value=>value!==undefined)??'');
      const name=String(data.giftName||sources.map(g=>g.name||g.giftName).find(Boolean)||'').trim();
      const amount=data.diamondCount??data.diamond_count??sources.map(g=>g.diamondCount??g.diamond_count).find(value=>value!==undefined&&value!==null);
      const coins=amount===undefined||amount===null||String(amount).trim()===''?null:Number(amount);
      if(!/^[1-9]\d{0,19}$/.test(id)||!name||name.length>160) return null;
      const urls=sources.flatMap(gift=>[gift.imageUrl,gift.pictureUrl,
        ...[gift.image,gift.icon,gift.giftImage].flatMap(image=>Array.isArray(image?.url_list)?image.url_list:Array.isArray(image?.urlList)?image.urlList:[])]).filter(url=>typeof url==='string');
      const image=data.giftPictureUrl||data.giftImageUrl||urls[0]||'';
      // Never infer per-gift cost from a streak total or forward any viewer data.
      return {id,name,coins:Number.isSafeInteger(coins)&&coins>=0&&coins<=10000000?coins:null,
        imageUrl:typeof image==='string'?image:'',urls:urls.slice(0,4)};
    } catch { return null; }
  }
  const pending=new Map(),seen=new Map();
  let timer, sending=false;
  function endpoint() {
    const match=global.location.pathname.match(/^\/(?:widget|output)\/([^/]+)\/?$/);
    const token=match?.[1]||new URLSearchParams(global.location.search).get('dock');
    if(token) return '/api/v1/public/docks/'+encodeURIComponent(decodeURIComponent(token))+'/gifts';
    return null;
  }
  function schedule(delay=2000) {
    if(!timer) timer=global.setTimeout(()=>{timer=null;flush();},delay);
  }
  async function flush() {
    const target=endpoint();
    if(sending||!pending.size||!target) return;
    sending=true;
    const batch=[...pending.values()].slice(0,25);
    try {
      const response=await global.fetch(target,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gifts:batch}),signal:AbortSignal.timeout(15000)});
      if(!response.ok) throw Error('Discovery unavailable');
      batch.forEach(item=>{
        const fingerprint=JSON.stringify(item);
        if(JSON.stringify(pending.get(item.id))===fingerprint) pending.delete(item.id);
        seen.set(item.id,{fingerprint,at:Date.now()});
      });
      if(seen.size>3000) seen.delete(seen.keys().next().value);
    } catch { /* A catalogue outage must never interrupt live event handling. */ }
    finally { sending=false;if(pending.size)schedule(30000); }
  }
  global.creatorGiftDiscovery={extract,flush,observe(raw){
    if(!['http:','https:'].includes(global.location.protocol)||!endpoint()) return;
    const item=extract(raw);if(!item)return;
    const old=seen.get(item.id);
    if(old?.fingerprint===JSON.stringify(item)&&Date.now()-old.at<30*60000)return;
    if(pending.size>=100&&!pending.has(item.id))return;
    pending.set(item.id,item);schedule();
  }};
  global.addEventListener('beforeunload',()=>global.clearTimeout(timer),{once:true});
})(window);
