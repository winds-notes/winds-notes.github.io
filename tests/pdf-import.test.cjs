const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {randomUUID}=require('node:crypto'),pdfImport=require('../pdf-import.js'),creative=require('../creative-tools.js');
require('../native-file.js');require('../shared-notebook-model.js');
const native=globalThis.WindsFile,model=globalThis.WindsSharedModel;
const background=()=>({type:'pdf',src:'data:image/jpeg;base64,AAAA',thumbnail:'data:image/jpeg;base64,AQAA',width:1680,height:2174,sourceName:'Lecture.pdf',sourcePage:1});
const book=()=>({id:'book',title:'PDF notes',cover:'blue',createdAt:'2026-11-05T10:00:00Z',updatedAt:'2026-11-05T10:00:00Z',pages:[{id:'page',template:'blank',orientation:'portrait',background:background(),items:[]}]});
const ink=id=>({id,type:'stroke',tool:'artist',grade:'Fountain Pen',flow:.35,size:7,color:'#123456',points:[[10,20,.4],[30,40,.8]]});

test('PDF page selection is ordered, deduplicated and bounded before range expansion',()=>{
  assert.deepEqual(pdfImport.parsePages('3, 1-3, 8, 10-11',20),[1,2,3,8,10,11]);
  for(const text of ['', '0', '3-2', '1.5','1-9','1,,2','-1'])assert.throws(()=>pdfImport.parsePages(text,8));
  assert.throws(()=>pdfImport.parsePages('1-100000000',100000000),/50 pages/);
  assert.equal(pdfImport.parsePages('1-50,1-50',50).length,50);
});

test('PDF layout preserves aspect and rotated dimensions within the existing canvas budget',()=>{
  for(const [w,h] of [[612,792],[792,612],[1000,1000],[100000,200]]){
    const p=pdfImport.pageLayout(w,h);assert.ok(p.width*p.height<=2376*1680);assert.ok(Math.abs(p.width-w*p.scale)<=.5);assert.ok(Math.abs(p.height-h*p.scale)<=.5);
    const rect=creative.pageBackgroundRect(p,{width:p.width/2,height:p.height/2});
    assert.deepEqual(rect,{x:0,y:0,w:p.width/2,h:p.height/2});
  }
  assert.equal(pdfImport.pageLayout(792,612).orientation,'landscape');assert.throws(()=>pdfImport.pageLayout(0,100));
});

test('fixed PDF backgrounds and editable ink round-trip in native version one and backup files',()=>{
  const original=book();original.pages[0].items.push(ink('ink'));
  const text=native.serialize(original);assert.equal(JSON.parse(text).version,1);
  for(const parsed of [native.parse(text),native.parse(JSON.stringify({format:'winds-notes-backup',notebooks:[original]}))]){
    const page=parsed.notebooks[0].pages[0];assert.deepEqual(page.background,original.pages[0].background);assert.equal(page.items[0].flow,.35);assert.equal(page.items[0].grade,'Fountain Pen');assert.equal(page.items.length,1);
  }
  const legacy=book();delete legacy.pages[0].background;assert.equal(native.parse(native.serialize(legacy)).notebooks[0].pages[0].background,undefined);
});

test('invalid PDF backgrounds reject the whole import before notebook changes',()=>{
  for(const field of [{src:'https://example.test/page.jpg'},{src:'data:image/svg+xml;base64,AAAA'},{thumbnail:undefined},{width:100000},{height:0},{sourcePage:0},{type:'unknown'}]){
    const input=book();Object.assign(input.pages[0].background,field);assert.throws(()=>native.parse(native.serialize(input)),/PDF|background/);
  }
});

test('shared replay retains a PDF background while merging independent ink and imported pages',()=>{
  const seed=book(),baseline=model.fingerprint(seed),a=structuredClone(seed),b=structuredClone(seed);
  a.pages[0].items.push(ink('alice'));b.pages[0].items.push(ink('bob'));b.pages.push({...structuredClone(seed.pages[0]),id:'new-page'});
  const batch=(id,changes)=>({format:'winds-shared-edit',version:1,id,at:'2026-11-05T10:01:00Z',changes});
  const merged=model.replay(seed,[batch('a',model.diff(a,baseline)),batch('b',model.diff(b,baseline))]);
  assert.deepEqual(merged.pages[0].background,seed.pages[0].background);assert.equal(merged.pages.length,2);assert.deepEqual(merged.pages[1].background,seed.pages[0].background);
  assert.deepEqual(merged.pages[0].items.map(i=>i.id),['alice','bob']);
});

