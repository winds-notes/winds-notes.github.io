const test=require('node:test');
const assert=require('node:assert/strict');
const tools=require('../creative-tools.js');
const {WindsFile}=(()=>{require('../native-file.js');return globalThis;})();

function canvas(){
  const calls=[];
  const ctx=new Proxy({calls},{get(target,key){if(key in target)return target[key];return (...args)=>calls.push({name:key,args});},set(target,key,val){target[key]=val;calls.push({name:'set '+key,value:val});return true;}});
  return ctx;
}
function makeNotebook(items){return {id:'n1',title:'Drawing test',cover:'purple',pages:[{id:'p1',orientation:'landscape',template:'blank',items}]};}

test('only closed figures can have a fill',()=>{
  assert.deepEqual(['rectangle','square','ellipse','circle','triangle','diamond','star'].map(tools.isFillableShape),[true,true,true,true,true,true,true]);
  assert.equal(tools.isFillableShape('line'),false);
  assert.equal(tools.isFillableShape('arrow'),false);
});

test('filled star paints fill before stroke and supports opacity',()=>{
  const ctx=canvas();
  tools.drawShape(ctx,{type:'shape',kind:'star',x:20,y:30,w:120,h:90,color:'#111111',size:3,fillColor:'#ffbbcc',fillOpacity:0.45});
  const cmds=ctx.calls.map(c=>c.name);
  assert.ok(cmds.includes('closePath'));
  assert.ok(cmds.indexOf('fill')<cmds.indexOf('stroke'));
  assert.ok(ctx.calls.some(c=>c.name==='set globalAlpha'&&c.value===.45));
});

test('line remains unfilled even if a fill color is present',()=>{
  const ctx=canvas();tools.drawShape(ctx,{type:'shape',kind:'line',x:0,y:0,w:100,h:100,fillColor:'#aabbcc'});
  assert.equal(ctx.calls.some(c=>c.name==='fill'),false);
});

test('artist grades have distinct graphite weight and rendered segments',()=>{
  assert.ok(tools.pencilGrade('HB').opacity < tools.pencilGrade('2B').opacity);
  assert.ok(tools.pencilGrade('2B').width < tools.pencilGrade('4B').width);
  for (const grade of ['HB','2B','4B']) {
    const ctx=canvas();tools.drawArtistStroke(ctx,{id:'stroke-1',tool:'artist',grade,size:4,points:[[20,20,.3],[30,30,.7],[45,37,.9]]});
    assert.ok(ctx.calls.some(c=>c.name==='quadraticCurveTo'));
    assert.ok(ctx.calls.some(c=>c.name==='stroke'));
  }
});

test('native .winds-notes keeps fill and artist grade when reopened',()=>{
  const nb=makeNotebook([
    {id:'a',type:'shape',kind:'star',x:20,y:30,w:100,h:110,color:'#111111',size:3,fillColor:'#becefa',fillOpacity:.55},
    {id:'b',type:'stroke',tool:'artist',grade:'2B',color:'#343b48',size:4,points:[[2,3,.7],[9,14,.6]]}
  ]);
  const data=WindsFile.parse(WindsFile.serialize(nb)).notebooks[0].pages[0].items;
  assert.equal(data[0].fillColor,'#becefa');
  assert.equal(data[0].fillOpacity,.55);
  assert.equal(data[1].tool,'artist');
  assert.equal(data[1].grade,'2B');
});

test('old notebooks with outline-only figures still import',()=>{
  const nb=makeNotebook([{type:'shape',kind:'rectangle',x:0,y:0,w:10,h:20,color:'#ffffff',size:2}]);
  const item=WindsFile.parse(WindsFile.serialize(nb)).notebooks[0].pages[0].items[0];
  assert.equal(item.fillColor,null);
});

test('import strips unsupported fill for line and unexpected grades',()=>{
  const nb=makeNotebook([
    {type:'shape',kind:'line',x:0,y:0,w:20,h:20,fillColor:'#aabbcc'},
    {type:'stroke',tool:'artist',grade:'10B',color:'#111111',size:1,points:[[1,1,.5]]}
  ]);
  const [line,stroke]=WindsFile.parse(WindsFile.serialize(nb)).notebooks[0].pages[0].items;
  assert.equal(line.fillColor,null);assert.equal(stroke.grade,'HB');
});

