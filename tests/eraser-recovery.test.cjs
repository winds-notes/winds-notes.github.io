const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const creativeSource=fs.readFileSync(require.resolve('../creative-tools.js'),'utf8'),app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const item={id:'ink',type:'stroke',tool:'pen',size:7,color:'#123456',points:[[10,10,.5],[100,10,.7]],erasures:[{rx:.1,ry:.2,points:[[.5,.5]]}]},bounds={x:0,y:0,w:120,h:30};
function painter(failures=0){
 const context={eraserPreview:null,queueEraserPreparation(){},};vm.runInNewContext(creativeSource,context);let allocations=0,attempts=0,draws=0;const modes=[];
 const layer=new Proxy({},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true;}});
 context.document={createElement:()=>{allocations++;return {width:1,height:1,getContext:()=>++attempts<=failures?null:layer};}};
 const destination={getTransform:()=>({a:2,b:0,c:0,d:2}),drawImage:canvas=>{assert.ok(canvas.width*canvas.height<=4194304);draws++;}};
 const draw=()=>context.WindsCreative.drawErasedItem(destination,item,bounds,bounds,ctx=>{modes.push(ctx.globalCompositeOperation);});
 return {context,api:context.WindsCreative,destination,draw,counts:()=>({allocations,attempts,draws}),modes};
}
test('a transient null Canvas 2D context retries at a smaller size and the next erasure still works',()=>{
 const p=painter(1);assert.doesNotThrow(p.draw);p.draw();assert.deepEqual(p.counts(),{allocations:1,attempts:3,draws:2});assert.deepEqual(p.modes,['source-over','source-over']);
});
test('masked objects reuse one surface instead of retaining many Safari canvas backing stores',()=>{
 const p=painter();for(let i=0;i<30;i++)p.draw();assert.equal(p.counts().allocations,1);assert.equal(p.counts().draws,30);assert.ok(p.modes.every(mode=>mode==='source-over'));
});
test('a missing getTransform method does not disable area erasing',()=>{
 const p=painter();delete p.destination.getTransform;assert.doesNotThrow(p.draw);assert.equal(p.counts().draws,1);
});
test('exhausted drawing memory has an actionable error and a later retry can recover',()=>{
 const p=painter(3);assert.throws(p.draw,error=>error.code==='CANVAS_MEMORY'&&/drawing memory/.test(error.message));assert.doesNotThrow(p.draw);assert.equal(p.counts().draws,1);assert.equal(p.counts().allocations,2);
});
function editor(){
 const original={...item};delete original.erasures;const page={items:[original]},oldUndo={kind:'append',item:original},oldRedo={kind:'append',item:{id:'redo'}},history={undo:[oldUndo],redo:[oldRedo]},messages=[];
 let saves=0,fail=true;
 const context={eraserPreview:null,queueEraserPreparation(){},state:{pendingInteractions:0,selected:0},groupSelection:null,saveVersion:0,console:{error(){}},page:()=>page,historyForPage:()=>history,
 composeInkNow(){},remember(){history.undo.push({kind:'snapshot',items:structuredClone(page.items)});history.redo=[];},updateHistoryButtons(){},
 renderCanvas(){if(fail&&page.items.some(i=>i.erasures)){const error=Error('Not enough drawing memory.');error.code='CANVAS_MEMORY';throw error;}},
 renderThumbs(){},scheduleSave(){saves++;context.saveVersion++;},clipboardMatches:()=>true,interactionIdle:async()=>{},interactionQueue:Promise.resolve(),delay:async()=>{},
 CREATIVE:require('../creative-tools.js'),interactions:require('../interaction-tools.js'),itemBounds:()=>bounds,clipboardBounds:()=>bounds,queueInteractionOverlay(){},toast:message=>messages.push(message)};
 vm.runInNewContext(app.slice(app.indexOf('  function commitDeferredItems('),app.indexOf('  function initPageStack(')),context);
 return {context,page,history,original,oldUndo,oldRedo,messages,saves:()=>saves,enablePainting:()=>{fail=false;}};
}
test('a failed erase rolls back items and undo/redo without saving, clears pending work, and accepts the next erase',async()=>{
 const e=editor(),gesture={kind:'erase',scope:{},originals:[e.original],points:[{x:50,y:10}],radius:14,inkOnly:true};
 e.context.deferInteraction(gesture);await e.context.interactionQueue;
 assert.equal(e.page.items[0],e.original);assert.ok(!e.original.erasures);assert.equal(e.context.state.selected,0);assert.deepEqual(e.history.undo,[e.oldUndo]);assert.deepEqual(e.history.redo,[e.oldRedo]);assert.equal(e.saves(),0);assert.equal(e.context.state.pendingInteractions,0);assert.match(e.messages[0],/drawing memory/);
 e.enablePainting();e.context.deferInteraction(gesture);await e.context.interactionQueue;
 assert.equal(e.page.items[0].erasures.length,1);assert.equal(e.saves(),1);assert.equal(e.history.undo.length,2);assert.equal(e.context.state.pendingInteractions,0);
});
test('a selection can still be moved when its optional preview canvas cannot allocate',()=>{
 const context={eraserPreview:null,queueEraserPreparation(){},state:{selected:-1},groupSelection:null,saveVersion:0,interactions:require('../interaction-tools.js'),page:()=>({items:[item]}),clipboardBounds:()=>bounds,clipboardContext:()=>({account:'a',page:'p'}),document:{createElement:()=>({width:0,height:0,getContext:()=>null})}};
 vm.runInNewContext(app.slice(app.indexOf('  function selectGroup('),app.indexOf('  function deleteSelection(')),context);assert.doesNotThrow(()=>context.selectGroup([item]));assert.equal(context.groupSelection.bitmap,null);assert.equal(context.groupSelection.ids.size,1);
});
test('switching between tall and wide items never briefly allocates an oversized surface',()=>{
 const p=painter(),surface={_width:1,_height:1,get width(){return this._width;},set width(value){this._width=value;assert.ok(this._width*this._height<=4194304);},get height(){return this._height;},set height(value){this._height=value;assert.ok(this._width*this._height<=4194304);},getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})};
 p.context.document.createElement=()=>surface;
 for(const b of [{x:0,y:0,w:100,h:5000},{x:0,y:0,w:5000,h:100}])assert.doesNotThrow(()=>p.api.drawErasedItem(p.destination,item,b,b,()=>{}));
});
