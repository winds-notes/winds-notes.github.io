const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const fs=require('node:fs'),creative=require('../creative-tools.js'),interactions=require('../interaction-tools.js');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
function surface(){
 const calls=[],ctx=new Proxy({calls},{get:(o,k)=>o[k]||((...args)=>calls.push([k,...args])),set:(o,k,v)=>{o[k]=v;return true;}});
 const c={_w:1,_h:1,get width(){return this._w;},set width(v){this._w=v;assert.ok(this._w*this._h<=4194304);},get height(){return this._h;},set height(v){this._h=v;assert.ok(this._w*this._h<=4194304);},getContext:()=>ctx};return {canvas:c,ctx,calls};
}
test('cached dragging paints only swept patches and preserves layer order without rescanning page objects',()=>{
 const {create}=require('../selection-preview.js'),surfaces=[],drawn=[];let backgrounds=0,bounds=0;
 const a={id:'below',type:'image',x:5,y:5,w:10,h:10},item={id:'moving',type:'image',x:40,y:50,w:100,h:80,rotation:30},b={id:'above',type:'image',x:50,y:60,w:10,h:10};
 const engine=create({makeCanvas:()=>{const s=surface();surfaces.push(s);return s.canvas;},background:()=>backgrounds++,draw:(ctx,i)=>drawn.push(i.id),bounds:i=>{bounds++;return {x:i.x-2,y:i.y-2,w:i.w+4,h:i.h+4};},rotate(){},rect:creative.objectRect});
 const before=JSON.stringify([a,item,b]);assert.equal(engine.prepare({items:[a,item,b]},item,840,1188),true);
 assert.deepEqual(drawn,['below','above','moving']);const initial=bounds,target=surface();
 for(let i=0;i<20;i++)engine.paint(target.ctx,{...item,x:item.x+i,y:item.y+i},i,i);
 assert.equal(backgrounds,1);assert.equal(bounds,initial);assert.equal(drawn.length,3);assert.equal(JSON.stringify([a,item,b]),before);
 const images=target.calls.filter(c=>c[0]==='drawImage');assert.equal(images.length,60);
 assert.equal(images[0][1],surfaces[0].canvas);assert.equal(images[1][1],surfaces[2].canvas);assert.equal(images[2][1],surfaces[1].canvas);
 assert.ok(images.filter((_,i)=>i%3===0).every(c=>c[8]<200&&c[9]<200));
 engine.release();assert.ok(surfaces.every(s=>s.canvas.width===1&&s.canvas.height===1));
});
test('a preview allocation failure releases surfaces and leaves durable editing available',()=>{
 const c={width:1,height:1,getContext:()=>null},item={},engine=require('../selection-preview.js').create({makeCanvas:()=>c});
 assert.equal(engine.prepare({items:[item]},item,840,1188),false);assert.equal(c.width,1);assert.equal(c.height,1);
});
function draftEditor(){
 const original={id:'image',type:'image',x:40,y:50,w:100,h:80,src:'data:image/png;base64,AAAA'},p={items:[original]},frames=new Map();let id=0,prepared=0,painted=0;
 const state={selected:0,tool:'select',drag:null,pinch:null,pointers:new Map(),selectionEpoch:1},rect={left:0,top:0,width:840,height:1188};
 const ctx={state,W:840,H:1188,RENDER_SCALE:2,CREATIVE:creative,interactions,window:null,page:()=>p,selectionBounds:creative.objectRect,resizable:i=>['image','sticker','shape'].includes(i?.type),clipboardContext:()=>({account:'a',book:'b',page:'p'}),clipboardMatches:()=>true,
  requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key),setTimeout(){},
  clearInk(){},drawSelection(){},inkContext:()=>surface().ctx,updateSelectionActions(){},rotationPaintBounds:creative.objectRect,
  drawTemplate(){},drawPdfBackground(){},drawItem(){},$:()=>({getContext:()=>surface().ctx}),document:{createElement:()=>surface().canvas},
  clone(){throw Error('Cloning in pointer callbacks');},remember(){throw Error('History in pointer callbacks');},renderCanvas(){throw Error('Full page redraw in pointer callbacks');},
  WindsSelectionPreview:{create:()=>({prepare:()=>{prepared++;return true;},paint:()=>{painted++;return true;},release(){}})}};
 ctx.window=ctx;
 vm.runInNewContext(app.slice(app.indexOf('  function beginSelectionTransform('),app.indexOf('  function pointerDown(')),ctx);
 vm.runInNewContext(app.slice(app.indexOf('  function resizeObject('),app.indexOf('  const distToSegment=')),ctx);
 return {ctx,state,original,p,rect,frames,flush(){const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn());},counts:()=>({prepared,painted})};
}
test('drag samples coalesce to one frame and do not mutate or serialize the selected image',()=>{
 const e=draftEditor(),before=JSON.stringify(e.p);
 e.ctx.beginSelectionTransform({pointerId:1,pointerType:'pen'},e.rect,{x:70,y:70},'select');
 e.ctx.updateSelectionTransform(e.state.drag,{x:71,y:71});assert.equal(e.state.drag.changed,false);
 for(let i=0;i<100;i++)e.ctx.updateSelectionTransform(e.state.drag,{x:70+i,y:70+i});
 assert.equal(e.frames.size,1);assert.equal(JSON.stringify(e.p),before);e.flush();
 assert.deepEqual(e.counts(),{prepared:1,painted:1});assert.equal(e.state.selectionTransform.preview.x,139);assert.equal(JSON.stringify(e.p),before);
 e.ctx.updateSelectionTransform(e.state.drag,{x:180,y:180});e.flush();assert.deepEqual(e.counts(),{prepared:1,painted:2});
});
test('late selection frames cannot paint a different account or page',()=>{
 const e=draftEditor();e.ctx.beginSelectionTransform({pointerId:1,pointerType:'pen'},e.rect,{x:70,y:70},'select');e.ctx.updateSelectionTransform(e.state.drag,{x:100,y:100});e.ctx.clipboardMatches=()=>false;e.flush();assert.deepEqual(e.counts(),{prepared:0,painted:0});
});
test('resizing remains a draft with preserved image aspect ratio until commit',()=>{
 const e=draftEditor();e.ctx.beginSelectionTransform({pointerId:1,pointerType:'pen'},e.rect,{x:140,y:130},'resize','se');e.ctx.updateSelectionTransform(e.state.drag,{x:240,y:210});e.flush();
 assert.equal(e.original.w,100);assert.equal(e.original.h,80);assert.equal(e.state.selectionTransform.preview.w,200);assert.equal(e.state.selectionTransform.preview.h,160);
});

