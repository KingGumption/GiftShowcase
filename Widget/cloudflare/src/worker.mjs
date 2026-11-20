import {routeAdmin,invitationFor,digest as invitationDigest} from './studio-admin.mjs';
import {mailReady,sendStudioMail} from './studio-mail.mjs';
import {creatorHub,stopCreatorLive,revokeCreatorSource} from './creator-live.mjs';
import {watchRegistry} from './live-alerts.mjs';
export {LiveAlerts} from './live-alerts.mjs';
export {CreatorLive} from './creator-live.mjs';
import {graphicSize,graphicHubRequest,expireGraphic,clearGraphic} from './graphics-live.mjs';
import {routeSounds,deleteAccountSounds,cleanupUserSounds} from './user-sounds.mjs';
import {cleanupCreatorImages} from './creator-storage.mjs';
import {listCreatorGifts, saveCreatorGifts, creatorGiftImage} from './creator-gifts.mjs';
import { syncGiftCatalogue, syncTikfinityCatalogue, getGiftCatalogue, getGiftImage, warmGiftImages } from './gift-catalogue.mjs';

const passwordIterations = 100000;
const sessionDays = 30;
const maxConfigBytes = 900000;
const defaultRevisionRetentionDays = 365;
const defaultRevisionLimit = 50;
const defaultAuthWindowMinutes = 15;
const defaultAuthAttemptLimit = 8;
const allowedOverlayKinds = new Set(['carousel', 'rows', 'side-gifts', 'goal', 'top-likers']);
const livePlatformNames = ['tiktok', 'twitch', 'youtube'];
let twitchAccessToken = null;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = getCorsHeaders(origin, env.ALLOWED_ORIGINS);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const response = await routeRequest(request, env, ctx);
      if (response.webSocket) return response;
      const headers = new Headers(response.headers);
      Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
      Object.entries(getSecurityHeaders()).forEach(([key, value]) => headers.set(key, value));
      if(!['/','/privacy/','/privacy','/help/','/help'].includes(new URL(request.url).pathname))headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      const status = error?.status || 500;
      if (status >= 500) console.error(error);
      return json(
        { error: status >= 500 ? 'The service could not complete that request. Please try again.' : error.message },
        status,
        { ...cors, ...getSecurityHeaders(), ...(error?.headers || {}) }
      );
    }
  },

  async scheduled(controller, env, ctx) {
    if (controller.cron === '15 * * * *') {
      ctx.waitUntil((async () => {
        await Promise.all([syncGiftCatalogue(env), syncTikfinityCatalogue(env)]);
        const key = env.TIKFINITY_CATALOGUE_ENABLED === 'true' && new Date().getUTCHours() % 2 ? 'TF' : env.GIFT_CATALOGUE_REGION || 'GB';
        await warmGiftImages(env, key);
      })());
    } else if(controller.cron === '45 * * * *') {
      ctx.waitUntil(cleanupCreatorImages(env).then(()=>cleanupUserSounds(env)));
    } else {
      ctx.waitUntil(cleanupRetainedData(env));
    }
  }
};

export class DockHub {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const graphics=await graphicHubRequest(this,request);if(graphics)return graphics;

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.state.acceptWebSocket(server);
      server.send(JSON.stringify({ type: 'dock.connected' }));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === 'POST' && url.pathname === '/broadcast') {
      const message = await request.text();
      if(JSON.parse(message).type==='dock.deleted')await clearGraphic(this.state.storage);
      for (const socket of this.state.getWebSockets()) {
        try {
          socket.send(message);
        } catch {
          try { socket.close(1011, 'Delivery failed'); } catch { /* Already closed. */ }
        }
      }
      return new Response(null, { status: 204 });
    }

    return new Response('Not found', { status: 404 });
  }

  async alarm(){await expireGraphic(this);}

  webSocketMessage(socket, message) {
    if (message === 'ping') socket.send('pong');
  }

  webSocketClose(socket, code, reason) {
    try { socket.close(code, reason); } catch { /* Already closed. */ }
  }
}

