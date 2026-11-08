const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const rendering=source.slice(source.indexOf('  function paintPendingInk('),source.indexOf('  function renderCanvas('));

test('animation frame timestamps cannot finalize a stroke or redraw its tail during writing',()=>{
  for(const tool of ['artist','pen']){
    const parts=[],ends=[],frames=[];
    const state={draft:{type:'stroke',tool,color:'#123456',points:[[0,0,.5],[10,10,.6],[20,20,.7]]}};
    const context=vm.createContext({eraserPreview:null,state,inkRAF:0,drawnIndex:0,inkContext:()=>({save(){},restore(){}}),
      requestAnimationFrame:callback=>{frames.push(callback);return frames.length;},
      CREATIVE:{drawArtistPart:(ctx,item,points,index)=>parts.push(index),drawArtistEnd:()=>ends.push('artist')},
      smoothPenPart:(ctx,item,points,index)=>parts.push(index),smoothPenEnd:()=>ends.push('pen')});
    vm.runInContext(rendering,context);
    context.queueInk();context.queueInk();assert.equal(frames.length,1,'only one pending frame');
    frames.shift()(1234.5);assert.deepEqual(parts,[0,1,2]);assert.deepEqual(ends,[],'RAF timestamp is not a finish flag');
    state.draft.points.push([30,30,.8]);context.queueInk();frames.shift()(1250.8);
    assert.deepEqual(parts,[0,1,2,3]);assert.deepEqual(ends,[],'only new points paint between frames');
    context.paintPendingInk(true);assert.deepEqual(ends,[tool],'pointer completion paints the tail once');
    assert.deepEqual(parts,[0,1,2,3]);
  }
});