function controller({renderPage}={}){
  const elements=new Map(),commits=[],toasts=[],renders=[];let workspace='account-a',destroyed=0;
  const el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,value:'',textContent:'',isConnected:true,offsetParent:{},classList:{toggle(){}},focus(){},querySelectorAll:()=>[]});return elements.get(id);};
  const canvas=()=>({width:1,height:1,getContext:()=>({drawImage(){}}),toDataURL:()=>background().src});
  const pdf={numPages:3,async getPage(number){return {getViewport:({scale})=>({width:612*scale,height:792*scale}),cleanup(){},render(){renders.push(number);return renderPage?.(number,renders.length)||{promise:Promise.resolve(),cancel(){}};}};}};
  const loading={promise:Promise.resolve(pdf),destroy:async()=>{destroyed++;}};
  const context={URL,Uint8Array,console,Promise,document:{baseURI:'https://notes.example.test/project/',activeElement:el('trigger'),getElementById:el,createElement:canvas,addEventListener(){}},
    setTimeout:callback=>{queueMicrotask(callback);return 1;},__pdfLibrary:{AnnotationMode:{ENABLE:1},PasswordResponses:{INCORRECT_PASSWORD:2},GlobalWorkerOptions:{},getDocument:()=>loading}};
  el('pdfImportPreview').getContext=()=>({});context.window=context;
  const source=fs.readFileSync(require.resolve('../pdf-import.js'),'utf8').replace("import('./vendor/pdfjs/pdf.min.mjs')",'Promise.resolve(global.__pdfLibrary)');vm.runInNewContext(source,context);
  context.WindsPDFImport.init({context:()=>({workspace,bookId:'book',bookTitle:'Physics'}),prepare:async()=>{},commit:async(value,scope)=>{commits.push({value,scope});return {saved:true};},toast:text=>toasts.push(text)});
  const file={name:'Lesson.pdf',size:100,arrayBuffer:async()=>new ArrayBuffer(10)};
  return {api:context.WindsPDFImport,el,commits,renders,toasts,open:()=>context.WindsPDFImport.open(file),get destroyed(){return destroyed;},switchAccount(){workspace='account-b';}};
}

test('PDF importer commits every selected page together after rendering and reopens with enabled controls',async()=>{
  const c=controller();await c.open();c.el('pdfPageRange').value='2-3';await c.el('pdfImportStart').onclick();
  assert.equal(c.commits.length,1);assert.equal(c.commits[0].value.pages.length,2);assert.equal(c.commits[0].value.pages[0].background.sourcePage,2);assert.equal(c.api.isOpen(),false);
  await c.open();assert.equal(c.el('pdfImportOptions').disabled,false);assert.equal(c.el('pdfTitleControl').hidden,false);c.el('pdfImportCancel').onclick();
});

test('a failed PDF page cannot commit a partly imported notebook',async()=>{
  const c=controller({renderPage:number=>number===2?{promise:Promise.reject(Error('Damaged page')),cancel(){}}:null});await c.open();await c.el('pdfImportStart').onclick();
  assert.equal(c.commits.length,0);assert.match(c.el('pdfImportStatus').textContent,/Damaged page/);assert.equal(c.el('pdfImportOptions').disabled,false);c.el('pdfImportCancel').onclick();
});

test('cancelling a pending PDF render destroys the task and commits nothing',async()=>{
  let reject,started;const began=new Promise(r=>{started=r;});
  const c=controller({renderPage:(number,call)=>call>1?{promise:new Promise((resolve,r)=>{reject=r;started();}),cancel(){reject(Error('Cancelled render'));}}:null});
  await c.open();const importing=c.el('pdfImportStart').onclick();await began;c.el('pdfImportCancel').onclick();await importing;
  assert.equal(c.api.isOpen(),false);assert.equal(c.commits.length,0);assert.ok(c.destroyed>0);
});

test('an account change during PDF rendering cannot import into the new account',async()=>{
  let release,started;const gate=new Promise(r=>{release=r;}),began=new Promise(r=>{started=r;});
  const c=controller({renderPage:(number,call)=>{if(call>1){started();return {promise:gate,cancel(){}};}return null;}});
  await c.open();const importing=c.el('pdfImportStart').onclick();await began;c.switchAccount();release();await importing;
  assert.equal(c.commits.length,0);assert.match(c.el('pdfImportStatus').textContent,/account changed/);c.el('pdfImportCancel').onclick();
});

function editor(){
  let release;const gate=new Promise(r=>{release=r;}),context={state:{notebooks:[book()]},workspaceId:'account-a',dirtyAll:false,saveVersion:0,crypto:{randomUUID},uid:randomUUID,now:()=>new Date().toISOString(),$:()=>({value:''}),
    pdfImage:()=>({promise:gate}),saveNow:async()=>{context.dirtyAll=false;},openNotebook:id=>{context.opened=id;},switchPage:index=>{context.pageIndex=index;},WindsFile:native};
  context.window=context;const source=fs.readFileSync(require.resolve('../app.js'),'utf8');vm.runInNewContext(source.slice(source.indexOf('  async function commitPdfPages('),source.indexOf('  async function openEditableFile(')),context);
  const result={title:'Imported',append:false,pages:[{template:'blank',orientation:'portrait',background:background(),items:[]}]};
  return {context,result,release};
}