async function routeRequest(request, env, ctx) {
  const url = new URL(request.url);
  const websiteResponse = await routeWebsiteRequest(request, env, url);
  if (websiteResponse) return websiteResponse;

  const rawPath = url.pathname.replace(/\/+$/, '') || '/';
  const path = rawPath === '/api' ? '/' : rawPath.startsWith('/api/') ? rawPath.slice(4) : rawPath;

  const start = path.match(/^\/v1\/live-start\/([a-z0-9_.]{2,24})\/([a-f0-9-]{36})$/);
  if (start && request.method === 'POST' && env.LIVE_ALERTS && env.SHARED_LIVE_ENABLED === 'true') {
    return watchRegistry(env, start[1]).fetch('https://registry/signal/' + start[2], {method:'POST'});
  }

  if(path==='/v1/tiktok'&&['GET','POST','PATCH','DELETE'].includes(request.method)){
    const user=await requireUser(request,env);
    if(env.SHARED_LIVE_ENABLED!=='true'||!env.CREATOR_LIVE)throw httpError(503,'Shared TikTok connections are not enabled yet.');
    const hub=creatorHub(env,user.id);
    if(request.method==='GET')return hub.fetch('https://creator-live/status');
    if(request.method==='DELETE')return hub.fetch('https://creator-live/disable',{method:'POST'});
    if(request.method==='PATCH'){
      const {tikfinityBackup}=await readJson(request,1024);
      if(typeof tikfinityBackup!=='boolean')throw httpError(400,'Choose a backup setting.');
      return hub.fetch('https://creator-live/backup',{method:'POST',body:JSON.stringify({tikfinityBackup})});
    }
    await enforceAuthRateLimit(request,env,'tiktok-connect',user.id);
    const input=await readJson(request,1024);
    return hub.fetch('https://creator-live/configure',{method:'POST',body:JSON.stringify({username:input.username,userId:user.id})});
  }
  const sharedLive=path.match(/^\/v1\/public\/live\/([^/]+)$/);
  if(sharedLive&&request.method==='GET'){
    if(env.SHARED_LIVE_ENABLED!=='true'||!env.CREATOR_LIVE)throw httpError(503,'Shared TikTok connections are unavailable.');
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')throw httpError(426,'WebSocket upgrade required');
    const token=decodeURIComponent(sharedLive[1]),source=await getPublicDockRow(env,token);
    if(!source||source.sample_activity)throw httpError(404,'Source unavailable');
    const userId=source.user_id||source.directVariant?.user_id;
    const target=new URL('https://creator-live/subscribe');target.searchParams.set('user',userId);target.searchParams.set('token',token);
    return creatorHub(env,userId).fetch(new Request(target,{headers:request.headers}));
  }

  const soundResponse=await routeSounds(request,env,path,{requireUser,readJson,randomToken,json,httpError,enforceAuthRateLimit});
  if(soundResponse)return soundResponse;

  if (request.method === 'GET' && path === '/') {
    return json({ service: 'Gift Showcase API', ok: true });
  }

  if (path === '/v1/gifts/creator') {
    const user = await requireUser(request, env);
    if (request.method === 'GET') return json({gifts: await listCreatorGifts(env, user.id, url.origin)}, 200, {'Cache-Control':'no-store'});
    if (request.method === 'POST') {
      const result = await saveCreatorGifts(env, user.id, await readJson(request, 4000000), true);
      return json({...result,gifts:await listCreatorGifts(env,user.id,url.origin)},200,{'Cache-Control':'no-store'});
    }
  }
  if (request.method === 'POST' && path === '/v1/gifts/discover') {
    const user=await requireUser(request,env);
    return json(await saveCreatorGifts(env,user.id,await readJson(request),false));
  }
  const discovery=path.match(/^\/v1\/public\/docks\/([^/]+)\/gifts$/);
  if (discovery && request.method === 'POST') {
    const dock=await getPublicDockRow(env,decodeURIComponent(discovery[1]));
    if(!dock) throw httpError(404,'Output not found');
    return json(await saveCreatorGifts(env,dock.user_id||dock.directVariant?.user_id,await readJson(request),false));
  }
  const creatorImage=path.match(/^\/v1\/gifts\/creator-images\/([a-f0-9]{32})\.webp$/);
  if(creatorImage && ['GET','HEAD'].includes(request.method)) return creatorGiftImage(env,creatorImage[1],request.method==='HEAD');

  const adminResponse=await routeAdmin(request,env,ctx,path,{json,readJson,requireUser,httpError,enforceAuthRateLimit,deleteUserData,stopUserSources});if(adminResponse)return adminResponse;
  if (request.method === 'GET' && path === '/v1/gifts/catalogue') {
    return json(await getGiftCatalogue(env, url.origin, url.searchParams.get('status') !== '1'), 200, { 'Cache-Control': 'no-store' });
  }
  if (request.method === 'POST' && path === '/v1/gifts/sync') {
    await requireUser(request, env);
    const [regional, tikfinity] = await Promise.all([syncGiftCatalogue(env, { force: true }), syncTikfinityCatalogue(env, { force: true })]);
    const catalogue = await getGiftCatalogue(env, url.origin);
    const refreshed = regional.refreshed || tikfinity.refreshed;
    return json({ refreshed, count: catalogue.gifts.length, regional, tikfinity,
      ...(!refreshed ? {reason: regional.reason} : {}), catalogue }, 200, { 'Cache-Control': 'no-store' });
  }
  const giftImage = path.match(/^\/v1\/gifts\/images\/([A-Z]{2})\/(\d{1,20})\.webp$/);
  if (giftImage && ['GET', 'HEAD'].includes(request.method)) {
    return getGiftImage(env, giftImage[1], giftImage[2], { head: request.method === 'HEAD' });
  }

  if (request.method === 'GET' && path === '/v1/config') {
    return json({
      registrationEnabled: readBoolean(env.REGISTRATION_ENABLED, false)&&!readBoolean(env.INVITE_ONLY,false),
      invitationRequestEnabled:readBoolean(env.INVITE_ONLY,false),
      accountRecoveryEnabled: accountMailEnabled(env),
      sharedLiveEnabled:env.SHARED_LIVE_ENABLED==='true',
      privacyUrl: String(env.PRIVACY_URL || '')
    });
  }

  if (request.method === 'GET' && path === '/v1/live-status') {
    return getPublicLiveStatus(request, env);
  }

  if(request.method==='POST' && path==='/v1/auth/request-reset')return requestPasswordReset(request,env,ctx);
  if(request.method==='POST' && path==='/v1/auth/reset-password')return consumeAccountAction(request,env,'reset');
  if(request.method==='POST' && path==='/v1/auth/verify-email')return consumeAccountAction(request,env,'email');

  if (request.method === 'POST' && path === '/v1/auth/register') {
    return register(request, env);
  }
  if (request.method === 'POST' && path === '/v1/auth/login') {
    return login(request, env);
  }
  if (request.method === 'POST' && path === '/v1/auth/logout') {
    return logout(request, env);
  }
  if (request.method === 'GET' && path === '/v1/me') {
    const user = await requireUser(request, env);
    return json({ user: publicUser(user) });
  }
  if (request.method === 'GET' && path === '/v1/account/export') {
    const user = await requireUser(request, env);
    return exportAccountData(env, user);
  }
  if (request.method === 'PUT' && path === '/v1/account/email') {
    const user = await requireUser(request, env);
    return updateAccountEmail(request, env, user);
  }
  if (request.method === 'DELETE' && path === '/v1/account') {
    const user = await requireUser(request, env);
    return deleteAccount(request, env, user);
  }

  const graphicOwner=path.match(/^\/v1\/variants\/([^/]+)\/live$/);
  if(graphicOwner&&['GET','POST'].includes(request.method)){
    const user=await requireUser(request,env),variant=await getOwnedVariant(env,user.id,decodeURIComponent(graphicOwner[1]));
    const input=request.method==='POST'?await readJson(request,8192):{};
    const hub=env.DOCK_HUBS.get(env.DOCK_HUBS.idFromName('design:'+variant.id));
    const result=await hub.fetch('https://dock-hub/graphics/'+(request.method==='POST'?'command':'state'),{method:'POST',body:JSON.stringify({...input,kind:variant.overlay_kind,config:JSON.parse(variant.config_json)})});
    const text=await result.text();if(request.method==='POST'&&result.ok)await broadcastVariantDocks(env,variant.id,{type:'graphic.state',variantId:variant.id,state:JSON.parse(text).state});
    return new Response(text,{status:result.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
  const graphicPublic=path.match(/^\/v1\/public\/graphics\/([^/]+)\/([^/]+)(\/events)?$/);
  if(graphicPublic&&((!graphicPublic[3]&&request.method==='GET')||(graphicPublic[3]&&request.method==='POST'))){
    const dock=await getPublicDockRow(env,decodeURIComponent(graphicPublic[1]));if(!dock)throw httpError(404,'Source unavailable');
    const id=decodeURIComponent(graphicPublic[2]);
    const variant=dock.directVariant?.id===id?dock.directVariant:await env.DB.prepare('SELECT v.* FROM dock_items i JOIN overlay_variants v ON v.id=i.overlay_variant_id WHERE i.dock_id=? AND v.id=?').bind(dock.id,id).first();
    if(!variant)throw httpError(404,'Graphic is not part of this source');
    const input=graphicPublic[3]?await readJson(request,60000):{},hub=env.DOCK_HUBS.get(env.DOCK_HUBS.idFromName('design:'+id));
    const result=await hub.fetch('https://dock-hub/graphics/'+(graphicPublic[3]?'events':'state'),{method:'POST',body:JSON.stringify({events:input.events,epoch:input.epoch,kind:variant.overlay_kind,config:JSON.parse(variant.config_json)})});
    return new Response(await result.text(),{status:result.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
  if (path === '/v1/variants') {
    const user = await requireUser(request, env);
    if (request.method === 'GET') return listVariants(env, user);
    if (request.method === 'POST') return createVariant(request, env, user);
  }

  const archiveMatch=path.match(/^\/v1\/variants\/([^/]+)\/archive$/);
  if(archiveMatch&&request.method==='POST'){
    const user=await requireUser(request,env);const variant=await getOwnedVariant(env,user.id,decodeURIComponent(archiveMatch[1]));const input=await readJson(request,4096);
    await env.DB.prepare('INSERT INTO design_preferences(variant_id,archived) VALUES (?,?) ON CONFLICT(variant_id) DO UPDATE SET archived=excluded.archived').bind(variant.id,input.archived?1:0).run();
    return json({ok:true,archived:Boolean(input.archived)});
  }
  const rotateMatch=path.match(/^\/v1\/variants\/([^/]+)\/rotate-link$/);
  if(rotateMatch&&request.method==='POST'){
    const user=await requireUser(request,env),variant=await getOwnedVariant(env,user.id,decodeURIComponent(rotateMatch[1]));const input=await readJson(request,4096);
    const auth=await getAccountAuthRow(env,user.id);if(!await verifyPassword(String(input.password||''),auth.password_salt,auth.password_hash,auth.password_iterations))throw httpError(401,'Password is incorrect');
    const publicToken=randomToken(24);
    const previousLink=await env.DB.prepare('SELECT public_token FROM variant_links WHERE overlay_variant_id=?').bind(variant.id).first();
    await env.DB.prepare('INSERT INTO variant_links(overlay_variant_id,public_token) VALUES (?,?) ON CONFLICT(overlay_variant_id) DO UPDATE SET public_token=excluded.public_token').bind(variant.id,publicToken).run();
    await revokeCreatorSource(env,user.id,previousLink?.public_token);
    await broadcastVariantDocks(env,variant.id,{type:'variant.updated',variantId:variant.id,revision:variant.revision});
    return json({publicToken,...defaultDockSize(variant.overlay_kind,JSON.parse(variant.config_json))});
  }

  let directMatch = path.match(/^\/v1\/variants\/([^/]+)\/direct-link$/);
  if (directMatch && request.method === 'POST') {
    const user = await requireUser(request, env);
    const variant = await getOwnedVariant(env, user.id, decodeURIComponent(directMatch[1]));
    await env.DB.prepare('INSERT INTO variant_links (overlay_variant_id, public_token) VALUES (?, ?) ON CONFLICT(overlay_variant_id) DO NOTHING')
      .bind(variant.id, randomToken(24)).run();
    const link = await env.DB.prepare('SELECT public_token FROM variant_links WHERE overlay_variant_id = ?').bind(variant.id).first();
    return json({ publicToken: link.public_token, ...defaultDockSize(variant.overlay_kind, JSON.parse(variant.config_json)) });
  }

  let match = path.match(/^\/v1\/variants\/([^/]+)$/);
  if (match) {
    const user = await requireUser(request, env);
    const id = decodeURIComponent(match[1]);
    if (request.method === 'PUT') return updateVariant(request, env, user, id);
    if (request.method === 'DELETE') return deleteVariant(env, user, id);
  }

  match = path.match(/^\/v1\/variants\/([^/]+)\/revisions$/);
  if (match && request.method === 'GET') {
    const user = await requireUser(request, env);
    return listVariantRevisions(env, user, decodeURIComponent(match[1]));
  }

  match = path.match(/^\/v1\/variants\/([^/]+)\/revisions\/(\d+)$/);
  if (match && request.method === 'GET') {
    const user = await requireUser(request, env);
    const id = decodeURIComponent(match[1]);
    await getOwnedVariant(env, user.id, id);
    const row = await env.DB.prepare('SELECT config_json, created_at FROM overlay_revisions WHERE overlay_variant_id = ? AND revision = ?').bind(id, Number(match[2])).first();
    if (!row) throw httpError(404, 'Revision not found');
    return json({ revision: Number(match[2]), createdAt: row.created_at, config: JSON.parse(row.config_json) });
  }

  match = path.match(/^\/v1\/variants\/([^/]+)\/revisions\/(\d+)\/restore$/);
  if (match && request.method === 'POST') {
    const user = await requireUser(request, env);
    const input=request.body?await readJson(request,4096):{};
    return restoreVariantRevision(env, user, decodeURIComponent(match[1]), Number(match[2]),input.expectedRevision);
  }

  if (path === '/v1/docks') {
    const user = await requireUser(request, env);
    if (request.method === 'GET') return listDocks(env, user);
    if (request.method === 'POST') return createDock(request, env, user);
  }

  match = path.match(/^\/v1\/docks\/([^/]+)$/);
  if (match) {
    const user = await requireUser(request, env);
    const id = decodeURIComponent(match[1]);
    if (request.method === 'PUT') return updateDock(request, env, user, id);
    if (request.method === 'DELETE') return deleteDock(env, user, id);
  }

  match = path.match(/^\/v1\/docks\/([^/]+)\/layout$/);
  if (match && request.method === 'PUT') {
    const user = await requireUser(request, env);
    return restoreDockLayout(request, env, user, decodeURIComponent(match[1]));
  }

  match = path.match(/^\/v1\/docks\/([^/]+)\/rotate-token$/);
  if (match && request.method === 'POST') {
    const user = await requireUser(request, env);
    return rotateDockToken(env, user, decodeURIComponent(match[1]));
  }

  match = path.match(/^\/v1\/docks\/([^/]+)\/items$/);
  if (match && request.method === 'POST') {
    const user = await requireUser(request, env);
    return createDockItem(request, env, user, decodeURIComponent(match[1]));
  }

  match = path.match(/^\/v1\/docks\/([^/]+)\/items\/([^/]+)$/);
  if (match) {
    const user = await requireUser(request, env);
    const dockId = decodeURIComponent(match[1]);
    const itemId = decodeURIComponent(match[2]);
    if (request.method === 'PUT') return updateDockItem(request, env, user, dockId, itemId);
    if (request.method === 'DELETE') return deleteDockItem(env, user, dockId, itemId);
  }

  match = path.match(/^\/v1\/public\/docks\/([^/]+)$/);
  if (match && request.method === 'GET') {
    return getPublicDock(env, decodeURIComponent(match[1]));
  }

  match = path.match(/^\/v1\/public\/docks\/([^/]+)\/live$/);
  if (match && request.method === 'GET') {
    return connectDockLive(request, env, decodeURIComponent(match[1]));
  }

  return json({ error: 'Not found' }, 404);
}

async function routeWebsiteRequest(request, env, url) {
  if (!env.ASSETS || !['GET', 'HEAD'].includes(request.method)) return null;

  if (url.hostname.toLowerCase() === 'www.kinggumption.com') {
    const canonicalUrl = new URL(url);
    canonicalUrl.hostname = 'kinggumption.com';
    return Response.redirect(canonicalUrl, 308);
  }

  const path = url.pathname;
  if(['/admin','/admin/'].includes(path))return fetchAsset(request,env,url,'/Widget/public/index-admin.html');
  if(['/request-invite','/request-invite/','/join','/join/'].includes(path))return fetchAsset(request,env,url,'/Widget/public/index-invitation.html');
  if(['/help/email','/help/email/'].includes(path))return fetchAsset(request,env,url,'/Widget/public/email-operations.html');
  if (path === '/studio') return redirectPath(url, '/studio/');
  if (path === '/studio/outputs') return redirectPath(url, '/studio/outputs/');
  if(path==='/help')return redirectPath(url,'/help/');
  if(path==='/help/')return fetchAsset(request,env,url,'/help.html');
  if (path === '/privacy') return redirectPath(url, '/privacy/');

  if(['/help/graphics','/help/graphics/'].includes(url.pathname))return fetchAsset(request,env,url,'/Widget/public/graphics-guide.html');
  if (path === '/studio/') {
    return fetchAsset(request, env, url, '/Widget/public/index-rewards-config.html');
  }
  if (path === '/studio/outputs/') {
    return fetchAsset(request, env, url, '/Widget/public/index-obs-dock.html');
  }
  if (path.startsWith('/studio/outputs/')) {
    return fetchAsset(request, env, url, `/Widget/public/${path.slice('/studio/outputs/'.length)}`);
  }
  if (path.startsWith('/studio/')) {
    return fetchAsset(request, env, url, `/Widget/public/${path.slice('/studio/'.length)}`);
  }
  if (path === '/privacy/' || path === '/privacy.html') {
    const response = await fetchAsset(request, env, url, '/privacy.html');
    const email = String(env.PUBLIC_PRIVACY_EMAIL || '').trim();
    if (!response.ok || !/^[^\s@<>?&#]+@[^\s@<>?&#]+\.[^\s@<>?&#]+$/.test(email)) return response;
    return new HTMLRewriter().on('#privacy-contact', {
      element(link) {
        link.setAttribute('href', 'mailto:' + email);
        link.setInnerContent(email);
      }
    }).transform(response);
  }

  const widgetMatch = path.match(/^\/widget\/([^/]+)(\/config\.js)?\/?$/);
  if (widgetMatch) {
    const token = decodeURIComponent(widgetMatch[1]);
    const dock = await getPublicDockRow(env, token);
    const variant = dock?.directVariant;
    if (!variant) return widgetMatch[2]?new Response('/* Widget unavailable */',{status:404,headers:{'Content-Type':'text/javascript'}}):friendlyNotFound(request,env,url);
    if (widgetMatch[2]) {
      return new Response(
        'window.directWidgetConfig=JSON.parse(' + JSON.stringify(variant.config_json) + ');window.graphicContext='+JSON.stringify({kind:variant.overlay_kind,token,design:variant.id})+';window.creatorLiveShared='+(env.SHARED_LIVE_ENABLED==='true')+';window.rewardOverlayConfig=window.directWidgetConfig;window.directWidgetRevision=' + Number(variant.revision) + ';',
        { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' } }
      );
    }
    const pages = { carousel: 'index-rewards.html', rows: 'index-rewards-rows.html', 'side-gifts': 'index-side-gifts.html', goal: 'index-thin.html', 'top-likers': 'index-top-likers.html' };
    const asset = await fetchAsset(request, env, url, '/Widget/public/' + (graphicSize(variant.overlay_kind,JSON.parse(variant.config_json))?'index-graphic.html':pages[variant.overlay_kind]));
    if (!asset.ok) return asset;
    const html = (await asset.text())
      .replace('<head>', '<head><base href="/Widget/public/">'+(graphicSize(variant.overlay_kind,JSON.parse(variant.config_json))?'<script src="/widget/'+encodeURIComponent(token)+'/config.js"></script>':''))
      .replace(/<script src="\.\/rewards-config\.js[^"]*"><\/script>/, '<script src="/widget/' + encodeURIComponent(token) + '/config.js"></script>')
      .replace(/(<script src="\/widget\/[^\"]+\/config\.js"><\/script>)/,'$1<script src="/Widget/public/creator-live-client.js?v=20261120-backup"></script>')
      .replace('</body>', '<script src="/Widget/public/overlay-cloud-config.js"></script><script src="/Widget/public/overlay-cloud.js?v=20261117-medium1"></script><script src="/Widget/public/direct-widget.js"></script></body>');
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  if (path.startsWith('/output/')) {
    const outputPart = path.slice('/output/'.length);
    if (!outputPart) return friendlyNotFound(request,env,url);
    if (/\.[a-z0-9]{1,8}$/i.test(outputPart)) {
      return fetchAsset(request, env, url, `/Widget/public/${outputPart}`);
    }
    const output = await getPublicDockRow(env, decodeURIComponent(outputPart));
    if(!output)return friendlyNotFound(request,env,url);
    if (output?.directVariant) return redirectPath(url, '/widget/' + outputPart);
    return fetchAsset(request, env, url, '/Widget/public/index-dock.html');
  }

  if (path === '/api' || path.startsWith('/api/') || path === '/v1' || path.startsWith('/v1/')) return null;
  const response=await env.ASSETS.fetch(request);
  return response.status===404?friendlyNotFound(request,env,url):response;
}

async function friendlyNotFound(request,env,url){const asset=await fetchAsset(request,env,url,'/not-found.html');return new Response(asset.body,{status:404,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});}

function redirectPath(url, pathname) {
  const target = new URL(url);
  target.pathname = pathname;
  return Response.redirect(target, 308);
}

async function fetchAsset(request, env, url, pathname) {
  const assetUrl = new URL(url);
  assetUrl.pathname = pathname;
  const response = await env.ASSETS.fetch(new Request(assetUrl, request));
  if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.has('Location')) {
    const target = new URL(response.headers.get('Location'), assetUrl);
    return env.ASSETS.fetch(new Request(target, request));
  }
  return response;
}

async function getPublicLiveStatus(request, env) {
  const cacheKey = liveStatusCacheKey(request);
  const statusCache = globalThis.caches?.default;
  const cached = statusCache ? await statusCache.match(cacheKey) : null;
  if (cached) return cached;

  const [tiktokAutomatic, twitchAutomatic, youtubeAutomatic] = await Promise.all([
    getTikTokLiveStatus(env),
    getTwitchLiveStatus(env),
    getYouTubeLiveStatus(env)
  ]);
  const automatic = { tiktok: tiktokAutomatic, twitch: twitchAutomatic, youtube: youtubeAutomatic };
  const urls = {
    tiktok: String(env.TIKTOK_LIVE_URL || 'https://www.tiktok.com/@kinggumption/live'),
    twitch: String(env.TWITCH_LIVE_URL || 'https://www.twitch.tv/kinggumption'),
    youtube: String(env.YOUTUBE_LIVE_URL || 'https://www.youtube.com/@KingGumption/live')
  };
  const labels = { tiktok: 'TikTok', twitch: 'Twitch', youtube: 'YouTube' };
  const platforms = livePlatformNames.map(platform => {
    return {
      platform,
      label: labels[platform],
      isLive: automatic[platform] === true,
      url: urls[platform],
      source: 'automatic'
    };
  });
  const response = json({
    isLive: platforms.some(platform => platform.isLive),
    platforms,
    checkedAt: new Date().toISOString()
  }, 200, { 'Cache-Control': 'public, max-age=30, s-maxage=90' });
  if (statusCache) await statusCache.put(cacheKey, response.clone());
  return response;
}

function liveStatusCacheKey(request) {
  const url = new URL(request.url);
  return new Request(`${url.origin}/v1/live-status`, { method: 'GET' });
}

async function getTwitchLiveStatus(env) {
  const clientId = String(env.TWITCH_CLIENT_ID || '');
  const clientSecret = String(env.TWITCH_CLIENT_SECRET || '');
  const channel = String(env.TWITCH_CHANNEL_LOGIN || '').trim().toLowerCase();
  if (!clientId || !clientSecret || !channel) return null;

  try {
    const token = await getTwitchAccessToken(clientId, clientSecret);
    const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`, {
      headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Twitch status failed (${response.status})`);
    const payload = await response.json();
    return Array.isArray(payload.data) && payload.data.length > 0;
  } catch (error) {
    console.error('Twitch live status check failed', error);
    return null;
  }
}

async function getTikTokLiveStatus(env) {
  const accessToken = String(env.TIKTOK_ACCESS_TOKEN || '');
  const advertiserId = String(env.TIKTOK_ADVERTISER_ID || '');
  const identityId = String(env.TIKTOK_IDENTITY_ID || '');
  const identityType = String(env.TIKTOK_IDENTITY_TYPE || 'TT_USER');
  if (!accessToken || !advertiserId || !identityId) return null;

  try {
    const url = new URL('https://business-api.tiktok.com/open_api/v1.3/identity/live/get/');
    url.search = new URLSearchParams({
      advertiser_id: advertiserId,
      identity_id: identityId,
      identity_type: identityType,
      cursor: '0'
    });
    const response = await fetch(url.toString(), {
      headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(`TikTok status failed (${response.status})`);
    const payload = await response.json();
    if (Number(payload.code || 0) !== 0) throw new Error(`TikTok status failed (${payload.code})`);
    return (payload.data?.live_list || []).some(live => !live.finish_timestamp);
  } catch (error) {
    console.error('TikTok live status check failed', error);
    return null;
  }
}

async function getTwitchAccessToken(clientId, clientSecret) {
  if (twitchAccessToken?.expiresAt > Date.now() + 60000) return twitchAccessToken.value;
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' });
  const response = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', body });
  if (!response.ok) throw new Error(`Twitch authentication failed (${response.status})`);
  const payload = await response.json();
  twitchAccessToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 3600)) * 1000
  };
  return twitchAccessToken.value;
}

async function getYouTubeLiveStatus(env) {
  const apiKey = String(env.YOUTUBE_API_KEY || '');
  const channelId = String(env.YOUTUBE_CHANNEL_ID || '');
  if (!apiKey || !channelId) return null;

  try {
    const channelUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
    channelUrl.search = new URLSearchParams({ part: 'contentDetails', id: channelId, key: apiKey });
    const channel = await fetchLiveJson(channelUrl);
    const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return false;

    const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    playlistUrl.search = new URLSearchParams({ part: 'contentDetails', playlistId: uploads, maxResults: '10', key: apiKey });
    const playlist = await fetchLiveJson(playlistUrl);
    const videoIds = (playlist.items || []).map(item => item.contentDetails?.videoId).filter(Boolean);
    if (!videoIds.length) return false;

    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    videosUrl.search = new URLSearchParams({ part: 'snippet,liveStreamingDetails', id: videoIds.join(','), key: apiKey });
    const videos = await fetchLiveJson(videosUrl);
    return (videos.items || []).some(video => video.snippet?.liveBroadcastContent === 'live'
      || (video.liveStreamingDetails?.actualStartTime && !video.liveStreamingDetails?.actualEndTime));
  } catch (error) {
    console.error('YouTube live status check failed', error);
    return null;
  }
}

async function fetchLiveJson(url) {
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Platform status request failed (${response.status})`);
  return response.json();
}

async function register(request, env) {
  if (!readBoolean(env.REGISTRATION_ENABLED, false)) {
    throw httpError(403, 'New account registration is not open yet');
  }
  const input = await readJson(request);
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');
  validateCredentials(email, password);
  validateNewPassword(password);
  const invited=readBoolean(env.INVITE_ONLY,false)?await invitationFor(env,String(input.inviteToken||''),email):null;
  if(readBoolean(env.INVITE_ONLY,false)&&!invited)throw httpError(403,'An approved invitation is required to create an account.');
  await enforceAuthRateLimit(request, env, 'register', email);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (existing) {
    await derivePasswordHash(password, randomToken(18));
    return json({
      created: false,
      message: 'If this address is available, the account has been created. Try signing in.'
    }, 202);
  }

  const now = new Date().toISOString();
  const salt = randomToken(18);
  const passwordHash = await derivePasswordHash(password, salt);
  const user = { id: crypto.randomUUID(), email, created_at: now };

  const inviteClaim=crypto.randomUUID();
  try{await env.DB.batch([
    ...(invited?[env.DB.prepare('UPDATE invitations SET claim=? WHERE token_hash=? AND used_at IS NULL AND claim IS NULL AND expires_at>?').bind(inviteClaim,invited.token_hash,now)]:[]),
    env.DB.prepare(`
      INSERT INTO users (id, email, password_salt, password_hash, password_iterations, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${invited?'EXISTS (SELECT 1 FROM invitations WHERE token_hash=? AND claim=?)':'1=1'}
    `).bind(user.id, email, salt, passwordHash, passwordIterations, now, now,...(invited?[invited.token_hash,inviteClaim]:[])),
    starterDockStatement(env, user.id, 'Vertical Output', 'vertical', 1080, 1920, now),
    starterDockStatement(env, user.id, 'Horizontal Output', 'horizontal', 1920, 1080, now),
    ...(invited?[env.DB.prepare('UPDATE invitations SET used_at=?,user_id=? WHERE token_hash=? AND claim=?').bind(now,user.id,invited.token_hash,inviteClaim)]:[])
  ]);}catch(error){if(invited)throw httpError(409,'This invitation was used or expired. Try signing in or request a new invitation.');throw error;}
  if(invited)try{await sendStudioMail(env,email,'welcome');}catch{console.warn('Welcome email log unavailable');}

  return json({ user: publicUser(user), session: await createSession(env, user) }, 201);
}

async function login(request, env) {
  const input = await readJson(request);
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');
  validateCredentials(email, password);
  await enforceAuthRateLimit(request, env, 'login', email);
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();

  const validPassword = user
    ? await verifyPassword(password, user.password_salt, user.password_hash, user.password_iterations)
    : await verifyPassword(password, 'AAAAAAAAAAAAAAAAAAAAAAAA', 'invalid-password-hash', passwordIterations);
  if (!user || !validPassword) {
    throw httpError(401, 'Email or password is incorrect');
  }

  const access=await env.DB.prepare('SELECT role,status FROM user_access WHERE user_id=?').bind(user.id).first();if(access?.status==='suspended')throw httpError(403,'Your account is suspended. Contact support.');
  if(access?.role==='admin')user.role='admin';
  await clearAuthRateLimit(request, env, 'login', email);
  if (Number(user.password_iterations || 210000) < passwordIterations) {
    const salt = randomToken(18);
    const passwordHash = await derivePasswordHash(password, salt);
    await env.DB.prepare(`
      UPDATE users SET password_salt = ?, password_hash = ?, password_iterations = ?, updated_at = ? WHERE id = ?
    `).bind(salt, passwordHash, passwordIterations, new Date().toISOString(), user.id).run();
  }

  return json({ user: publicUser(user), session: await createSession(env, user) });
}

async function logout(request, env) {
  const token = getBearerToken(request);
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  }
  return json({ ok: true });
}

async function exportAccountData(env, user) {
  const [variantResult, revisionResult, dockResult, itemResult, creatorResult, soundResult, preferenceResult] = await Promise.all([
    env.DB.prepare(`SELECT id, name, overlay_kind, config_json, revision, created_at, updated_at
      FROM overlay_variants WHERE user_id = ? ORDER BY created_at`).bind(user.id).all(),
    env.DB.prepare(`SELECT r.id, r.overlay_variant_id, r.revision, r.config_json, r.created_at
      FROM overlay_revisions r JOIN overlay_variants v ON v.id = r.overlay_variant_id
      WHERE v.user_id = ? ORDER BY r.overlay_variant_id, r.revision`).bind(user.id).all(),
    env.DB.prepare(`SELECT id, name, width, height, sample_activity, starter_kind, created_at, updated_at
      FROM output_docks WHERE user_id = ? ORDER BY created_at`).bind(user.id).all(),
    env.DB.prepare(`SELECT i.id, i.dock_id, i.overlay_variant_id, i.overlay_kind, i.x, i.y, i.width, i.height,
      i.z_index, i.visible, i.locked, i.created_at, i.updated_at
      FROM dock_items i JOIN output_docks d ON d.id = i.dock_id
      WHERE d.user_id = ? ORDER BY i.dock_id, i.z_index`).bind(user.id).all(),
    env.DB.prepare('SELECT gift_id, metadata_json, source, created_at, updated_at FROM creator_gifts WHERE user_id = ?').bind(user.id).all(),
    env.DB.prepare('SELECT id,name,size_bytes,duration_ms,created_at,deleted_at FROM user_sounds WHERE user_id=? AND ready=1').bind(user.id).all(),
    env.DB.prepare('SELECT p.variant_id,p.archived FROM design_preferences p JOIN overlay_variants v ON v.id=p.variant_id WHERE v.user_id=?').bind(user.id).all()
  ]);
  const exportedAt = new Date().toISOString();
  const tiktok=env.CREATOR_LIVE?await (await creatorHub(env,user.id).fetch('https://creator-live/status')).json():null;
  return json({
    exportVersion: 2,
    sounds:soundResult.results,
    designPreferences:preferenceResult.results,
    exportedAt,
    account: publicUser(user),
    tiktok:tiktok?{username:tiktok.username,enabled:tiktok.enabled}:null,
    creatorGifts: creatorResult.results.map(row => ({id:row.gift_id,...JSON.parse(row.metadata_json),source:row.source,createdAt:row.created_at,updatedAt:row.updated_at})),
    overlayVariants: variantResult.results.map(row => ({ ...serializeVariant(row) })),
    overlayRevisions: revisionResult.results.map(row => ({
      id: row.id,
      overlayVariantId: row.overlay_variant_id,
      revision: Number(row.revision),
      config: JSON.parse(row.config_json),
      createdAt: row.created_at
    })),
    outputs: dockResult.results.map(row => ({
      id: row.id,
      name: row.name,
      width: Number(row.width),
      height: Number(row.height),
      sampleActivity: Boolean(row.sample_activity),
      starterKind: row.starter_kind || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })),
    outputItems: itemResult.results.map(row => ({
      id: row.id,
      outputId: row.dock_id,
      overlayVariantId: row.overlay_variant_id,
      overlayKind: row.overlay_kind,
      x: Number(row.x), y: Number(row.y), width: Number(row.width), height: Number(row.height),
      zIndex: Number(row.z_index), visible: Boolean(row.visible), locked: Boolean(row.locked),
      createdAt: row.created_at, updatedAt: row.updated_at
    }))
  }, 200, {
    'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="king-gumption-data-${exportedAt.slice(0, 10)}.json"`
  });
}

async function updateAccountEmail(request, env, user) {
  const input = await readJson(request);
  const password = String(input.password || '');
  const email = normalizeEmail(input.email);
  validateCredentials(email, password);
  const authUser = await getAccountAuthRow(env, user.id);
  if (!await verifyPassword(password, authUser.password_salt, authUser.password_hash, authUser.password_iterations)) {
    throw httpError(401, 'Password is incorrect');
  }
  if(!accountMailEnabled(env))throw httpError(503,'Verified email changes are not available yet. Contact account support.');
  await enforceAuthRateLimit(request,env,'email-change',user.email);
  if(email===normalizeEmail(user.email))return json({user:publicUser(user)});
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id <> ?').bind(email, user.id).first();
  if (existing) throw httpError(409, 'That email address cannot be used');
  const action=await issueAccountAction(env,authUser,'email',email);
  try{await sendAccountMail(env,email,'Confirm your Studio email address','Confirm the email change you requested. This link expires in 30 minutes. Your sign-in address stays unchanged until you confirm it.',action.link);}
  catch{await env.DB.prepare('DELETE FROM account_action_tokens WHERE token_hash=?').bind(action.hash).run();throw httpError(503,'Email could not be sent. Your account address has not changed.');}
  return json({pending:true,message:'Check your new email address to confirm the change. Your current sign-in details still work.'},202);
}

function accountMailEnabled(env){return mailReady(env);}
async function sendAccountMail(env,to,subject,message,link){const template=subject.startsWith('Reset')?'reset':'email-change';const result=await sendStudioMail(env,to,template,{link});if(result.status!=='sent')throw httpError(503,'Account email delivery unavailable');}

async function issueAccountAction(env,user,purpose,emailAfter=null){
  const token=randomToken(32),hash=await sha256(token),now=new Date().toISOString(),expires=new Date(Date.now()+(purpose==='reset'?20:30)*60000).toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM account_action_tokens WHERE user_id=? AND purpose=?').bind(user.id,purpose),
    env.DB.prepare('INSERT INTO account_action_tokens(token_hash,user_id,purpose,email_before,email_after,credential_hash,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(hash,user.id,purpose,user.email,emailAfter,user.password_hash,expires,now)
  ]);
  // Never build account links from an untrusted Host header or request-supplied return URL.
  return {hash,link:'https://kinggumption.com/studio/#accountAction='+purpose+'&token='+encodeURIComponent(token)};
}

async function requestPasswordReset(request,env,ctx){
  if(!accountMailEnabled(env))throw httpError(503,'Password reset emails are not available yet. Contact account support.');
  const input=await readJson(request,4096),email=normalizeEmail(input.email);
  validateCredentials(email,'validation-only-password');
  await enforceAuthRateLimit(request,env,'request-reset',email);
  const deliver=(async()=>{
    const user=await env.DB.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').bind(email).first();
    if(!user)return;
    const action=await issueAccountAction(env,user,'reset');
    try{await sendAccountMail(env,email,'Reset your Studio password','Use this link to choose a new password. It expires in 20 minutes.',action.link);}
    catch{await env.DB.prepare('DELETE FROM account_action_tokens WHERE token_hash=?').bind(action.hash).run();}
  })().catch(()=>{});
  // Existing and unknown accounts get the same response without waiting on delivery.
  if(ctx?.waitUntil)ctx.waitUntil(deliver);else await deliver;
  return json({message:'If an account uses this address, a reset link will be sent. Check your inbox and spam folder.'},202);
}

async function consumeAccountAction(request,env,purpose){
  const input=await readJson(request,4096),token=String(input.token||'');
  await enforceAuthRateLimit(request,env,'consume-'+purpose,await sha256(token));
  if(!/^[A-Za-z0-9_-]{40,50}$/.test(token))throw httpError(400,'This link is invalid or expired. Request a new one.');
  const hash=await sha256(token),now=new Date().toISOString();
  const row=await env.DB.prepare(`SELECT t.*,u.email,u.password_hash FROM account_action_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.purpose=? AND t.claim IS NULL AND t.expires_at>?`).bind(hash,purpose,now).first();
  if(!row||row.email!==row.email_before||row.password_hash!==row.credential_hash)throw httpError(400,'This link is invalid or expired. Request a new one.');
  const claim=crypto.randomUUID();let statement;
  if(purpose==='reset'){
    const password=String(input.password||'');validateCredentials(row.email,password);validateNewPassword(password);
    const salt=randomToken(18),passwordHash=await derivePasswordHash(password,salt);
    statement=env.DB.prepare(`UPDATE users SET password_salt=?,password_hash=?,password_iterations=?,updated_at=? WHERE id=? AND email=? AND password_hash=? AND EXISTS (SELECT 1 FROM account_action_tokens WHERE token_hash=? AND claim=?)`).bind(salt,passwordHash,passwordIterations,now,row.user_id,row.email_before,row.credential_hash,hash,claim);
  }else{
    const existing=await env.DB.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE AND id<>?').bind(row.email_after,row.user_id).first();if(existing)throw httpError(409,'That email address cannot be used');
    statement=env.DB.prepare(`UPDATE users SET email=?,updated_at=? WHERE id=? AND email=? AND password_hash=? AND EXISTS (SELECT 1 FROM account_action_tokens WHERE token_hash=? AND claim=?)`).bind(row.email_after,now,row.user_id,row.email_before,row.credential_hash,hash,claim);
  }
  const results=await env.DB.batch([
    env.DB.prepare('UPDATE account_action_tokens SET claim=? WHERE token_hash=? AND claim IS NULL AND expires_at>?').bind(claim,hash,now),statement,
    env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM account_action_tokens WHERE token_hash=? AND claim=?)').bind(row.user_id,hash,claim)
  ]);
  if(!results[0].meta.changes||!results[1].meta.changes)throw httpError(400,'This link has already been used or the account changed. Request a new one.');
  await env.DB.prepare('DELETE FROM account_action_tokens WHERE user_id=?').bind(row.user_id).run();
  try{await sendStudioMail(env,purpose==='reset'?row.email:row.email_before,purpose==='reset'?'password-changed':'email-updated');}catch{console.warn('Security notification unavailable');}
  return json({ok:true,message:purpose==='reset'?'Password changed. Sign in with your new password.':'Email confirmed. Sign in with your new email address.'});
}

async function deleteAccount(request, env, user) {
  const input = await readJson(request);
  const password = String(input.password || '');
  if (input.confirmation !== 'DELETE') throw httpError(400, 'Type DELETE to confirm account deletion');
  const authUser = await getAccountAuthRow(env, user.id);
  if (!await verifyPassword(password, authUser.password_salt, authUser.password_hash, authUser.password_iterations)) {
    throw httpError(401, 'Password is incorrect');
  }
  return deleteUserData(env,user);
}

async function deleteUserData(env,user){
  await stopCreatorLive(env,user.id,true);
  await deleteAccountSounds(env,user.id);
  const docks = await env.DB.prepare('SELECT id FROM output_docks WHERE user_id = ?').bind(user.id).all();
  const designs = await env.DB.prepare('SELECT id FROM overlay_variants WHERE user_id = ?').bind(user.id).all();
  if (env.GIFT_IMAGES?.list) {
    let cursor;
    do {
      const page=await env.GIFT_IMAGES.list({prefix:'creator-gifts/'+user.id+'/',limit:1000,...(cursor?{cursor}:{})});
      if(page.objects.length) await env.GIFT_IMAGES.delete(page.objects.map(object=>object.key));
      cursor=page.truncated?page.cursor:undefined;
    } while(cursor);
  }
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
  await Promise.all([...docks.results.map(row => broadcastDock(env, row.id, { type: 'dock.deleted' })), ...designs.results.map(row => broadcastDock(env, 'design:' + row.id, { type: 'dock.deleted' }))]);
  return json({ ok: true, deletedAt: new Date().toISOString() });
}

async function getAccountAuthRow(env, userId) {
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!row) throw httpError(404, 'Account not found');
  return row;
}

async function listVariants(env, user) {
  const result = await env.DB.prepare(`
    SELECT v.*, COALESCE(p.archived,0) AS archived
    FROM overlay_variants v LEFT JOIN design_preferences p ON p.variant_id=v.id WHERE v.user_id = ? ORDER BY v.updated_at DESC
  `).bind(user.id).all();
  return json({ variants: result.results.map(serializeVariant) });
}

async function createVariant(request, env, user) {
  const input = await readJson(request);
  const name = validateName(input.name, 'Variant name');
  const overlayKind = validateOverlayKind(input.overlayKind);
  const configJson = validateConfig(input.config);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO overlay_variants (id, user_id, name, overlay_kind, config_json, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(id, user.id, name, overlayKind, configJson, now, now),
    env.DB.prepare(`
      INSERT INTO overlay_revisions (id, overlay_variant_id, revision, config_json, created_at)
      VALUES (?, ?, 1, ?, ?)
    `).bind(crypto.randomUUID(), id, configJson, now)
  ]);

  const variant = await getOwnedVariant(env, user.id, id);
  return json({ variant: serializeVariant(variant) }, 201);
}

async function updateVariant(request, env, user, id) {
  const current = await getOwnedVariant(env, user.id, id);
  const input = await readJson(request);
  if (input.overlayKind !== undefined && validateOverlayKind(input.overlayKind) !== current.overlay_kind) {
    throw httpError(409, 'A variant cannot change overlay type');
  }
  const name = input.name === undefined ? current.name : validateName(input.name, 'Variant name');
  const configJson = input.config === undefined ? current.config_json : validateConfig(input.config);
  const expected=input.expectedRevision===undefined?Number(current.revision):Number(input.expectedRevision);
  if(expected!==Number(current.revision))throw httpError(409,'A newer revision was saved elsewhere. Your local draft has been kept.');
  const revision = expected + 1;
  const now = new Date(Math.max(Date.now(),Date.parse(current.updated_at)+1)).toISOString();
  const results=await env.DB.batch([
    env.DB.prepare('UPDATE overlay_variants SET name=?,config_json=?,revision=?,updated_at=? WHERE id=? AND user_id=? AND revision=?').bind(name,configJson,revision,now,id,user.id,expected),
    env.DB.prepare('INSERT INTO overlay_revisions(id,overlay_variant_id,revision,config_json,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),id,revision,configJson,now)
  ]);
  if(!results[0].meta.changes)throw httpError(409,'A newer revision was saved elsewhere. Your local draft has been kept.');

  await broadcastVariantDocks(env, id, { type: 'variant.updated', variantId: id, revision });
  return json({ variant: serializeVariant(await getOwnedVariant(env, user.id, id)) });
}

async function deleteVariant(env, user, id) {
  await getOwnedVariant(env, user.id, id);
  const dock = await env.DB.prepare('SELECT dock_id FROM dock_items WHERE overlay_variant_id = ? LIMIT 1').bind(id).first();
  if (dock) throw httpError(409, 'Remove this design from your canvases first');
  const legacyDock = await env.DB.prepare('SELECT id FROM docks WHERE overlay_variant_id = ? LIMIT 1').bind(id).first();
  if (legacyDock) throw httpError(409, 'This variant is linked to an obsolete output; apply migration 0004_remove_legacy_docks.sql first');
  const previousLink=await env.DB.prepare('SELECT public_token FROM variant_links WHERE overlay_variant_id=?').bind(id).first();
  await env.DB.prepare('DELETE FROM overlay_variants WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  await revokeCreatorSource(env,user.id,previousLink?.public_token);
  await broadcastDock(env, 'design:' + id, { type: 'dock.deleted' });
  return json({ ok: true });
}

async function listVariantRevisions(env, user, id) {
  const current=await getOwnedVariant(env, user.id, id);
  const result = await env.DB.prepare(`
    SELECT revision, created_at FROM overlay_revisions
    WHERE overlay_variant_id = ? ORDER BY revision DESC LIMIT 100
  `).bind(id).all();
  return json({ currentRevision:Number(current.revision),revisions: result.results.map(row => ({ revision: row.revision, createdAt: row.created_at })) });
}

async function restoreVariantRevision(env, user, id, requestedRevision,expectedRevision) {
  const current = await getOwnedVariant(env, user.id, id);
  const saved = await env.DB.prepare(`
    SELECT config_json FROM overlay_revisions WHERE overlay_variant_id = ? AND revision = ?
  `).bind(id, requestedRevision).first();
  if (!saved) throw httpError(404, 'Revision not found');

  const expected=expectedRevision===undefined?Number(current.revision):Number(expectedRevision);
  if(expected!==Number(current.revision))throw httpError(409,'This design changed while history was open. Close history and review the newest version first.');
  const revision=expected+1,now=new Date(Math.max(Date.now(),Date.parse(current.updated_at)+1)).toISOString();
  const results=await env.DB.batch([
    env.DB.prepare('UPDATE overlay_variants SET config_json=?,revision=?,updated_at=? WHERE id=? AND user_id=? AND revision=?').bind(saved.config_json,revision,now,id,user.id,expected),
    env.DB.prepare('INSERT INTO overlay_revisions(id,overlay_variant_id,revision,config_json,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),id,revision,saved.config_json,now)
  ]);
  if(!results[0].meta.changes)throw httpError(409,'This design changed while restoring. Review the newest version first.');

  await broadcastVariantDocks(env, id, { type: 'variant.updated', variantId: id, revision });
  return json({ variant: serializeVariant(await getOwnedVariant(env, user.id, id)) });
}

async function listDocks(env, user) {
  const [dockResult, itemResult] = await Promise.all([
    env.DB.prepare(`SELECT * FROM output_docks WHERE user_id = ? ORDER BY starter_kind IS NULL, created_at`).bind(user.id).all(),
    env.DB.prepare(`
      SELECT i.*, v.name AS variant_name, v.revision AS variant_revision
      FROM dock_items i
      JOIN output_docks d ON d.id = i.dock_id
      JOIN overlay_variants v ON v.id = i.overlay_variant_id
      WHERE d.user_id = ? ORDER BY i.dock_id, i.z_index, i.created_at
    `).bind(user.id).all()
  ]);
  const itemsByDock = groupDockItems(itemResult.results);
  return json({ docks: dockResult.results.map(row => serializeDock(row, itemsByDock.get(row.id) || [])) });
}

async function createDock(request, env, user) {
  const input = await readJson(request);
  const dock = normalizeDockInput(input);
  const id = crypto.randomUUID();
  const token = randomToken(24);
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO output_docks (id, user_id, name, public_token, width, height, sample_activity, starter_kind, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).bind(id, user.id, dock.name, token, dock.width, dock.height, dock.sampleActivity ? 1 : 0, now, now).run();

  if (input.variantId) {
    await insertDockItem(env, user, await getOwnedDock(env, user.id, id), input);
  }

  return json({ dock: await getSerializedOwnedDock(env, user.id, id) }, 201);
}

async function updateDock(request, env, user, id) {
  const current = await getOwnedDock(env, user.id, id);
  const input = await readJson(request);
  const merged = normalizeDockInput({
    name: input.name ?? current.name,
    width: input.width ?? current.width,
    height: input.height ?? current.height,
    sampleActivity: input.sampleActivity ?? Boolean(current.sample_activity)
  });
  const now = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE output_docks SET name = ?, width = ?, height = ?, sample_activity = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(merged.name, merged.width, merged.height, merged.sampleActivity ? 1 : 0, now, id, user.id).run();

  const itemResult = await env.DB.prepare('SELECT * FROM dock_items WHERE dock_id = ?').bind(id).all();
  if (itemResult.results.length) {
    const resizedDock = { ...current, width: merged.width, height: merged.height };
    await env.DB.batch(itemResult.results.map(item => {
      const normalized = normalizeDockItemInput(item, resizedDock, item);
      return env.DB.prepare(`UPDATE dock_items SET x = ?, y = ?, width = ?, height = ?, updated_at = ? WHERE id = ? AND dock_id = ?`)
        .bind(normalized.x, normalized.y, normalized.width, normalized.height, now, item.id, id);
    }));
  }

  await broadcastDock(env, id, { type: 'dock.updated', dockId: id });
  return json({ dock: await getSerializedOwnedDock(env, user.id, id) });
}

async function deleteDock(env, user, id) {
  const previous=await getOwnedDock(env, user.id, id);
  await broadcastDock(env, id, { type: 'dock.deleted', dockId: id });
  await env.DB.prepare('DELETE FROM output_docks WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  await revokeCreatorSource(env,user.id,previous.public_token);
  return json({ ok: true });
}

async function rotateDockToken(env, user, id) {
  const previous=await getOwnedDock(env, user.id, id);
  const token = randomToken(24);
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE output_docks SET public_token = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(token, now, id, user.id).run();
  await revokeCreatorSource(env,user.id,previous.public_token);
  await broadcastDock(env, id, { type: 'dock.token.rotated', dockId: id });
  return json({ dock: await getSerializedOwnedDock(env, user.id, id) });
}

function layoutSignature(items) {
  return JSON.stringify(items.map(item=>[item.id,item.variantId,item.overlayKind,item.x,item.y,item.width,item.height,item.zIndex,item.visible,item.locked]).sort((a,b)=>a[0].localeCompare(b[0])));
}

async function restoreDockLayout(request,env,user,id) {
  const dock=await getOwnedDock(env,user.id,id);
  const current=await getSerializedOwnedDock(env,user.id,id);
  const input=await readJson(request);
  if(!Array.isArray(input.items)||input.items.length>200||!Array.isArray(input.expectedItems))throw httpError(400,'Invalid canvas history');
  if(layoutSignature(current.items)!==layoutSignature(input.expectedItems)||current.width!==input.expectedWidth||current.height!==input.expectedHeight)throw httpError(409,'This canvas changed elsewhere. Refresh before undoing.');
  const geometry=normalizeDockInput({name:current.name,width:input.width,height:input.height});
  const targetDock={...dock,width:geometry.width,height:geometry.height};
  const now=new Date(Math.max(Date.now(),Date.parse(dock.updated_at)+1)).toISOString();
  const ids=new Set(),items=[];
  for(const item of input.items){
    if(!/^[a-f0-9-]{32,36}$/.test(item.id)||ids.has(item.id))throw httpError(400,'Invalid layer identity');ids.add(item.id);
    const other=await env.DB.prepare('SELECT dock_id FROM dock_items WHERE id=?').bind(item.id).first();
    if(other&&other.dock_id!==id)throw httpError(409,'Layer belongs to another output');
    const variant=await getOwnedVariant(env,user.id,item.variantId);
    const value=normalizeDockItemInput(item,targetDock,{},JSON.parse(variant.config_json));ensureVariantKind(variant,value.overlayKind);
    items.push({id:item.id,variantId:variant.id,...value});
  }
  const guard='EXISTS (SELECT 1 FROM output_docks WHERE id=? AND updated_at=?)';
  const statements=[env.DB.prepare('UPDATE output_docks SET width=?,height=?,updated_at=? WHERE id=? AND user_id=? AND updated_at=?').bind(geometry.width,geometry.height,now,id,user.id,dock.updated_at),
    env.DB.prepare('DELETE FROM dock_items WHERE dock_id=? AND '+guard).bind(id,id,now)];
  for(const item of items)statements.push(env.DB.prepare(`INSERT INTO dock_items(id,dock_id,overlay_variant_id,overlay_kind,x,y,width,height,z_index,visible,locked,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE `+guard).bind(item.id,id,item.variantId,item.overlayKind,item.x,item.y,item.width,item.height,item.zIndex,item.visible?1:0,item.locked?1:0,now,now,id,now));
  const results=await env.DB.batch(statements);
  if(!results[0].meta.changes)throw httpError(409,'Canvas changed while restoring. Refresh before undoing.');
  await broadcastDock(env,id,{type:'dock.updated',dockId:id});
  return json({dock:await getSerializedOwnedDock(env,user.id,id)});
}

async function createDockItem(request, env, user, dockId) {
  const dock = await getOwnedDock(env, user.id, dockId);
  const input = await readJson(request);
  const item = await insertDockItem(env, user, dock, input);
  await broadcastDock(env, dockId, { type: 'dock.item.created', dockId, itemId: item.id });
  return json({ item }, 201);
}

async function insertDockItem(env, user, dock, input) {
  const variant = await getOwnedVariant(env, user.id, String(input.variantId || ''));
  const maxRow = await env.DB.prepare('SELECT MAX(z_index) AS max_z FROM dock_items WHERE dock_id = ?').bind(dock.id).first();
  const normalized = normalizeDockItemInput(
    { ...input, zIndex: input.zIndex ?? Number(maxRow?.max_z ?? -1) + 1 },
    dock,
    {},
    JSON.parse(variant.config_json)
  );
  ensureVariantKind(variant, normalized.overlayKind);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO dock_items
        (id, dock_id, overlay_variant_id, overlay_kind, x, y, width, height, z_index, visible, locked, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, dock.id, variant.id, normalized.overlayKind, normalized.x, normalized.y, normalized.width, normalized.height,
      normalized.zIndex, normalized.visible ? 1 : 0, normalized.locked ? 1 : 0, now, now),
    env.DB.prepare('UPDATE output_docks SET updated_at = ? WHERE id = ?').bind(now, dock.id)
  ]);
  return serializeDockItem(await getOwnedDockItem(env, user.id, dock.id, id));
}

async function updateDockItem(request, env, user, dockId, itemId) {
  const dock = await getOwnedDock(env, user.id, dockId);
  const current = await getOwnedDockItem(env, user.id, dockId, itemId);
  const input = await readJson(request);
  const variantId = String(input.variantId || current.overlay_variant_id);
  const variant = await getOwnedVariant(env, user.id, variantId);
  const normalized = normalizeDockItemInput(input, dock, current, JSON.parse(variant.config_json));
  ensureVariantKind(variant, normalized.overlayKind);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE dock_items SET overlay_variant_id = ?, overlay_kind = ?, x = ?, y = ?, width = ?, height = ?,
        z_index = ?, visible = ?, locked = ?, updated_at = ? WHERE id = ? AND dock_id = ?
    `).bind(variantId, normalized.overlayKind, normalized.x, normalized.y, normalized.width, normalized.height,
      normalized.zIndex, normalized.visible ? 1 : 0, normalized.locked ? 1 : 0, now, itemId, dockId),
    env.DB.prepare('UPDATE output_docks SET updated_at = ? WHERE id = ?').bind(now, dockId)
  ]);
  await broadcastDock(env, dockId, { type: 'dock.item.updated', dockId, itemId });
  return json({ item: serializeDockItem(await getOwnedDockItem(env, user.id, dockId, itemId)) });
}

async function deleteDockItem(env, user, dockId, itemId) {
  await getOwnedDockItem(env, user.id, dockId, itemId);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM dock_items WHERE id = ? AND dock_id = ?').bind(itemId, dockId),
    env.DB.prepare('UPDATE output_docks SET updated_at = ? WHERE id = ?').bind(now, dockId)
  ]);
  await broadcastDock(env, dockId, { type: 'dock.item.deleted', dockId, itemId });
  return json({ ok: true });
}

async function getPublicDock(env, token) {
  const dock = await getPublicDockRow(env, token);
  if (!dock) throw httpError(404, 'Output not found');
  if (dock.directVariant) {
    const variant = dock.directVariant;
    return json(serializePublicDock({...dock,shared_live:env.SHARED_LIVE_ENABLED==='true'}, [{
      id: variant.id, dock_id: dock.id, overlay_variant_id: variant.id,
      overlay_kind: variant.overlay_kind, variant_name: variant.name,
      config_json: variant.config_json, variant_revision: variant.revision,
      x: 0, y: 0, width: dock.width, height: dock.height, z_index: 0, visible: 1,
      locked: 1, updated_at: variant.updated_at, created_at: variant.created_at
    }]), 200, { 'Cache-Control': 'no-store' });
  }
  const itemResult = await env.DB.prepare(`
    SELECT i.*, v.name AS variant_name, v.config_json, v.revision AS variant_revision, v.updated_at AS variant_updated_at
    FROM dock_items i JOIN overlay_variants v ON v.id = i.overlay_variant_id
    WHERE i.dock_id = ? ORDER BY i.z_index, i.created_at
  `).bind(dock.id).all();
  return json(serializePublicDock({...dock,shared_live:env.SHARED_LIVE_ENABLED==='true'}, itemResult.results), 200, {
    'Cache-Control': 'no-store, max-age=0'
  });
}

async function connectDockLive(request, env, token) {
  if (request.headers.get('Upgrade') !== 'websocket') throw httpError(426, 'WebSocket upgrade required');
  const row = await getPublicDockRow(env, token);
  if (!row) throw httpError(404, 'Dock not found');
  const hub = env.DOCK_HUBS.get(env.DOCK_HUBS.idFromName(row.id));
  return hub.fetch(new Request('https://dock-hub/live', { headers: request.headers }));
}

async function getPublicDockRow(env, token) {
  const dock = await env.DB.prepare('SELECT * FROM output_docks WHERE public_token = ?').bind(token).first();
  if (dock) {const access=await env.DB.prepare('SELECT role,status FROM user_access WHERE user_id=?').bind(dock.user_id).first();return access?.status==='suspended'?null:dock;}
  const variant = await env.DB.prepare('SELECT v.* FROM variant_links l JOIN overlay_variants v ON v.id = l.overlay_variant_id WHERE l.public_token = ?').bind(token).first();
  if (!variant) return null;
  const access=await env.DB.prepare('SELECT role,status FROM user_access WHERE user_id=?').bind(variant.user_id).first();if(access?.status==='suspended')return null;
  return { id: 'design:' + variant.id, name: variant.name,
    ...defaultDockSize(variant.overlay_kind, JSON.parse(variant.config_json)),
    updated_at: variant.updated_at, sample_activity: 0, directVariant: variant };

}

async function getOwnedVariant(env, userId, id) {
  const row = await env.DB.prepare('SELECT * FROM overlay_variants WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!row) throw httpError(404, 'Variant not found');
  return row;
}

async function getOwnedDock(env, userId, id) {
  const row = await env.DB.prepare('SELECT * FROM output_docks WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!row) throw httpError(404, 'Output not found');
  return row;
}

async function getOwnedDockItem(env, userId, dockId, itemId) {
  const row = await env.DB.prepare(`
    SELECT i.*, v.name AS variant_name, v.revision AS variant_revision
    FROM dock_items i
    JOIN output_docks d ON d.id = i.dock_id
    JOIN overlay_variants v ON v.id = i.overlay_variant_id
    WHERE i.id = ? AND i.dock_id = ? AND d.user_id = ?
  `).bind(itemId, dockId, userId).first();
  if (!row) throw httpError(404, 'Overlay layer not found');
  return row;
}

async function getSerializedOwnedDock(env, userId, id) {
  const dock = await getOwnedDock(env, userId, id);
  const result = await env.DB.prepare(`
    SELECT i.*, v.name AS variant_name, v.revision AS variant_revision
    FROM dock_items i JOIN overlay_variants v ON v.id = i.overlay_variant_id
    WHERE i.dock_id = ? ORDER BY i.z_index, i.created_at
  `).bind(id).all();
  return serializeDock(dock, result.results);
}

async function broadcastVariantDocks(env, variantId, payload) {
  const result = await env.DB.prepare('SELECT DISTINCT dock_id FROM dock_items WHERE overlay_variant_id = ?').bind(variantId).all();
  await broadcastDock(env, 'design:' + variantId, payload);
  await Promise.all(result.results.map(row => broadcastDock(env, row.dock_id, payload)));
}

async function broadcastDock(env, dockId, payload) {
  const hub = env.DOCK_HUBS.get(env.DOCK_HUBS.idFromName(dockId));
  await hub.fetch('https://dock-hub/broadcast', {
    method: 'POST',
    body: JSON.stringify({ ...payload, sentAt: new Date().toISOString() })
  });
}

async function requireUser(request, env) {
  const token = getBearerToken(request);
  if (!token) throw httpError(401, 'Sign in required');
  const row = await env.DB.prepare(`
    SELECT u.id, u.email, u.created_at,COALESCE(a.role,'member') AS role,COALESCE(a.status,'active') AS status
    FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN user_access a ON a.user_id=u.id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(await sha256(token), new Date().toISOString()).first();
  if (!row||row.status==='suspended') throw httpError(401, 'Session expired');
  return row;
}

async function createSession(env, user) {
  const token = randomToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionDays * 86400000).toISOString();
  await env.DB.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)
  `).bind(await sha256(token), user.id, expiresAt, now.toISOString()).run();
  return { token, expiresAt, user: publicUser(user) };
}

function serializeVariant(row) {
  return {
    id: row.id,
    name: row.name,
    overlayKind: row.overlay_kind,
    archived: Boolean(row.archived),
    config: JSON.parse(row.config_json),
    revision: Number(row.revision),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function serializeDock(row, items = []) {
  return {
    id: row.id,
    name: row.name,
    publicToken: row.public_token,
    width: Number(row.width),
    height: Number(row.height),
    sampleActivity: Boolean(row.sample_activity),
    starterKind: row.starter_kind || null,
    items: items.map(serializeDockItem),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function serializeDockItem(row) {
  return {
    id: row.id,
    dockId: row.dock_id,
    variantId: row.overlay_variant_id,
    variantName: row.variant_name,
    variantRevision: Number(row.variant_revision || 0),
    overlayKind: row.overlay_kind,
    x: Number(row.x),
    y: Number(row.y),
    width: Number(row.width),
    height: Number(row.height),
    zIndex: Number(row.z_index),
    visible: Boolean(row.visible),
    locked: Boolean(row.locked),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function serializePublicDock(row, items) {
  return {
    dock: {
      id: row.id,
      name: row.name,
      width: Number(row.width),
      height: Number(row.height),
      sampleActivity: Boolean(row.sample_activity),
      sharedLive:Boolean(row.shared_live),
      updatedAt: row.updated_at
    },
    items: items.map(item => ({
      ...serializeDockItem(item),
      variant: {
        id: item.overlay_variant_id,
        name: item.variant_name,
        revision: Number(item.variant_revision),
        updatedAt: item.variant_updated_at,
        config: JSON.parse(item.config_json)
      }
    }))
  };
}

function normalizeDockInput(input) {
  return {
    name: validateName(input.name, 'Output name'),
    width: clampInteger(input.width, 160, 7680, 1920),
    height: clampInteger(input.height, 160, 7680, 1080),
    sampleActivity: input.sampleActivity === true || input.sampleActivity === 1
  };
}

function normalizeDockItemInput(input, dock, current = {}, config = {}) {
  const overlayKind = String(input.overlayKind ?? current.overlay_kind ?? 'carousel');
  if (!allowedOverlayKinds.has(overlayKind)) throw httpError(400, 'Unsupported overlay type');
  const natural = defaultDockSize(overlayKind, config);
  const width = clampInteger(input.width ?? current.width, 32, Number(dock.width), Math.min(natural.width, Number(dock.width)));
  const height = clampInteger(input.height ?? current.height, 24, Number(dock.height), Math.min(natural.height, Number(dock.height)));
  const defaultX = Math.max(0, Math.round((Number(dock.width) - width) / 2));
  const defaultY = Math.max(0, Math.round((Number(dock.height) - height) / 2));
  return {
    overlayKind,
    x: clampInteger(input.x ?? current.x, -width, Number(dock.width), defaultX),
    y: clampInteger(input.y ?? current.y, -height, Number(dock.height), defaultY),
    width,
    height,
    zIndex: clampInteger(input.zIndex ?? current.z_index, 0, 1000, 0),
    visible: input.visible === undefined ? current.visible === undefined || Boolean(current.visible) : Boolean(input.visible),
    locked: input.locked === undefined ? Boolean(current.locked) : Boolean(input.locked)
  };
}

function ensureVariantKind(variant, overlayKind) {
  if (variant.overlay_kind !== overlayKind) {
    throw httpError(409, `This variant is for ${variant.overlay_kind}, not ${overlayKind}`);
  }
}

function validateOverlayKind(value) {
  const overlayKind = String(value || '');
  if (!allowedOverlayKinds.has(overlayKind)) throw httpError(400, 'Unsupported overlay type');
  return overlayKind;
}

function groupDockItems(rows) {
  const grouped = new Map();
  rows.forEach(row => {
    if (!grouped.has(row.dock_id)) grouped.set(row.dock_id, []);
    grouped.get(row.dock_id).push(row);
  });
  return grouped;
}

function starterDockStatement(env, userId, name, starterKind, width, height, now) {
  return env.DB.prepare(`
    INSERT INTO output_docks (id, user_id, name, public_token, width, height, starter_kind, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), userId, name, randomToken(24), width, height, starterKind, now, now);
}

function defaultDockSize(kind, config = {}) {
    const graphic=graphicSize(kind,config);if(graphic)return graphic;
    if (kind === 'carousel') return { width: 112, height: 318 };
    if (kind === 'rows') return { width: 1080, height: getRowsNaturalHeight(config.rowsOverlay) };
    if (kind === 'side-gifts') {
      const dimensions = dimensionsFromConfig(config.sideGifts, 1080, 960);
      return { ...dimensions, height: getSideGiftsNaturalHeight(config.sideGifts, dimensions.height) };
    }
    if (kind === 'goal') return dimensionsFromConfig(config.goalBar, 1080, 44);
    if (kind === 'top-likers') return dimensionsFromConfig(config.topLikers, 390, 260);
    return { width: 1080, height: 240 };
  }

  function getRowsNaturalHeight(config) {
    config = config || {};
    const rows = Math.min(8, Math.max(1, Math.floor(Number(config.rows) || 2)));
    const rowHeight = Math.min(160, Math.max(64, Math.floor(Number(config.rowHeight) || 96)));
    const gap = Math.min(32, Math.max(0, Math.floor(Number(config.gap) || 0)));
    return (rows * rowHeight) + ((rows - 1) * gap);
  }

  function getSideGiftsNaturalHeight(config, fallbackHeight = 960) {
    config = config || {};
    if (!Array.isArray(config.gifts)) return fallbackHeight;
    const gifts = config.gifts.filter(gift => gift?.enabled !== false);
    const side = ['left', 'right'].includes(String(config.side).toLowerCase()) ? String(config.side).toLowerCase() : 'both';
    const leftCount = gifts.filter((gift, index) => getSideGiftLayoutSide(gift, index, side) === 'left').length;
    const rightCount = gifts.filter((gift, index) => getSideGiftLayoutSide(gift, index, side) === 'right').length;
    const slotCount = Math.max(leftCount, rightCount, 1);
    const iconSize = Math.max(24, Number(config.iconSize) || 65);
    const labelSize = Math.max(8, Number(config.labelSize) || 10);
    const labelLines = config.labelTwoLines === true ? 2 : 1;
    const labelHeight = config.showLabels === false ? 0 : Math.ceil(labelSize * 1.18 * labelLines);
    const tileExtra = config.tilesEnabled === true ? 18 : 4;
    const gap = Math.max(0, Number(config.gap) || 0);
    const edgePadding = 88;
    return Math.min(7680, (slotCount * (iconSize + labelHeight + tileExtra)) + (Math.max(0, slotCount - 1) * gap) + edgePadding);
  }

  function getSideGiftLayoutSide(gift, index, globalSide) {
    const giftSide = String(gift?.side || '').toLowerCase();
    if ((globalSide === 'left' || globalSide === 'right') && giftSide !== globalSide) return '';
    if (giftSide === 'left' || giftSide === 'right') return giftSide;
    if (globalSide === 'left' || globalSide === 'right') return '';
    const row = Number(gift?.row || 0);
    if (row === 1) return 'left';
    if (row === 2) return 'right';
    return index % 2 === 0 ? 'left' : 'right';
  }

  function dimensionsFromConfig(config, fallbackWidth, fallbackHeight) {
    return {
      width: Math.max(1, Number(config?.width) || fallbackWidth),
      height: Math.max(1, Number(config?.height) || fallbackHeight)
    };
  }


function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw httpError(400, 'Config must be an object');
  const value = JSON.stringify(config);
  if (new TextEncoder().encode(value).byteLength > maxConfigBytes) throw httpError(413, 'Config is too large');
  return value;
}

