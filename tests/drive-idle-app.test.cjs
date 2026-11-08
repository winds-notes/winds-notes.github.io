const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const app=readFileSync(require.resolve('../app.js'),'utf8');
const helpers=app.slice(app.indexOf('  function cloudSyncDelay(){'),app.indexOf('  function seed(){'));

function book(updatedAt){return {id:'book',title:'Physics',updatedAt,pages:[{id:'page',items:[]}]};}
function editor(){
  let now=100000,timer=0,release;
  const tasks=new Map(),rendered=[],saveCalls=[],gate=new Promise(resolve=>{release=resolve;});
  const state={notebooks:[book('2026-11-04T10:00:00Z')],drag:null,editingText:null,activeId:'book',pageIndex:0};
  const context={state,CLOUD_IDLE_MS:Number(app.match(/const CLOUD_IDLE_MS = (\d+)/)[1]),lastInkAt:0,saving:false,dirtyAll:false,dirtyBooks:new Set(),dirtyPages:new Set(),
    imageCropSession:null,cloudRenderTimer:0,workspaceId:'g-1111111111',tombstones:{},saveVersion:0,
    Date:class extends Date{static now(){return now;}},
    setTimeout(callback,delay){const id=++timer;tasks.set(id,{callback,delay});return id;},
    clearTimeout:id=>tasks.delete(id),
    async saveNow(...args){saveCalls.push(args);context.saving=true;await gate;context.saving=false;context.dirtyAll=false;},
    notebook:()=>state.notebooks.find(n=>n.id===state.activeId),
    renderEditor:()=>rendered.push('editor'),renderLibrary:()=>rendered.push('library'),view:()=>{}
  };
  vm.runInNewContext(helpers+'\nglobalThis.cloud={mergeWorkspace,cloudSyncDelay};',context);
  return {context,state,tasks,rendered,saveCalls,release,advance:value=>{now+=value;}};
}

test('a Pencil stroke resumed during a remote IndexedDB save survives without a canvas re-render',async()=>{
  const e=editor();
  const saving=e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[book('2026-11-04T11:00:00Z')]});
  e.state.drag={kind:'draw'};e.context.lastInkAt=100000;
  const stroke={id:'new-stroke',type:'stroke',points:[[10,10,.5],[20,20,.7]]};
  e.state.notebooks[0].pages[0].items.push(stroke);e.release();await saving;
  assert.deepEqual(e.rendered,[]);assert.equal(e.state.drag.kind,'draw');
  assert.equal(e.state.notebooks[0].pages[0].items[0],stroke);
  const task=[...e.tasks.values()][0];assert.equal(task.delay,2500);
  e.state.drag=null;e.advance(2500);task.callback();
  assert.deepEqual(e.rendered,['editor']);assert.equal(e.state.notebooks[0].pages[0].items[0],stroke);
});

test('a recent stroke or unfinished local save prevents remote data replacement',async()=>{
  for(const pending of ['recent-stroke','local-save']){
    const e=editor(),original=e.state.notebooks;
    if(pending==='recent-stroke')e.context.lastInkAt=99000;else e.context.dirtyPages.add('page');
    await assert.rejects(e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[book('2026-11-04T11:00:00Z')]}),err=>err.syncDeferred===true);
    assert.equal(e.state.notebooks,original);assert.deepEqual(e.rendered,[]);
  }
});

test('a deferred cloud render cannot repaint a different account workspace',async()=>{
  const e=editor(),saving=e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[book('2026-11-04T11:00:00Z')]});
  e.state.drag={kind:'draw'};e.release();await saving;
  e.context.workspaceId='g-2222222222';e.state.drag=null;
  [...e.tasks.values()][0].callback();assert.deepEqual(e.rendered,[]);
});

test('remote updates also wait while two-finger zoom is active',async()=>{
  const e=editor();e.state.pinch={distance:120};
  assert.ok(e.context.cloud.cloudSyncDelay()>0);
  await assert.rejects(e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[book('2026-11-04T11:00:00Z')]}),err=>err.syncDeferred===true);
  assert.deepEqual(e.rendered,[]);
});

test('rapid strokes save together after a 2.5-second pause and notify Drive automatically',async()=>{
  let time=100000,id=0,notifications=0;
  const tasks=new Map(),writes=[];
  const state={drag:null,pinch:null,editingText:null,saveTimer:0,notebooks:[book('2026-11-04T10:00:00Z')]};
  const status={textContent:'Saved'};
  const context={state,SAVE_IDLE_MS:Number(app.match(/const SAVE_IDLE_MS = (\d+)/)[1]),lastInkAt:0,saving:false,
    dirtyAll:false,dirtyBooks:new Set(),dirtyPages:new Set(),saveVersion:0,imageCropSession:null,
    Date:class extends Date{static now(){return time;}},now:()=>new Date(time).toISOString(),
    notebook:()=>state.notebooks[0],page:()=>state.notebooks[0].pages[0],$:()=>status,
    setTimeout(callback,delay){const next=++id;tasks.set(next,{callback,delay});return next;},clearTimeout:timer=>tasks.delete(timer),
    statusText:value=>{status.textContent=value;},toast:()=>{},console:{error:()=>{}},
    writeChanged:async()=>{writes.push(structuredClone(state.notebooks));},writeData:async()=>{},
    window:{WindsDrive:{onLocalSave:()=>{notifications++;}}}
  };
  const saving=app.slice(app.indexOf('  function scheduleSave('),app.indexOf('  // Each signed-in Google identity'));
  vm.runInNewContext(saving+'\nglobalThis.saves={scheduleSave,saveNow};',context);
  assert.equal(context.SAVE_IDLE_MS,2500);
  state.notebooks[0].pages[0].items.push({id:'first-stroke'});context.saves.scheduleSave();
  time+=2000;state.notebooks[0].pages[0].items.push({id:'second-stroke'});context.saves.scheduleSave();
  assert.equal(tasks.size,1);assert.equal([...tasks.values()][0].delay,2500);
  state.drag={kind:'draw'};await context.saves.saveNow();assert.equal(writes.length,0);
  state.drag=null;time+=2500;await [...tasks.values()][0].callback();
  assert.equal(writes.length,1);assert.equal(writes[0][0].pages[0].items.length,2);
  assert.equal(notifications,1);assert.equal(status.textContent,'Saved');
  context.dirtyAll=true;await context.saves.saveNow(true,true);
  assert.equal(notifications,1,'a received workspace is saved locally without reporting a new edit');
  context.saves.scheduleSave();await context.saves.saveNow(true);
  assert.equal(notifications,2,'subsequent local edits still notify Drive');
});

