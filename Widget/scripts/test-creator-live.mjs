import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {CreatorLive,normaliseLiveEvent,tiktokUsername} from '../cloudflare/src/creator-live.mjs';
import {worker,env,database} from './studio-test-support.mjs';
import {installCreatorLive} from './creator-live-test-hub.mjs';

class Socket extends EventTarget{
  constructor(){super();this.readyState=1;this.sent=[];}
  accept(){}send(value){this.sent.push(value);}close(code){this.readyState=3;this.code=code;}
  serializeAttachment(value){this.attachment=value;}deserializeAttachment(){return this.attachment;}
  message(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}));}
}
const upstreams=[];env.SHARED_LIVE_ENABLED='true';env.EULER_API_KEY='local-key-not-real';
env.ASSETS={fetch:async()=>new Response(null,{status:404})};
const hubs=installCreatorLive(env,async url=>{upstreams.push({url:new URL(url),socket:new Socket()});return {webSocket:upstreams.at(-1).socket};});
async function api(path,method='GET',body,token){const r=await worker.fetch(new Request('https://kinggumption.com/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),env);return {status:r.status,body:await r.json()};}

test('creator connections are authenticated, shared across source kinds, single-flight and isolated',async()=>{
  const a=(await api('/auth/register','POST',{email:'live-a@example.invalid',password:'local-test-shared-tiktok-password'})).body;
  const b=(await api('/auth/register','POST',{email:'live-b@example.invalid',password:'local-test-shared-tiktok-password'})).body;
  assert.equal((await api('/tiktok')).status,401);
  assert.equal((await api('/tiktok','POST',{username:'https://invalid.test'},a.session.token)).status,400);
  assert.equal((await api('/tiktok','POST',{username:'@Creator_A'},a.session.token)).status,200);
  const hub=hubs.get(a.user.id),status=(await api('/tiktok','GET',undefined,a.session.token)).body;
  assert.equal(status.username,'creator_a');assert(!JSON.stringify(status).includes(env.EULER_API_KEY));
  assert.equal(upstreams.length,1);assert.equal(upstreams[0].url.searchParams.get('apiKey'),env.EULER_API_KEY);
  await Promise.all([hub.instance.ensureConnected(),hub.instance.ensureConnected()]);assert.equal(upstreams.length,1);
  const variant=(await api('/variants','POST',{name:'Live direct',overlayKind:'goal',config:{}},a.session.token)).body.variant;
  const link=(await api('/variants/'+variant.id+'/direct-link','POST',{},a.session.token)).body;
  const canvas=database.prepare('SELECT * FROM output_docks WHERE user_id=? LIMIT 1').get(a.user.id);
  assert(await hub.instance.validSource(a.user.id,link.publicToken));assert(await hub.instance.validSource(a.user.id,canvas.public_token));
  assert.equal(await hub.instance.validSource(b.user.id,link.publicToken),false);
  const direct=new Socket(),canvasSocket=new Socket();hub.state.acceptWebSocket(direct);hub.state.acceptWebSocket(canvasSocket);
  direct.serializeAttachment({userId:a.user.id,token:link.publicToken,lastSeen:Date.now()});canvasSocket.serializeAttachment({userId:a.user.id,token:canvas.public_token,lastSeen:Date.now()});
  await api('/tiktok','POST',{username:'creator_b'},b.session.token);assert.equal(upstreams.length,2);
  const other=new Socket();hubs.get(b.user.id).state.acceptWebSocket(other);
  const event={type:'WebcastLikeMessage',data:{common:{msgId:'same-id'},likeCount:12,user:{idStr:'viewer'}}};
  upstreams[0].socket.message({messages:[event,event]});
  for(const s of [direct,canvasSocket])assert.equal(s.sent.filter(x=>JSON.parse(x).event==='like').length,1);
  assert.equal(other.sent.filter(x=>JSON.parse(x).event==='like').length,0);
  // Refresh: dropping the last browser source has a grace period, not a new upstream connection.
  direct.close(1000);canvasSocket.close(1000);hub.instance.webSocketClose(canvasSocket,1000);assert.equal(upstreams[0].socket.readyState,1);
  const refreshed=new Socket();refreshed.serializeAttachment({userId:a.user.id,token:link.publicToken,lastSeen:Date.now()});hub.state.acceptWebSocket(refreshed);await hub.instance.ensureConnected();assert.equal(upstreams.length,2);
  await api('/tiktok','POST',{username:'creator_new'},a.session.token);assert.equal(upstreams.length,3);assert.equal(upstreams[0].socket.readyState,3);assert.equal(upstreams[1].socket.readyState,1);
  const before=refreshed.sent.length;upstreams[0].socket.message(event);assert.equal(refreshed.sent.length,before,'Old username cannot leak late events');
  const html=await worker.fetch(new Request('https://kinggumption.com/widget/'+link.publicToken+'/config.js'),env);assert((await html.text()).includes('window.creatorLiveShared=true'));
  const publicDock=(await api('/public/docks/'+canvas.public_token)).body;assert.equal(publicDock.dock.sharedLive,true);
  const rotated=await api('/variants/'+variant.id+'/rotate-link','POST',{password:'local-test-shared-tiktok-password'},a.session.token);
  assert.equal(rotated.status,200);assert.equal(refreshed.readyState,3,'Rotating a Direct URL must immediately revoke its live subscription');
  assert.equal(await hub.instance.validSource(a.user.id,link.publicToken),false);
  const renewed=new Socket();renewed.serializeAttachment({userId:a.user.id,token:rotated.body.publicToken,lastSeen:Date.now()});hub.state.acceptWebSocket(renewed);
  database.prepare("INSERT INTO user_access(user_id,role,status,updated_at) VALUES (?,'member','suspended',?)").run(a.user.id,new Date().toISOString());
  await hub.instance.alarm();assert.equal(renewed.readyState,3);assert.equal(upstreams[2].socket.readyState,3);
});

test('normalization preserves gift streaks, social types, IDs and excludes provider secrets',()=>{
  const raw={common:{msgId:'999',displayText:{key:'live_room_follow'}},user:{idStr:'123',nickname:'Creator'},apiKey:'must-not-leak'};
  assert.equal(normaliseLiveEvent('WebcastSocialMessage',raw).event,'follow');
  assert.equal(normaliseLiveEvent('WebcastSocialMessage',{common:{displayText:{displayType:'pm_mt_guidance_share'}},action:'3'}).event,'share');
  assert.equal(normaliseLiveEvent('WebcastSocialMessage',{common:{displayText:{displayType:'pm_main_follow_message'}}}).event,'follow');
  assert.equal(normaliseLiveEvent('WebcastLikeMessage',{user:{profilePicture:{url:['https://example.test/profile.png']}}}).data.profilePictureUrl,'https://example.test/profile.png');
  const gift=normaliseLiveEvent('WebcastGiftMessage',{...raw,giftId:5655,giftDetails:{giftType:1,giftName:'Rose',diamondCount:1,giftImage:{url:['https://example.test/rose.png']}},repeatCount:3,repeatEnd:1});
  assert.equal(gift.data.repeatEnd,true);assert.equal(gift.data.repeatCount,3);assert.equal(gift.data.userId,'123');assert.equal(gift.data.giftPictureUrl,'https://example.test/rose.png');assert(!JSON.stringify(gift).includes('must-not-leak'));
  assert.equal(normaliseLiveEvent('provider.debug',{apiKey:'secret'}),null);assert.equal(tiktokUsername('@Creator'),'creator');
});

test('Direct URL injects the shared client before renderer scripts; Canvas opts into its owner relay',async()=>{
  env.ASSETS={async fetch(r){const p=new URL(r.url).pathname;return new Response(fs.readFileSync(new URL('../public/'+p.split('/').pop(),import.meta.url),'utf8'),{headers:{'Content-Type':'text/html'}});}};
  const account=(await api('/auth/register','POST',{email:'live-html@example.invalid',password:'local-test-shared-tiktok-password'})).body;
  for(const kind of ['carousel','rows','side-gifts','goal','top-likers']){
    const v=(await api('/variants','POST',{name:'Direct '+kind,overlayKind:kind,config:{}},account.session.token)).body.variant;
    const link=(await api('/variants/'+v.id+'/direct-link','POST',{},account.session.token)).body;
    const response=await worker.fetch(new Request('https://kinggumption.com/widget/'+link.publicToken),env),html=await response.text();
    assert.equal(response.status,200);assert(html.includes('creator-live-client.js'));assert(html.indexOf('creator-live-client.js')<html.lastIndexOf('<script src="./'),'Shared endpoint is ready before the renderer loads');
  }
});

test('daily quota cooldown survives hibernation, manual retries and a live-start signal', async () => {
  const local = {...env, QUOTA_FETCH: async () => Response.json({
    day:{remaining:0,reset_at:new Date(Date.now()+7200000).toISOString()}
  })};
  let requests=0;
  installCreatorLive(local,async () => {requests++; return {status:429};});
  const hub=local.CREATOR_LIVE.get('budget-test');
  const input={method:'POST',body:JSON.stringify({userId:'budget-test',username:'budget_test'})};
  await hub.fetch('https://hub/configure',input);
  await Promise.all(hub.pending);
  assert.equal(requests,1);
  const restored=new CreatorLive(hub.state,local);
  await restored.fetch(new Request('https://hub/configure',input));
  await restored.fetch(new Request('https://hub/live-start',input));
  await restored.ensureConnected();
  const status=await (await restored.fetch(new Request('https://hub/status'))).json();
  assert.equal(status.phase,'limited');
  assert(status.retryAfter>Date.now()+7100000);
  assert.equal(status.attemptsLastHour,1);
  assert.equal(requests,1);
});
