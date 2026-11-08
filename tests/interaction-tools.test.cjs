const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const geometry=require('../interaction-tools.js');
const ink={id:'ink',type:'stroke',tool:'artist',grade:'6B',size:7,points:[[10,10,.2],[110,10,.8]]};
test('area selection normalizes reverse drags and includes complete stroke bounds',()=>{
 const box=geometry.rect({x:120,y:30},{x:0,y:0});assert.deepEqual(box,{x:0,y:0,w:120,h:30});assert.ok(geometry.contains(box,{x:6,y:6,w:108,h:8}));assert.ok(!geometry.contains(box,{x:110,y:6,w:40,h:8}));
});
test('eraser sweep catches contacts between sparse pointer samples and honors diameter',()=>{
 const bounds={x:6,y:6,w:108,h:8};assert.ok(geometry.eraseHit(ink,[{x:60,y:-40},{x:60,y:40}],2,bounds,3.5));
 assert.ok(!geometry.eraseHit(ink,[{x:50,y:35}],4,bounds,3.5));assert.ok(geometry.eraseHit(ink,[{x:50,y:35}],28,bounds,3.5));
 assert.ok(geometry.eraseHit({...ink,points:[[10,10,.5]]},[{x:10,y:10}],2,bounds,3.5));
});
test('ink-only erasing protects text and images, optional all-objects erases touched content',()=>{
 const item={type:'image'},bounds={x:0,y:0,w:100,h:100},path=[{x:50,y:50}];assert.ok(!geometry.eraseHit(item,path,10,bounds,0,true));assert.ok(geometry.eraseHit(item,path,10,bounds,0,false));assert.ok(!geometry.eraseHit(item,[{x:150,y:150}],10,bounds,0,false));
});
test('moving handwriting retains pressure, identity and artist metadata without changing originals',()=>{
 const before=JSON.stringify(ink),moved=geometry.translate([ink],20,30)[0];assert.equal(JSON.stringify(ink),before);assert.equal(moved.id,ink.id);assert.equal(moved.grade,'6B');assert.deepEqual(moved.points,[[30,40,.2],[130,40,.8]]);
});
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
function deferredEditor(){
 let release;const idle=new Promise(r=>release=r),p={id:'p',items:[structuredClone(ink)]};let changed=0,rendered=0,snapshots=0;
 const state={tool:'eraser',pendingInteractions:0,lastPenAt:0,selected:-1},history={undo:[],redo:[]};
 const context={eraserPreview:null,queueEraserPreparation(){},state,Promise,console,Set,Map,saveVersion:0,groupSelection:null,historyForPage:()=>history,updateHistoryButtons(){},CREATIVE:require('../creative-tools.js'),interactions:geometry,clipboardMatches:()=>true,page:()=>p,interactionQueue:Promise.resolve(),interactionIdle:()=>idle,
  delay:async()=>{},itemBounds:()=>({x:6,y:6,w:108,h:8}),clipboardBounds:()=>({x:6,y:6,w:108,h:8}),composeInkNow(){},remember(){snapshots++;},scheduleSave(){changed++;},renderCanvas(){rendered++;},renderThumbs(){},queueInteractionOverlay(){},toast(){}};
 vm.runInNewContext(app.slice(app.indexOf('  function commitDeferredItems('),app.indexOf('  function initPageStack(')),context);
 return {context,state,p,release,counts:()=>({changed,rendered,snapshots})};
}
test('eraser waits for idle, preserves a new stroke, and commits one undoable change',async()=>{
 const e=deferredEditor(),original=e.p.items[0];e.context.deferInteraction({kind:'erase',scope:{},originals:[original],points:[{x:30,y:10}],radius:14,inkOnly:true});
 assert.equal(e.state.pendingInteractions,1);assert.deepEqual(e.counts(),{changed:0,rendered:0,snapshots:0});const fresh={...structuredClone(ink),id:'fresh'};e.p.items.push(fresh);e.release();await e.context.interactionQueue;
 assert.equal(e.p.items.length,2);assert.equal(e.p.items[1],fresh);assert.equal(e.p.items[0].id,original.id);assert.equal(e.p.items[0].erasures.length,1);assert.deepEqual(e.p.items[0].points,original.points);assert.deepEqual(e.counts(),{changed:1,rendered:1,snapshots:1});assert.equal(e.state.pendingInteractions,0);
});
test('an account or page change cancels a deferred eraser without touching the new workspace',async()=>{
 const e=deferredEditor();e.context.deferInteraction({kind:'erase',scope:{},originals:e.p.items.slice(),points:[{x:30,y:10}],radius:14,inkOnly:true});e.context.clipboardMatches=()=>false;e.release();await e.context.interactionQueue;
 assert.equal(e.p.items.length,1);assert.deepEqual(e.counts(),{changed:0,rendered:0,snapshots:0});assert.equal(e.state.pendingInteractions,0);
});
test('moving an area selection records one snapshot and leaves unselected content in place',async()=>{
 const e=deferredEditor(),original=e.p.items[0],other={...structuredClone(ink),id:'other'};e.p.items.push(other);let selected;
 e.context.selectGroup=items=>{selected=items;};e.context.deferInteraction({kind:'areaMove',scope:{},group:{ids:new Set([original.id])},dx:30,dy:40});assert.equal(e.p.items[0],original);e.release();await e.context.interactionQueue;
 assert.deepEqual(Array.from(e.p.items[0].points,p=>Array.from(p)),[[40,50,.2],[140,50,.8]]);assert.equal(e.p.items[1],other);assert.equal(selected.length,1);assert.deepEqual(e.counts(),{changed:1,rendered:1,snapshots:1});
});

