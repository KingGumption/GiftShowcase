import {changeWatch} from './live-alerts.mjs';
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function tiktokUsername(value) {
  const name=String(value||'').trim().replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9_.]{2,24}$/.test(name))throw Error('Enter a TikTok username, for example @kinggumption.');
  return name;
}

// Only the event fields needed by overlays leave the server. Never forward provider diagnostics or credentials.
export function normaliseLiveEvent(type,raw={},roomId='') {
  if(!raw||typeof raw!=='object')return null;
  const names={WebcastGiftMessage:'gift',WebcastLikeMessage:'like',WebcastRoomUserSeqMessage:'roomUser',WebcastControlMessage:'control',WebcastSocialMessage:'social'};
  type=names[type]||type;
  if(type==='social') {const key=String(raw.common?.displayText?.key||raw.common?.displayText?.displayType||'');type=key.includes('follow')?'follow':key.includes('share')?'share':'';}
  if(type==='control'){if(![3,4].includes(Number(raw.action)))return null;type='streamEnd';}
  if(!['gift','like','follow','share','roomUser','streamEnd'].includes(type))return null;
  const u=raw.user||{},g=raw.giftDetails||raw.gift||raw.extendedGiftInfo||{};
  const image=v=>v?.urlList?.[0]||v?.url_list?.[0]||v?.url?.[0]||'';
  const data={msgId:String(raw.msgId||raw.common?.msgId||crypto.randomUUID()),roomId:String(raw.roomId||raw.common?.roomId||roomId),
    userId:String(raw.userId||u.userId||u.idStr||u.id||''),uniqueId:String(raw.uniqueId||u.uniqueId||u.displayId||''),
    nickname:String(raw.nickname||u.nickname||u.uniqueId||'Viewer').slice(0,100),
    profilePictureUrl:raw.profilePictureUrl||u.profilePictureUrl||image(u.profilePicture)||image(u.avatarThumb)||image(u.avatarLarge)};
  if(type==='like'){data.likeCount=Number(raw.likeCount)||0;if(raw.totalLikeCount!==undefined)data.totalLikeCount=Number(raw.totalLikeCount);}
  if(type==='gift')Object.assign(data,{giftId:String(raw.giftId||g.id||''),giftName:String(raw.giftName||g.giftName||g.name||'').slice(0,100),
    giftType:Number(raw.giftType??g.giftType??g.type??g.gift_type??0),repeatCount:Math.max(1,Number(raw.repeatCount)||1),repeatEnd:raw.repeatEnd===true||raw.repeatEnd===1,
    diamondCount:Number(raw.diamondCount??g.diamondCount??g.diamond_count??0),giftPictureUrl:raw.giftPictureUrl||image(g.giftImage)||image(g.image)||image(g.icon)});
  if(type==='roomUser')data.viewerCount=Number(raw.viewerCount||raw.totalUser)||0;
  for(const key of ['totalFollowerCount','totalFollowers','followerCount'])if(raw[key]!==undefined)data[key]=Number(raw[key]);
  return {event:type,data};
}

export function creatorHub(env,userId){return env.CREATOR_LIVE.get(env.CREATOR_LIVE.idFromName(userId));}
export async function stopCreatorLive(env,userId,forget=false){if(env.CREATOR_LIVE)await creatorHub(env,userId).fetch('https://creator-live/disable'+(forget?'?forget=1':''),{method:'POST'});}
export async function revokeCreatorSource(env,userId,token){if(env.CREATOR_LIVE&&token)await creatorHub(env,userId).fetch('https://creator-live/revoke',{method:'POST',body:JSON.stringify({token})});}

