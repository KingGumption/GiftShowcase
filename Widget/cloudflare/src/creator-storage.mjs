const retention=7*86400000;
const quota=50*1024*1024;
const failure=(message,status=400)=>Object.assign(new Error(message),{status});

export function checkImageDimensions(bytes,type) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let width=0,height=0;
  if(type==='image/png'&&bytes.length>=24){width=view.getUint32(16);height=view.getUint32(20);}
  else if(type==='image/gif'&&bytes.length>=10){width=view.getUint16(6,true);height=view.getUint16(8,true);}
  else if(type==='image/webp'&&bytes.length>=30){
    const tag=String.fromCharCode(...bytes.slice(12,16));
    if(tag==='VP8X'){width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
    else if(tag==='VP8L'&&bytes[20]===0x2f){const bits=view.getUint32(21,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
    else if(tag==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a){width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
  }else if(type==='image/jpeg'){
    let i=2;
    while(i+8<bytes.length){if(bytes[i++]!==0xff)continue;while(bytes[i]===0xff)i++;const marker=bytes[i++];if(marker===0xda||marker===0xd9)break;if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;const size=view.getUint16(i);if(size<2||i+size>bytes.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){height=view.getUint16(i+3);width=view.getUint16(i+5);break;}i+=size;}
  }
  if(!width||!height)throw failure('The uploaded image dimensions could not be read');
  if(width>2048||height>2048||width*height>4194304)throw failure('Gift artwork must be no larger than 2048 × 2048 pixels');
  return {width,height};
}

export async function acquireCreatorWrite(env,userId,manual) {
  const now=Date.now(),token=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO creator_upload_limits(user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING').bind(userId).run();
  const lock=await env.DB.prepare('UPDATE creator_upload_limits SET lock_token=?,lock_until=? WHERE user_id=? AND lock_until<=?').bind(token,now+120000,userId,now).run();
  if(!lock.meta.changes)throw failure('Another gift update is finishing. Please retry shortly.',429);
  try{
    if(manual){
      const result=await env.DB.prepare(`UPDATE creator_upload_limits SET window_start=CASE WHEN window_start<=? THEN ? ELSE window_start END,
        writes=CASE WHEN window_start<=? THEN 1 ELSE writes+1 END WHERE user_id=? AND (window_start<=? OR writes<30)`)
        .bind(now-3600000,now,now-3600000,userId,now-3600000).run();
      if(!result.meta.changes)throw failure('Artwork imports are limited to 30 batches per hour. Please try later.',429);
    }
    return {token,async release(){await env.DB.prepare('UPDATE creator_upload_limits SET lock_until=0,lock_token=NULL WHERE user_id=? AND lock_token=?').bind(userId,token).run();}};
  }catch(error){await env.DB.prepare('UPDATE creator_upload_limits SET lock_until=0,lock_token=NULL WHERE user_id=? AND lock_token=?').bind(userId,token).run();throw error;}
}

export async function reserveCreatorImageBudget(env,userId,rows,additional) {
  // Backfill existing current objects before enforcing the budget; no image data is changed.
  const known=await env.DB.prepare('SELECT object_key FROM creator_image_objects WHERE user_id=?').bind(userId).all();
  const keys=new Set(known.results.map(row=>row.object_key));
  for(const row of rows){if(!row.cached_key||keys.has(row.cached_key))continue;
    const object=env.GIFT_IMAGES.head?await env.GIFT_IMAGES.head(row.cached_key):await env.GIFT_IMAGES.get(row.cached_key);
    const size=object?.size??object?.bytes?.length;
    if(object&&size===undefined)throw failure('Could not verify artwork storage. Please retry.',503);
    if(object)await env.DB.prepare('INSERT INTO creator_image_objects(object_key,user_id,size_bytes,created_at) VALUES (?,?,?,?) ON CONFLICT(object_key) DO NOTHING').bind(row.cached_key,userId,size,Date.now()).run();
  }
  const used=await env.DB.prepare('SELECT COALESCE(SUM(size_bytes),0) AS total FROM creator_image_objects WHERE user_id=?').bind(userId).first();
  if(Number(used.total)+additional>quota)throw failure('Your artwork storage has reached its 50 MB limit, including seven-day replacement backups. Try a smaller image or wait for backups to expire.',413);
}

export async function cleanupCreatorImages(env) {
  if(!env.GIFT_IMAGES)return;
  const now=Date.now();
  const due=await env.DB.prepare('SELECT object_key,user_id FROM creator_image_objects WHERE delete_after IS NOT NULL AND delete_after<=? LIMIT 4').bind(now).all();
  for(const row of due.results){
    let lease;
    try{lease=await acquireCreatorWrite(env,row.user_id,false);}catch(error){if(error.status===429)continue;throw error;}
    try{
      const current=await env.DB.prepare('SELECT delete_after, EXISTS (SELECT 1 FROM creator_gifts WHERE cached_key=?) AS referenced FROM creator_image_objects WHERE object_key=?').bind(row.object_key,row.object_key).first();
      if(!current||current.delete_after===null||current.delete_after>now)continue;
      if(current.referenced){await env.DB.prepare('UPDATE creator_image_objects SET delete_after=NULL WHERE object_key=?').bind(row.object_key).run();continue;}
      await env.GIFT_IMAGES.delete([row.object_key]);
      await env.DB.prepare('DELETE FROM creator_image_objects WHERE object_key=?').bind(row.object_key).run();
    }finally{await lease.release();}
  }

  // Bounded cursor-based orphan audit. Unknown objects receive a full seven-day grace period.
  if(!env.GIFT_IMAGES.list)return;
  const state=await env.DB.prepare('SELECT cursor FROM creator_image_audit_state WHERE id=1').first();
  const page=await env.GIFT_IMAGES.list({prefix:'creator-gifts/',limit:100,...(state?.cursor?{cursor:state.cursor}:{})});
  const objects=page.objects.filter(object=>Number.isFinite(object.size)).map(object=>({key:object.key,userId:object.key.split('/')[1],size:object.size}));
  if(objects.length)await env.DB.prepare(`INSERT INTO creator_image_objects(object_key,user_id,size_bytes,created_at,delete_after)
    SELECT json_extract(value,'$.key'),users.id,json_extract(value,'$.size'),?,
      CASE WHEN EXISTS (SELECT 1 FROM creator_gifts WHERE cached_key=json_extract(value,'$.key')) THEN NULL ELSE ? END
      FROM json_each(?) JOIN users ON users.id=json_extract(value,'$.userId') WHERE 1
    ON CONFLICT(object_key) DO UPDATE SET delete_after=CASE
      WHEN EXISTS (SELECT 1 FROM creator_gifts WHERE cached_key=excluded.object_key) THEN NULL
      ELSE COALESCE(creator_image_objects.delete_after,excluded.delete_after) END`)
    .bind(now,now+retention,JSON.stringify(objects)).run();
  await env.DB.prepare('INSERT INTO creator_image_audit_state(id,cursor) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET cursor=excluded.cursor').bind(page.truncated?page.cursor:null).run();
}

export const creatorImageRetention=retention;

export async function storeCreatorCache(env,userId,key,bytes,options){
  const lease=await acquireCreatorWrite(env,userId,false);
  try{
    checkImageDimensions(bytes,options.httpMetadata.contentType);
    const rows=await env.DB.prepare('SELECT cached_key FROM creator_gifts WHERE user_id=?').bind(userId).all();
    const previous=await env.DB.prepare('SELECT size_bytes FROM creator_image_objects WHERE object_key=?').bind(key).first();
    await reserveCreatorImageBudget(env,userId,rows.results,Math.max(0,bytes.length-Number(previous?.size_bytes||0)));
    await env.DB.prepare(`INSERT INTO creator_image_objects(object_key,user_id,size_bytes,created_at,delete_after) VALUES (?,?,?,?,?)
      ON CONFLICT(object_key) DO UPDATE SET size_bytes=excluded.size_bytes,delete_after=excluded.delete_after`)
      .bind(key,userId,bytes.length,Date.now(),Date.now()+retention).run();
    await env.GIFT_IMAGES.put(key,bytes,options);
  }finally{await lease.release();}
}
