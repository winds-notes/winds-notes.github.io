const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
function editor(){
 const jobs=[],preview=[],rect={left:0,top:0,width:840,height:1188},items=[{id:'old',type:'stroke'}];
 const state={tool:'eraser',editingText:null,lastPenAt:0,stylusSeen:true,penOnly:false,pointers:new Map(),drag:null,pinch:null,eraserSize:40,eraserInkOnly:false};
 const ctx={state,W:840,H:1188,Date,PALM_GUARD_MS:2400,page:()=>({items}),$:()=>({getBoundingClientRect:()=>rect,classList:{add(){},remove(){}}}),clipboardContext:()=>({account:'a',book:'b',page:'p'}),
  point:(ev,r=state.drag?.rect||rect)=>({x:(ev.clientX-r.left)/r.width*840,y:(ev.clientY-r.top)/r.height*1188,p:ev.pressure}),clampPoint:p=>p,
  eraserPreview:{begin:()=>true,add:(g,p)=>preview.push({...p}),has:()=>true},eraserPreviewKey:()=>({}),queueInteractionOverlay(){},deferInteraction:g=>jobs.push(g),endPinch(){throw Error('Unexpected pinch');}};
 vm.runInNewContext(app.slice(app.indexOf('  function pointerDown('),app.indexOf('  function beginText(')),ctx);
 const event=(id,x,y,extra={})=>({pointerType:'pen',pointerId:id,clientX:x,clientY:y,pressure:.5,buttons:1,button:0,cancelable:true,preventDefault(){},currentTarget:{setPointerCapture(){}},...extra});
 return {ctx,state,jobs,preview,event};
}
test('Pencil eraser recovers a pressed move with a missing down, but ignores hover',()=>{
 const e=editor();e.ctx.pointerMove(e.event(1,20,30,{pressure:0,buttons:0}));assert.equal(e.state.drag,null);
 e.ctx.pointerMove(e.event(1,20,30));assert.equal(e.state.drag?.kind,'erase');assert.equal(e.state.drag.pointerId,1);assert.deepEqual(e.preview,[{x:20,y:30}]);
});
test('a new Pencil contact preserves the erased path when the preceding up was lost',()=>{
 const e=editor();e.ctx.pointerDown(e.event(1,20,30));e.ctx.pointerMove(e.event(1,40,50));e.ctx.pointerDown(e.event(2,80,90));
 assert.equal(e.jobs.length,1);assert.ok(!e.jobs[0].cancelledPreview);assert.equal(e.jobs[0].points.length,2);assert.equal(e.state.drag.pointerId,2);
});
test('Pencil eraser retains completed contact samples after cancel or lost capture; finger cancel rolls back',()=>{
 for(const callback of ['pointerCancel','pointerLostCapture']){
  const e=editor();e.ctx.pointerDown(e.event(1,20,30));e.ctx[callback](e.event(1,20,30));assert.equal(e.jobs.length,1);assert.ok(!e.jobs[0].cancelledPreview,callback);assert.equal(e.state.drag,null);
 }
 const e=editor();e.ctx.pointerDown(e.event(1,20,30,{pointerType:'touch'}));e.ctx.pointerCancel(e.event(1,20,30,{pointerType:'touch'}));assert.ok(e.jobs[0].cancelledPreview);
});
test('eraser uses coalesced curved Pencil samples and the up endpoint in both durable and live paths',()=>{
 const e=editor();e.ctx.pointerDown(e.event(1,100,100));e.ctx.pointerMove(e.event(1,200,100,{getCoalescedEvents:()=>[e.event(1,120,130),e.event(1,150,160),e.event(1,180,130)]}));e.ctx.pointerUp(e.event(1,220,120,{buttons:0,pressure:0}));
 const expected=[{x:100,y:100},{x:120,y:130},{x:150,y:160},{x:180,y:130},{x:200,y:100},{x:220,y:120}];assert.deepEqual(e.preview,expected);assert.deepEqual(Array.from(e.jobs[0].points,p=>({...p})),expected);
});
test('rapid separate Pencil contacts each survive, including intermittent missing down/up events',()=>{
 const e=editor();for(let i=1;i<=20;i++){const ev=e.event(i,i*20,100);if(i%3===0)e.ctx.pointerMove(ev);else e.ctx.pointerDown(ev);e.ctx.pointerMove(e.event(i,i*20,140));if(i%4!==0)e.ctx.pointerUp(e.event(i,i*20,150));}e.ctx.pointerLostCapture(e.event(20,400,140));
 assert.equal(e.jobs.length,20);assert.ok(e.jobs.every(g=>!g.cancelledPreview&&g.points.length>=2));
});
test('a long Pencil erase retains coalesced bends and ignores unrelated palm and stale-end events',()=>{
 const e=editor();e.ctx.pointerDown(e.event(1,20,200));
 e.ctx.pointerDown(e.event(99,300,300,{pointerType:'touch'}));assert.equal(e.state.drag.pointerId,1);
 const samples=Array.from({length:1500},(_,i)=>e.event(1,20+i*.4,200+Math.sin(i/10)*40));
 e.ctx.pointerMove(e.event(1,620,200,{getCoalescedEvents:()=>samples}));e.ctx.pointerUp(e.event(99,300,300,{pointerType:'touch'}));assert.equal(e.jobs.length,0);assert.equal(e.state.drag.pointerId,1);
 e.ctx.pointerUp(e.event(1,630,210));assert.equal(e.jobs.length,1);assert.ok(e.jobs[0].points.length>1000);assert.deepEqual(e.preview.at(-1),{x:630,y:210});assert.ok(!e.jobs[0].cancelledPreview);
});
