import {randomUUID} from 'node:crypto';

export function username(value) {
  const name = String(value || '').trim().replace(/^@/, '');
  if (!/^[a-zA-Z0-9_.]{2,24}$/.test(name)) throw Error('Enter a TikTok username, for example @kinggumption.');
  return name;
}

// Keep the existing overlay wire format while replacing the event source.
export function overlayEvent(event, raw, roomId = '') {
  if (!['gift','like','follow','share','roomUser','streamEnd'].includes(event)) return null;
  const user = raw.user || {}, gift = raw.giftDetails || raw.gift || raw.extendedGiftInfo || {};
  const data = {...raw, roomId: String(raw.roomId || roomId),
    msgId: String(raw.msgId || raw.common?.msgId || randomUUID()),
    userId: String(raw.userId || user.userId || user.idStr || user.id || ''),
    uniqueId: raw.uniqueId || user.uniqueId || user.displayId || '',
    nickname: raw.nickname || user.nickname || user.uniqueId || 'Viewer',
    profilePictureUrl: raw.profilePictureUrl || user.profilePictureUrl || user.avatarThumb?.urlList?.[0] || user.avatarThumb?.url_list?.[0] || user.avatarThumb?.url?.[0] || user.avatarLarge?.urlList?.[0] || ''};
  if (event === 'gift') Object.assign(data, {
    giftId: String(raw.giftId || gift.id || ''),
    giftName: raw.giftName || gift.name || gift.giftName || '',
    giftType: Number(raw.giftType ?? gift.type ?? gift.giftType ?? gift.gift_type ?? 0),
    diamondCount: Number(raw.diamondCount ?? gift.diamondCount ?? gift.diamond_count ?? 0),
    repeatCount: Math.max(1, Number(raw.repeatCount) || 1),
    repeatEnd: raw.repeatEnd === true || raw.repeatEnd === 1,
    giftPictureUrl: raw.giftPictureUrl || gift.giftImage?.url?.[0] || gift.image?.urlList?.[0] || gift.icon?.urlList?.[0] || ''
  });
  // Protobuf int64 fields may be bigint; preserve IDs without losing precision.
  return JSON.parse(JSON.stringify({event, data}, (_, v) => typeof v === 'bigint' ? String(v) : v));
}

export class LiveBridge {
  constructor(factory, broadcast) { this.factory = factory; this.broadcast = broadcast; this.generation = 0; this.status = {phase:'disconnected', username:''}; }
  async disconnect() {
    this.generation++;
    clearTimeout(this.retry);
    const previous = this.connection;
    this.connection = null;
    this.status = {phase:'disconnected', username:''};
    if (previous) { previous.removeAllListeners(); previous.on('error', () => {}); await previous.disconnect(); }
  }
  async connect(input) {
    const name = username(input);
    await this.disconnect();
    const generation = this.generation;
    this.status = {phase:'connecting', username:name};
    const connection = await this.factory(name);
    if (generation !== this.generation) { await connection.disconnect(); return this.status; }
    this.connection = connection;
    const current = () => generation === this.generation;
    for (const type of ['gift','like','follow','share','roomUser','streamEnd']) connection.on(type, raw => {
      if (!current()) return;
      const event = overlayEvent(type, raw || {}, this.status.roomId);
      this.broadcast(event);
      if (type === 'streamEnd') { this.status = {...this.status, phase:'ended'}; }
    });
    connection.on('error', () => { if (current()) this.status = {...this.status, error:'TikTok connection error. Check the username and signing-service access.'}; });
    connection.on('disconnected', () => { if (current() && this.status.phase !== 'ended') this.status = {...this.status, phase:'disconnected'}; });
    try {
      const state = await connection.connect();
      if (!current()) { await connection.disconnect(); return this.status; }
      this.status = {phase:'connected', username:name, roomId:String(state.roomId || '')};
    } catch (error) {
      if (!current()) return this.status;
      const offline = /offline|not live/i.test(error.name + ' ' + error.message);
      this.status = {phase:offline?'offline':'error', username:name,
        error:offline?'This creator is not live. Go live, then connect again.':'Could not connect. Check signing-service access and try again.'};
      connection.removeAllListeners(); connection.on('error', () => {}); await connection.disconnect();
      this.connection = null;
    }
    return this.status;
  }
}

export const fixtures = [
  ['like', {msgId:'like-1', likeCount:125, totalLikeCount:125, user:{userId:'101',uniqueId:'local_viewer',nickname:'Local Viewer'}}],
  ['follow', {msgId:'follow-1',user:{userId:'101',uniqueId:'local_viewer',nickname:'Local Viewer'}}],
  ['share', {msgId:'share-1',user:{userId:'101',uniqueId:'local_viewer',nickname:'Local Viewer'}}],
  ['gift', {msgId:'gift-progress',giftId:'5655',giftDetails:{name:'Rose',type:1,diamondCount:1},repeatCount:2,repeatEnd:0,user:{userId:'101',uniqueId:'local_viewer',nickname:'Local Viewer'}}],
  ['gift', {msgId:'gift-final',giftId:'5655',giftDetails:{name:'Rose',type:1,diamondCount:1},repeatCount:3,repeatEnd:1,user:{userId:'101',uniqueId:'local_viewer',nickname:'Local Viewer'}}]
];
