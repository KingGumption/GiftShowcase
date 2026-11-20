(function(){'use strict';const cloud=window.overlayCloud,$=id=>document.getElementById(id),params=new URLSearchParams(location.hash.slice(1)),token=params.get('invite'),joining=location.pathname.startsWith('/join');function message(value,error=false){$('invite-message').textContent=value;$('invite-message').classList.toggle('error',error);}
 $('request-view').hidden=joining;$('join-view').hidden=!joining;
 const activeView=joining?$('join-view'):$('request-view');
 activeView.append($('invite-message'),$('invite-request-again'));
 $('invite-request-form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const form=new FormData(e.target),result=await cloud.request('/v1/invitations/request',{method:'POST',auth:false,body:{name:form.get('name'),email:form.get('email'),channel:form.get('channel'),reason:form.get('reason'),website:form.get('website'),consent:form.get('consent')==='on'}});message(result.message);e.target.hidden=true;}catch(error){message(error.message,true);button.disabled=false;}};
 $('invite-accept-form').onsubmit=async e=>{e.preventDefault();if($('join-password').value!==$('join-confirm').value)return message('The passwords don’t match.',true);const button=e.target.querySelector('button');button.disabled=true;try{const result=await cloud.request('/v1/auth/register',{method:'POST',auth:false,body:{email:$('join-email').value,password:$('join-password').value,inviteToken:token}});if(!result.session){message(result.message||'This address already has an account. Sign in to continue.');return;}cloud.saveSession(result.session);history.replaceState(null,'','/join/');location.assign('/studio/');}catch(error){message(error.message,true);button.disabled=false;}};
 async function init(){
   if(!joining)return;
   const heading=$('join-heading'),instructions=$('join-instructions'),form=$('invite-accept-form');
   if(!token){
     heading.textContent='Invitation link needed';
     instructions.textContent='Open the invitation link you received by email.';
     $('invite-request-again').hidden=false;
     return;
   }
   message('Checking your invitation…');
   try{
     const result=await cloud.request('/v1/invitations/inspect',{method:'POST',auth:false,body:{token}});
     $('join-email').value=result.email;
     heading.textContent='Create your account';
     instructions.textContent='Choose a password for the invited email address.';
     form.hidden=false;
     message('Invitation valid until '+new Date(result.expiresAt).toLocaleDateString()+'.');
   }catch(error){
     heading.textContent=error.status===400?'Invitation unavailable':'Couldn’t check your invitation';
     message(error.status===400?'This link is invalid, expired or already used.':error.message,true);
     $('invite-request-again').hidden=false;
   }
 }
 init();
})();