test('PDF app bridge appends pages without replacing existing ink or sharing metadata',async()=>{
  const e=editor(),original=e.context.state.notebooks[0];original.pages[0].items.push(ink('own'));original._sharing={folderId:'folder',baseline:{a:'b'},pending:[]};
  const commit=e.context.commitPdfPages({...e.result,append:true},{workspace:'account-a',bookId:'book'});e.release();await commit;
  const merged=e.context.state.notebooks[0];assert.equal(merged.pages.length,2);assert.equal(merged.pages[0],original.pages[0]);assert.equal(merged.pages[0].items[0].id,'own');assert.deepEqual(merged._sharing,original._sharing);assert.equal(e.context.pageIndex,1);
});

test('PDF app bridge rechecks account after image decoding before inserting anything',async()=>{
  const e=editor(),before=e.context.state.notebooks.slice(),work=e.context.commitPdfPages(e.result,{workspace:'account-a'});
  e.context.workspaceId='account-b';e.release();await assert.rejects(work,/account changed/);assert.deepEqual(e.context.state.notebooks,before);assert.equal(e.context.saveVersion,0);
});

test('validated immutable PDF backgrounds reuse validation and fingerprints without hiding later changes',()=>{
  const input=book(),first=native.validateShared(input),second=native.validateShared(input);
  assert.equal(first.pages[0].background,second.pages[0].background);assert.ok(Object.isFrozen(first.pages[0].background));
  assert.deepEqual(model.fingerprint(first),model.fingerprint(second));
  const baseline=model.fingerprint(first);input.pages[0].background.sourcePage=2;
  const changed=native.validateShared(input);assert.notEqual(changed.pages[0].background,first.pages[0].background);assert.ok(model.diff(changed,baseline).some(change=>change.key[0]==='page'));
  input.pages[0].background.src='https://example.test/untrusted.jpg';assert.throws(()=>native.validateShared(input),/PDF/);
});

test('an account change during the PDF save cannot open or navigate notes in the new account',async()=>{
  const e=editor();e.context.saveNow=async()=>{e.context.workspaceId='account-b';e.context.state.notebooks=[];};
  const work=e.context.commitPdfPages(e.result,{workspace:'account-a'});e.release();await assert.rejects(work,/account changed after saving/);
  assert.equal(e.context.opened,undefined);assert.equal(e.context.pageIndex,undefined);
});

test('a PDF decode callback cannot repaint after a Pencil contact begins or the account changes',async()=>{
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),helper=source.slice(source.indexOf('  function pdfImage('),source.indexOf('  function prunePdfImages('));
  for(const change of ['pen','account']){
    const frames=[],timers=[],renders=[],current=book().pages[0],context={pdfBackgroundCache:new Map(),workspaceId:'account-a',pdfRepaintTimer:0,state:{drag:null,pinch:null,editingText:null,sidebarOpen:false},imageCropSession:null,bufferedPenInk:false,
      Image:class{},page:()=>current,requestAnimationFrame:fn=>frames.push(fn),setTimeout:fn=>{timers.push(fn);return 1;},clearTimeout(){},renderCanvas:()=>renders.push('canvas'),renderCloudChanges:()=>renders.push('deferred')};
    vm.runInNewContext(helper,context);const image=context.pdfImage(current.background.src);image.img.onload();await image.promise;assert.equal(frames.length,1);
    if(change==='pen')context.state.drag={kind:'draw'};else context.workspaceId='account-b';frames[0]();
    assert.deepEqual(renders,[]);assert.equal(timers.length,change==='pen'?1:0);
  }
});

test('PDF export preparation waits for input but remains usable after local storage failure',async()=>{
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),helper=source.slice(source.indexOf('  async function preparePdfExport('),source.indexOf('  function drawPage('));
  let decodes=0,waits=0;const context={workspaceId:'account-a',state:{drag:{kind:'draw'}},imageCropSession:null,lastInkAt:0,SAVE_IDLE_MS:2500,Date,dirtyAll:true,
    delay:async()=>{waits++;context.state.drag=null;},pdfImage:()=>{decodes++;return {promise:Promise.resolve()};}};
  vm.runInNewContext(helper,context);await context.preparePdfExport(book().pages[0],'account-a');assert.equal(waits,1);assert.equal(decodes,1);
  await assert.rejects(context.preparePdfExport(book().pages[0],'account-b'),/account changed/);
});


