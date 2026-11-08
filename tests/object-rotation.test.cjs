const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const tools = require('../creative-tools.js');
require('../native-file.js');
const {WindsFile} = globalThis;
const image={id:'photo',type:'image',x:200,y:150,w:240,h:160,src:'data:image/png;base64,aGVsbG8='};
const sticker={id:'smile',type:'sticker',emoji:'😊',x:100,y:300,size:80};
const book=items=>({id:'book',title:'Untitled notebook',pages:[{id:'page',template:'ruled',items}]});
function close(actual,expected){assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);}
function pointClose(actual,expected){close(actual.x,expected.x);close(actual.y,expected.y);}

test('an older HTML shell can initialize and select an image without the on-page handles',()=>{
  const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const elements=new Map();
  const missing=new Set(['objectRotationFrame','objectRotationHandle','imageCropOverlay']);
  const $=id=>{
    if(missing.has(id))return null;
    if(!elements.has(id))elements.set(id,{});
    return elements.get(id);
  };
  const context={$,CREATIVE:tools,imageCropSession:null,state:{selected:0,tool:'select'},page:()=>({items:[image]}),
    activeGroup:()=>null,resizable:()=>true,itemBounds:tools.objectRect,document:{querySelectorAll:()=>[]}};
  const selection=app.slice(app.indexOf('  function updateSelectionActions('),app.indexOf('  function rotateSelectedTo('));
  const binding=app.slice(app.indexOf('  function bindObjectTransformHandles('),app.indexOf('  function resizeObject('));
  vm.runInNewContext(selection+binding+'bindObjectTransformHandles();updateSelectionActions();',context);
  assert.equal($('selectionActions').hidden,false);
  assert.equal($('rotationControls').hidden,false);
  assert.equal($('selectionPrecision').hidden,false);
});

test('rotation applies to images, stickers and shapes and wraps complete turns',()=>{
  assert.equal(tools.objectRotation({...image,rotation:-90}),270);
  assert.equal(tools.objectRotation({...sticker,rotation:450}),90);
  assert.equal(tools.objectRotation({...image,rotation:720}),0);
  assert.equal(tools.objectRotation({type:'stroke',rotation:90}),0);
  assert.equal(tools.objectRotation({...image,rotation:NaN}),0);
  assert.equal(tools.rotatable(sticker),true);
  assert.equal(tools.rotatable({type:'shape'}),true);
});

test('a rotation drag across the angular seam tracks the pointer and supports angle snapping',()=>{
  const star={type:'shape',kind:'star',x:0,y:0,w:100,h:100,rotation:350};
  const around=degrees=>({x:50+80*Math.cos(degrees*Math.PI/180),y:50+80*Math.sin(degrees*Math.PI/180)});
  close(tools.rotationFromDrag(star,around(170),around(-165)),15);
  close(tools.rotationFromDrag(star,around(170),around(-160),true),15);
  close(tools.rotationFromDrag(star,around(170),around(170)),350);
});

test('rotated points and inverse hit-test coordinates agree for images and smileys',()=>{
  for(const original of [image,sticker])for(const rotation of [0,30,90,180,270,315]){
    const item={...original,rotation},b=tools.objectRect(item);
    for(const point of [{x:b.x,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x+b.w*.3,y:b.y+b.h*.7}]){
      pointClose(tools.objectPoint(item,tools.objectPoint(item,point),true),point);
    }
    const center={x:b.x+b.w/2,y:b.y+b.h/2};
    pointClose(tools.objectPoint(item,center),center);
  }
});

test('shared canvas rotation pivots around the object center and leaves legacy objects unchanged',()=>{
  for(const original of [image,sticker]){
    const calls=[],ctx={translate:(...args)=>calls.push(['translate',...args]),rotate:value=>calls.push(['rotate',value])};
    tools.rotateContext(ctx,original);
    assert.deepEqual(calls,[]);
    const item={...original,rotation:90},b=tools.objectRect(item),cx=b.x+b.w/2,cy=b.y+b.h/2;
    tools.rotateContext(ctx,item);
    assert.deepEqual(calls,[['translate',cx,cy],['rotate',Math.PI/2],['translate',-cx,-cy]]);
  }
});