test('a remote-only merge reports no upload and saves without echoing a local edit',async()=>{
  const e=editor(),remote=book('2026-11-04T11:00:00Z');
  const merging=e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[remote]},{report:true});
  e.release();const result=await merging;
  assert.equal(result.changed,true);assert.equal(result.needsUpload,false);
  assert.deepEqual(e.saveCalls,[[true,true]]);assert.equal(e.state.notebooks[0],remote);
});

test('merge reports retain uploads for local-only notebooks, newer edits and deletion markers',async()=>{
  for(const contribution of ['local-book','newer-edit','deletion']){
    const e=editor(),remote=book('2026-11-04T10:00:00Z');
    if(contribution==='local-book')e.state.notebooks.push({...book('2026-11-04T10:00:00Z'),id:'local-only'});
    if(contribution==='newer-edit')e.state.notebooks[0].updatedAt='2026-11-04T12:00:00Z';
    if(contribution==='deletion')e.context.tombstones={'deleted-elsewhere':'2026-11-04T12:00:00Z'};
    const result=await e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[remote],deleted:{}},{report:true});
    assert.equal(result.needsUpload,true,contribution);assert.equal(result.changed,false,contribution);
  }
});

test('private workspace retrieval cannot overwrite a shared notebook edit baseline or outbox',async()=>{
  const e=editor(),original=e.state.notebooks[0];
  original._sharing={folderId:'shared-folder',baseline:{saved:'baseline'},pending:[{id:'pending-edit'}]};
  await e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[book('2026-11-04T15:00:00Z')],deleted:{}},{report:true});
  assert.equal(e.state.notebooks[0],original);assert.equal(e.state.notebooks[0]._sharing.pending[0].id,'pending-edit');
});

test('PDF import defers both automatic and manual remote replacement until the modal task finishes',async()=>{
  const e=editor(),original=e.state.notebooks;e.context.WindsPDFImport={isOpen:()=>true};
  assert.equal(e.context.cloud.cloudSyncDelay(),2500);
  for(const manual of [false,true])await assert.rejects(e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[book('2026-11-05T10:00:00Z')]},{manual}),err=>err.syncDeferred===true);
  assert.equal(e.state.notebooks,original);assert.deepEqual(e.rendered,[]);
});

test('text formatting drafts defer automatic and manual remote replacements',async()=>{
  const e=editor(),original=e.state.notebooks;e.context.WindsText={isOpen:()=>true};
  assert.equal(e.context.cloud.cloudSyncDelay(),2500);
  for(const manual of [false,true])await assert.rejects(e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[book('2026-11-05T10:00:00Z')]},{manual}),err=>err.syncDeferred===true);
  assert.equal(e.state.notebooks,original);assert.deepEqual(e.rendered,[]);
});


test('an account change while a remote save completes cannot render the new account',async()=>{
  const e=editor(),saving=e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[book('2026-11-04T11:00:00Z')]});
  e.context.workspaceId='g-2222222222';e.release();await saving;
  assert.deepEqual(e.rendered,[]);
});


test('closed-area filling defers automatic and manual incoming workspace replacement',async()=>{
  const e=editor(),original=e.state.notebooks;e.context.WindsBoundaryFill={isActive:()=>true};
  assert.equal(e.context.cloud.cloudSyncDelay(),2500);
  for(const manual of [false,true])await assert.rejects(e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[book('2026-11-05T10:00:00Z')]},{manual}),err=>err.syncDeferred===true);
  assert.equal(e.state.notebooks,original);assert.deepEqual(e.rendered,[]);
});


test('the mandala studio defers incoming workspace replacement until its dialog closes',async()=>{
 const e=editor(),original=e.state.notebooks;e.context.WindsMandala={isOpen:()=>true};
 assert.equal(e.context.cloud.cloudSyncDelay(),2500);
 for(const manual of [false,true])await assert.rejects(e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[book('2026-11-05T10:00:00Z')]},{manual}),error=>error.syncDeferred===true);
 assert.equal(e.state.notebooks,original);
});

test('leaving Fill selected while idle does not pause Drive synchronization',async()=>{
 const e=editor();e.context.WindsBoundaryFill={isSelected:()=>true,isActive:()=>false};
 assert.equal(e.context.cloud.cloudSyncDelay(),0);
 const receiving=e.context.cloud.mergeWorkspace({format:'winds-notes-backup',notebooks:[book('2026-11-05T10:00:00Z')]});
 e.release();await receiving;assert.equal(e.state.notebooks[0].updatedAt,'2026-11-05T10:00:00Z');
});