test('closing a text annotation cannot commit it twice through a synchronous blur event',()=>{
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),helper=source.slice(source.indexOf('  function commitText('),source.indexOf('  async function importImage('));
  const items=[],item={id:'text',type:'text'},context={state:{editingText:{item,idx:-1}},page:()=>({items}),remember(){},scheduleSave(){},renderThumbs(){},renderCanvas(){}};
  let hidden=false;const editor={value:'Review this section',get hidden(){return hidden;},set hidden(value){if(hidden!==value){hidden=value;context.commitText();}}};context.$=()=>editor;
  vm.runInNewContext(helper,context);context.commitText();assert.equal(items.length,1);assert.equal(items[0].text,'Review this section');assert.equal(context.state.editingText,null);
});

test('prepared export links are replaced safely and cleared when discarded',()=>{
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),helper=source.slice(source.indexOf('  function clearPreparedExport('),source.indexOf('  async function backup('));
  const link={hidden:true,removeAttribute(name){delete this[name];}},revoked=[],context={preparedExport:null,preparedExportTimer:0,$:()=>link,URL:{createObjectURL:()=> 'blob:test-'+revoked.length,revokeObjectURL:url=>revoked.push(url)},
    setTimeout:()=>1,clearTimeout(){},document:{createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}}};
  vm.runInNewContext(helper,context);context.downloadBlob({},'First.pdf');assert.equal(link.hidden,false);assert.equal(link.download,'First.pdf');
  context.downloadBlob({},'Second.pdf');assert.equal(revoked.length,1);context.clearPreparedExport();assert.equal(revoked.length,2);assert.equal(link.hidden,true);assert.equal(link.href,undefined);
});

test('an asynchronous image export cannot expose a prepared download after switching accounts',async()=>{
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),helper=source.slice(source.indexOf('  async function exportCurrent('),source.indexOf('  function showModal('));
  let encode,started,downloads=0;const encoding=new Promise(resolve=>{started=resolve;}),button={querySelector:()=>({})};
  const context={workspaceId:'account-a',state:{pageIndex:0},notebook:()=>book(),page:()=>book().pages[0],commitText(){},closeMenus(){},finishActiveStroke(){},
    $:()=>button,preparePdfExport:async()=>{},renderExportCanvas:()=>({toBlob:callback=>{encode=callback;started();}}),downloadBlob:()=>{downloads++;},toast(){},filename:x=>x,console:{error(){}}};
  vm.runInNewContext(helper,context);const work=context.exportCurrent('png');await encoding;context.workspaceId='account-b';encode({});await work;
  assert.equal(downloads,0);assert.equal(button.disabled,false);
});


test('new sharing copies retain all page content with fresh IDs and no stale Drive link',async()=>{
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),helper=source.slice(source.indexOf('  async function copyNotebookForSharing('),source.indexOf('  async function putSharedNotebook('));
  const original=book();original._sharing={folderId:'missing-folder',pending:[{id:'unsent'}]};original.pages[0].items.push(ink('ink'));
  const context={state:{notebooks:[original]},workspaceId:'account-a',imageCropSession:null,saving:false,cloudSyncDelay:()=>0,WindsFile:native,now:()=>new Date().toISOString(),dirtyAll:false,saveVersion:0,saveNow:async()=>{context.dirtyAll=false;},renderLibrary(){}};context.window=context;
  vm.runInNewContext(helper,context);const id=await context.copyNotebookForSharing('book'),copy=context.state.notebooks[1];
  assert.equal(id,copy.id);assert.notEqual(copy.id,original.id);assert.notEqual(copy.pages[0].id,original.pages[0].id);assert.equal(copy._sharing,undefined);assert.deepEqual(copy.pages[0].background,original.pages[0].background);assert.equal(copy.pages[0].items[0].grade,'Fountain Pen');assert.equal(context.state.notebooks[0],original);assert.equal(original._sharing.pending.length,1);
});
test('a sharing copy cannot open under another account after its local save',async()=>{
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),helper=source.slice(source.indexOf('  async function copyNotebookForSharing('),source.indexOf('  async function putSharedNotebook('));let renders=0;
  const context={state:{notebooks:[book()]},workspaceId:'account-a',imageCropSession:null,saving:false,cloudSyncDelay:()=>0,WindsFile:native,now:()=>new Date().toISOString(),dirtyAll:false,saveVersion:0,saveNow:async()=>{context.workspaceId='account-b';context.state.notebooks=[];},renderLibrary(){renders++;}};context.window=context;
  vm.runInNewContext(helper,context);await assert.rejects(context.copyNotebookForSharing('book'),/account changed/);assert.equal(renders,0);assert.deepEqual(context.state.notebooks,[]);
});
