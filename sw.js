/* Offline app shell: serve up-to-date files online, cache fallback offline. */
const CACHE='winds-notes-shell-v36-copy-paste-r6';
importScripts('./vendor/pdfjs/assets.js');
const ASSETS=['./','./index.html','./styles.css','./privacy.html','./terms.html','./legal.css','./LICENSE','./creative-tools.js','./app.js','./pdf-export.js','./pdf-import.js','./clipboard.js','./vendor/pdfjs/assets.js','./native-file.js','./google-config.js','./cloud-drive.js','./live-sync.js','./notebook-sharing.js','./shared-notebook-model.js','./manifest.webmanifest','./assets/icon.svg','./assets/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...ASSETS,...self.WINDS_PDF_ASSETS])).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(new URL(event.request.url).pathname.startsWith('/auth/')||new URL(event.request.url).pathname.startsWith('/live/'))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&!response.headers.get('Cache-Control')?.includes('no-store')){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});}
    return response;
  }).catch(()=>caches.match(event.request)));
});
