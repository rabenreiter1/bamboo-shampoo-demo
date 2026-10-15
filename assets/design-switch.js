/** Explicit comparison routes never change the public default or the shared bag. */
export function designDestination(href, base, design = 'current') {
  const url = new URL(href), root = base.replace(/\/$/, '');
  const suffix = url.pathname.slice(root.length).replace(/^\/classic(?=\/)/, '');
  if (!url.pathname.startsWith(`${root}/`) || !/^\/(de|en)\//.test(suffix)) return null;
  url.pathname = `${root}${design === 'classic' ? '/classic' : ''}${suffix}`;
  url.searchParams.delete('resume');
  url.hash = '';
  return url.href;
}

export function initializeDesignSwitch({base, document:doc=document, window:win=window, now=()=>performance.now()}={}) {
  const trigger=doc.querySelector('[data-design-trigger]'), panel=doc.querySelector('[data-design-options]');
  if(!trigger||!panel)return null;
  let previous=-Infinity;
  const open=()=>{refresh();panel.hidden=false;trigger.setAttribute('aria-expanded','true');};
  function click(){const time=now();if(time-previous<=450){open();previous=-Infinity;}else previous=time;}
  function keyboard(event){
    if(event.currentTarget===trigger&&(event.key==='Enter'||event.key===' ')){event.preventDefault();open();panel.querySelector('a')?.focus();}
    if(event.key==='Escape'){panel.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();}
  }
  function refresh(){for(const link of panel.querySelectorAll('[data-design-target]')){const href=designDestination(win.location.href,base,link.dataset.designTarget);if(href)link.href=href;}}
  trigger.addEventListener('click',click);trigger.addEventListener('keydown',keyboard);panel.addEventListener('keydown',keyboard);
  win.addEventListener('pageshow',refresh);refresh();
  return {destroy(){trigger.removeEventListener('click',click);trigger.removeEventListener('keydown',keyboard);panel.removeEventListener('keydown',keyboard);win.removeEventListener('pageshow',refresh);}};
}
