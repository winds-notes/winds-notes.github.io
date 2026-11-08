/* Local mandala library. Templates are rendered by the shared creative renderer. */
(function(global){
  'use strict';
  let api,dialog,selected='lotus',epoch=0,working=false,opener,grid,empty,previewObserver,paintScheduled=false;
  const cards=[],previewQueue=new Set(),$=id=>document.getElementById(id);
  function contextMatches(scope){const current=api.context();return current.workspace===scope.workspace&&current.bookId===scope.bookId&&current.pageId===scope.pageId&&current.version===scope.version;}
  function close(){epoch++;working=false;previewQueue.clear();if(dialog?.open)dialog.close();}
  async function paintPreviews(){
    if(!dialog.open){previewQueue.clear();paintScheduled=false;return;}
    let painted=0;
    try{for(const record of previewQueue){
      previewQueue.delete(record);
      if(record.drawn||record.card.hidden)continue;
      let prepared;
      try{if(record.design.motif)prepared=await global.WindsCreative.prepareMandala(record.design.id);}
      catch(error){record.card.title=error.message;record.preview.dataset.previewError='true';continue;}
      if(!dialog.open||record.card.hidden)continue;
      record.preview.width=record.preview.height=220;
      const ctx=record.preview.getContext('2d');
      if(ctx)global.WindsCreative.drawMandala(ctx,record.design.id,220,prepared);
      record.drawn=true;record.preview.dataset.previewReady='true';previewObserver?.unobserve(record.card);
      painted+=record.design.motif?3:1;if(painted>=3)break;
    }}finally{paintScheduled=false;if(previewQueue.size&&dialog.open)schedulePaint();}
  }
  function schedulePaint(){
    if(paintScheduled)return;paintScheduled=true;
    if(global.requestAnimationFrame)global.requestAnimationFrame(paintPreviews);else paintPreviews();
  }
  function queueVisiblePreviews(){
    if(!dialog.open)return;
    const viewport=previewObserver?grid.getBoundingClientRect():null;
    for(const record of cards){
      if(record.drawn||record.card.hidden)continue;
      const bounds=viewport?record.card.getBoundingClientRect():null;
      if(!bounds||bounds.bottom>=viewport.top-80&&bounds.top<=viewport.bottom+80)previewQueue.add(record);
    }
    if(previewQueue.size)schedulePaint();
  }
  function filterDesigns(){
    if(working)return;
    const query=$('mandalaSearch').value.trim().toLowerCase(),collection=$('mandalaCollection').value;
    const visible=[];
    for(const record of cards){
      const design=record.design,match=(collection==='all'||design.collection===collection)&&`${design.name} ${design.detail} ${design.collection||''} ${design.level} ${design.keywords||''}`.toLowerCase().includes(query);
      record.card.hidden=!match;if(match)visible.push(record);
    }
    if(!visible.some(record=>record.design.id===selected))selected=visible[0]?.design.id||'';
    empty.hidden=visible.length>0;grid.scrollTop=0;
    $('mandalaStatus').textContent=`${visible.length===cards.length?cards.length:visible.length+' of '+cards.length} designs · available offline`;
    update();queueVisiblePreviews();
  }
  function init(adapter){
    api=adapter;
    let button=$('openMandala');
    if(!button){button=document.createElement('button');button.type='button';button.id='openMandala';button.textContent='Mandala coloring pages…';$('fillMenu').append(button);}
    if(!global.WindsCreative?.MANDALA_DESIGNS?.length){button.disabled=true;return;}
    button.onclick=open;
    dialog=document.createElement('dialog');dialog.id='mandalaDialog';dialog.className='mandala-dialog';dialog.setAttribute('aria-labelledby','mandalaTitle');
    const header=document.createElement('header'),eyebrow=document.createElement('p'),title=document.createElement('h2'),intro=document.createElement('p');
    eyebrow.className='mandala-eyebrow';eyebrow.textContent='COLORING STUDIO';title.id='mandalaTitle';title.textContent='Mandala coloring studio';
    intro.textContent='Choose a mandala. Add a new page, then fill each section with your own colors.';intro.id='mandalaIntro';dialog.setAttribute('aria-describedby',intro.id);header.append(eyebrow,title,intro);
    const filters=document.createElement('div'),search=document.createElement('input'),collection=document.createElement('select');
    filters.className='mandala-filters';search.id='mandalaSearch';search.type='search';search.placeholder=`Search ${global.WindsCreative.MANDALA_DESIGNS.length} designs…`;search.setAttribute('aria-label','Search mandala designs');search.oninput=filterDesigns;
    collection.id='mandalaCollection';collection.setAttribute('aria-label','Mandala collection');collection.onchange=filterDesigns;
    const collections=[...new Set(['Floral','Geometric','Celestial','Ornamental','Nature',...global.WindsCreative.MANDALA_DESIGNS.map(design=>design.collection)].filter(Boolean))];
    for(const [value,label] of [['all','All collections'],...collections.map(name=>[name,name])]){
      const option=document.createElement('option');option.value=value;option.textContent=label;collection.append(option);
    }
    search.value='';collection.value='all';filters.append(search,collection);
    grid=document.createElement('div');grid.className='mandala-designs';grid.setAttribute('role','group');grid.setAttribute('aria-label','Mandala designs');
    for(const design of global.WindsCreative.MANDALA_DESIGNS){
      const card=document.createElement('button');card.type='button';card.dataset.mandalaId=design.id;card.setAttribute('aria-pressed','false');card.setAttribute('aria-label',`${design.name}, ${design.level}. ${design.detail}`);
      const preview=document.createElement('canvas');preview.width=preview.height=1;preview.setAttribute('aria-hidden','true');
      const name=document.createElement('strong'),level=document.createElement('span');name.textContent=design.name;level.textContent=design.level+(design.collection?' · '+design.collection:'');
      card.append(preview,name,level);card.onclick=()=>{if(!working){selected=design.id;update();}};grid.append(card);
      cards.push({design,card,preview,drawn:false});
    }
    empty=document.createElement('p');empty.className='mandala-empty';empty.textContent='No matching designs. Try another search or collection.';empty.hidden=true;grid.append(empty);
    const status=document.createElement('p');status.id='mandalaStatus';status.className='mandala-status';status.setAttribute('role','status');
    const footer=document.createElement('footer'),cancel=document.createElement('button'),add=document.createElement('button');
    cancel.type=add.type='button';cancel.className='btn btn-outline';cancel.textContent='Cancel';cancel.onclick=close;
    add.id='addMandalaPage';add.className='btn btn-primary';add.textContent='Add coloring page';add.onclick=addPage;
    footer.append(cancel,add);dialog.append(header,filters,grid,status,footer);document.body.append(dialog);
    if(global.IntersectionObserver){
      previewObserver=new global.IntersectionObserver(entries=>{
        for(const entry of entries){if(!entry.isIntersecting)continue;const record=cards.find(record=>record.card===entry.target);if(record&&!record.drawn&&!record.card.hidden&&dialog.open)previewQueue.add(record);}
        if(previewQueue.size&&dialog.open)schedulePaint();
      },{root:grid,rootMargin:'80px'});
      for(const record of cards)previewObserver.observe(record.card);
    }
    dialog.addEventListener('close',()=>{if(dialog.open)return;epoch++;working=false;previewQueue.clear();opener?.focus();});
    dialog.addEventListener('cancel',()=>{epoch++;working=false;previewQueue.clear();});
  }
  function update(){
    for(const record of cards){record.card.setAttribute('aria-pressed',String(record.design.id===selected));record.card.disabled=working;}
    $('mandalaSearch').disabled=$('mandalaCollection').disabled=working;
    $('addMandalaPage').disabled=working||!selected;$('addMandalaPage').textContent=working?'Creating page…':'Add coloring page';
  }
  async function open(){
    if(!dialog||dialog.open)return;
    const requested=api.context();if(!requested.bookId){api.toast('Open a notebook to add a coloring page.');return;}
    const token=++epoch;
    try{
      await api.prepare();
      const scope=api.context();
      if(token!==epoch||scope.workspace!==requested.workspace||scope.bookId!==requested.bookId||scope.pageId!==requested.pageId)return;
      opener=$('shapeFillBtn')||document.activeElement;working=false;dialog.scope=scope;
      $('mandalaSearch').value='';$('mandalaCollection').value='all';filterDesigns();dialog.showModal();
      dialog.querySelector(`[data-mandala-id="${selected}"]`).focus();queueVisiblePreviews();
    }catch(error){api.toast(error.message||'The coloring studio could not open.');}
  }
  async function addPage(){
    if(working||!selected)return;const token=epoch,scope=dialog.scope;working=true;update();$('mandalaStatus').textContent='Preparing your coloring page…';
    const valid=()=>token===epoch&&dialog.open&&contextMatches(scope);
    try{
      await api.commit(selected,scope,valid);
      if(token===epoch&&dialog.open){close();api.toast('Coloring page added · use Fill to color each closed section');}
    }catch(error){if(token===epoch&&dialog.open)$('mandalaStatus').textContent=error.message||'This page could not be created.';}
    finally{if(token===epoch){working=false;update();}}
  }
  global.WindsMandala=Object.freeze({init,open,close,isOpen:()=>Boolean(dialog?.open)});
})(typeof window!=='undefined'?window:globalThis);
