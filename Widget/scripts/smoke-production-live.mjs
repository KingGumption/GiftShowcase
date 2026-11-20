import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..');
const require=createRequire(path.join(root,'Widget/cloudflare/package.json'));
const {chromium}=require('playwright-core');
const out=path.join(root,'Widget/local-live/outputs');
const sources=JSON.parse(fs.readFileSync(path.join(out,'production-sources.json')));
assert.equal(sources.length,6,'Expected five Direct sources and one Canvas');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1920,height:1080}});
 await context.addInitScript(()=>{window.__liveTest={relayed:[],errors:[]};window.addEventListener('message',e=>{if(e.data?.type==='dock:tiktok-raw'){try{const m=JSON.parse(e.data.data);if(m.event&&m.data?.msgId)window.__liveTest.relayed.push(m.event+':'+m.data.msgId+':'+(m.data.repeatCount||'')+':'+(m.data.repeatEnd||''));}catch{}}});});
 const tests=[];
 for(const source of sources){
  const page=await context.newPage(),test={kind:source.kind,page,events:[],sockets:0,errors:[]};tests.push(test);
  page.on('pageerror',e=>test.errors.push(e.message));
  page.on('websocket',ws=>{if(!new URL(ws.url()).pathname.startsWith('/api/v1/public/live/'))return;test.sockets++;ws.on('framereceived',({payload})=>{try{const m=JSON.parse(String(payload));if(m.event&&m.data?.msgId)test.events.push({at:Date.now(),key:m.event+':'+m.data.msgId+':'+(m.data.repeatCount||'')+':'+(m.data.repeatEnd||''),event:m.event});}catch{}});});
  await page.goto(source.url,{waitUntil:'domcontentloaded'});
 }
 const start=Date.now();console.log('All six production sources loaded; collecting a common live interval.');
 await new Promise(r=>setTimeout(r,45000));const end=Date.now();
 const report={site:'kinggumption.com',username:'typicalgamer',seconds:(end-start)/1000,sources:[]};
 const baseline=tests[0].events.filter(e=>e.at>start+2000&&e.at<end-2000).map(e=>e.key);
 assert(baseline.length>0,'No live events arrived during the production test');
 for(const test of tests){
  const keys=new Set(test.events.map(e=>e.key)),counts={};for(const e of test.events.filter(e=>e.at>=start&&e.at<=end))counts[e.event]=(counts[e.event]||0)+1;
  const missing=baseline.filter(k=>!keys.has(k));
  const frames=[];
  for(const frame of test.page.frames().slice(1)){const state=await frame.evaluate(()=>({relayed:window.__liveTest?.relayed||[],likes:document.querySelector('#like-count')?.textContent,topCount:document.querySelectorAll('#top-likers-list > *').length}));frames.push({relayed:state.relayed.length,missing:baseline.filter(k=>!new Set(state.relayed).has(k)).length,likes:state.likes,topCount:state.topCount});}
  const dom=await test.page.evaluate(()=>({likes:document.querySelector('#like-count')?.textContent,topCount:document.querySelectorAll('#top-likers-list > *').length}));
  report.sources.push({kind:test.kind,sockets:test.sockets,counts,missing:missing.length,frames,dom,errors:test.errors});
  assert.equal(missing.length,0,test.kind+' missed live messages');assert.equal(test.sockets,1,test.kind+' must use exactly one live subscription');assert.deepEqual(test.errors,[]);
  if(test.kind==='canvas'){assert.equal(frames.length,5);assert(frames.every(f=>f.missing===0),'Canvas children missed relayed messages');}
  if(['goal','top-likers','canvas'].includes(test.kind))await test.page.screenshot({path:path.join(out,'production-'+test.kind+'-live.png')});
 }
 fs.writeFileSync(path.join(out,'production-live-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
