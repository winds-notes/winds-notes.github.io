/* WiNDS Notes · appearance: Match device (default), Light or Dark.
 * Loaded in <head> before the stylesheets so the chosen theme applies before
 * the first paint. Dark mode only changes the app around the page (see
 * dark.css); the writing paper, ink colours and exports are unchanged. */
(function(global){
  'use strict';
  const KEY='winds-notes-theme-v1',MODES=['system','light','dark'];
  const doc=global.document,root=doc?.documentElement;
  const media=global.matchMedia?global.matchMedia('(prefers-color-scheme: dark)'):null;
  const listeners=new Set();
  let mode='system';
  try{const saved=global.localStorage.getItem(KEY);if(MODES.includes(saved))mode=saved;}catch{}
  function resolved(){return mode==='dark'||(mode==='system'&&Boolean(media?.matches))?'dark':'light';}
  function apply(){
    const theme=resolved();
    if(root){root.dataset.theme=theme;root.dataset.themeMode=mode;}
    const meta=doc?.querySelector?.('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',theme==='dark'?'#16171f':'#f8f9fc');
    for(const listener of listeners){try{listener(theme,mode);}catch{}}
  }
  function set(next){
    if(!MODES.includes(next))return false;
    mode=next;
    try{global.localStorage.setItem(KEY,next);}catch{}
    apply();return true;
  }
  if(media){
    const follow=()=>{if(mode==='system')apply();};
    if(media.addEventListener)media.addEventListener('change',follow);else media.addListener?.(follow);
  }
  apply();
  global.WindsTheme=Object.freeze({get mode(){return mode;},resolved,set,MODES,
    onChange(listener){listeners.add(listener);return()=>listeners.delete(listener);}});
})(typeof window!=='undefined'?window:globalThis);
