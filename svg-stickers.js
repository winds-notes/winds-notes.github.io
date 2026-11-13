/* Original sticker artwork. SVG thumbnails and canvas painting share these paths. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.WindsSvgStickers=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const ink='#303047',cream='#fff3dc',pink='#f39aab',gold='#ffca64',orange='#f3a058';
  const mint='#8cd8b8',teal='#55ab9d',blue='#8bc9ef',navy='#5d719d',purple='#c4abf0';
  const white='#fffdf7',gray='#aab5cf',brown='#a9674d',sand='#dfac77';
  const art=new Map();
  const path=(d,fill='none',stroke=ink,width=2.5)=>({d,fill,stroke,width});
  const spot=(d,fill)=>path(d,fill,'none');
  const line=(d,stroke=ink,width=2.3)=>path(d,'none',stroke,width);
  const ellipse=(x,y,rx,ry,fill,stroke=ink,width=2.5)=>path(
    `M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 ${-2*rx} 0z`,fill,stroke,width);
  const dot=(x,y,r=2,fill=ink)=>ellipse(x,y,r,r,fill,'none');
  const eyes=(y=32)=>[ellipse(23,y,2,2.7,ink,'none'),ellipse(41,y,2,2.7,ink,'none')];
  const cheeks=(y=39)=>[ellipse(18,y,3.2,1.8,pink,'none'),ellipse(46,y,3.2,1.8,pink,'none')];
  const muzzle=(fill=cream)=>[ellipse(32,41,10.5,7,fill,'none'),spot('M28 38q4-2 8 0l-2.5 3q-1.5 1.5-3 0z',ink),
    line('M32 42q-2 4-5 2m5-2q2 4 5 2',ink,1.6)];
  const face=(fill)=>path('M12 33C12 20 21 16 32 16S52 20 52 33v5c0 10-8 17-20 17S12 48 12 38z',fill);
  const roundEars=(fill,inside=pink)=>[dot(16,19,8,ink),dot(48,19,8,ink),dot(16,19,5.5,fill),dot(48,19,5.5,fill),dot(16,20,3,inside),dot(48,20,3,inside)];
  function register(id,name,keywords,emoji,...layers){
    art.set(id,{id,name,keywords,emoji,layers:layers.flat()});
  }
  const registerSubject=subject=>(id,name,keywords,emoji,...layers)=>{
    register(id,name,`${subject} ${keywords}`,emoji,...layers);
    art.get(id).subject=subject;
  };
  const cat=(fill,mark)=>[
    path('M11 30 10 12q0-4 4-2l13 10q5-1 10 0l13-10q4-2 4 2l-1 18q4 5 4 10c0 10-10 16-25 16S7 50 7 40q0-5 4-10z',fill),
    spot('M14 15l9 7-9 5zm36 0-9 7 9 5z',pink),mark,
    ...eyes(34),...cheeks(41),spot('M28.5 39.5q3.5-2.5 7 0L32 43z','#b56376'),
    line('M32 43q-2 4-5 2m5-2q2 4 5 2M8 39l10 2M9 46l9-2m38-5-10 2m9 5-9-2',ink,1.6)
  ];
  register('ginger-cat','Ginger cat','cat kitten kitty pet animal tabby orange','🐱',
    cat('#ffb46d',spot('M27 20l5 9 5-9zm-12 9 5 2-6 2zm34 0-5 2 6 2z','#d37e51')));
  register('tuxedo-cat','Tuxedo cat','cat kitten kitty pet animal black white','🐈‍⬛',
    cat('#8795b7',spot('M32 25c-4 9-11 9-14 14-5 8 4 14 14 14s19-6 14-14c-3-5-10-5-14-14z',white)));
  register('calico-cat','Calico cat','cat kitten kitty pet animal patches','🐈',
    cat(white,spot('M13 24q3-6 9-4c6 3 4 12-1 14-5 2-9-1-8-10zm34-2q7 0 7 9c-2 6-9 5-12 1-2-4 0-9 5-10z',orange)),
    spot('M40 50q5-6 12-6-4 7-12 6z',navy));
  register('puppy','Puppy','dog puppy pet animal floppy ears','🐶',
    path('M18 18C10 11 4 22 4 35q0 12 8 11 4-2 6-11m28-17c8-7 14 4 14 17q0 12-8 11-4-2-6-11',brown),
    face(sand),spot('M20 23q6-3 8 2c2 6-1 11-6 12-7 1-9-9-2-14z',brown),eyes(),muzzle(white));
  register('corgi','Corgi','dog puppy pet animal pointy ears','🐕',
    path('M13 31 11 12q0-5 4-3l13 13h8L49 9q4-2 4 3l-2 19q4 4 4 9c0 11-10 16-23 16S9 51 9 40q0-5 4-9z',orange),
    spot('M15 15l9 10-8 3zm34 0-9 10 8 3z',pink),
    spot('M31 26q-3 8-14 12c-8 8 1 15 15 15s23-7 15-15q-11-4-14-12z',white),eyes(34),muzzle(white));
  register('fox','Fox','woodland forest animal fox kitsune','🦊',
    path('M12 32 8 12q0-3 4-2l14 12h12l14-12q4-1 4 2l-4 20 5 7q-5 8-25 17Q12 47 7 39z',orange),
    spot('M13 16l10 8-8 4zm38 0-10 8 8 4z',cream),spot('M10 38q12-2 22 10 10-12 22-10-7 8-22 15-15-7-22-15z',white),
    eyes(34),dot(32,46,3));
  register('wolf','Wolf','wolf forest woodland animal canine','🐺',
    path('M12 31 10 11q0-3 3-2l14 12h10L51 9q3-1 3 2l-2 20 5 7-5 2 1 5q-8 9-21 11-13-2-21-11l1-5-5-2z',gray),
    spot('M14 15l9 8-8 4zm36 0-9 8 8 4z','#e8bbcc'),spot('M32 28c-4 11-15 8-19 13q8 9 19 12 11-3 19-12c-4-5-15-2-19-13z',white),
    eyes(34),muzzle(white));
  register('rabbit','Rabbit','bunny rabbit hare woodland pet animal','🐰',
    path('M18 30C13 18 12 6 18 4c6-2 10 8 10 22h8c0-14 4-24 10-22 6 2 5 14 0 26',cream),
    line('M20 11q3 5 4 14m20-14q-3 5-4 14',pink,3),ellipse(32,42,22,15,cream),eyes(39),cheeks(45),
    line('M30 44l2 2 2-2m-2 2v4m-2 0h4',ink,1.6));
  register('hamster','Hamster','hamster guinea pig pet rodent animal','🐹',
    roundEars(sand),ellipse(32,36,23,20,sand),spot('M14 39q7-9 18 0 11-9 18 0c4 9-7 14-18 14S10 48 14 39z',white),
    eyes(),cheeks(43),muzzle(white));
  register('mouse','Mouse','mouse rat pet rodent animal','🐭',
    ellipse(14,19,9,11,gray),ellipse(50,19,9,11,gray),dot(14,19,5,pink),dot(50,19,5,pink),
    path('M12 34c0-11 8-17 20-17s20 6 20 17c0 7-5 12-16 20q-4 3-8 0c-11-8-16-13-16-20z',gray),eyes(32),
    dot(32,49,3,pink),line('M22 42 9 40m13 6-11 2m31-6 13-2m-13 6 11 2',ink,1.6));
  register('bear','Bear','bear teddy woodland forest animal','🐻',
    roundEars(brown,sand),face(brown),eyes(),cheeks(),muzzle(sand));
  register('panda','Panda','panda bear bamboo animal','🐼',
    roundEars(navy,ink),face(white),ellipse(22,32,6,7,navy,'none'),ellipse(42,32,6,7,navy,'none'),
    dot(23,31,1.8,white),dot(41,31,1.8,white),cheeks(43),muzzle(white));
  register('koala','Koala','koala australia eucalyptus animal','🐨',
    ellipse(13,26,9,12,gray),ellipse(51,26,9,12,gray),ellipse(12,26,4,7,cream,'none'),ellipse(52,26,4,7,cream,'none'),
    face(gray),eyes(),cheeks(43),ellipse(32,37,4,7,navy,ink,1.5),line('M29 47q3 3 6 0',ink,1.6));
  register('raccoon','Raccoon','raccoon mask forest woodland animal','🦝',
    roundEars(gray),face(gray),spot('M12 33q9-11 20-1 11-10 20 1-4 11-13 8l-7-5-7 5q-9 3-13-8z',navy),
    dot(22,33,2,white),dot(42,33,2,white),muzzle(cream),line('M29 19l3 5 3-5',navy,2));
  register('tiger','Tiger','tiger big cat jungle animal stripes','🐯',
    roundEars(orange),face(orange),spot('M28 17l4 9 4-9zm-15 9 8 4-8 1zm-1 11 8 2-7 3zm39-11-8 4 8 1zm1 11-8 2 7 3z',ink),
    eyes(33),muzzle(white));
  register('lion','Lion','lion big cat mane safari animal','🦁',
    path('M32 7q7 0 10 5 9-2 12 7 7 3 5 12 4 7-2 13 1 8-8 10-4 7-13 4-8 4-15-1-9 1-12-7-7-5-4-13-3-8 3-13 1-9 10-11 5-7 14-6z','#d9874b'),
    roundEars(gold),face(gold),eyes(32),cheeks(),muzzle(cream));
  register('leopard','Leopard','leopard jaguar big cat safari animal spotted','🐆',
    roundEars(gold),face(gold),line('M18 28q-2-4 2-4m7-3q3-3 6 0m12 5q2-4-2-4M16 43q2 5 5 2m23 0q3 3 5-2m-10 6 2 1',brown,2.8),
    eyes(32),muzzle(cream));
  register('cow','Cow','cow calf dairy farm animal','🐮',
    path('M20 22q-8-8-4-13 6 2 9 10m19 3q8-8 4-13-6 2-9 10',cream),
    ellipse(12,27,8,5,white),ellipse(52,27,8,5,white),face(white),
    spot('M16 29c0-7 8-10 14-8q4 3 0 8c-4 6-10 10-15 7z',navy),eyes(),
    ellipse(32,45,17,9,pink),dot(25,45,1.8),dot(39,45,1.8));
  register('pig','Pig','pig piglet farm animal','🐷',
    path('M16 28Q5 11 11 11q11 0 17 10m20 7q11-17 5-17-11 0-17 10',pink),ellipse(32,36,23,20,'#ffc4ca'),
    eyes(32),ellipse(32,43,12,8,pink),dot(28,43,1.8),dot(36,43,1.8));
  register('sheep','Sheep','sheep lamb wool farm animal','🐑',
    path('M22 13q6-8 12-3 7-5 12 3 8-1 9 7 7 4 3 12 4 8-3 12-2 9-10 8-5 7-13 3-8 4-13-3-8 1-10-8-7-4-3-12-4-8 3-12 1-8 13-7z',white),
    ellipse(15,34,7,4,sand),ellipse(49,34,7,4,sand),ellipse(32,36,14,16,cream),eyes(34),line('M29 43q3 3 6 0',ink,1.8));
  register('horse','Horse','horse pony mane equestrian farm animal','🐴',
    path('M18 29 14 10q8 0 13 11h10q6-10 13-11l-4 19 5 9-5 15H18l-5-15z',sand),
    spot('M24 21q3-7 10-7 8 0 10 10l-7 11-4-7-6 4z',brown),eyes(35),
    ellipse(32,46,15,9,cream),dot(25,46,1.6),dot(39,46,1.6));
  register('zebra','Zebra','zebra horse stripes safari animal','🦓',
    path('M18 29 14 10q8 0 13 11h10q6-10 13-11l-4 19 5 9-5 15H18l-5-15z',white),
    spot('M26 21q7-8 15 0l-6 13-4-5-5 2zM16 31l8 2-8 3zm32 0-8 2 8 3z',navy),
    eyes(35),ellipse(32,46,15,9,gray),dot(25,46,1.6),dot(39,46,1.6));
  register('deer','Deer','deer fawn woodland forest antlers animal','🦌',
    line('M23 24 17 14V6m0 8-7-3m9 6 5-6m17 13 6-10V6m0 8 7-3m-9 6-5-6',brown,3.2),
    ellipse(14,27,8,4.5,sand),ellipse(50,27,8,4.5,sand),face(sand),eyes(34),muzzle(cream),
    dot(28,24,1.6,white),dot(36,24,1.6,white),dot(32,28,1.5,white));
  register('giraffe','Giraffe','giraffe safari tall animal','🦒',
    line('M25 22 21 11m18 11 4-11',brown,3),dot(20,10,3,brown),dot(44,10,3,brown),
    ellipse(13,24,8,4,gold),ellipse(51,24,8,4,gold),path('M17 32c0-9 6-14 15-14s15 5 15 14l-3 17q-3 8-12 8t-12-8z',gold),
    spot('M21 28l6-5 5 3-3 6-6 1zm15-6 7 5-2 5-5-2z',brown),eyes(35),
    ellipse(32,46,13,8,cream),dot(27,45,1.5),dot(37,45,1.5),line('M29 50q3 2 6 0',ink,1.4));
  register('elephant','Elephant','elephant trunk safari animal','🐘',
    ellipse(13,34,9,16,gray),ellipse(51,34,9,16,gray),ellipse(12,34,4,10,pink,'none'),ellipse(52,34,4,10,pink,'none'),
    path('M15 32c0-12 8-18 17-18s17 6 17 18q0 13-10 17-1 11-11 9-7-2-6-9l6 1q2 4 4 0V40',gray),
    eyes(31),line('M33 43q3 2 6 0m-6 5q3 2 5 0',navy,1.7));
  register('hippo','Hippo','hippopotamus river safari animal','🦛',
    roundEars(purple),face(purple),eyes(30),ellipse(32,43,21,13,'#dfc9f6'),
    dot(23,41,2,navy),dot(41,41,2,navy),line('M22 49q10 7 20 0',navy,1.8),
    spot('M25 49h5v4l-5-1zm9 0h5v3l-5 1z',white));
  register('frog','Frog','frog toad pond amphibian animal','🐸',
    path('M10 33C7 21 14 15 22 18q6 1 8 7h4q2-6 8-7c8-3 15 3 12 15q5 5 5 11c0 8-10 12-27 12S5 52 5 44q0-6 5-11z',mint),
    dot(20,28,3),dot(44,28,3),cheeks(40),line('M21 42q11 10 22 0',ink,2.3));
  register('penguin','Penguin','penguin antarctic bird animal winter','🐧',
    path('M19 31Q7 34 8 47q1 3 10-2m27-14q12 3 11 16-1 3-10-2',navy),
    ellipse(23,54,7,4,orange),ellipse(41,54,7,4,orange),ellipse(32,33,18,23,navy),
    spot('M17 34q0-13 8-13 5 0 7 5 2-5 7-5 8 0 8 13c0 13-5 19-15 19s-15-6-15-19z',white),
    eyes(31),spot('M27 36q5-4 10 0l-5 5z',orange));
  register('owl','Owl','owl wise bird woodland animal night','🦉',
    path('M12 31 9 12l15 8q8-3 16 0l15-8-3 19q4 7 1 15c-3 8-11 11-21 11s-18-3-21-11q-3-8 1-15z',brown),
    ellipse(23,33,10,11,cream,'none'),ellipse(41,33,10,11,cream,'none'),
    dot(23,33,4),dot(41,33,4),dot(22,32,1.2,white),dot(40,32,1.2,white),spot('M28 41q4-3 8 0l-4 5z',gold),
    line('m24 48 3 2m5-2 3 2m5-2 3 2',cream,1.6));
  register('chick','Chick','chicken chick bird farm animal spring','🐤',
    line('M23 53v5m18-5v5m-22 0h8m10 0h8',brown,2.5),
    path('M31 14q0-5 6-6 0 4-2 6 5-3 8 0l-4 4c9 4 15 12 15 20 0 12-10 17-22 17S10 50 10 38c0-12 8-22 21-24z',gold),
    eyes(33),cheeks(40),path('M27 38q5-4 10 0l-5 5z',orange,ink,1.5));
  register('duck','Duck','duck duckling bird pond farm animal','🦆',
    path('M7 42q10 3 16-6V24c0-9 7-14 15-14 9 0 15 6 15 14v7l6 2q2 5-8 6c-2 11-10 15-23 15Q12 54 7 42z',gold),
    spot('M52 31l7 2q2 5-8 6l-6-5z',orange),line('M46 34h6',brown,1.8),dot(43,25,2.3),
    path('M17 44q10 2 18-3-1 9-11 9-5-1-7-6z','#f1ad56',brown,1.6));
  register('parrot','Parrot','parrot bird macaw jungle animal tropical','🦜',
    path('M14 34C6 19 17 8 32 8c12 0 20 8 20 18 0 8-4 12-10 17L32 58l-6-2 2-11c-7 1-11-3-14-11z','#ef8b85'),
    spot('M19 25q12-4 17 6L30 44q-9 1-11-19z',blue),spot('M32 17q10-4 16 4-1 12-13 10-6-2-3-14z',cream),
    dot(39,23,2.2),path('M47 24q9-3 12 4l-6 8-7-5z',gold,ink,1.7));
  register('turtle','Turtle','turtle tortoise shell reptile animal','🐢',
    ellipse(15,46,7,5,mint),ellipse(41,46,7,5,mint),ellipse(52,35,8,7,mint),
    path('M7 40q4-20 21-20t21 20q-21 13-42 0z',teal),
    path('m28 22 9 9-4 10H23l-4-10z',mint,ink,1.6),line('m10 36 9-5m18 0 9 5m-23 5-6 5m16-5 6 5',ink,1.6),dot(54,34,1.6));
  register('octopus','Octopus','octopus sea ocean marine animal','🐙',
    path('M15 37C9 24 18 11 32 11S55 24 49 37c1 5 4 5 8 3 4-1 5 4 2 7q-5 6-13 2 1 7-5 8-5 0-7-6-2 7-7 7-5-1-5-7-5 6-10 3-4-3-1-8-6 2-7-3 0-4 5-3 4 0 6-3z',purple),
    eyes(31),cheeks(37),line('M28 37q4 5 8 0',ink,1.8),dot(21,20,2,white),dot(25,17,1.4,white));
  register('whale','Whale','whale sea ocean marine animal water','🐋',
    path('M7 35c7-12 22-13 34-4l5 3c0-7 5-11 13-10q2 9-8 13-5 13-21 14C17 53 7 48 7 35z',blue),
    spot('M11 43q15 7 34-2c-5 8-24 12-34 2z',white),dot(18,35,2.2),
    line('M20 17q-5-7-10-3m10 3q4-9 10-5m-10 5-1 5',teal,2.4));
  register('fish','Reef fish','fish aquarium sea ocean marine animal','🐠',
    path('M39 30 56 20l-2 12 2 12-17-10',orange),path('M17 20q9-10 18 2m-13 21q7 10 16 0',gold),
    path('M5 32c9-16 27-16 41 0C32 48 14 48 5 32z',gold),spot('M25 22q7 10 0 20l7-2q4-8 0-16z',white),
    dot(15,30,2),line('M11 36q2 2 5 1',brown,1.6));
  register('jellyfish','Jellyfish','jellyfish sea ocean marine animal','🪼',
    line('M17 35q-5 9 2 16m8-13q6 6 0 16m10-16q-6 8 2 16m8-19q5 8-1 15',navy,3),
    path('M9 32C9 19 19 10 32 10s23 9 23 22q-6 9-12 1-6 8-11 1-6 7-12-1-5 8-11-1z',blue),
    eyes(25),line('M29 28q3 3 6 0',ink,1.5),line('M17 20q3-5 8-6',white,2.6));
  register('butterfly','Butterfly','butterfly insect garden nature animal','🦋',
    path('M31 31C21 12 9 9 6 17c-4 9 1 19 11 22-9 7-4 16 4 14 6-1 10-8 11-13m1-9c10-19 22-22 25-14 4 9-1 19-11 22 9 7 4 16-4 14-6-1-10-8-11-13',purple),
    dot(16,26,4,cream),dot(48,26,4,cream),dot(21,43,2.5,pink),dot(43,43,2.5,pink),
    ellipse(32,34,4,11,navy),line('M30 25q-2-7-6-8m10 8q2-7 6-8',ink,1.7));
  register('bee','Bee','bee honey insect garden animal','🐝',
    ellipse(23,23,7,12,blue),ellipse(39,21,7,10,blue),ellipse(32,37,19,13,gold),
    spot('M19 28q-2 8 2 17l6 3q-6-10-2-21zm13-4q-4 13 3 25l6-2q-6-12-2-21z',ink),
    dot(44,35,2,ink),line('M49 40 56 37m-9-10 4-6',ink,2));
  register('ladybug','Ladybug','ladybug ladybird beetle insect garden animal','🐞',
    ellipse(32,19,10,8,navy),line('m27 14-6-5m16 5 6-5M14 31l-6-3m6 14-6 3m42-14 6-3m-6 14 6 3',ink,2),
    ellipse(32,37,19,17,'#ee797f'),line('M32 21v32',ink,2.3),
    dot(23,31,3.4),dot(21,42,3),dot(41,31,3.4),dot(43,42,3));
  register('snail','Snail','snail shell garden slow animal','🐌',
    path('M8 47c8-1 13-6 21-8l14-3 2-9q1-4 5-4 6 0 7 7l2 13q0 9-12 9H9q-5 0-1-5z',mint),
    line('m48 25-3-8m9 8 4-8',ink,2),dot(45,17,2),dot(58,17,2),ellipse(27,33,15,15,orange),
    line('M34 35q0 8-8 7-7-1-7-9 1-7 8-7 5 1 4 5-1 3-4 2',brown,2.2),dot(53,33,1.8));

  register('paw-print','Paw print','paw animal pet cat dog footprint','🐾',
    path('M18 45c0-6 7-14 14-14s14 8 14 14c0 6-6 9-14 4-8 5-14 2-14-4z',purple),
    ellipse(12,29,4,6,purple),ellipse(25,20,4.5,7,purple),ellipse(39,20,4.5,7,purple),ellipse(52,29,4,6,purple));
  register('daisy','Daisy','daisy flower spring garden nature','🌼',
    line('M32 32v25',teal,3),path('M32 52q-16 1-15-12 10 1 15 12m0 2q2-13 15-14 1 11-15 14',mint,teal,2),
    ellipse(32,14,6,8,white),ellipse(32,34,6,8,white),ellipse(22,24,8,6,white),ellipse(42,24,8,6,white),dot(32,24,7,gold));
  register('sunflower','Sunflower','sunflower bloom flower garden nature','🌻',
    line('M32 32v26',teal,3),path('M32 52q-12 3-15-9 12 0 15 9m0 2q5-11 15-11-2 10-15 11',mint,teal,2),
    path('M32 6l5 7 8-3 2 8 8 2-3 8 4 6-8 4-1 8-8-2-7 6-7-6-8 2-1-8-8-4 4-6-3-8 8-2 2-8 8 3z',gold),
    ellipse(32,28,12,12,brown),dot(28,26,1.4,cream),dot(36,26,1.4,cream),dot(32,32,1.4,cream));
  register('mushroom','Mushroom','mushroom fungi toadstool forest nature','🍄',
    path('M25 31h14l4 20q-11 8-22 0z',cream),path('M6 33C7 18 18 10 32 10s25 8 26 23c-14 7-38 7-52 0z','#ee858b'),
    dot(21,22,4,white),dot(37,17,3,white),dot(44,29,4,white),dot(30,30,2.3,white));
  register('cactus','Cactus','cactus desert succulent potted plant nature','🌵',
    path('M23 43V29h-7q-6 0-6-7v-5q0-4 4-4t4 4v6h5V14q0-7 8-7t8 7v14h6v-6q0-4 4-4t4 4v6q0 7-7 7h-7v8z',mint),
    line('M31 14v25',teal,1.8),path('M16 42h30l-4 14H20z',orange),line('M18 46h26',brown,1.7));
  register('cherries','Cherries','cherry fruit food garden nature','🍒',
    line('M20 39q0-17 17-24-3 16 8 23',teal,2.8),path('M37 15q8-11 18-6-3 9-18 6z',mint,teal,2),
    ellipse(19,44,10,10,'#eb7c88'),ellipse(44,44,10,10,'#eb7c88'),
    line('M14 42q1-4 4-4m21 4q1-4 4-4',white,2.2));
  register('rainbow','Rainbow','rainbow sky weather colorful nature','🌈',
    line('M8 42a24 24 0 0 1 48 0','#ef8997',6),line('M14 42a18 18 0 0 1 36 0',gold,6),
    line('M20 42a12 12 0 0 1 24 0',mint,6),line('M26 42a6 6 0 0 1 12 0',purple,6),
    path('M6 43q-1-5 4-6 4 0 6 4 5-2 7 3 2 5-4 7H8q-7-2-2-8zm35 1q2-5 7-3 2-4 6-4 5 1 4 6 5 6-2 8H45q-6-2-4-7z',white,navy,1.7));
  register('sun','Sun','sunshine sky weather nature','☀️',
    line('M32 5v7m0 40v7M5 32h7m40 0h7M13 13l5 5m28 28 5 5m0-38-5 5M18 46l-5 5',orange,3.2),
    ellipse(32,32,15.5,15.5,gold),eyes(30),line('M28 36q4 5 8 0',ink,1.8));
  register('moon','Crescent moon','moon night sky space astronomy nature','🌙',
    path('M43 11a22 22 0 1 0 9 33C36 49 24 25 43 11z',gold),
    spot('M49 17l2-5 2 5 5 2-5 2-2 5-2-5-5-2z',purple),dot(56,32,2.4,blue),line('M22 33q3-3 6 0m-1 8q3 2 6-1',brown,1.8));
  register('sparkle','Sparkles','sparkle star magic decoration favorite','✨',
    path('M26 8q4 16 17 19-13 3-17 19-4-16-17-19Q22 24 26 8z',gold),
    path('M49 28q2 9 10 11-8 2-10 11-2-9-10-11 8-2 10-11z',purple,ink,2),
    dot(46,17,3,pink),dot(16,47,2.5,blue));
  register('heart','Heart','heart love favorite valentine decoration','❤️',
    path('M32 54C24 47 7 37 7 23c0-13 17-17 25-6 8-11 25-7 25 6 0 14-17 24-25 31z','#ee879e'),
    line('M15 24q0-8 7-8',white,3),dot(42,35,2,'#db6a85'));
  register('rocket','Rocket','rocket space launch science school','🚀',
    path('M24 29q-11 1-15 16l15-4m15-12q11 1 15 16l-15-4',purple),
    path('M25 43q-5 7 7 16 12-9 7-16',gold),
    path('M21 36C20 23 25 13 32 6c7 7 12 17 11 30l-5 9H26z',white),
    spot('M24 17q3-6 8-11 5 5 8 11z','#ef8c9d'),ellipse(32,27,5,5,blue),line('M24 38h16',navy,1.8));
  register('open-book','Open book','open book reading study school education','📖',
    path('M32 16Q17 8 6 15v33q13-4 26 5 13-9 26-5V15q-11-7-26 1z',cream),
    line('M32 16v37M12 23q7-2 14 2m-14 6q7-2 14 2m-14 6q7-2 14 2m26-18q-7-2-14 2m14 6q-7-2-14 2m14 6q-7-2-14 2',brown,1.8));
  register('pencil','Pencil','pencil writing drawing stationery school education','✏️',
    path('m9 54 4-14L43 10q4-4 8 0l3 3q4 4 0 8L24 51z',gold),
    spot('m10 52 4-11 9 9z',cream),spot('m10 52 2-6 4 4z',ink),spot('m41 13 3-3q3-3 7 1l3 3q3 3 0 6l-3 3z',pink),
    line('m41 13 10 10M15 40l9 9m-5-4 26-26',brown,1.8));

  const science=registerSubject('science');
  science('microscope','Microscope','biology optics laboratory specimen lens','🔬',
    path('M36 20h7q12 8 12 21 0 10-8 13H28v-8h14q6-7-1-16z',purple),
    path('M16 48h28l7 10H9z',navy),path('m26 13 12 6-10 18-11-6z',blue),
    path('m25 8 15 8-3 6-15-8z',navy),path('m18 29 11 6-4 7-11-6z',cream),
    line('M12 43h24m4-15 5-2',ink,2.5),dot(44,34,3,white));
  science('flask','Erlenmeyer flask','chemistry lab experiment reaction glass','⚗️',
    path('M23 9h18v5h-3v13l15 22c3 4 1 8-4 8H15c-5 0-7-4-4-8l15-22V14h-3z',white),
    spot('M16 47l7-10q9-5 18 0l7 10q4 6-1 6H17q-5 0-1-6z',teal),
    line('M24 14h16M35 22h3m-3 6h3m-1 6 4 2',navy,1.7),
    dot(26,45,2,white),dot(34,40,1.6,white),dot(38,48,2.7,white),dot(48,18,3,purple));
  science('test-tubes','Test tubes','chemistry laboratory samples experiment rack','🧪',
    path('M7 33h50v6h-4v15H11V39H7z',navy),
    path('M14 11h15v5h-3v28a4.5 4.5 0 0 1-9 0V16h-3z',white),
    path('M35 8h15v5h-3v31a4.5 4.5 0 0 1-9 0V13h-3z',white),
    spot('M18.5 26h6v17q0 4-3 4t-3-4z',pink),spot('M39.5 20h6v23q0 4-3 4t-3-4z',mint),
    line('M15 17h13m8-3h13M12 53h40',ink,1.6),dot(42.5,33,1.3,white));
  science('dna-helix','DNA double helix','dna genetics genome biology molecule chromosome','🧬',
    line('M18 8c0 12 28 12 28 24S18 44 18 56',ink,6),
    line('M46 8c0 12-28 12-28 24s28 12 28 24',ink,6),
    line('M18 8c0 12 28 12 28 24S18 44 18 56',purple,3.6),
    line('M46 8c0 12-28 12-28 24s28 12 28 24',teal,3.6),
    line('M20 13h24M23 27h18m-22 6h26m-22 6h18m-21 12h24',navy,2),dot(32,33,2.1,gold));
  science('atom','Atom','physics chemistry electron nucleus orbital','⚛️',
    path('M32 6c7 0 11 11 11 26S39 58 32 58 21 47 21 32 25 6 32 6z', 'none',purple,2.8),
    path('M10 19c4-6 16-4 28 3s20 17 16 23-16 4-28-3S6 25 10 19z','none',navy,2.8),
    path('M10 45c-4-6 4-16 16-23s24-9 28-3-4 16-16 23-24 9-28 3z','none',teal,2.8),
    ellipse(32,32,5.5,5.5,gold,ink,1.7),dot(42,45,3,navy),dot(19,17,3,teal),dot(32,6.5,2.8,purple));
  science('plant-cell','Plant cell','biology organelles chloroplast membrane nucleus','🌱',
    path('M14 14q14-9 36 0l6 9-5 25q-17 11-39 1L7 35z',mint),
    path('M17 19q13-7 29 0l5 7-4 18q-14 8-31 1l-4-11z',cream,teal,1.8),
    ellipse(30,32,7,8,purple,ink,1.7),dot(30,32,2.6,navy),ellipse(42,28,4,6,teal,'none'),
    ellipse(20,38,3.5,4.5,teal,'none'),line('M41 24l2 8M19 35l2 6m15-20 4 1',white,1.5));
  science('petri-dish','Petri dish','microbiology bacteria culture lab agar','🧫',
    path('M8 31v8c0 9 11 15 24 15s24-6 24-15v-8',purple),ellipse(32,31,24,15,white),
    ellipse(32,31,19,10,'#f5c8d4',navy,1.5),dot(23,29,3,teal),dot(39,34,3.4,orange),
    dot(35,26,2,purple),dot(27,36,1.8,navy),line('m17 32 2 2m25-5-3-1M12 41q7 8 20 8',ink,1.5));
  science('telescope','Telescope','astronomy observatory optics space stars','🔭',
    line('M31 35 18 56m13-21 15 21m-15-16v16',ink,4),
    path('m12 25 37-17 8 16-39 12z',blue),path('m10 25 6-3 6 12-6 3z',navy),
    path('m44 10 9-4 9 18-9 3z',purple),ellipse(32,36,4.5,4.5,gold),
    line('m24 24 16-7m7 20v8m-4-4h8m-40-29v8m-4-4h8',navy,1.8));
  science('ringed-planet','Ringed planet','saturn planet astronomy space orbit','🪐',
    line('M8 43c-6-6 4-14 16-20 14-7 30-9 33-3',navy,4.4),
    ellipse(32,32,18,18,gold),spot('M18 24q14 5 29-3l2 5q-13 9-32 4zm-2 13q17 5 34-4l-1 5q-16 10-32 4z',orange),
    line('M57 20c6 6-6 14-20 20S11 49 8 43',navy,4.4),
    line('M57 20c6 6-6 14-20 20S11 49 8 43',purple,2.2),dot(50,50,2.3,teal),dot(12,15,2,purple));
  science('magnet','Horseshoe magnet','physics magnetic poles force electricity','🧲',
    path('M10 12h13v22q0 11 9 11t9-11V12h13v22c0 15-9 23-22 23S10 49 10 34z','#ee8896'),
    path('M10 12h13v12H10zm31 0h13v12H41z',gray),
    line('M17 31v5q1 11 9 14',white,2),line('m30 8 3 6-3 2 3 6',gold,2.4));
  science('volcano','Volcano','geology earth science eruption magma lava','🌋',
    path('m6 54 17-30h16l19 30z',sand),spot('M23 25h16l10 16-8-3-4-8-5 9-5-6-6 6-4-2z','#ee887c'),
    line('M24 24h14M12 49l8-5m24 2 7 3',brown,2),
    line('M26 19 21 9m12 9 2-13m4 14 7-8',orange,3),dot(24,7,2,pink),dot(42,7,1.8,gold));
  science('thermometer','Thermometer','temperature measurement laboratory physics weather','🌡️',
    path('M25 38V14a7 7 0 0 1 14 0v24a12 12 0 1 1-14 0z',white),
    line('M32 24v24','#e86d84',5),dot(32,48,6,'#e86d84'),
    line('M35 16h4m-4 6h4m-4 6h4m-4 6h4M12 16h8m-4-4v8m28 30h7',navy,1.7));

  const artSubject=registerSubject('art');
  artSubject('paint-palette','Paint palette','color painting studio acrylic gouache watercolor','🎨',
    path('M8 34c0-13 12-24 28-24 13 0 22 8 22 18 0 8-7 12-14 12-4 0-6 2-5 5 2 7-5 10-12 9C16 53 8 45 8 34z',cream),
    ellipse(45,23,5.5,4.5,white),dot(20,24,4.8,pink),dot(31,18,4.3,gold),
    dot(16,35,4,teal),dot(24,45,4.8,blue),dot(36,36,4.3,purple));
  artSubject('paintbrush','Paintbrush','brush bristles painting studio acrylic gouache','🖌️',
    path('M24 32c4-7 19-23 27-26 4-2 7 2 4 6L32 39z',orange),
    path('m23 28 13 10-6 8-13-10z',gray),path('M17 35q-8 4-9 11-1 6-4 9c12 3 23 0 27-10z',purple),
    spot('M9 49q8-1 13 3-7 5-18 3 3-3 5-6z',teal),line('M21 35l10 7',white,2));
  artSubject('watercolor-set','Watercolor set','paint pans paintbox watercolor painting studio','🎨',
    path('M10 13h44q4 0 4 4v30q0 4-4 4H10q-4 0-4-4V17q0-4 4-4z',cream),
    line('M8 39h48',navy,1.7),...[[16,pink],[27,gold],[38,teal],[49,purple]].map(([x,color])=>ellipse(x,26,4.4,7,color,ink,1.5)),
    line('M18 45h20',brown,2.5),path('M38 45l8-2v4z',navy,ink,1.4));
  artSubject('easel','Painter’s easel','canvas painting landscape drawing studio','🖼️',
    line('M32 6v49m-9-22L13 57m28-24 10 24',brown,4),
    path('M11 13h42v29H11z',cream),path('M16 19h32v17H16z',blue,navy,1.5),
    dot(37,24,3,gold),spot('m16 36 10-10 9 7 6-4 7 7z',teal),line('M10 43h44',brown,3));
  artSubject('fountain-nib','Fountain pen nib','calligraphy ink lettering typography writing','🖋️',
    path('M32 7 49 28l-6 17-11 12-11-12-6-17z',gold),
    path('M32 7v26', 'none',brown,2),ellipse(32,36,3.5,3.5,ink,'none'),
    path('M21 44q11 3 22 0l-11 13z',navy),line('m24 22-4 7 3 8m17-15 4 7-3 8',white,1.8));
  artSubject('ink-bottle','Ink bottle','drawing calligraphy watercolor pigment art supplies','🖋️',
    path('M22 9h20v10H22z',navy),path('M25 19h14v5l12 9v16q0 6-6 6H19q-6 0-6-6V33l12-9z',blue),
    spot('M15 40q11-5 19-1 7 3 15 0v10q0 4-5 4H20q-5 0-5-4z',purple),
    path('M24 34h16v13H24z',cream,navy,1.6),line('M28 40h8m-13-26h18',ink,1.7));
  artSubject('film-camera','Film camera','photography photo analogue lens arts','📷',
    path('M11 17h12l4-7h12l4 7h10q5 0 5 5v24q0 5-5 5H11q-5 0-5-5V22q0-5 5-5z',sand),
    spot('M8 28h48v15H8z',navy),ellipse(32,34,13,13,cream),ellipse(32,34,9,9,blue),
    line('M27 34q0-5 5-5',white,2),path('M46 22h7v4h-7z',gold,ink,1.5));
  artSubject('theater-masks','Theater masks','theatre drama comedy tragedy performing arts stage','🎭',
    path('M8 15q11 6 26 3l-3 19q-3 11-12 11-8-2-10-13z',purple),
    line('M14 25q3-2 6 0m4 1q3-1 5 1m-15 12q5-6 10-1',ink,1.8),
    path('M28 23q14 2 27-7l-1 21c-1 11-7 17-14 16-8-2-11-10-12-30z',gold),
    line('M33 31q3-2 6-1m6-2q4-3 6-2m-14 13q6 4 12-3-1 8-6 8-3 0-6-5z',ink,1.8));
  artSubject('pottery-vase','Pottery vase','ceramics clay sculpture craft handmade studio','🏺',
    path('M23 9h18l-3 10c0 5 13 9 13 22 0 10-9 15-19 15s-19-5-19-15c0-13 13-17 13-22z',orange),
    ellipse(32,10,10,3.5,cream),spot('M16 35q16 5 32 0l1 7q-16 5-34 0z',cream),
    line('m19 40 5-3 4 4 4-3 4 3 4-4 5 2m-22 9q9 4 18 0',brown,1.8));
  artSubject('origami-crane','Origami crane','paper craft folding bird design origami','🕊️',
    path('M5 28l16 4-2-20 21 19 10-13 9 3-7 6-6 20-15 4-12-7z',blue),
    path('M19 12l12 22 9-3-9 20-12-7 2-12z',purple,ink,1.8),
    line('m5 28 26 23 15-4m-15-13 21-7',navy,1.8),spot('m50 18 9 3-7 6z',gold));
  artSubject('color-wheel','Color wheel','color theory hue spectrum design painting palette','🎨',
    ...['#ee8f9a',orange,gold,mint,blue,purple].map((color,i)=>{
      const point=angle=>[32+23*Math.cos(angle),32+23*Math.sin(angle)].map(value=>+value.toFixed(2)).join(' ');
      const angle=-Math.PI/2+i*Math.PI/3;
      return path(`M32 32L${point(angle)}A23 23 0 0 1 ${point(angle+Math.PI/3)}Z`,color,ink,1.6);
    }),ellipse(32,32,6,6,white,ink,1.7));
  artSubject('violin','Violin','music strings instrument bow orchestra performing arts','🎻',
    path('m28 29 14-19 4 3-13 20',brown),
    path('M23 24q7-1 12 8l-1 5q9 8 3 15-8 9-19 2-10-7-4-16l6-2q-3-8 3-12z',orange),
    path('m39 9 5-5 6 4-4 7z',navy),line('M21 48 44 10m-25 30 4 3m4-9 3 3',ink,1.5),
    line('M37 55 55 14',brown,2.6),line('M39 56 57 16',cream,1.4));

  const engineering=registerSubject('engineering');
  engineering('gear','Spur gear','mechanical cog machine gearbox teeth','⚙️',
    path('m26 8 3-3h6l3 3 1 7 5 3 7-2 4 5-4 6v6l4 6-4 5-7-2-5 3-1 7-3 3h-6l-3-3-1-7-5-3-7 2-4-5 4-6v-6l-4-6 4-5 7 2 5-3z',gray),
    ellipse(32,30,11,11,navy),ellipse(32,30,5.5,5.5,cream,ink,1.7),line('M18 29q0-8 7-12',white,2));
  engineering('robot','Robot','robotics automation electronics machine face','🤖',
    line('M32 10v9',ink,3),dot(32,9,4,gold),path('M6 30h8v15H6zm44 0h8v15h-8z',purple),
    path('M20 19h24q6 0 6 6v22q0 6-6 6H20q-6 0-6-6V25q0-6 6-6z',blue),
    path('M20 27h24v15H20z',navy,ink,1.7),dot(26,34,2.5,mint),dot(38,34,2.5,mint),
    line('M26 47h12m-8 0v3m4-3v3',ink,1.7));
  engineering('circuit-board','Circuit board','pcb electronics chip traces electrical computer hardware','🔌',
    path('M11 9h42q4 0 4 4v38q0 4-4 4H11q-4 0-4-4V13q0-4 4-4z',teal),
    line('M14 17h8v8h8m20-8h-8v8h-7M14 46h8v-8h8m20 8h-8v-8h-7M14 32h36',cream,2.1),
    path('M24 24h16v16H24z',navy),path('M28 28h8v8h-8z',blue,ink,1.5),
    ...[[14,17],[50,17],[14,32],[50,32],[14,46],[50,46]].map(([x,y])=>dot(x,y,2.2,gold)));
  engineering('drafting-compass','Drafting compass','geometry technical drawing design architecture drafting','📐',
    path('M30 12 12 51l3 6 19-37m0-8 18 39-3 6-19-37',gray),
    path('M29 8h6v7h-6z',navy),ellipse(32,17,6,6,blue),
    line('M20 39h24m-3-6v12',brown,2.6),dot(32,17,2,white));
  engineering('blueprint','Blueprint','technical plan drawing schematic design architecture drafting','📐',
    path('M12 9h39q5 0 5 5v33H18q-9 0-9 7V15q0-6 3-6z',blue),
    path('M10 54q1-7 8-7h38q-5 3-3 9H15q-5 0-5-2z',cream),
    line('M18 15v26m9-26v26m9-26v26m9-26v26M15 21h35m-35 9h35m-35 9h35',white,1.1),
    line('M22 38V27l10-9 10 9v11H22zm8 0v-7h5v7',navy,2.1));
  engineering('bridge','Suspension bridge','civil structure cable infrastructure architecture','🌉',
    path('M6 39h52v8H6z',gray),path('M16 17h6v38h-6zm26 0h6v38h-6z',blue),
    line('M7 35q9-6 12-18 13 25 26 0 3 12 12 18M12 31v8m15-11v11m5-7v7m5-11v11m15-8v8',navy,2.1),
    line('M8 52q5-3 10 0m7 0q5-3 10 0m10 0q5-3 10 0',teal,1.8));
  engineering('tower-crane','Tower crane','construction civil lift building engineering structure','🏗️',
    path('M20 12h7v40h-7z',gold),path('M9 14h48v7H9z',orange),path('M14 52h20v6H14z',navy),
    line('m23 11 10 3m-10 7-3 7 7 5-7 5 7 5-7 5m-9-31h44m-7 4v15q6 2 3 6-2 2-5-1',ink,1.7),
    path('M43 43h11v8H43z',gray,ink,1.8));
  engineering('wind-turbine','Wind turbine','renewable energy power rotor blades sustainable mechanical','🌬️',
    path('m29 29-2 27h10l-2-27z',blue),line('M14 56h36',teal,2.8),
    path('M31 25q-6-13-2-20 5 2 7 20m0 3q14-2 21 3-5 4-22 3m-4-2q-5 14-13 18-1-6 9-21',white),
    ellipse(32,29,5,5,navy),dot(32,29,2,cream));
  engineering('solar-panel','Solar panel','photovoltaic renewable electricity energy power','☀️',
    path('m14 27-7 20h48l-7-20z',navy),line('M21 28l-3 18m13-18v18m10-18 3 18M12 34h39M9 40h44',blue,1.4),
    line('M25 47v9m12-9v9m-18 0h24',ink,2.5),ellipse(32,16,6,6,gold,orange,1.8),
    line('M32 5v3m-9 1 3 3m15-3-3 3m-18 4h4m16 0h4',orange,1.8));
  engineering('caliper','Vernier caliper','precision measuring metrology mechanical tool calipers','📏',
    path('M11 10h8v24h37v8H19v11h-8z',gray),
    path('M27 18h7v13h11v14H31v8h-7V31h3z',blue),
    line('M38 34v4m5-4v3m5-3v4m5-4v3M15 16v11',navy,1.7),dot(35,39,2,gold));
  engineering('robot-arm','Robotic arm','robotics automation gripper actuator industrial manufacturing','🦾',
    path('M12 49h29l6 8H6z',navy),path('M18 46 12 27l9-5 12 18 13-13 6 7-14 15z',orange),
    path('M15 25 29 12l7 7-15 13z',gold),ellipse(17,28,5,5,navy),ellipse(35,44,5,5,navy),
    line('m34 15 7-3 5 6m-10 2 6 6 6-4',ink,2.5),dot(18,28,1.8,white),dot(35,44,1.8,white));
  engineering('satellite','Satellite','aerospace spacecraft communications antenna orbit','🛰️',
    path('m23 21 21 13-8 13-21-13z',gray),path('m9 12 13 8-7 12-13-8zm38 21 13 8-7 12-13-8z',navy),
    line('m8 15 10 6M5 20l10 6m34 12 8 5m-11 0 8 5',blue,1.7),
    path('M34 23q-7-5-7-15 12-1 18 12l-8 7z',cream),
    line('m36 18 9-10m0 0 3 2',ink,1.7),dot(49,12,2.7,gold));

  science('beaker','Laboratory beaker','chemistry glassware graduation measuring liquid','🧪',
    path('M10 12h43l-5 6v33q0 5-5 5H19q-5 0-5-5V18z',white),
    spot('M16 34q6-5 15-2t15 0v18q0 4-4 4H20q-4 0-4-4z',blue),
    line('M39 22h7m-5 6h5m-7 6h7m-5 6h5m-7 6h7',navy,1.8),
    dot(24,39,2.4,white),dot(31,46,2.8,white));
  science('molecule','Molecule model','chemistry bonds molecular structure atoms organic','⚛️',
    line('M17 19l15 13 16-16M32 32l15 16m-15-16L15 47',ink,5),
    line('M17 19l15 13 16-16M32 32l15 16m-15-16L15 47',gray,2.4),
    ellipse(17,19,8,8,pink),ellipse(48,16,7,7,blue),ellipse(15,47,6,6,mint),
    ellipse(47,48,9,9,purple),ellipse(32,32,10,10,gold),dot(29,29,2,white));
  science('bacterium','Bacterium','microbiology bacteria microbe prokaryote flagellum','🦠',
    line('M44 26q13-3 14 6t-7 13q-5 5 2 10M18 22l-6-5m13 1-2-8m11 8 4-7M16 30l-8 1m9 8-7 4m15 2-3 8m14-9 5 6',teal,2.5),
    path('M18 23q9-9 20-3 10 5 9 14-2 12-17 13-13 0-15-10-2-8 3-14z',mint),
    line('M21 32q5-10 10-4t9 4q-4 8-10 4t-9 1',navy,1.8),
    dot(24,40,1.7,teal),dot(36,24,1.8,teal),dot(39,38,1.6,teal));
  science('neuron','Neuron','biology nervous system nerve cell axon dendrites','🧠',
    line('M22 26 10 19 6 20m5 0 1-9m10 14L22 9l-5-4m5 7 7-5m-1 19 12-13 7 1m-9 2 1-8M21 34l-13 5m5-2 1 7m19-10q9 3 11 12t12 7m-7-3 5-6m-5 6 1 7',navy,2.6),
    path('M23 23q5-4 11 1 6 7 1 13-6 6-13 0-6-5 1-14z',purple),
    dot(28,30,4,pink),line('M38 36q4 3 5 7m2 4 4 4',gold,3.5));
  science('mitochondrion','Mitochondrion','biology animal cell organelle cellular respiration','🧫',
    path('M7 39C7 20 24 11 41 13c10 1 16 7 16 17 0 16-14 24-30 24C15 54 7 49 7 39z',orange),
    path('M12 38c1-13 14-21 27-20 8 1 13 5 13 12 0 11-12 19-25 19-10 0-15-4-15-11z',cream,brown,1.5),
    line('M16 36q5-9 8-5l-1 10q1 5 5 2l6-15q3-5 6 0l-3 11q0 3 4 2l5-7',brown,2.8),
    dot(30,24,1.6,pink),dot(45,26,1.7,pink));
  science('ammonite','Ammonite fossil','paleontology geology fossils spiral shell prehistoric','🐚',
    path('M11 33C11 17 23 8 37 10c14 2 21 13 19 26-2 13-14 21-27 19C18 53 11 45 11 33z',sand),
    path('M49 24c6 15-9 27-21 22-10-4-12-17-4-23 8-6 18 1 15 9-2 6-10 7-12 1-1-3 2-6 5-4','none',brown,2.4),
    line('M18 17l6 6m4-12 1 9m10-9-3 9m12-4-6 7m13 1-7 4m8 7-7 1m3 10-8-3m0 10-5-7m-4 9-2-8m-10 6 3-9m-12 3 8-8',cream,1.9));
  science('quartz','Quartz crystal','geology mineral crystal rock gem prism','💎',
    path('m6 49 3-21 9-7 8 12 1 22z',purple),
    path('M19 55 23 17 34 6l10 14 1 36z',blue),
    path('m41 54 1-23 11-10 6 13-3 17z',mint),
    line('m23 17 11 6 10-3M34 23v31M9 28l9 6 8-1m-8 1v18m24-21 9 5 8-2m-8 2-2 16',navy,1.8),
    line('m27 24-2 13m13-22 3 5m13 17-1 9',white,1.9));
  science('water-cycle','Water cycle','earth evaporation condensation precipitation hydrology weather','🌧️',
    path('M15 27q-6-7 1-11 5-3 9 1 3-9 12-7 7 1 8 8 10-1 10 6 0 5-8 5H21q-4 0-6-2z',white),
    line('M18 35l-3 5m14-5-3 5m13-5-3 5',blue,2.8),
    path('M7 49q8-4 15 0t15 0q9-5 20 0v7H7z',blue,navy,1.9),
    line('M49 43q7-6 6-13m-3 3 3-4 4 4M8 34q-2 6 2 10m1-4v5l-5-1',teal,2));
  science('ph-scale','pH indicator strips','chemistry acidity alkaline acid base litmus experiment','🧪',
    path('M9 12h38v39H9z',white),
    ...[pink,orange,gold,mint,teal,blue].map((color,i)=>spot(`M14 ${16+i*5}h16v4H14z`,color)),
    line('M33 18h8m-8 5h8m-8 5h8m-8 5h8m-8 5h8m-8 5h8',navy,1.1),
    path('m37 47 13-32 7 3-13 32z',cream),
    spot('m39 41 6 3-2 5-6-3z',teal),spot('m41 36 6 3-2 5-6-3z',blue));
  science('centrifuge','Centrifuge','laboratory biology spinning sample separation rotor','🧪',
    path('M12 29h40l6 17q2 9-7 9H13q-9 0-7-9z',purple),
    path('M12 28c0-9 8-16 20-16s20 7 20 16v5H12z',white),
    ellipse(32,28,18,8,blue),ellipse(32,28,10,5,navy,ink,1.5),
    dot(32,28,2.6,cream),dot(26,27,1.6,pink),dot(38,29,1.6,pink),
    path('M14 43h20v6H14z',navy,ink,1.5),dot(45,46,3.2,mint));
  science('lunar-phases','Moon phases','astronomy lunar new waxing full waning space','🌙',
    ellipse(13,32,8,8,navy),ellipse(32,32,9,9,gold),ellipse(51,32,8,8,navy),
    spot('M14 25q9 7 0 14 6-1 6-7t-6-7zm36 0q-9 7 0 14-6-1-6-7t6-7z',cream),
    line('M12 18q20-11 40 0M12 46q20 11 40 0',purple,1.9),
    dot(30,29,2,orange),dot(35,34,1.8,orange),dot(30,36,1.2,orange));
  science('seismograph','Seismograph','geology earthquake seismic waves tremor recording','🌋',
    path('M7 12h50v40H7z',white),
    line('M13 20h38m-38 8h38m-38 8h38m-38 8h38M19 16v32m8-32v32m8-32v32m8-32v32',gray,1.1),
    line('M12 33h7l4-4 4 9 5-19 5 27 5-16 4 3h6',teal,2.8),
    path('M7 47h50v5H7z',navy,ink,1.8));

  artSubject('charcoal','Charcoal sketch set','graphite drawing shading sketching willow eraser','✏️',
    path('m11 45 23-32 7 5-23 32-8 4z',navy),
    path('m22 45 25-34 6 4-25 35-7 3z',gray),
    line('m14 43 5 3m15-32 6 4m-15 26 5 4',white,1.7),
    path('m35 44 12-9 11 9-12 12z',cream),spot('m35 44 5 4 12-9-5-4z',pink));
  artSubject('pastels','Soft pastels','chalk pigment pastel drawing color sketching','🖍️',
    path('M7 19h50v35H7z',cream),
    path('M12 13h8v34h-8z',pink),path('M23 16h8v31h-8z',gold),
    path('M34 12h8v35h-8z',mint),path('M45 15h8v32h-8z',purple),
    line('M15 20v16m11-14v14m11-18v18m11-15v15',white,1.8),path('M7 43h50v11H7z',orange));
  artSubject('paint-tube','Paint tube','oil paint acrylic pigment squeeze tube studio','🎨',
    path('M18 11h28l-4 30-6 6h-8l-6-6z',white),path('M18 8h28v7H18z',gray),
    path('M27 47h10v9H27z',navy),spot('M20 23h24l-2 16H22z',teal),
    path('M33 24q-8 9-4 12 4 4 8-1 2-4-4-11z',cream,ink,1.3),line('M22 11h20m-12 40v3m4-3v3',ink,1.3));
  artSubject('palette-knife','Palette knife','impasto painting oil acrylic scraper mixing tool','🎨',
    path('m10 51 14-17 6 5-14 17q-4 4-7 0-2-2 1-5z',brown),
    line('m27 36 5-7 3 1 5-5',ink,3),
    path('m34 25 5-12 16-7-4 17-10 8z',gray),
    spot('m40 17 13-10-3 12-11 7z',pink),line('m37 26 10-8',white,1.7));
  artSubject('ceramic-wheel','Pottery wheel','clay ceramics pottery throwing sculpture studio','🏺',
    path('M12 44h40v11H12z',navy),ellipse(32,44,23,5,gray),
    path('M24 13h16l-2 9q10 7 6 15-3 6-12 6t-12-6q-4-8 6-15z',orange),
    ellipse(32,13,8,3,cream),line('M22 33q10 4 20 0m-19 5q9 4 18 0',brown,1.6),dot(45,50,2.4,mint));
  artSubject('sewing-hoop','Embroidery hoop','needle thread textile stitching fabric craft sewing','🧵',
    path('M28 7h8v7h-8z',gray),ellipse(32,34,23,23,sand),ellipse(32,34,18,18,cream,brown,1.6),
    line('M32 45V27m0 12-6-5m6 4 7-5',teal,2.2),
    path('M32 30q-8-4-5-8 3-3 5 1 3-4 6-1 2 5-6 8z',pink,brown,1.5),
    line('M46 18l-5 11m5-11q5-6 10-4 4 3-1 7',navy,1.7));
  artSubject('yarn','Ball of yarn','knitting crochet textile thread wool craft','🧶',
    path('M39 52q12 4 16-2 3-6-3-7-5-1-6 4', 'none',navy,2.4),
    ellipse(29,34,21,20,purple),
    line('M13 22q11 1 23 26M9 30q12 2 21 23m-18-12q7 3 11 11M19 17q12-1 24 7m-19-2q14-2 24 10m-20-4q13-1 20 10m-15-4q8-1 12 10',navy,1.8),
    line('m37 21 11-13m-5 15L57 9',brown,2.4),dot(48,8,2.5,gold),dot(57,9,2.5,gold));
  artSubject('sculpture','Sculpture bust','clay plaster sculpture statue classical portrait art','🏛️',
    path('M9 49h46v8H9z',navy),
    path('M15 49q1-9 12-12v-6c-6-4-6-12-3-17 2-5 9-7 14-4 6 3 8 9 7 15l4 5-5 2-1 5-7 1v3q9 1 13 8z',cream),
    spot('M25 15q7-11 16-3 3 4 4 8-6 2-11-3-2 5-10 6z',sand),
    line('m36 24 5-1m-1 11 3-1M28 40q3 4 9 3',brown,1.7));
  artSubject('film-clapper','Film clapperboard','cinema video film directing scene production','🎬',
    path('m8 16 44-10 2 8-44 10z',navy),
    line('m17 14 7 6m5-9 7 6m5-9 7 6',white,2.2),
    path('M9 25h46v29H9z',navy),path('M9 24h46v8H9z',gray),
    line('m18 25 6 6m6-6 6 6m6-6 6 6M16 42h32m-32 6h20',white,1.8),
    dot(13,28,1.6,gold));
  artSubject('drum','Hand drum','music rhythm percussion instrument performance','🥁',
    path('M13 24h38v18q0 10-19 10t-19-10z',orange),ellipse(32,24,19,8,cream),
    line('m15 32 8 15 9-15 9 15 8-15M14 43q16 10 36 0',brown,2),
    line('M16 9l19 15m15-17L30 22',ink,2.8),dot(35,24,3,blue),dot(30,22,3,purple));
  artSubject('print-roller','Printmaking roller','brayer linocut ink relief printmaking art press','🎨',
    path('M6 14h37v17H6z',purple),
    path('M8 15h6v15H8zm27 0h6v15h-6z',navy),
    line('M44 22h8v14H33v7',ink,3.1),
    path('M29 41h8v14h-8z',orange),line('M17 19h15',white,1.7),
    path('M6 42h15v11H6z',mint,navy,1.7),line('m9 50 4-5 5 5',teal,1.8));
  artSubject('washi-tape','Washi tape','scrapbook journaling decorative paper craft stationery','🎀',
    path('M10 28v12c0 8 10 14 23 14s23-6 23-14V28',pink),ellipse(33,28,23,14,cream),
    ellipse(33,28,12,7,white,brown,1.8),
    line('m15 36 8 13m3-9 6 12m6-11 3 10m6-13 2 10',white,2.7),
    path('M15 47 8 50l-2-4-2 8 4 5 23-5',purple),dot(15,52,1.4,cream),dot(22,53,1.4,cream));

  engineering('bearing','Ball bearing','mechanical rotation bearing balls ring shaft','⚙️',
    ellipse(32,32,25,25,gray),ellipse(32,32,19,19,navy,ink,1.6),
    ...[[32,15],[44,20],[49,32],[44,44],[32,49],[20,44],[15,32],[20,20]].map(([x,y])=>ellipse(x,y,3.4,3.4,cream,ink,1.2)),
    ellipse(32,32,11,11,gray),ellipse(32,32,7,7,white,ink,1.6));
  engineering('piston','Piston and connecting rod','mechanical engine crank automotive cylinder','🔧',
    path('M27 23h10l-2 19q8 8 1 13-6 5-11-1-4-6 4-12z',gray),
    ellipse(32,49,4,4,white),path('M17 10h30v17q0 5-5 5H22q-5 0-5-5z',blue),
    line('M18 15h28m-28 5h28',navy,2),ellipse(32,26,4,3,cream,ink,1.6));
  engineering('pulley','Pulley system','mechanical rope hoist load machine lift physics','🛠️',
    path('M19 8h26v6H19z',navy),line('M32 14v7',ink,3),
    ellipse(32,29,12,12,gray),ellipse(32,29,7,7,blue),
    line('M20 50V30a12 12 0 0 1 24 0v15',brown,2.5),
    path('M12 47h16v10H12z',gold),line('m43 46 3 5 4-4',ink,2.2));
  engineering('sprocket-chain','Sprocket and chain','mechanical chain drive bicycle transmission mechanism','🚲',
    path('M20 14c9 0 30 9 33 16 5 12-6 19-14 18L18 43C6 41 4 31 8 23q4-8 12-9z','none',ink,5),
    path('M20 14c9 0 30 9 33 16 5 12-6 19-14 18L18 43C6 41 4 31 8 23q4-8 12-9z','none',gray,2.1),
    ellipse(20,28,10,10,blue),ellipse(42,36,8,8,gold),
    ellipse(20,28,4,4,cream,ink,1.5),ellipse(42,36,3,3,cream,ink,1.5));
  engineering('multimeter','Digital multimeter','electrical measurement voltage resistance current electronics','🔌',
    path('M16 8h31v38q0 5-5 5H21q-5 0-5-5z',gold),
    path('M20 13h23v12H20z',mint,ink,1.6),line('M24 17h5v5h-5zm10 0h5v5h-5z',navy,1.3),
    ellipse(32,35,6.5,6.5,navy),line('m32 35 3-3',white,1.6),
    line('M24 49v4q-1 6-8 3l-6-4V39',pink,2.5),line('M39 49v4q1 6 8 3l6-4V37',navy,2.5));
  engineering('capacitor','Electrolytic capacitor','electrical component electronics capacitance circuit','🔋',
    line('M23 43v14m18-14v11',ink,3),
    path('M15 14h34v29q0 8-17 8t-17-8z',navy),ellipse(32,14,17,7,gray),
    spot('M39 20q5-1 8-3v25q-1 5-8 6z',blue),
    line('M26 14h12m-6-3v6m9 10h4m-4 7h4m-4 7h4',white,1.7));
  engineering('soldering-iron','Soldering iron','electronics workshop solder circuit tool repair','🛠️',
    path('m12 52 4-8 17-17 4 4-18 17z',gray),
    path('m29 28 17-18q4-4 8 0t0 8L37 36z',teal),
    path('m31 26 9 9-4 5-9-9z',navy),line('m54 13 4-4',ink,3),
    line('M17 37q-4-4-1-7t-1-7m-6 13q-4-4-1-7',orange,1.8));
  engineering('3d-printer','3D printer','additive manufacturing fabrication filament prototype printer','🖨️',
    path('M8 9h48v46H8z',navy),path('M13 14h38v32H13z',white),
    line('M14 23h36m-36 20h36',gray,2.7),path('M27 17h10v10l-5 4-5-4z',orange),
    path('m22 40 10-8 10 8v5H22z',mint,navy,1.7),
    line('m23 40 9 2 9-2',teal,1.5),dot(47,51,1.8,mint));
  engineering('hard-hat','Safety helmet','civil construction worksite hard hat protective equipment','⛑️',
    path('M11 39c0-13 7-22 19-24h6c11 2 17 11 17 24z',gold),
    path('M26 17q0-5 6-5t6 5l-2 23h-8z',orange),
    path('M6 38h52v8q0 6-26 6T6 46z',gold),
    line('M14 34q2-9 9-12m-9 24q18 4 36 0',brown,1.8));
  engineering('water-wheel','Water wheel','hydropower mechanical mill paddle turbine energy','💧',
    ellipse(32,28,19,19,sand),
    line('M32 5v46M9 28h46M16 12l32 32m0-32L16 44',brown,3),
    ellipse(32,28,13,13,cream,brown,1.8),line('M32 15v26M19 28h26m-22-9 18 18m0-18L23 37',brown,2),
    ellipse(32,28,4,4,navy),line('M7 54q6-5 12 0t12 0 12 0 13 0',teal,3));
  engineering('dam','Hydroelectric dam','civil engineering reservoir hydropower water electricity','💧',
    path('M8 34q8-5 19 0 8 3 21-2l9 20H7z',blue),
    path('m17 15 27 1 4 15 7 16H31l-9-15z',gray),
    line('m18 17 26 1m-21 8 23 1m-19 8 23 1',navy,1.8),
    path('m15 33 7-1 5 13h-7zm-7 5 6-2 4 12H9z',white,navy,1.4),
    line('M8 53q7-4 14 0t14 0 15 0',teal,2.3));
  engineering('airfoil','Airfoil and airflow','aerodynamics aerospace wing lift fluid dynamics','✈️',
    path('M12 33c10-15 30-15 45-4-12 1-31 13-45 4z',blue),
    line('M8 17h12q20-7 35 4m-6-5 6 5-7 1M8 46h15q18 1 33-8m-7 1 7-1-3 6',teal,2.2),
    line('M31 51v7m-4-4 4-3 4 3M17 32q11-8 24-6',navy,1.7));

  const catalog=Object.freeze([...art.values()].map(({id,name,keywords,emoji,subject})=>Object.freeze({id,name,keywords,emoji,subject})));
  const paths=new Map();
  function markup(id){
    const sticker=art.get(id);
    if(!sticker)return '';
    const layers=sticker.layers.map(({d,fill,stroke,width})=>
      `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><g stroke-linecap="round" stroke-linejoin="round">${layers}</g></svg>`;
  }
  function compiled(id){
    const sticker=art.get(id);
    if(!sticker||typeof Path2D!=='function')return null;
    if(!paths.has(id))paths.set(id,sticker.layers.map(layer=>({...layer,shape:new Path2D(layer.d)})));
    return paths.get(id);
  }
  function regionAt(ctx,id,x,y){
    if(x<0||y<0||x>64||y>64)return null;
    const layers=compiled(id);
    if(!layers)return null;
    for(let index=layers.length-1;index>=0;index--){
      const {shape,fill}=layers[index];
      if(fill!=='none'&&ctx.isPointInPath(shape,x,y))return {index,fill};
    }
    return null;
  }
  function draw(ctx,id,x,y,size,colors){
    const layers=compiled(id);
    if(!layers)return false;
    ctx.save();ctx.translate(x,y);ctx.scale(size/64,size/64);ctx.lineCap='round';ctx.lineJoin='round';
    for(let index=0;index<layers.length;index++){
      const {shape,fill,stroke,width}=layers[index];
      const replacement=colors?.[index];
      if(fill!=='none'){ctx.fillStyle=/^#[a-f0-9]{6}$/i.test(replacement||'')?replacement:fill;ctx.fill(shape);}
      if(stroke!=='none'){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke(shape);}
    }
    ctx.restore();
    return true;
  }
  return Object.freeze({catalog,has:id=>art.has(id),markup,draw,regionAt});
});