export class CreatorLive {
  constructor(state,env){
    this.state=state;this.env=env;this.config={username:'',enabled:false};this.phase='disconnected';this.generation=0;this.attempt=0;this.seen=new Map();
    this.ready = state.blockConcurrencyWhile(async () => {
      this.config = await state.storage.get('connection') || this.config;
      this.guard = await state.storage.get('upstreamGuard') || {attempts: []};
      this.phase = this.config.enabled ? this.guard.phase || 'waiting' : 'disconnected';
    });
  }
  status(){return {username:this.config.username,enabled:this.config.enabled,phase:this.phase,configured:Boolean(this.env.EULER_API_KEY),autoStart:this.config.armed===true,tikfinityBackup:this.config.tikfinityBackup===true,subscribers:this.state.getWebSockets().length,...(this.notice?{message:this.notice}:{})};}
  announce(){const message=JSON.stringify({type:'creator.status',...this.status()});for(const socket of this.state.getWebSockets())try{socket.send(message);}catch{}}
  async fetch(request){
    await this.ready;const url=new URL(request.url);
    if (url.pathname === '/status') return json({
      ...this.status(),
      attemptsLastHour: this.guard.attempts.filter(at => at > Date.now()-3600000).length,
      retryAfter: this.guard.phase === 'limited' ? this.guard.resumeAt : null
    });
    if (url.pathname === '/backup' && request.method === 'POST') {
      const {tikfinityBackup} = await request.json();
      this.config.tikfinityBackup = tikfinityBackup === true;
      await this.state.storage.put('connection',this.config);
      this.announce();
      return json(this.status());
    }
    if (url.pathname === '/live-start' && request.method === 'POST') {
      const {username} = await request.json();
      if (this.config.enabled && this.config.username === username &&
          (!this.upstream || ['offline','ended'].includes(this.phase)) &&
          !this.connecting && !(this.guard.lastSignal > Date.now() - 60000)) {
        this.guard.lastSignal = Date.now();
        if (['offline','ended'].includes(this.guard.phase) || ['offline','ended'].includes(this.phase)) {
          this.closeUpstream();
          this.guard.phase = null;
          this.phase = 'waiting';
          this.retryAt = 0;
        }
        await this.saveGuard();
        const source = this.state.getWebSockets()[0]?.deserializeAttachment();
        if (source && await this.validSource(source.userId, source.token)) {
          await this.ensureConnected();
          await this.schedule();
        }
      }
      return json({ok:true});
    }
    if(url.pathname==='/revoke'&&request.method==='POST'){
      const {token}=await request.json();for(const socket of this.state.getWebSockets())if(socket.deserializeAttachment()?.token===token)socket.close(1000,'Source revoked');
      await this.schedule();return json({ok:true});
    }
    if(url.pathname==='/configure'&&request.method==='POST'){
      let input;try{input=await request.json();input.username=tiktokUsername(input.username);}catch{return json({error:'Enter a valid TikTok username.'},400);}
      if(!this.env.EULER_API_KEY)return json({error:'TikTok LIVE is awaiting server setup.'},503);
      const same=this.config.username===input.username&&this.config.enabled;
      if (!same && this.config.username) await changeWatch(this.env,this.config.username,input.userId,false);
      if (!same || ['offline','ended','error'].includes(this.guard.phase)) {
        if (this.guard.phase !== 'limited') this.guard.phase = null;
        this.guard.lastSignal = 0;
        await this.saveGuard();
      }
      this.config=same ? this.config : {username:input.username,enabled:true,userId:input.userId,tikfinityBackup:this.config.tikfinityBackup===true};await this.state.storage.put('connection',this.config);
      if(!same||['offline','ended','error','limited'].includes(this.phase)){this.closeUpstream();this.attempt=0;this.retryAt=0;}
      this.idleSince=Date.now();
      await this.arm();await this.ensureConnected();await this.schedule();return json(this.status());
    }
    if(url.pathname==='/disable'&&request.method==='POST'){
      const old = this.config;
      this.config={username:this.config.username,enabled:false,userId:this.config.userId,tikfinityBackup:old.tikfinityBackup===true};await this.state.storage.put('connection',this.config);
      this.closeUpstream();this.phase='disconnected';this.notice='';this.announce();
      for(const socket of this.state.getWebSockets())socket.close(1000,'Creator disconnected');
      if(url.searchParams.get('forget')==='1'){await this.state.storage.delete('upstreamGuard');await this.state.storage.delete('connection');this.config={username:'',enabled:false};}
      await changeWatch(this.env,old.username,old.userId,false);
      await this.state.storage.deleteAlarm();return json(this.status());
    }
    if(url.pathname==='/subscribe'&&request.headers.get('Upgrade')?.toLowerCase()==='websocket'){
      const userId=url.searchParams.get('user'),token=url.searchParams.get('token');
      if(!await this.validSource(userId,token))return json({error:'Source unavailable'},404);
      if(this.state.getWebSockets().length>=100)return json({error:'Too many open overlay sources'},429);
      const pair=new WebSocketPair(),[client,server]=Object.values(pair);
      server.serializeAttachment({userId,token,lastSeen:Date.now()});this.state.acceptWebSocket(server);
      this.idleSince=0;
      if(!this.config.userId){this.config.userId=userId;await this.state.storage.put('connection',this.config);}
      server.send(JSON.stringify({type:'creator.status',...this.status()}));
      // Subscribers never choose the username. Only the authenticated owner can configure it.
      this.state.waitUntil(this.arm().then(()=>this.ensureConnected()));await this.schedule();
      return new Response(null,{status:101,webSocket:client});
    }
    return json({error:'Not found'},404);
  }
  async validSource(userId,token){
    if(!userId||!token||this.config.userId&&userId!==this.config.userId)return false;
    const user=await this.env.DB.prepare('SELECT u.id,a.status FROM users u LEFT JOIN user_access a ON a.user_id=u.id WHERE u.id=?').bind(userId).first();
    if(!user||user.status==='suspended')return false;
    const dock=await this.env.DB.prepare('SELECT id FROM output_docks WHERE user_id=? AND public_token=? AND sample_activity=0').bind(userId,token).first();
    if(dock)return true;
    return Boolean(await this.env.DB.prepare('SELECT v.id FROM variant_links l JOIN overlay_variants v ON v.id=l.overlay_variant_id WHERE v.user_id=? AND l.public_token=?').bind(userId,token).first());
  }
  async arm() {
    if (!this.env.LIVE_ALERTS || !this.config.enabled || this.config.armed ||
        this.config.armAfter > Date.now()) return;
    if (this.arming) return this.arming;
    const saved = this.config;
    this.arming = (async () => {
      const armed = await changeWatch(this.env,saved.username,saved.userId,true);
      if (this.config === saved) {
        saved.armed = armed;
        saved.armAfter = armed ? 0 : Date.now()+3600000;
        await this.state.storage.put('connection',saved);
      }
    })().finally(()=>{this.arming=null;});
    return this.arming;
  }
  saveGuard() { return this.state.storage.put('upstreamGuard', this.guard); }
  async recordLimit() {
    // A single snapshot on a refusal, never on status checks, supplies the provider reset time.
    try {
      const response = await (this.env.QUOTA_FETCH || fetch)('https://api.eulerstream.com/accounts/me/rate_limits', {
        headers:{'x-api-key':this.env.EULER_API_KEY},signal:AbortSignal.timeout(5000),redirect:'manual'
      });
      const limits = await response.json();
      const reset = Math.max(0,...[limits.day,limits.hour,limits.minute]
        .filter(v=>v?.remaining===0).map(v=>Date.parse(v.reset_at)||0));
      if (this.guard.phase==='limited' && reset>Date.now()) {
        this.guard.resumeAt=reset+1000;
        await this.saveGuard();
      }
    } catch { /* The existing cooldown still applies. */ }
  }
  async ensureConnected(){
    if (!this.config.enabled) return;
    if (this.guard.phase === 'limited' && this.guard.resumeAt <= Date.now()) {
      this.guard.phase = null;
      this.phase = 'waiting';
    }
    if (this.guard.phase) { this.phase=this.guard.phase; return; }
    if(!this.config.enabled||!this.env.EULER_API_KEY||this.upstream||this.connecting||this.retryAt>Date.now()||['offline','ended','limited','error'].includes(this.phase))return this.connecting;
    const generation=this.generation;
    this.phase='connecting';this.notice='';this.announce();
    const operation=(async()=>{
      try{
        const now = Date.now();
        this.guard.attempts = this.guard.attempts.filter(time => time > now-3600000);
        if (this.guard.attempts.length >= 12) {
          this.phase = this.guard.phase = 'limited';
          this.guard.resumeAt = this.guard.attempts[0]+3600001;
          this.notice = 'Repeated connection attempts paused for this creator.';
          await this.saveGuard(); this.announce(); return;
        }
        this.guard.attempts.push(now);
        await this.saveGuard();
        if (generation !== this.generation) return;
        const url=new URL('https://ws.eulerstream.com/');url.searchParams.set('uniqueId',this.config.username);url.searchParams.set('apiKey',this.env.EULER_API_KEY);
        for(const [k,v]of Object.entries({schemaVersion:'v2',bundleEvents:'true',rawMessages:'false'}))url.searchParams.set('features.'+k,v);
        const response=await (this.env.LIVE_FETCH||fetch)(url,{headers:{Upgrade:'websocket'},signal:AbortSignal.timeout(20000)});
        const socket=response.webSocket;
        if(generation!==this.generation){socket?.accept();socket?.close(1000,'Replaced');return;}
        if(!socket){this.upstreamClosed(response.status===429?4429:4400);this.phase=response.status===429?'limited':'error';this.notice=response.status===429?'Connection allowance reached. Retry later.':'TikTok connection unavailable. Check server credentials and try again.';this.announce();return;}
        socket.accept();this.upstream=socket;this.lastEventAt=Date.now();
        socket.addEventListener('message',event=>{if(generation===this.generation)this.receive(event.data);});
        socket.addEventListener('close',event=>{if(generation===this.generation)this.upstreamClosed(event.code);});
        socket.addEventListener('error',()=>{if(generation===this.generation){try{socket.close(1011,'Upstream error');}catch{}this.upstreamClosed(1011);}});
        this.phase='connecting';this.announce();
      }catch{if(generation===this.generation)this.upstreamClosed(1011);}
    })();
    this.connecting=operation;try{await operation;}finally{if(this.connecting===operation)this.connecting=null;}
  }
  receive(raw){
    if(typeof raw!=='string'||raw.length>2000000)return;
    if(raw==='ping'){this.lastEventAt=Date.now();this.upstream?.send('pong');return;}
    let frame;try{frame=JSON.parse(raw);}catch{return;}
    this.lastEventAt=Date.now();
    const messages=Array.isArray(frame.messages)?frame.messages:Array.isArray(frame)?frame:[frame];
    for(const message of messages.slice(0,1000)){
      if(!message||typeof message!=='object')continue;
      if(message.type==='room.status'){
        const p=message.data?.state;if(['connecting','connected','reconnecting','offline','ended','error'].includes(p)){this.phase=p;if(p==='connected')this.attempt=0;this.roomId=message.data.roomId||this.roomId;this.announce();}continue;
      }
      if(message.type==='tiktok.connect'){this.phase='connected';this.attempt=0;this.announce();continue;}
      const event=normaliseLiveEvent(message.type||message.event,message.data,this.roomId);if(!event)continue;
      this.phase='connected';this.attempt=0;
      const key=[event.event,event.data.msgId,event.data.repeatCount,event.data.repeatEnd].join(':');
      if(this.seen.has(key))continue;this.seen.set(key,Date.now());
      while(this.seen.size>5000||this.seen.size&&this.seen.values().next().value<Date.now()-120000)this.seen.delete(this.seen.keys().next().value);
      const text=JSON.stringify(event);for(const socket of this.state.getWebSockets())try{socket.send(text);}catch{}
    }
  }
  upstreamClosed(code){
    if(!this.upstream&&this.retryAt>Date.now())return;this.generation++;this.upstream=null;
    const terminal={4400:'error',4401:'error',4403:'error',4404:'offline',4005:'ended',4429:'limited'};
    this.phase=terminal[code]||(++this.attempt>5?'error':'reconnecting');
    if (['limited','offline','ended','error'].includes(this.phase)) {
      this.guard.phase=this.phase;
      if (this.phase==='limited') this.guard.resumeAt=Date.now()+3600000;
      this.state.waitUntil(this.saveGuard());
      if (this.phase==='limited') this.state.waitUntil(this.recordLimit());
    }
    this.notice=this.phase==='limited'?'Euler connection allowance reached. Retry later.':this.phase==='offline'?'This creator is not live.':this.phase==='error'?'Connection stopped. Check your settings and retry.':'';
    this.retryAt=Date.now()+Math.min(60000,5000*2**Math.max(0,this.attempt-1));this.announce();this.state.waitUntil(this.schedule());
  }
  closeUpstream(){this.generation++;const old=this.upstream;this.upstream=null;this.connecting=null;this.retryAt=0;this.phase='disconnected';try{old?.close(1000,'Creator connection changed');}catch{}this.seen.clear();}
  async schedule(){if(this.config.enabled||this.state.getWebSockets().length)await this.state.storage.setAlarm(Date.now()+15000);}
  async alarm(){
    await this.ready;
    const owner=await this.env.DB.prepare('SELECT u.id,a.status FROM users u LEFT JOIN user_access a ON a.user_id=u.id WHERE u.id=?').bind(this.config.userId||'').first();
    if(!owner||owner.status==='suspended'){await this.fetch(new Request('https://creator-live/disable',{method:'POST'}));return;}
    for(const socket of this.state.getWebSockets()){
      const a=socket.deserializeAttachment();
      if(!a||Date.now()-a.lastSeen>75000||!await this.validSource(a.userId,a.token))socket.close(1000,'Source unavailable');
    }
    if(!this.state.getWebSockets().length){
      this.idleSince ||= Date.now();
      if(Date.now()-this.idleSince<30000){await this.schedule();return;}
      this.closeUpstream();this.phase=this.guard.phase || (this.config.enabled?'waiting':'disconnected');return;
    }
    // Euler closes inactive sockets. Quiet rooms can legitimately produce no overlay events.
    await this.ensureConnected();await this.schedule();
  }
  webSocketMessage(socket,message){if(message==='ping'){const a=socket.deserializeAttachment();socket.serializeAttachment({...a,lastSeen:Date.now()});socket.send('pong');}}
  webSocketClose(socket,code){try{socket.close(code===1006?1000:code);}catch{}if(!this.state.getWebSockets().length){this.idleSince ||= Date.now();this.state.waitUntil(this.schedule());}}
  webSocketError(socket){try{socket.close(1011,'Source error');}catch{}}
}
