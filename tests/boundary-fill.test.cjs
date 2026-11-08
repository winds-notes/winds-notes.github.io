const test=require('node:test'),assert=require('node:assert/strict');
const fill=require('../boundary-fill.js');
require('../native-file.js');
const creative=require('../creative-tools.js');
require('../shared-notebook-model.js');
const {WindsFile,WindsSharedModel}=globalThis;
function raster(width=30,height=24){const pixels=new Uint8ClampedArray(width*height*4);return {width,height,pixels,line(x,y){pixels[(y*width+x)*4+3]=255;},box(x,y,w,h){for(let i=x;i<=x+w;i++){this.line(i,y);this.line(i,y+h);}for(let j=y;j<=y+h;j++){this.line(x,j);this.line(x+w,j);}}};}
const find=(r,x,y,pause)=>fill.region(r.pixels,r.width,r.height,x,y,pause);
const inside=(area,x,y)=>area.mask[(y-area.y)*area.w+x-area.x]===1;

test('a closed boundary fills only its interior, including the one-pixel underlap beneath its outline',async()=>{
 const r=raster();r.box(3,4,15,12);const area=await find(r,8,8);
 assert.deepEqual([area.x,area.y,area.w,area.h],[3,4,16,13]);
 assert.equal(inside(area,8,8),true);assert.equal(inside(area,3,4),false);assert.equal(inside(area,4,4),true);
 const rgba=await fill.colorize(area,'#ff8040',.5),i=((8-area.y)*area.w+8-area.x)*4;
 assert.deepEqual([...rgba.slice(i,i+4)],[255,128,64,128]);
});
test('even a one-pixel gap rejects the fill without returning a page-sized region',async()=>{
 const r=raster();r.box(3,4,15,12);r.pixels[(4*r.width+9)*4+3]=0;
 await assert.rejects(find(r,8,8),/open.*gap/);
 await assert.rejects(find(r,1,1),/open/);
});
test('nested boundaries leave their enclosed hole uncolored',async()=>{
 const r=raster();r.box(2,2,24,19);r.box(10,8,5,6);
 const area=await find(r,5,5);assert.equal(inside(area,12,11),false);
 const inner=await find(r,12,11);assert.deepEqual([inner.x,inner.y,inner.w,inner.h],[10,8,6,7]);
});
test('line taps, outside taps and unsafe dimensions reject cleanly',async()=>{
 const r=raster();r.box(3,4,15,12);
 await assert.rejects(find(r,3,8),/away from its line/);
 await assert.rejects(find(r,-1,8),/inside the page/);
 await assert.rejects(find(r,NaN,8),/inside the page/);
 await assert.rejects(fill.region(new Uint8Array(0),5000,5000,1,1),/too large/);
});
test('work yields repeatedly and a changed account/page can cancel before any result is applied',async()=>{
 const r=raster(180,180);r.box(3,3,170,170);let pauses=0;
 await assert.rejects(find(r,80,80,async()=>{if(++pauses===3)throw Error('account changed');}),/account changed/);
 assert.equal(pauses,3);
});
test('recolor matching compares the entire alpha mask rather than just rectangular bounds',async()=>{
 const r=raster();r.box(3,4,15,12);const area=await find(r,8,8),rgba=await fill.colorize(area,'#abcdef',.25);
 assert.equal(await fill.sameMask(area,rgba),true);
 rgba[((8-area.y)*area.w+8-area.x)*4+3]=0;
 assert.equal(await fill.sameMask(area,rgba),false);
 await assert.rejects(fill.colorize(area,'invalid',1),/Choose a fill/);
});
test('filled areas preserve image editing, erase masks, and optional metadata through native and shared data',()=>{
 const item={id:'filled',type:'image',boundaryFill:true,x:12,y:20,w:100,h:80,src:'data:image/png;base64,aGVsbG8=',rotation:25,erasures:[{rx:.1,ry:.1,points:[[.2,.3]]}]};
 const notebook={id:'book',title:'Colors',pages:[{id:'page',template:'ruled',items:[item]}]};
 const file=JSON.parse(WindsFile.serialize(notebook));assert.equal(file.version,1);
 const reopened=WindsFile.parse(JSON.stringify(file)).notebooks[0].pages[0].items[0];
 assert.equal(reopened.boundaryFill,true);assert.equal(reopened.rotation,25);assert.deepEqual(reopened.erasures,item.erasures);
 assert.equal(WindsFile.validateShared(notebook).pages[0].items[0].boundaryFill,true);
 const seed={...notebook,pages:[{id:'page',template:'ruled',items:[]}]};
 const batch={format:'winds-shared-edit',version:1,id:'fill-batch',at:'2026-11-07T00:00:00Z',changes:[{key:['item','page','filled'],value:item}]};
 assert.equal(WindsSharedModel.replay(seed,[batch]).pages[0].items[0].boundaryFill,true);
 const older=WindsFile.parse(WindsFile.serialize({...notebook,pages:[{id:'page',items:[{...item,boundaryFill:undefined}]}]})).notebooks[0].pages[0].items[0];
 assert.equal(older.boundaryFill,undefined);
});
test('built-in shape fill rendering retains an independent outline',()=>{
 const calls=[],ctx={save(){},restore(){},beginPath(){},rect(){},fill(){calls.push(['fill',this.fillStyle,this.globalAlpha]);},stroke(){calls.push(['stroke',this.strokeStyle,this.lineWidth]);}};
 creative.drawShape(ctx,{type:'shape',kind:'rectangle',x:1,y:1,w:20,h:20,color:'#123456',size:4,fillColor:'#ff8040',fillOpacity:.5});
 assert.deepEqual(calls,[['fill','#ff8040',.5],['stroke','#123456',4]]);
});

