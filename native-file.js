/* WiNDS Notes native file (.winds-notes) — versioned, editable, local-only.
 * JSON by design: portable, inspectable, and usable without a server.
 * A file contains one notebook; legacy .json backups contain many.
 */
(function(global){
  'use strict';
  const FORMAT = 'winds-notes', VERSION = 1;
  const MAX_FILE_BYTES = 100 * 1024 * 1024;
  const COVERS = new Set(['purple','blue','peach','green','lilac','yellow']);
  const PAPERS = new Set(['ruled','grid','dots','blank']);
  const SHAPES = new Set(['rectangle','ellipse','line']);
  const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const num = (x, fallback=0) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x)<1e7 ? x : fallback;
  const str = (x, max, fallback='') => typeof x === 'string' ? x.slice(0,max) : fallback;
  const color = x => /^#[0-9a-fA-F]{3,8}$/.test(x||'') ? x : '#2b2d4c';
  const id = x => typeof x === 'string' && x.length<=200 ? x : '';
  const makeId = () => global.crypto?.randomUUID?.() || `winds-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const time = x => typeof x === 'string' && !Number.isNaN(Date.parse(x)) ? x : new Date().toISOString();
  function check(test, message){if(!test)throw new Error(message);}
  function normalizeItem(item){
    check(isObject(item) && ['stroke','shape','text','image'].includes(item.type),'Unsupported or damaged page object');
    const base={id:makeId(),type:item.type};
    if(item.type==='stroke'){
      check(['pen','highlighter'].includes(item.tool),'Invalid pen type');
      check(Array.isArray(item.points) && item.points.length>=1 && item.points.length<=200000,'Invalid pen points');
      return {...base,tool:item.tool,color:color(item.color),size:Math.max(.5,Math.min(64,num(item.size,3))),points:item.points.map(p=>{
        check(Array.isArray(p) && p.length>=2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),'Damaged pen stroke');
        return [num(p[0]),num(p[1]),Math.max(0,Math.min(1,num(p[2],.68)))];
      })};
    }
    if(item.type==='text'){
      check(typeof item.text==='string' && item.text.length<=1000000,'Invalid text object');
      return {...base,x:num(item.x),y:num(item.y),w:Math.max(1,num(item.w,480)),size:Math.max(1,Math.min(300,num(item.size,20))),color:color(item.color),text:item.text};
    }
    if(item.type==='shape'){
      check(SHAPES.has(item.kind),'Invalid shape type');
      return {...base,kind:item.kind,x:num(item.x),y:num(item.y),w:num(item.w),h:num(item.h),color:color(item.color),size:Math.max(.5,Math.min(64,num(item.size,3)))};
    }
    check(typeof item.src==='string' && item.src.length<=50*1024*1024 && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(item.src),'Invalid embedded image');
    return {...base,x:num(item.x),y:num(item.y),w:Math.max(1,num(item.w,200)),h:Math.max(1,num(item.h,200)),src:item.src};
  }
  function normalizeNotebook(n){
    check(isObject(n) && typeof n.title==='string' && Array.isArray(n.pages),'Invalid notebook');
    check(n.pages.length>=1 && n.pages.length<=750,'Invalid page count');
    let totalItems=0;
    const pages=n.pages.map(p=>{
      check(isObject(p) && Array.isArray(p.items) && p.items.length<=50000,'Invalid notebook page');
      totalItems+=p.items.length;check(totalItems<=150000,'Notebook contains too many objects');
      return {id:makeId(),template:PAPERS.has(p.template)?p.template:'ruled',items:p.items.map(normalizeItem)};
    });
    return {id:makeId(),title:str(n.title,70).trim()||'Imported notebook',cover:COVERS.has(n.cover)?n.cover:'purple',createdAt:time(n.createdAt),updatedAt:new Date().toISOString(),pages};
  }
  function serialize(notebook){
    check(isObject(notebook) && typeof notebook.title==='string' && Array.isArray(notebook.pages),'Cannot save invalid notebook');
    return JSON.stringify({format:FORMAT,version:VERSION,application:'WiNDS Notes',exportedAt:new Date().toISOString(),pageSize:{width:840,height:1188},notebook});
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
  global.WindsFile=Object.freeze({FORMAT,VERSION,MAX_FILE_BYTES,serialize,parse});
})(typeof window!=='undefined'?window:globalThis);
