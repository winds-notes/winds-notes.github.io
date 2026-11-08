const test=require('node:test'),assert=require('node:assert/strict');
const ORIGIN='https://notes.example.test',A='1111111111',B='2222222222';
async function fixture(t){
  const {createLiveRelay}=await import('../server/live-relay.mjs');
  let now=Date.now(),allowed=true;const devices=new Map([['phone',A],['laptop',A],['other',B]]);
  const relay=createLiveRelay({origin:ORIGIN,now:()=>now,
    async authorize(req,sub){const device=req.headers.get('Cookie');if(devices.get(device)!==sub)throw Object.assign(Error('No session'),{status:401});return {sessionId:device,profile:{sub},accessToken:'test-token'};},
    async fetch(){return Response.json({mimeType:'application/vnd.google-apps.folder',appProperties:{windsNotesShared:'1'},capabilities:{canEdit:allowed}});}
  });t.after(()=>relay.close());
  const request=(device,path,options={})=>relay.handle(new Request(ORIGIN+path,{...options,headers:{Cookie:device,Origin:ORIGIN,'X-Winds-Request':'1','Content-Type':'application/json',...options.headers}}));
  async function open(device='laptop',account=A,room='account',after=''){
    const params=new URLSearchParams({account,room,client:device+'-client',...(after?{after}:{})});
    const response=await request(device,'/live/events?'+params);if(!response.ok)return {response};
    const reader=response.body.getReader();let buffer='';
    return {response,reader,async event(){while(!buffer.includes('\n\n')){const part=await reader.read();if(part.done)return null;buffer+=new TextDecoder().decode(part.value);}const split=buffer.indexOf('\n\n'),text=buffer.slice(0,split);buffer=buffer.slice(split+2);const lines=Object.fromEntries(text.split('\n').map(line=>{const i=line.indexOf(':');return [line.slice(0,i),line.slice(i+1).trim()];}));return {event:lines.event,id:lines.id,data:JSON.parse(lines.data)};}};
  }
  const packet=(id='stroke-one',clientId='phone-client')=>({id,clientId,kind:'append',bookId:'book',pageId:'page',item:{id,type:'stroke',tool:'pen',color:'#123456',size:10,points:[[10,10,.5],[30,30,.8]]}});
  const publish=(device='phone',account=A,room='account',body=packet(),extra={})=>request(device,'/live/publish?'+new URLSearchParams({account,room}),{method:'POST',body:typeof body==='string'?body:JSON.stringify(body),...extra});
  return {relay,request,open,packet,publish,devices,advance:ms=>{now+=ms;},revokeShared:()=>{allowed=false;}};
}
test('an authenticated account receives small strokes immediately without leaking them to another account',async t=>{
  const f=await fixture(t),a=await f.open(),b=await f.open('other',B);await a.event();await b.event();
  const sent=await f.publish();assert.equal(sent.status,200);assert.equal((await sent.json()).durable,false);
  assert.equal((await a.event()).data.item.id,'stroke-one');
  await f.publish('other',B,'account',f.packet('other-stroke','separate-client'));
  assert.equal((await b.event()).data.item.id,'other-stroke');
  assert.equal((await f.open('phone',B)).response.status,401);
});
test('duplicate publish retries are idempotent and reconnects replay a small missed update',async t=>{
  const f=await fixture(t),first=await f.open();const ready=await first.event();await first.reader.cancel();
  const a=await(await f.publish()).json(),b=await(await f.publish()).json();assert.equal(a.cursor,b.cursor);
  const reconnect=await f.open('laptop',A,'account',ready.id);
  assert.equal((await reconnect.event()).data.item.id,'stroke-one');assert.equal((await reconnect.event()).event,'ready');
});
test('expired replay history and a server epoch mismatch request Drive recovery',async t=>{
  const f=await fixture(t),first=await f.open();await first.event();await f.publish();const cursor=(await first.event()).id;await first.reader.cancel();
  await f.publish('phone',A,'account',f.packet('missed-before-expiry'));
  f.advance(61000);await f.publish('phone',A,'account',f.packet('newer'));
  const reconnect=await f.open('laptop',A,'account',cursor);assert.equal((await reconnect.event()).event,'reset');
  const restart=await f.open('laptop',A,'account','old-server:99');assert.equal((await restart.event()).event,'reset');
});
test('shared notebook channels verify Drive editing permission and recheck revoked access',async t=>{
  const f=await fixture(t),room='shared:folder-one',stream=await f.open('other',B,room);await stream.event();
  await f.publish('phone',A,room);assert.equal((await stream.event()).data.item.id,'stroke-one');
  f.revokeShared();f.advance(6000);
  assert.equal((await f.publish('phone',A,room,f.packet('denied'))).status,403);
  assert.equal((await f.open('other',B,room)).response.status,403);
});
test('logout invalidates the matching device stream without closing another device session',async t=>{
  const f=await fixture(t),laptop=await f.open(),phone=await f.open('phone');await laptop.event();await phone.event();
  f.devices.delete('laptop');f.relay.invalidate('laptop',A);
  assert.equal((await laptop.event()).event,'auth');assert.equal(await laptop.event(),null);
  await f.publish('phone',A,'account',f.packet('new','another-client'));
  assert.equal((await phone.event()).data.item.id,'new');
});
test('cross-origin requests, oversized payloads and unsupported media are rejected',async t=>{
  const f=await fixture(t);
  assert.equal((await f.publish('phone',A,'account',f.packet(),{headers:{Origin:'https://attacker.test'}})).status,403);
  assert.equal((await f.publish('phone',A,'account','x'.repeat(40000))).status,413);
  const packet=f.packet();packet.item={id:'image',type:'image',src:'data:image/png;base64,AAAA'};
  assert.equal((await f.publish('phone',A,'account',packet)).status,413);
  assert.equal((await f.publish('phone',A,'account',{...f.packet(),room:'account:'+B})).status,200,'routing comes from the authorized URL, not packet fields');
});
test('a slow subscriber is closed instead of buffering unlimited frames',async t=>{
  const f=await fixture(t),slow=await f.open();await slow.event();
  for(let i=0;i<8;i++)await f.publish('phone',A,'account',f.packet('stroke-'+i));
  const events=[];let event;while((event=await slow.event()))events.push(event);
  assert.ok(events.length<=4);
});
