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

import {normaliseTikfinityGifts,syncTikfinityCatalogue,syncGiftCatalogue,getGiftCatalogue,getGiftImage} from '../cloudflare/src/gift-catalogue.mjs';
const database=new DatabaseSync(':memory:');
database.exec(fs.readFileSync(new URL('../cloudflare/schema.sql',import.meta.url),'utf8'));
const images=new Map();
const env={DB:new D1Mock(database),TIKFINITY_CATALOGUE_ENABLED:'true',GIFT_CATALOGUE_REGION:'GB',REGISTRATION_ENABLED:'true',
 DOCK_HUBS:{idFromName:name=>name,get:()=>({fetch:async()=>new Response(null,{status:204})})},
 GIFT_IMAGES:{async get(key){const item=images.get(key);return item?{...item,body:item.bytes.slice()}:null},async put(key,bytes,options){images.set(key,{bytes:bytes.slice(),...options})}}};
const now=Date.now();
const fixture=(count=100,start=50)=>Array.from({length:count},(_,i)=>({giftId:String(start+i),name:'TF gift '+(start+i),diamondCount:i,imageUrl:'https://p16-webcast.tiktokcdn.com/img/test/'+(start+i)+'~tplv-obj.webp'}));
const regional={data:{gifts:Array.from({length:100},(_,i)=>({id:i+1,name:'Regional '+(i+1),diamond_count:5,image:{uri:'regional-'+i,url_list:['https://p19-webcast.tiktokcdn.com/'+i+'.webp']}}))}};
function fetcher(data=fixture()) {return async(url,options)=>{
 assert.equal(options.redirect,'manual');
 if(String(url).includes('api.tikfinity.com')){assert.equal(String(url),'https://api.tikfinity.com/v1/gift?locale=en-GB');assert.equal(options.headers.Authorization,undefined);return new Response(JSON.stringify(data));}
 if(String(url).includes('api.eulerstream.com'))return new Response(JSON.stringify({url:'https://gifts.example.r2.cloudflarestorage.com/test'}));
 return new Response(JSON.stringify(regional));
};}
assert.equal(normaliseTikfinityGifts(fixture()).length,100);
assert.equal(normaliseTikfinityGifts(fixture())[0].urls.length,2,'Supplied CDN image has a fallback');
assert.equal(normaliseTikfinityGifts([...fixture(),fixture()[0]]).length,100,'Identical duplicates are safe to collapse');
for(const mutate of [gift=>gift.diamondCount=null,gift=>gift.diamondCount=-1,gift=>gift.diamondCount=1.5,gift=>gift.imageUrl='https://evil.test/gift.png']){
 const rows=fixture();rows.forEach(mutate);assert.throws(()=>normaliseTikfinityGifts(rows));
}
assert.throws(()=>normaliseTikfinityGifts([...fixture(),{...fixture()[0],diamondCount:1000}]),/Conflicting/);
assert.equal((await syncTikfinityCatalogue({...env,TIKFINITY_CATALOGUE_ENABLED:'false'})).refreshed,false);
await syncGiftCatalogue(env,{now,fetcher:fetcher(),legacy:new Map()});
const baseline=(await getGiftCatalogue(env,'https://example.test')).revision;
assert.equal((await syncTikfinityCatalogue(env,{now,fetcher:fetcher(),legacy:new Map()})).count,100);
let catalogue=await getGiftCatalogue(env,'https://example.test');
assert.equal(catalogue.gifts.length,149);
assert.equal(catalogue.sources.find(source=>source.id==='tikfinity').count,100);
assert.equal(catalogue.gifts.find(gift=>gift.id==='50').name,'Regional 50','Regional metadata wins on overlaps');
assert.equal(catalogue.gifts.find(gift=>gift.id==='149').image,'https://example.test/api/v1/gifts/images/TF/149.webp');
assert.notEqual(catalogue.revision,baseline);
const revision=catalogue.revision;
assert.equal((await getGiftCatalogue(env,'https://example.test',false)).gifts.length,0);
assert.equal((await getGiftCatalogue(env,'https://example.test',false)).revision,revision);
assert.equal((await syncTikfinityCatalogue(env,{now:now+1,force:true,fetcher:()=>{throw Error('Cooldown failed')}})).refreshed,false);
let time=now+8*3600000;
for(const fetch of [fetcher([]),fetcher(fixture(50)),async()=>new Response('{"message":"Unauthorized"}',{status:401}),fetcher('bad response')]){
 assert.equal((await syncTikfinityCatalogue(env,{now:time,fetcher:fetch,legacy:new Map()})).refreshed,false);
 assert.equal((await getGiftCatalogue(env,'https://example.test')).revision,revision);
 time+=8*3600000;
}
// Preserve saved variants and account overrides while publishing a catalogue update.
async function api(path,method='GET',body,token){const response=await worker.fetch(new Request('https://example.test/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),env);return {status:response.status,body:await response.json()};}
const account=await api('/auth/register','POST',{email:'tf-catalogue@example.test',password:'local-catalogue-check'});
const token=account.body.session.token;
const config={rewards:[{image:'./rewards/legacy.png',giftIds:['149'],title:'Custom title'}]};
const variant=(await api('/variants','POST',{name:'Unchanged design',overlayKind:'carousel',config},token)).body.variant;
await api('/gifts/creator','POST',{gifts:[{id:'149',name:'My creator correction',coins:777}]},token);
assert.equal((await syncTikfinityCatalogue(env,{now:time,fetcher:fetcher(fixture(100,150)),legacy:new Map()})).refreshed,true);
assert.deepEqual((await api('/variants','GET',undefined,token)).body.variants[0].config,config);
assert.equal((await api('/variants','GET',undefined,token)).body.variants[0].revision,variant.revision);
assert.equal((await api('/gifts/creator','GET',undefined,token)).body.gifts[0].coins,777);
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF5kAAAAASUVORK5CYII=','base64'));
let calls=0;
const image=await getGiftImage(env,'TF','149',{now,fetcher:async url=>{calls++;return String(url).includes('p16-')?new Response('unavailable',{status:503}):new Response(png)}});
assert.equal(image.status,200);assert.equal(calls,2,'Retired gift remains available using fallback CDN');
assert.deepEqual(new Uint8Array(await image.arrayBuffer()),png);
assert.equal((await getGiftImage(env,'TF','149',{now:now+1,fetcher:()=>{throw Error('Cache missed')}})).status,200);
assert.equal(database.prepare("SELECT COUNT(*) AS total FROM gift_catalogue_items WHERE region='TF'").get().total,200,'Historical IDs retained');
console.log('TikFinity catalogue: public extraction, coins/IDs/images, validation, source merging, revision polling, failure retention, cached images and unchanged designs passed.');


// Both source checks run in the hourly job; image warming stays bounded to four.
env.GIFT_IMAGES.get=async()=>({body:png.slice(),customMetadata:{checkedAt:String(Date.now())},httpMetadata:{contentType:'image/png'}});
const jobs=[];await worker.scheduled({cron:'15 * * * *'},env,{waitUntil:job=>jobs.push(job)});await Promise.all(jobs);
assert.equal(jobs.length,1);
assert.equal(database.prepare('SELECT SUM(warm_cursor) AS total FROM gift_catalogue_state').get().total,4);
console.log('Dual-source scheduled sync and bounded cache warming passed.');
