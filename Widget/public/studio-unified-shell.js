(function(g){'use strict';
const body=document.body,sidebar=document.querySelector('.studio-sidebar'),nav=document.querySelector('.studio-sidebar-content');
const toggle=document.createElement('button');toggle.type='button';toggle.className='studio-mobile-menu-toggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','studio-navigation');toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Menu</span>';sidebar.prepend(toggle);nav.id='studio-navigation';
function menu(open){body.classList.toggle('studio-mobile-menu-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.querySelector('span').textContent=open?'Close':'Menu';}
toggle.onclick=()=>menu(!body.classList.contains('studio-mobile-menu-open'));matchMedia('(max-width:820px)').addEventListener('change',e=>{if(!e.matches)menu(false);});g.addEventListener('keydown',e=>{if(e.key==='Escape'&&body.classList.contains('studio-mobile-menu-open')){menu(false);toggle.focus();}});

function navigate(url){
  g.studioRequestNavigation(()=>{g.studioAllowNavigation=true;location.assign(url);});
}
document.addEventListener('click',event=>{
  const graphic=event.target.closest('[data-graphic-menu]');
  const native=event.target.closest('[data-config-tab]');
  const canvas=event.target.closest('#studio-output-tab');
  if(graphic || (sessionOverlay && (native || canvas))){
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const url=new URL('/studio/',location.origin);
    if(graphic)url.searchParams.set('overlay',graphic.dataset.graphicMenu);
    else if(canvas)url.searchParams.set('workspace','outputs');
    else url.searchParams.set('kind',native.dataset.configTab==='original'?'carousel':native.dataset.configTab);
    navigate(url);
  } else if(native || canvas) menu(false);
},true);
function showSessionHeading(){
  const button=document.querySelector('[data-graphic-menu="'+sessionOverlay.id+'"]');
  const goal=document.querySelector('[data-config-tab="goal"]');
  goal.classList.remove('is-active');goal.removeAttribute('aria-current');
  button.classList.add('is-active');button.setAttribute('aria-current','page');
  document.querySelector('#studio-current-title').textContent=sessionOverlay.name;
  document.title=sessionOverlay.name+' | King Gumption Studio';
}
g.addEventListener('studio:session-ready',showSessionHeading);
if(g.studioSessionReady)showSessionHeading();
})(window);
