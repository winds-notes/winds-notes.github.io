// Fetch strategy of sw.js: network first (newest release online), cache fallback offline.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.dirname(require.resolve('../app.js'));
const ORIGIN='https://notes.example';

function worker({cached={},network}){
  const events=new Map(),fetches=[],puts=[];
  const match=async request=>{const url=typeof request==='string'?new URL(request,ORIGIN+'/').href:request.url;return cached[url]||undefined;};
  const context=vm.createContext({URL,Response,Promise,setTimeout,clearTimeout,
    self:{addEventListener:(name,handler)=>events.set(name,handler),location:{origin:ORIGIN},skipWaiting(){},clients:{claim(){}}},
    caches:{match,open:async()=>({put:async(request)=>{puts.push(request.url||request);}}),keys:async()=>[]},
    fetch:async request=>{fetches.push(request.url);return network(request);},
    importScripts:(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.resolve(root,file.split('?')[0]),'utf8'),context);}});
  Object.assign(context,context.self);context.self=context;
  vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
  const respond=async(url,mode='no-cors')=>{
    let responded=null;
    events.get('fetch')({request:{method:'GET',url:ORIGIN+url,mode},respondWith:value=>{responded=value;}});
    return responded===null?null:await responded;
  };
  return {respond,fetches,puts};
}
const ok=body=>new Response(body,{status:200});

test('online devices always load the newest app files from the network',async()=>{
  const sw=worker({cached:{[ORIGIN+'/app.js?v=72']:ok('old cached app')},network:()=>ok('newest app')});
  assert.equal(await (await sw.respond('/app.js?v=72')).text(),'newest app');
  assert.equal(sw.fetches.length,1);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sw.puts.length,1,'the offline copy is refreshed');
});

test('offline devices open the installed copy, including pages with a query string',async()=>{
  const offline=worker({cached:{[ORIGIN+'/app.js?v=72']:ok('cached app'),[ORIGIN+'/index.html']:ok('installed page')},network:()=>Promise.reject(new TypeError('offline'))});
  assert.equal(await (await offline.respond('/app.js?v=72')).text(),'cached app');
  assert.equal(await (await offline.respond('/?shared=abc','navigate')).text(),'installed page');
});

test('every deploy uses a new cache name and matching release URLs',()=>{
  const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const release=worker.match(/const RELEASE='(\d+)'/)[1];
  assert.match(worker.match(/const CACHE='([^']+)'/)[1],new RegExp('v'+release+'\\b'),'cache name changes with the release');
  for(const [,version] of html.matchAll(/(?:src|href)="\.\/[\w-]+\.(?:js|css)\?v=(\d+)"/g))assert.equal(version,release);
});

test('sign-in and live endpoints are never served from the cache',async()=>{
  const sw=worker({cached:{},network:()=>ok('x')});
  for(const url of ['/auth/google/session','/live/events'])assert.equal(await sw.respond(url),null,url);
});
