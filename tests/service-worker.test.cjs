// Fetch strategy of sw.js: instant cached app files, fresh pages when online.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.dirname(require.resolve('../app.js'));
const ORIGIN='https://notes.example';

function worker({cached={},network}){
  const events=new Map(),fetches=[],puts=[];
  const match=async(request,options)=>{
    const url=typeof request==='string'?new URL(request,ORIGIN+'/').href:request.url;
    const key=options?.ignoreSearch?url.split('?')[0]:url;
    return cached[key]||null;
  };
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
Object.defineProperty(Response.prototype,'type',{get(){return 'basic';},configurable:true});

test('versioned app files open from the offline cache without waiting for the network',async()=>{
  const release=fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const RELEASE='(\d+)'/)[1];
  const url=`/app.js?v=${release}`;
  const sw=worker({cached:{[ORIGIN+url]:ok('cached app')},network:()=>{throw new Error('network should not be used');}});
  assert.equal(await (await sw.respond(url)).text(),'cached app');
  assert.deepEqual(sw.fetches,[]);
  const fresh=worker({cached:{},network:()=>ok('downloaded')});
  assert.equal(await (await fresh.respond('/app.js?v=999')).text(),'downloaded');
  assert.equal(fresh.puts.length,1,'a new release file is cached for the next launch');
});

test('pages come from the network when online and from the installed copy when offline or failing',async()=>{
  const online=worker({cached:{[ORIGIN+'/index.html']:ok('old page')},network:()=>ok('new page')});
  assert.equal(await (await online.respond('/','navigate')).text(),'new page');
  const offline=worker({cached:{[ORIGIN+'/']:ok('installed page')},network:()=>Promise.reject(new TypeError('offline'))});
  assert.equal(await (await offline.respond('/?shared=abc','navigate')).text(),'installed page');
  const failing=worker({cached:{[ORIGIN+'/index.html']:ok('installed page')},network:()=>new Response('error',{status:503})});
  assert.equal(await (await failing.respond('/','navigate')).text(),'installed page');
});

test('OAuth return, sign-in and live endpoints are never served from the cache',async()=>{
  const sw=worker({cached:{},network:()=>ok('x')});
  for(const url of ['/oauth-callback.html','/auth/google/session','/live/events'])assert.equal(await sw.respond(url),null,url);
});
