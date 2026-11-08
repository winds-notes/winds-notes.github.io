const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const source=readFileSync(require.resolve('../cloud-drive.js'),'utf8');
const reader=source.slice(source.indexOf('  async function readDriveText('),source.indexOf('  async function readDriveJson('));

function fixture(chunks,{limit=12,check=()=>{}}={}){
  let index=0,cancelled=false,released=false;
  const context={MAX_BYTES:limit,TextDecoder,ensureIdle:check};
  vm.runInNewContext(reader+'\nglobalThis.read=readDriveText;',context);
  const response={headers:new Headers(),body:{getReader:()=>({
    async read(){return index<chunks.length?{value:chunks[index++],done:false}:{done:true};},
    async cancel(){cancelled=true;},
    releaseLock(){released=true;}
  })}};
  return {read:()=>context.read(response,1),get cancelled(){return cancelled;},get released(){return released;},get count(){return index;}};
}

test('a chunked Drive response is stopped at the byte limit before the full body is buffered',async()=>{
  const part=new TextEncoder().encode('12345678');
  const f=fixture([part,part,part]);
  await assert.rejects(f.read(),/safety limit/);
  assert.equal(f.count,2);assert.equal(f.cancelled,true);assert.equal(f.released,true);
});

test('Drive text preserves multibyte characters split across response chunks',async()=>{
  const data=new TextEncoder().encode('A🙂B');
  const f=fixture([data.slice(0,3),data.slice(3)]);
  assert.equal(await f.read(),'A🙂B');
  assert.equal(f.cancelled,false);assert.equal(f.released,true);
});

test('resumed input stops a Drive body read without processing more chunks',async()=>{
  let checks=0;
  const f=fixture([new Uint8Array([65]),new Uint8Array([66])],{check(){
    if(++checks>1)throw Object.assign(Error('Writing resumed'),{syncDeferred:true});
  }});
  await assert.rejects(f.read(),error=>error.syncDeferred===true);
  assert.equal(f.count,1);assert.equal(f.cancelled,true);
});
