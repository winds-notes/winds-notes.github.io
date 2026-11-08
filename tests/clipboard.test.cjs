const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
require('../native-file.js');const clipboard=require('../clipboard.js'),native=globalThis.WindsFile;
const source=fs.readFileSync(require.resolve('../clipboard.js'),'utf8');
function stroke(){return {id:'source-ink',type:'stroke',tool:'artist',grade:'6B',flow:.4,color:'#112233',size:7,points:[[10,20,.3],[30,50,.9]]};}
function text(){return {id:'source-text',type:'text',text:'Copied words\nSecond line',x:10,y:20,w:300,size:24,color:'#112233'};}
test('editable clipboard round trips artist ink, styled shapes, cropped images, stickers and text',()=>{
  const items=[stroke(),{id:'shape',type:'shape',kind:'star',x:2,y:3,w:100,h:100,color:'#123456',size:7,fillColor:'#abcdef',fillOpacity:.4,strokeStyle:'dashed'},
    {id:'image',type:'image',x:1,y:2,w:30,h:40,src:'data:image/png;base64,AAAA',rotation:90,crop:{x:.1,y:.1,w:.8,h:.8}},
    {id:'sticker',type:'sticker',x:1,y:2,size:72,emoji:'🙂',rotation:45},text()];
  const decoded=clipboard.decode(clipboard.encode(items));assert.equal(decoded.length,5);assert.equal(decoded[0].grade,'6B');assert.equal(decoded[0].flow,.4);assert.equal(decoded[1].fillOpacity,.4);assert.equal(decoded[1].strokeStyle,'dashed');assert.equal(decoded[2].crop.w,.8);assert.equal(decoded[2].rotation,90);assert.equal(decoded[3].rotation,45);assert.equal(decoded[4].text,text().text);
});
test('clipboard validation rejects external URLs, unknown payloads and oversized selections',()=>{
  for(const input of ['{}',JSON.stringify({format:'winds-notes-clipboard',version:2,items:[text()]}),JSON.stringify({format:'winds-notes-clipboard',version:1,items:[{id:'bad',type:'image',src:'https://example.test/private.png'}]})])assert.throws(()=>clipboard.decode(input));
  assert.throws(()=>clipboard.decode('x'.repeat(clipboard.MAX_BYTES+1)),/10 MB/);
});
test('pasted geometry gets fresh IDs without changing pressure, crop, rotation or original objects',()=>{
  const original=[stroke(),{id:'image',type:'image',x:5,y:6,w:100,h:50,rotation:90,crop:{x:.2,y:0,w:.8,h:1},src:'data:image/png;base64,AAAA'}],before=JSON.stringify(original);let sequence=0;
  const moved=clipboard.moveItems(original,100,200,()=> 'new-'+ ++sequence);assert.equal(JSON.stringify(original),before);assert.deepEqual(moved[0].points,[[110,220,.3],[130,250,.9]]);assert.equal(moved[1].x,105);assert.equal(moved[1].rotation,90);assert.equal(moved[1].crop.x,.2);assert.deepEqual(moved.map(i=>i.id),['new-1','new-2']);
});
function controller({read,write,wait}={}){
  const elements=new Map(),listeners=new Map(),insertions=[],messages=[],removed=[];let account='account-a',page='page-a';
  const el=id=>{if(!elements.has(id))elements.set(id,{hidden:true,value:'',disabled:false,focus(){},querySelectorAll:()=>[]});return elements.get(id);};
  const context={WindsFile:native,Blob,console,navigator:{clipboard:{...(read?{read}:{}),...(write?{write}: {})}},document:{getElementById:el,addEventListener:(name,fn)=>listeners.set(name,fn)}};context.window=context;
  vm.runInNewContext(source,context);const scope=()=>({account,page}),matches=s=>s.account===account&&s.page===page;
  const adapter={enabled:()=>true,context:scope,matches,wait:wait||(async()=>{}),capture:()=>({scope:scope(),item:text(),original:'reference'}),png:async()=>new Blob(['png'],{type:'image/png'}),
    remove:s=>{if(!matches(s.scope))return false;removed.push(s);return true;},insert:(items,s)=>insertions.push({items,scope:s}),textItem:content=>({...text(),text:content}),imageItem:async(file)=>({id:'image',type:'image',file}),toast:message=>messages.push(message)};
  context.WindsClipboard.init(adapter);
  return {context,api:context.WindsClipboard,adapter,el,listeners,insertions,messages,removed,switchAccount:()=>{account='account-b';},switchPage:()=>{page='page-b';}};
}
const target={closest:()=>null},tick=()=>new Promise(resolve=>setImmediate(resolve));
test('external text paste creates literal editable text and preserves line breaks',async()=>{
  const c=controller();let prevented=false;const value='<img src=x onerror=alert(1)>\nPasted note';
  c.listeners.get('paste')({target,preventDefault(){prevented=true;},clipboardData:{getData:type=>type==='text/plain'?value:'',files:[]}});await tick();
  assert.equal(prevented,true);assert.equal(c.insertions.length,1);assert.equal(c.insertions[0].items[0].text,value);
});
test('copy/paste inside input fields is left to the browser',()=>{
  const c=controller(),field={closest:()=>({tagName:'TEXTAREA'})},event={target:field,preventDefault(){throw Error('native editing was blocked');},clipboardData:{getData:()=> 'hello',setData(){throw Error('native copy was replaced');}}};
  for(const name of ['copy','cut','paste'])c.listeners.get(name)(event);assert.equal(c.insertions.length,0);assert.equal(c.removed.length,0);
});
test('internal copying works without clipboard permission and is cleared across accounts',async()=>{
  const c=controller();await c.api.copy();await c.api.paste(true);assert.equal(c.insertions.length,1);assert.equal(c.insertions[0].items[0].text,text().text);
  c.switchAccount();c.api.clear();await c.api.paste(true);assert.equal(c.insertions.length,1);assert.match(c.messages.at(-1),/Copy a notebook object first/);
});
test('a delayed system paste cannot insert into another account or page',async()=>{
  for(const change of ['account','page']){let release;const c=controller({read:()=>new Promise(r=>{release=r;})});const work=c.api.paste();change==='account'?c.switchAccount():c.switchPage();release([{types:['text/plain'],getType:async()=>new Blob(['private text'])}]);await work;assert.equal(c.insertions.length,0);}
});
test('a copy finishing after account change cannot cut an object from the new account',async()=>{
  let release;const c=controller({write:()=>new Promise(r=>{release=r;})});c.context.ClipboardItem=class{};const work=c.api.copy(true);c.switchAccount();release();await work;assert.equal(c.removed.length,0);
});
test('permission-denied paste offers the native text box and cancelling prevents a pending insertion',async()=>{
  let release;const c=controller({read:async()=>{const e=Error('Denied');e.name='NotAllowedError';throw e;},wait:()=>new Promise(r=>{release=r;})});
  await c.api.paste();assert.equal(c.el('clipboardBackdrop').hidden,false);c.el('clipboardText').value='Will cancel';c.el('clipboardInsert').onclick();c.el('clipboardCancel').onclick();release();await tick();assert.equal(c.insertions.length,0);
});
test('native clipboard transfers editable objects and cut keeps a usable internal copy',async()=>{
  const c=controller(),data=new Map();let prevented=false;c.listeners.get('cut')({target,clipboardData:{setData:(key,value)=>data.set(key,value)},preventDefault(){prevented=true;}});
  assert.ok(prevented);assert.equal(c.removed.length,1);assert.equal(data.get('text/plain'),text().text);c.listeners.get('paste')({target,clipboardData:{getData:type=>data.get(type)||'',files:[]},preventDefault(){}});await tick();assert.equal(c.insertions.length,1);assert.equal(c.insertions[0].items[0].size,24);
});
test('pasted images are passed to the image decoder and unsupported document files explain import',async()=>{
  const c=controller(),file=new Blob(['image'],{type:'image/png'});c.listeners.get('paste')({target,clipboardData:{getData:()=>'',files:[file]},preventDefault(){}});await tick();assert.equal(c.insertions.length,1);assert.equal(c.insertions[0].items[0].file,file);
  c.listeners.get('paste')({target,clipboardData:{getData:()=>'',files:[new Blob(['pdf'],{type:'application/pdf'})]},preventDefault(){}});assert.match(c.messages.at(-1),/Import PDF/);
});