function validateName(value, label) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  if (!name || name.length > 80) throw httpError(400, `${label} must be between 1 and 80 characters`);
  return name;
}

function validateCredentials(email, password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw httpError(400, 'Enter a valid email address');
  if (password.length < 10 || password.length > 200) throw httpError(400, 'Password must be at least 10 characters');
}

function validateNewPassword(password){if([...password].length<15)throw httpError(400,'New passwords must contain at least 15 characters. A long passphrase works well.');if(/^([\s\S])\1+$/u.test(password)||['passwordpassword','password123456789','123456789012345','qwertyuiopasdfgh'].includes(password.toLowerCase()))throw httpError(400,'Choose a less predictable password or passphrase.');}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function publicUser(user) {
  return { id: user.id, email: user.email, createdAt: user.created_at,...(user.role==='admin'?{role:'admin'}:{}) };
}

function getBearerToken(request) {
  const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

async function readJson(request, maximum = maxConfigBytes) {
  if(Number(request.headers.get('Content-Length'))>maximum) throw httpError(413,'Request is too large');
  const reader=request.body?.getReader();
  const chunks=[];let length=0;
  if(reader) try {
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;
      if(length>maximum) throw httpError(413,'Request is too large');chunks.push(value);}
  } finally {await reader.cancel();}
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try {return JSON.parse(new TextDecoder().decode(bytes));}
  catch {throw httpError(400,'Request body must be valid JSON');}
}

