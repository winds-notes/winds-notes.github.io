const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
function studio({decode=async()=>{}}={}){
 const images=[],scripts=[];
 const context={setTimeout,clearTimeout,Image:class {constructor(){this.naturalWidth=this.naturalHeight=1254;images.push(this);}decode(){return decode(this);}}};
 context.document={createElement:()=>({remove(){}}),head:{append(script){scripts.push(script);queueMicrotask(()=>{const motif=script.src.match(/\/([^/]+)\.js/)[1];context.WindsMandalaArt.register('art-'+motif,'data:image/webp;base64,UklGRg==');script.onload?.();});}}};
 vm.runInNewContext(readFileSync(require.resolve('../mandala-art.js'),'utf8'),context);
 return {art:context.WindsMandalaArt,images,scripts};
}
test('illustration preparation deduplicates requests and serializes decoding',async()=>{
 let active=0,peak=0;
 const {art,images,scripts}=studio({decode:async()=>{active++;peak=Math.max(active,peak);await new Promise(resolve=>setImmediate(resolve));active--;}});
 const a=art.prepare('art-lion'),b=art.prepare('art-lion');assert.equal(a,b);
 const records=await Promise.all([a,b,art.prepare('art-elephant'),art.prepare('art-wolf')]);
 assert.equal(records[0],records[1]);assert.equal(images.length,3);assert.equal(peak,1);
 assert.equal(scripts[0].src,'./assets/mandalas/lion.js?v=65');assert.ok(images[0].src.startsWith('data:image/webp;base64,'));
 const calls=[];art.draw({drawImage(...args){calls.push(args);}},art.DESIGNS[0],records[0]);
 assert.equal(calls[0][0],images[0]);assert.deepEqual(calls[0].slice(1),[-1,-1,2,2]);
 assert.throws(()=>art.draw({},art.DESIGNS[1],records[0]),/Prepare/);
});
test('decoded illustration cache is bounded and prepared records survive eviction',async()=>{
 const {art,images}=studio();const record=await art.prepare('art-lion');
 for(const design of art.DESIGNS.slice(1,7))await art.prepare(design.id);
 assert.throws(()=>art.draw({},art.DESIGNS[0]),/Prepare/);
 let drawn;art.draw({drawImage(image){drawn=image;}},art.DESIGNS[0],record);assert.equal(drawn,images[0]);
 const count=images.length;await art.prepare(art.DESIGNS[6].id);assert.equal(images.length,count);
 await art.prepare('art-lion');assert.equal(images.length,count+1);
});
test('failed decoding can retry and cannot poison later artwork preparation',async()=>{
 let fail=true;const {art}=studio({decode:async()=>{if(fail)throw Error('offline');}});
 await assert.rejects(art.prepare('art-lion'),/not available/);fail=false;
 assert.equal((await art.prepare('art-elephant')).id,'art-elephant');
 assert.equal((await art.prepare('art-lion')).id,'art-lion');
 await assert.rejects(art.prepare('../unknown'),/available/);
});

test('all fifty deployable artwork files contain distinct valid WebP data for the matching design',()=>{
 const art=require('../mandala-art.js'),hashes=new Set();
 for(const design of art.DESIGNS){
  const source=readFileSync(require.resolve('../assets/mandalas/'+design.motif+'.js'),'utf8');
  const match=source.match(/^WindsMandalaArt\.register\(("art-[^"]+"),("data:image\/webp;base64,[A-Za-z0-9+/=]+")\);\s*$/);
  assert.ok(match,design.id);const [id,src]=JSON.parse('['+match[1]+','+match[2]+']');assert.equal(id,design.id);assert.ok(src.length<=12000000);
  const bytes=Buffer.from(src.split(',')[1],'base64');assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  hashes.add(createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(hashes.size,50);
});
