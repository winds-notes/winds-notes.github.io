/* Offline app shell: serve up-to-date files online, cache fallback offline. */
const CACHE='winds-notes-shell-v64-fine-art-mandalas';
importScripts('./vendor/pdfjs/assets.js','./mandala-art.js?v=64');
const ASSETS=['./mandala-art.js','./mandala-art.js?v=64','./mandala-tools.js','./mandala-tools.js?v=64','./boundary-fill.js','./boundary-fill.js?v=61','./eraser-preview.js','./eraser-preview.js?v=49','./app.js?v=64','./creative-tools.js?v=64','./native-file.js?v=59','./interaction-tools.js?v=49','./','./index.html','./styles.css','./styles.css?v=62','./privacy.html','./terms.html','./legal.css','./LICENSE','./creative-tools.js','./app.js','./pdf-export.js','./pdf-import.js','./pdf-import.js?v=56','./clipboard.js','./text-tools.js','./interaction-tools.js','./page-stack.js','./vendor/pdfjs/assets.js','./native-file.js','./google-config.js','./cloud-drive.js','./cloud-drive.js?v=56','./live-sync.js','./live-sync.js?v=50','./notebook-sharing.js','./notebook-sharing.js?v=57','./shared-notebook-model.js','./manifest.webmanifest','./assets/icon.svg','./assets/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{
  await cache.addAll([...ASSETS,...self.WINDS_PDF_ASSETS]);
  // Keep network capacity available for opening pages and Drive traffic.
  const artwork=self.WindsMandalaArt.ASSETS;
  for(let i=0;i<artwork.length;i+=2)await cache.addAll(artwork.slice(i,i+2));
}).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(new URL(event.request.url).pathname.startsWith('/auth/')||new URL(event.request.url).pathname.startsWith('/live/'))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&!response.headers.get('Cache-Control')?.includes('no-store')){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});}
    return response;
  }).catch(()=>caches.match(event.request)));
});
