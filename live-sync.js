/* Fast, ephemeral ink delivery. Durable saves and Drive sync remain independent. */
(function(global){
  'use strict';
  const ENABLED=global.WINDS_REALTIME_ENABLED===true,IDLE=150,MAX_BYTES=32768;
  const uuid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const clientId=uuid(),streams=new Map(),outgoing=new Map(),previews=new Map();
  let api=null,generation=0,controller=null,timer=0,dueAt=0,inbox=[],inboxBytes=0,sending=false,fresh=null,needsCatchup=false,paintNeeded=false,retryAfter=0;
  const allowed=()=>ENABLED&&typeof global.EventSource==='function'&&api?.session().profile&&api.session().auto;
  function status(){
    const el=document.getElementById('liveSyncStatus');if(!el)return;
    el.hidden=!ENABLED;
    const text=!api?.session().auto?'Live previews paused with automatic sync.':!allowed()?'Sign in to enable live handwriting previews.':[...streams.values()].some(s=>s.connected)?'Live handwriting previews connected. Drive backup saves separately.':'Live previews waiting for connection. Drive backup remains available.';
    if(el.textContent!==text)el.textContent=text;
  }
  function schedule(delay=IDLE){
    if(!allowed())return;
    const deadline=Date.now()+delay;
    // A burst of events should never push an already scheduled flush back.
    if(timer&&dueAt<=deadline)return;
    clearTimeout(timer);
    dueAt=deadline;
    timer=setTimeout(()=>{timer=0;return flush();},delay);
  }
  function roomFor(bookId){return api.bridge.room(bookId);}
  function receive(type,event,room,version){
    if(version!==generation||!allowed())return;
    const data=event.data||'';
    if(inbox.length>=64||inboxBytes+data.length>262144){inbox=[];inboxBytes=0;previews.clear();needsCatchup=true;paintNeeded=true;}
    else{inbox.push({type,data,room,cursor:event.lastEventId,version});inboxBytes+=data.length;}
    schedule(0);
  }
  function open(room){
    const record=streams.get(room);if(!record||record.source||api.bridge.busy(IDLE))return;
    const s=api.session(),version=generation;
    const params=new URLSearchParams({account:s.profile.sub,room,client:clientId});if(record.cursor)params.set('after',record.cursor);
    const source=new global.EventSource('/live/events?'+params,{withCredentials:true});record.source=source;
    source.onopen=()=>{if(version===generation){record.connected=true;record.retries=0;status();}};
    for(const type of ['live','ready','reset','auth'])source.addEventListener(type,event=>receive(type,event,room,version));
    source.onerror=()=>{source.close();record.source=null;record.connected=false;record.retryAt=Date.now()+Math.min(30000,1000*2**Math.min(5,record.retries++));status();schedule(1000);};
  }
  function refreshRooms(){
    if(!allowed())return;
    const rooms=new Set(['account',...api.bridge.rooms()].slice(0,4));
    for(const [room,record] of streams)if(!rooms.has(room)){record.source?.close();streams.delete(room);}
    for(const room of rooms)if(!streams.has(room))streams.set(room,{source:null,connected:false,retries:0,retryAt:0,cursor:''});
    schedule(0);
  }
  async function flush(){
    if(!allowed())return;
    if(api.bridge.busy(IDLE)){schedule();return;}
    const version=generation;
    for(const [room,record] of streams)if(!record.source&&record.retryAt<=Date.now())open(room);
    while(inbox.length){
      if(api.bridge.busy(IDLE)){schedule();return;}
      const event=inbox.shift();inboxBytes-=event.data.length;if(event.version!==generation)continue;
      let packet;try{packet=JSON.parse(event.data);}catch{needsCatchup=true;continue;}
      if(event.type==='auth'){stop();api.authLost();return;}
      if(event.type==='reset'){previews.clear();needsCatchup=true;paintNeeded=true;}
      if(event.type==='live'){
        if(packet.kind==='invalidate'){
          for(const [id,p] of previews)if(p.packet.clientId===packet.clientId&&p.packet.bookId===packet.bookId&&p.packet.pageId===packet.pageId)previews.delete(id);
        }else if(packet.kind==='append'&&packet.item){
          const key=packet.clientId+':'+packet.item.id;
          if(previews.size>=128)previews.delete(previews.keys().next().value);
          previews.set(key,{packet,room:event.room,expires:Date.now()+30000});
        }
        paintNeeded=true;
      }
      const record=streams.get(event.room);if(record&&event.cursor)record.cursor=event.cursor;
    }
    for(const [id,preview] of previews)if(preview.expires<Date.now()){previews.delete(id);paintNeeded=true;needsCatchup=true;}
    if(paintNeeded){api.bridge.paint([...previews.values()]);paintNeeded=false;}
    if(needsCatchup){needsCatchup=false;api.catchup();}
    if(!sending&&outgoing.size&&Date.now()>=retryAfter){
      sending=true;
      try{
        for(const [id,pending] of outgoing){
          if(version!==generation||api.bridge.busy(IDLE))break;
          const room=roomFor(pending.bookId);if(!room){outgoing.delete(id);continue;}
          const payload={...pending,clientId};
          const text=JSON.stringify(payload);if(new Blob([text]).size>MAX_BYTES){outgoing.delete(id);continue;}
          const params=new URLSearchParams({account:api.session().profile.sub,room});
          const response=await fetch('/live/publish?'+params,{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,
            headers:{'Content-Type':'application/json','X-Winds-Request':'1'},body:text});
          if(version!==generation)return;
          if(response.status===401){stop();api.authLost();return;}
          if(!response.ok)throw Error('Live relay unavailable');
          outgoing.delete(id);
        }
      }catch{if(version===generation)retryAfter=Date.now()+3000;}
      finally{if(version===generation)sending=false;}
    }
    if(version===generation&&(inbox.length||outgoing.size||previews.size||[...streams.values()].some(s=>!s.source)))schedule(outgoing.size?Math.max(IDLE,retryAfter-Date.now()):1000);
  }
  function append(bookId,pageId,item){
    if(!allowed())return;
    fresh={bookId,pageId};
    if(!['stroke','shape'].includes(item.type)||(item.type==='stroke'&&(item.points.length>512||(item.tool==='artist'&&item.points.length>64))))return;
    if(outgoing.size>=64)outgoing.delete(outgoing.keys().next().value);
    const id=uuid();outgoing.set(id,{id,kind:'append',bookId,pageId,item});schedule();
  }
  function changed(bookId,pageId){
    if(!allowed()||!bookId||!pageId)return;
    if(fresh?.bookId===bookId&&fresh.pageId===pageId){fresh=null;schedule();return;}
    for(const [id,p] of outgoing)if(p.bookId===bookId&&p.pageId===pageId)outgoing.delete(id);
    const id=uuid();outgoing.set(id,{id,kind:'invalidate',bookId,pageId});schedule();
  }
  function render(){if(allowed()){paintNeeded=true;schedule();}}
  function start(){if(!allowed()){stop();status();return;}if(!controller)controller=new AbortController();refreshRooms();status();}
  function stop(){generation++;controller?.abort();controller=null;clearTimeout(timer);timer=0;for(const s of streams.values())s.source?.close();streams.clear();outgoing.clear();previews.clear();inbox=[];inboxBytes=0;sending=false;fresh=null;paintNeeded=false;needsCatchup=false;retryAfter=0;api?.bridge.clear();status();}
  function init(adapter){api=adapter;status();}
  global.WindsLive=Object.freeze({init,start,stop,append,changed,render,refreshRooms});
})(window);
