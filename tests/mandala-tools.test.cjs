const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs');
const creative=require('../creative-tools.js');
require('../native-file.js');
const {WindsFile}=globalThis,app=readFileSync(require.resolve('../app.js'),'utf8');
function recorder(){const calls=[];const ctx={};for(const name of ['save','restore','translate','scale','rotate','setLineDash','beginPath','arc','closePath','stroke','moveTo','lineTo','bezierCurveTo','quadraticCurveTo','ellipse','fill','clip','rect','drawImage'])ctx[name]=(...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg));calls.push([name,...args]);};return {ctx,calls};}
function artwork(design){return design.motif?{id:design.id,image:{src:design.motif+'.webp'}}:null;}
test('mandala renderers preserve balanced transforms and deterministic geometry or prepared artwork',()=>{
 for(const design of creative.MANDALA_DESIGNS){
  const a=recorder(),b=recorder();creative.drawMandala(a.ctx,design.id,700,artwork(design));creative.drawMandala(b.ctx,design.id,700,artwork(design));
  assert.deepEqual(a.calls,b.calls);assert.equal(a.calls.filter(c=>c[0]==='save').length,a.calls.filter(c=>c[0]==='restore').length);
  if(design.motif)assert.equal(a.calls.filter(c=>c[0]==='drawImage').length,1);
  else assert.ok(a.calls.filter(c=>c[0]==='closePath').length>=3);
  assert.equal(a.ctx.strokeStyle,'#30344c');
 }
 assert.throws(()=>creative.drawMandala(recorder().ctx,'missing',700),/valid mandala/);
 assert.throws(()=>creative.drawMandala(recorder().ctx,'lotus',Infinity),/valid mandala/);
});
function editor({decode}={}){
 const source={id:'original',template:'ruled',items:[{id:'ink',type:'stroke',tool:'pen',color:'#123456',size:3,points:[[10,10,.5]]}]},book={id:'book',title:'Science',pages:[source]},calls=[];
 const scope={workspace:'g-account-a',bookId:'book',pageId:'original',version:0};let active=true;
 const context={state:{activeId:'book',pageIndex:0,pendingInteractions:0},workspaceId:'g-account-a',CREATIVE:creative,WindsFile,
  inputBusy:()=>false,delay:async()=>{},notebook:()=>book,uid:(()=>{let n=0;return()=> 'new-'+(++n);})(),makePage:(template,orientation)=>({id:'new-page',template,orientation,items:[]}),
  document:{createElement:()=>({width:0,height:0,getContext:()=>recorder().ctx,toDataURL:()=> 'data:image/png;base64,aGVsbG8='})},
  Image:class{decode(){return decode?decode():Promise.resolve();}},imageCache:new Map(),
  syncPageGeometry:()=>calls.push('geometry'),resizePage:()=>calls.push('resize'),renderEditor:()=>calls.push('render'),scheduleSave:structural=>calls.push(['save',structural]),
  WindsPageStack:{focus:id=>calls.push(['focus',id])}};
 context.window=context;
 vm.runInNewContext(app.slice(app.indexOf('  async function createMandalaPage('),app.indexOf('  async function commitPdfPages('))+'\nglobalThis.createMandalaPage=createMandalaPage;',context);
 return {context,book,source,scope,calls,valid:()=>active,cancel:()=>{active=false;}};
}
test('a mandala is added on a new blank page without replacing existing notes',async()=>{
 const e=editor();await e.context.createMandalaPage('lotus',e.scope,e.valid);
 assert.equal(e.book.pages.length,2);assert.equal(e.book.pages[0],e.source);assert.equal(e.source.items.length,1);
 const page=e.book.pages[1];assert.equal(page.orientation,'portrait');assert.equal(page.template,'blank');assert.equal(page.items.filter(i=>i.type==='image').length,1);
 assert.equal(page.items.find(i=>i.type==='image').boundaryFill,undefined,'template lines must be barriers to the fill tool');
 assert.deepEqual(e.calls.find(c=>Array.isArray(c)&&c[0]==='save'),['save',true]);
 const native=WindsFile.parse(WindsFile.serialize(e.book));assert.equal(native.notebooks[0].pages.length,2);assert.equal(JSON.parse(WindsFile.serialize(e.book)).version,1);
});
test('cancelling or switching accounts while a mandala image decodes cannot add a stale page',async()=>{
 for(const action of ['cancel','account']){
  let release;const gate=new Promise(resolve=>{release=resolve;}),e=editor({decode:()=>gate});
  const adding=e.context.createMandalaPage('rose',e.scope,e.valid);
  if(action==='cancel')e.cancel();else e.context.workspaceId='g-account-b';
  release();await assert.rejects(adding,/notebook changed/);assert.equal(e.book.pages.length,1);assert.deepEqual(e.calls,[]);
 }
});
test('unavailable pages and the notebook page limit cannot be overwritten by a template',async()=>{
 const e=editor();e.scope.pageId='missing';await assert.rejects(e.context.createMandalaPage('lotus',e.scope,e.valid),/original page/);assert.equal(e.book.pages.length,1);
 e.scope.pageId='original';e.book.pages=Array.from({length:750},(_,i)=>({...e.source,id:'page-'+i}));
 await assert.rejects(e.context.createMandalaPage('lotus',e.scope,e.valid),/750 pages/);assert.equal(e.book.pages.length,750);
});


