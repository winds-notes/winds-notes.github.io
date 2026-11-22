/* Drive transport only. Editor/native files always receive a materialized workspace. */
(function(global){
  'use strict';
  const FORMAT='winds-notes-drive',own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const id=x=>typeof x==='string'&&x.length>0&&x.length<=200;
  function fail(){throw new Error('Invalid compact Drive workspace. Local notebooks are retained.');}
  function without(value,keys){return Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)));}
  function index(values){const result=new Map();for(const value of values||[]){if(!object(value)||!id(value.id)||result.has(value.id))fail();result.set(value.id,value);}return result;}
  function dependencies(values=[]){
    if(!Array.isArray(values)||values.length>200)fail();
    const result=new Map();for(const pair of values){if(!Array.isArray(pair)||pair.length!==2||!id(pair[0])||!id(pair[1])||pair[0]===pair[1]||result.has(pair[0]))fail();result.set(...pair);}return result;
  }
  function control(options){let last=Date.now(),count=0;return async()=>{options.check?.();if(++count>=128||Date.now()-last>=8){await options.yield?.();options.check?.();count=0;last=Date.now();}};}
  const asset=(value,base)=>typeof base==='string'&&value===base?['ref']:['value',value];
  function background(value,base,equal){
    if(value===undefined)return null;
    if(base&&equal(value,base))return ['ref'];
    if(!object(value))fail();
    return ['fields',without(value,['src','thumbnail']),asset(value.src,base?.src),asset(value.thumbnail,base?.thumbnail)];
  }
  async function pack(data,base,{fileId,revisionId,revisionBases=[],...options}){
    if(!id(fileId)||!id(revisionId)||!Array.isArray(data.notebooks)||!Array.isArray(base.notebooks))fail();
    const equal=global.WindsWorkspaceModel.equal,pause=control(options),baseBooks=index(base.notebooks),books=[];
    index(data.notebooks);
    for(const book of data.notebooks){
      await pause();const old=baseBooks.get(book.id),oldPages=index(old?.pages),pages=[];let samePages=old?.pages?.length===book.pages.length;
      index(book.pages);
      for(let p=0;p<book.pages.length;p++){
        const page=book.pages[p],prior=oldPages.get(page.id),oldItems=index(prior?.items),items=[];
        let sameItems=prior?.items?.length===page.items.length;index(page.items);
        for(let i=0;i<page.items.length;i++){
          await pause();const item=page.items[i],previous=oldItems.get(item.id);
          if(previous&&equal(item,previous))items.push(['ref',item.id]);
          else if(item.type==='image')items.push(['image',without(item,['src']),asset(item.src,previous?.src)]);
          else items.push(['item',item]);
          if(items[i][0]!=='ref'||prior?.items[i]?.id!==item.id)sameItems=false;
        }
        if(prior&&sameItems&&equal(without(page,['items']),without(prior,['items'])))pages.push(['ref',page.id]);
        else pages.push(['page',without(page,['items','background']),background(page.background,prior?.background,equal),items]);
        if(pages[p][0]!=='ref'||old?.pages[p]?.id!==page.id)samePages=false;
      }
      if(old&&samePages&&equal(without(book,['pages']),without(old,['pages'])))books.push(['ref',book.id]);
      else books.push(['book',without(book,['pages']),pages]);
    }
    options.check?.();dependencies(revisionBases);
    return {format:FORMAT,version:1,kind:'delta',fileId,baseRevision:revisionId,revisionBases,...(options.logicalBytes?{logicalBytes:options.logicalBytes}:{}),meta:without(data,['notebooks']),books};
  }
  function full(data,fileId,revisionBases=[]){if(!id(fileId))fail();dependencies(revisionBases);return {format:FORMAT,version:1,kind:'full',fileId,revisionBases,data};}
  function readAsset(row,base){
    if(!Array.isArray(row))fail();
    if(row[0]==='ref'&&row.length===1&&typeof base==='string')return base;
    if(row[0]==='value'&&row.length===2&&typeof row[1]==='string')return row[1];
    fail();
  }
  function readBackground(row,base){
    if(row===null)return undefined;
    if(!Array.isArray(row))fail();
    if(row[0]==='ref'&&row.length===1&&object(base))return base;
    if(row[0]==='fields'&&row.length===4&&object(row[1])&&!own(row[1],'src')&&!own(row[1],'thumbnail'))return {...row[1],src:readAsset(row[2],base?.src),thumbnail:readAsset(row[3],base?.thumbnail)};
    fail();
  }
  function rows(values){if(!Array.isArray(values)||values.length>150000)fail();return values;}
  function reference(row,values){if(row[0]!=='ref'||row.length!==2||!id(row[1])||!values.has(row[1]))fail();return values.get(row[1]);}
  async function unpack(packet,base,fileId,options={}){
    if(!object(packet)||packet.format!==FORMAT||packet.version!==1||packet.fileId!==fileId)fail();
    dependencies(packet.revisionBases);
    if(packet.kind==='full'){
      if(packet.data?.format!=='winds-notes-backup'||!Array.isArray(packet.data.notebooks))fail();
      return packet.data;
    }
    if(packet.kind!=='delta'||!id(packet.baseRevision)||!base||base.format!=='winds-notes-backup'||!object(packet.meta)||packet.meta.format!=='winds-notes-backup'||own(packet.meta,'notebooks'))fail();
    const baseBooks=index(base.notebooks),books=[],pause=control(options);
    for(const row of rows(packet.books)){
      await pause();if(!Array.isArray(row))fail();
      if(row[0]==='ref'){books.push(reference(row,baseBooks));continue;}
      if(row[0]!=='book'||row.length!==3||!object(row[1])||!id(row[1].id)||own(row[1],'pages'))fail();
      const old=baseBooks.get(row[1].id),oldPages=index(old?.pages),pages=[];
      for(const record of rows(row[2])){
        await pause();if(!Array.isArray(record))fail();
        if(record[0]==='ref'){pages.push(reference(record,oldPages));continue;}
        if(record[0]!=='page'||record.length!==4||!object(record[1])||!id(record[1].id)||own(record[1],'items')||own(record[1],'background'))fail();
        const prior=oldPages.get(record[1].id),oldItems=index(prior?.items),items=[];
        for(const entry of rows(record[3])){
          await pause();if(!Array.isArray(entry))fail();
          if(entry[0]==='ref')items.push(reference(entry,oldItems));
          else if(entry[0]==='item'&&entry.length===2&&object(entry[1]))items.push(entry[1]);
          else if(entry[0]==='image'&&entry.length===3&&object(entry[1])&&entry[1].type==='image'&&!own(entry[1],'src'))items.push({...entry[1],src:readAsset(entry[2],oldItems.get(entry[1].id)?.src)});
          else fail();
        }
        index(items);const bg=readBackground(record[2],prior?.background);
        pages.push({...record[1],...(bg?{background:bg}:{}),items});
      }
      index(pages);books.push({...row[1],pages});
    }
    index(books);options.check?.();return {...packet.meta,notebooks:books};
  }
  global.WindsDriveCodec=Object.freeze({FORMAT,pack,full,unpack,dependencies});
})(typeof window!=='undefined'?window:globalThis);
