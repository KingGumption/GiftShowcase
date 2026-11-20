import {mailReady,sendStudioMail,brandedMail,mailTemplates} from './studio-mail.mjs';
const normalize=v=>String(v||'').trim().toLowerCase(),bounded=(v,n)=>String(v||'').trim().slice(0,n);
export async function invitationFor(env,token,email){const hash=await digest(token);return env.DB.prepare('SELECT * FROM invitations WHERE token_hash=? AND email=? COLLATE NOCASE AND used_at IS NULL AND claim IS NULL AND expires_at>?').bind(hash,email,new Date().toISOString()).first();}
export async function digest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
function token(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
export async function routeAdmin(request,env,ctx,path,h){
 const {json,readJson,requireUser,httpError,enforceAuthRateLimit}=h,url=new URL(request.url);
 if(path==='/v1/invitations/request'&&request.method==='POST'){
  const input=await readJson(request,8192),email=normalize(input.email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw httpError(400,'Enter a valid email address');
  await enforceAuthRateLimit(request,env,'invite-request',email);const reply=()=>json({message:'Your request has been received. If access is available, we’ll email you with the next step.'},202);
  if(input.website)return reply();if(input.consent!==true)throw httpError(400,'Please acknowledge the privacy notice');
  const name=bounded(input.name,80);if(!name)throw httpError(400,'Enter your name');
  const existing=await env.DB.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').bind(email).first();if(existing)return reply();
  const now=new Date().toISOString(),id=crypto.randomUUID(),previous=await env.DB.prepare('SELECT * FROM invite_requests WHERE email=? COLLATE NOCASE').bind(email).first();
  if(previous&&previous.status!=='rejected'||previous&&Date.now()-Date.parse(previous.reviewed_at||previous.created_at)<14*86400000)return reply();
  await env.DB.prepare("INSERT INTO invite_requests(id,email,name,channel,reason,status,created_at) VALUES (?,?,?,?,?,'pending',?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,channel=excluded.channel,reason=excluded.reason,status='pending',created_at=excluded.created_at,reviewed_at=NULL,reviewed_by=NULL,note=''").bind(id,email,name,bounded(input.channel,250),bounded(input.reason,1200),now).run();
  const work=(async()=>{await sendStudioMail(env,email,'request-received');if(env.INVITE_NOTIFY_EMAIL)await sendStudioMail(env,env.INVITE_NOTIFY_EMAIL,'admin-request',{name,email,channel:bounded(input.channel,250),reason:bounded(input.reason,1200)});})();if(ctx?.waitUntil)ctx.waitUntil(work);else await work;return reply();
 }
 if(path==='/v1/invitations/inspect'&&request.method==='POST'){
  const input=await readJson(request,4096);await enforceAuthRateLimit(request,env,'inspect-invite','');const hash=await digest(input.token),row=await env.DB.prepare('SELECT email,expires_at FROM invitations WHERE token_hash=? AND used_at IS NULL AND claim IS NULL AND expires_at>?').bind(hash,new Date().toISOString()).first();if(!row)throw httpError(400,'This invitation is invalid or expired. Request a new one.');return json({email:row.email,expiresAt:row.expires_at});
 }
 if(!path.startsWith('/v1/admin/'))return null;
 const actor=await requireUser(request,env);if(actor.role!=='admin')throw httpError(403,'Administrator access required');
 const audit=async(action,target,reason='')=>env.DB.prepare('INSERT INTO admin_audit(id,actor_id,action,target_id,reason,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,action,target||null,bounded(reason,500),new Date().toISOString()).run();
 if(path==='/v1/admin/overview'&&request.method==='GET'){
  const counts=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM invite_requests WHERE status='pending') AS pending,(SELECT COUNT(*) FROM user_access WHERE status='suspended') AS suspended,(SELECT COUNT(*) FROM overlay_variants) AS designs,(SELECT COUNT(*) FROM output_docks) AS canvases,(SELECT COALESCE(SUM(size_bytes),0) FROM user_sounds WHERE ready=1) AS soundBytes").first();return json({counts,email:{provider:'Resend',configured:mailReady(env),from:env.ACCOUNT_EMAIL_FROM||'Not configured',notifyTo:env.INVITE_NOTIFY_EMAIL||'Not configured',freeDailyCap:90,freeMonthlyCap:2900},inviteOnly:env.INVITE_ONLY==='true'});
 }
 if(path==='/v1/admin/users'&&request.method==='GET'){
  const query=bounded(url.searchParams.get('q'),120),offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0)),filter='%'+query.replace(/[\\%_]/g,'\\$&')+'%';
  const rows=await env.DB.prepare("SELECT u.id,u.email,u.created_at,COALESCE(a.role,'member') AS role,COALESCE(a.status,'active') AS status,(SELECT COUNT(*) FROM overlay_variants WHERE user_id=u.id) AS designs,(SELECT COUNT(*) FROM output_docks WHERE user_id=u.id) AS canvases,(SELECT COUNT(*) FROM sessions WHERE user_id=u.id AND expires_at>?) AS sessions FROM users u LEFT JOIN user_access a ON a.user_id=u.id WHERE u.email LIKE ? ESCAPE '\\' ORDER BY u.created_at DESC,u.id LIMIT 51 OFFSET ?").bind(new Date().toISOString(),filter,offset).all();return json({users:rows.results.slice(0,50),hasMore:rows.results.length>50,nextOffset:offset+50});
 }
 const userPath=path.match(/^\/v1\/admin\/users\/([^/]+)\/(suspend|restore|revoke-sessions|delete)$/);
 if(userPath&&request.method==='POST'){
  const input=await readJson(request,4096),target=await env.DB.prepare('SELECT u.*,COALESCE(a.role,\'member\') AS role FROM users u LEFT JOIN user_access a ON a.user_id=u.id WHERE u.id=?').bind(decodeURIComponent(userPath[1])).first();if(!target)throw httpError(404,'User not found');
  if(target.id===actor.id||target.role==='admin')throw httpError(409,'Administrator accounts are protected from this action');
  if(normalize(input.confirmEmail)!==normalize(target.email))throw httpError(400,'Type the user’s email address to confirm');const reason=bounded(input.reason,500);if(reason.length<5)throw httpError(400,'Add a short reason for the audit log');const action=userPath[2];
  if(action==='delete'){await h.deleteUserData(env,target);}
  else if(action==='revoke-sessions')await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(target.id).run();
  else {await env.DB.prepare("INSERT INTO user_access(user_id,role,status,updated_at) VALUES (?,'member',?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at").bind(target.id,action==='suspend'?'suspended':'active',new Date().toISOString()).run();if(action==='suspend'){await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(target.id).run();await h.stopUserSources(env,target.id);}}
  await audit('user.'+action,target.id,reason);return json({ok:true});
 }
 if(path==='/v1/admin/invitations'&&request.method==='GET'){
  const status=['pending','approved','rejected'].includes(url.searchParams.get('status'))?url.searchParams.get('status'):'pending';const rows=await env.DB.prepare('SELECT * FROM invite_requests WHERE status=? ORDER BY created_at DESC LIMIT 100').bind(status).all();return json({requests:rows.results});
 }
 const review=path.match(/^\/v1\/admin\/invitations\/([^/]+)\/(approve|reject|resend)$/);
 if(review&&request.method==='POST'){
  const input=await readJson(request,4096),id=decodeURIComponent(review[1]),row=await env.DB.prepare('SELECT * FROM invite_requests WHERE id=?').bind(id).first();if(!row)throw httpError(404,'Request not found');const action=review[2],now=new Date().toISOString();
  if(action==='reject'){await env.DB.batch([env.DB.prepare("UPDATE invite_requests SET status='rejected',reviewed_at=?,reviewed_by=?,note=? WHERE id=?").bind(now,actor.id,bounded(input.note,500),id),env.DB.prepare('DELETE FROM invitations WHERE request_id=? AND used_at IS NULL').bind(id)]);const delivery=await sendStudioMail(env,row.email,'rejected');await audit('invite.rejected',id,bounded(input.note,500));return json({ok:true,delivery});}
  const existing=await env.DB.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').bind(row.email).first();if(existing)throw httpError(409,'This address already has an account');
  const raw=token(),hash=await digest(raw),expires=new Date(Date.now()+7*86400000).toISOString();await env.DB.batch([env.DB.prepare('DELETE FROM invitations WHERE request_id=? AND used_at IS NULL').bind(id),env.DB.prepare('INSERT INTO invitations(token_hash,request_id,email,expires_at,created_at) VALUES (?,?,?,?,?)').bind(hash,id,row.email,expires,now),env.DB.prepare("UPDATE invite_requests SET status='approved',reviewed_at=?,reviewed_by=?,note=? WHERE id=?").bind(now,actor.id,bounded(input.note,500),id)]);
  const link='https://kinggumption.com/join/#invite='+encodeURIComponent(raw),delivery=await sendStudioMail(env,row.email,'invite',{link});await audit('invite.'+action,id);return json({ok:true,link,expiresAt:expires,delivery});
 }
 if(path==='/v1/admin/activity'&&request.method==='GET'){return json({activity:(await env.DB.prepare('SELECT * FROM admin_audit ORDER BY created_at DESC LIMIT 100').all()).results});}
 if(path==='/v1/admin/email'&&request.method==='GET'){return json({configured:mailReady(env),templates:mailTemplates,log:(await env.DB.prepare('SELECT id,template,recipient,status,provider_id,error,created_at FROM mail_log ORDER BY created_at DESC LIMIT 100').all()).results});}
 if(path==='/v1/admin/email/preview'&&request.method==='POST'){const input=await readJson(request,4096);return json(brandedMail(input.template,{name:'Example creator',email:'creator@example.invalid',channel:'@example',reason:'A preview request for Studio access.',link:'https://kinggumption.com/join/#invite=preview-only-not-a-valid-token'}));}
 if(path==='/v1/admin/email/test'&&request.method==='POST'){if(!mailReady(env)||!env.INVITE_NOTIFY_EMAIL)throw httpError(503,'Configure the sender domain, API key and notification address first');await enforceAuthRateLimit(request,env,'mail-test',actor.id);const delivery=await sendStudioMail(env,env.INVITE_NOTIFY_EMAIL,'test');await audit('mail.test',null);return json({delivery});}
 return json({error:'Not found'},404);
}