test('an illustration finishing after an account change cannot insert a stale page',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;}),e=editor();
 e.context.CREATIVE={...creative,prepareMandala:()=>gate};
 const adding=e.context.createMandalaPage('art-lion',e.scope,e.valid);
 e.context.workspaceId='g-account-b';release({});
 await assert.rejects(adding,/notebook changed/);assert.equal(e.book.pages.length,1);assert.deepEqual(e.calls,[]);
});

test('a template exceeding native backup size limits leaves the notebook untouched',async()=>{
 const e=editor();e.context.WindsFile={...WindsFile,MAX_FILE_BYTES:1};
 await assert.rejects(e.context.createMandalaPage('lotus',e.scope,e.valid),/100 MB/);
 assert.equal(e.book.pages.length,1);assert.equal(e.context.imageCache.size,0);assert.deepEqual(e.calls,[]);
});

// A native dialog queues its close event; exercise that event after reopening
// and starting another asynchronous add, without a browser dependency.
test('a queued close from an earlier studio cannot invalidate a new page being prepared',async()=>{
 const nodes=new Map(),queued=[];let release,added=false;
 const gate=new Promise(resolve=>{release=resolve;});
 function element(tag){
  const e={tag,children:[],dataset:{},listeners:{},open:false,
   append(...children){this.children.push(...children);},setAttribute(name,value){this[name]=value;},focus(){},
   addEventListener(name,callback){this.listeners[name]=callback;},showModal(){this.open=true;},
   close(){this.open=false;queued.push(()=>this.listeners.close?.());},
   querySelectorAll(){const result=[];const walk=node=>{if(node.dataset?.mandalaId)result.push(node);for(const child of node.children||[])walk(child);};walk(this);return result;},
   querySelector(selector){const id=selector.match(/mandala-id="([^"]+)"/)?.[1];return this.querySelectorAll().find(node=>node.dataset.mandalaId===id);}};
  Object.defineProperty(e,'id',{get(){return this._id;},set(value){this._id=value;nodes.set(value,this);}});return e;
 }
 const menu=element('div');menu.id='fillMenu';const trigger=element('button');trigger.id='shapeFillBtn';
 const scope={workspace:'account',bookId:'book',pageId:'page',version:0};
 const context={document:{createElement:element,getElementById:id=>nodes.get(id),body:element('body')},
  WindsCreative:{MANDALA_DESIGNS:[{id:'lotus',name:'Lotus',level:'Calm',detail:'Petals'}],drawMandala(){}}};
 // Previews need only a context object for this lifecycle test.
 const create=context.document.createElement;context.document.createElement=tag=>{const e=create(tag);e.getContext=()=>({});return e;};
 context.window=context;
 vm.runInNewContext(readFileSync(require.resolve('../mandala-tools.js'),'utf8'),context);
 context.WindsMandala.init({context:()=>scope,prepare:async()=>{},toast(){},async commit(id,captured,valid){await gate;assert.equal(valid(),true);added=true;}});
 await context.WindsMandala.open();context.WindsMandala.close();await context.WindsMandala.open();
 const adding=nodes.get('addMandalaPage').onclick();queued.shift()();release();await adding;
 assert.equal(added,true);assert.equal(context.WindsMandala.isOpen(),false);
});


test('the expanded library contains 100 distinct deterministic compositions in nine collections',()=>{
 const designs=creative.MANDALA_DESIGNS;
 assert.equal(designs.length,100);assert.equal(new Set(designs.map(d=>d.id)).size,100);assert.equal(new Set(designs.map(d=>d.name)).size,100);
 assert.deepEqual([...new Set(designs.map(d=>d.collection))].sort(),['Animals','Birds','Buddha & Zen','Celestial','Floral','Geometric','Nature','Ocean','Ornamental']);
 const compositions=new Set();
 for(const design of designs){const {ctx,calls}=recorder();creative.drawMandala(ctx,design.id,700,artwork(design));compositions.add(JSON.stringify(calls));}
 assert.equal(compositions.size,100,'different names must represent different artwork');
 for(const id of ['lotus','sunflower','star','rose','orbit','peacock'])assert.ok(designs.some(d=>d.id===id),'original IDs remain available');
});


test('the fifty new illustrated designs cover animals, birds, ocean life and Buddha/Zen subjects',()=>{
 const designs=creative.MANDALA_DESIGNS.filter(design=>design.motif);
 assert.equal(designs.length,50);
 assert.deepEqual(Object.fromEntries(['Animals','Birds','Ocean','Buddha & Zen'].map(name=>[name,designs.filter(d=>d.collection===name).length])),{'Animals':25,'Birds':8,'Ocean':7,'Buddha & Zen':10});
 assert.ok(designs.every(design=>design.level==='Intricate'&&Object.isFrozen(design)));
 for(const motif of ['lion','elephant','wolf','peacock','turtle','buddha-meditation','buddha-face','dharma-wheel'])assert.ok(designs.some(d=>d.motif===motif));
});
