import '../../public/graphics-core.js';
const G=globalThis.KGGraphics;
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
// Split large saved configurations into bounded values; write the rules snapshot only on a new epoch.
async function readParts(storage,prefix){const count=await storage.get(prefix+'count');if(!count)return null;let text='';for(let i=0;i<count;i++)text+=await storage.get(prefix+i);return JSON.parse(text);}
async function writeParts(storage,prefix,value){const text=JSON.stringify(value),old=await storage.get(prefix+'count')||0,count=Math.ceil(text.length/16000);for(let i=0;i<count;i++)await storage.put(prefix+i,text.slice(i*16000,(i+1)*16000));for(let i=count;i<old;i++)await storage.delete(prefix+i);await storage.put(prefix+'count',count);}
export async function clearGraphic(storage){for(const prefix of ['graphics-state:','graphics-config:']){const count=await storage.get(prefix+'count')||0;for(let i=0;i<count;i++)await storage.delete(prefix+i);await storage.delete(prefix+'count');}}
export function graphicSize(kind,config){const d=G.definition(kind,config);return d?{width:d.width,height:d.height}:null;}
export async function graphicHubRequest(hub,request){
 const url=new URL(request.url);if(!url.pathname.startsWith('/graphics/'))return null;
 return hub.state.blockConcurrencyWhile(async()=>{
  const input=await request.json(),{kind,config}=input;if(!G.definition(kind,config))return response({error:'Choose a compact graphic first.'},400);
  let state=await readParts(hub.state.storage,'graphics-state:');const oldEpoch=state?.epoch,before=state?JSON.stringify(state):'';
  if(state)state.sessionConfig=await readParts(hub.state.storage,'graphics-config:')||config;
  const next=G.definition(kind,config),previous=state&&G.definitions.find(d=>d.id===state.variant);
  if(state&&state.variant!==next.id&&!next.live&&!previous?.live&&previous?.kind===next.kind){state.variant=next.id;state.sessionConfig=config;await writeParts(hub.state.storage,'graphics-config:',config);}
  else if(!state||state.variant!==next.id)state=G.fresh(kind,config);
  if(!next.live&&JSON.stringify(state.sessionConfig)!==JSON.stringify(config)){state.sessionConfig=config;await writeParts(hub.state.storage,'graphics-config:',config);}
  try{
   state=G.tick(state);
   if(url.pathname==='/graphics/command')state=G.command(state,kind,config,input);
   else if(url.pathname==='/graphics/events'){
    if(input.epoch!==state.epoch)return response({state:G.publicState(state),staleSession:true});
    const now=Date.now(),events=Array.isArray(input.events)?input.events.slice(0,40):[];
    if((state.rateAt||0)+1000<now){state.rateAt=now;state.rateCount=0;}
    if((state.rateCount||0)+events.length>200)return response({error:'Too many live events. Retry shortly.'},429);
    state.rateCount=(state.rateCount||0)+events.length;for(const event of events)state=G.event(state,kind,config,event,now);
   }else if(url.pathname!=='/graphics/state')return response({error:'Unknown graphic operation'},404);
   if(state.epoch!==oldEpoch)await writeParts(hub.state.storage,'graphics-config:',state.sessionConfig);
   const {sessionConfig,...persisted}=state;if(JSON.stringify(persisted)!==before){await writeParts(hub.state.storage,'graphics-state:',persisted);await hub.state.storage.setAlarm(state.expiresAt);}
   return response({state:G.publicState(state)});
  }catch(error){return response({error:error.message},400);}
 });
}
export async function expireGraphic(hub){const state=await readParts(hub.state.storage,'graphics-state:');if(!state)return;if(state.expiresAt<=Date.now())await clearGraphic(hub.state.storage);else await hub.state.storage.setAlarm(state.expiresAt);}
