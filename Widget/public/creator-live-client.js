(function(g){'use strict';
  const cleanups = new Set();
  const localEndpoint = 'ws://localhost:21213/';
  const unavailable = new Set(['reconnecting','limited','error','offline']);
  function url(token) {
    const u = new URL('/api/v1/public/live/'+encodeURIComponent(token),g.location.origin);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.href;
  }

  function socket(address) {
    const primary = new WebSocket(address);
    if (!new URL(address,g.location.href).pathname.startsWith('/api/v1/public/live/')) return primary;
    const output = new EventTarget();
    let local, retry, heartbeat, wanted = false, disposed = false, delay = 2000;
    const seen = new Map();

    function stopLocal() {
      wanted = false;
      clearTimeout(retry);
      delay = 2000;
      if (local) {const old=local; local=null; old.close();}
    }
    function cleanup() {
      disposed = true;
      clearInterval(heartbeat);
      stopLocal();
      cleanups.delete(cleanup);
    }
    function deliver(raw, packet, provider) {
      const d = packet?.data;
      const id = d?.msgId || d?.common?.msgId;
      if (id && packet.event) {
        const key = JSON.stringify([packet.event,String(id),d.repeatCount??0,Boolean(d.repeatEnd)]);
        const previous = seen.get(key);
        if (previous && previous.provider!==provider && Date.now()-previous.time<60000) return;
        seen.set(key,{provider,time:Date.now()});
        if (seen.size>2048) seen.delete(seen.keys().next().value);
      }
      output.dispatchEvent(new MessageEvent('message',{data:raw}));
    }
    function later() {
      clearTimeout(retry);
      if (wanted && !disposed) {
        retry=setTimeout(openLocal,delay);
        delay=Math.min(delay*2,60000);
      }
    }
    function openLocal() {
      if (!wanted || disposed || local) return;
      try {local=new WebSocket(localEndpoint);} catch {later();return;}
      const ws=local;
      ws.addEventListener('message',e=>{
        if (ws!==local || !wanted) return;
        let packet;
        try {packet=JSON.parse(e.data);} catch {return;}
        if (!packet?.event || !packet.data) return;
        delay=2000;
        deliver(e.data,packet,'tikfinity');
      });
      ws.addEventListener('close',()=>{if(ws===local){local=null;later();}});
    }

    Object.defineProperty(output,'readyState',{get:()=>primary.readyState});
    output.close=(...args)=>{cleanup();primary.close(...args);};
    cleanups.add(cleanup);
    primary.addEventListener('open',()=>{
      if (disposed) return;
      heartbeat=setInterval(()=>{if(primary.readyState===1)primary.send('ping');},20000);
      output.dispatchEvent(new Event('open'));
    });
    primary.addEventListener('message',e=>{
      if (disposed) return;
      let packet;
      try {packet=JSON.parse(e.data);} catch {return;}
      if (packet?.type==='creator.status') {
        if (packet.enabled && packet.tikfinityBackup && unavailable.has(packet.phase)) {
          if (!wanted) {wanted=true;openLocal();}
        } else if (!packet.enabled || !packet.tikfinityBackup || packet.phase!=='connecting') stopLocal();
      } else if (packet?.event) stopLocal();
      deliver(e.data,packet,'euler');
    });
    primary.addEventListener('close',()=>{cleanup();output.dispatchEvent(new Event('close'));});
    return output;
  }
  g.KGCreatorLive=Object.freeze({url,socket});
  const token=g.graphicContext?.token;
  if(g.creatorLiveShared&&token)g.creatorLiveEndpoint=url(token);
  g.addEventListener('pagehide',()=>{for(const cleanup of cleanups)cleanup();});
})(window);