test('keyboard copy uses the system clipboard path while text-field shortcuts stay native',async()=>{
  let writes=0;const c=controller({write:async()=>{writes++;}});c.context.ClipboardItem=class{};let prevented=0;
  c.listeners.get('keydown')({target,metaKey:true,key:'c',preventDefault(){prevented++;}});await tick();assert.equal(writes,1);assert.equal(prevented,1);
  c.listeners.get('keydown')({target:{closest:()=>({tagName:'TEXTAREA'})},metaKey:true,key:'x',preventDefault(){throw Error('native editing blocked');}});assert.equal(c.removed.length,0);
});
test('a delayed cut cannot delete a selected object after another edit changes the notebook',()=>{
  const app=fs.readFileSync(require.resolve('../app.js'),'utf8'),start=app.indexOf('  function initClipboard(){'),end=app.indexOf('  let pageReaderObserver=',start),item=text();let adapter,history=0;
  const context={WindsClipboard:{init:value=>{adapter=value;}},selectionItems:()=>[item],state:{selected:0},saveVersion:10,clipboardContext:()=>({account:'a',page:'p'}),clipboardMatches:()=>true,clipboardEnabled:()=>true,clipboardWait(){},clipboardPng(){},clipboardImage(){},insertClipboardItems(){},toast(){},page:()=>({items:[item]}),clone:structuredClone,remember(){history++;}};context.window=context;
  vm.runInNewContext(app.slice(start,end),context);context.initClipboard();const snapshot=adapter.capture();context.saveVersion=11;assert.equal(adapter.remove(snapshot),false);assert.equal(history,0);
});