test('lost Pencil or mouse release commits the sampled transform while a cancelled finger drag rolls back',()=>{
 for(const type of ['pen','mouse','touch']){
  const e=draftEditor(),jobs=[];let cancelled=0;
  e.ctx.beginSelectionTransform({pointerId:1,pointerType:type},e.rect,{x:70,y:70},'select');e.ctx.updateSelectionTransform(e.state.drag,{x:100,y:100});
  e.ctx.deferInteraction=gesture=>jobs.push(gesture);e.ctx.endSelectionTransform=()=>{cancelled++;};
  vm.runInNewContext(app.slice(app.indexOf('  function finishPointer('),app.indexOf('  function pointerUp(')),e.ctx);
  e.ctx.finishPointer({pointerId:1},true);assert.equal(e.state.drag,null);assert.equal(jobs.length,type==='touch'?0:1);assert.equal(cancelled,type==='touch'?1:0);assert.equal(e.p.items[0],e.original);
 }
});

test('stale capture loss cannot cancel a newer selection and active selection capture can recover',()=>{
 for(const retained of [true,false]){
  let capture=retained,ended=0,requests=0;const drag={kind:'select',pointerId:1},context={state:{drag},finishPointer(){ended++;}};
  vm.runInNewContext(app.slice(app.indexOf('  function pointerLostCapture('),app.indexOf('  function finishActiveStroke(')),context);
  context.pointerLostCapture({pointerId:1,currentTarget:{hasPointerCapture:()=>capture,setPointerCapture(){requests++;capture=true;}}});
  assert.equal(ended,0);assert.equal(context.state.drag,drag);assert.equal(requests,retained?0:1);
 }
 let ended=0;const context={state:{drag:{kind:'draw',pointerId:1}},finishPointer(){ended++;}};
 vm.runInNewContext(app.slice(app.indexOf('  function pointerLostCapture('),app.indexOf('  function finishActiveStroke(')),context);context.pointerLostCapture({pointerId:1});assert.equal(ended,1,'handwriting keeps its established recovery path');
 context.state.drag={kind:'rotate',pointerId:1};context.pointerLostCapture({pointerId:1});assert.equal(ended,1,'the canvas cannot finish a contact owned by the rotation handle');
});
test('stylus preference defaults remain available and an explicit finger-input choice survives reload',()=>{
 const store=new Map(),box={},state={penOnly:true};const context={state,$:()=>box,localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)}};
 vm.runInNewContext(app.slice(app.indexOf('  function restoreInputPreferences('),app.indexOf('  function restoreEraserPreferences(')),context);
 context.restoreInputPreferences();assert.equal(state.penOnly,true);assert.equal(box.checked,true);
 state.penOnly=false;context.persistInputPreferences();state.penOnly=true;context.restoreInputPreferences();assert.equal(state.penOnly,false);assert.equal(box.checked,false);
 store.set('winds-notes-input-preferences-v1','invalid');state.penOnly=true;assert.doesNotThrow(()=>context.restoreInputPreferences());assert.equal(box.checked,true);
});

