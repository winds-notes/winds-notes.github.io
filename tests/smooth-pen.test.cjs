const test = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../creative-tools.js');

function canvas(){
  const calls=[];
  return new Proxy({calls},{get:(target,key)=>key in target?target[key]:(...args)=>calls.push({key,args})});
}
const item={type:'stroke',tool:'pen',size:32,color:'#2b2d4c'};
const points=[[0,0,.1],[5,8,1],[15,9,.2],[20,2,.9],[27,10,.1]];

test('pen curves share position and width at every pressure transition', () => {
  let previous=tools.penCurve(item,points,1);
  for(let i=2;i<points.length;i++){
    const curve=tools.penCurve(item,points,i);
    assert.deepEqual(curve.a,previous.b);
    previous=curve;
  }
  const end=tools.penCurve(item,points,0,true);
  assert.deepEqual(end.a,previous.b);
  assert.deepEqual([end.b.x,end.b.y],points.at(-1).slice(0,2));
});

test('live incremental pen rendering matches complete-stroke rendering exactly', () => {
  const live=canvas(),saved=canvas();
  for(let i=0;i<points.length;i++)tools.drawPenPart(live,item,points.slice(0,i+1),i);
  tools.drawPenEnd(live,item,points);
  for(let i=0;i<points.length;i++)tools.drawPenPart(saved,item,points,i);
  tools.drawPenEnd(saved,item,points);
  assert.deepEqual(live.calls,saved.calls);
  assert.ok(live.calls.some(c=>c.key==='closePath'));
  assert.ok(live.calls.filter(c=>c.key==='arc').length>=points.length);
  assert.ok(live.calls.every(c=>c.args.every(v=>typeof v!=='number'||Number.isFinite(v))));
});

test('dots, duplicate points and long segments render with bounded work', () => {
  for(const samples of [[[2,3,.7]],[[2,3,.7],[2,3,.9]],[[0,0,.1],[10000,10000,1]]]){
    const ctx=canvas();
    for(let i=0;i<samples.length;i++)tools.drawPenPart(ctx,item,samples,i);
    tools.drawPenEnd(ctx,item,samples);
    assert.ok(ctx.calls.length<160);
    assert.ok(ctx.calls.some(c=>c.key==='fill'));
    assert.ok(ctx.calls.every(c=>c.args.every(v=>typeof v!=='number'||Number.isFinite(v))));
  }
});

test('a stroke that doubles back has a rounded reversal instead of a collapsed edge', () => {
  const ctx=canvas(),samples=[[0,0,.2],[20,0,1],[0,0,.2]];
  tools.drawPenPart(ctx,item,samples,2);
  assert.equal(ctx.calls.filter(c=>c.key==='fill').length,2);
  assert.ok(ctx.calls.some(c=>c.key==='arc'&&c.args[0]===15&&c.args[1]===0&&c.args[2]>0));
  assert.ok(ctx.calls.every(c=>c.args.every(v=>typeof v!=='number'||Number.isFinite(v))));
});
