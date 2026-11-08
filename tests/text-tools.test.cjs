const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const text=require('../text-tools.js');require('../native-file.js');require('../shared-notebook-model.js');const native=globalThis.WindsFile,model=globalThis.WindsSharedModel;
const item=()=>({id:'text-id',type:'text',x:30,y:40,w:300,size:24,color:'#123456',text:'Editable words\nSecond line',fontFamily:'Georgia',bold:true,italic:true,underline:true,align:'center',lineHeight:1.7});
const book=i=>({id:'book',title:'Formatted text',createdAt:'2026-11-05T10:00:00Z',updatedAt:'2026-11-05T10:00:00Z',cover:'purple',pages:[{id:'page',orientation:'portrait',template:'ruled',items:[i]}]});
function canvas(){const log=[];return {log,measureText:value=>({width:value.length*10}),fillText:(...args)=>log.push(['text',...args]),beginPath(){},moveTo:(...args)=>log.push(['move',...args]),lineTo:(...args)=>log.push(['line',...args]),stroke(){log.push(['stroke']);}};}
test('old unformatted text keeps Arial, its size and original line spacing',()=>{
  const legacy={type:'text',x:0,y:0,w:200,size:20,color:'#123456',text:'one two\nthree'},ctx=canvas(),layout=text.layout(ctx,legacy);assert.equal(text.font(legacy),'20px Arial, Helvetica, sans-serif');assert.equal(layout.h,2*20*1.42);assert.deepEqual(layout.lines,['one two','three']);
  const parsed=native.parse(native.serialize(book(legacy))).notebooks[0].pages[0].items[0];assert.equal(parsed.fontFamily,undefined);assert.equal(parsed.lineHeight,undefined);
});
test('text font, emphasis, alignment and spacing survive native, backup, clipboard and shared replay',()=>{
  const original=book(item()),serialized=native.serialize(original);assert.equal(JSON.parse(serialized).version,1);
  const clipboard=require('../clipboard.js');const copies=[native.parse(serialized).notebooks[0],native.parse(JSON.stringify({format:'winds-notes-backup',notebooks:[original]})).notebooks[0],{pages:[{items:clipboard.decode(clipboard.encode([item()]))}]}];
  for(const copy of copies){const t=copy.pages[0].items[0];for(const key of ['fontFamily','bold','italic','underline','align','lineHeight','text','size'])assert.deepEqual(t[key],item()[key]);}
  const before=book({...item(),bold:false}),batch={format:'winds-shared-edit',version:1,id:'style-change',at:'2026-11-05T10:00:00Z',changes:model.diff(original,model.fingerprint(before))};assert.equal(model.replay(before,[batch]).pages[0].items[0].bold,true);
});
test('font families are allowlisted and unsupported style values cannot inject CSS',()=>{
  const bad={...item(),fontFamily:'Arial; background:url(https://example.test/)',bold:'true',italic:'url(x)',align:'justify',lineHeight:99};
  const clean=native.validateShared(book(bad)).pages[0].items[0];assert.equal(clean.fontFamily,'Arial');assert.equal(clean.bold,false);assert.equal(clean.italic,false);assert.equal(clean.align,'left');assert.equal(clean.lineHeight,3);
  for(const f of text.FONTS)assert.equal(native.validateShared(book({...item(),fontFamily:f.name})).pages[0].items[0].fontFamily,f.name);
});
test('the shared text renderer applies font, center/right alignment, underline and line spacing',()=>{
  const t=item(),ctx=canvas();text.draw(ctx,t);assert.match(ctx.font,/italic bold 24px Georgia/);assert.equal(ctx.fillStyle,t.color);assert.equal(ctx.textAlign,'left');
  const draws=ctx.log.filter(x=>x[0]==='text');assert.equal(draws[0][2],30+(300-'Editable words'.length*10)/2);assert.equal(draws[1][3],40+24*1.7);assert.equal(ctx.log.filter(x=>x[0]==='stroke').length,2);
  const right=canvas();text.draw(right,{...t,align:'right',underline:false});assert.equal(right.log[0][2],30+300-'Editable words'.length*10);assert.equal(right.log.some(x=>x[0]==='stroke'),false);
});
test('large unbroken words wrap within narrow text boxes without splitting grapheme clusters',()=>{
  const ctx={measureText:value=>({width:[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].length*10})};
  assert.deepEqual(text.wrap(ctx,'abcdefgh',30),['abc','def','gh']);assert.deepEqual(text.wrap(ctx,'👨‍👩‍👧‍👦👨‍👩‍👧‍👦',10),['👨‍👩‍👧‍👦','👨‍👩‍👧‍👦']);assert.ok(text.layout(ctx,{...item(),text:'One',lineHeight:.8}).h>24);
});
function controller(){
  const elements=new Map(),applied=[];const el=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,style:{},attributes:{},focus(){},replaceChildren(){},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},querySelectorAll:()=>[]});return elements.get(id);};
  const context={document:{getElementById:el,activeElement:null,createElement:()=>({})},console};context.window=context;vm.runInNewContext(fs.readFileSync(require.resolve('../text-tools.js'),'utf8'),context);context.WindsText.init({apply:(value,scope)=>applied.push({value,scope})});return {api:context.WindsText,el,applied};
}
test('text editing previews a draft, cancel leaves the original intact, and apply retains identity',()=>{
  const c=controller(),original=item(),snapshot=JSON.stringify(original);c.api.open(original,{account:'a'});c.el('textEditContent').value='Changed';c.el('textEditFont').value='Courier New';c.el('textEditFont').oninput();assert.equal(c.el('textEditContent').style.fontFamily,'"Courier New", Courier, monospace');c.el('textEditCancel').onclick();assert.equal(JSON.stringify(original),snapshot);assert.equal(c.applied.length,0);
  c.api.open(original,{account:'a'});c.el('textEditContent').value='Changed';c.el('textEditSize').value='36';c.el('textEditBold').onclick();c.el('textEditForm').onsubmit({preventDefault(){}});assert.equal(c.applied.length,1);assert.equal(c.applied[0].value.id,original.id);assert.equal(c.applied[0].value.bold,false);assert.equal(c.applied[0].value.size,36);assert.equal(c.api.isOpen(),false);
});
test('invalid numeric settings keep the editor open, and a font-only edit preserves legacy color alpha',()=>{
  const c=controller();c.api.open({...item(),color:'#12345688'},{});c.el('textEditSize').value='NaN';c.el('textEditForm').onsubmit({preventDefault(){}});assert.equal(c.applied.length,0);assert.equal(c.api.isOpen(),true);
  c.el('textEditSize').value='25';c.el('textEditForm').onsubmit({preventDefault(){}});assert.equal(c.applied[0].value.color,'#12345688');
});
function editor(){
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),helper=source.slice(source.indexOf('  function applyEditedText('),source.indexOf('  let clipboardPlacement=')),current=item(),items=[current],histories=[],context={workspaceId:'a',state:{activeId:'book',selected:0},saveVersion:5,imageCropSession:null,WindsText:text,page:()=>({id:'page',items}),remember:()=>histories.push(structuredClone(items)),scheduleSave(){},renderCanvas(){},renderThumbs(){},toast(){}};context.window=context;vm.runInNewContext(helper,context);return {context,current,items,histories,scope:{account:'a',book:'book',page:'page',item:current,version:5}};
}
test('applying content and formatting makes one undo snapshot and retains text position/ID',()=>{
  const e=editor();e.context.applyEditedText({...e.current,text:'Updated content',fontFamily:'Verdana',size:38},e.scope);assert.equal(e.histories.length,1);assert.equal(e.histories[0][0].text,e.current.text);assert.equal(e.items[0].id,e.current.id);assert.equal(e.items[0].x,30);assert.equal(e.items[0].fontFamily,'Verdana');assert.equal(e.context.state.textStyle.size,38);assert.equal(e.current.text,'Editable words\nSecond line');
});
test('account/page/version changes cannot apply a stale text draft',()=>{
  for(const change of ['account','page','version']){const e=editor();if(change==='account')e.context.workspaceId='b';if(change==='page')e.context.state.activeId='other';if(change==='version')e.context.saveVersion=6;assert.throws(()=>e.context.applyEditedText({...e.current,text:'Stale draft'},e.scope),/changed/);assert.equal(e.histories.length,0);assert.equal(e.items[0],e.current);}
});

test('Enter on a toolbar button does not unexpectedly open the selected text editor',()=>{
  const app=fs.readFileSync(require.resolve('../app.js'),'utf8'),start=app.indexOf("    document.addEventListener('keydown',e=>{\n      if(globalThis.WindsText"),end=app.indexOf("    document.addEventListener('visibilitychange'",start);let handler,opened=0,prevented=0;
  const context={imageCropSession:null,WindsText:{isOpen:()=>false},WindsPDFImport:{isOpen:()=>false},document:{activeElement:{tagName:'BUTTON'},addEventListener:(event,fn)=>{handler=fn;}},$:id=>({hidden:id!=='editorView'}),state:{selected:0},page:()=>({items:[item()]}),editSelectedText:()=>{opened++;}};
  vm.runInNewContext(app.slice(start,end),context);handler({key:'Enter',target:{matches:()=>false},preventDefault(){prevented++;}});assert.equal(opened,0);assert.equal(prevented,0);
});
