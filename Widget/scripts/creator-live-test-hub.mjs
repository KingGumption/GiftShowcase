import {CreatorLive} from '../cloudflare/src/creator-live.mjs';
export function installCreatorLive(env,liveFetch){
  const hubs=new Map();if(liveFetch)env.LIVE_FETCH=liveFetch;
  env.CREATOR_LIVE={idFromName:id=>id,get(id){
    if(!hubs.has(id)){
      const values=new Map(),sockets=[],pending=[];let alarm;
      const state={storage:{get:async k=>values.get(k),put:async(k,v)=>values.set(k,structuredClone(v)),delete:async k=>values.delete(k),setAlarm:async t=>{alarm=t;},deleteAlarm:async()=>{alarm=null;}},
        blockConcurrencyWhile:fn=>fn(),waitUntil:p=>pending.push(Promise.resolve(p)),
        getWebSockets:()=>sockets.filter(s=>s.readyState===1),acceptWebSocket:s=>{s.accept();sockets.push(s);}};
      const instance=new CreatorLive(state,env);
      hubs.set(id,{instance,state,values,sockets,pending,get alarm(){return alarm;},fetch:(url,options)=>instance.fetch(url instanceof Request?url:new Request(url,options))});
    }
    return hubs.get(id);
  }};return hubs;
}
