import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {worker,env} from './studio-test-support.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..'),dist=path.join(root,'Widget','cloudflare','dist');
const dependencyRoot=process.env.STUDIO_TEST_MODULES||path.join(root,'Widget','cloudflare');
const require=createRequire(path.join(dependencyRoot,'package.json'));
let chromium,axe;try{({chromium}=require('playwright-core'));axe=fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');}catch{throw Error('Install release-test dependencies with npm install in Widget/cloudflare, or set STUDIO_TEST_MODULES to their package directory.');}
const executable=process.env.STUDIO_BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const origin='https://kinggumption.com',mime={'.css':'text/css','.js':'text/javascript','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'};
env.ASSETS={async fetch(request){const name=new URL(request.url).pathname.replace(/^\//,'')||'index.html',file=path.resolve(dist,name);return file.startsWith(dist+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?new Response(fs.readFileSync(file),{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}}):new Response(null,{status:404});}};
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF5kAAAAASUVORK5CYII=','base64')),objects=new Map();
env.GIFT_IMAGES={async put(key,bytes,options){objects.set(key,{body:bytes.slice(),...options});},async get(key){return objects.get(key)||{body:png,size:png.length,httpMetadata:{contentType:'image/png'},customMetadata:{checkedAt:String(Date.now())}};},async head(){return {size:png.length};},async delete(keys){keys.forEach(key=>objects.delete(key));},async list({prefix}){return {objects:[...objects.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false};}};
const browser=await chromium.launch({executablePath:executable});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.addInitScript(()=>{window.WebSocket=class extends EventTarget{static OPEN=1;static CLOSED=3;readyState=1;constructor(url){super();window.__releaseSockets??=[];window.__releaseSockets.push(String(url));}close(){this.readyState=3;}send(){}};});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.hostname.endsWith('.r2.dev'))return route.fulfill({status:200,contentType:'image/png',body:Buffer.from(png)});
    if(url.origin!==origin)return route.abort();
    const response=await worker.fetch(new Request(request.url(),{method:request.method(),headers:request.headers(),body:request.postDataBuffer()||undefined}),env);
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());page.setDefaultTimeout(15000);
  await page.goto(origin+'/studio/');await page.fill('#cloud-auth-email','release-workflows@example.invalid');await page.fill('#cloud-auth-password','local-release-workflows-only');await page.click('#cloud-create-account');await page.click('#cloud-sign-in');await page.waitForSelector('#cloud-account-session');
  await page.waitForFunction(()=>Boolean(window.studioDesigns));
  for(const kind of ['original','rows','side-gifts','goal','top-likers']){
    await page.click('[data-config-tab="'+kind+'"]');
    const previewId=(kind==='original'?'carousel':kind)+'-preview';
    await page.waitForFunction(id=>{const f=document.getElementById(id);return f.clientHeight>0&&f.contentDocument?.querySelector('main')?.offsetHeight>0;},previewId);
    assert(await page.locator('#'+(kind==='original'?'carousel':kind)+'-preview-test').isChecked());
    const backgroundBox=page.locator('#'+previewId).locator('..');const backgrounds=[];
    for(const mode of ['light','dark','neutral']){const choice=page.locator('[data-preview-frame="'+previewId+'"][data-preview-background-choice="'+mode+'"]');await choice.click();assert.equal(await choice.getAttribute('aria-pressed'),'true');assert.equal(await backgroundBox.getAttribute('data-preview-background'),mode);backgrounds.push(await backgroundBox.evaluate(e=>getComputedStyle(e).backgroundImage));}assert.equal(new Set(backgrounds).size,3);

    assert.equal(await page.locator('[data-preview-fit],[data-preview-native]').count(),0);
    if(kind==='rows')assert(await page.frameLocator('#rows-preview').locator('.reward-gift-tile').count()>0);
    if(kind==='top-likers')assert(await page.locator('#top-likers-preview').evaluate(f=>{const r=f.getBoundingClientRect(),b=f.parentElement.getBoundingClientRect();return Math.abs(r.left+r.width/2-b.left-b.width/2)<2;}));
    assert.equal(await page.locator('.studio-sticky-toolbar .studio-recovery-tools').count(),1);
    assert.equal(await page.locator('#'+previewId).locator('..').locator('..').locator('.studio-preview-rail').count(),1);
    if(['original','rows','side-gifts'].includes(kind)){
      await page.waitForFunction(id=>Boolean(document.getElementById(id).contentDocument?.querySelector('[data-studio-card-index]')),previewId);
      const tile=page.frameLocator('#'+previewId).locator('[data-studio-card-index]').first(),index=Number(await tile.getAttribute('data-studio-card-index'));
      const beforeSelection=await page.evaluate(()=>JSON.stringify(rewardConfigEditor.getConfigForKind(rewardConfigEditor.getActiveOverlayKind())));
      await tile.dispatchEvent('click');assert.equal(await page.evaluate(()=>rewardConfigEditor.getSelection()),index);
      assert.equal(await page.evaluate(()=>JSON.stringify(rewardConfigEditor.getConfigForKind(rewardConfigEditor.getActiveOverlayKind()))),beforeSelection);
    }

    for(const section of ['settings','style']){await page.locator('[data-editor-nav="'+kind+'"] [data-editor-section-tab="'+section+'"]').click();assert(await page.locator('[data-editor-panel="'+kind+'"][data-editor-section="'+section+'"]').isVisible());}
  }
  await page.click('[data-config-tab="rows"]');await page.locator('[data-editor-nav="rows"] [data-editor-section-tab="cards"]').click();
  const historic=JSON.parse(fs.readFileSync(new URL('./fixtures/historic-designs.json',import.meta.url),'utf8'));
  const fixtureChecks=await page.evaluate(fixtures=>fixtures.map(fixture=>{const config=normalizeConfig(fixture.config);if(fixture.name.startsWith('Customised'))return JSON.stringify(config.rowsOverlay.gifts.map(item=>[item.title,item.giftIds,item.sound,item.volume]))===JSON.stringify(fixture.config.rowsOverlay.gifts.map(item=>[item.title,item.giftIds,item.sound,item.volume]))&&config.rowsOverlay.perRow==='5,7'&&config.rowsOverlay.labelSize===16&&!config.rowsOverlay.animationsEnabled;return fixture.kind==='carousel'?config.rewards.length===0:fixture.kind==='rows'?config.rowsOverlay.gifts.length===0:config.sideGifts.gifts.length===0;}),historic);assert(fixtureChecks.every(Boolean));
  const count=await page.locator('.rows-action').count();await page.click('#add-row-gift');await page.click('[data-event-choice="share"]');assert.equal(await page.locator('.rows-action').count(),count+1);assert.equal(await page.evaluate(()=>rowsSelectedGift.triggerType),'share');
  await page.fill('[data-edit="title"]','Release shared action');await page.click('[data-toolbar-link]');await page.fill('#cloud-variant-name','Release workflow design');await page.click('#cloud-variant-dialog-confirm');await page.waitForSelector('#direct-link-dialog[open]');
  const direct=await page.inputValue('#direct-link-url');await page.click('#direct-link-close');const id=await page.inputValue('#cloud-variant-select');
  await page.fill('[data-edit="title"]','Recovered working copy');await page.waitForTimeout(350);await page.reload();await page.waitForSelector('#cloud-account-session');assert(await page.locator('.overlay-preview-frame').evaluateAll(boxes=>boxes.every(b=>b.dataset.previewBackground==='neutral')));await page.waitForFunction(id=>document.querySelector('#cloud-variant-select').value===id,id);await page.waitForSelector('[data-edit="title"]');assert.equal(await page.evaluate(()=>draftConfig.rowsOverlay.gifts.at(-1).title),'Recovered working copy');assert.equal(await page.inputValue('#cloud-variant-select'),id);
  await page.click('[data-toolbar-save]');await page.waitForFunction(()=>document.querySelector('#cloud-config-status').textContent.includes('revision 2'));
  await page.evaluate(async id=>{const variant=studioDesigns.selected();await overlayCloud.updateVariant(id,{name:variant.name,config:variant.config,overlayKind:variant.overlayKind,expectedRevision:variant.revision});},id);
  await page.fill('[data-edit="title"]','Kept after conflict');await page.click('[data-toolbar-save]');await page.waitForSelector('[data-conflict-copy]');assert.equal(await page.inputValue('[data-edit="title"]'),'Kept after conflict');await page.click('[data-conflict-replace]');await page.waitForFunction(()=>document.querySelector('#cloud-config-status').textContent.includes('revision 4'));
  await page.click('[data-toolbar-link]');await page.waitForSelector('#direct-link-dialog[open]');assert.equal(await page.inputValue('#direct-link-url'),direct);await page.click('#direct-link-close');
  await page.click('#studio-design-library');await page.waitForSelector('.studio-design-card');await page.fill('[data-library-search]','workflow');assert.equal(await page.locator('.studio-design-card').count(),1);await page.locator('.studio-library-menu summary').first().click();await page.getByRole('button',{name:'Duplicate',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.studio-design-card').length===2);await page.locator('.studio-modal [data-modal-close]').click();
  await page.locator('#cloud-version-menu summary').click();await page.click('#cloud-revision-history');await page.waitForSelector('.studio-history-dialog[open]');await page.selectOption('[data-history-select]','1');await page.waitForFunction(()=>document.querySelector('.studio-history-preview iframe').contentDocument?.body?.textContent.includes('Release shared action'));await page.getByRole('button',{name:'Restore as new revision',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.studio-history-dialog').open);
  // Real keyboard journeys and automated accessibility checks are both release gates.
  await page.locator('.rows-action-select').nth(1).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.className),'rows-action-select');
  const previousArt=await page.evaluate(()=>rowsSelectedGift.image);
  await page.click('[data-open-sounds]');await page.waitForSelector('.sound-library-dialog[open]');await page.locator('.sound-library-dialog details summary').click();
  const clip=Buffer.alloc(48044);clip.write('RIFF',0);clip.writeUInt32LE(clip.length-8,4);clip.write('WAVEfmt ',8);clip.writeUInt32LE(16,16);clip.writeUInt16LE(1,20);clip.writeUInt16LE(1,22);clip.writeUInt32LE(24000,24);clip.writeUInt32LE(48000,28);clip.writeUInt16LE(2,32);clip.writeUInt16LE(16,34);clip.write('data',36);clip.writeUInt32LE(48000,40);
  await page.setInputFiles('[data-sound-file]',{name:'Release clip.wav',mimeType:'audio/wav',buffer:clip});await page.waitForFunction(()=>!document.querySelector('[data-sound-upload]').disabled);await page.click('[data-sound-upload]');await page.waitForFunction(()=>document.querySelector('[data-sound-status]').textContent.includes('Uploaded.'));await page.locator('.sound-library-row').filter({hasText:'Release clip'}).getByRole('button',{name:'Use',exact:true}).click();assert.equal(await page.evaluate(()=>rowsSelectedGift.image),previousArt);assert((await page.evaluate(()=>rowsSelectedGift.sound)).includes('/api/v1/sounds/'));
  await page.click('[data-toolbar-save]');await page.waitForFunction(()=>!document.querySelector('#cloud-save-variant').disabled);
  await page.evaluate(axe);const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(item=>({id:item.id,targets:item.nodes.map(node=>node.target)})));assert.deepEqual(violations,[]);
  for(const width of [390,320,1440]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(60);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  const canvasSetup=await page.evaluate(async()=>{const config=rewardConfigEditor.getDefaults('goal');config.goalBar.width=400;const variant=(await overlayCloud.createVariant({name:'Archived layout fixture',overlayKind:'goal',config})).variant;const dock=(await overlayCloud.listDocks()).docks.find(dock=>dock.width>dock.height);for(const [x,y]of [[100,100],[450,200],[1300,300]])await overlayCloud.createDockItem(dock.id,{variantId:variant.id,overlayKind:'goal',x,y,width:400,height:44});await overlayCloud.request('/v1/variants/'+variant.id+'/archive',{method:'POST',body:{archived:true}});await overlayCloud.createDock({name:'Second canvas fixture',width:960,height:540});return {dockId:dock.id,variantId:variant.id};});
  await page.click('#studio-output-tab');const manager=await (await page.locator('#studio-output-frame').elementHandle()).contentFrame();await manager.waitForSelector('[data-dock-id]');const card=manager.locator('[data-dock-id="'+canvasSetup.dockId+'"]');await card.locator('[data-action="toggle-editor"]').click();await card.locator('[data-role="canvas"]').scrollIntoViewIfNeeded();await manager.waitForFunction(()=>[...document.querySelectorAll('.dock-canvas-layer iframe')].every(frame=>frame.contentDocument?.readyState==='complete'&&frame.contentDocument.location.href!=='about:blank'));
  assert.equal(await card.locator('[data-item-field="variantId"]').inputValue(),canvasSetup.variantId);await card.locator('[data-role="add-kind"]').selectOption('goal');assert.equal(await card.locator('[data-role="add-variant"] option[value="'+canvasSetup.variantId+'"]').count(),0);
  await card.evaluate(card=>card.querySelectorAll('.dock-canvas-layer iframe').forEach(frame=>frame.contentWindow.__releaseMarker='kept'));await card.locator('[data-item-field="x"]').fill('120');await card.locator('[data-action="save-item"]').click();await manager.waitForFunction(()=>document.querySelector('#dock-manager-status').textContent.includes('Saved overlay layer'));assert(await card.evaluate(card=>[...card.querySelectorAll('.dock-canvas-layer iframe')].every(frame=>frame.contentWindow.__releaseMarker==='kept')));
  await card.getByRole('button',{name:'Centre horizontally',exact:true}).click();await manager.waitForFunction(()=>document.querySelector('#dock-manager-status').textContent.includes('Centre horizontally'));await card.getByRole('button',{name:'Undo',exact:true}).click();await manager.waitForFunction(()=>document.querySelector('#dock-manager-status').textContent.includes('Undid canvas'));assert(await card.evaluate(card=>[...card.querySelectorAll('.dock-canvas-layer iframe')].every(frame=>frame.contentWindow.__releaseMarker==='kept')));
  const home=await context.newPage();home.on('pageerror',error=>errors.push(error.message));await home.goto(origin+'/');await home.click('[data-example="2"]');const demo=home.frameLocator('[title="Side Gifts sample"]');await demo.locator('.side-gift-tile').first().waitFor();assert.equal(await demo.locator('.side-gift-tile:not(.side-gift-placeholder)').count(),6);const label=await demo.locator('.side-gift-tile strong').first().evaluate(element=>Number.parseFloat(getComputedStyle(element).fontSize));assert(label>=14);assert((await home.locator('.example-stage iframe[src]').count())<=1);assert(!(await home.evaluate(()=>window.__releaseSockets||[])).some(url=>url.includes('localhost')));
  const unknown=await home.goto(origin+'/missing-release-page');assert.equal(unknown.status(),404);assert(await home.getByRole('heading',{name:'We couldn’t open that page.'}).isVisible());await home.goto(origin+'/help/');assert(await home.getByRole('heading',{name:'Get your overlay on stream.'}).isVisible());

  const helpSession=await page.evaluate(()=>overlayCloud.session.token);
  assert.equal(await page.locator('.studio-help-link').getAttribute('target'),null);
  assert.equal(await page.locator('.studio-sidebar-footer > :last-child').getAttribute('class'),'studio-help-link');
  assert.equal(await page.locator('.studio-support .kg-kofi-link').getAttribute('href'),'https://ko-fi.com/kinggumption');
  await page.click('.studio-help-link');await page.waitForURL('**/help/');
  assert.equal(await page.locator('a[href^="mailto:"]').count(),0);
  await page.getByRole('link',{name:'Return to Studio',exact:true}).first().click();await page.waitForURL('**/studio/');await page.waitForFunction(()=>Boolean(window.overlayCloud?.signedIn));await page.waitForSelector('#cloud-account-session');
  assert.equal(await page.evaluate(()=>overlayCloud.session.token),helpSession);
  assert.deepEqual(errors,[]);
  console.log('Browser release gate: five editors, event cards, save/reload, stale-save conflict, stable Direct link, history restore, library, keyboard/axe, responsive layout, readable Side Gifts demo and help/404 passed. Uses isolated local data and fixture images; no production requests.');
}finally{await browser.close();}
