const budget=10*1024*1024;
export async function routeSounds(request,env,path,api){
  const {requireUser,readJson,randomToken,json,httpError,enforceAuthRateLimit}=api;
  const publicMatch=path.match(/^\/v1\/sounds\/([A-Za-z0-9_-]{40,50})\.wav$/);
  if(publicMatch&&['GET','HEAD'].includes(request.method)){
    const row=await env.DB.prepare('SELECT * FROM user_sounds WHERE public_token=? AND ready=1').bind(publicMatch[1]).first();
    if(!row)return new Response('Sound unavailable',{status:404,headers:{'Cache-Control':'no-store'}});
    const object=await env.GIFT_IMAGES?.get(row.object_key);if(!object)return new Response('Sound unavailable',{status:404});
    return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':'audio/wav','Content-Length':String(row.size_bytes),'Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff'}});
  }
  if(path==='/v1/sounds'){
    const user=await requireUser(request,env);
    if(request.method==='GET'){
      const result=await env.DB.prepare('SELECT id,name,public_token,size_bytes,duration_ms,created_at,deleted_at FROM user_sounds WHERE user_id=? AND ready=1 ORDER BY created_at DESC').bind(user.id).all();
      const usage=await env.DB.prepare('SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM user_sounds WHERE user_id=?').bind(user.id).first();
      return json({sounds:result.results.map(row=>({id:row.id,name:row.name,url:new URL('/api/v1/sounds/'+row.public_token+'.wav',request.url).href,bytes:row.size_bytes,durationMs:row.duration_ms,createdAt:row.created_at,removed:Boolean(row.deleted_at)})),usedBytes:Number(usage.bytes),maxBytes:budget});
    }
    if(request.method==='POST'){
      await enforceAuthRateLimit(request,env,'sound-upload',user.id);
      const input=await readJson(request,2100000),name=String(input.name||'').trim();
      if(!name||name.length>80)throw httpError(400,'Sound names must contain 1–80 characters');
      const match=String(input.data||'').match(/^data:audio\/wav;base64,([A-Za-z0-9+/=]+)$/);if(!match||match[1].length>1920100)throw httpError(400,'Use a trimmed sound of up to 30 seconds');
      let bytes;try{bytes=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));}catch{throw httpError(400,'Invalid sound encoding');}
      const durationMs=validateWave(bytes,httpError),id=crypto.randomUUID(),token=randomToken(32),key='user-sounds/'+user.id+'/'+id+'.wav',now=new Date().toISOString();
      const reserved=await env.DB.prepare(`INSERT INTO user_sounds(id,user_id,public_token,name,object_key,mime,size_bytes,duration_ms,created_at,ready)
        SELECT ?,?,?,?,?,?,?,?,?,0 WHERE (SELECT COALESCE(SUM(size_bytes),0) FROM user_sounds WHERE user_id=?)+?<=? AND (SELECT COUNT(*) FROM user_sounds WHERE user_id=?)<50`)
        .bind(id,user.id,token,name,key,'audio/wav',bytes.length,durationMs,now,user.id,bytes.length,budget,user.id).run();
      if(!reserved.meta.changes)throw httpError(413,'Your sound library allows 10 MiB and 50 sounds, including removed sounds retained for saved designs.');
      try{await env.GIFT_IMAGES.put(key,bytes,{httpMetadata:{contentType:'audio/wav'}});await env.DB.prepare('UPDATE user_sounds SET ready=1 WHERE id=?').bind(id).run();}
      catch(error){try{await env.GIFT_IMAGES.delete([key]);await env.DB.prepare('DELETE FROM user_sounds WHERE id=?').bind(id).run();}catch{}throw error;}
      return json({sound:{id,name,url:new URL('/api/v1/sounds/'+token+'.wav',request.url).href,bytes:bytes.length,durationMs}},201);
    }
  }
  const change=path.match(/^\/v1\/sounds\/([^/]+)$/);
  if(change&&['DELETE','PATCH'].includes(request.method)){
    const user=await requireUser(request,env),row=await env.DB.prepare('SELECT id FROM user_sounds WHERE id=? AND user_id=?').bind(decodeURIComponent(change[1]),user.id).first();if(!row)throw httpError(404,'Sound not found');
    const input=request.method==='PATCH'?await readJson(request,4096):{};
    await env.DB.prepare('UPDATE user_sounds SET deleted_at=? WHERE id=? AND user_id=?').bind(request.method==='PATCH'&&input.restore?null:new Date().toISOString(),row.id,user.id).run();
    return json({ok:true,message:request.method==='DELETE'?'Removed from your picker. Audio is retained for existing designs and version history.':'Sound restored'});
  }
  return null;
}

export function validateWave(bytes,httpError=(status,message)=>Object.assign(new Error(message),{status})){
  if(bytes.length<46||bytes.length>1440044)throw httpError(400,'Sounds must be between 1 sample and 30 seconds');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=(start,end)=>String.fromCharCode(...bytes.slice(start,end));
  if(text(0,4)!=='RIFF'||text(8,12)!=='WAVE'||text(12,16)!=='fmt '||text(36,40)!=='data'||view.getUint32(4,true)!==bytes.length-8||view.getUint32(16,true)!==16||view.getUint16(20,true)!==1||view.getUint16(22,true)!==1||view.getUint32(24,true)!==24000||view.getUint32(28,true)!==48000||view.getUint16(32,true)!==2||view.getUint16(34,true)!==16||view.getUint32(40,true)!==bytes.length-44||(bytes.length-44)%2)throw httpError(400,'Upload a sound prepared by the Studio sound editor (24 kHz mono PCM WAV)');
  return Math.ceil((bytes.length-44)/48);
}

export async function cleanupUserSounds(env){
  const rows=await env.DB.prepare('SELECT id,object_key FROM user_sounds WHERE ready=0 AND created_at<? LIMIT 4').bind(new Date(Date.now()-3600000).toISOString()).all();
  for(const row of rows.results){await env.GIFT_IMAGES.delete([row.object_key]);await env.DB.prepare('DELETE FROM user_sounds WHERE id=? AND ready=0').bind(row.id).run();}
}
export async function deleteAccountSounds(env,userId){
  if(!env.GIFT_IMAGES?.list)return;
  let cursor;do{const page=await env.GIFT_IMAGES.list({prefix:'user-sounds/'+userId+'/',limit:1000,...(cursor?{cursor}:{})});if(page.objects.length)await env.GIFT_IMAGES.delete(page.objects.map(object=>object.key));cursor=page.truncated?page.cursor:null;}while(cursor);
}
