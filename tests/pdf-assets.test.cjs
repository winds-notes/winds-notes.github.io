const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('offline PDF pre-cache includes the matching reader, worker and all declared local runtime assets',async()=>{
  const root=path.dirname(require.resolve('../app.js')),events=new Map(),assets=[];let pending;
  const context=vm.createContext({self:{addEventListener:(name,handler)=>events.set(name,handler),skipWaiting(){}},
    caches:{open:async()=>({addAll:async urls=>{assets.push(...urls);}})},importScripts:(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.resolve(root,file.split('?')[0]),'utf8'),context);}});
  Object.assign(context,context.self);context.self=context;
  vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);events.get('install')({waitUntil:promise=>{pending=promise;}});await pending;
  // App scripts are cached under their release-versioned URLs (see sw.js).
  assert.ok(assets.some(file=>/^\.\/pdf-import\.js\?v=\d+$/.test(file)));
  for(const file of ['./vendor/pdfjs/pdf.min.mjs','./vendor/pdfjs/pdf.worker.min.mjs'])assert.ok(assets.includes(file));
  assert.ok(assets.some(file=>file.includes('/standard_fonts/')));assert.ok(assets.some(file=>file.includes('/cmaps/')));assert.ok(assets.some(file=>file.endsWith('.wasm')));
  assert.equal(assets.filter(file=>file.startsWith('./assets/mandalas/')&&file.endsWith('.js?v=65')).length,50);
  for(const file of assets){const actual=path.resolve(root,file.split('?')[0]);assert.ok(actual.startsWith(root+path.sep)||actual===root);assert.ok(fs.existsSync(actual),file);}
});

test('offline updates reuse unchanged artwork and keep cold artwork downloads limited to two',async()=>{
 for(const warm of [true,false]){
  const root=path.dirname(require.resolve('../app.js')),events=new Map();let pending,copied=0,downloaded=0,active=0,peak=0;
  const context=vm.createContext({self:{addEventListener:(name,handler)=>events.set(name,handler),skipWaiting(){}},
   caches:{match:async()=>warm?{}:undefined,open:async()=>({put:async()=>{copied++;},addAll:async urls=>{if(!urls[0].startsWith('./assets/mandalas/'))return;active++;peak=Math.max(peak,active);downloaded+=urls.length;await new Promise(resolve=>setImmediate(resolve));active--;}})},
   importScripts:(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.resolve(root,file.split('?')[0]),'utf8'),context);}});
  Object.assign(context,context.self);context.self=context;vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);events.get('install')({waitUntil:p=>{pending=p;}});await pending;
  assert.equal(copied,warm?50:0);assert.equal(downloaded,warm?0:50);assert.ok(peak<=2);
 }
});

test('offline registration runs after slow startup as well as before window load',()=>{
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const start=source.indexOf('  function registerOfflineShell(){'),end=source.indexOf('\n  async function boot()',start);
  const registerCode=source.slice(start,end)+'\nregisterOfflineShell();';
  for(const readyState of ['loading','complete']){
    let calls=0,loadHandler=null;
    const context={navigator:{serviceWorker:{register:file=>{assert.equal(file,'./sw.js');calls++;return Promise.resolve();}}},
      location:{protocol:'http:'},document:{readyState},window:{addEventListener:(event,handler,options)=>{assert.equal(event,'load');assert.equal(options.once,true);loadHandler=handler;}}};
    vm.runInNewContext(registerCode,context);
    if(readyState==='loading'){assert.equal(calls,0);assert.ok(loadHandler);loadHandler();}
    else assert.equal(loadHandler,null);
    assert.equal(calls,1);
  }
  vm.runInNewContext(registerCode,{navigator:{},location:{protocol:'http:'}});
  vm.runInNewContext(registerCode,{navigator:{serviceWorker:{}},location:{protocol:'file:'}});
});
test('the editor stylesheet and dependencies use matching release URLs offline',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),worker=fs.readFileSync(require.resolve('../sw.js'),'utf8');
 for(const name of ['app.js','selection-preview.js','creative-tools.js','native-file.js','interaction-tools.js','eraser-preview.js','cloud-drive.js','live-sync.js','notebook-sharing.js','styles.css','google-config.js','text-tools.js','clipboard.js','pdf-import.js','workspace-model.js','page-stack.js']){
   const prefix='./'+name+'?v=';
   const url=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]).find(url=>url.startsWith(prefix));
   assert.ok(url,name+' needs a versioned URL');
   const release=worker.match(/const RELEASE='(\d+)'/)[1];
   assert.equal(url,prefix+release,url+' must match the service-worker release');
   assert.ok(worker.includes("'"+name+"'"),name+' needs an offline cache entry');
 }
});
