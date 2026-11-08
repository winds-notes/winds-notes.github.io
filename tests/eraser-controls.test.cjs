const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
function controls(){
 const elements=new Map(),presets=[8,28,80].map(size=>({dataset:{eraserSize:String(size)},setAttribute(name,value){this[name]=value;}}));
 const el=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,style:{},dataset:{},setAttribute(name,value){this[name]=value;}});return elements.get(id);};
 const stateText=source.slice(source.indexOf('  const state = '),source.indexOf('  const history = '));
 const helper=source.slice(source.indexOf('  function configureSize('),source.indexOf('  function historyForPage('));
 const context={COLORS:['#123456'],$:el,document:{querySelectorAll:()=>presets},Map,Set,renderArtistPreviews(){}};
 vm.runInNewContext(stateText+'\nglobalThis.state=state;\n'+helper,context);el('artistMenu').hidden=true;
 return {context,state:context.state,el,presets};
}
test('eraser defaults to all editable objects and opens with its independent size',()=>{
 const c=controls();assert.equal(c.state.eraserInkOnly,false);c.state.tool='eraser';c.context.configureSize();
 assert.equal(c.el('drawingSizeControl').hidden,true);assert.equal(c.el('eraserSize').value,'28');assert.equal(c.el('eraserMode').value,'all');assert.match(c.el('eraserHelp').textContent,/pasted text and images/);
});
test('eraser slider, exact number, presets and hidden legacy control share a clamped size without changing pen width',()=>{
 const c=controls();c.state.tool='eraser';c.context.configureSize();
 for(const size of [4,8,28,80,128]){c.context.setEraserSize(String(size));assert.equal(c.state.eraserSize,size);assert.equal(c.el('eraserSize').value,String(size));assert.equal(c.el('eraserSizeNumber').value,String(size));assert.equal(c.el('eraserSizeLabel').textContent,String(size));assert.equal(Number(c.el('penSize').value),size);assert.equal(c.state.size,7);}
 c.context.setEraserSize(999);assert.equal(c.state.eraserSize,128);c.context.setEraserSize(-3);assert.equal(c.state.eraserSize,4);c.context.setEraserSize('');c.context.setEraserSize('bad');assert.equal(c.state.eraserSize,4);
 c.el('penSize').value='64';c.context.updateSize();assert.equal(c.el('eraserSize').value,'64');
 c.state.tool='pen';c.context.configureSize();assert.equal(c.el('drawingSizeControl').hidden,false);assert.equal(Number(c.el('penSize').value),7);assert.equal(c.el('penSize').max,'32');assert.equal(c.state.eraserSize,64);
});
test('ink-only is an explicit option and explains why pasted text/images are protected',()=>{
 const c=controls();c.state.eraserInkOnly=true;c.context.syncEraserControls();assert.equal(c.el('eraserMode').value,'ink');assert.match(c.el('eraserHelp').textContent,/choose All objects/i);
});
test('eraser size and target survive a reload with safe fallback when storage is unavailable',()=>{
 const c=controls(),values=new Map();c.context.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 c.state.tool='eraser';c.context.setEraserSize(63);c.state.eraserInkOnly=true;c.context.persistEraserPreferences();c.state.eraserSize=28;c.state.eraserInkOnly=false;c.context.restoreEraserPreferences();assert.equal(c.state.eraserSize,63);assert.equal(c.state.eraserInkOnly,true);
 values.set('winds-notes-eraser-preferences-v1','broken');c.context.restoreEraserPreferences();assert.equal(c.state.eraserSize,63);
 c.context.localStorage={getItem(){throw Error('Blocked');},setItem(){throw Error('Blocked');}};assert.doesNotThrow(()=>c.context.setEraserSize(40));assert.doesNotThrow(()=>c.context.restoreEraserPreferences());assert.equal(c.state.eraserSize,40);
});
test('normal Eraser activation includes pasted content even after restoring Ink only',()=>{
 const c=controls();
 c.context.localStorage={getItem:()=>JSON.stringify({size:63,inkOnly:true})};
 c.context.restoreEraserPreferences();
 assert.equal(c.state.eraserInkOnly,true);
 const preparedTargets=[];
 c.el('inkCanvas').classList={toggle(){}};
 Object.assign(c.context,{document:{querySelectorAll:selector=>selector==='[data-tool]'?[]:c.presets},
  finishActiveStroke(){},composeInkNow(){},commitText(){},renderCanvas(){},groupSelection:null,
  prepareEraserPreview(){preparedTargets.push(c.state.eraserInkOnly);}});
 const tool=source.slice(source.indexOf('  function setTool('),source.indexOf('  function applyFillToSelected('));
 vm.runInNewContext(tool,c.context);
 c.context.setTool('eraser');
 assert.equal(c.el('eraserMode').value,'all');
 assert.equal(c.el('eraserSize').value,'63');
 assert.deepEqual(preparedTargets,[false]);
 c.context.setTool('eraser',{inkOnly:true});
 assert.equal(c.el('eraserMode').value,'ink');
 assert.deepEqual(preparedTargets,[false,true]);
});
