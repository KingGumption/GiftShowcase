import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../cloudflare/src/worker.mjs';

class D1StatementMock {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1StatementMock(this.database, this.sql, values);
  }

  first() {
    return this.database.prepare(this.sql).get(...this.values) || null;
  }

  all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }

  run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: result.changes } };
  }
}

class D1Mock {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new D1StatementMock(this.database, sql);
  }

  async batch(statements) {
    this.database.exec('BEGIN');
    try {
      const results = statements.map(statement => statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

import {syncGiftCatalogue, getGiftCatalogue, getGiftImage, normaliseGifts} from '../cloudflare/src/gift-catalogue.mjs';
const database = new DatabaseSync(':memory:');
const schema = fs.readFileSync(new URL('../cloudflare/schema.sql', import.meta.url), 'utf8');
database.exec(schema); database.exec(schema);
const objects = new Map();
const env = {DB: new D1Mock(database), GIFT_IMAGES: {
 async get(key) { const item=objects.get(key); return item ? {...item,body:item.bytes.slice(), httpEtag:'"test"'} : null; },
 async put(key,bytes,options) { objects.set(key,{bytes:bytes.slice(),...options}); }
}};
const now=Date.now();
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF5kAAAAASUVORK5CYII=','base64'));
const fixture=(count=100,start=1,version=1)=>({data:{gifts:Array.from({length:count},(_,i)=>({id:start+i,name:'Gift '+(start+i),diamond_count:i+1,is_displayed_on_panel:false,image:{uri:'gift-'+(start+i)+'-v'+version,url_list:['https://p16-webcast.tiktokcdn.com/'+(start+i)+'.webp','https://p19-webcast.tiktokcdn.com/'+(start+i)+'.webp']}}))}});
function upstream(data, date=new Date(now).toUTCString()) { return async (url, options)=>{ assert.equal(options.redirect, 'manual', 'Cloudflare supports manual redirects'); return new Response(JSON.stringify(String(url).includes('api.eulerstream')?{url:'https://gifts.example.r2.cloudflarestorage.com/GB.json'}:data),{headers:{'last-modified':date}}); }; }
const sync=(data,time=now,extra={})=>syncGiftCatalogue(env,{now:time,fetcher:upstream(data),legacy:new Map(),...extra});
assert.equal((await sync(fixture())).count,100);
let catalogue=await getGiftCatalogue(env,'https://example.test');
assert.equal(catalogue.gifts.length,100);
assert.equal(catalogue.gifts[0].image,'https://example.test/api/v1/gifts/images/GB/1.webp');
assert.equal(JSON.stringify(catalogue).includes('cloudflarestorage'),false);
const revision=catalogue.revision;
assert.equal((await sync(fixture(),now+1)).refreshed,false,'Scheduled cooldown');
assert.equal((await sync(fixture(),now+1,{force:true})).refreshed,false,'Manual cooldown');
let calls=0;
const concurrent=await Promise.all([1,2].map(()=>syncGiftCatalogue(env,{now:now+3600000,force:true,legacy:new Map(),fetcher:async (url,options)=>{calls++;await new Promise(r=>setTimeout(r,5));return upstream(fixture())(url,options)}})));
assert.equal(concurrent.filter(r=>r.refreshed).length,1);assert.equal(calls,2);
let time=now+8*3600000;
for (const data of [{data:{gifts:[]}},fixture(50),{data:{gifts:Array(100).fill({id:'x'})}}]) {
 assert.equal((await sync(data,time)).refreshed,false); time+=8*3600000;
 assert.equal((await getGiftCatalogue(env,'https://example.test')).revision,revision);
}
assert.equal((await sync(fixture(),time,{fetcher:upstream(fixture(),new Date(now-86400000).toUTCString())})).refreshed,false);
time+=8*3600000;
let imageCalls=0;
const imageFetch=async url=>{imageCalls++;return String(url).includes('p16')?new Response('<html>bad</html>'):new Response(png)};
let response=await getGiftImage(env,'GB','1',{now,fetcher:imageFetch});
assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(imageCalls,2);
assert.deepEqual(new Uint8Array(await response.arrayBuffer()),png);
await getGiftImage(env,'GB','1',{now:now+1,fetcher:()=>{throw Error('Unexpected network')}});
assert.equal(objects.size,1);
const oldKey=database.prepare('SELECT cached_key FROM gift_catalogue_items WHERE gift_id=?').get('1').cached_key;
assert.equal((await sync(fixture(100,1,2),time)).refreshed,true);time+=8*3600000;
response=await getGiftImage(env,'GB','1',{now,fetcher:async()=>new Response('broken')});
assert.equal(response.headers.get('x-gift-image'),'last-known-good');
assert.equal(database.prepare('SELECT cached_key FROM gift_catalogue_items WHERE gift_id=?').get('1').cached_key,oldKey);
response=await getGiftImage(env,'GB','1',{now:now+1,fetcher:()=>{throw Error('Failure cooldown must skip network')}});
assert.equal(response.status,200);
response=await getGiftImage(env,'GB','1',{now:now+3600001,fetcher:async()=>new Response(png)});
assert.equal(response.headers.get('x-gift-image'),'current');assert.equal(objects.size,2);
// A delayed old-version download must not overwrite a newer image pointer.
let release, started;
const startedPromise=new Promise(r=>started=r);
const slow=getGiftImage(env,'GB','2',{now,fetcher:async()=>{started();await new Promise(r=>release=r);return new Response(png)}});
await startedPromise;
await sync(fixture(100,1,3),time);time+=8*3600000;
await getGiftImage(env,'GB','2',{now,fetcher:async()=>new Response(png)});
const newKey=database.prepare('SELECT cached_key FROM gift_catalogue_items WHERE gift_id=?').get('2').cached_key;
release();await slow;
assert.equal(database.prepare('SELECT cached_key FROM gift_catalogue_items WHERE gift_id=?').get('2').cached_key,newKey);
// Retired IDs remain available to previously saved designs.
await sync(fixture(100,101),time);
assert.equal((await getGiftCatalogue(env,'https://example.test')).gifts.some(g=>g.id==='1'),false);
assert.equal((await getGiftImage(env,'GB','1',{now,fetcher:async()=>new Response(png)})).status,200);
assert.equal((await getGiftImage(env,'GB','99999')).status,404);
assert.equal((await getGiftImage(env,'../','1')).status,404);
assert.throws(()=>normaliseGifts(fixture(20),'GB'));
const unsafe=fixture();unsafe.data.gifts.forEach(g=>g.image.url_list=['https://evil.example/a.png']);
assert.throws(()=>normaliseGifts(unsafe,'GB'));
const publicResponse=await worker.fetch(new Request('https://example.test/api/v1/gifts/catalogue'),env);
assert.equal(publicResponse.status,200);
assert.equal((await publicResponse.json()).gifts.length,100);
const unauthorised=await worker.fetch(new Request('https://example.test/api/v1/gifts/sync',{method:'POST'}),env);
assert.equal(unauthorised.status,401);
console.log('Gift sync: validation, publication, leases, cooldowns, image fallback/cache, concurrent versions, retired designs and API auth passed.');


// The scheduled job must queue background work and warm only a bounded batch.
env.GIFT_IMAGES.get=async()=>({body:png.slice(),customMetadata:{checkedAt:String(Date.now())},httpMetadata:{contentType:'image/png'}});
const pending=[];
await worker.scheduled({cron:'15 * * * *'},env,{waitUntil:task=>pending.push(task)});
assert.equal(pending.length,1); await Promise.all(pending);
assert.equal(database.prepare('SELECT warm_cursor FROM gift_catalogue_state').get().warm_cursor,4);
console.log('Scheduled refresh and bounded background image warming passed.');

// Active browser sources reload changed artwork while legacy URLs remain untouched.
const vm = await import('node:vm');
const timers={}; const image={src:'https://example.test/api/v1/gifts/images/GB/5655.webp'};
const legacyImage={src:'https://example.test/rewards/custom.png'};
let checks=0;
vm.runInNewContext(fs.readFileSync(new URL('../public/gift-image-refresh.js',import.meta.url),'utf8'),{
 location:{protocol:'https:'},document:{images:[image,legacyImage]},URL,
 fetch:async()=>({ok:true,json:async()=>({revision:++checks===1?'first':'second'})}),
 setTimeout:fn=>(timers.initial=fn),setInterval:fn=>(timers.interval=fn),
 addEventListener:()=>{},clearTimeout:()=>{},clearInterval:()=>{}
});
await timers.initial(); assert.equal(new URL(image.src).search,'');
await timers.interval(); assert.equal(new URL(image.src).searchParams.get('v'),'second');
assert.equal(legacyImage.src,'https://example.test/rewards/custom.png');
console.log('Browser-source artwork refresh and unchanged legacy image URLs passed.');
