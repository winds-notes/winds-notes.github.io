const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{randomUUID}=require('node:crypto');
const source=readFileSync(require.resolve('../app.js'),'utf8');
const helper=source.slice(source.indexOf('  async function putSharedNotebook('),source.indexOf('  function openNotebook('));
function notebook(){return {id:'book',title:'Shared',cover:'purple',createdAt:'2026-11-04T10:00:00Z',updatedAt:'2026-11-04T10:00:00Z',pages:[{id:'page',template:'ruled',orientation:'portrait',items:[{id:'own',type:'stroke',tool:'pen',color:'#123456',size:3,points:[[1,1,.5],[2,2,.6]]}]}]};}
function editor(){
  const context={crypto:{randomUUID},console,Date,Map,Set,JSON};context.window=context;
  for(const file of ['native-file.js','shared-notebook-model.js'])vm.runInNewContext(readFileSync(require.resolve('../'+file),'utf8'),context);
  const original=context.WindsFile.validateShared(notebook()),history=new Map([['page',{undo:[{kind:'append',item:original.pages[0].items[0]},{kind:'snapshot',items:[]}],redo:[]}]]);
  Object.assign(context,{state:{notebooks:[original],activeId:'book',selected:0,drag:null,pinch:null,editingText:null},saveVersion:0,saving:false,dirtyAll:false,dirtyBooks:new Set(),dirtyPages:new Set(),imageCropSession:null,
    workspaceId:'g-account-a',tombstones:{},history,cloudSyncDelay:()=>0,saveNow:async()=>{context.dirtyAll=false;},renderCloudChanges:()=>{},toast:()=>{}});
  vm.runInNewContext(helper+'\nglobalThis.apply=putSharedNotebook;',context);return context;
}
test('shared metadata updates preserve local undo history',async()=>{
  const e=editor(),book=e.state.notebooks[0],history=e.history.get('page');
  await e.apply(book,{folderId:'folder-one',baseline:{},pending:[]},0,true,true);
  assert.equal(history.undo.length,2);assert.equal(e.state.selected,0);
});
test('new collaborator marks retain safe stroke undo and invalidate snapshots that could erase them',async()=>{
  const e=editor(),next=JSON.parse(JSON.stringify(e.state.notebooks[0]));
  next.pages[0].items.push({...next.pages[0].items[0],id:'collaborator'});
  await e.apply(next,{folderId:'folder-one',baseline:{},pending:[]},0,true,true);
  assert.equal(e.history.get('page').undo.length,1);assert.equal(e.history.get('page').undo[0].kind,'append');
  assert.equal(e.state.selected,-1);assert.equal(e.state.notebooks[0].pages[0].items.length,2);
});
test('joining a colliding notebook ID preserves the prior private notebook as a separate copy',async()=>{
  const e=editor(),next=JSON.parse(JSON.stringify(e.state.notebooks[0]));next.title='Invited notebook';
  await e.apply(next,{folderId:'folder-one',baseline:{},pending:[]},0,false,true);
  assert.equal(e.state.notebooks.length,2);assert.equal(e.state.notebooks[0].title,'Invited notebook');
  const copy=e.state.notebooks.find(n=>n.id!=='book');assert.match(copy.title,/private copy/);assert.equal(copy._sharing,undefined);
  assert.notEqual(copy.pages[0].items[0].id,'own');
});
test('active input or changed save versions defer a shared apply without replacing data',async()=>{
  for(const mode of ['drawing','version']){
    const e=editor(),original=e.state.notebooks[0];if(mode==='drawing')e.state.drag={kind:'draw'};else e.saveVersion++;
    await assert.rejects(e.apply(original,{folderId:'folder-one'},0,true,true),error=>error.syncDeferred===true);
    assert.equal(e.state.notebooks[0],original);assert.equal(e.state.notebooks.length,1);
  }
});
test('a failed durable save cannot acknowledge a shared outbox as saved',async()=>{
  const e=editor();e.saveNow=async()=>{};
  await assert.rejects(e.apply(e.state.notebooks[0],{folderId:'folder-one',baseline:{},pending:[{id:'pending'}]},0,true,true),error=>error.syncDeferred===true);
  assert.equal(e.dirtyAll,true);assert.equal(e.state.notebooks[0]._sharing.pending[0].id,'pending');
});
