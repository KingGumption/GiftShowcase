// Real-provider smoke test. Use an ignored local .dev.vars via Node's --env-file.
// Logs aggregate event counts only; never logs keys, source tokens or viewer details.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),cloud=path.join(root,'Widget/cloudflare'),require=createRequire(path.join(cloud,'package.json'));
const {Miniflare,Response}=require('miniflare');
const bundleDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'giftshowcase-live-smoke-')),bundle=path.join(bundleDirectory,'worker.js');
await require('esbuild').build({entryPoints:[path.join(cloud,'src/worker.mjs')],bundle:true,format:'esm',platform:'browser',outfile:bundle});
assert(process.env.EULER_API_KEY,'Load EULER_API_KEY from ignored local development secrets.');
const mf=new Miniflare({workers:[{name:'live-smoke',modules:true,modulesRoot:bundleDirectory,scriptPath:bundle,compatibilityDate:'2026-07-18',
  durableObjects:{DOCK_HUBS:{className:'DockHub',useSQLite:true},CREATOR_LIVE:{className:'CreatorLive',useSQLite:true}},d1Databases:['DB'],
  bindings:{SHARED_LIVE_ENABLED:'true',EULER_API_KEY:process.env.EULER_API_KEY,REGISTRATION_ENABLED:'true',ALLOWED_ORIGINS:'*'},serviceBindings:{ASSETS:async()=>new Response(null,{status:404})}}]});
try{
 const origin=(await mf.ready).origin,db=await mf.getD1Database('DB');
 for(const sql of fs.readFileSync(path.join(cloud,'schema.sql'),'utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 async function api(route,method='GET',body,token){const r=await fetch(origin+'/api/v1'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),v=await r.json();assert(r.ok,v.error||'Local API failure');return v;}
 const a=await api('/auth/register','POST',{email:'real-smoke@example.invalid',password:'real-local-smoke-password-2026'}),token=a.session.token;
 const routes=[];
 for(let i=0;i<2;i++){const v=(await api('/variants','POST',{name:'Local source '+i,overlayKind:'goal',config:{}},token)).variant,link=await api('/variants/'+v.id+'/direct-link','POST',{},token);routes.push(link.publicToken);}
 routes.push((await api('/docks','GET',undefined,token)).docks[0].publicToken);
 const sockets=[],counts=routes.map(()=>({}));
 for(const [i,source]of routes.entries()){
   const r=await mf.dispatchFetch(origin+'/api/v1/public/live/'+source,{headers:{Upgrade:'websocket'}});assert.equal(r.status,101);
   const socket=r.webSocket;socket.accept();socket.addEventListener('message',e=>{let value;try{value=JSON.parse(e.data);}catch{return;}if(value.event)counts[i][value.event]=(counts[i][value.event]||0)+1;});sockets.push(socket);
 }
 const configured=await api('/tiktok','POST',{username:process.argv[2]||'typicalgamer'},token);assert(!configured.message,configured.message);
 for(let i=0;i<30&&!counts.every(c=>Object.values(c).reduce((a,b)=>a+b,0)>5);i++)await new Promise(r=>setTimeout(r,1000));
 assert(counts.every(c=>Object.values(c).reduce((a,b)=>a+b,0)>0),'No live events received by all three sources');
 const status=await api('/tiktok','GET',undefined,token);assert.equal(status.phase,'connected');assert.equal(status.subscribers,3);
 console.log(JSON.stringify({runtime:'local Cloudflare workerd',username:process.argv[2]||'typicalgamer',phase:status.phase,directSources:2,canvases:1,counts}));
 await api('/tiktok','DELETE',undefined,token);for(const socket of sockets)socket.close(1000,'Verification complete');
}finally{await mf.dispose();fs.rmSync(bundleDirectory,{recursive:true,force:true});}