test('paste waits for a Pencil contact and quiet interval without waiting for unrelated autosaves',async()=>{
  const app=fs.readFileSync(require.resolve('../app.js'),'utf8'),start=app.indexOf('  async function clipboardWait('),end=app.indexOf('  function clipboardBounds(',start);let pauses=0;
  const context={clipboardMatches:()=>true,state:{drag:{kind:'draw'},lastPenAt:Date.now()},imageCropSession:null,Date,lastInkAt:Date.now(),delay:async()=>{pauses++;context.state.drag=null;context.state.lastPenAt=Date.now()-200;}};
  vm.runInNewContext(app.slice(start,end),context);await context.clipboardWait({});assert.equal(pauses,1);
  context.clipboardMatches=()=>false;await assert.rejects(context.clipboardWait({}),/account or page changed/);
});

test('an empty system clipboard opens an editable paste box instead of inserting an empty object',async()=>{
  const c=controller({read:async()=>[{types:['text/plain'],getType:async()=>new Blob([''])}]});await c.api.paste();assert.equal(c.el('clipboardBackdrop').hidden,false);assert.equal(c.insertions.length,0);c.el('clipboardText').value='Text box fallback';c.el('clipboardInsert').onclick();await tick();assert.equal(c.insertions[0].items[0].text,'Text box fallback');assert.equal(c.el('clipboardBackdrop').hidden,true);
});
test('native copy and cut preserve a whole handwriting selection with independent pressure samples',async()=>{
 const c=controller(),items=[stroke(),{...stroke(),id:'second',points:[[50,60,.4],[70,80,.8]]}],data=new Map();
 c.adapter.capture=()=>({scope:c.adapter.context(),items,item:items[0]});c.listeners.get('cut')({target,clipboardData:{setData:(key,value)=>data.set(key,value)},preventDefault(){}});
 assert.equal(c.removed.length,1);assert.equal(clipboard.decode(data.get('application/x-winds-notes-object+json')).length,2);
 c.listeners.get('paste')({target,clipboardData:{getData:type=>data.get(type)||'',files:[]},preventDefault(){}});await tick();assert.equal(c.insertions[0].items.length,2);assert.equal(c.insertions[0].items[1].points[1][2],.8);
});
