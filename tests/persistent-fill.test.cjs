const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),fill=require('../boundary-fill.js');
const source=readFileSync(require.resolve('../app.js'),'utf8');
function editor(){
 fill.setActive(false);fill.setSelected(false);
 const nodes=new Map(),handlers=new Map(),tasks=[],messages=[];
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{id,hidden:false,value:'',dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},
   setAttribute(key,value){this[key]=value;if(key==='hidden')this.hidden=true;},removeAttribute(key){delete this[key];if(key==='hidden')this.hidden=false;},replaceChildren(){},after(){},
   addEventListener(type,callback){handlers.set(type,callback);},getBoundingClientRect:()=>({left:0,top:0,width:40,height:40})});
  return nodes.get(id);
 };
 const shapes=[{id:'a',type:'shape',kind:'rectangle',x:2,y:2,w:10,h:10,color:'#111111',size:2},{id:'b',type:'shape',kind:'rectangle',x:20,y:2,w:10,h:10,color:'#111111',size:2}];
 const page={id:'page',items:shapes};
 const ctx={clearRect(){},isPointInPath(x,y){const s=this.shape;return x>s.x&&x<s.x+s.w&&y>s.y&&y<s.y+s.h;},getImageData:()=>({data:new Uint8ClampedArray(40*40*4)})};
 const context={state:{tool:'pen',selected:-1,pendingInteractions:0,color:'#111111',shapeFillColor:'#ff8040',shapeFillOpacity:1,shapeFillEnabled:false,shapeOutlineColor:'#111111',shapeOutlineSize:2,shapeOutlineStyle:'solid'},
  W:40,H:40,saveVersion:0,WindsBoundaryFill:fill,page:()=>page,pageDimensions:()=>({width:40,height:40}),$:node,
  clipboardContext:()=>({account:'account',book:'book',page:'page'}),clipboardMatches:s=>s.account==='account'&&s.page==='page',inputBusy:()=>false,delay:async()=>{},
  CREATIVE:{STROKE_STYLES:new Set(['solid']),isFillableShape:()=>true,objectPoint:(s,p)=>p,shapePath:(c,s)=>{c.shape=s;},prepareArtistColor(){}},
  document:{querySelectorAll:()=>[],createTextNode:value=>value,createElement:()=>({width:40,height:40,getContext:()=>ctx}),addEventListener(){}},
  setTool:tool=>{context.state.tool=tool;},closeMenus(){},renderCanvas(){},renderThumbs(){},remember(){},drawItem(){},
  scheduleSave(){context.saveVersion++;},toast:message=>messages.push(message),setTimeout:callback=>tasks.push(callback),toggleMenu(){}};
 context.window=context;node('editorView').hidden=false;
 const helpers=source.slice(source.indexOf('  let boundaryFillSession=null;'),source.indexOf('  function setArtistGrade('));
 const colors=source.slice(source.indexOf('  function syncColorControls(){'),source.indexOf('  function ensureStickerCollections(){'));
 vm.runInNewContext(helpers+colors+'\nglobalThis.controller={armBoundaryFill,cancelBoundaryFill,bindBoundaryFill,setColor,showFillMenu,session:()=>boundaryFillSession};',context);
 context.controller.bindBoundaryFill();
 function send(x,y){
  handlers.get('pointerdown')({pointerId:1,pointerType:'pen',clientX:x,clientY:y,button:0});
  handlers.get('pointerup')({pointerId:1,pointerType:'pen',clientX:x,clientY:y,button:0});
 }
 async function tap(x,y){send(x,y);assert.equal(fill.isActive(),true);await tasks.shift()();}
 return {context,node,page,messages,tap,send,tasks,fill};
}
test('Fill remains selected across multiple regions while toolbar colors leave the pen color unchanged',async()=>{
 const e=editor(),c=e.context;c.controller.armBoundaryFill();
 assert.equal(fill.isSelected(),true);assert.equal(fill.isActive(),false);assert.equal(e.node('activeFillColor').hidden,false);
 const selected=c.controller.session();c.controller.armBoundaryFill();assert.equal(c.controller.session(),selected,'selecting Fill again must keep the same tool selected');
 await e.tap(7,7);assert.equal(e.page.items[0].fillColor,'#ff8040');
 c.controller.setColor('#39a68c');await e.tap(25,7);
 assert.equal(e.page.items[1].fillColor,'#39a68c');assert.equal(c.state.color,'#111111');
 assert.equal(fill.isSelected(),true);assert.equal(fill.isActive(),false);assert.equal(c.controller.session().pending,false);
 c.controller.cancelBoundaryFill(true);assert.equal(fill.isSelected(),false);assert.equal(c.state.tool,'pen');assert.equal(e.node('activeFillColor').hidden,true);
});
test('an open region keeps Fill selected and the following valid tap still works',async()=>{
 const e=editor();e.context.controller.armBoundaryFill();await e.tap(35,35);
 assert.match(e.messages.at(-1),/open/);assert.equal(fill.isSelected(),true);assert.equal(fill.isActive(),false);
 await e.tap(7,7);assert.equal(e.page.items[0].fillColor,'#ff8040');
});
test('an idle selected Fill tool captures the latest save version on the next tap',async()=>{
 const e=editor();e.context.controller.armBoundaryFill();e.context.saveVersion=20;
 await e.tap(25,7);assert.equal(e.page.items[1].fillColor,'#ff8040');assert.equal(e.context.saveVersion,21);
 assert.equal(fill.isSelected(),true);assert.equal(fill.isActive(),false);
});
test('changing color during a pending fill changes the next section rather than the running operation',async()=>{
 const e=editor();e.context.controller.armBoundaryFill();let release;
 const gate=new Promise(resolve=>{release=resolve;});e.context.delay=()=>gate;
 const filling=e.tap(7,7);e.context.controller.setColor('#39a68c');release();await filling;
 assert.equal(e.page.items[0].fillColor,'#ff8040');await e.tap(25,7);assert.equal(e.page.items[1].fillColor,'#39a68c');
});


test('quick successive fill taps retain their positions and chosen colors in a bounded queue',async()=>{
 const e=editor();e.context.controller.armBoundaryFill();let release;
 const gate=new Promise(resolve=>{release=resolve;});e.context.delay=()=>gate;
 const first=e.tap(7,7);e.context.controller.setColor('#39a68c');e.send(25,7);
 e.context.controller.setColor('#4777c8');e.send(7,7);release();await first;
 assert.equal(e.page.items[0].fillColor,'#ff8040');
 assert.equal(fill.isActive(),true);await e.tasks.shift()();assert.equal(e.page.items[1].fillColor,'#39a68c');
 await e.tasks.shift()();assert.equal(e.page.items[0].fillColor,'#4777c8');
 assert.equal(fill.isSelected(),true);assert.equal(fill.isActive(),false);assert.equal(e.context.saveVersion,3);
});


test('a cached older boundary module cannot break notebook controls or filling',async()=>{
 const e=editor();e.context.WindsBoundaryFill={...fill,setSelected:undefined,isSelected:undefined};
 e.context.controller.armBoundaryFill();assert.ok(e.context.controller.session());
 await e.tap(7,7);assert.equal(e.page.items[0].fillColor,'#ff8040');
 e.context.controller.cancelBoundaryFill(true);assert.equal(e.context.state.tool,'pen');
});