function tapObserver(){
 const vm=require('node:vm'),{readFileSync}=require('node:fs'),app=readFileSync(require.resolve('../app.js'),'utf8');
 const handlers=new Map(),options=[],tasks=[],applied=[],button={};
 const canvas={removeAttribute(){},addEventListener(type,handler,option){handlers.set(type,handler);options.push(option);},getBoundingClientRect:()=>({left:0,top:0,width:840,height:1188})};
 const session={pointers:new Set(),pending:false,tap:null};
 const context={boundaryFillSession:session,W:840,H:1188,WindsBoundaryFill:fill,saveVersion:1,state:{shapeFillColor:'#ff8040',shapeFillOpacity:1},clipboardContext:()=>({account:'account',book:'book',page:'page'}),
  $:id=>id==='fillClosedArea'?button:canvas,armBoundaryFill(){},applyBoundaryFill:(...args)=>applied.push(args),
  setTimeout:callback=>tasks.push(callback),document:{addEventListener(){}}};
 vm.runInNewContext(app.slice(app.indexOf('  function bindBoundaryFill(){'),app.indexOf('  function applyFillToSelected(){'))+'\nbindBoundaryFill();',context);
 const send=(type,id,pointerType='pen',x=100,y=100)=>handlers.get(type)({pointerId:id,pointerType,clientX:x,clientY:y,button:0});
 return {send,tasks,applied,options};
}
test('fill tap observers preserve normal events and defer all filling beyond pointer-up',()=>{
 const o=tapObserver();o.send('pointerdown',1);o.send('pointerup',1);
 assert.equal(o.tasks.length,1);assert.equal(o.applied.length,0);
 assert.ok(o.options.every(value=>value.capture===true&&value.passive===true));
 o.tasks[0]();assert.equal(o.applied.length,1);
});
test('a palm contact and its cancellation cannot discard a Pencil fill tap',()=>{
 const o=tapObserver();o.send('pointerdown',1);o.send('pointerdown',2,'touch');o.send('pointercancel',2,'touch');o.send('pointerup',1);
 assert.equal(o.tasks.length,1);
});
test('two-finger gestures, dragging and cancelled taps never apply a fill',()=>{
 const pinch=tapObserver();pinch.send('pointerdown',1,'touch');pinch.send('pointerdown',2,'touch');pinch.send('pointerup',1,'touch');pinch.send('pointerup',2,'touch');
 assert.equal(pinch.tasks.length,0);
 const drag=tapObserver();drag.send('pointerdown',1);drag.send('pointermove',1,'pen',150,100);drag.send('pointerup',1,'pen',150,100);assert.equal(drag.tasks.length,0);
 const cancelled=tapObserver();cancelled.send('pointerdown',1);cancelled.send('pointercancel',1);cancelled.send('pointerup',1);assert.equal(cancelled.tasks.length,0);
});
