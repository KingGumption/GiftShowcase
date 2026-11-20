import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter, once} from 'node:events';
import {WebSocket} from 'ws';
import {LiveBridge, overlayEvent, username} from './bridge.mjs';
import {startServer} from './server.mjs';

test('adapts native protobuf fields and preserves gift streak progress and final quantities',()=>{
  const raw={common:{msgId:9007199254740999n},user:{idStr:'123',uniqueId:'viewer',nickname:'Viewer',avatarThumb:{urlList:['https://example.test/avatar.png']}},giftId:5655n,giftDetails:{giftType:1,giftName:'Rose',diamondCount:1,giftImage:{url:['https://example.test/rose.png']}},repeatCount:3,repeatEnd:1};
  const result=overlayEvent('gift',raw,'room');
  assert.equal(result.data.msgId,'9007199254740999');assert.equal(result.data.userId,'123');assert.equal(result.data.giftId,'5655');assert.equal(result.data.giftName,'Rose');assert.equal(result.data.giftType,1);assert.equal(result.data.repeatEnd,true);assert.equal(result.data.repeatCount,3);assert.equal(result.data.giftPictureUrl,'https://example.test/rose.png');
  assert.equal(overlayEvent('gift',{...raw,repeatEnd:0}).data.repeatEnd,false);
  assert.equal(username('@kinggumption'),'kinggumption');assert.throws(()=>username('https://attacker.test/'));assert.equal(overlayEvent('unknown',{}),null);
});

test('username connection relays events and isolates disconnected or replaced streams',async()=>{
  const sources=[],sent=[];
  const bridge=new LiveBridge(async name=>{const s=new EventEmitter();s.connect=async()=>({roomId:name});s.disconnect=async()=>{s.closed=true;};sources.push(s);return s;},event=>sent.push(event));
  assert.equal((await bridge.connect('@creator')).phase,'connected');sources[0].emit('like',{likeCount:50});assert.equal(sent[0].data.likeCount,50);
  await bridge.connect('other');assert(sources[0].closed);sources[0].emit('like',{likeCount:999});assert.equal(sent.length,1);
  sources[1].emit('streamEnd',{});assert.equal(bridge.status.phase,'ended');await bridge.disconnect();assert.equal(bridge.status.phase,'disconnected');
});

test('offline failures are explicit and no signing-service error or key is exposed',async()=>{
  const bridge=new LiveBridge(async()=>{const s=new EventEmitter();s.connect=async()=>{throw Error('User is offline secret-key');};s.disconnect=async()=>{};return s;},()=>{});
  assert.equal((await bridge.connect('creator')).phase,'offline');assert(!JSON.stringify(bridge.status).includes('secret-key'));
});

test('real local WebSocket transports fixtures; cross-origin writes and source-file access are rejected',async()=>{
  const app=await startServer({port:0,fixtureMode:true});
  try {
    const socket=new WebSocket(app.origin.replace('http:','ws:')+'/events');await once(socket,'open');
    const events=[];socket.on('message',data=>events.push(JSON.parse(data)));
    const options={method:'POST',headers:{Origin:app.origin,'Content-Type':'application/json'},body:'{}'};
    assert.equal((await fetch(app.origin+'/live/sample',{...options,headers:{...options.headers,Origin:'https://attacker.test'}})).status,403);
    assert.equal((await fetch(app.origin+'/bridge.mjs')).status,404);
    assert.equal((await fetch(app.origin+'/Widget/public/index-thin.html')).status,200);
    assert.equal((await fetch(app.origin+'/live/sample',options)).status,200);
    await new Promise(r=>setTimeout(r,30));assert.equal(events.length,5);assert.equal(events.at(-1).data.repeatEnd,true);
    assert.equal((await fetch(app.origin+'/live/connect',{...options,body:JSON.stringify({username:'creator'})})).status,409);
    socket.close();await once(socket,'close');
  }finally{await app.close();}
});
