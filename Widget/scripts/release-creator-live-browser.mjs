import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import os from 'node:os';
import '../public/graphics-core.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),cloud=path.join(root,'Widget/cloudflare');
const require=createRequire(path.join(cloud,'package.json')),{Miniflare,Response,WebSocketPair,convertV4MiniflareOptions}=require('miniflare'),{chromium}=require('playwright-core');
const G=globalThis.KGGraphics,upstreams=[],errors=[],socketUrls=[],out=path.join(root,'Widget/local-live/outputs/shared');fs.mkdirSync(out,{recursive:true});
const bundleDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'giftshowcase-shared-test-')),bundle=path.join(bundleDirectory,'worker.js');
await require('esbuild').build({entryPoints:[path.join(cloud,'src/worker.mjs')],bundle:true,format:'esm',platform:'browser',outfile:bundle});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const adapt=convertV4MiniflareOptions||((v)=>v);
const alertRows=[], targets=new Map();
const mf=new Miniflare(adapt({workers:[{name:"shared-live-test",modules:true,modulesRoot:bundleDirectory,scriptPath:bundle,compatibilityDate:'2026-07-18',
  durableObjects:{LIVE_ALERTS:{className:'LiveAlerts',useSQLite:true},DOCK_HUBS:{className:'DockHub',useSQLite:true},CREATOR_LIVE:{className:'CreatorLive',useSQLite:true}},d1Databases:['DB'],
  bindings:{LIVE_ALERT_ORIGIN:'https://studio.example',EULER_ACCOUNT_ID:'1',SHARED_LIVE_ENABLED:'true',EULER_API_KEY:'local-test-key',REGISTRATION_ENABLED:'true',ALLOWED_ORIGINS:'*'},
  serviceBindings:{ASSETS:async request=>{const filename=path.resolve(cloud,'dist',new URL(request.url).pathname.slice(1)||'index.html');if(!filename.startsWith(path.join(cloud,'dist')+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile())return new Response(null,{status:404});return new Response(fs.readFileSync(filename),{headers:{'Content-Type':mime[path.extname(filename)]||'application/octet-stream'}});}},
  outboundService:async request=>{
    const url=new URL(request.url);
    if(url.hostname==='api.eulerstream.com'){
      const parts=url.pathname.split('/alerts/')[1]?.split('/')||[];
      let data;
      if(parts[0]==='list') data={alerts:alertRows};
      if(parts[0]==='create'){const input=await request.json();const alert={id:alertRows.length+1,alert_creator_username:input.unique_id};alertRows.push(alert);data={alert};}
      if(parts[1]==='targets'&&parts[2]==='list') data={targets:targets.has(parts[0])?[targets.get(parts[0])]:[]};
      if(parts[1]==='targets'&&parts[2]==='create'){const input=await request.json();const target={id:1,url:input.url};targets.set(parts[0],target);data={target};}
      return Response.json({code:200,...data});
    }
    if(url.hostname!=='ws.eulerstream.com')return new Response(null,{status:404});
    assert.equal(url.searchParams.get('apiKey'),'local-test-key');const pair=new WebSocketPair();pair[1].accept();upstreams.push({username:url.searchParams.get('uniqueId'),socket:pair[1]});
    return new Response(null,{status:101,webSocket:pair[0]});
  }}]}));
let browser;
try{
  const origin=(await mf.ready).origin,db=await mf.getD1Database('DB');
  for(const statement of fs.readFileSync(path.join(cloud,'schema.sql'),'utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
  async function api(route,method='GET',body,token){const r=await fetch(origin+'/api/v1'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),value=await r.json();assert(r.ok,route+': '+JSON.stringify(value));return value;}
  const accounts=[];
  for(const n of ['a','b']){
    const a=await api('/auth/register','POST',{email:'runtime-'+n+'@example.invalid',password:'local-runtime-password-2026'});a.token=a.session.token;
    await api('/tiktok','POST',{username:'creator_'+n},a.token);accounts.push(a);
  }
  assert.equal(targets.size,2,'both alerts must be armed');
  assert.equal(upstreams.length,2);
  browser=await chromium.launch({executablePath:process.env.STUDIO_BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const backups=[];
  await context.routeWebSocket('ws://localhost:21213/', socket=>{backups.push(socket);});
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();return r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'Widget/scripts/fixtures/gift-art.png'))});});
  const card={title:'Shared Rose',giftIds:['5655'],giftNames:['Rose'],enabled:true,image:'/Widget/public/favicon.svg',triggerType:'gift'};
  const base={rewards:[card],rowsOverlay:{rows:1,gifts:[card]},sideGifts:{gifts:[card]},goalBar:{type:'likes',target:5000},topLikers:{likeMilestone:0}};
  async function open(url){const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('websocket',s=>socketUrls.push(s.url()));await page.goto(url);return page;}
  const sources=[],canvases=[];
  for(const [accountIndex,a]of accounts.entries()){
    const canvas=(await api('/docks', 'GET',undefined,a.token)).docks[0];
    const definitions=accountIndex===0?[...['carousel','rows','side-gifts','goal','top-likers'].map(kind=>({id:'original-'+kind,kind})),...G.definitions]:[{id:'other-goal',kind:'goal'}];
    for(const d of definitions){
      const config=structuredClone(base);if(!d.id.startsWith('original-')&&d.id!=='other-goal')config[G.key(d.kind)]={...config[G.key(d.kind)],graphic:{variant:d.id,aGift:'5655',bGift:'9999',steps:[{type:'like',target:1000,label:'Shared likes'}]}};
      const v=(await api('/variants','POST',{name:d.id,overlayKind:d.kind,config},a.token)).variant;
      const link=await api('/variants/'+v.id+'/direct-link','POST',{},a.token);
      if(d.live)await api('/variants/'+v.id+'/live','POST',{action:'start'},a.token);
      await api('/docks/'+canvas.id+'/items','POST',{variantId:v.id,overlayKind:d.kind,x:0,y:0,width:d.width||500,height:d.height||250},a.token);
      const page=await open(origin+'/widget/'+link.publicToken);sources.push({page,definition:d,variant:v,link,owner:accountIndex});
    }
    const page=await open(origin+'/output/'+canvas.publicToken);canvases.push({page,canvas,owner:accountIndex});
  }
  for(const source of sources){await source.page.waitForFunction(()=>Boolean(window.creatorLiveEndpoint));}
  for(const canvas of canvases)await canvas.page.waitForFunction(()=>document.querySelectorAll('iframe').length>0);
  const ownerA=accounts[0],ownerB=accounts[1];
  const studio=await open(origin+'/studio/');
  await studio.fill('#cloud-auth-email','runtime-a@example.invalid');await studio.fill('#cloud-auth-password','local-runtime-password-2026');await studio.click('#cloud-sign-in');
  await studio.waitForSelector('#studio-tiktok:visible');await studio.waitForFunction(()=>document.querySelector('#studio-tiktok-username').value==='creator_a');
  await studio.click('#studio-tiktok summary');
  await studio.click('#studio-tiktok-connect');await studio.waitForFunction(()=>!document.querySelector('#studio-tiktok-connect').disabled);
  assert.equal(upstreams.length,2,'Reconnecting the same username in Studio must reuse the existing connection');
  await studio.screenshot({path:path.join(out,'studio-live-connection.png'),fullPage:true});
  await studio.setViewportSize({width:390,height:900});assert(await studio.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'TikTok connection controls must fit a mobile screen');
  await studio.click('.studio-mobile-menu-toggle');
  await studio.screenshot({path:path.join(out,'studio-live-mobile.png'),fullPage:true});
  // Wait until every Direct URL and both parent Canvases have subscribed to their owner's hub.
  for(let i=0;i<100;i++){
    const a=await api('/tiktok','GET',undefined,ownerA.token),b=await api('/tiktok','GET',undefined,ownerB.token);
    if(a.subscribers===20&&b.subscribers===2)break;
    if(i===99)throw Error('Wrong subscriber counts: '+JSON.stringify({a:a.subscribers,b:b.subscribers}));await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(upstreams.length,2,'All Direct URLs and Canvases must share only one upstream per creator');
  const like={type:'WebcastLikeMessage',data:{common:{msgId:'shared-like'},likeCount:125,totalLikeCount:125,user:{idStr:'viewer-1',uniqueId:'local_viewer',nickname:'Local Viewer'}}};
  const gift={type:'WebcastGiftMessage',data:{common:{msgId:'shared-gift'},giftId:5655,giftDetails:{giftName:'Rose',giftType:1,diamondCount:1},repeatCount:3,repeatEnd:1,user:{idStr:'viewer-1',nickname:'Local Viewer'}}};
  upstreams[0].socket.send(JSON.stringify({messages:[like,gift,like,gift]}));
  for(const source of sources.filter(s=>s.owner===0)){
    const {page,definition:d}=source;
    if(d.id==='original-goal')await page.waitForFunction(()=>document.querySelector('#like-count').textContent==='125');
    else if(d.id==='original-top-likers')await page.waitForFunction(()=>document.querySelector('#top-likers-list').textContent.includes('125'));
    else if(d.id==='original-carousel')await page.waitForFunction(()=>isPresentingGift);
    else if(d.id==='original-rows')await page.waitForFunction(()=>rowGiftAnimationQueues.size>0);
    else if(d.id==='original-side-gifts')await page.waitForFunction(()=>sideGiftAnimationQueues.size>0);
    else{
      const route='/public/graphics/'+source.link.publicToken+'/'+source.variant.id;
      let state;for(let i=0;i<80;i++){state=(await api(route)).state;if(state.total>0||state.hp<10000||state.counts[0]>0||state.stepValue>0||state.active||Object.keys(state.people).length)break;await new Promise(r=>setTimeout(r,100));}
      if(d.id==='combo')assert.equal(state.total,3);else if(d.id==='boss')assert.equal(state.hp,9997);else if(d.id==='vote')assert.equal(state.counts[0],3);else if(d.id==='quest')assert.equal(state.stepValue,125);else if(['milestone','halo'].includes(d.id))assert.equal(state.total,125);else if(['podium','roster'].includes(d.id))assert(Object.values(state.people).some(p=>p.total===125));else assert.equal(state.active.giftId,'5655');
    }
  }
  const other=sources.find(s=>s.owner===1);assert.equal(await other.page.locator('#like-count').textContent(),'0','Creator B must not receive Creator A events');
  upstreams[1].socket.send(JSON.stringify({messages:[{...like,data:{...like.data,likeCount:7,totalLikeCount:7}}]}));await other.page.waitForFunction(()=>document.querySelector('#like-count').textContent==='7');
  const canvasGoal=canvases[0].page.frames().find(f=>f.url().includes('index-thin.html'));await canvasGoal.waitForFunction(()=>document.querySelector('#like-count').textContent==='125');
  // Real offline close, authenticated webhook, and retries through the deployed routing shape.
  assert.equal(targets.size,2);
  const startURL = new URL(targets.get('1').url);
  const deliver = (path=startURL.pathname) => fetch(origin+path,{method:'POST'});
  await studio.check('#studio-tiktok-backup');
  for(let i=0;i<50 && !(await api('/tiktok','GET',undefined,ownerA.token)).tikfinityBackup;i++)await new Promise(r=>setTimeout(r,100));
  assert.equal(backups.length,0);
  upstreams[0].socket.close(4404,'Not live');
  for(let i=0;i<50;i++){
    if((await api('/tiktok','GET',undefined,ownerA.token)).phase==='offline')break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert.equal((await api('/tiktok','GET',undefined,ownerA.token)).phase,'offline');
  for(let i=0;i<100 && backups.length<20;i++)await new Promise(r=>setTimeout(r,100));
  assert.equal(backups.length,20,'19 Direct URLs and one Canvas parent use the local backup');
  for(const socket of backups)socket.send(JSON.stringify({event:'like',data:{msgId:'backup-like',likeCount:8,totalLikeCount:133}}));
  await canvasGoal.waitForFunction(()=>document.querySelector('#like-count').textContent==='133');
  await sources.find(s=>s.definition.id==='original-goal').page.waitForFunction(()=>document.querySelector('#like-count').textContent==='133');
  assert.equal(await other.page.locator('#like-count').textContent(),'7');
  assert.equal((await deliver(startURL.pathname.slice(0,-36)+crypto.randomUUID())).status,404);
  assert.equal(upstreams.length,2);
  for(const res of await Promise.all([deliver(),deliver()]))assert.equal(res.status,204);
  assert.equal(upstreams.length,3);
  assert.equal(upstreams[2].username,'creator_a');
  upstreams[2].socket.send(JSON.stringify({messages:[{...like,data:{...like.data,common:{msgId:'after-live-start'},likeCount:19,totalLikeCount:144}}]}));
  await canvasGoal.waitForFunction(()=>document.querySelector('#like-count').textContent==='144');
  // Refresh a Direct URL and a Canvas without touching either upstream.
  await sources[0].page.reload();await canvases[0].page.reload();await sources[0].page.waitForFunction(()=>Boolean(window.creatorLiveEndpoint));assert.equal(upstreams.length,3);
  assert.equal(backups.length,20,'Recovered sources must stay on Euler');
  const status=await api('/tiktok','GET',undefined,ownerA.token);assert(!JSON.stringify(status).includes('local-test-key'));
  await sources.find(s=>s.definition.id==='original-goal').page.screenshot({path:path.join(out,'shared-goal.png'),omitBackground:true});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({runtime:'Cloudflare workerd + SQLite D1 + real Durable Objects',creators:2,directSources:sources.length,canvases:2,upstreamConnections:upstreams.length,isolated:true,duplicateEventsCountedOnce:true,refreshReusesConnection:true,localTikfinityConnections:backups.length,browserErrors:errors},null,2));
  console.log('Shared creator runtime passed: 2 creators, 20 Direct URLs, 2 Canvases, 2 upstreams; all 19 overlay layouts, duplicate suppression, TikFinity failover, recovery, isolation and refresh verified.');
}finally{await browser?.close();await mf.dispose();fs.rmSync(bundleDirectory,{recursive:true,force:true});}
