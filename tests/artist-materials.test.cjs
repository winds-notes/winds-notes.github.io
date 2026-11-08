const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const tools=require('../creative-tools.js');
require('../native-file.js');
const {WindsFile}=globalThis;
const grades=Object.keys(tools.PENCIL_GRADES);
const points=[[20,40,.05],[30,38,.25],[45,29,.8],[65,44,1],[80,40,.15]];
const stroke=grade=>({id:'material-stroke',type:'stroke',tool:'artist',grade,color:'#cc4477',size:12,points});
function canvas(){
  const calls=[];
  return new Proxy({calls},{get:(target,key)=>key in target?target[key]:(...args)=>calls.push({name:key,args}),set:(target,key,value)=>{calls.push({name:'set '+key,value});target[key]=value;return true;}});
}
function browserTools(){
  let allocations=0;
  const document={createElement:()=>{allocations++;return {getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{},createPattern:()=>({setTransform:()=>{}})})};}};
  const context=vm.createContext({document});
  vm.runInContext(fs.readFileSync(require.resolve('../creative-tools.js'),'utf8'),context);
  return {api:context.WindsCreative,allocations:()=>allocations};
}

test('graphite, charcoal and color-pencil masks have deterministic paper tooth',()=>{
  for(const grade of grades.filter(g=>tools.pencilGrade(g).kind!=='ink')){
    const first=tools.artistStampPixels(grade,'#cc4477'),second=tools.artistStampPixels(grade,'#cc4477');
    assert.deepEqual(first,second);
    const alpha=[];for(let i=3;i<first.data.length;i+=4)alpha.push(first.data[i]);
    assert.ok(new Set(alpha).size>40,grade);
    assert.ok(alpha.includes(0),grade+' needs transparent paper gaps');
    assert.ok(alpha.some(a=>a>100),grade+' needs visible pigment');
    assert.deepEqual(Array.from(first.data.slice(0,3)),[204,68,119]);
  }
  assert.notDeepEqual(tools.artistStampPixels('HB').data,tools.artistStampPixels('6B').data);
  assert.equal(tools.artistStampPixels('Charcoal').width,96);
  const paper=tools.artistPaperPixels('Color Pencil','#cc4477');
  assert.deepEqual(paper,tools.artistPaperPixels('Color Pencil','#cc4477'));
  assert.ok(paper.data.some((a,i)=>i%4===3&&a===0));
});

test('live material rendering matches saved rendering for every grade',()=>{
  for(const grade of grades){
    const item=stroke(grade),live=canvas(),saved=canvas();
    for(let i=0;i<points.length;i++)tools.drawArtistPart(live,item,points.slice(0,i+1),i);
    tools.drawArtistEnd(live,item,points);
    tools.drawArtistStroke(saved,item);
    assert.deepEqual(live.calls,saved.calls,grade);
  }
});

test('browser material masks are prepared once and reused during drawing',()=>{
  const {api,allocations}=browserTools();
  api.prepareArtistColor('#cc4477');
  const before=allocations();assert.ok(before>=9);
  for(const grade of grades){
    const item=stroke(grade),live=canvas(),saved=canvas();
    for(let i=0;i<points.length;i++)api.drawArtistPart(live,item,points.slice(0,i+1),i);
    api.drawArtistEnd(live,item,points);api.drawArtistStroke(saved,item);
    assert.deepEqual(live.calls,saved.calls,grade);
    if(tools.pencilGrade(grade).kind!=='ink')assert.ok(live.calls.some(c=>c.name==='drawImage'),grade);
  }
  assert.equal(allocations(),before,'Pencil drawing must reuse cached masks');
});

test('native reopening preserves each material texture despite re-keyed object IDs',()=>{
  const {api}=browserTools();api.prepareArtistColor('#cc4477');
  for(const grade of [...grades,undefined,'10B']){
    const item=stroke(grade),book={id:'book',title:'Untitled notebook',pages:[{id:'page',template:'blank',items:[item]}]};
    const imported=WindsFile.parse(WindsFile.serialize(book)).notebooks[0].pages[0].items[0];
    assert.notEqual(imported.id,item.id);
    const before=canvas(),after=canvas();api.drawArtistStroke(before,item);api.drawArtistStroke(after,imported);
    assert.deepEqual(before.calls,after.calls,grade);
  }
});

test('artist pressure response is continuous, monotonic and within object bounds',()=>{
  for(const grade of grades){
    const item=stroke(grade);let previous=0;
    for(const pressure of [.03,.1,.25,.5,.75,1]){
      const width=tools.pencilWidth(item,pressure);assert.ok(width>=previous);previous=width;
      assert.ok(tools.artistBoundsPadding(item)>width*.62);
    }
    assert.ok(Number.isFinite(tools.pencilWidth(item,NaN)));
  }
  const ink=stroke('Ink Brush');
  assert.ok(tools.pencilWidth(ink,1)>tools.pencilWidth(ink,.05)*8);
});

test('ink brush pressure ribbons share exact widths at segment joins',()=>{
  const item=stroke('Ink Brush');let previous=tools.artistCurve(item,points,1);
  for(let i=2;i<points.length;i++){
    const current=tools.artistCurve(item,points,i);assert.deepEqual(current.a,previous.b);previous=current;
  }
  assert.deepEqual(tools.artistCurve(item,points,0,true).a,previous.b);
  const ctx=canvas();tools.drawArtistStroke(ctx,item);
  assert.ok(ctx.calls.some(c=>c.name==='closePath'));
  assert.ok(!ctx.calls.some(c=>c.name==='stroke'));
});

