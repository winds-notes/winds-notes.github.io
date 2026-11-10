/* Offline app shell.
 * Pages: network first (short timeout) so a new release is picked up at once.
 * Versioned app files: cache first, so the app opens instantly on iPad even on
 * a slow connection. Every local script/style URL in index.html carries the
 * release version below; a new release changes the URLs and this cache name. */
const RELEASE='71';
const CACHE='winds-notes-shell-v71-appearance';
const NAV_TIMEOUT_MS=3500;
importScripts('./vendor/pdfjs/assets.js','./mandala-art.js?v='+RELEASE);
const VERSIONED=['theme.js','google-config.js','styles.css','dark.css','mandala-art.js','creative-tools.js','interaction-tools.js',
  'selection-preview.js','eraser-preview.js','page-stack.js','workspace-model.js','text-tools.js','pdf-export.js','pdf-import.js',
  'native-file.js','clipboard.js','shared-notebook-model.js','notebook-sharing.js','live-sync.js','cloud-drive.js','boundary-fill.js',
  'mandala-tools.js','app.js'].map(file=>'./'+file+'?v='+RELEASE);
const ASSETS=['./','./index.html',...VERSIONED,'./privacy.html','./terms.html','./legal.css','./LICENSE',
  './manifest.webmanifest','./assets/icon.svg','./assets/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{
  await cache.addAll([...ASSETS,...self.WINDS_PDF_ASSETS]);
  // Keep network capacity available for opening pages and Drive traffic.
  const artwork=self.WindsMandalaArt.ASSETS;
  for(let i=0;i<artwork.length;i+=2)await Promise.all(artwork.slice(i,i+2).map(async url=>{
    const existing=await caches.match?.(url);
    if(existing)await cache.put(url,existing);else await cache.addAll([url]);
  }));
}).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});

const cacheable=response=>response&&response.ok&&response.type==='basic'&&!response.headers.get('Cache-Control')?.includes('no-store');
function remember(request,response){
  if(!cacheable(response))return;
  const copy=response.clone();
  caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
}
async function page(request){
  const network=fetch(request).then(response=>{remember(request,response);return response;});
  let timer;
  const timeout=new Promise(resolve=>{timer=setTimeout(resolve,NAV_TIMEOUT_MS,null);});
  let response=null;
  try{response=await Promise.race([network,timeout]);}catch{}finally{clearTimeout(timer);}
  if(response?.ok)return response;
  // Offline, slow or failing hosting: open the installed copy instead.
  const cached=await caches.match(request,{ignoreSearch:true})||await caches.match('./index.html')||await caches.match('./');
  return cached||response||network;
}
async function asset(request){
  const cached=await caches.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  remember(request,response);
  return response;
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  // Authentication and the live relay always use the network.
  if(url.pathname.startsWith('/auth/')||url.pathname.startsWith('/live/'))return;
  event.respondWith(request.mode==='navigate'?page(request):asset(request));
});
