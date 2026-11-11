/* Causal, object-level private workspace reconciliation. Called only while idle. */
(function(global){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const object=o=>o&&typeof o==='object'&&!Array.isArray(o);
  function equal(a,b){
    if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>own(b,k)&&equal(a[k],b[k]));
  }
  function hash(value){
    const text=JSON.stringify(value);let a=2166136261,b=5381;
    for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}
    return `${text.length.toString(36)}-${(a>>>0).toString(36)}-${(b>>>0).toString(36)}`;
  }
  function entries(book,pageIds){
    const values=new Map(),put=(key,value)=>values.set(JSON.stringify(key),value);
    for(const key of ['title','cover','createdAt'])put(['book',key],book[key]??null);
    put(['order'],book.pages.map(p=>p.id));
    for(const page of book.pages){
      if(pageIds&&!pageIds.has(page.id))continue;
      put(['page',page.id],{template:page.template||'ruled',orientation:page.orientation||'portrait',...(page.background?{background:page.background}:{})});
      put(['layers',page.id],page.items.map(i=>i.id));
      for(const item of page.items)put(['item',page.id,item.id],item);
    }
    return values;
  }
  function validStamp(s){return Array.isArray(s)&&s.length===2&&Number.isSafeInteger(s[0])&&s[0]>0&&typeof s[1]==='string'&&s[1].length>0&&s[1].length<=200;}
  function valid(meta){
    return meta?.version===1&&Number.isSafeInteger(meta.clock)&&meta.clock>0&&meta.clock<Number.MAX_SAFE_INTEGER&&object(meta.seen)&&object(meta.fields)&&
      Object.keys(meta.fields).length<=151000&&Object.keys(meta.seen).length<=10000&&
      Object.entries(meta.seen).every(([actor,time])=>actor.length<=200&&Number.isSafeInteger(time)&&time>0&&time<=meta.clock)&&
      Object.values(meta.fields).every(f=>object(f)&&validStamp(f.stamp)&&f.stamp[0]<=meta.clock&&own(meta.seen,f.stamp[1])&&meta.seen[f.stamp[1]]>=f.stamp[0]&&(f.hash===null||typeof f.hash==='string')&&(f.at===undefined||Number.isSafeInteger(f.at)));
  }
  function union(a,b){const result=Object.assign(Object.create(null),a);for(const [key,value] of Object.entries(b))result[key]=Math.max(result[key]||0,value);return result;}
  const observed=(seen,stamp)=>(own(seen,stamp[1])?seen[stamp[1]]:0)>=stamp[0];
  const compare=(a,b)=>a[0]-b[0]||(a[1]<b[1]?-1:a[1]>b[1]?1:0);
  function editTime(field){
    if(Number.isSafeInteger(field?.at))return field.at;
    const stamp=field?.stamp;
    return stamp?.[0]===1&&stamp[1].startsWith('legacy-')?Date.parse(stamp[1].slice(7,31)):NaN;
  }
  function compareEdits(a,b){
    const aTime=editTime(a),bTime=editTime(b);
    if(Number.isFinite(aTime)&&Number.isFinite(bTime)&&aTime!==bTime)return aTime-bTime;
    // Older clients did not record per-edit times. Keep their logical order.
    return compare(a.stamp,b.stamp);
  }
  function capture(book,actor,changedPages){
    if(book._sharing)return false;
    const previous=book._sync;
    if(previous&&!valid(previous))throw Error('Invalid notebook sync history. Export a backup before retrying.');
    // Structural changes and old-format notebooks require a full capture.
    // An ordinary page save can keep the fingerprints of untouched pages.
    const scoped=actor&&changedPages?.size&&previous?.fields['["order"]']?.hash===hash(book.pages.map(p=>p.id))?changedPages:null;
    const values=entries(book,scoped);
    if(!previous){
      // A deterministic migration identity makes repeated old-format reads stable.
      const at=Number.isFinite(Date.parse(book.updatedAt))?new Date(book.updatedAt).toISOString():'';
      const origin='legacy-'+at+'-'+hash([book.id,[...values]]),fields=Object.create(null);
      for(const [key,value] of values)fields[key]={hash:hash(value),stamp:[1,origin]};
      book._sync={version:1,clock:1,seen:{[origin]:1},fields};return true;
    }
    const changes=[];
    for(const [key,value] of values){
      const digest=hash(value);
      if(previous.fields[key]?.hash!==digest)changes.push([key,digest]);
    }
    const itemPrefixes=scoped?[...scoped].map(id=>`["item",${JSON.stringify(id)},`):[];
    for(const [key,field] of Object.entries(previous.fields)){
      if(field.hash===null||values.has(key))continue;
      // With stable page order, only objects on captured pages can disappear.
      if(!scoped||itemPrefixes.some(prefix=>key.startsWith(prefix)))changes.push([key,null]);
    }
    if(!changes.length)return false;
    actor=actor||'legacy-edit-'+hash([book.id,book.updatedAt,[...values]]);
    const clock=previous.clock+1,fields={...previous.fields};
    const editedAt=Date.parse(book.updatedAt);
    for(const [key,digest] of changes){
      const previousTime=editTime(previous.fields[key]);
      // An edit of this field can follow an observed edit from a faster clock.
      const at=Number.isFinite(previousTime)?Math.max(editedAt||0,previousTime+1):editedAt;
      fields[key]={hash:digest,stamp:[clock,actor],...(Number.isSafeInteger(at)?{at}:{})};
    }
    book._sync={version:1,clock,seen:{...previous.seen,[actor]:clock},fields};return true;
  }
  function merge(local,remote){
    local={...local};remote={...remote};
    capture(local);
    capture(remote);
    const a=local._sync,b=remote._sync,av=entries(local),bv=entries(remote);
    const fields=Object.create(null),values=new Map(),pageKeys=new Map();
    let orderSource=av;
    const keys=new Set([...Object.keys(a.fields),...Object.keys(b.fields)]);
    for(const key of keys){
      const x=a.fields[key],y=b.fields[key];let takeRemote=!x;
      if(x&&y){
        const seesY=observed(a.seen,y.stamp),seesX=observed(b.seen,x.stamp);
        takeRemote=seesX&&!seesY||seesX===seesY&&compareEdits(y,x)>0;
      }
      const field=takeRemote?y:x,sourceValues=takeRemote?bv:av;
      fields[key]=field;
      const [kind,id]=JSON.parse(key);
      if(kind==='order')orderSource=sourceValues;
      if(kind==='page'||kind==='layers'||kind==='item'){
        if(!pageKeys.has(id))pageKeys.set(id,[]);
        pageKeys.get(id).push(key);
      }
      if(field.hash!==null){if(!sourceValues.has(key))throw Error('Notebook sync history does not match its contents.');values.set(key,sourceValues.get(key));}
    }
    // If a newer edit wins over a page deletion, restore the contents removed
    // by that deletion. Earlier erasures still apply.
    for(const [id,keys] of pageKeys){
      const key=JSON.stringify(['page',id]);
      const aDeleted=a.fields[key]?.hash===null,bDeleted=b.fields[key]?.hash===null;
      if(aDeleted===bDeleted)continue;
      const removed=aDeleted?a:b,retained=aDeleted?b:a,live=aDeleted?bv:av;
      if(!live.has(key))continue;
      const deletion=removed.fields[key];
      const newerItem=keys.some(location=>{
        if(JSON.parse(location)[0]!=='item')return false;
        const edit=retained.fields[location];
        return edit&&!observed(removed.seen,edit.stamp)&&compareEdits(edit,deletion)>0;
      });
      if(!values.has(key)&&!newerItem)continue;
      for(const location of keys){
        const field=fields[location];
        if(field.hash===null&&compare(field.stamp,deletion.stamp)===0&&live.has(location))values.set(location,live.get(location));
      }
    }
    const order=values.get('["order"]')||[],pageIds=[...new Set([...order,...[...values.keys()].map(k=>JSON.parse(k)).filter(k=>k[0]==='page').map(k=>k[1]).sort()])];
    // Concurrent removals of different pages can empty the union. Keep a page
    // from the winning page order so the notebook stays usable.
    if(!pageIds.some(id=>values.has(JSON.stringify(['page',id])))){
      const id=order.find(id=>orderSource.has(JSON.stringify(['page',id])));
      if(id===undefined)throw Error('Notebook sync history contains no usable page.');
      for(const key of pageKeys.get(id))if(orderSource.has(key))values.set(key,orderSource.get(key));
    }
    const pages=[],pageItems=new Map();
    for(const [key,value] of values){const k=JSON.parse(key);if(k[0]==='item'){if(!pageItems.has(k[1]))pageItems.set(k[1],new Map());pageItems.get(k[1]).set(k[2],value);}}
    for(const id of pageIds){
      const metaKey=JSON.stringify(['page',id]),meta=values.get(metaKey);
      if(!meta)continue;
      const layerOrder=values.get(JSON.stringify(['layers',id]))||[],items=pageItems.get(id)||new Map();
      const ids=[...new Set([...layerOrder,...[...items.keys()].sort()])];pages.push({id,...meta,items:ids.filter(key=>items.has(key)).map(key=>items.get(key))});
    }
    const merged={id:local.id,title:values.get('["book","title"]'),cover:values.get('["book","cover"]'),createdAt:values.get('["book","createdAt"]'),
      updatedAt:[local.updatedAt||'',remote.updatedAt||''].sort().at(-1),pages:clone(pages),
      _sync:{version:1,clock:Math.max(a.clock,b.clock),seen:union(a.seen,b.seen),fields}};
    // Synthesized order/layer unions are a deterministic event observed by both
    // sides. Future saves must not mistake this merged order for a user edit.
    capture(merged,'merge-'+hash(Object.entries(fields).sort(([a],[b])=>a<b?-1:a>b?1:0)));
    return {book:merged};
  }
  function deletion(book,at,actor){
    capture(book,actor);if(book._sharing)return at;
    const clock=book._sync.clock+1;return {at,stamp:[clock,actor],seen:{...book._sync.seen,[actor]:clock}};
  }
  function mergeDeletion(a,b){
    if(!a)return b;if(!b)return a;
    if(typeof a==='string'||typeof b==='string')return typeof a==='string'&&typeof b==='string'?(a>b?a:b):typeof a==='string'?b:a;
    if(!validStamp(a.stamp)||!validStamp(b.stamp)||!object(a.seen)||!object(b.seen))throw Error('Invalid deletion history');
    return {at:a.at>b.at?a.at:b.at,stamp:compare(a.stamp,b.stamp)>0?a.stamp:b.stamp,seen:union(a.seen,b.seen)};
  }
  function removes(mark,book){
    if(!mark)return false;
    if(typeof mark==='string')return mark>=(book.updatedAt||'');
    if(!validStamp(mark.stamp)||!object(mark.seen))throw Error('Invalid notebook deletion');
    if(!book._sync)return false;
    return Object.entries(book._sync.seen).every(([actor,time])=>(own(mark.seen,actor)?mark.seen[actor]:0)>=time);
  }
  function covers(newer,older){
    if(newer?.syncVersion!==1||older?.syncVersion!==1)return false;
    const books=new Map((newer.notebooks||[]).map(b=>[b.id,b]));
    for(const old of older.notebooks||[]){
      const book=books.get(old.id);
      if(old._sharing){
        // Shared-file history is authoritative. Never prune the only private
        // backup of an unsent shared edit, or of a different sharing resource.
        if(!book?._sharing||book._sharing.folderId!==old._sharing.folderId||book._sharing.seedId!==old._sharing.seedId||
          (old._sharing.pending||[]).some(edit=>!(book._sharing.pending||[]).some(next=>next.id===edit.id)))return false;
        continue;
      }
      if(!book){if(!removes(newer.deleted?.[old.id],old))return false;continue;}
      if(!valid(book._sync)||!valid(old._sync)||!Object.entries(old._sync.seen).every(([actor,time])=>(book._sync.seen[actor]||0)>=time))return false;
    }
    for(const [id,mark] of Object.entries(older.deleted||{}))if(!equal(mergeDeletion(newer.deleted?.[id],mark),newer.deleted?.[id]))return false;
    return true;
  }
  function equivalent(a,b){
    const books=new Map((b.notebooks||[]).map(n=>[n.id,n]));
    return a.notebooks.length===books.size&&a.notebooks.every(n=>equal(n,books.get(n.id)))&&equal(a.deleted||{},b.deleted||{});
  }
  global.WindsWorkspaceModel=Object.freeze({capture,merge,deletion,mergeDeletion,removes,covers,equal,equivalent});
})(typeof window!=='undefined'?window:globalThis);
