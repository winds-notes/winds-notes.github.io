const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const app=readFileSync(require.resolve('../app.js'),'utf8');
const slice=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function saves(){
  const writes=[],timers=new Map();let timer=0;
  const context={state:{saveTimer:0,notebooks:[],pointers:new Map()},saving:false,dirtyAll:true,dirtyBooks:new Set(),dirtyPages:new Set(),saveVersion:1,
    SAVE_IDLE_MS:2500,lastInkAt:0,imageCropSession:null,console:{error(){}},statusText(){},toast(){},
    setTimeout(fn){timers.set(++timer,fn);return timer;},clearTimeout(id){timers.delete(id);},window:{},
    writeData(){const write=deferred();writes.push(write);return write.promise;},writeChanged(){return context.writeData();}};
  vm.runInNewContext(slice('  function scheduleSave(','  // Each signed-in Google identity')+'\nglobalThis.saveNow=saveNow;',context);
  return {context,writes,timers};
}

test('forced saves wait for the active transaction and flush edits made during that save',async()=>{
  const {context:c,writes}=saves();
  const first=c.saveNow(true);assert.equal(writes.length,1);
  c.dirtyBooks.add('new-edit');c.saveVersion++;
  let finished=false;const second=c.saveNow(true).then(()=>{finished=true;});
  await tick();assert.equal(finished,false);assert.equal(writes.length,1);
  writes[0].resolve();await tick();assert.equal(writes.length,2);assert.equal(finished,false);
  writes[1].resolve();await Promise.all([first,second]);
  assert.equal(c.saving,false);assert.equal(c.dirtyBooks.size,0);assert.equal(finished,true);
});

test('overlapping forced saves stay sequential and failed writes retain unsaved data',async()=>{
  const {context:c,writes}=saves();
  const first=c.saveNow(true);writes[0].reject(Error('disk full'));await first;
  assert.equal(c.dirtyAll,true);assert.equal(c.saving,false);
  const next=c.saveNow(true),another=c.saveNow(true);
  assert.equal(writes.length,2);writes[1].resolve();await Promise.all([next,another]);
  assert.equal(writes.length,2);assert.equal(c.dirtyAll,false);
});

function workspace(){
  const {context:c,writes}=saves(),opens=[],old={closed:false,close(){this.closed=true;}};
  Object.assign(c,{database:old,persistence:'indexeddb',workspaceId:'guest',tombstones:{},history:new Map(),
    document:{body:{inert:false}},thumbnailTimer:0,inkComposeTimer:0,cloudRenderTimer:0,eraserPreview:null,groupSelection:null,
    cancelBoundaryFill(){},closePageReader(){},clearPreparedExport(){},finishActiveStroke(){},composeInkNow(){},commitText(){},delay:tick,
    $:()=>({value:''}),view(){},renderLibrary(){},async storageOpen(){const gate=deferred();opens.push({id:c.workspaceId,gate});await gate.promise;c.database={close(){}};},
    async loadData(){if(c.readError)throw Error('storage read failed');return {notebooks:[{id:c.workspaceId,pages:[]}]};}});
  c.window.WindsPageStack={reset(){}};
  vm.runInNewContext(slice('  // Each signed-in Google identity','  function workspaceSnapshot(')+'\nglobalThis.switchWorkspace=switchWorkspace;globalThis.lockInterface=lockInterface;',c);
  return {c,writes,opens,old};
}

test('account changes wait for durable saving and activate in requested order',async()=>{
  const {c,writes,opens,old}=workspace();
  const saving=c.saveNow(true),one=c.switchWorkspace('account-a'),two=c.switchWorkspace('account-b');
  await tick();assert.equal(opens.length,0);assert.equal(old.closed,false);assert.equal(c.document.body.inert,true);
  writes[0].resolve();await saving;await tick();assert.equal(opens[0].id,'g-account-a');
  assert.equal(old.closed,false);assert.equal(c.document.body.inert,true);
  opens[0].gate.resolve();await one;await tick();assert.equal(opens[1].id,'g-account-b');
  opens[1].gate.resolve();await two;
  assert.equal(c.workspaceId,'g-account-b');assert.equal(c.state.notebooks[0].id,'g-account-b');
  assert.equal(old.closed,true);assert.equal(c.document.body.inert,false);
});

test('a failed save prevents switching accounts or closing the current database',async()=>{
  const {c,writes,opens,old}=workspace();
  const change=c.switchWorkspace('account-a');await tick();writes[0].reject(Error('disk full'));
  await assert.rejects(change,/could not be saved/);
  assert.equal(opens.length,0);assert.equal(old.closed,false);assert.equal(c.workspaceId,'guest');assert.equal(c.dirtyAll,true);
});

test('a target workspace read failure retains the original library and connection',async()=>{
  const {c,opens,old}=workspace();c.dirtyAll=false;c.readError=true;
  const original=c.state.notebooks,change=c.switchWorkspace('account-a');await tick();opens[0].gate.resolve();
  await assert.rejects(change,/storage read failed/);
  assert.equal(c.database,old);assert.equal(old.closed,false);assert.equal(c.workspaceId,'guest');
  assert.equal(c.state.notebooks,original);assert.equal(c.document.body.inert,false);
});

function reader(overrides={}){
  const c={persistence:'indexeddb',workspaceId:'guest',workspaceLocalStorageKey:()=> 'notes',...overrides};
  vm.runInNewContext(slice('  function loadData(){','  function metadata(')+'\nglobalThis.loadData=loadData;',c);return c;
}

