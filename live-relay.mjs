import {randomUUID} from 'node:crypto';
import '../native-file.js';

const MAX_PACKET=32768,TTL=60000,MAX_ROOM_BYTES=131072,MAX_EVENTS=64;
const validId=value=>typeof value==='string'&&/^[\w-]{1,200}$/.test(value);
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

// The relay retains previews in bounded process memory only. Drive remains the
// durable notebook store; a relay acknowledgement is never a backup receipt.
export function createLiveRelay({origin,authorize,fetch:request=fetch,now=Date.now}){
  const base=new URL(origin),epoch=randomUUID(),rooms=new Map(),clients=new Set(),acl=new Map(),rates=new Map();
  const encoder=new TextEncoder();let sequence=0;
  const frame=(event,data,id)=>encoder.encode(`${id?'id: '+id+'\n':''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  function prune(room){while(room.events.length&&(room.events[0].at<now()-TTL||room.bytes>MAX_ROOM_BYTES||room.events.length>MAX_EVENTS)){room.bytes-=room.events.shift().bytes;}}
  function write(client,event,data,id){
    if(client.closed)return false;
    if(client.controller.desiredSize<=0){close(client);return false;}
    try{client.controller.enqueue(frame(event,data,id));return true;}catch{close(client);return false;}
  }
  function close(client){
    if(client.closed)return;client.closed=true;clients.delete(client);client.request.signal.removeEventListener('abort',client.abort);
    try{client.controller.close();}catch{}
  }
  async function access(req,room){
    const sub=new URL(req.url).searchParams.get('account');
    if(typeof sub!=='string'||!/^\d{5,30}$/.test(sub))throw Object.assign(Error('Invalid account'),{status:400});
    const identity=await authorize(req,sub);
    if(identity.profile.sub!==sub)throw Object.assign(Error('Account mismatch'),{status:403});
    if(room==='account')return {...identity,key:'account:'+sub,room};
    const folder=room?.startsWith('shared:')?room.slice(7):'';
    if(!validId(folder)||folder.length<5)throw Object.assign(Error('Invalid room'),{status:400});
    const cacheKey=identity.sessionId+':'+sub+':'+folder;
    if((acl.get(cacheKey)||0)<=now()){
      const params=new URLSearchParams({fields:'id,mimeType,trashed,appProperties,capabilities(canEdit)'});
      const result=await request(`https://www.googleapis.com/drive/v3/files/${folder}?${params}`,{headers:{Authorization:`Bearer ${identity.accessToken}`},signal:AbortSignal.timeout(10000)});
      if(!result.ok)throw Object.assign(Error('Shared notebook access denied'),{status:result.status===401?401:403});
      const file=await result.json();
      if(file.trashed||file.mimeType!=='application/vnd.google-apps.folder'||file.appProperties?.windsNotesShared!=='1'||!file.capabilities?.canEdit)throw Object.assign(Error('Shared notebook access denied'),{status:403});
      if(acl.size>=512)acl.clear();acl.set(cacheKey,now()+5000);
    }
    return {...identity,key:'shared:'+folder,room};
  }
  function roomFor(key){
    if(!rooms.has(key)){
      if(rooms.size>=64){for(const [id,room] of rooms)if(room.touched<now()-TTL&&!([...clients].some(c=>c.key===id)))rooms.delete(id);}
      if(rooms.size>=64)throw Object.assign(Error('Relay room limit reached'),{status:429});
      rooms.set(key,{events:[],bytes:0,touched:now(),cursor:epoch+':0'});
    }
    const room=rooms.get(key);prune(room);room.touched=now();return room;
  }
  function validate(packet){
    if(!validId(packet?.id)||!validId(packet.clientId)||!validId(packet.bookId)||!validId(packet.pageId)||!['append','invalidate'].includes(packet.kind))throw Object.assign(Error('Invalid live packet'),{status:400});
    if(packet.kind==='append'){
      const item=packet.item;
      if(!item||!validId(item.id)||!['stroke','shape'].includes(item.type)||(item.type==='stroke'&&(!Array.isArray(item.points)||item.points.length>512||(item.tool==='artist'&&item.points.length>64))))throw Object.assign(Error('Live previews support small completed strokes and shapes'),{status:413});
      packet={id:packet.id,clientId:packet.clientId,bookId:packet.bookId,pageId:packet.pageId,kind:packet.kind,
        item:globalThis.WindsFile.validateShared({id:'relay-book',title:'Preview',createdAt:new Date(now()).toISOString(),updatedAt:new Date(now()).toISOString(),pages:[{id:'relay-page',items:[item]}]}).pages[0].items[0]};
    }else packet={id:packet.id,clientId:packet.clientId,bookId:packet.bookId,pageId:packet.pageId,kind:packet.kind};
    return packet;
  }
  async function handle(req){
    try{
      const url=new URL(req.url);
      if(url.origin!==base.origin||req.headers.get('Sec-Fetch-Site')==='cross-site'||(req.headers.has('Origin')&&req.headers.get('Origin')!==base.origin))return json({error:'Invalid origin'},403);
      if(!['/live/events','/live/publish'].includes(url.pathname))return json({error:'Not found'},404);
      if(url.pathname==='/live/publish'&&(req.method!=='POST'||req.headers.get('Origin')!==base.origin||req.headers.get('X-Winds-Request')!=='1'||!req.headers.get('Content-Type')?.startsWith('application/json')))return json({error:'Invalid publish request'},403);
      if(url.pathname==='/live/events'&&req.method!=='GET')return json({error:'Method not allowed'},405);
      const identity=await access(req,url.searchParams.get('room'));
      const room=roomFor(identity.key);
      if(url.pathname==='/live/publish'){
        const rateKey=identity.sessionId+':'+identity.profile.sub;
        let rate=rates.get(rateKey);if(!rate||rate.at<now()-10000){if(rates.size>=512&&!rates.has(rateKey))return json({error:'Relay busy'},429);rate={at:now(),count:0};rates.set(rateKey,rate);}
        if(++rate.count>120)return json({error:'Live rate limit exceeded'},429);
        if(Number(req.headers.get('Content-Length')||0)>MAX_PACKET)return json({error:'Packet too large'},413);
        const text=await req.text();if(Buffer.byteLength(text)>MAX_PACKET)return json({error:'Packet too large'},413);
        let packet;try{packet=validate(JSON.parse(text));}catch(error){return json({error:error.status?error.message:'Invalid live packet'},error.status||400);}
        const prior=room.events.find(e=>e.packet.clientId===packet.clientId&&e.packet.id===packet.id);
        if(prior)return json({cursor:prior.cursor,durable:false});
        const cursor=epoch+':'+(++sequence),event={packet,cursor,previous:room.cursor,at:now(),bytes:Buffer.byteLength(JSON.stringify(packet))};
        room.events.push(event);room.bytes+=event.bytes;room.cursor=cursor;prune(room);
        for(const client of [...clients])if(client.key===identity.key&&client.clientId!==packet.clientId){
          try{await access(client.request,client.room);write(client,'live',packet,cursor);}catch{write(client,'auth',{required:true});close(client);}
        }
        return json({cursor,durable:false});
      }
      const clientId=url.searchParams.get('client');if(!validId(clientId))return json({error:'Invalid client'},400);
      if(clients.size>=128||[...clients].filter(c=>c.sessionId===identity.sessionId).length>=8)return json({error:'Connection limit exceeded'},429);
      const after=url.searchParams.get('after')||req.headers.get('Last-Event-ID');
      let client;
      const stream=new ReadableStream({
        start(controller){
          client={controller,request:req,...identity,clientId,closed:false,abort:null};client.abort=()=>close(client);
          clients.add(client);req.signal.addEventListener('abort',client.abort,{once:true});
          const latest=room.cursor;
          if(after){
            const index=room.events.findIndex(e=>e.cursor===after);
            if(!after.startsWith(epoch+':')||(index<0&&after!==latest&&room.events[0]?.previous!==after))write(client,'reset',{reason:'replay-gap'},latest);
            else{
              const replay=room.events.slice(index+1).filter(event=>event.packet.clientId!==clientId);
              if(replay.length>2)write(client,'reset',{reason:'replay-gap'},latest);
              else for(const event of replay)write(client,'live',event.packet,event.cursor);
            }
          }
          write(client,'ready',{durable:false},latest);
          if(req.signal.aborted)close(client);
        },cancel(){if(client)close(client);}
      },{highWaterMark:4});
      return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'}});
    }catch(error){return json({error:error.status===401?'signed_out':error.status?'Access unavailable':'Live service temporarily unavailable'},error.status||503);}
  }
  let checking=false;
  const heartbeat=setInterval(async()=>{
    if(checking)return;checking=true;
    try{
      for(const client of [...clients]){
        try{await access(client.request,client.room);write(client,'ping',{at:now()});}
        catch(error){write(client,'auth',{required:true});close(client);}
      }
      for(const [key,room] of rooms){prune(room);if(room.touched<now()-TTL&&!([...clients].some(c=>c.key===key)))rooms.delete(key);}
      for(const [key,rate] of rates)if(rate.at<now()-10000)rates.delete(key);
    }finally{checking=false;}
  },15000);heartbeat.unref?.();
  return {handle,invalidate(sessionId,sub){for(const c of [...clients])if(c.sessionId===sessionId&&c.profile.sub===sub){write(c,'auth',{required:true});close(c);}},close(){clearInterval(heartbeat);for(const c of [...clients])close(c);rooms.clear();acl.clear();rates.clear();}};
}
