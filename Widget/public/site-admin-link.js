(function(g){'use strict';const cloud=g.overlayCloud,link=document.createElement('a');let generation=0;
link.href='/admin/';link.className='studio-live-controls studio-admin-link';link.dataset.adminNavigation='';link.innerHTML='<svg class="account-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m8 12 3 3 5-6"/></svg><span>Administration</span>';
async function sync(){const current=++generation,token=cloud?.session?.token;link.remove();if(!token)return;try{const result=await cloud.me();if(current===generation&&cloud.session?.token===token&&result.user?.role==='admin')document.querySelector('.studio-help-link')?.before(link);}catch{/* Fail closed: never show admin navigation without server verification. */}}
g.addEventListener('overlaycloud:session',sync);sync();
})(window);