test('translucent pencil segments meet without stacking round caps at internal joins',()=>{
  const {api}=browserTools();
  for(const grade of ['HB','6B','Color Pencil']){
    const ctx=canvas();api.drawArtistPart(ctx,stroke(grade),points,2);
    assert.ok(ctx.calls.some(c=>c.name==='fill'),grade);
    assert.ok(!ctx.calls.some(c=>c.name==='arc'),grade+' must not darken joins with an internal round cap');
  }
});

test('colored artist tools retain the chosen pigment and graphite retains its grade shade',()=>{
  for(const grade of grades){
    const ctx=canvas();tools.drawArtistStroke(ctx,stroke(grade));
    const expected=tools.pencilGrade(grade).colorMode==='ink'?'#cc4477':tools.pencilGrade(grade).shade;
    assert.ok(ctx.calls.some(c=>c.name==='set fillStyle'&&c.value===expected),grade);
  }
});

test('short taps, duplicate points and very long material segments have bounded finite rendering',()=>{
  const {api}=browserTools();api.prepareArtistColor('#cc4477');
  for(const grade of grades)for(const samples of [[[1,2,.4]],[[1,2,.4],[1,2,.8]],[[1,2,.1],[100000,100000,1]]]){
    const ctx=canvas();api.drawArtistStroke(ctx,{...stroke(grade),points:samples});
    assert.ok(ctx.calls.length<650,grade);
    for(const c of ctx.calls)for(const arg of c.args||[])if(typeof arg==='number')assert.ok(Number.isFinite(arg),grade);
  }
});

test('the original ten material masks retain their published texture',()=>{
  const {createHash}=require('node:crypto');
  const legacy={
    '2H':'9f2a6d74f73f1c86b9a774e8562ac761aa25e8a797bd9e874d670a8770e4b052',
    H:'d7164097fdf3bc49544f3f168b2ad17653cdcae86905feb6ffc3684d0f611de9',
    HB:'e341d96b79a74994b9dbc3bb8200b508b40f52cf3e3ceb189be60dd31e1b5d26',
    B:'7423650bd0ea0e87374a8cf3ab04c1a8799bacdde4eebb82bfe04e6d70669d07',
    '2B':'c3b33702c8fc7a46b1cd1cbc851bc650bf8093eeaa5d579d46df652e4aa149e9',
    '4B':'b496b3e163a68a093bad744087dce6cb9b6947f01da5c5405dd40e7ac9e2708c',
    '6B':'296f44437d151c39da49291f733a8eb7da932449fc3b8cdebccc61c2e79e937a',
    Charcoal:'2d6076eb08ccd2042a985faf9503abf09bb35421c3653a04c305970236db16c8',
    'Ink Brush':'441c6c02a135fbc6d6d674f8679f1db83583b0ad488cec50cf194c782121bc9e',
    'Color Pencil':'70a9996d01b8eafac77bd9517bb1f6e5487c4d41c591849a4f852801c496a4e8'
  };
  for(const [grade,digest] of Object.entries(legacy))assert.equal(createHash('sha256').update(tools.artistStampPixels(grade).data).digest('hex'),digest,grade);
});

test('artist flow scales each material deposit and survives native and shared serialization',()=>{
  for(const grade of grades){
    const item={...stroke(grade),flow:.35},live=canvas(),saved=canvas(),full=canvas();
    for(let i=0;i<points.length;i++)tools.drawArtistPart(live,item,points.slice(0,i+1),i);
    tools.drawArtistEnd(live,item,points);tools.drawArtistStroke(saved,item);tools.drawArtistStroke(full,stroke(grade));
    assert.deepEqual(live.calls,saved.calls,grade);
    const alphas=ctx=>ctx.calls.filter(c=>c.name==='set globalAlpha').map(c=>c.value);
    const actual=alphas(saved),expected=alphas(full);assert.equal(actual.length,expected.length);actual.forEach((a,i)=>assert.ok(Math.abs(a-expected[i]*.35)<1e-12,grade));
    const book={id:'book',title:grade,pages:[{id:'page',template:'blank',items:[item]}]};
    for(const reopened of [WindsFile.parse(WindsFile.serialize(book)).notebooks[0],WindsFile.validateShared(book)]){
      assert.equal(reopened.pages[0].items[0].grade,grade);
      assert.equal(reopened.pages[0].items[0].flow,.35);
    }
  }
  const book={id:'book',title:'Legacy',pages:[{id:'page',items:[stroke('HB')]}]};
  assert.equal(WindsFile.parse(WindsFile.serialize(book)).notebooks[0].pages[0].items[0].flow,undefined);
});

test('technical and expressive tools have intentionally different pressure response',()=>{
  assert.equal(tools.pencilWidth(stroke('Technical Pen'),.05),tools.pencilWidth(stroke('Technical Pen'),1));
  const ratio=g=>tools.pencilWidth(stroke(g),1)/tools.pencilWidth(stroke(g),.05);
  assert.ok(ratio('Fineliner')<1.2);
  assert.ok(ratio('Fountain Pen')>3);
  assert.ok(ratio('Ink Brush')>8);
  assert.notDeepEqual(tools.artistStampPixels('Soft Pastel').data,tools.artistStampPixels('Oil Pastel').data);
});

test('reduced-flow ink avoids dark internal round-cap overdraw',()=>{
  for(const grade of grades.filter(g=>tools.pencilGrade(g).kind==='ink')){
    const ctx=canvas();tools.drawArtistPart(ctx,{...stroke(grade),flow:.35},points,2);
    assert.ok(ctx.calls.some(c=>c.name==='fill'),grade);
    assert.ok(!ctx.calls.some(c=>c.name==='arc'),grade);
  }
});