test('unreadable local storage rejects instead of becoming an empty library',async()=>{
  const c=reader({persistence:'localstorage',localStorage:{getItem:()=>'{broken'}});
  await assert.rejects(c.loadData());
  c.localStorage.getItem=()=>'{"notebooks":"damaged"}';await assert.rejects(c.loadData(),/damaged/);
  c.localStorage.getItem=()=>null;assert.equal(await c.loadData(),null);
});

test('failed and aborted IndexedDB reads reject instead of initializing new notebooks',async()=>{
  for(const event of ['onerror','onabort']){
    const tx={objectStore:()=>({getAll:()=>({}),get:()=>({})})};
    const c=reader({database:{transaction:()=>tx}}),result=c.loadData();tx[event]();
    await assert.rejects(result,/read|interrupted/);
  }
  const c=reader({database:{transaction(){throw Error('connection closed');}}});
  await assert.rejects(c.loadData(),/connection closed/);
});

test('a missing stored page is reported without silently dropping notebook content',async()=>{
  const tx={objectStore:name=>({getAll:()=>({result:name==='notebooks'?[{id:'book',pages:[{id:'missing'}]}]:[]}),get:()=>({result:true})})};
  const c=reader({database:{transaction:()=>tx}}),result=c.loadData();tx.oncomplete();
  await assert.rejects(result,/page could not be read/);
});

test('blocked database opens reject and close late connections without replacing an account database',async()=>{
  const request={},original={},late={closed:false,close(){this.closed=true;}};
  const c={window:{indexedDB:true},indexedDB:{open:()=>request},database:original,persistence:'indexeddb',workspaceDatabaseName:()=> 'notes'};
  vm.runInNewContext(slice('  function storageOpen(){','  function oldDatabase(){')+'\nglobalThis.storageOpen=storageOpen;',c);
  const opened=c.storageOpen();request.onblocked();await assert.rejects(opened,/another tab/);
  request.result=late;request.onsuccess();assert.equal(late.closed,true);assert.equal(c.database,original);assert.equal(c.persistence,'indexeddb');
});

test('a file read started in one account cannot import into a different account',async()=>{
  const file=deferred(),messages=[],c={workspaceId:'guest',inputBusy:()=>false,window:{WindsFile:{MAX_FILE_BYTES:100000,parse(){throw Error('must not parse');}}},state:{notebooks:[]},console:{error(){}},toast:message=>messages.push(message)};
  vm.runInNewContext(slice('  async function openEditableFile(','  async function exportCurrent(')+'\nglobalThis.openEditableFile=openEditableFile;',c);
  const pending=c.openEditableFile({name:'notes.winds-notes',size:1,text:()=>file.promise});
  c.workspaceId='g-different';file.resolve('{}');await pending;
  assert.equal(c.state.notebooks.length,0);assert.match(messages[0],/account changed/);
});

test('an image decoding after navigation cannot be inserted on the wrong page',async()=>{
  const decode=deferred(),messages=[],initial={items:[]};let current=initial;
  const c={workspaceId:'guest',page:()=>current,clipboardContext:()=>({}),clipboardWait:async()=>{},console:{error(){}},toast:message=>messages.push(message),
    FileReader:class{readAsDataURL(){this.result='data:image/png;base64,AA==';this.onload();}},
    Image:class{decode(){return decode.promise;}}};
  vm.runInNewContext(slice('  async function importImage(','  function clearPreparedExport(')+'\nglobalThis.importImage=importImage;',c);
  const pending=c.importImage({type:'image/png',size:1});await tick();current={items:[]};decode.resolve();await pending;
  assert.equal(initial.items.length,0);assert.equal(current.items.length,0);assert.match(messages[0],/destination changed/);
});


test('overlapping startup and automatic account activation unlock controls when both finish',async()=>{
  const {c,opens}=workspace();c.dirtyAll=false;
  const startupComplete=c.lockInterface(),switching=c.switchWorkspace('account-a');
  await tick();assert.equal(c.document.body.inert,true);
  startupComplete();assert.equal(c.document.body.inert,true,'account storage is still loading');
  opens[0].gate.resolve();await switching;
  assert.equal(c.document.body.inert,false,'the final operation must restore interaction');
  startupComplete();assert.equal(c.document.body.inert,false,'releasing a completed operation twice is harmless');
});


test('a backup awaiting local saving cannot download a different account workspace',async()=>{
  const gate=deferred(),downloads=[],c={workspaceId:'guest',state:{pendingInteractions:0,notebooks:[]},
    finishActiveStroke(){},commitText(){},inputBusy:()=>false,saveNow:()=>gate.promise,downloadBlob:(...args)=>downloads.push(args)};
  vm.runInNewContext(slice('  async function backup(){','  async function saveNativeNotebook(')+'\nglobalThis.backup=backup;',c);
  const backup=c.backup();c.workspaceId='g-other-account';gate.resolve();await backup;
  assert.equal(downloads.length,0);
});

test('native imports postpone parsing while a Pencil gesture is active',async()=>{
  const gate=deferred(),messages=[];let busy=true,parsed=false;
  const c={workspaceId:'guest',inputBusy:()=>busy,delay:()=>gate.promise,state:{notebooks:[]},
    window:{WindsFile:{MAX_FILE_BYTES:100000,parse(){parsed=true;}}},console:{error(){}},toast:message=>messages.push(message)};
  vm.runInNewContext(slice('  async function openEditableFile(','  async function exportCurrent(')+'\nglobalThis.openEditableFile=openEditableFile;',c);
  const imported=c.openEditableFile({name:'notes.winds-notes',size:1,text:async()=> '{}'});
  await tick();assert.equal(parsed,false);
  c.workspaceId='g-other-account';busy=false;gate.resolve();await imported;
  assert.equal(parsed,false);assert.match(messages[0],/account changed/);
});
