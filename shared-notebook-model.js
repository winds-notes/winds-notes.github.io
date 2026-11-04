/* Immutable shared edits: concurrent strokes have different IDs and survive replay. */
(function(global){
  'use strict';
  const validId=value=>typeof value==='string'&&value.length>0&&value.length<=200;
  const clone=value=>JSON.parse(JSON.stringify(value));
  function sameValue(a,b){
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&sameValue(a[key],b[key]));
  }
  function entries(book){
    const result=new Map(),put=(key,value)=>result.set(JSON.stringify(key),value);
    for(const key of ['title','cover','createdAt'])put(['book',key],book[key]);
    put(['order'],book.pages.map(page=>page.id));
    for(const page of book.pages){
      put(['page',page.id],{template:page.template,orientation:page.orientation||'portrait'});
      for(const item of page.items)put(['item',page.id,item.id],item);
    }
    return result;
  }
  function digest(value){
    const text=JSON.stringify(value);let a=2166136261,b=5381;
    for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}
    return `${text.length}:${a>>>0}:${b>>>0}`;
  }
  function fingerprint(book){return Object.fromEntries([...entries(book)].map(([key,value])=>[key,digest(value)]));}
  function diff(book,baseline){
    const current=entries(book),changes=[];
    for(const [key,value] of current)if(baseline[key]!==digest(value))changes.push({key:JSON.parse(key),value});
    for(const key of Object.keys(baseline))if(!current.has(key))changes.push({key:JSON.parse(key),value:null});
    return changes;
  }
  function validateBatch(batch){
    if(batch?.format!=='winds-shared-edit'||batch.version!==1||!validId(batch.id)||typeof batch.at!=='string'||!Number.isFinite(Date.parse(batch.at))||!Array.isArray(batch.changes)||batch.changes.length>151000)throw Error('Invalid shared notebook edit');
    for(const change of batch.changes){
      const k=change.key;
      if(!Array.isArray(k)||!((k[0]==='book'&&k.length===2&&['title','cover','createdAt'].includes(k[1]))||(k[0]==='order'&&k.length===1)||(k[0]==='page'&&k.length===2&&validId(k[1]))||(k[0]==='item'&&k.length===3&&validId(k[1])&&validId(k[2]))))throw Error('Invalid shared edit location');
      if(change.value===undefined)throw Error('Invalid shared edit value');
    }
    return batch;
  }
  function replay(seed,batches){
    const values=entries(seed),seen=new Set();let updatedAt=seed.updatedAt;
    const ordered=[...batches].sort((a,b)=>a.at<b.at?-1:a.at>b.at?1:a.id<b.id?-1:a.id>b.id?1:0);
    for(const batch of ordered){
      validateBatch(batch);if(seen.has(batch.id))continue;seen.add(batch.id);
      if(batch.at>updatedAt)updatedAt=batch.at;
      for(const change of batch.changes){const key=JSON.stringify(change.key);if(change.value===null)values.delete(key);else values.set(key,change.value);}
    }
    const pageMeta=new Map(),items=new Map();
    for(const [key,value] of values){const k=JSON.parse(key);if(k[0]==='page')pageMeta.set(k[1],value);if(k[0]==='item'){if(!items.has(k[1]))items.set(k[1],[]);if(value.id!==k[2])throw Error('Invalid shared object ID');items.get(k[1]).push(value);}}
    const order=values.get('["order"]');if(!Array.isArray(order))throw Error('Invalid shared page order');
    const ids=[...new Set([...order,...pageMeta.keys()])].filter(id=>pageMeta.has(id));
    // Deleting the final page must leave a usable notebook.
    if(!ids.length)throw Error('A shared notebook must retain at least one page');
    return global.WindsFile.validateShared({id:seed.id,title:values.get('["book","title"]'),cover:values.get('["book","cover"]'),createdAt:values.get('["book","createdAt"]'),updatedAt,
      pages:ids.map(id=>({id,...pageMeta.get(id),items:items.get(id)||[]}))});
  }
  global.WindsSharedModel=Object.freeze({fingerprint,diff,replay,validateBatch,clone,sameValue});
})(typeof window!=='undefined'?window:globalThis);
