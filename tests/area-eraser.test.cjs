const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const creative=require('../creative-tools.js');require('../native-file.js');const native=globalThis.WindsFile,clipboard=require('../clipboard.js');require('../shared-notebook-model.js');const model=globalThis.WindsSharedModel;
const bounds={x:0,y:0,w:200,h:100},mask=creative.erasurePath([{x:40,y:50},{x:160,y:50}],10,bounds);
const image={id:'image',type:'image',x:0,y:0,w:200,h:100,src:'data:image/png;base64,AAAA',erasures:[mask]};
const book=items=>({id:'book',title:'Area erasing',cover:'purple',createdAt:'2026-11-05T10:00:00Z',pages:[{id:'page',template:'ruled',orientation:'portrait',items}]});
test('a brushed area removes its middle but preserves both sides of the same object',()=>{
 assert.ok(creative.erasedAt(image,bounds,{x:100,y:50}));assert.ok(!creative.erasedAt(image,bounds,{x:20,y:50}));assert.ok(!creative.erasedAt(image,bounds,{x:180,y:50}));assert.ok(!creative.erasedAt(image,bounds,{x:100,y:65}));
});
test('erased areas follow move, proportional/nonproportional resize, rotation and image cropping',()=>{
 const moved={...image,x:300,y:200},movedBounds={x:300,y:200,w:200,h:100};assert.ok(creative.erasedAt(moved,movedBounds,{x:400,y:250}));
 const resized={...image,w:400,h:300};assert.ok(creative.erasedAt(resized,{x:0,y:0,w:400,h:300},{x:200,y:150}));assert.ok(!creative.erasedAt(resized,{x:0,y:0,w:400,h:300},{x:200,y:190}));
 const rotated={...image,rotation:90},p=creative.objectPoint(rotated,{x:100,y:50});assert.ok(creative.erasedAt(rotated,bounds,p));
 const cropped=creative.cropImage(image,{x:.25,y:0,w:.5,h:1});assert.ok(creative.erasedAt(cropped,{x:cropped.x,y:cropped.y,w:cropped.w,h:cropped.h},{x:100,y:50}));assert.equal(image.erasures[0].points[0][0],.2);
});
test('optional area masks survive native v1, backup, clipboard and shared replay on every object type',()=>{
 const items=[image,{id:'ink',type:'stroke',tool:'artist',grade:'6B',color:'#112233',size:7,points:[[0,0,.3],[200,100,.8]],erasures:[mask]},
 {id:'text',type:'text',x:0,y:0,w:200,size:30,text:'Editable text',color:'#112233',erasures:[mask]},
 {id:'shape',type:'shape',kind:'rectangle',x:0,y:0,w:200,h:100,size:7,color:'#112233',fillColor:'#aabbcc',erasures:[mask]},
 {id:'sticker',type:'sticker',x:0,y:0,size:100,emoji:'🙂',erasures:[mask]}];
 const data=book(items),parsed=JSON.parse(native.serialize(data));assert.equal(parsed.version,1);
 const reopened=native.parse(JSON.stringify(parsed)).notebooks[0],copied=clipboard.decode(clipboard.encode(items));
 const backup=native.parse(JSON.stringify({format:'winds-notes-backup',version:1,notebooks:[data]})).notebooks[0];
 for(const result of [reopened.pages[0].items,copied,backup.pages[0].items])for(const item of result)assert.deepEqual(item.erasures,[mask]);
 const base=book(items.map(item=>{const {erasures,...rest}=item;return rest;})),changes=model.diff(data,model.fingerprint(base));
 const replay=model.replay(base,[{format:'winds-shared-edit',version:1,id:'erase',at:'2026-11-05T11:00:00Z',changes}]);for(const item of replay.pages[0].items)assert.deepEqual(item.erasures,[mask]);
 const moved=clipboard.moveItems([image],20,30,()=> 'copied')[0];assert.deepEqual(moved.erasures,[mask]);assert.ok(creative.erasedAt(moved,{x:20,y:30,w:200,h:100},{x:120,y:80}));
});
test('legacy content remains unmasked and malformed or oversized mask payloads are rejected',()=>{
 const {erasures,...old}=image;assert.ok(!native.validateShared(book([old])).pages[0].items[0].erasures);
 for(const bad of [{rx:0,ry:.1,points:[[0,0]]},{rx:.1,ry:Infinity,points:[[0,0]]},{rx:.1,ry:.1,points:[[NaN,0]]},{rx:.1,ry:.1,points:[]},{rx:.1,ry:.1,points:Array.from({length:2049},()=>[0,0])}])assert.throws(()=>native.validateShared(book([{...image,erasures:[bad]}])));
});
test('the renderer erases an isolated layer and never applies destination-out to the paper or neighboring objects',()=>{
 const context={eraserPreview:null,queueEraserPreparation(){},console};vm.runInNewContext(fs.readFileSync(require.resolve('../creative-tools.js'),'utf8'),context);
 const operations=[],layer=new Proxy({},{get:(o,k)=>k in o?o[k]:(...args)=>operations.push([k,...args]),set:(o,k,v)=>{o[k]=v;operations.push([k,v]);return true;}});
 const canvas={width:0,height:0,getContext:()=>layer};context.document={createElement:()=>canvas};let source=0,blits=0;
 const destination={getTransform:()=>({a:2,b:0,c:0,d:2}),drawImage:(c,...rect)=>{assert.ok(c.width*c.height<4198400);assert.deepEqual(rect,[-2,-2,204,104]);blits++;},globalCompositeOperation:'source-over'};
 context.WindsCreative.drawErasedItem(destination,{...image,erasures:[mask,mask]},bounds,bounds,ctx=>{assert.equal(ctx,layer);source++;});
 assert.equal(source,1);assert.equal(blits,1);assert.equal(destination.globalCompositeOperation,'source-over');assert.equal(operations.filter(op=>op[0]==='stroke').length,2);assert.equal(layer.globalCompositeOperation,'destination-out');assert.ok(canvas.width>1);
});
test('late image decoding queues an idle-scoped repaint and cannot repaint another account',()=>{
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),helper=source.slice(source.indexOf('  function drawSourceItem('),source.indexOf('  function pdfImage(')),images=[],calls=[];
 const context={eraserPreview:null,queueEraserPreparation(){},workspaceId:'a',imageCache:new Map(),Image:class{constructor(){images.push(this);}},document:{hidden:false},CREATIVE:{rotateContext(){}},renderCloudChanges:account=>calls.push(account),renderCanvas(){throw Error('Immediate full render');}};
 vm.runInNewContext(helper,context);context.drawSourceItem({save(){},restore(){}},{type:'image',src:'data:image/png;base64,AAAA'});context.workspaceId='b';images[0].onload();assert.equal(calls.length,0);context.workspaceId='a';images[0].onload();assert.deepEqual(calls,['a']);
});
