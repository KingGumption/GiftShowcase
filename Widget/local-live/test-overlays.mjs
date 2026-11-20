import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {startServer} from './server.mjs';
import {fixtures,overlayEvent} from './bridge.mjs';
import {worker,env} from '../scripts/studio-test-support.mjs';
import {installGraphicHubs} from '../scripts/graphics-test-hub.mjs';
import '../public/graphics-core.js';

const G=globalThis.KGGraphics, root=fileURLToPath(new URL('../../',import.meta.url));
const art=fs.readFileSync(new URL('../scripts/fixtures/gift-art.png',import.meta.url));
const app=await startServer({port:0,fixtureMode:true}),origin=app.origin,endpoint=origin.replace('http:','ws:')+'/events';
installGraphicHubs(env);
env.ASSETS={async fetch(r){const file=path.resolve(root,new URL(r.url).pathname.slice(1));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return new Response(null,{status:404});return new Response(fs.readFileSync(file),{headers:{'Content-Type':file.endsWith('.html')?'text/html':'text/javascript'}});}};
async function api(route,method='GET',body,token){const r=await worker.fetch(new Request(origin+'/api/v1'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),env);const value=await r.json();assert(r.ok,JSON.stringify(value));return value;}
const account=await api('/auth/register','POST',{email:'local-live@example.invalid',password:'local-test-password-2026'}),token=account.session.token;
const browser=await chromium.launch({executablePath:process.env.STUDIO_BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const report=[],errors=[];
const card={title:'Rose action',enabled:true,giftIds:['5655'],giftNames:['Rose'],triggerType:'gift',image:'/fixture.png',sound:''};
const base={rewards:[card],rowsOverlay:{rows:1,gifts:[card]},sideGifts:{gifts:[card],side:'both'},goalBar:{type:'likes',target:5000,resetOnConnect:true},topLikers:{resetOnConnect:true,likeMilestone:0}};
const output=fileURLToPath(new URL('./outputs/',import.meta.url));fs.mkdirSync(output,{recursive:true});
async function send(type,extra={}){const fixture=fixtures.find(x=>x[0]===type && (type!=='gift'||x[1].repeatEnd===1));app.broadcast(overlayEvent(type,{...fixture[1],...extra},'local-room'));}
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',async route=>{
    const r=route.request(),url=new URL(r.url());
    if(url.pathname==='/fixture.png'||url.hostname.endsWith('.r2.dev'))return route.fulfill({contentType:'image/png',body:art});
    if(url.origin!==origin)return route.abort();
    if(url.pathname.startsWith('/api/')){const response=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:r.postDataBuffer()||undefined}),env);return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});}
    return route.continue();
  });
  async function pageFor(file,config,query='') {
    const page=await context.newPage();page.on('pageerror',e=>errors.push(file+': '+e.message));
    await page.addInitScript(config=>{window.directWidgetConfig=config;window.__eventCount=0;const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);this.addEventListener('message',()=>window.__eventCount++);}};},config);
    await page.goto(origin+'/Widget/public/'+file+'?mute=1&endpoint='+encodeURIComponent(endpoint)+query);
    // The first fixture is a readiness handshake through the real local socket.
    await page.waitForFunction(()=>document.readyState==='complete');
    for(let i=0;i<30;i++){app.broadcast({event:'roomUser',data:{msgId:'ready'}});if(await page.evaluate(()=>window.__eventCount>0))return page;await new Promise(r=>setTimeout(r,30));}
    throw Error('No WebSocket feed: '+file);
  }
  for(const [kind,file] of [['carousel','index-rewards.html'],['rows','index-rewards-rows.html'],['side-gifts','index-side-gifts.html'],['goal','index-thin.html'],['top-likers','index-top-likers.html']]){
    const page=await pageFor(file,base);
    if(kind==='goal'){await send('like');await page.waitForFunction(()=>document.querySelector('#like-count').textContent.replace(/,/g,'')==='125');}
    else if(kind==='top-likers'){await send('like');await page.waitForFunction(()=>document.querySelector('#top-likers-list').textContent.includes('Local Viewer'));assert.match(await page.locator('#top-likers-list').innerText(),/125/);}
    else {await send('gift');const expression=kind==='carousel'?()=>isPresentingGift:kind==='rows'?()=>rowGiftAnimationQueues.size>0:()=>sideGiftAnimationQueues.size>0;await page.waitForFunction(expression);}
    await page.screenshot({path:path.join(output,kind+'.png')});report.push({overlay:kind,status:'passed'});await page.close();
  }
  for(const [kind,file] of [['carousel','index-rewards.html'],['rows','index-rewards-rows.html'],['side-gifts','index-side-gifts.html']]){
    for(const type of ['like','follow','share']){
      const trigger={...card,triggerType:type==='like'?'likes':type,likesRequired:100,title:type+' action'};
      const config={...base,rewards:[trigger],rowsOverlay:{rows:1,gifts:[trigger]},sideGifts:{gifts:[trigger],side:'both'}};
      const page=await pageFor(file,config);
      await send(type);
      await page.waitForFunction(kind==='carousel'?()=>isPresentingGift:kind==='rows'?()=>rowGiftAnimationQueues.size>0:()=>sideGiftAnimationQueues.size>0);
      report.push({overlay:kind+'-'+type,status:'passed'});await page.close();
    }
  }
  // Follower and support goals use different counters and need their own assertions.
  for(const [type,event,expected] of [['followers','follow','1'],['support','gift','3']]){
    const page=await pageFor('index-thin.html',{...base,goalBar:{...base.goalBar,type,useLiveFollowerCount:false}});
    if(event==='gift'){app.broadcast(overlayEvent('gift',fixtures[3][1]));await new Promise(r=>setTimeout(r,100));assert.equal(await page.locator('#like-count').textContent(),'0');}
    await send(event);await page.waitForFunction(value=>document.querySelector('#like-count').textContent===value,expected);
    report.push({overlay:'goal-'+type,status:'passed'});await page.close();
  }
  for(const definition of G.definitions){
    const c=structuredClone(base);c[G.key(definition.kind)]={...c[G.key(definition.kind)],graphic:{variant:definition.id,aGift:'5655',bGift:'9999',steps:[{type:'like',target:1000,label:'Likes'}]}};
    const variant=(await api('/variants','POST',{name:'Local '+definition.id,overlayKind:definition.kind,config:c},token)).variant;
    const link=await api('/variants/'+variant.id+'/direct-link','POST',{},token);
    if(definition.live)await api('/variants/'+variant.id+'/live','POST',{action:'start'},token);
    const page=await pageFor('index-graphic.html',c,'&kind='+definition.kind+'&graphicToken='+link.publicToken+'&graphicDesign='+variant.id+'#config='+Buffer.from(JSON.stringify(c)).toString('base64url'));
    // Send the native gift-streak sequence plus likes through the adapter and real socket.
    for(const [event,data]of fixtures)app.broadcast(overlayEvent(event,data,'local-room'));
    const statePath='/public/graphics/'+link.publicToken+'/'+variant.id;
    let state;
    for(let i=0;i<50;i++){state=(await api(statePath)).state;const ready=definition.id==='boss'?state.hp===9997:definition.id==='vote'?state.counts[0]===3:definition.id==='combo'?state.total===3:definition.id==='quest'?state.stepValue===125:['milestone','halo'].includes(definition.id)?state.total===125:['podium','roster'].includes(definition.id)?Object.values(state.people).some(p=>p.total===125):state.active?.giftId==='5655';if(ready)break;await new Promise(r=>setTimeout(r,100));}
    if(definition.id==='boss')assert.equal(state.hp,9997);else if(definition.id==='vote')assert.equal(state.counts[0],3);else if(definition.id==='combo')assert.equal(state.total,3);else if(definition.id==='quest')assert.equal(state.stepValue,125);else if(['milestone','halo'].includes(definition.id))assert.equal(state.total,125);else if(['podium','roster'].includes(definition.id))assert(Object.values(state.people).some(p=>p.total===125));else assert.equal(state.active?.giftId,'5655');
    await page.waitForFunction(()=>!document.querySelector('#graphic-root').hidden);await page.screenshot({path:path.join(output,definition.id+'.png')});
    report.push({overlay:definition.id,status:'passed'});await page.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({mode:'simulated native connector events over local WebSocket; real renderers and in-memory Worker/D1/graphics hubs',results:report,errors},null,2));
  console.log(JSON.stringify(report,null,2));console.log('Passed '+report.length+' overlay cases. No live TikTok stream was used.');
}finally{await browser.close();await app.close();}
