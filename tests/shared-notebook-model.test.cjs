const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const context={crypto:{randomUUID:()=>Math.random().toString(36).slice(2)}};
for(const name of ['native-file.js','shared-notebook-model.js'])vm.runInNewContext(readFileSync(require.resolve('../'+name),'utf8'),context);
const model=context.WindsSharedModel,native=context.WindsFile;
const copy=x=>JSON.parse(JSON.stringify(x));
function book(){return {id:'book',title:'Shared physics',cover:'purple',createdAt:'2026-11-04T10:00:00Z',updatedAt:'2026-11-04T10:00:00Z',pages:[{id:'page',template:'ruled',orientation:'portrait',items:[]}]};}
function stroke(id){return {id,type:'stroke',tool:'artist',grade:'4B',color:'#123456',size:3,points:[[10,10,.4],[50,40,.8]]};}
function batch(id,changes,at='2026-11-04T10:01:00Z'){return {format:'winds-shared-edit',version:1,id,at,changes};}

test('independent simultaneous strokes merge in either arrival order without duplicate retries',()=>{
  const seed=book(),baseline=model.fingerprint(seed),a=copy(seed),b=copy(seed);
  a.pages[0].items.push(stroke('alice'));b.pages[0].items.push(stroke('bob'));
  const aa=batch('a',model.diff(a,baseline)),bb=batch('b',model.diff(b,baseline));
  const first=model.replay(seed,[aa,bb,aa]),second=model.replay(seed,[bb,aa]);
  assert.equal(JSON.stringify(first),JSON.stringify(second));
  assert.deepEqual(Array.from(first.pages[0].items,x=>x.id),['alice','bob']);
  assert.equal(first.pages[0].items[0].grade,'4B');
});

test('object updates, removals and later undo operations replay deterministically',()=>{
  const seed=book();seed.pages[0].items.push(stroke('ink'));
  const baseline=model.fingerprint(seed),erased=copy(seed);erased.pages[0].items=[];
  const remove=batch('erase',model.diff(erased,baseline));
  assert.equal(model.replay(seed,[remove]).pages[0].items.length,0);
  const restore=batch('undo',model.diff(seed,model.fingerprint(erased)),'2026-11-04T10:02:00Z');
  assert.equal(model.replay(seed,[restore,remove]).pages[0].items.length,1);
});

test('concurrent added pages both remain even when each device updates page order',()=>{
  const seed=book(),baseline=model.fingerprint(seed),a=copy(seed),b=copy(seed);
  a.pages.push({id:'alice-page',template:'blank',orientation:'landscape',items:[stroke('alice-ink')]});
  b.pages.push({id:'bob-page',template:'grid',orientation:'portrait',items:[stroke('bob-ink')]});
  const merged=model.replay(seed,[batch('a',model.diff(a,baseline)),batch('b',model.diff(b,baseline))]);
  assert.equal(merged.pages.length,3);assert.ok(merged.pages.some(p=>p.id==='alice-page'));assert.ok(merged.pages.some(p=>p.id==='bob-page'));
});

test('saved fingerprints identify only offline edits and never delete remote additions unseen by this device',()=>{
  const seed=book(),baseline=model.fingerprint(seed),a=copy(seed),b=copy(seed);
  a.pages[0].items.push(stroke('offline'));b.pages[0].items.push(stroke('remote'));
  const persisted=JSON.parse(JSON.stringify(baseline));
  const changes=model.diff(a,persisted);
  assert.equal(changes.length,1);assert.equal(changes[0].value.id,'offline');
  assert.equal(model.replay(seed,[batch('a',changes),batch('b',model.diff(b,baseline))]).pages[0].items.length,2);
});

test('shared validation preserves stable IDs and creative fields while rejecting duplicate IDs and damaged objects',()=>{
  const seed=book();seed.pages[0].items.push(stroke('ink'));
  const validated=native.validateShared(seed);
  assert.equal(validated.id,'book');assert.equal(validated.pages[0].id,'page');assert.equal(validated.pages[0].items[0].id,'ink');
  const invalid=copy(seed);invalid.pages[0].items.push(stroke('ink'));
  assert.throws(()=>native.validateShared(invalid),/duplicate/);
  invalid.pages[0].items[1].id='other';invalid.pages[0].items[1].type='script';
  assert.throws(()=>native.validateShared(invalid),/Unsupported/);
});

test('native exports exclude sharing permissions, pending operations and account metadata',()=>{
  const seed=book();seed._sharing={folderId:'private-folder',pending:[{email:'secret@example.test'}]};
  const exported=JSON.parse(native.serialize(seed));
  assert.equal(exported.version,1);assert.equal(exported.notebook._sharing,undefined);
  assert.equal(native.parse(JSON.stringify(exported)).notebooks.length,1);
});

test('malformed edit paths and deleting every page are rejected',()=>{
  assert.throws(()=>model.validateBatch(batch('bad',[{key:['__proto__'],value:{polluted:true}}])),/location/);
  assert.throws(()=>model.replay(book(),[batch('empty',[{key:['page','page'],value:null}])]),/retain at least one page/);
});
