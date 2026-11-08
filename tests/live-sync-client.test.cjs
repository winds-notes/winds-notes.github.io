const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{randomUUID}=require('node:crypto');
const source=readFileSync(require.resolve('../live-sync.js'),'utf8');
function fixture({enabled=true,fetchGate,roomList=[]}={}){
  let busy=false,auto=true,id=0,now=100000,parsed=0,catchups=0,authLosses=0,clears=0;
  const tasks=new Map(),streams=[],requests=[],paints=[],status={hidden:true,textContent:''};
  class Clock extends Date{static now(){return now;}}
  class EventSource{
    constructor(url){this.url=url;this.listeners=new Map();this.closed=false;streams.push(this);}
    addEventListener(type,callback){this.listeners.set(type,callback);}
    emit(type,data,cursor='epoch:1'){this.listeners.get(type)?.({data:typeof data==='string'?data:JSON.stringify(data),lastEventId:cursor});}
    close(){this.closed=true;}
  }
  const context={WINDS_REALTIME_ENABLED:enabled,EventSource,AbortController,URLSearchParams,Blob,crypto:{randomUUID},Date:Clock,
    JSON:{stringify:JSON.stringify,parse(text){parsed++;return JSON.parse(text);}},document:{getElementById:()=>status},
    setTimeout(callback,delay){const next=++id;tasks.set(next,{callback,delay});return next;},clearTimeout:timer=>tasks.delete(timer),
    async fetch(url,options){requests.push({url,options});if(fetchGate)await fetchGate;return Response.json({durable:false});}};
  context.window=context;vm.runInNewContext(source,context);
  context.WindsLive.init({session:()=>({profile:{sub:'1111111111'},auto}),authLost:()=>{authLosses++;},catchup:()=>{catchups++;},
    bridge:{busy:()=>busy,room:()=> 'account',rooms:()=>roomList,paint:value=>paints.push(value),clear:()=>{clears++;}}});
  return {live:context.WindsLive,tasks,streams,requests,paints,status,get parsed(){return parsed;},get catchups(){return catchups;},get clears(){return clears;},get authLosses(){return authLosses;},
    rooms:value=>{roomList=value;},busy:value=>{busy=value;},pause:()=>{auto=false;},advance:ms=>{now+=ms;},
    async run(delay){const task=[...tasks].find(([,v])=>v.delay===delay);assert.ok(task,'timer '+delay);tasks.delete(task[0]);await task[1].callback();}};
}
const stroke={id:'stroke',type:'stroke',tool:'pen',size:10,color:'#123456',points:[[10,10,.5],[30,40,.8]]};
const packet={id:'remote',clientId:'other-device',kind:'append',bookId:'book',pageId:'page',item:stroke};
test('input hooks only queue references and cannot start a request during active input',async()=>{
  const f=fixture();f.busy(true);f.live.start();f.live.append('book','page',stroke);f.live.changed('book','page');
  assert.equal(f.requests.length,0);assert.equal(f.streams.length,0);await f.run(0);
  assert.equal(f.requests.length,0);f.busy(false);await f.run(150);
  assert.equal(f.requests.length,1);assert.equal(f.streams.length,1);
  const body=JSON.parse(f.requests[0].options.body);assert.equal(body.kind,'append');assert.equal(body.item.id,'stroke');
});
test('received text is not parsed or painted until input is idle and never changes notebook storage',async()=>{
  const f=fixture();f.live.start();await f.run(0);f.busy(true);f.streams[0].emit('live',packet);
  await f.run(0);assert.equal(f.parsed,0);assert.equal(f.paints.length,0);
  f.busy(false);await f.run(150);assert.equal(f.parsed,1);assert.equal(f.paints[0][0].packet.item.id,'stroke');assert.equal(f.requests.length,0);
});
test('reset and expired previews request the durable Drive recovery path',async()=>{
  const f=fixture();f.live.start();await f.run(0);f.streams[0].emit('live',packet);await f.run(0);
  f.advance(31000);await f.run(1000);assert.equal(f.paints.at(-1).length,0);assert.equal(f.catchups,1);
  f.streams[0].emit('reset',{reason:'replay-gap'});await f.run(0);assert.equal(f.catchups,2);
});
test('incoming preview bursts keep the earliest scheduled flush and paint in one pass',async()=>{
  const f=fixture();f.live.start();await f.run(0);
  f.streams[0].emit('live',packet);
  const [firstTimer]=f.tasks.keys();
  for(let i=1;i<=12;i++){
    f.advance(20);
    f.streams[0].emit('live',{...packet,item:{...stroke,id:'stroke-'+i}});
  }
  assert.deepEqual([...f.tasks.keys()],[firstTimer]);
  await f.run(0);
  assert.equal(f.paints.length,1);assert.equal(f.paints[0].length,13);
});
test('logout aborts publishing, closes streams and ignores late data',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;}),f=fixture({fetchGate:gate});
  f.live.start();await f.run(0);f.live.append('book','page',stroke);const sending=f.run(150);
  for(let i=0;i<10;i++)await Promise.resolve();
  const signal=f.requests[0].options.signal;f.live.stop();assert.equal(signal.aborted,true);assert.equal(f.streams[0].closed,true);
  f.streams[0].emit('live',packet);release();await sending;assert.equal(f.paints.length,0);assert.ok(f.clears>0);
});
test('pausing automatic sync stops live transport and static hosting does not enable it',async()=>{
  const f=fixture();f.live.start();await f.run(0);f.pause();f.live.start();assert.equal(f.streams[0].closed,true);
  f.live.append('book','page',stroke);assert.equal(f.tasks.size,0);
  const staticApp=fixture({enabled:false});staticApp.live.start();staticApp.live.append('book','page',stroke);
  assert.equal(staticApp.streams.length,0);assert.equal(staticApp.requests.length,0);assert.equal(staticApp.status.hidden,true);
});
test('large strokes remain on the durable path and edits invalidate this sender previews',async()=>{
  const f=fixture();f.live.start();await f.run(0);
  f.live.append('book','page',{...stroke,points:Array.from({length:513},()=>[1,1,.5])});f.live.changed('book','page');await f.run(150);
  assert.equal(f.requests.length,0);
  f.live.append('book','page',stroke);f.live.changed('book','page');f.live.changed('book','page');await f.run(150);
  assert.equal(JSON.parse(f.requests[0].options.body).kind,'invalidate');
});

test('live streams are capped while a newly prioritized shared notebook replaces an old room',async()=>{
  const f=fixture({roomList:['shared:first','shared:second','shared:third','shared:fourth']});
  f.live.start();await f.run(0);assert.equal(f.streams.length,4);
  f.rooms(['shared:fourth','shared:first','shared:second','shared:third']);f.live.refreshRooms();await f.run(0);
  assert.equal(f.streams.filter(s=>!s.closed).length,4);
  assert.ok(f.streams.find(s=>s.url.includes('room=shared%3Athird')).closed);
  assert.ok(f.streams.some(s=>!s.closed&&s.url.includes('room=shared%3Afourth')));
});
