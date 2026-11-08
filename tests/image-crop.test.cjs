const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const tools = require('../creative-tools.js');
require('../native-file.js');
const {WindsFile} = globalThis;
const original = {id:'photo',type:'image',x:30,y:40,w:600,h:400,src:'data:image/png;base64,aGVsbG8='};
const notebook = item => ({id:'book',title:'Untitled notebook',pages:[{id:'page',template:'ruled',items:[item]}]});

test('image crop keeps the original source and the retained content in place', () => {
  const cropped = tools.cropImage(original,{x:.25,y:.1,w:.5,h:.75});
  assert.deepEqual([cropped.x,cropped.y,cropped.w,cropped.h],[180,80,300,300]);
  assert.equal(cropped.src,original.src);
  assert.equal(original.crop,undefined);
  const reset = tools.cropImage(cropped,tools.imageCrop());
  assert.deepEqual(reset,original);
});

test('crop rendering uses the same source rectangle for editor and exports', () => {
  const image={naturalWidth:1200,naturalHeight:800};
  const calls=[];
  const ctx={drawImage:(...args)=>calls.push(args)};
  const item=tools.cropImage(original,{x:.25,y:.1,w:.5,h:.75});
  tools.drawImage(ctx,item,image);
  assert.deepEqual(calls[0],[image,300,80,600,600,180,80,300,300]);
  tools.drawImage(ctx,original,image);
  assert.deepEqual(calls[1],[image,0,0,1200,800,30,40,600,400]);
});

test('all crop handles and movement stay within the source with positive area', () => {
  for(const corner of ['nw','ne','sw','se','n','s','e','w','move']){
    for(const [dx,dy] of [[-10,-10],[10,10],[-10,10],[10,-10]]){
      const rect=tools.dragImageCrop({x:.2,y:.2,w:.6,h:.6},corner,dx,dy);
      assert.ok(rect.x>=0&&rect.y>=0);
      assert.ok(rect.w>=.01-1e-9&&rect.h>=.01-1e-9);
      assert.ok(rect.x+rect.w<=1+1e-9&&rect.y+rect.h<=1+1e-9);
    }
  }
  const moved=tools.dragImageCrop({x:.2,y:.2,w:.6,h:.6},'move',.1,-.1);
  assert.ok(Math.abs(moved.x-.3)<1e-9&&Math.abs(moved.y-.1)<1e-9);
  assert.deepEqual([moved.w,moved.h],[.6,.6]);
});

test('dragging a visible edge of a rotated image edits the crop draft in source coordinates',()=>{
  const full={...original,rotation:90},session={full,crop:tools.imageCrop(),frame:0};
  const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const frames=[],captures=[];
  const context={imageCropSession:session,CREATIVE:tools,$:()=>({getBoundingClientRect:()=>({})}),
    point:event=>event.point,requestAnimationFrame:fn=>frames.push(fn),updateImageCropPreview(){}};
  vm.runInNewContext(app.slice(app.indexOf('  function imageCropPoint('),app.indexOf('  function resizeObject(')),context);
  const event=(local,type)=>({button:0,pointerId:1,point:tools.objectPoint(full,local),type,preventDefault(){},
    target:{closest:()=>({dataset:{cropCorner:'e'}})},currentTarget:{setPointerCapture:id=>captures.push(id)}});
  context.beginImageCropDrag(event({x:630,y:240},'pointerdown'));
  context.endImageCropDrag(event({x:480,y:240},'pointerup'));
  assert.deepEqual(captures,[1]);
  assert.equal(session.drag,null);
  assert.ok(Math.abs(session.crop.w-.75)<1e-9);
  assert.equal(session.crop.h,1);
  assert.equal(full.crop,undefined);
  assert.equal(frames.length,1);
});

test('cropped images round-trip through native files and workspace backups', () => {
  const item=tools.cropImage(original,{x:.2,y:.1,w:.6,h:.8});
  const book=notebook(item);
  const files=[WindsFile.serialize(book),JSON.stringify({format:'winds-notes-backup',version:2,notebooks:[book]})];
  for(const text of files){
    const imported=WindsFile.parse(text).notebooks[0].pages[0].items[0];
    assert.deepEqual(imported.crop,item.crop);
    assert.deepEqual([imported.x,imported.y,imported.w,imported.h],[item.x,item.y,item.w,item.h]);
    assert.equal(imported.src,original.src);
  }
  assert.equal(JSON.parse(files[0]).version,1);
  assert.equal(WindsFile.parse(WindsFile.serialize(notebook(original))).notebooks[0].pages[0].items[0].crop,undefined);
});

test('invalid crop metadata is rejected before import', () => {
  for(const crop of [{x:-.2,y:0,w:.5,h:1},{x:.7,y:0,w:.5,h:1},{x:0,y:0,w:0,h:1},{x:0,y:0,w:'1',h:1}]){
    assert.throws(()=>WindsFile.parse(WindsFile.serialize(notebook({...original,crop}))),/Invalid image crop/);
  }
});
