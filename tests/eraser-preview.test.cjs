const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create}=require('../eraser-preview.js');
function fixture({blocked=false,clock=()=>0}={}){
 const calls=[],baseCalls=[],ctx=new Proxy({},{get:(target,name)=>name in target?target[name]:(...args)=>baseCalls.push([name,...args]),set:(target,name,value)=>{target[name]=value;return true;}});
 const canvas={width:1,height:1,getContext:()=>blocked?null:ctx};
 const image={id:'image',type:'image',x:100,y:100,w:300,h:200,src:'data:image/png;base64,AAAA'},ink={id:'ink',type:'stroke',tool:'pen',size:7,points:[[100,100,.5],[300,100,.7]]};
 const bounds=item=>item.type==='stroke'?{x:96,y:96,w:208,h:8}:{x:item.x,y:item.y,w:item.w,h:item.h};
 const engine=create({makeCanvas:()=>canvas,bounds,visualBounds:bounds,localPoint:(item,p)=>p,now:clock});
 const key={scope:{account:'a',book:'b',page:'p'},revision:0,width:840,height:1188,inkOnly:false};let prepared=0;
 const prepare=(next=key,items=[image,ink])=>engine.prepare(next,items,()=>{prepared++;});
 const target=new Proxy({},{get:(o,name)=>o[name]||((...args)=>calls.push([name,...args])),set:(o,name,value)=>{o[name]=value;return true;}});
 return {engine,key,image,ink,canvas,prepare,target,calls,prepared:()=>prepared};
}
test('live erasing paints clipped local patches before gesture completion without changing notebook objects',()=>{
 const f=fixture(),before=JSON.stringify([f.image,f.ink]);assert.ok(f.prepare());const gesture={radius:20};assert.ok(f.engine.begin(gesture,f.key));f.engine.add(gesture,{x:150,y:100});f.engine.add(gesture,{x:180,y:100});f.engine.paint(f.target,f.key.scope);
 assert.equal(f.calls.filter(c=>c[0]==='drawImage').length,2);assert.ok(f.calls.some(c=>c[0]==='clip'));assert.ok(f.calls.filter(c=>c[0]==='drawImage').every(c=>c[8]<100&&c[9]<100));assert.equal(f.prepared(),1);assert.equal(JSON.stringify([f.image,f.ink]),before);assert.equal(f.engine.effective(f.image).erasures.length,1);assert.equal(f.engine.effective(f.ink).erasures.length,1);
});
test('live frames never call serialization, storage, network, full-page painting or object-bound scans',()=>{
 let scans=0,painting=0;const source=fs.readFileSync(require.resolve('../eraser-preview.js'),'utf8'),ctx=new Proxy({},{get:()=>()=>{},set:()=>true}),context={performance:{now:()=>0},JSON:{stringify(){throw Error('Serialization in frame');}},fetch(){throw Error('Network in frame');}};vm.runInNewContext(source,context);
 const item=Object.freeze({id:'ink',type:'stroke'}),engine=context.WindsEraserPreview.create({makeCanvas:()=>({width:1,height:1,getContext:()=>ctx}),bounds:()=>{scans++;return {x:0,y:0,w:500,h:500};},visualBounds:()=>({x:0,y:0,w:500,h:500}),localPoint:(item,p)=>p,now:()=>0}),key={scope:{account:'a',book:'b',page:'p'},revision:0,width:840,height:1188,inkOnly:false};
 engine.prepare(key,[item],()=>painting++);const initialScans=scans,g={radius:10};engine.begin(g,key);for(let i=0;i<40;i++)engine.add(g,{x:20+i,y:20});engine.paint(ctx,key.scope);assert.equal(scans,initialScans);assert.equal(painting,1);assert.ok(!item.erasures);
});
test('later writing is never erased by delayed preview frames and new objects receive no old masks',()=>{
 const f=fixture();f.prepare();const g={radius:20};f.engine.begin(g,f.key);f.engine.add(g,{x:150,y:100});f.engine.paint(f.target,f.key.scope);const count=f.calls.length;f.engine.stopPainting();f.engine.add(g,{x:180,y:100});f.engine.paint(f.target,f.key.scope);assert.equal(f.calls.length,count);
 const fresh={...f.ink,id:'new-ink'};assert.equal(f.engine.effective(fresh),fresh);assert.equal(f.engine.effective({...f.image,x:200}).erasures,undefined);assert.equal(f.engine.effective({...f.image,erasures:[{rx:.1,ry:.1,points:[[0,0]]}]}).erasures.length,2);
});
test('full repaint sees temporary masks without losing or permanently storing them',()=>{
 const f=fixture();f.prepare();const g={radius:20};f.engine.begin(g,f.key);f.engine.add(g,{x:150,y:100});f.engine.add(g,{x:180,y:100});f.engine.beforeRender();assert.equal(f.calls.length,0);assert.equal(f.engine.effective(f.image).erasures.length,1);assert.ok(!f.image.erasures);assert.ok(f.engine.complete(g));assert.equal(f.engine.effective(f.image),f.image);assert.ok(!f.engine.hasWork());
});
test('ink-only preview preserves image objects and a scope change clears transient masks',()=>{
 const f=fixture(),key={...f.key,inkOnly:true};f.prepare(key);const g={radius:20};f.engine.begin(g,key);f.engine.add(g,{x:150,y:100});f.engine.paint(f.target,key.scope);assert.equal(f.engine.effective(f.image),f.image);assert.ok(f.engine.effective(f.ink).erasures);
 const other={...key,scope:{account:'other',book:'b',page:'p'}};assert.equal(f.engine.begin({radius:20},other),false);f.prepare(other);assert.equal(f.engine.effective(f.ink),f.ink);assert.equal(f.engine.has(g),false);
});
test('fast gestures share a prepared cache, frames have a bounded work budget and transient points stay bounded',()=>{
 let time=0;const f=fixture({clock:()=>time++});f.prepare();const g={radius:20};f.engine.begin(g,f.key);for(let i=0;i<80;i++)f.engine.add(g,{x:150+i*.1,y:100});f.engine.paint(f.target,f.key.scope);assert.ok(f.engine.hasWork());assert.ok(f.calls.filter(c=>c[0]==='drawImage').length<=4);while(f.engine.hasWork())f.engine.paint(f.target,f.key.scope);assert.equal(f.prepared(),1);
 for(let i=0;i<3000;i++)f.engine.add(g,{x:200,y:100});while(f.engine.hasWork())f.engine.paint(f.target,f.key.scope);assert.ok(f.engine.effective(f.image).erasures.every(mask=>mask.points.length<=2048));
});
test('preview allocation failure falls back without disabling the durable eraser',()=>{
 const f=fixture({blocked:true});assert.equal(f.prepare(),false);assert.equal(f.engine.begin({radius:20},f.key),false);assert.equal(f.canvas.width,1);assert.equal(f.canvas.height,1);assert.equal(f.engine.effective(f.image),f.image);
});
test('two-finger zoom discards accidental finger-eraser previews without discarding a Pencil gesture',()=>{
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),helper=source.slice(source.indexOf('  function pointerDown('),source.indexOf('  function updateShapeDraft('));
 for(const type of ['touch','pen']){
  let cancelled=0,rendered=0;const gesture={kind:'erase',pointerType:type,pointerId:1},context={state:{editingText:null,lastPenAt:0,drag:gesture,pointers:new Map([[1,{x:100,y:100}]]),pinch:null,zoom:1},page:()=>({}),Date:{now:()=>100000},PALM_GUARD_MS:2400,
   $:()=>({getBoundingClientRect:()=>({left:0,top:0,width:840,height:1188}),classList:{remove(){}}}),eraserPreview:{complete:g=>{assert.equal(g,gesture);cancelled++;}},renderCanvas(){rendered++;}};
  vm.runInNewContext(helper,context);context.pointerDown({pointerType:'touch',pointerId:2,clientX:200,clientY:200,currentTarget:{setPointerCapture(){}},cancelable:true,preventDefault(){}});
  if(type==='touch'){assert.equal(cancelled,1);assert.equal(rendered,1);assert.ok(context.state.pinch);assert.equal(context.state.drag,null);}else{assert.equal(cancelled,0);assert.equal(rendered,0);assert.equal(context.state.drag,gesture);assert.equal(context.state.pinch,null);}
 }
});
test('active eraser frames clear only the previous cursor bounds rather than the full ink canvas',()=>{
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),helper=source.slice(source.indexOf('  function queueInteractionOverlay('),source.indexOf('  function drawInteractionOverlay(')),frames=[],clears=[];
 const state={drag:{kind:'erase',radius:20,points:[{x:100,y:100}]}};
 const context={state,interactionRAF:0,bufferedPenItems:[],eraserPreview:null,requestAnimationFrame:callback=>{frames.push(callback);return 1;},inkContext:()=>({clearRect:(...args)=>clears.push(args)}),drawSelection(){},handleSize:()=>8,clearInk(){throw Error('Full ink-canvas clear during erasing');}};
 vm.runInNewContext(helper,context);context.queueInteractionOverlay();frames.shift()();state.drag.points.push({x:110,y:100});context.queueInteractionOverlay();frames.shift()();assert.equal(clears.length,1);assert.equal(clears[0][2],60);assert.equal(clears[0][3],60);
});
