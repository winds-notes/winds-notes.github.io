/* WiNDS Notes native file (.winds-notes) — versioned, editable, local-only.
 * JSON by design: portable, inspectable, and usable without a server.
 * A file contains one notebook; legacy .json backups contain many.
 */
(function(global){
  'use strict';
  const FORMAT = 'winds-notes', VERSION = 1;
  const creative=global.WindsCreative||(typeof module!=='undefined'&&module.exports?require('./creative-tools.js'):null);
  const MAX_FILE_BYTES = 100 * 1024 * 1024;
  const COVERS = new Set(['purple','blue','peach','green','lilac','yellow']);
  const PAPERS = new Set(['ruled','grid','dots','blank']);
  const ARTIST_GRADES = new Set([
    '4H','3H','2H','H','F','HB','B','2B','3B','4B','6B','8B',
    'Charcoal','Vine Charcoal','Compressed Charcoal','Color Pencil','Soft Pastel','Oil Pastel','Chalk',
    'Fineliner','Technical Pen','Fountain Pen','Brush Marker','Dry Brush','Ink Brush',
    'Ballpoint Pen','Gel Pen','Dip Pen','Calligraphy Nib',
    'Watercolor Wash','Watercolor Edge','Gouache','Round Acrylic','Flat Acrylic','Filbert','Fan Brush','Oil Paint','Palette Knife','Sponge',
    'Airbrush','Ink Splatter','Stipple','Grain Brush','Glitter','Hatching'
  ]);
  const SHAPES = new Set([
    'rectangle','square','ellipse','circle','line','arrow','triangle','diamond','star',
    'roundedRectangle','semicircle','rightTriangle','trapezoid','parallelogram','pentagon','hexagon','octagon',
    'heart','cross','speechBubble','chevron','shield'
  ]);
  const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const num = (x, fallback=0) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x)<1e7 ? x : fallback;
  const str = (x, max, fallback='') => typeof x === 'string' ? x.slice(0,max) : fallback;
  const color = x => /^#[0-9a-fA-F]{3,8}$/.test(x||'') ? x : '#2b2d4c';
  const id = x => typeof x === 'string' && x.length<=200 ? x : '';
  const makeId = () => global.crypto?.randomUUID?.() || `winds-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const time = x => typeof x === 'string' && !Number.isNaN(Date.parse(x)) ? x : new Date().toISOString();
  function check(test, message){if(!test)throw new Error(message);}
  function rotationFields(item){
    if(item.rotation==null)return {};
    check(typeof item.rotation==='number' && Number.isFinite(item.rotation) && Math.abs(item.rotation)<1e7,'Invalid object rotation');
    const rotation=((item.rotation%360)+360)%360;
    return rotation?{rotation}:{};
  }
  function erasureFields(item){
    if(item.erasures==null)return {};
    check(Array.isArray(item.erasures)&&item.erasures.length<=2048,'Too many erased areas');let count=0;
    const erasures=item.erasures.map(mask=>{
      check(isObject(mask)&&Number.isFinite(mask.rx)&&mask.rx>0&&mask.rx<1e7&&Number.isFinite(mask.ry)&&mask.ry>0&&mask.ry<1e7,'Invalid eraser radius');
      check(Array.isArray(mask.points)&&mask.points.length>=1&&mask.points.length<=2048,'Invalid erased area');count+=mask.points.length;check(count<=200000,'Too many eraser points');
      return {rx:mask.rx,ry:mask.ry,points:mask.points.map(p=>{check(Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<1e7),'Invalid eraser point');return [p[0],p[1]];})};
    });return erasures.length?{erasures}:{};
  }
  function normalizeItem(item){
    check(isObject(item) && ['stroke','shape','text','image','sticker','graph','vector'].includes(item.type),'Unsupported or damaged page object');
    const base={id:makeId(),type:item.type,...erasureFields(item)};
    if(item.type==='stroke'){
      check(['pen','highlighter','artist'].includes(item.tool),'Invalid pen type');
      check(Array.isArray(item.points) && item.points.length>=1 && item.points.length<=200000,'Invalid pen points');
      return {...base,tool:item.tool,...(item.tool==='artist' && item.flow!=null?{flow:Math.max(.1,Math.min(1,num(item.flow,1)))}:{}),grade:ARTIST_GRADES.has(item.grade)?item.grade:'HB',color:color(item.color),size:Math.max(.5,Math.min(64,num(item.size,3))),points:item.points.map(p=>{
        check(Array.isArray(p) && p.length>=2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),'Damaged pen stroke');
        return [num(p[0]),num(p[1]),Math.max(0,Math.min(1,num(p[2],.68)))];
      })};
    }
    if(item.type==='text'){
      check(typeof item.text==='string' && item.text.length<=1000000,'Invalid text object');
      return {...base,x:num(item.x),y:num(item.y),w:Math.max(1,num(item.w,480)),size:Math.max(1,Math.min(300,num(item.size,20))),color:color(item.color),text:item.text,
        ...(item.fontFamily!=null?{fontFamily:['Arial','Georgia','Times New Roman','Verdana','Trebuchet MS','Courier New','Palatino','Chalkboard SE','system-ui'].includes(item.fontFamily)?item.fontFamily:'Arial'}:{}),
        ...Object.fromEntries(['bold','italic','underline'].filter(key=>item[key]!=null).map(key=>[key,item[key]===true])),
        ...(item.align!=null?{align:['left','center','right'].includes(item.align)?item.align:'left'}:{}),
        ...(item.lineHeight!=null?{lineHeight:Math.max(.8,Math.min(3,num(item.lineHeight,1.42)))}:{})};
    }
    if(item.type==='sticker'){
      check(typeof item.emoji==='string' && item.emoji.length>0 && item.emoji.length<=24,'Invalid sticker');
      if(item.artwork!=null)check(typeof item.artwork==='string'&&/^[a-z0-9-]{1,48}$/.test(item.artwork),'Invalid sticker artwork');
      return {...base,emoji:item.emoji,...(item.artwork?{artwork:item.artwork}:{}),
        x:num(item.x),y:num(item.y),size:Math.max(16,Math.min(1600,num(item.size,78))),...rotationFields(item)};
    }
    if(item.type==='shape'){
      check(creative?.isShapeKind(item.kind)||SHAPES.has(item.kind),'Invalid shape type');
      const fillable=creative?.isFillableShape(item.kind)??!['line','arrow'].includes(item.kind);
      const strokeStyle=creative?.shapeStrokeStyle(item.kind,item.strokeStyle)??
        (['solid','dashed','dotted','none'].includes(item.strokeStyle)?item.strokeStyle:'solid');
      return {...base,kind:item.kind,x:num(item.x),y:num(item.y),w:num(item.w),h:num(item.h),color:color(item.color),size:Math.max(.5,Math.min(64,num(item.size,3))),fillColor:fillable && /^#[0-9a-fA-F]{6}$/.test(item.fillColor||'')?item.fillColor:null,fillOpacity:Math.max(0,Math.min(1,num(item.fillOpacity,1))),strokeStyle,...rotationFields(item)};
    }
    if(item.type==='graph'){
      const graphs=global.WindsGraph||(typeof module!=='undefined'&&module.exports?require('./graph-tools.js'):null);
      check(graphs,'Reload WiNDS Notes to open an editable graph.');
      return {...base,x:num(item.x),y:num(item.y),w:Math.max(16,Math.min(2200,num(item.w,540))),
        h:Math.max(16,Math.min(2200,num(item.h,320))),color:color(item.color),
        ...(Number.isFinite(item.size)?{size:Math.max(.5,Math.min(32,item.size))}:{}),graph:graphs.validate(item.graph)};
    }
    if(item.type==='vector'){
      const vectors=global.WindsVector||(typeof module!=='undefined'&&module.exports?require('./vector-tools.js'):null);
      check(vectors,'Reload WiNDS Notes to open an editable vector path.');
      return {...base,x:num(item.x),y:num(item.y),w:Math.max(16,Math.min(2200,num(item.w,16))),
        h:Math.max(16,Math.min(2200,num(item.h,16))),...vectors.validate(item),...rotationFields(item)};
    }
    check(typeof item.src==='string' && item.src.length<=50*1024*1024 && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(item.src),'Invalid embedded image');
    const image={...base,...(item.boundaryFill===true?{boundaryFill:true}:{}),x:num(item.x),y:num(item.y),w:Math.max(1,num(item.w,200)),h:Math.max(1,num(item.h,200)),src:item.src,...rotationFields(item)};
    if(item.crop!=null){
      const c=item.crop;
      check(isObject(c) && ['x','y','w','h'].every(k=>Number.isFinite(c[k])) &&
        c.x>=0 && c.y>=0 && c.w>=.01 && c.h>=.01 && c.x+c.w<=1+1e-9 && c.y+c.h<=1+1e-9,'Invalid image crop');
      image.crop={x:c.x,y:c.y,w:c.w,h:c.h};
    }
    return image;
  }
  const backgroundCache=new WeakMap(),backgroundFields=['type','src','thumbnail','width','height','sourceName','sourcePage'];
  function pageBackground(value){
    if(value==null)return {};
    check(isObject(value)&&value.type==='pdf','Invalid page background');
    const cached=backgroundCache.get(value);
    if(cached&&backgroundFields.every(key=>cached.input[key]===value[key]))return {background:cached.clean};
    const image=x=>typeof x==='string'&&x.length<=12*1024*1024&&/^data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(x);
    check(image(value.src)&&image(value.thumbnail)&&value.thumbnail.length<=256*1024,'Invalid PDF page image');
    check(Number.isInteger(value.width)&&Number.isInteger(value.height)&&value.width>=1&&value.height>=1&&value.width<=2376&&value.height<=2376&&value.width*value.height<=2376*1680,'Invalid PDF page dimensions');
    check(Number.isInteger(value.sourcePage)&&value.sourcePage>=1&&value.sourcePage<=100000,'Invalid PDF page number');
    const clean=Object.freeze({type:'pdf',src:value.src,thumbnail:value.thumbnail,width:value.width,height:value.height,sourceName:str(value.sourceName,200,'Imported PDF'),sourcePage:value.sourcePage});
    backgroundCache.set(value,{input:Object.fromEntries(backgroundFields.map(key=>[key,value[key]])),clean});
    backgroundCache.set(clean,{input:clean,clean});return {background:clean};
  }
  function normalizeNotebook(n){
    check(isObject(n) && typeof n.title==='string' && Array.isArray(n.pages),'Invalid notebook');
    check(n.pages.length>=1 && n.pages.length<=750,'Invalid page count');
    let totalItems=0;
    const pages=n.pages.map(p=>{
      check(isObject(p) && Array.isArray(p.items) && p.items.length<=50000,'Invalid notebook page');
      totalItems+=p.items.length;check(totalItems<=150000,'Notebook contains too many objects');
      return {id:makeId(),template:PAPERS.has(p.template)?p.template:'ruled',orientation:p.orientation==='landscape'?'landscape':'portrait',...pageBackground(p.background),items:p.items.map(normalizeItem)};
    });
    return {id:makeId(),title:str(n.title,70).trim()||'Imported notebook',cover:COVERS.has(n.cover)?n.cover:'purple',createdAt:time(n.createdAt),updatedAt:new Date().toISOString(),pages};
  }
  function serialize(notebook){
    check(isObject(notebook) && typeof notebook.title==='string' && Array.isArray(notebook.pages),'Cannot save invalid notebook');
    const {_sharing,_sync,...content}=notebook;
    return JSON.stringify({format:FORMAT,version:VERSION,application:'WiNDS Notes',exportedAt:new Date().toISOString(),pageSize:{portrait:{width:840,height:1188},landscape:{width:1188,height:840}},notebook:content});
  }
  function validateShared(notebook){
    const clean=normalizeNotebook(notebook),ids=new Set();
    function retain(value){check(typeof value==='string'&&value.length>0&&value.length<=200&&!/[\u0000-\u001f]/.test(value)&&!ids.has(value),'Invalid or duplicate shared object ID');ids.add(value);return value;}
    clean.id=retain(notebook.id);clean.updatedAt=time(notebook.updatedAt);
    clean.pages.forEach((p,i)=>{p.id=retain(notebook.pages[i].id);p.items.forEach((item,j)=>{item.id=retain(notebook.pages[i].items[j].id);});});
    return clean;
  }
  function parse(text){
    check(typeof text==='string' && text.length>0 && text.length<=MAX_FILE_BYTES,'File is empty or too large');
    let data;try{data=JSON.parse(text);}catch{throw new Error('File is not valid WiNDS Notes data');}
    check(isObject(data),'Unrecognized file');
    if(data.format===FORMAT){
      check(data.version===VERSION,'Unsupported WiNDS Notes file version');
      return {notebooks:[normalizeNotebook(data.notebook)],single:true};
    }
    if(data.format==='winds-notes-backup' || data.format==='folio-notes-backup'){
      check(Array.isArray(data.notebooks) && data.notebooks.length>=1 && data.notebooks.length<=500,'Invalid backup file');
      return {notebooks:data.notebooks.map(normalizeNotebook),single:false};
    }
    throw new Error('Choose a .winds-notes notebook or a compatible JSON backup');
  }
  global.WindsFile=Object.freeze({FORMAT,VERSION,MAX_FILE_BYTES,serialize,parse,validateShared});
})(typeof window!=='undefined'?window:globalThis);