test('a delayed area selection cannot replace a newer item selection',async()=>{
 const e=deferredEditor();let selected=0;e.state.tool='select';e.state.selectionEpoch=2;e.context.selectGroup=()=>{selected++;};
 e.context.deferInteraction({kind:'area',scope:{},epoch:1,start:{x:0,y:0},end:{x:120,y:30}});e.release();await e.context.interactionQueue;
 assert.equal(selected,0);assert.deepEqual(e.counts(),{changed:0,rendered:0,snapshots:0});assert.equal(e.state.pendingInteractions,0);
});
test('long-stroke erasing yields within a bounded amount of geometry work',async()=>{
 let pauses=0;const long={...ink,points:Array.from({length:10000},(_,i)=>[i*.01,100,.5])};
 assert.equal(await geometry.eraseHitAsync(long,[{x:5,y:0}],4,{x:0,y:0,w:110,h:110},3,true,async()=>{pauses++;}),false);assert.ok(pauses>=4);
 await assert.rejects(geometry.eraseHitAsync(long,[{x:5,y:0}],4,{x:0,y:0,w:110,h:110},3,true,async()=>{throw Error('Writing resumed');}),/Writing resumed/);
});
test('all-objects erasing masks only brushed areas of pasted text, image and handwriting in a single undoable gesture',async()=>{
 const clipboard=require('../clipboard.js'),e=deferredEditor();let id=0;
 const pasted=clipboard.moveItems([
  {id:'text',type:'text',text:'Pasted text',x:10,y:10,w:100,size:24,color:'#123456'},
  {id:'image',type:'image',x:10,y:10,w:100,h:100,src:'data:image/png;base64,AAAA'},ink
 ],0,0,()=>`pasted-${++id}`);e.p.items=pasted;
 e.context.deferInteraction({kind:'erase',scope:{},originals:pasted.slice(),points:[{x:30,y:10}],radius:14,inkOnly:false});e.release();await e.context.interactionQueue;
 assert.equal(e.p.items.length,3);assert.ok(e.p.items.every(item=>item.erasures.length===1));assert.equal(e.p.items[0].text,pasted[0].text);assert.equal(e.p.items[1].src,pasted[1].src);assert.deepEqual(e.counts(),{changed:1,rendered:1,snapshots:1});
});
test('ink-only erasing still preserves pasted text and images when explicitly chosen',async()=>{
 const e=deferredEditor(),pastedText={id:'pasted-text',type:'text',text:'Keep',x:10,y:10,w:100,size:24},pastedImage={id:'pasted-image',type:'image',x:10,y:10,w:100,h:100};e.p.items.push(pastedText,pastedImage);
 e.context.deferInteraction({kind:'erase',scope:{},originals:e.p.items.slice(),points:[{x:30,y:10}],radius:14,inkOnly:true});e.release();await e.context.interactionQueue;
 assert.equal(e.p.items.length,3);assert.equal(e.p.items[0].erasures.length,1);assert.equal(e.p.items[1],pastedText);assert.equal(e.p.items[2],pastedImage);assert.equal(e.counts().snapshots,1);
});

test('rapid queued eraser gestures both survive on the same item without erasing new ink',async()=>{
 const e=deferredEditor(),original=e.p.items[0],base={kind:'erase',scope:{},originals:[original],radius:4,inkOnly:true};
 e.context.deferInteraction({...base,points:[{x:30,y:10}]});e.context.deferInteraction({...base,points:[{x:90,y:10}]});e.release();await e.context.interactionQueue;
 assert.equal(e.p.items[0].erasures.length,2);assert.equal(e.counts().snapshots,2);assert.deepEqual(e.p.items[0].points,original.points);
});
test('cancelled live erasing restores the page without recording an undo entry or saving masks',async()=>{
 const e=deferredEditor();e.context.eraserPreview={complete:()=>true,invalidate(){}};e.context.deferInteraction({kind:'erase',cancelledPreview:true,scope:{},originals:e.p.items.slice(),points:[{x:30,y:10}],radius:14,inkOnly:true});e.release();await e.context.interactionQueue;assert.ok(!e.p.items[0].erasures);assert.deepEqual(e.counts(),{changed:0,rendered:1,snapshots:0});assert.equal(e.state.pendingInteractions,0);
});
