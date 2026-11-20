import {checkImageDimensions,acquireCreatorWrite,reserveCreatorImageBudget,creatorImageRetention,storeCreatorCache} from './creator-storage.mjs';
import {safeImageUrl, serveGiftImage, imageType, imageResponse} from './gift-catalogue.mjs';

function invalid(message) { return Object.assign(new Error(message), {status:400}); }
export function normaliseCreatorGift(raw, manual=false) {
  if (!raw || typeof raw !== 'object') throw invalid('Each gift must be an object');
  const id=String(raw.id ?? raw.giftId ?? '').trim();
  const name=String(raw.name ?? raw.giftName ?? '').trim();
  const coinsRaw=raw.coins ?? raw.diamondCount ?? raw.diamond_count;
  const coins=coinsRaw===null || coinsRaw===undefined || String(coinsRaw).trim()==='' ? null : Number(coinsRaw);
  if(!/^[1-9]\d{0,19}$/.test(id)) throw invalid('Gift ID must be a positive numeric TikTok gift ID');
  if(!name || name.length>160) throw invalid('Gift name must contain 1–160 characters');
  if(coins!==null && (!Number.isSafeInteger(coins)||coins<0||coins>10000000)) throw invalid('Coins must be a whole number between 0 and 10000000');
  if(manual && coins===null) throw invalid('Enter the coin value per gift');
  const urls=[raw.imageUrl, typeof raw.image==='string'?raw.image:null,raw.giftPictureUrl,
    ...(Array.isArray(raw.urls)?raw.urls:[]),...(Array.isArray(raw.image?.url_list)?raw.image.url_list:[])].filter(Boolean);
  if(manual && urls.some(url=>!safeImageUrl(url))) throw invalid('Use a TikTok CDN image URL or upload an image file');
  const safe=[...new Set(urls.filter(safeImageUrl))].slice(0,4);
  return {id,name,coins,urls:safe,sourceKey:safe[0]||'no-image',legacyImage:null};
}

export async function listCreatorGifts(env,userId,origin) {
  const rows=await env.DB.prepare('SELECT * FROM creator_gifts WHERE user_id = ? ORDER BY updated_at DESC').bind(userId).all();
  return rows.results.map(row=>{
    const item=JSON.parse(row.metadata_json);
    return {id:item.id,name:item.name,coins:item.coins,source:row.source,updatedAt:row.updated_at,
      image:new URL('/api/v1/gifts/creator-images/'+row.image_token+'.webp',origin).href,
      hasImage:Boolean(item.uploaded||item.urls.length),imageUrl:item.urls[0]||''};
  });
}

export async function saveCreatorGifts(env,userId,input,manual=false) {
  const lease=await acquireCreatorWrite(env,userId,manual);
  const uploaded=[];
  try { return await saveCreatorGiftsLocked(env,userId,input,manual,uploaded); }
  catch(error) {
    for(const key of uploaded) {
      try {
        const current=await env.DB.prepare('SELECT 1 AS found FROM creator_gifts WHERE cached_key=? LIMIT 1').bind(key).first();
        if(!current){await env.GIFT_IMAGES.delete([key]);await env.DB.prepare('DELETE FROM creator_image_objects WHERE object_key=?').bind(key).run();}
      }catch{ /* The retained ledger entry lets the scheduled audit retry cleanup. */ }
    }
    throw error;
  } finally {await lease.release();}
}