async function derivePasswordHash(password, salt, iterations = passwordIterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: fromBase64Url(salt),
    iterations: Number(iterations || passwordIterations)
  }, key, 256);
  return toBase64Url(new Uint8Array(bits));
}

async function verifyPassword(password, salt, expected, iterations = passwordIterations) {
  const actual = await derivePasswordHash(password, salt, iterations);
  const first = new TextEncoder().encode(actual);
  const second = new TextEncoder().encode(String(expected || ''));
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference |= first[index] ^ second[index];
  return difference === 0;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return toBase64Url(value);
}

function toBase64Url(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

function clampInteger(value, min, max, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function getCorsHeaders(origin, configuredOrigins = '') {
  const allowed = String(configuredOrigins).split(',').map(value => value.trim()).filter(Boolean);
  const allowOrigin = allowed.includes('*') || !origin ? (origin || '*') : allowed.includes(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
}

async function enforceAuthRateLimit(request, env, action, email) {
  const limit = clampInteger(env.AUTH_RATE_LIMIT_MAX, 3, 100, defaultAuthAttemptLimit);
  const windowMinutes = clampInteger(env.AUTH_RATE_LIMIT_WINDOW_MINUTES, 1, 1440, defaultAuthWindowMinutes);
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60000).toISOString();
  const keys = await getAuthRateLimitKeys(request, action, email);

  for (const key of keys) {
    const row = await env.DB.prepare('SELECT attempts, window_started_at FROM auth_rate_limits WHERE key_hash = ?').bind(key).first();
    if (row && row.window_started_at >= windowStart && Number(row.attempts) >= limit) {
      throw httpError(429, 'Too many attempts. Try again later.', { 'Retry-After': String(windowMinutes * 60) });
    }
    if (!row || row.window_started_at < windowStart) {
      await env.DB.prepare(`INSERT INTO auth_rate_limits (key_hash, attempts, window_started_at, updated_at)
        VALUES (?, 1, ?, ?) ON CONFLICT(key_hash) DO UPDATE SET attempts = 1, window_started_at = excluded.window_started_at, updated_at = excluded.updated_at`)
        .bind(key, now.toISOString(), now.toISOString()).run();
    } else {
      await env.DB.prepare('UPDATE auth_rate_limits SET attempts = attempts + 1, updated_at = ? WHERE key_hash = ?')
        .bind(now.toISOString(), key).run();
    }
  }
}

async function clearAuthRateLimit(request, env, action, email) {
  const keys = await getAuthRateLimitKeys(request, action, email);
  await env.DB.batch(keys.map(key => env.DB.prepare('DELETE FROM auth_rate_limits WHERE key_hash = ?').bind(key)));
}

async function getAuthRateLimitKeys(request, action, email) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return Promise.all([
    sha256(`${action}:ip:${ip}`),
    sha256(`${action}:email:${normalizeEmail(email)}`)
  ]);
}

async function cleanupRetainedData(env) {
  await cleanupCreatorImages(env);
  await env.DB.prepare('DELETE FROM account_action_tokens WHERE expires_at<=?').bind(new Date().toISOString()).run();
  const now = new Date();
  const revisionDays = clampInteger(env.REVISION_RETENTION_DAYS, 30, 3650, defaultRevisionRetentionDays);
  const revisionLimit = clampInteger(env.REVISION_LIMIT, 5, 500, defaultRevisionLimit);
  const revisionCutoff = new Date(now.getTime() - revisionDays * 86400000).toISOString();
  const authCutoff = new Date(now.getTime() - 86400000).toISOString();

  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now.toISOString()),
    env.DB.prepare('DELETE FROM invitations WHERE expires_at <= ?').bind(now.toISOString()),
    env.DB.prepare('DELETE FROM mail_log WHERE created_at < ?').bind(new Date(now.getTime()-90*86400000).toISOString()),
    env.DB.prepare('DELETE FROM admin_audit WHERE created_at < ?').bind(new Date(now.getTime()-90*86400000).toISOString()),
    env.DB.prepare("DELETE FROM invite_requests WHERE status<>'pending' AND reviewed_at < ?").bind(new Date(now.getTime()-180*86400000).toISOString()),
    env.DB.prepare('DELETE FROM auth_rate_limits WHERE updated_at < ?').bind(authCutoff),
    env.DB.prepare(`DELETE FROM overlay_revisions
      WHERE created_at < ?
      AND revision < (SELECT MAX(newer.revision) FROM overlay_revisions newer WHERE newer.overlay_variant_id = overlay_revisions.overlay_variant_id)`)
      .bind(revisionCutoff),
    env.DB.prepare(`DELETE FROM overlay_revisions WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY overlay_variant_id ORDER BY revision DESC) AS retained_rank
        FROM overlay_revisions
      ) WHERE retained_rank > ?
    )`).bind(revisionLimit)
  ]);
}

function readBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }
  });
}

function httpError(status, message, headers = {}) {
  const error = new Error(message);
  error.status = status;
  error.headers = headers;
  return error;
}

async function stopUserSources(env,userId){await stopCreatorLive(env,userId);const sources=await env.DB.prepare('SELECT id FROM output_docks WHERE user_id=?').bind(userId).all(),designs=await env.DB.prepare('SELECT id FROM overlay_variants WHERE user_id=?').bind(userId).all();await Promise.all([...sources.results.map(d=>broadcastDock(env,d.id,{type:'dock.deleted'})),...designs.results.map(d=>broadcastDock(env,'design:'+d.id,{type:'dock.deleted'}))]);}
