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

import vm from 'node:vm';
const database=new DatabaseSync(':memory:');
database.exec(fs.readFileSync(new URL('../cloudflare/schema.sql',import.meta.url),'utf8'));
database.exec(fs.readFileSync(new URL('../cloudflare/migrations/0010_creator_gifts.sql',import.meta.url),'utf8'));
const objects=new Map();
const env={DB:new D1Mock(database),REGISTRATION_ENABLED:'true',ALLOWED_ORIGINS:'*',
 DOCK_HUBS:{idFromName:name=>name,get:()=>({fetch:async()=>new Response(null,{status:204})})},
 GIFT_IMAGES:{
  async put(key,bytes,options){objects.set(key,{bytes:bytes.slice(),...options});},
  async get(key){const item=objects.get(key);return item?{...item,body:item.bytes.slice()}:null;},
  async list({prefix}){return {objects:[...objects.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false};},
  async delete(keys){keys.forEach(key=>objects.delete(key));}
 }};
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF5kAAAAASUVORK5CYII=';
async function api(path,method='GET',body,token){
 const response=await worker.fetch(new Request('https://example.test/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),env);
 return {status:response.status,body:response.headers.get('content-type')?.includes('json')?await response.json():await response.text()};
}
const account=await api('/auth/register','POST',{email:'creator@example.test',password:'local-creator-gift-check'});
const token=account.body.session.token;
const second=await api('/auth/register','POST',{email:'second@example.test',password:'local-second-gift-check'});
const secondToken=second.body.session.token;
const config={rewards:[{title:'Original',image:'./rewards/old.webp',giftIds:['5655']}]};
const variant=(await api('/variants','POST',{name:'Legacy design',overlayKind:'carousel',config},token)).body.variant;
const direct=(await api('/variants/'+variant.id+'/direct-link','POST',undefined,token)).body.publicToken;
const docks=(await api('/docks','GET',undefined,token)).body.docks;
const discovered={id:'888001',name:'Creator Star',coins:899,imageUrl:'https://p19-webcast.tiktokcdn.com/star.webp',nickname:'Not retained',user:{secret:'Not retained'}};
assert.equal((await api('/gifts/creator')).status,401);
assert.equal((await api('/gifts/creator','POST',{gifts:[discovered]})).status,401);
assert.equal((await api('/public/docks/invalid/gifts','POST',{gifts:[discovered]})).status,404);
assert.equal((await api('/public/docks/'+direct+'/gifts','POST',{gifts:[discovered]})).status,200);
let gifts=(await api('/gifts/creator','GET',undefined,token)).body.gifts;
assert.equal(gifts.length,1);assert.equal(gifts[0].coins,899);assert.equal(gifts[0].source,'tikfinity');
assert.equal(JSON.stringify(database.prepare('SELECT metadata_json FROM creator_gifts').get()).includes('Not retained'),false);
assert.equal((await api('/gifts/creator','GET',undefined,secondToken)).body.gifts.length,0);
assert.equal((await api('/public/docks/'+docks[0].publicToken+'/gifts','POST',{gifts:[discovered]})).body.saved,0,'Identical gifts from multiple sources need no write');
assert.equal((await api('/public/docks/'+docks[0].publicToken+'/gifts','POST',{gifts:[{...discovered,id:'888999'}]})).status,429);
database.exec('UPDATE creator_gift_state SET discovery_after=0');
assert.equal((await api('/public/docks/'+docks[0].publicToken+'/gifts','POST',{gifts:[{id:discovered.id,name:discovered.name,coins:null}]})).status,200);
gifts=(await api('/gifts/creator','GET',undefined,token)).body.gifts;
assert.equal(gifts[0].coins,899);assert.equal(gifts[0].hasImage,true);
const stableImage=gifts[0].image;
const imported={id:discovered.id,name:'Manually corrected star',coins:1000,imageData:'data:image/png;base64,'+png};
assert.equal((await api('/gifts/creator','POST',{gifts:[imported]},token)).status,200);
assert.equal((await api('/gifts/creator','GET',undefined,token)).body.gifts[0].image,stableImage);
const image=await worker.fetch(new Request(stableImage),env);
assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(png,'base64'));
database.exec('UPDATE creator_gift_state SET discovery_after=0');
assert.equal((await api('/public/docks/'+direct+'/gifts','POST',{gifts:[discovered]})).status,200);
assert.equal((await api('/gifts/creator','GET',undefined,token)).body.gifts[0].coins,1000);
assert.equal((await api('/gifts/creator','POST',{gifts:[{id:'888002',name:'Missing art',coins:0}]},token)).status,200);
const missing=(await api('/gifts/creator','GET',undefined,token)).body.gifts.find(g=>g.id==='888002');
assert.equal((await worker.fetch(new Request(missing.image),env)).headers.get('x-gift-image'),'needs-artwork');
for(const gift of [
 {id:'1',name:'Bad cost',coins:-1}, {id:'1',name:'Unknown cost',coins:''},
 {id:'1',name:'Bad image',coins:1,imageUrl:'https://evil.test/a.png'},
 {id:'1',name:'Bad upload',coins:1,imageData:'data:image/png;base64,AAAA'},
 {id:'../escape',name:'Bad ID',coins:1}
]){
 const before=database.prepare('SELECT count(*) AS n FROM creator_gifts').get().n;
 assert.equal((await api('/gifts/creator','POST',{gifts:[{id:'777777',name:'Must not be committed',coins:12},gift]},token)).status,400);
 assert.equal(database.prepare('SELECT count(*) AS n FROM creator_gifts').get().n,before);
}
assert.equal((await api('/gifts/creator','POST',{gifts:[imported,imported]},token)).status,400);
const saved=(await api('/variants','GET',undefined,token)).body.variants.find(v=>v.id===variant.id);
assert.deepEqual(saved.config,config);assert.equal(saved.revision,1);
const exported=(await api('/account/export','GET',undefined,token));
assert.equal(exported.status,200);assert.equal(exported.body.creatorGifts.length,2);
// Equal IDs in two accounts remain independent.
await api('/gifts/creator','POST',{gifts:[{id:discovered.id,name:'Other creator',coins:5}]},secondToken);
assert.equal((await api('/gifts/creator','GET',undefined,secondToken)).body.gifts[0].coins,5);
assert.equal((await api('/account','DELETE',{password:'local-creator-gift-check',confirmation:'DELETE'},token)).status,200);
assert.equal(objects.size,0);assert.equal(database.prepare('SELECT count(*) AS n FROM creator_gifts').get().n,1);
assert.equal((await worker.fetch(new Request(stableImage),env)).status,404);
assert.equal((await api('/public/docks/'+direct+'/gifts','POST',{gifts:[discovered]})).status,404);
console.log('Creator gift API: isolation, permissions, discovery, coin preservation, manual priority, uploads, atomic validation, export/delete and unchanged designs passed.');

// Gift discovery observes existing events, batches metadata only, and deduplicates streak updates.
const timers=[];let sent=[];
const context={location:{protocol:'https:',pathname:'/widget/private-token',search:''},URLSearchParams,AbortSignal,Date,
 setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout:()=>{},addEventListener:()=>{},
 fetch:async(url,options)=>{sent.push({url,body:JSON.parse(options.body)});return {ok:true};}};
context.window=context;
vm.runInNewContext(fs.readFileSync(new URL('../public/creator-gift-discovery.js',import.meta.url),'utf8'),context);
const event={event:'gift',data:{giftId:10,giftName:'Custom heart',diamondCount:100,repeatCount:20,giftPictureUrl:'https://p19-webcast.tiktokcdn.com/heart.webp',user:{nickname:'Private'}}};
context.creatorGiftDiscovery.observe(event);context.creatorGiftDiscovery.observe(event);
await context.creatorGiftDiscovery.flush();
assert.equal(sent.length,1);assert.equal(sent[0].body.gifts.length,1);assert.equal(sent[0].body.gifts[0].coins,100);
assert.equal(JSON.stringify(sent).includes('Private'),false);
context.creatorGiftDiscovery.observe(event);await context.creatorGiftDiscovery.flush();assert.equal(sent.length,1);
assert.equal(context.creatorGiftDiscovery.extract({event:'chat',data:{}}),null);
assert.equal(context.creatorGiftDiscovery.extract({event:'gift',data:{giftId:11,giftName:'Unknown',repeatCount:2,totalDiamondCount:200}}).coins,null);
assert.equal(context.creatorGiftDiscovery.extract({event:'gift',data:{giftId:12,giftName:'Nested',gift:{diamond_count:999}}}).coins,999);
// Failed uploads remain queued and do not throw into the live renderer.
context.fetch=async()=>({ok:false});
context.creatorGiftDiscovery.observe({event:'gift',data:{giftId:99,giftName:'Retry',diamondCount:1}});
await context.creatorGiftDiscovery.flush();
context.fetch=async(url,options)=>{sent.push({body:JSON.parse(options.body)});return {ok:true};};
await context.creatorGiftDiscovery.flush();assert.equal(sent.at(-1).body.gifts[0].id,'99');
console.log('TikFinity extraction, per-gift coins, privacy, batching, retry and streak deduplication passed.');


const nested=context.creatorGiftDiscovery.extract({event:'gift',data:{giftDetails:{giftId:123,giftName:'Personalised badge',diamondCount:45,giftImage:{urlList:['https://p19-webcast.tiktokcdn.com/badge.png']}}}});
assert.equal(nested.id,'123');assert.equal(nested.coins,45);assert.equal(nested.imageUrl,'https://p19-webcast.tiktokcdn.com/badge.png');
console.log('Nested TikFinity giftDetails, protobuf image urlList and coin fields passed.');

const editorSource=fs.readFileSync(new URL('../public/rewards-admin.js',import.meta.url),'utf8');
const searchSource='function matchesGiftSearch('+editorSource.split('function matchesGiftSearch(')[1].split('\nasync function loadCreatorGifts')[0];
const search={normalizeName:value=>String(value).toLowerCase()};vm.createContext(search);vm.runInContext(searchSource,search);
const entry={id:'98765',name:'Personal Crown',coins:777};
for(const query of ['777','coins:777','777 coins','700-800','700–800','>=777','<=777','Crown coins:777','98765'])assert.equal(search.matchesGiftSearch(entry,query),true,query);
for(const query of ['coins:778','800-900','<777','>777','Other coins:777'])assert.equal(search.matchesGiftSearch(entry,query),false,query);
assert.equal(search.matchesGiftSearch({id:'1',name:'Unknown',coins:null},'coins:0'),false);
assert.equal(search.matchesGiftSearch({id:'2',name:'Free',coins:0},'coins:0'),true);
const importSource=fs.readFileSync(new URL('../public/creator-gift-import.js',import.meta.url),'utf8');
const parsers={URL};vm.createContext(parsers);vm.runInContext('function parseCSV('+importSource.split('function parseCSV(')[1].split('  // Exposed')[0],parsers);
const csv='\uFEFFid,name,coins,imageUrl\r\n123,"Creator, ""Special""",777,\r\n';
const parsed=parsers.parseImport(csv);assert.equal(parsed[0].name,'Creator, "Special"');assert.equal(parsed[0].coins,777);
assert.equal(parsers.parseImport(JSON.stringify({gifts:[{id:124,name:'JSON gift',coins:500}]}),true)[0].coins,500);
assert.throws(()=>parsers.parseImport('id,name,coins\n1,Bad,-5'));
assert.throws(()=>parsers.parseImport('id,name,coins\n1,A,5\n1,B,6'));
const bulk=await api('/gifts/creator','POST',{gifts:Array.from({length:100},(_,i)=>({id:String(700000+i),name:'Bulk '+i,coins:i}))},secondToken);
assert.equal(bulk.status,200);assert.equal(bulk.body.saved,100);
assert.equal((await api('/gifts/creator','POST',{padding:'x'.repeat(4000000)},secondToken)).status,413);
console.log('Exact/range coin searches, unknown prices, quoted CSV/JSON validation, 100-gift imports and request-size limits passed.');