async function saveCreatorGiftsLocked(env,userId,input,manual,uploaded) {
  if(!Array.isArray(input.gifts)||!input.gifts.length||input.gifts.length>100) throw invalid('Import between 1 and 100 gifts at a time');
  // Validate the whole batch before any database or image write.
  const gifts=input.gifts.map(raw=>({item:normaliseCreatorGift(raw,manual),raw}));
  if(new Set(gifts.map(g=>g.item.id)).size!==gifts.length) throw invalid('The import contains duplicate gift IDs');
  const existing=await env.DB.prepare('SELECT * FROM creator_gifts WHERE user_id = ?').bind(userId).all();
  const oldRows=new Map(existing.results.map(row=>[row.gift_id,row]));
  if(existing.results.length+gifts.filter(g=>!oldRows.has(g.item.id)).length>3000) throw invalid('Your creator gift library supports up to 3000 gifts');
  if(gifts.filter(g=>g.raw.imageData).length>10) throw invalid('Upload at most 10 artwork files per batch');
  for(const gift of gifts) {
    if(gift.raw.imageData) {
      if(!manual) throw invalid('Discovery does not accept uploaded images');
      const match=String(gift.raw.imageData).match(/^data:image\/(?:png|webp|jpeg|gif);base64,([A-Za-z0-9+/=]+)$/);
      if(!match || match[1].length>2800000) throw invalid('Upload a PNG, WebP, JPEG or GIF smaller than 2 MB');
      let bytes;
      try {bytes=Uint8Array.from(atob(match[1]),char=>char.charCodeAt(0));} catch {throw invalid('The uploaded image encoding is invalid');}
      if(bytes.length>2*1024*1024) throw invalid('Image exceeds 2 MB');
      try { gift.type=imageType(bytes); } catch { throw invalid('The uploaded file is not a supported image'); }
      checkImageDimensions(bytes,gift.type);
      gift.bytes=bytes;
    }
  }
  if(gifts.some(g=>g.bytes))await reserveCreatorImageBudget(env,userId,existing.results,gifts.reduce((total,g)=>total+(g.bytes?.length||0),0));
  const now=Date.now();
  const records=[];let stored=0;
  for(const {item,raw,bytes,type} of gifts) {
    const old=oldRows.get(item.id);
    // A manual correction has precedence over potentially incomplete live events.
    if(!manual && old?.source==='manual') continue;
    const previous=old?JSON.parse(old.metadata_json):null;
    const token=old?.image_token||crypto.randomUUID().replaceAll('-','');
    if(item.coins===null && previous) item.coins=previous.coins;
    if(!item.urls.length && previous && !bytes) {
      item.urls=previous.urls;item.sourceKey=previous.sourceKey;item.uploaded=previous.uploaded||false;
    }
    if(!manual && previous && previous.name===item.name && previous.coins===item.coins && previous.sourceKey===item.sourceKey && JSON.stringify(previous.urls)===JSON.stringify(item.urls)) continue;
    let cachedKey=old?.cached_key||null;
    if(bytes) {
      if(!env.GIFT_IMAGES) throw Object.assign(new Error('Image storage unavailable'),{status:503});
      item.sourceKey='upload-'+crypto.randomUUID();item.uploaded=true;
      cachedKey='creator-gifts/'+userId+'/'+token+'/'+item.sourceKey;
      await env.DB.prepare('INSERT INTO creator_image_objects(object_key,user_id,size_bytes,created_at,delete_after) VALUES (?,?,?,?,?)').bind(cachedKey,userId,bytes.length,now,now+creatorImageRetention).run();
      uploaded.push(cachedKey);
      await env.GIFT_IMAGES.put(cachedKey,bytes,{httpMetadata:{contentType:type},customMetadata:{checkedAt:String(now)}});
    }
    records.push({userId,id:item.id,token,metadata:JSON.stringify(item),source:manual?'manual':'tikfinity',cachedKey,createdAt:old?.created_at||now,updatedAt:now});
    stored++;
  }
  if(!manual && records.length) {
    await env.DB.prepare('INSERT INTO creator_gift_state (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING').bind(userId).run();
    const lock=await env.DB.prepare('UPDATE creator_gift_state SET discovery_after = ? WHERE user_id = ? AND discovery_after <= ?').bind(now+10000,userId,now).run();
    if(!lock.meta.changes) throw Object.assign(new Error('Discovery will retry shortly'),{status:429,headers:{'Retry-After':'10'}});
  }
  if(records.length) await env.DB.prepare(`INSERT INTO creator_gifts
    (user_id,gift_id,image_token,metadata_json,source,cached_key,created_at,updated_at)
    SELECT json_extract(value,'$.userId'),json_extract(value,'$.id'),json_extract(value,'$.token'),
      json_extract(value,'$.metadata'),json_extract(value,'$.source'),json_extract(value,'$.cachedKey'),
      json_extract(value,'$.createdAt'),json_extract(value,'$.updatedAt') FROM json_each(?) WHERE 1
    ON CONFLICT(user_id,gift_id) DO UPDATE SET metadata_json=excluded.metadata_json,source=excluded.source,
      cached_key=excluded.cached_key,failed_source=NULL,failed_at=NULL,updated_at=excluded.updated_at
      WHERE excluded.source='manual' OR creator_gifts.source<>'manual'`).bind(JSON.stringify(records)).run();
  // References are committed before any old artwork is retired. Keep seven-day backups.
  for(const record of records){
    if(record.cachedKey)await env.DB.prepare('UPDATE creator_image_objects SET delete_after=NULL WHERE object_key=?').bind(record.cachedKey).run();
    const old=oldRows.get(record.id);
    if(old?.cached_key&&old.cached_key!==record.cachedKey)await env.DB.prepare('UPDATE creator_image_objects SET delete_after=? WHERE object_key=?').bind(now+creatorImageRetention,old.cached_key).run();
  }
  return {saved:stored};
}

export async function creatorGiftImage(env,token,head=false) {
  const row=await env.DB.prepare('SELECT * FROM creator_gifts WHERE image_token = ?').bind(token).first();
  if(!row) return new Response('Gift image not found',{status:404});
  const item=JSON.parse(row.metadata_json);
  if(item.uploaded && row.cached_key) {
    const object=await env.GIFT_IMAGES?.get(row.cached_key);
    if(object) return imageResponse(object,false,head);
  }
  if(!item.urls.length) return new Response(head?null:'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect x="18" y="38" width="60" height="44" rx="6" fill="#a78bca"/><path d="M48 28v54M14 36h68v16H14z" fill="#d8c4ef"/><path d="M48 32C20 32 26 8 38 16L48 32C76 32 70 8 58 16z" fill="none" stroke="#d8c4ef" stroke-width="6"/></svg>',
    {headers:{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=60','X-Gift-Image':'needs-artwork','X-Content-Type-Options':'nosniff'}});
  if(!env.GIFT_IMAGES) return new Response('Image cache unavailable',{status:503});
  return serveGiftImage(env,row,'creator-gifts/'+row.user_id+'/'+token+'/',{head,store:(key,bytes,options)=>storeCreatorCache(env,row.user_id,key,bytes,options)},async(fields,values,sourceKey)=>{
    const result=await env.DB.prepare('UPDATE creator_gifts SET '+fields+" WHERE image_token = ? AND json_extract(metadata_json, '$.sourceKey') = ?")
      .bind(...values,token,sourceKey).run();
    if(result.meta.changes&&fields.startsWith('cached_key')){
      await env.DB.prepare('UPDATE creator_image_objects SET delete_after=NULL WHERE object_key=?').bind(values[0]).run();
      if(row.cached_key&&row.cached_key!==values[0])await env.DB.prepare('UPDATE creator_image_objects SET delete_after=? WHERE object_key=? AND NOT EXISTS (SELECT 1 FROM creator_gifts WHERE cached_key=?)').bind(Date.now()+creatorImageRetention,row.cached_key,row.cached_key).run();
    }
  });
}
