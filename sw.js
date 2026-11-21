/* Offline app shell: serve up-to-date files online, cache fallback offline.
 * Every local script/style URL in index.html carries the release version
 * below. Change RELEASE and CACHE on every deploy. */
const RELEASE='111';
const CACHE='winds-notes-shell-v111-coloring-galleries';
importScripts('./vendor/pdfjs/assets.js','./mandala-art.js?v='+RELEASE);
const VERSIONED=['theme.js','google-config.js','styles.css','dark.css','mandala-art.js','color-number.js','creative-tools.js','svg-stickers.js','graph-tools.js','vector-tools.js','interaction-tools.js',
  'selection-preview.js','eraser-preview.js','page-stack.js','workspace-model.js','text-tools.js','pdf-export.js','pdf-import.js',
  'native-file.js','clipboard.js','shared-notebook-model.js','notebook-sharing.js','live-sync.js','cloud-drive.js','boundary-fill.js',
  'mandala-tools.js','pdf-text.js','pdf-study.js','pdf-ink.js','study-tools.js','study-cards.js','tutorial.js','app.js'].map(file=>'./'+file+'?v='+RELEASE);
const ASSETS=['./','./index.html','./tutorial.html',...VERSIONED,'./privacy.html','./terms.html','./legal.css','./LICENSE',
  './manifest.webmanifest','./assets/icon.svg','./assets/apple-touch-icon.png'];
const OCR_ASSETS=['tesseract.min.js','worker.min.js','tesseract-core-lstm.wasm.js','eng.traineddata.gz'].map(file=>'./vendor/ocr/'+file);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{
  await cache.addAll([...ASSETS,...self.WINDS_PDF_ASSETS,...OCR_ASSETS]);
  // Keep network capacity available for opening pages and Drive traffic.
  const artwork=self.WindsMandalaArt.ASSETS;
  for(let i=0;i<artwork.length;i+=2)await Promise.all(artwork.slice(i,i+2).map(async url=>{
    const existing=await caches.match?.(url);
    if(existing)await cache.put(url,existing);else await cache.addAll([url]);
  }));
}).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('winds-notes-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});

// Network first for everything (the original strategy): online devices always
// run the newest release; the cache is only used offline.
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/live/'))return;
  const network=fetch(request);
  event.waitUntil(network.then(response=>{
    if(response.ok&&!response.headers.get('Cache-Control')?.includes('no-store')){
      const copy=response.clone();
      return caches.open(CACHE).then(cache=>cache.put(request,copy));
    }
  }).catch(()=>{}));
  event.respondWith(network.catch(async()=>{
    const exact=await caches.match(request);
    if(exact||request.mode!=='navigate')return exact;
    url.search='';
    return await caches.match(url.href)||await caches.match('./index.html')||await caches.match('./');
  }));
});
