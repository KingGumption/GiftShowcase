(function(global){
  'use strict';
  const cloud=global.overlayCloud;if(!cloud?.enabled)return;
  const note=document.querySelector('[data-account-recovery-note]');
  const requestButton=document.createElement('button');requestButton.type='button';requestButton.id='cloud-request-reset';requestButton.className='account-recovery-link';requestButton.textContent='Forgot your password?';requestButton.hidden=true;
  if(note)note.before(requestButton);else document.querySelector('#cloud-auth-form')?.append(requestButton);
  cloud.getServiceConfig().then(config=>{requestButton.hidden=!config.accountRecoveryEnabled;if(config.accountRecoveryEnabled&&note)note.hidden=true;}).catch(()=>{});
  const dialog=document.createElement('dialog');dialog.className='cloud-variant-dialog account-recovery-dialog';dialog.setAttribute('aria-labelledby','account-recovery-heading');
  dialog.innerHTML='<form><h2 id="account-recovery-heading">Reset your password</h2><p data-recovery-help></p><label data-recovery-email>Email address<input type="email" autocomplete="email" required maxlength="254"></label><label data-recovery-password hidden>New password<input type="password" autocomplete="new-password" minlength="15" maxlength="200"></label><label data-recovery-confirm hidden>Confirm new password<input type="password" autocomplete="new-password" minlength="15" maxlength="200"></label><p role="status" data-recovery-status></p><div class="cloud-variant-dialog-actions"><button type="button" data-recovery-cancel>Cancel</button><button type="submit" class="btn-primary">Send reset link</button></div></form>';
  document.body.append(dialog);
  const form=dialog.querySelector('form'),heading=dialog.querySelector('h2'),help=dialog.querySelector('[data-recovery-help]'),status=dialog.querySelector('[data-recovery-status]'),submit=form.querySelector('[type="submit"]');
  const emailField=dialog.querySelector('[data-recovery-email]'),passwordField=dialog.querySelector('[data-recovery-password]'),confirmField=dialog.querySelector('[data-recovery-confirm]');
  let mode='request',token='';
  function open(action){
    mode=action;form.reset();status.textContent='';submit.hidden=false;dialog.querySelector('[data-recovery-cancel]').textContent='Cancel';heading.textContent=mode==='email'?'Confirm your email address':'Reset your password';
    emailField.hidden=mode!=='request';emailField.querySelector('input').required=mode==='request';
    passwordField.hidden=confirmField.hidden=mode!=='reset';
    for(const field of [passwordField,confirmField])field.querySelector('input').required=mode==='reset';
    help.textContent=mode==='request'?'We will email you a link to choose a new password.':mode==='reset'?'Choose a password of at least 15 characters. This signs out existing sessions.':'Confirm the address change you requested. This signs out existing sessions.';
    submit.textContent=mode==='request'?'Send reset link':mode==='reset'?'Change password':'Confirm email';submit.disabled=false;dialog.showModal();
    (mode==='request'?emailField.querySelector('input'):mode==='reset'?passwordField.querySelector('input'):submit).focus();
  }
  requestButton.onclick=()=>open('request');dialog.querySelector('[data-recovery-cancel]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{form.reset();token='';});
  form.onsubmit=async event=>{
    event.preventDefault();submit.disabled=true;status.textContent='Working…';
    try{
      let result;
      if(mode==='request')result=await cloud.request('/v1/auth/request-reset',{method:'POST',auth:false,body:{email:emailField.querySelector('input').value}});
      else {
        const password=passwordField.querySelector('input').value;
        if(mode==='reset'&&password!==confirmField.querySelector('input').value)throw new Error('The passwords do not match.');
        result=await cloud.request(mode==='reset'?'/v1/auth/reset-password':'/v1/auth/verify-email',{method:'POST',auth:false,body:{token,...(mode==='reset'?{password}:{})}});
        cloud.saveSession(null);token='';form.reset();
      }
      status.textContent=result.message;submit.hidden=true;dialog.querySelector('[data-recovery-cancel]').textContent='Close';
    }catch(error){status.textContent=error.message;submit.disabled=false;}
  };
  const action=new URLSearchParams(location.hash.slice(1));
  if(['reset','email'].includes(action.get('accountAction'))&&action.get('token')){
    token=action.get('token');history.replaceState(null,'',location.pathname+location.search);open(action.get('accountAction'));
  }
})(window);