test('resizing a rotated image or sticker preserves the opposite visual corner',()=>{
  for(const original of [image,sticker])for(const rotation of [30,90,225,315]){
    const item={...original,rotation},b=tools.objectRect(item);
    for(const corner of ['nw','ne','sw','se']){
      const w=b.w*1.5,h=b.h*1.5;
      const x=corner.includes('w')?b.x+b.w-w:b.x,y=corner.includes('n')?b.y+b.h-h:b.y;
      const resized=tools.positionObjectRect(item,{...item,x,y,...(item.type==='sticker'?{size:w}:{w,h})});
      const next=tools.objectRect(resized);
      const oldAnchor={x:corner.includes('w')?b.x+b.w:b.x,y:corner.includes('n')?b.y+b.h:b.y};
      const newAnchor={x:corner.includes('w')?next.x+next.w:next.x,y:corner.includes('n')?next.y+next.h:next.y};
      pointClose(tools.objectPoint(resized,newAnchor),tools.objectPoint(item,oldAnchor));
      close(next.w/next.h,b.w/b.h);
    }
  }
});

test('sticker frames center on glyph ink and keep the opposite corner during rotated resize',()=>{
  let measurements=0;
  const ctx={measureText(){
    measurements++;
    return {actualBoundingBoxLeft:-5,actualBoundingBoxRight:123,actualBoundingBoxAscent:13,actualBoundingBoxDescent:103};
  }};
  const context={document:{createElement:()=>({getContext:()=>ctx})}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../creative-tools.js'),'utf8'),context);
  const creative=context.WindsCreative;
  const heart={type:'sticker',emoji:'❤️',x:30,y:150,size:128,rotation:35};
  const frame=creative.stickerSelectionBounds(heart);
  assert.deepEqual({...frame},{x:34,y:135,w:120,h:120});
  const resized=creative.resizeSticker(heart,256,'sw');
  const next=creative.stickerSelectionBounds(resized);
  const opposite=(item,bounds)=>creative.objectPoint(item,{x:bounds.x+bounds.w,y:bounds.y});
  pointClose(opposite(resized,next),opposite(heart,frame));
  close(next.w,240);close(next.h,240);
  assert.equal(resized.rotation,35);
  assert.equal(measurements,1);
});

test('cropping a rotated image keeps retained content in place and reset restores its bounds',()=>{
  for(const rotation of [30,90,225,315]){
    const original={...image,rotation},crop={x:.2,y:.1,w:.6,h:.75};
    const cropped=tools.cropImage(original,crop);
    const oldPoint=tools.objectPoint(original,{x:original.x+original.w*.5,y:original.y+original.h*.5});
    const newPoint=tools.objectPoint(cropped,{x:cropped.x+cropped.w*(.5-crop.x)/crop.w,y:cropped.y+cropped.h*(.5-crop.y)/crop.h});
    pointClose(newPoint,oldPoint);
    assert.equal(cropped.rotation,rotation);
    assert.equal(cropped.src,original.src);
    const reset=tools.cropImage(cropped,tools.imageCrop());
    pointClose(reset,original);close(reset.w,original.w);close(reset.h,original.h);
    assert.equal(reset.crop,undefined);
  }
});

test('rotation and crop survive native and Drive-compatible backup round trips',()=>{
  const items=[{...image,rotation:37,crop:{x:.2,y:.1,w:.6,h:.8}},{...sticker,rotation:315},
    {id:'star',type:'shape',kind:'star',x:50,y:40,w:120,h:120,rotation:35,fillColor:'#f8d575'}];
  const notebook=book(items),native=WindsFile.serialize(notebook);
  assert.equal(JSON.parse(native).version,1);
  for(const text of [native,JSON.stringify({format:'winds-notes-backup',version:2,notebooks:[notebook]})]){
    const saved=WindsFile.parse(text).notebooks[0].pages[0].items;
    assert.equal(saved[0].rotation,37);assert.equal(saved[1].rotation,315);
    assert.deepEqual(saved[0].crop,items[0].crop);
    assert.equal(saved[1].size,sticker.size);
    assert.equal(saved[2].rotation,35);
    assert.equal(saved[2].fillColor,'#f8d575');
  }
});

test('old files without rotation remain compatible and imported angles are normalized',()=>{
  const saved=WindsFile.parse(WindsFile.serialize(book([image,sticker,{...image,rotation:-90},{...sticker,rotation:450}]))).notebooks[0].pages[0].items;
  assert.equal(saved[0].rotation,undefined);assert.equal(saved[1].rotation,undefined);
  assert.equal(saved[2].rotation,270);assert.equal(saved[3].rotation,90);
});

test('malformed rotation metadata rejects the import',()=>{
  for(const rotation of ['90',{},1e8])for(const original of [image,sticker]){
    assert.throws(()=>WindsFile.parse(WindsFile.serialize(book([{...original,rotation}]))),/Invalid object rotation/);
  }
});