function commitEditor(){
 const e=draftEditor(),h={undo:[],redo:[]};let saves=0,cleanups=0;
 Object.assign(e.ctx,{state:e.state,eraserPreview:null,imageCropSession:null,saveVersion:0,groupSelection:null,interactionQueue:Promise.resolve(),
  delay:async()=>{},inputBusy:()=>Boolean(e.state.drag),interactionIdle:async()=>{},composeInkNow(){},
  historyForPage:()=>h,remember(){h.undo.push({items:structuredClone(e.p.items)});h.redo=[];},updateHistoryButtons(){},
  renderCanvas(){},renderThumbs(){},scheduleSave(){saves++;e.ctx.saveVersion++;},queueInteractionOverlay(){},queueEraserPreparation(){},endSelectionTransform(){cleanups++;},toast(){}});
 e.state.pendingInteractions=0;
 vm.runInNewContext(app.slice(app.indexOf('  function commitDeferredItems('),app.indexOf('  function initPageStack(')),e.ctx);
 return {...e,h,counts:()=>({saves,cleanups})};
}
test('a completed object move commits once, preserves new ink and masks, and records one undo snapshot',async()=>{
 const e=commitEditor(),original={id:'ink',type:'stroke',tool:'artist',grade:'6B',size:7,color:'#123456',points:[[10,20,.3],[30,40,.8]],erasures:[{rx:.1,ry:.1,points:[[.5,.5]]}]};
 e.p.items=[original];const gesture={kind:'select',original,scope:e.ctx.clipboardContext(),dx:30,dy:40,epoch:1};
 e.ctx.deferInteraction(gesture);assert.equal(e.p.items[0],original);assert.equal(e.h.undo.length,0);
 const fresh={id:'fresh',type:'text',text:'New',x:1,y:2};e.p.items.push(fresh);await e.ctx.interactionQueue;
 assert.deepEqual(Array.from(e.p.items[0].points,p=>Array.from(p)),[[40,60,.3],[60,80,.8]]);assert.equal(e.p.items[0].grade,'6B');assert.equal(e.p.items[0].erasures,original.erasures);assert.equal(e.p.items[1],fresh);
 assert.equal(e.h.undo.length,1);assert.deepEqual(e.h.undo[0].items[0].points,original.points);assert.equal(e.state.pendingInteractions,0);assert.deepEqual(e.counts(),{saves:1,cleanups:1});
});
test('queued moves preserve both deltas and account changes cancel pending transforms',async()=>{
 const e=commitEditor(),original=e.original,base={kind:'select',original,scope:e.ctx.clipboardContext(),dy:0,epoch:1};
 e.ctx.deferInteraction({...base,dx:20});e.ctx.deferInteraction({...base,dx:30});await e.ctx.interactionQueue;assert.equal(e.p.items[0].x,90);assert.equal(e.h.undo.length,2);
 const other=commitEditor();other.ctx.deferInteraction({...base,original:other.original,dx:50});other.ctx.clipboardMatches=()=>false;await other.ctx.interactionQueue;assert.equal(other.p.items[0],other.original);assert.equal(other.h.undo.length,0);assert.equal(other.state.pendingInteractions,0);
});
test('stylus-only still permits mouse selection while a finger contact pans',()=>{
 for(const type of ['mouse','touch']){
  const e=draftEditor();e.state.penOnly=true;e.state.lastPenAt=0;e.ctx.PALM_GUARD_MS=2400;
  e.ctx.$=()=>({getBoundingClientRect:()=>e.rect});e.ctx.point=ev=>({x:ev.clientX,y:ev.clientY});e.ctx.clampPoint=p=>p;
  e.ctx.activeGroup=()=>null;e.ctx.composeInkNow=()=>{};e.ctx.resizeHit=()=>null;e.ctx.hitTest=()=>0;
  vm.runInNewContext(app.slice(app.indexOf('  function pointerDown('),app.indexOf('  function updateShapeDraft(')),e.ctx);
  e.ctx.pointerDown({pointerType:type,pointerId:1,button:0,clientX:80,clientY:80,cancelable:true,preventDefault(){},currentTarget:{setPointerCapture(){}}});
  assert.equal(e.state.drag.kind,type==='mouse'?'select':'pan');assert.equal(e.p.items[0],e.original);
 }
});
test('Select can leave a handwriting group and select a different object',()=>{
 const e=draftEditor();e.state.penOnly=true;e.state.lastPenAt=0;e.ctx.PALM_GUARD_MS=2400;e.ctx.WindsInteractions=interactions;
 e.ctx.$=()=>({getBoundingClientRect:()=>e.rect});e.ctx.point=ev=>({x:ev.clientX,y:ev.clientY});e.ctx.clampPoint=p=>p;
 e.ctx.activeGroup=()=>({bounds:{x:0,y:0,w:10,h:10}});e.ctx.composeInkNow=()=>{};e.ctx.resizeHit=()=>null;e.ctx.hitTest=()=>0;e.ctx.groupSelection={};
 vm.runInNewContext(app.slice(app.indexOf('  function pointerDown('),app.indexOf('  function updateShapeDraft(')),e.ctx);
 e.ctx.pointerDown({pointerType:'mouse',pointerId:1,button:0,clientX:80,clientY:80,cancelable:true,preventDefault(){},currentTarget:{setPointerCapture(){}}});
 assert.equal(e.state.drag.kind,'select');assert.equal(e.ctx.groupSelection,null);
});
test('selection hit distance stays constant on screen when zoomed, and diagonal bounding boxes do not steal hits',()=>{
 let width=840;const line={type:'shape',kind:'line',id:'line',x:0,y:0,w:100,h:100,size:2},image={type:'image',id:'image',x:70,y:10,w:25,h:25};
 const items=[image,line],context={CREATIVE:creative,W:840,page:()=>({items}),$:()=>({getBoundingClientRect:()=>({width})}),selectionBounds:creative.objectRect,itemBounds:creative.objectRect};
 vm.runInNewContext(app.slice(app.indexOf('  const distToSegment='),app.indexOf('  function point(')),context);
 assert.equal(context.hitTest(80,20),0);
 items.splice(0,items.length,{...line,w:100,h:0});assert.equal(context.hitTest(50,6),0);width=6720;assert.equal(context.hitTest(50,6),-1);assert.equal(context.hitTest(50,1),0);
});
