/* Editable art layers and a tracing lightbox. No storage or input handlers here. */
(function(global){
  'use strict';
  const BASE='base',MAX_LAYERS=24,own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const base=()=>({id:BASE,name:'Artwork',visible:true,locked:false});
  const validId=id=>typeof id==='string'&&id.length>0&&id.length<=100&&!/[\u0000-\u001f]/.test(id);
  let caches=new WeakMap(),active=new WeakMap();
  function normalize(value){
    if(value==null)return undefined;
    if(!Array.isArray(value)||!value.length||value.length>MAX_LAYERS)throw Error('Invalid art layers');
    const ids=new Set(),layers=value.map(layer=>{
      if(!layer||!validId(layer.id)||ids.has(layer.id)||typeof layer.name!=='string'||!layer.name.trim()||layer.name.length>80||
        (layer.visible!=null&&typeof layer.visible!=='boolean')||(layer.locked!=null&&typeof layer.locked!=='boolean'))throw Error('Invalid art layer');
      ids.add(layer.id);return {id:layer.id,name:layer.name.trim(),visible:layer.visible!==false,locked:layer.locked===true};
    });
    if(!ids.has(BASE))throw Error('The Artwork layer is missing');
    return layers;
  }
  function itemFields(item){
    const result={};
    if(item.layerId!=null){if(!validId(item.layerId))throw Error('Invalid object layer');result.layerId=item.layerId;}
    if(item.type==='image'){
      if(item.opacity!=null){if(!Number.isFinite(item.opacity)||item.opacity<0||item.opacity>1)throw Error('Invalid image opacity');result.opacity=item.opacity;}
      for(const key of ['tracingReference','referenceVisible','referenceLocked'])if(item[key]!=null){if(typeof item[key]!=='boolean')throw Error('Invalid tracing reference');result[key]=item[key];}
    }
    return result;
  }
  function cache(page){
    let entry=caches.get(page);
    if(!entry||entry.source!==page.artLayers){
      const layers=page.artLayers||[base()];
      entry={source:page.artLayers,layers,map:new Map(layers.map((layer,index)=>[layer.id,{...layer,rank:index}]))};caches.set(page,entry);
    }
    return entry;
  }
  function invalidate(page){caches.delete(page);}
  function info(page,item){
    const entry=page?cache(page):null,layer=entry?.map.get(item?.layerId||BASE)||entry?.map.get(BASE)||base();
    if(item?.tracingReference)return {visible:item.referenceVisible!==false,locked:item.referenceLocked!==false,opacity:item.opacity??.3,rank:-1};
    return {visible:layer.visible!==false,locked:layer.locked===true,opacity:item?.type==='image'?item.opacity??1:1,rank:layer.rank||0};
  }
  function editable(page,item){const style=info(page,item);return Boolean(item&&style.visible&&!style.locked);}
  function ordered(page,items=page.items){
    const entry=cache(page);
    if(items===page.items&&entry.items===items&&entry.length===items.length&&entry.sorted)return entry.sorted;
    const buckets=Array.from({length:entry.layers.length+1},()=>[]);
    for(const item of items)buckets[info(page,item).rank+1].push(item);
    const sorted=buckets.flat();
    if(items===page.items){entry.items=items;entry.length=items.length;entry.sorted=sorted;}return sorted;
  }
  function activeId(page){const id=active.get(page)||BASE;return cache(page).map.has(id)?id:BASE;}
  function canDraw(page){if(!page)return false;const layer=cache(page).map.get(activeId(page));return layer?.visible!==false&&!layer?.locked;}
  function select(page,id){if(!cache(page).map.has(id))throw Error('Choose an available layer');active.set(page,id);}
  function adopt(before,after){const id=active.get(before);if(id&&cache(after).map.has(id))active.set(after,id);}
  function assign(item,page,force=false){
    if(!page||item.tracingReference&&!force)return item;
    if(force){delete item.tracingReference;delete item.referenceVisible;delete item.referenceLocked;}
    if(force||!own(item,'layerId')){const id=activeId(page);if(id===BASE)delete item.layerId;else item.layerId=id;}
    return item;
  }
  function hasAbove(page,items){
    if(!page?.artLayers||!items?.length)return false;
    const top=Math.max(...cache(page).layers.filter(layer=>layer.visible).map((layer)=>cache(page).map.get(layer.id).rank));
    return items.some(item=>info(page,item).rank<top);
  }
  function restore(page,action,forward){
    if(action.layers){const value=forward?action.after:action.before;if(value===undefined)delete page.artLayers;else page.artLayers=clone(value);}
    for(const edit of action.properties){const item=page.items.find(item=>item.id===edit.id);if(!item)continue;const value=forward?edit.after:edit.before;
      for(const key of new Set([...Object.keys(edit.before),...Object.keys(edit.after)])){if(own(value,key))item[key]=clone(value[key]);else delete item[key];}}
    for(const edit of action.objects){const index=page.items.findIndex(item=>item.id===edit.id),value=forward?edit.after:edit.before;
      if(value==null){if(index>=0)page.items.splice(index,1);}else if(index>=0)page.items[index]=clone(value);else page.items.splice(Math.min(edit.index,page.items.length),0,clone(value));}
    invalidate(page);
  }
  function change(page,command){
    const layers=clone(cache(page).layers),action={kind:'artLayers',layers:false,properties:[],objects:[]};
    const layer=layers.find(layer=>layer.id===command.id);
    const props=(item,patch)=>{const before={},after={};for(const [key,value] of Object.entries(patch)){if(item[key]!==undefined)before[key]=clone(item[key]);if(value!==undefined)after[key]=clone(value);}if(JSON.stringify(before)!==JSON.stringify(after))action.properties.push({id:item.id,before,after});};
    const meta=()=>{action.layers=true;action.before=page.artLayers?clone(page.artLayers):undefined;action.after=normalize(layers);};
    if(command.kind==='add'){
      if(layers.length>=MAX_LAYERS)throw Error('Use up to 24 layers on one page');
      if(!validId(command.id)||layers.some(layer=>layer.id===command.id))throw Error('Invalid new layer');
      layers.push({id:command.id,name:String(command.name||'New layer').trim().slice(0,80)||'New layer',visible:true,locked:false});meta();
    }else if(command.kind==='layer'){
      if(!layer)throw Error('The layer was removed');
      if(command.name!==undefined)layer.name=String(command.name).trim().slice(0,80)||layer.name;
      if(command.visible!==undefined)layer.visible=Boolean(command.visible);
      if(command.locked!==undefined)layer.locked=Boolean(command.locked);
      meta();
    }else if(command.kind==='reorder'){
      if(!layer)throw Error('The layer was removed');const from=layers.indexOf(layer),to=Math.max(0,Math.min(layers.length-1,from+command.direction));layers.splice(from,1);layers.splice(to,0,layer);meta();
    }else if(command.kind==='remove'){
      if(!layer||layer.id===BASE)throw Error('Keep the Artwork layer');
      layers.splice(layers.indexOf(layer),1);for(const item of page.items)if(item.layerId===layer.id)props(item,{layerId:undefined});meta();
    }else if(command.kind==='move'){
      if(!layer)throw Error('The destination layer was removed');
      const ids=new Set(command.ids||[]);for(const item of page.items)if(ids.has(item.id)&&editable(page,item)&&!item.tracingReference)props(item,{layerId:layer.id===BASE?undefined:layer.id});
    }else if(command.kind==='reference'){
      const references=page.items.filter(item=>item.tracingReference);
      for(const item of references)action.objects.push({id:item.id,index:page.items.indexOf(item),before:clone(item),after:null});
      if(command.item){const item={...clone(command.item),tracingReference:true,opacity:.3,referenceLocked:true,referenceVisible:true};delete item.layerId;itemFields(item);action.objects.push({id:item.id,index:0,before:null,after:item});}
    }else if(command.kind==='referenceStyle'){
      const reference=page.items.find(item=>item.tracingReference);if(!reference)throw Error('Add a reference image first');
      const patch=Object.fromEntries(['opacity','referenceVisible','referenceLocked','x','y','w','h'].filter(key=>command[key]!==undefined).map(key=>[key,command[key]]));
      itemFields({...reference,...patch});props(reference,patch);
    }else throw Error('Unknown layer action');
    if(action.layers&&JSON.stringify(action.before)===JSON.stringify(action.after))action.layers=false;
    if(!action.layers&&!action.properties.length&&!action.objects.length)return null;
    restore(page,action,true);if(command.kind==='add')select(page,command.id);return action;
  }
  const model={BASE,MAX_LAYERS,normalize,itemFields,info,editable,ordered,activeId,canDraw,select,adopt,assign,hasAbove,invalidate,change,restore,layers:page=>cache(page).layers,reset:()=>{caches=new WeakMap();active=new WeakMap();}};

  // The dialog adapter owns idle scheduling, history and account/page guards.
  function createUI(api){
    const $=id=>document.getElementById(id),dialog=$('artLayersDialog');
    let scope=null,target=null,selection=[],trigger=null,epoch=0,pending=0,queue=Promise.resolve();
    const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
    function close(){epoch++;dialog.close();scope=null;target=null;selection=[];$('tracingPreview').removeAttribute('src');$('artLayerList').replaceChildren();}
    function button(text,label,callback){const node=el('button',text);node.type='button';node.setAttribute('aria-label',label);node.title=label;node.onclick=callback;return node;}
    function enqueue(task){
      if(!target)return Promise.resolve();
      const savedScope=scope,savedTarget=target,ticket=epoch,valid=()=>ticket===epoch&&target===savedTarget&&api.matches(savedScope);
      pending++;dialog.setAttribute('aria-busy','true');
      const result=queue.then(async()=>{if(!valid())return;await task(savedScope,savedTarget,valid);if(valid())refresh();}).catch(error=>{if(valid()){api.toast(error.message);refresh();}}).finally(()=>{pending--;if(!pending)dialog.removeAttribute('aria-busy');});
      queue=result;return result;
    }
    function run(command){return enqueue((savedScope,savedTarget)=>api.change(command,savedScope,savedTarget));}
    function refresh(){
      if(!dialog.open)return;
      if(!api.matches(scope)||api.page()!==target){close();return;}
      const layers=model.layers(target),active=model.activeId(target),list=$('artLayerList');list.replaceChildren();
      const reference=target.items.find(item=>item.tracingReference);
      $('tracingControls').hidden=!reference;$('tracingEmpty').hidden=Boolean(reference);
      $('tracingFileLabel').textContent=reference?'Replace reference image':'Add reference image';
      if(reference){
        $('tracingPreview').src=reference.src;$('tracingPreview').style.opacity=String(reference.opacity??.3);
        $('tracingOpacity').value=Math.round((reference.opacity??.3)*100);$('tracingOpacityValue').textContent=$('tracingOpacity').value+'%';
        $('tracingVisible').checked=reference.referenceVisible!==false;$('tracingLocked').checked=reference.referenceLocked!==false;
      }else $('tracingPreview').removeAttribute('src');
      for(const layer of [...layers].reverse()){
        const row=el('div',undefined,'art-layer-row');row.dataset.artLayer=layer.id;row.classList.toggle('is-active',layer.id===active);
        const choose=button(layer.id===active?'Drawing':'Draw here',`Draw on ${layer.name}`,()=>{model.select(target,layer.id);refresh();});choose.className='art-layer-choose';choose.setAttribute('aria-pressed',String(layer.id===active));
        const name=el('input');name.value=layer.name;name.maxLength=80;name.setAttribute('aria-label','Layer name');name.onchange=()=>run({kind:'layer',id:layer.id,name:name.value});
        const heading=el('div',undefined,'art-layer-heading');heading.append(name,choose);
        const count=target.items.filter(item=>!item.tracingReference&&(item.layerId===layer.id||layer.id===BASE&&!layers.some(layer=>layer.id===item.layerId))).length;
        const details=el('span',`${count} object${count===1?'':'s'}`, 'art-layer-count'),actions=el('div',undefined,'art-layer-actions');
        const visibility=button(layer.visible?'◉':'◌',`${layer.visible?'Hide':'Show'} ${layer.name}`,()=>run({kind:'layer',id:layer.id,visible:!layer.visible}));visibility.setAttribute('aria-pressed',String(layer.visible));
        visibility.innerHTML='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(layer.visible?'':'<path d="m3 3 18 18"/>')+'</svg>';
        const lock=button(layer.locked?'Unlock':'Lock',`${layer.locked?'Unlock':'Lock'} ${layer.name}`,()=>run({kind:'layer',id:layer.id,locked:!layer.locked}));lock.setAttribute('aria-pressed',String(layer.locked));
        const up=button('↑',`Move ${layer.name} up`,()=>run({kind:'reorder',id:layer.id,direction:1}));up.disabled=layers.at(-1).id===layer.id;
        const down=button('↓',`Move ${layer.name} down`,()=>run({kind:'reorder',id:layer.id,direction:-1}));down.disabled=layers[0].id===layer.id;
        const move=button('Move selection',`Move selection to ${layer.name}`,()=>run({kind:'move',id:layer.id,ids:selection}));move.disabled=!selection.some(id=>target.items.some(item=>item.id===id&&model.editable(target,item)&&!item.tracingReference));
        actions.append(details,visibility,lock,up,down,move);
        if(layer.id!==BASE){const remove=button('Remove',`Remove ${layer.name}; keep its objects in Artwork`,()=>run({kind:'remove',id:layer.id}));remove.className='art-layer-remove';actions.append(remove);}
        row.append(heading,actions);list.append(row);
      }
      const current=layers.find(layer=>layer.id===active);$('artLayerStatus').textContent=model.canDraw(target)?`Drawing on ${current.name}. Top layers appear above lower layers.`:`${current.name} is ${current.locked?'locked':'hidden'}. Unlock or show it, or choose another layer to draw.`;
      $('newArtLayerButton').disabled=layers.length>=MAX_LAYERS;
    }
    async function open(){
      trigger=document.activeElement;await api.prepare();epoch++;target=api.page();if(!target)return;scope=api.scope();selection=api.selected().map(item=>item.id);dialog.showModal();refresh();
    }
    $('closeArtLayers').onclick=close;dialog.addEventListener('close',()=>{
      // Native close events are queued. A previous close must not clear a
      // newly reopened panel or cancel its pending commands.
      if(dialog.open)return;
      epoch++;scope=null;target=null;selection=[];$('tracingPreview').removeAttribute('src');$('artLayerList').replaceChildren();if(trigger?.isConnected)trigger.focus();
    });
    $('newArtLayerForm').onsubmit=event=>{event.preventDefault();const input=$('newArtLayerName');void run({kind:'add',id:api.id(),name:input.value||'New layer'});input.value='';};
    dialog.querySelectorAll('[data-layer-preset]').forEach(node=>{node.onclick=()=>run({kind:'add',id:api.id(),name:node.dataset.layerPreset});});
    $('tracingFile').onchange=event=>{const file=event.target.files[0];event.target.value='';if(!file)return;
      void enqueue(async(savedScope,savedTarget,valid)=>{const item=await api.image(file,savedScope);if(valid())await api.change({kind:'reference',item:api.fit(item,savedTarget)},savedScope,savedTarget);});};
    $('tracingOpacity').oninput=event=>{$('tracingOpacityValue').textContent=event.target.value+'%';$('tracingPreview').style.opacity=String(Number(event.target.value)/100);};
    $('tracingOpacity').onchange=event=>run({kind:'referenceStyle',opacity:Number(event.target.value)/100});
    $('tracingVisible').onchange=event=>run({kind:'referenceStyle',referenceVisible:event.target.checked});
    $('tracingLocked').onchange=event=>run({kind:'referenceStyle',referenceLocked:event.target.checked});
    $('tracingFit').onclick=()=>{const ref=target?.items.find(item=>item.tracingReference);if(ref){const {x,y,w,h}=api.fit(ref,target);void run({kind:'referenceStyle',x,y,w,h});}};
    $('tracingRemove').onclick=()=>run({kind:'reference'});
    return Object.freeze({open,close,refresh});
  }
  const api=Object.freeze({...model,createUI});if(typeof module!=='undefined'&&module.exports)module.exports=api;global.WindsLayers=api;
})(typeof window!=='undefined'?window:globalThis);
