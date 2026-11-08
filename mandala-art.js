/* Individually composed local coloring artwork. No remote image service is used. */
(function(root,factory){const api=factory(root);if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.WindsMandalaArt=api;})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const subjects=[
    ['lion','Lion of the Sun','Animals'],['tiger','Tiger of the Forest','Animals'],['elephant','Elephant of Wisdom','Animals'],['wolf','Moonlit Wolf','Animals'],['fox','Fox of the Meadow','Animals'],
    ['cat','Celestial Cat','Animals'],['dog','Faithful Companion','Animals'],['horse','Horse of the Wind','Animals'],['deer','Woodland Deer','Animals'],['bear','Mountain Bear','Animals'],
    ['panda','Bamboo Panda','Animals'],['koala','Eucalyptus Koala','Animals'],['rabbit','Moon Rabbit','Animals'],['giraffe','Giraffe of the Savanna','Animals'],['zebra','Zebra Mosaic','Animals'],
    ['rhino','Rhino Guardian','Animals'],['ram','Ram of the Highlands','Animals'],['buffalo','Buffalo of the Plains','Animals'],['monkey','Monkey Garden','Animals'],['cheetah','Cheetah of the Dawn','Animals'],
    ['snow-leopard','Snow Leopard Jewel','Animals'],['dragon','Dragon of the Clouds','Animals'],['unicorn','Unicorn Sanctuary','Animals'],['red-panda','Red Panda Grove','Animals'],['gazelle','Desert Gazelle','Animals'],
    ['owl','Owl of the Night','Birds'],['peacock','Peacock of Jewels','Birds'],['eagle','Eagle in Flight','Birds'],['swan','Swan of the Lotus Lake','Birds'],['phoenix','Phoenix Rising','Birds'],
    ['hummingbird','Hummingbird Blossom','Birds'],['parrot','Parrot of the Canopy','Birds'],['crane','Crane of Still Waters','Birds'],
    ['turtle','Sea Turtle Mosaic','Ocean'],['dolphin','Dolphin of the Waves','Ocean'],['koi','Koi of Abundance','Ocean'],['koi-pair','Twin Koi Harmony','Ocean'],['seahorse','Seahorse Garden','Ocean'],['whale','Whale of the Deep','Ocean'],['octopus','Octopus of the Reef','Ocean'],
    ['buddha-meditation','Buddha in Meditation','Buddha & Zen'],['buddha-face','Serene Buddha','Buddha & Zen'],['buddha-lotus','Lotus Buddha','Buddha & Zen'],['buddha-blessing','Blessing Buddha','Buddha & Zen'],['bodhi-tree','Bodhi Tree','Buddha & Zen'],
    ['lotus-sanctuary','Lotus Sanctuary','Buddha & Zen'],['dharma-wheel','Dharma Wheel','Buddha & Zen'],['endless-knot','Endless Knot','Buddha & Zen'],['stupa','Temple of Stillness','Buddha & Zen'],['zen-bonsai','Zen Bonsai','Buddha & Zen']
  ];
  const DESIGNS=Object.freeze(subjects.map(([motif,name,collection],variant)=>Object.freeze({id:'art-'+motif,name,collection,level:'Intricate',detail:`Ornamental ${name.toLowerCase()} illustration with flowing botanical linework and a coordinated decorative frame`,motif,variant,keywords:'advanced complex illustrated '+(collection==='Buddha & Zen'?'buddha budha budhha meditation spiritual':'')})));
  const ASSETS=Object.freeze(DESIGNS.map(design=>'./assets/mandalas/'+design.motif+'.webp'));
  const source=typeof document!=='undefined'&&document.currentScript?.src;
  const base=source?new URL('./assets/mandalas/',source).href:'./assets/mandalas/';
  const ready=new Map(),pending=new Map();let decoding=Promise.resolve();
  // Decode on demand. Callers retain their prepared record if the six-image
  // memory cache evicts it while another illustration is being prepared.
  function prepare(id){
    const design=DESIGNS.find(design=>design.id===id);
    if(!design)return Promise.reject(Error('Choose an available illustrated mandala.'));
    if(ready.has(id)){const record=ready.get(id);ready.delete(id);ready.set(id,record);return Promise.resolve(record);}
    if(pending.has(id))return pending.get(id);
    const job=decoding.then(async()=>{
      if(typeof root.Image!=='function')throw Error('Illustrations need an image-capable browser.');
      const image=new root.Image();image.decoding='async';image.src=base+design.motif+'.webp';await image.decode();
      if(!image.naturalWidth||!image.naturalHeight)throw Error('The illustration could not be decoded.');
      const record=Object.freeze({id,image});ready.set(id,record);
      while(ready.size>6)ready.delete(ready.keys().next().value);
      return record;
    });
    decoding=job.catch(()=>{});
    const result=job.catch(()=>{throw Error('This illustration is not available. Connect once to download the artwork, then try again.');}).finally(()=>pending.delete(id));
    pending.set(id,result);return result;
  }
  function draw(ctx,design,prepared){
    const record=prepared||ready.get(design.id);
    if(!record||record.id!==design.id)throw Error('Prepare this illustration before drawing it.');
    ctx.drawImage(record.image,-1,-1,2,2);
  }
  return Object.freeze({DESIGNS,ASSETS,prepare,draw});
});