test('25 artist tools have valid profiles and render pressure-aware strokes',()=>{
  const names=Object.keys(tools.PENCIL_GRADES);assert.equal(names.length,25);
  assert.deepEqual(Object.keys(tools.ARTIST_MATERIALS).sort(),names.slice().sort());
  assert.ok(tools.pencilGrade('2H').width<tools.pencilGrade('HB').width);
  assert.ok(tools.pencilGrade('6B').opacity>tools.pencilGrade('2B').opacity);
  for(const grade of names){
    const ctx=canvas();tools.drawArtistStroke(ctx,{id:'ink-1',grade,tool:'artist',color:'#dd2255',size:32,points:[[3,4,.12],[12,18,.45],[42,26,1]]});
    if(tools.pencilGrade(grade).kind==='ink'){
      assert.ok(ctx.calls.some(c=>c.name==='fill'),'Ink Brush did not fill its pressure ribbon');
      assert.ok(ctx.calls.some(c=>c.name==='closePath'),'Ink Brush ribbon was not closed');
    }else{
      assert.ok(ctx.calls.some(c=>c.name==='stroke'),`Artist brush ${grade} did not stroke`);
      assert.ok(ctx.calls.some(c=>c.name==='quadraticCurveTo'));
    }
  }
});

test('shape outline color, width, dashed, dotted and no-outline can render independently of fill',()=>{
  for(const [style,expected] of [['solid',0],['dashed',1],['dotted',1],['none',0]]){
    const ctx=canvas();tools.drawShape(ctx,{id:'shape-1',type:'shape',kind:'star',x:0,y:0,w:80,h:110,
      size:32,color:'#22aa66',strokeStyle:style,fillColor:'#faad12',fillOpacity:.8});
    assert.ok(ctx.calls.some(c=>c.name==='fill'));
    assert.equal(ctx.calls.filter(c=>c.name==='stroke').length,style==='none'?0:1);
    assert.equal(ctx.calls.filter(c=>c.name==='setLineDash').length,expected);
    assert.ok(ctx.calls.some(c=>c.name==='set lineWidth'&&c.value===32));
    assert.ok(ctx.calls.some(c=>c.name==='set strokeStyle'&&c.value==='#22aa66'));
  }
});

test('new artist grades, 32 point borders, styles and resized stickers survive native save/reopen',()=>{
  const n=makeNotebook([
    {id:'shape',type:'shape',kind:'diamond',x:4,y:9,w:260,h:200,size:32,color:'#aa0066',strokeStyle:'dotted',fillColor:'#faad00',fillOpacity:.4},
    {id:'brush',type:'stroke',tool:'artist',grade:'Ink Brush',color:'#dd4477',size:31,points:[[3,2,.3],[29,33,.8]]},
    {id:'sticker',type:'sticker',emoji:'😊',x:20,y:30,size:490},
    {id:'image',type:'image',x:15,y:60,w:700,h:490,src:'data:image/png;base64,aGVsbG8='}
  ]);
  const saved=WindsFile.parse(WindsFile.serialize(n)).notebooks[0].pages[0].items;
  assert.equal(saved[0].size,32);assert.equal(saved[0].strokeStyle,'dotted');assert.equal(saved[0].color,'#aa0066');
  assert.equal(saved[1].grade,'Ink Brush');assert.equal(saved[1].color,'#dd4477');
  assert.equal(saved[2].size,490);assert.deepEqual([saved[3].w,saved[3].h],[700,490]);
});

test('legacy saved shapes use solid strokes when outline style is absent',()=>{
  const data=WindsFile.parse(WindsFile.serialize(makeNotebook([{id:'old',type:'shape',kind:'star',x:0,y:0,w:65,h:55,color:'#224466',size:2}]))).notebooks[0].pages[0].items[0];
  assert.equal(data.strokeStyle,'solid');
  const ctx=canvas();tools.drawShape(ctx,data);
  assert.equal(ctx.calls.filter(c=>c.name==='stroke').length,1);
});
