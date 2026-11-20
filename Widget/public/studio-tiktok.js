(function(g){'use strict';
 const cloud=g.overlayCloud,panel=document.querySelector('#studio-tiktok'),form=document.querySelector('#studio-tiktok-form'),input=document.querySelector('#studio-tiktok-username'),status=document.querySelector('#studio-tiktok-status'),connect=document.querySelector('#studio-tiktok-connect'),disconnect=document.querySelector('#studio-tiktok-disconnect');
 if(!cloud||!panel)return;let busy=false,ready=false;
 const names={disconnected:'Disconnected',waiting:'Ready — open a Direct URL or Canvas to receive events',connecting:'Connecting to TikTok…',connected:'Connected to TikTok LIVE',reconnecting:'Reconnecting…',offline:'This creator is not live',ended:'The LIVE has ended',limited:'Connection allowance reached',error:'Connection needs attention'};
 function paint(s){if(document.activeElement!==input)input.value=s.username||'';status.textContent=s.message||names[s.phase]||'Disconnected';if(!s.configured)status.textContent='TikTok LIVE is awaiting server setup.';connect.disabled=busy||!s.configured;disconnect.disabled=busy||!s.enabled;}
 async function refresh(){if(busy||!ready||!cloud.signedIn)return;try{paint(await cloud.request('/v1/tiktok'));}catch(e){status.textContent=e.message;}}
 async function visibility(){try{const c=await cloud.getServiceConfig();ready=c.sharedLiveEnabled===true;panel.hidden=!ready||!cloud.signedIn;if(!panel.hidden)await refresh();}catch{panel.hidden=true;}}
 async function change(method,body){if(busy)return;busy=true;connect.disabled=disconnect.disabled=true;status.textContent=method==='DELETE'?'Disconnecting…':'Connecting to TikTok…';try{const s=await cloud.request('/v1/tiktok',{method,body});busy=false;paint(s);}catch(e){busy=false;status.textContent=e.message;connect.disabled=false;disconnect.disabled=false;}}
 form.addEventListener('submit',e=>{e.preventDefault();change('POST',{username:input.value});});disconnect.addEventListener('click',()=>change('DELETE'));
 g.addEventListener('overlaycloud:session',visibility);visibility();const timer=setInterval(refresh,15000);g.addEventListener('pagehide',()=>clearInterval(timer));
})(window);
