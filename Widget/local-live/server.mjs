import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, extname, sep} from 'node:path';
import {WebSocketServer} from 'ws';
import {LiveBridge, overlayEvent, fixtures} from './bridge.mjs';

const publicRoot = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const localRoot = fileURLToPath(new URL('./', import.meta.url));
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};

export async function startServer({port = 8788, fixtureMode = false, factory} = {}) {
  const sockets = new WebSocketServer({noServer:true, maxPayload:16384});
  const broadcast = value => { const text = JSON.stringify(value); for (const socket of sockets.clients) if (socket.readyState === 1 && socket.bufferedAmount < 1048576) socket.send(text); };
  const bridge = new LiveBridge(factory || (async name => {
    const {TikTokLiveConnection} = await import('tiktok-live-connector');
    return new TikTokLiveConnection(name, {processInitialData:false, fetchRoomInfoOnConnect:false, enableExtendedGiftInfo:false,
      ...(process.env.SIGN_API_KEY ? {signApiKey:process.env.SIGN_API_KEY} : {}),
      webClientOptions:{timeout:{request:15000}}, wsClientOptions:{handshakeTimeout:15000}});
  }), broadcast);
  let origin, busy = false, sampleRun = 0;
  const server = createServer(async (request, response) => {
    const reply = (status, body) => {response.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(body));};
    try {
      if (request.headers.host !== new URL(origin).host) return reply(403,{error:'Local access only'});
      const url = new URL(request.url, origin);
      if (url.pathname === '/live/status' && request.method === 'GET') return reply(200,{...bridge.status,fixtureMode});
      if (url.pathname.startsWith('/live/')) {
        if (request.method !== 'POST') return reply(405,{error:'POST required'});
        if (request.headers.origin !== origin || !request.headers['content-type']?.startsWith('application/json')) return reply(403,{error:'Use the local connection page'});
        if (busy) return reply(409,{error:'A connection change is already in progress'});
        let body = ''; for await (const chunk of request) {body += chunk; if(body.length>1024)return reply(413,{error:'Request too large'});}
        const input = JSON.parse(body || '{}');
        busy = true;
        try {
          if (url.pathname === '/live/connect') { if(fixtureMode)return reply(409,{error:'Restart without --fixtures for a real TikTok connection'}); return reply(200,await bridge.connect(input.username)); }
          if (url.pathname === '/live/disconnect') {await bridge.disconnect(); return reply(200,bridge.status);}
          if (url.pathname === '/live/sample' && fixtureMode) {
            const run = ++sampleRun;
            for (const [event,data] of fixtures) broadcast(overlayEvent(event,{...data,msgId:run+':'+data.msgId},'local-fixture'));
            bridge.status = {phase:'simulated',username:'local_viewer'};
            return reply(200,{sent:fixtures.length});
          }
          return reply(404,{error:'Not found'});
        } finally {busy = false;}
      }
      if (!['GET','HEAD'].includes(request.method)) return reply(405,{error:'Method not allowed'});
      const file = url.pathname === '/' ? resolve(localRoot,'index.html') : url.pathname.startsWith('/Widget/public/') ? resolve(publicRoot,decodeURIComponent(url.pathname.slice('/Widget/public/'.length))) : '';
      if (!file || file !== resolve(localRoot,'index.html') && !file.startsWith(publicRoot+sep)) return reply(404,{error:'Not found'});
      const content = await readFile(file);
      response.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
      response.end(request.method==='HEAD'?undefined:content);
    } catch (error) {reply(error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'Not found':'Invalid request. Check the username and try again.'});}
  });
  server.on('upgrade',(request,socket,head) => {
    if (request.headers.host !== new URL(origin).host || request.url !== '/events' || request.headers.origin && request.headers.origin !== origin) return socket.destroy();
    sockets.handleUpgrade(request,socket,head,ws=>sockets.emit('connection',ws,request));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  origin = 'http://127.0.0.1:'+server.address().port;
  return {origin,bridge,broadcast,sockets,async close(){await bridge.disconnect();for(const ws of sockets.clients)ws.terminate();await new Promise(r=>sockets.close(r));await new Promise(r=>server.close(r));}};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await startServer({port:Number(process.env.LOCAL_LIVE_PORT)||8788,fixtureMode:process.argv.includes('--fixtures')});
  console.log('Local TikTok connection: '+app.origin+' ('+(process.argv.includes('--fixtures')?'simulated events':'real connection')+')');
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await app.close();process.exit(0);});
}
