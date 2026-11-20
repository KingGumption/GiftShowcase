import {fileURLToPath} from 'node:url';import os from 'node:os';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import {worker,env,database} from './studio-test-support.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');const require=createRequire(path.join(process.env.STUDIO_TEST_MODULES||path.join(project,'Widget/cloudflare'),'package.json'));const {chromium}=require('playwright-core');const axe=fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const {installGraphicHubs}=await import('./graphics-test-hub.mjs');installGraphicHubs(env);
const dist=path.join(project,'Widget/cloudflare/dist'),origin='https://studio.example.test',out=process.env.STUDIO_RELEASE_ARTIFACTS||path.join(os.tmpdir(),'king-gumption-release-check');
fs.mkdirSync(out,{recursive:true});
const mime={'.css':'text/css','.js':'text/javascript','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'};
const png=fs.readFileSync(path.join(project,'Widget/scripts/fixtures/gift-art.png'));
const soundObjects=new Map();env.GIFT_IMAGES={async put(key,body,options){soundObjects.set(key,{body,...options});},async delete(keys){for(const key of [].concat(keys))soundObjects.delete(key);},async list(){return {objects:[],truncated:false};},async get(key){return soundObjects.get(key)|| {body:png,size:png.length,httpMetadata:{contentType:'image/png'},customMetadata:{checkedAt:String(Date.now())}}},async head(){return {size:png.length}}};
env.ASSETS={async fetch(request){const file=path.resolve(dist,new URL(request.url).pathname.replace(/^\//,'')||'index.html');return file.startsWith(dist+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?new Response(fs.readFileSync(file),{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}}):new Response(null,{status:404});}};
const browser=await chromium.launch({executablePath:process.env.STUDIO_BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(15000);
 await context.addInitScript(()=>{window.WebSocket=class extends EventTarget{static OPEN=1;readyState=1;constructor(url){super();window.__sockets??=[];window.__sockets.push(String(url));}close(){}send(){}};});
 await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(url.hostname.endsWith('.r2.dev'))return route.fulfill({contentType:'image/png',body:png});if(url.origin!==origin)return route.abort();const response=await worker.fetch(new Request(request.url(),{method:request.method(),headers:request.headers(),body:request.postDataBuffer()||undefined}),env);await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});


 // The shared connection service is deployed independently of the local Worker fixture.
 let sharedUsername='',sharedEnabled=false;
 await context.route('**/v1/config',async route=>{
  const req=new Request(route.request().url()),response=await worker.fetch(req,env);
  await route.fulfill({json:{...await response.json(),sharedLiveEnabled:true,accountRecoveryEnabled:true}});
 });
 await context.route('**/v1/tiktok',async route=>{
  if(route.request().method()==='POST'){sharedUsername=route.request().postDataJSON().username;sharedEnabled=true;}
  if(route.request().method()==='DELETE')sharedEnabled=false;
  await route.fulfill({json:{configured:true,enabled:sharedEnabled,phase:sharedEnabled?'connected':'disconnected',username:sharedUsername}});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.stack||e.message);});page.on('dialog',d=>d.accept());
 await page.goto(origin+'/');
 const example=page.frameLocator('[title="Crown Raid sample"]').locator('#graphic-root .boss');
 await example.waitFor();
 const initialHealth=await example.innerText();
 await page.waitForFunction(initial=>document.querySelector('[title="Crown Raid sample"]').contentDocument.querySelector('.boss').innerText!==initial,initialHealth);
 await page.goto(origin+'/privacy/');
 assert(!/Launch status/i.test(await page.locator('main').innerText()));
 await page.goto(origin+'/help/');
 assert.match(await page.locator('main').innerText(),/Trigger sample/);
 assert.match(await page.locator('main').innerText(),/Auto-play samples/);
 await page.goto(origin+'/help/graphics/');
 assert.match(await page.locator('main').innerText(),/optional TikFinity backup/);
 await page.goto(origin+'/request-invite/');
 assert(await page.getByText(/We’ll email you when there’s a decision/).isVisible());
 await page.goto(origin+'/studio/');
 for (const width of [320,390]) {
   await page.setViewportSize({width,height:844});
   await page.locator('#cloud-request-reset').waitFor();
   for (const selector of ['#cloud-auth-email','#cloud-auth-password','#cloud-sign-in','#cloud-request-reset','.studio-welcome p']) {
     const inside=await page.locator(selector).evaluate(el=>{
       const card=el.closest('.studio-sidebar').getBoundingClientRect(),rect=el.getBoundingClientRect();
       return rect.width>0 && rect.left>=card.left && rect.right<=Math.min(card.right,innerWidth)+1;
     });
     assert(inside,selector+' clipped at '+width);
   }
   await page.locator('#cloud-auth-email').focus();
   await page.keyboard.press('Tab');assert(await page.locator('#cloud-auth-password').evaluate(el=>el===document.activeElement));
   await page.click('#cloud-request-reset');
   await page.locator('.account-recovery-dialog button[type="submit"]').click();
   assert(await page.locator('[data-recovery-email] input').evaluate(el=>!el.validity.valid));
   const dialog=await page.locator('.account-recovery-dialog').boundingBox();assert(dialog.x>=0 && dialog.x+dialog.width<=width+1);
   await page.click('[data-recovery-cancel]');
   await page.screenshot({path:out+'/signed-out-'+width+'.png'});
 }
 await page.fill('#cloud-auth-email','unified-check@example.invalid');await page.fill('#cloud-auth-password','local-unified-browser-password');await page.click('#cloud-create-account');await page.click('#cloud-sign-in');await page.waitForSelector('#cloud-account-session',{state:'attached'});await page.waitForFunction(()=>document.body.classList.contains('cloud-authenticated'));await page.setViewportSize({width:1440,height:1000});
 const connection=page.locator('.studio-sidebar #studio-tiktok');
 await connection.locator('summary').click();
 await connection.getByLabel('TikTok username').fill('demo_creator');
 await connection.getByRole('button',{name:'Connect',exact:true}).click();
 await connection.getByText('Connected to TikTok LIVE',{exact:true}).waitFor();
 await page.click('[data-config-tab="side-gifts"]');
 await page.waitForFunction(()=>document.querySelector('#studio-current-title').textContent==='Side Gifts');
 assert(await page.locator('#cloud-variant-select').isVisible());
 await page.waitForFunction(()=>[...document.querySelector('#side-gifts-preview').contentDocument.querySelectorAll('img')].some(image=>image.complete&&image.naturalWidth>0));
 await page.screenshot({path:out+'/side-gifts-sidebar.png'});
 await connection.locator('summary').click();
 assert.equal(await page.locator('#studio-tiktok').count(),1);
 for(const width of [1440,320]){
   await page.setViewportSize({width,height:900});
   const browse=page.getByRole('button',{name:'Browse designs'});
   await browse.click();
   await page.locator('dialog[open]').waitFor();
   await page.keyboard.press('Escape');
   if(width===320)await page.locator('.studio-mobile-menu-toggle').click();
   await page.click('#studio-output-tab');
   const canvas=page.frameLocator('#studio-output-frame');
   await canvas.getByRole('heading',{name:'Choose a Canvas'}).waitFor();
   await canvas.getByText('Connected to TikTok LIVE',{exact:true}).waitFor();
   await canvas.getByText('Vertical Canvas',{exact:true}).first().waitFor();
   assert(await canvas.getByRole('button',{name:'Check TikFinity Desktop'}).isHidden());
   await canvas.getByText('Troubleshoot backup',{exact:true}).click();
   assert(await canvas.getByRole('button',{name:'Check TikFinity Desktop'}).isVisible());
   await canvas.getByText('Troubleshoot backup',{exact:true}).click();
   await canvas.locator('#manage-live-connection').click();
   assert(await page.locator('#studio-tiktok-username').evaluate(el=>el===document.activeElement));
   await page.click('[data-config-tab="side-gifts"]');
 }
 await page.setViewportSize({width:1440,height:1000});
 async function discard(){if(await page.locator('dialog[open] [data-discard-confirm]').count()){await page.click('dialog[open] [data-discard-confirm]');await page.waitForTimeout(50);}}
 async function native(tab){await page.click('[data-config-tab="'+tab+'"]');await discard();}
 await native('rows');const saved=await page.evaluate(async()=>{const v=(await overlayCloud.createVariant({name:'Saved baseline',overlayKind:'rows',config:rewardConfigEditor.getConfigForKind('rows')})).variant;await studioDesigns.refresh();studioDesigns.open(v.id);return v;});await page.waitForSelector('[data-edit="title"]');const baseline=await page.inputValue('[data-edit="title"]');await page.fill('[data-edit="title"]','Discard this edit');await page.click('[data-config-tab="side-gifts"]');await page.waitForSelector('[data-discard-cancel]');await page.click('[data-discard-cancel]');assert.equal(await page.inputValue('[data-edit="title"]'),'Discard this edit');await native('side-gifts');await native('rows');assert.equal(await page.inputValue('[data-edit="title"]'),baseline,'Switching away discards unsaved edits');
 assert(await page.evaluate(()=>!localStorage.getItem('reward-overlay-config:v1')&&!localStorage.getItem('kg-studio-drafts:v1:'+overlayCloud.session.user.id)),'Unsaved configuration is not persisted');
 await native('side-gifts');await page.locator('[data-editor-nav="side-gifts"] [data-editor-section-tab="layout"]').click();assert.equal(await page.locator('[data-editor-panel="side-gifts"][data-editor-section="style"] [data-compact-variant]').count(),0);
 await page.click('[data-compact-variant="sidecar"]');await page.waitForFunction(()=>document.querySelector('#side-gifts-preview').contentDocument?.querySelector('.variant-sidecar'));assert(await page.locator('[data-editor-panel="side-gifts"] [data-native-arrangement]').isHidden());await page.frameLocator('#side-gifts-preview').locator('img.gift').first().waitFor();await page.waitForFunction(()=>[...document.querySelector('#side-gifts-preview').contentDocument.querySelectorAll('img.gift')].every(i=>i.complete&&i.naturalWidth>0));assert(new URL(await page.frameLocator('#side-gifts-preview').locator('img.gift').first().getAttribute('src')).hostname.endsWith('.r2.dev'),'Legacy gift images resolve to R2');
 await page.locator('[data-editor-nav="side-gifts"] [data-editor-section-tab="style"]').click();await page.locator('[data-editor-panel="side-gifts"] [data-style-preset="Arcade"]').click();assert.equal(await page.evaluate(()=>KGGraphics.definition('side-gifts',rewardConfigEditor.getConfigForKind('side-gifts')).id),'sidecar');await page.waitForFunction(()=>document.querySelector('#side-gifts-preview').contentDocument?.querySelector('#graphic-root')?.style.getPropertyValue('--accent')==='#42f5cf');await page.locator('[data-editor-panel="side-gifts"] [data-style-preset="Default"]').click();assert.equal(await page.evaluate(()=>KGGraphics.definition('side-gifts',rewardConfigEditor.getConfigForKind('side-gifts')).id),'sidecar','Default style preserves layout');
 await page.screenshot({path:out+'/desktop-layout-style.png'});await page.locator('[data-editor-nav="side-gifts"] [data-editor-section-tab="layout"]').click();await page.locator('[data-editor-panel="side-gifts"] [data-presentation-field="slots"]').fill('2');await page.locator('[data-editor-panel="side-gifts"] [data-presentation-field="slots"]').dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('#side-gifts-preview').contentDocument?.querySelectorAll('.rail .action').length===2);
 await page.evaluate(()=>studioDesigns.discard());await page.reload();await page.waitForFunction(()=>Boolean(window.studioDesigns));assert.equal(await page.evaluate(()=>Boolean(KGGraphics.definition('side-gifts',rewardConfigEditor.getConfigForKind('side-gifts')))),false,'Reload does not recover discarded layout edits');
 await native('rows');
 await page.click('[data-graphic-menu="quest"]');
 await page.waitForFunction(()=>window.studioSessionReady);
 await page.click('#studio-output-tab');
 await page.frameLocator('#studio-output-frame').getByRole('heading',{name:'Choose a Canvas'}).waitFor();
 assert(await page.locator('#studio-output-workspace').isVisible());
 await native('rows');
 const toolbarShape = () => page.locator('.studio-sticky-toolbar:visible').evaluate(el=>[...el.children].map(child=>child.className));
 const originalToolbar = await toolbarShape();
 for(const type of ['combo','boss','vote','quest']){
   await page.locator('[data-graphic-menu="'+type+'"]').click();
   await page.waitForFunction(type=>document.querySelector('#studio-current-title')?.textContent===window.KGGraphics?.byId[type].name,type);
   assert.deepEqual(await toolbarShape(),originalToolbar);
   assert.equal(await page.locator('#studio-overlay-frame').count(),0);
   const nav=page.locator('[data-editor-nav="goal"]');
   await nav.getByRole('tab',{name:'Session controls'}).waitFor({timeout:4000}).catch(e=>{throw Error(e.message+' '+errors.join(' | '));});
   assert.deepEqual(await nav.locator('[role="tab"]').allTextContents(),['Layout','Settings','Style','Session controls']);
   for (const key of ['style','layout','session','settings']) {
     await nav.locator('[data-editor-section-tab="'+key+'"]').click();
     assert(await page.locator('[data-editor-panel="goal"][data-editor-section="'+key+'"]').isVisible());
   }
   const originalLabel=await page.inputValue('#graphic-label');
   await page.fill('#graphic-label','New stream label');
   await page.locator('.studio-recovery-tools button').first().click();
   assert.equal(await page.inputValue('#graphic-label'),originalLabel);
   await page.locator('.studio-recovery-tools button').last().click();
   assert.equal(await page.inputValue('#graphic-label'),'New stream label');
   await page.waitForFunction(()=>rewardConfigEditor.getConfigForKind('goal').goalBar.graphic.label==='New stream label');
   await page.waitForFunction(()=>document.querySelector('#goal-preview').contentDocument?.querySelector('#graphic-root'));
   for(const width of [320,390,768]){
     await page.setViewportSize({width,height:900});
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),type+' overflows at '+width);
   }
   await page.setViewportSize({width:1440,height:1000});
   await page.click('[data-config-tab="rows"]');await page.click('[data-discard-cancel]');
   assert(await nav.isVisible());
   await native('rows');
   await page.waitForFunction(()=>document.querySelector('[data-editor-nav="rows"]')?.hidden===false);
   assert.equal(await page.getByRole('tab',{name:'Session controls'}).count(),0);
 }
 await page.setViewportSize({width:390,height:900});await page.locator('#rows-gift-list .rows-action-select').first().scrollIntoViewIfNeeded();await page.locator('#rows-gift-list .rows-action-select').first().click();assert(await page.locator('#rows-gift-list .rows-inspector').isVisible(),'Mobile cards open their inspector');await page.locator('#rows-gift-list [data-back-to-cards]').click();assert(await page.locator('#rows-gift-list .rows-action-list').isVisible());await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/mobile-editor.png',fullPage:true});await page.click('.studio-mobile-menu-toggle');await page.screenshot({path:out+'/mobile-navigation.png',fullPage:true});await page.keyboard.press('Escape');await page.evaluate(axe);assert.deepEqual(await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))),[]);const publicPage=await context.newPage();
 for(const route of ['/','/help/','/help/graphics/','/help/email/','/privacy/','/request-invite/','/join/','/missing-design-review']){
  await publicPage.goto(origin+route);
  for(const width of [320,390,768,1440]){
   await publicPage.setViewportSize({width,height:900});
   assert(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflows at '+width);
  }
 }
 await page.click('.studio-mobile-menu-toggle');
 await connection.locator('summary').click();
 assert.equal(await connection.getByLabel('TikTok username').inputValue(),'demo_creator');
 await connection.getByRole('button',{name:'Disconnect'}).click();
 await connection.getByText('Disconnected',{exact:true}).waitFor();
 await publicPage.close();
 assert.deepEqual(errors,[]);console.log('Unified Studio: saved-only reload, discard/cancel across native and embedded overlays, layout/style independence, real gift URL resolution, contextual controls, mobile navigation/geometry and accessibility passed.');
}finally{await browser.close();}
