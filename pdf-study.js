/* PDF reading tools and the notebook page organizer. */
(function(global){
  'use strict';
  const $=id=>document.getElementById(id);
  const text=global.WindsPdfText;
  const panels={search:'pdfSearch',places:'pdfPlaces',links:'pdfLinks'};
  const bookmarkKey='pdf-bookmarks-v1';
  const recognized=new WeakMap();
  let api,reader,organizer,pressedQuote,textDrag;
  const ref=()=>reader.current();
  const current=()=>ref()?.pages[ref().index];
  const valid=(session,page)=>ref()===session&&session.account===api.scope().account&&(!page||page===current());
  const option=(label,value)=>new Option(label,value);
  function button(label,click,aria=label){
    const element=document.createElement('button');
    element.type='button';element.className='btn btn-outline';element.textContent=label;
    if(label!==aria)element.setAttribute('aria-label',aria);
    element.onclick=click;return element;
  }
  function place(element,[x,y,w,h]){
    Object.assign(element.style,{left:`${x*100}%`,top:`${y*100}%`,width:`${w*100}%`,height:`${h*100}%`});
  }
  function paintHighlights(){
    const session=ref(),page=current(),layer=$('pdfHighlights');
    layer.replaceChildren();
    if(!page)return;
    const search=session.search;
    const add=(box,style)=>{
      const node=document.createElement('span');node.className=`pdf-highlight ${style}`;
      place(node,box);layer.append(node);
    };
    for(const [index,hit] of (search?.hits||[]).entries())if(hit.page===page)
      for(const box of hit.boxes)add(box,index===search.index?'current':'');
    for(const box of session.regions||[])add(box,'linked');
  }
  function scrollToBox(box){
    if(!box)return;
    const session=ref(),page=current(),image=$('studyPdfImage'),surface=$('studyPdfSurface'),scroll=$('studyPdfScroll');
    const move=()=>{
      if(!valid(session,page))return;
      const [x,y]=text.turnPoint(box[0]+box[2]/2,box[1]+box[3]/2,page.background.turn);
      scroll.scrollTop=Math.max(0,surface.offsetTop+y*surface.offsetHeight-scroll.clientHeight/2);
      scroll.scrollLeft=Math.max(0,surface.offsetLeft+x*surface.offsetWidth-scroll.clientWidth/2);
    };
    if(image.complete)requestAnimationFrame(move);
    else image.addEventListener('load',move,{once:true});
  }
  async function words(page,progress,live){
    const bg=page.background;
    if(bg.pdfWords?.length)return bg.pdfWords;
    if(recognized.has(bg))return recognized.get(bg);
    await api.readerIdle(live);
    if(!live())return [];
    const result=await text.ocr(bg,progress,live);
    await api.readerIdle(live);
    if(live())recognized.set(bg,result);
    return result;
  }
  function updateSearch(){
    const search=ref()?.search;
    $('pdfHitPrev').disabled=$('pdfHitNext').disabled=!search?.hits.length;
    $('pdfSearchStop').hidden=!search?.running;
    $('pdfSearchStatus').value=search?.label||(search?.hits.length?`${search.index+1} of ${search.hits.length} matches`:'');
  }
  function seek(index){
    const session=ref(),search=session?.search;
    if(!search?.hits.length)return;
    search.index=(index+search.hits.length)%search.hits.length;
    const hit=search.hits[search.index],pageIndex=session.pages.indexOf(hit.page);
    if(pageIndex!==session.index)reader.setPage(pageIndex);
    session.regions=null;
    if(!search.running&&!search.failed)search.label='';
    updateSearch();paintHighlights();scrollToBox(hit.boxes[0]);
  }
  async function startSearch(event){
    event.preventDefault();
    const session=ref(),query=$('pdfSearchQuery').value.trim();
    if(!session)return;
    stopSearch(session);
    session.regions=null;
    const search=session.search={query,hits:[],index:-1,running:Boolean(query),label:''};
    paintHighlights();updateSearch();
    if(!query)return;
    const live=()=>valid(session)&&session.search===search&&search.running;
    function add(page,entries){
      const first=search.hits.length===0;
      for(const boxes of text.find(entries,query))if(search.hits.length<2000)search.hits.push({page,boxes});
      if(first&&search.hits.length)seek(0);
    }
    try{
      // Native text is available immediately. Scan image-only pages in order afterward.
      const scans=[];
      for(const page of session.pages){
        if(page.background.pdfWords?.length||recognized.has(page.background))add(page,page.background.pdfWords||recognized.get(page.background));
        else scans.push(page);
      }
      for(const [index,page] of scans.entries()){
        if(!live()||search.hits.length>=2000)break;
        search.label=`Reading scans with English OCR · ${index+1}/${scans.length}`;
        updateSearch();paintHighlights();
        const entries=await words(page,()=>{},live);
        if(live())add(page,entries);
      }
    }catch(error){
      if(live()){search.failed=true;search.label=search.hits.length?'OCR stopped. Text matches are available.':error.message||'Could not read scans.';}
    }finally{
      if(live()){
        search.running=false;
        if(!search.failed)search.label=search.hits.length?(search.hits.length>=2000?'Showing up to 2,000 matches':''):'No matches';
        updateSearch();paintHighlights();
      }
    }
  }
  function stopSearch(session=ref()){
    if(!session?.search?.running)return;
    session.search.running=false;session.search.label='Search stopped';
    if(session===ref())updateSearch();
  }
  function clearText(){
    const session=ref(),layer=$('pdfTextSelection');
    const selection=window.getSelection();
    if(layer.contains(selection?.anchorNode))selection.removeAllRanges();
    if(session){session.textRequest=null;session.textWords=null;session.tapStart=null;}
    textDrag=null;
    layer.replaceChildren();layer.hidden=true;
    $('pdfSelectText').setAttribute('aria-pressed','false');$('pdfSelectText').disabled=false;
    $('pdfInsertQuote').hidden=$('pdfCopyQuote').hidden=$('pdfMakeCard').hidden=true;
    $('pdfInsertQuote').disabled=$('pdfCopyQuote').disabled=$('pdfMakeCard').disabled=true;
    pressedQuote=null;
  }
  function selectionData(){
    const session=ref(),layer=$('pdfTextSelection'),selection=getSelection();
    if(!session?.textWords||!selection?.rangeCount||selection.isCollapsed||!layer.contains(selection.anchorNode)||!layer.contains(selection.focusNode))return null;
    const start=selection.getRangeAt(0),first=start.startContainer.parentElement?.closest('[data-word]');
    const last=start.endContainer.parentElement?.closest('[data-word]');
    if(!first||!last)return null;
    const from=Number(first.dataset.word),to=Number(last.dataset.word);
    if(to-from>=text.maxPassage)return null;
    const regions=[],tokens=[];
    for(let index=from;index<=to;index++){
      const [word,x,y,w,h]=session.textWords[index];
      const left=index===from&&start.startContainer.nodeType===Node.TEXT_NODE?start.startOffset:0;
      const right=index===to&&start.endContainer.nodeType===Node.TEXT_NODE?start.endOffset:word.length;
      if(left>=right)continue;
      tokens.push(word.slice(left,right));
      // Preserve the word box even when individual letter positions are estimated.
      regions.push([x,y,w,h]);
    }
    return tokens.length?{quote:tokens.join(' '),regions}:null;
  }
  function selectWords(from,to){
    if(Math.abs(to-from)>=text.maxPassage)to=from+Math.sign(to-from)*(text.maxPassage-1);
    const children=$('pdfTextSelection').children;
    const first=children[Math.min(from,to)]?.firstChild.firstChild;
    const last=children[Math.max(from,to)]?.firstChild.firstChild;
    if(!first||!last)return;
    const range=document.createRange(),selection=getSelection();
    range.setStart(first,0);range.setEnd(last,last.length);
    selection.removeAllRanges();selection.addRange(range);
  }
  function bindTextSelection(){
    const layer=$('pdfTextSelection');
    function wordAt(event){
      const word=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-word]');
      return word&&layer.contains(word)?Number(word.dataset.word):null;
    }
    layer.onpointerdown=event=>{
      const session=ref(),index=wordAt(event);
      if(!session?.textWords||index==null||event.button!==0||textDrag)return;
      textDrag={id:event.pointerId,from:index,to:index};
      layer.setPointerCapture(event.pointerId);
      if(event.pointerType==='touch')return;
      event.preventDefault();
      selectWords(index,index);
    };
    layer.onpointermove=event=>{
      const drag=textDrag;
      if(drag?.id!==event.pointerId||event.pointerType==='touch')return;
      const index=wordAt(event);
      if(index==null||index===drag.to)return;
      drag.to=index;
      if(!drag.frame)drag.frame=requestAnimationFrame(()=>{
        drag.frame=0;if(textDrag===drag)selectWords(drag.from,drag.to);
      });
    };
    layer.onpointerup=event=>{
      const drag=textDrag,session=ref();
      if(drag?.id!==event.pointerId||!session)return;
      textDrag=null;
      if(event.pointerType==='touch'){
        if(wordAt(event)!==drag.from)return;
        selectWords(session.tapStart??drag.from,drag.from);
        session.tapStart=session.tapStart==null?drag.from:null;
      }else selectWords(drag.from,wordAt(event)??drag.to);
    };
    layer.onpointercancel=layer.onlostpointercapture=event=>{if(textDrag?.id===event.pointerId)textDrag=null;};
  }
  async function selectText(){
    const session=ref(),page=current(),layer=$('pdfTextSelection');
    if(!page)return;
    if(session.textWords){clearText();return;}
    const request=session.textRequest={};
    reader.clearFigure();
    $('pdfSelectText').disabled=true;
    const live=()=>valid(session,page)&&session.textRequest===request;
    try{
      const entries=await words(page,()=>{$('studyPdfStatus').textContent='Reading this page with English OCR…';},live);
      if(!live())return;
      if(!entries.length){$('studyPdfStatus').textContent='No selectable words found on this page.';return;}
      const fragment=document.createDocumentFragment();
      for(const [index,[word,...box]] of entries.entries()){
        const span=document.createElement('span');span.className='pdf-word';span.dataset.word=index;place(span,box);
        span.style.fontSize=`calc(${box[3]*100} * var(--pdf-height-unit))`;
        const label=document.createElement('span');label.textContent=word;
        span.append(label);fragment.append(span);
      }
      layer.replaceChildren(fragment);layer.hidden=false;session.textWords=entries;
      resizeText();
      $('pdfSelectText').setAttribute('aria-pressed','true');$('pdfInsertQuote').hidden=$('pdfCopyQuote').hidden=$('pdfMakeCard').hidden=false;
      $('studyPdfStatus').textContent='Drag across the words, or tap the first and last word.';
    }catch(error){if(live())$('studyPdfStatus').textContent=error.message||'Could not read this page.';}
    finally{if(live())$('pdfSelectText').disabled=false;}
  }
  function resizeText(){
    if(!ref()?.textWords)return;
    const layer=$('pdfTextSelection');
    layer.style.setProperty('--pdf-height-unit',`${layer.clientHeight/100}px`);
    const spans=[...layer.children],labels=spans.map(span=>span.firstChild);
    for(const label of labels)label.style.width='max-content';
    const sizes=spans.map((span,index)=>[span.clientWidth,labels[index].offsetWidth]);
    labels.forEach((label,index)=>{
      const [available,actual]=sizes[index];
      label.style.transform=actual?`scaleX(${available/actual})`:'';
    });
  }
  function captureQuote(){
    const session=ref(),page=current(),data=selectionData();
    if(!page||!data||!api.ready())return null;
    return {scope:api.scope(),item:api.quoteItem(data.quote,{book:session.book,page:page.id,pdfRegion:data.regions})};
  }
  function quoteAction(action){
    const quote=pressedQuote||captureQuote();pressedQuote=null;
    if(!quote||!api.matches(quote.scope)||!api.ready())return;
    try{
      if(action==='card')api.makeCard(quote);
      else if(action==='copy')void global.WindsClipboard.copyQuote(quote.item,quote.scope);
      else{
        api.insertQuote(quote.item,quote.scope);
        clearText();$('studyPdfStatus').textContent='Quote inserted with a link to this passage.';
      }
    }catch(error){$('studyPdfStatus').textContent=error.message;}
  }
  function syncPlaces(){
    const session=ref(),page=current();
    if(!page)return;
    const chapters=session.pages.flatMap((p,i)=>(p.background.chapters||[]).map(title=>option(title,String(i))));
    const bookmarks=session.pages.flatMap((p,i)=>session.bookmarks?.includes(p.id)?[option(`PDF page ${p.background.sourcePage}`,String(i))]:[]);
    $('pdfChapters').replaceChildren(option(chapters.length?'Jump to a chapter':'No chapter destinations', ''),...chapters);
    $('pdfBookmarks').replaceChildren(option(bookmarks.length?'Jump to a bookmark':'No bookmarks yet', ''),...bookmarks);
    $('pdfChapters').disabled=!chapters.length;$('pdfBookmarks').disabled=!bookmarks.length;
    const toggle=$('pdfBookmarkToggle'),marked=session.bookmarks?.includes(page.id);
    toggle.disabled=!session.bookmarks||session.bookmarkBusy;
    toggle.textContent=marked?'Remove bookmark':'Bookmark this page';
  }
  async function loadBookmarks(session){
    if(session.bookmarks||session.bookmarkBusy)return;
    session.bookmarkBusy=true;const scope=api.scope();
    try{
      const entries=await api.read(bookmarkKey,scope);
      session.bookmarks=(Array.isArray(entries)?entries:[]).filter(entry=>entry.book===session.book).map(entry=>entry.page);
    }catch(error){if(valid(session))$('pdfBookmarkStatus').textContent=error.message;}
    finally{session.bookmarkBusy=false;if(valid(session))syncPlaces();}
  }
  async function toggleBookmark(){
    const session=ref(),page=current();
    if(!session?.bookmarks||session.bookmarkBusy||!api.ready())return;
    const scope=api.scope(),marked=session.bookmarks.includes(page.id);
    session.bookmarkBusy=true;syncPlaces();
    try{
      const entries=await api.update(bookmarkKey,scope,list=>{
        const remaining=list.filter(entry=>entry.book!==session.book||entry.page!==page.id);
        return marked?remaining:[...remaining,{book:session.book,page:page.id}];
      });
      session.bookmarks=entries.filter(entry=>entry.book===session.book).map(entry=>entry.page);
      if(valid(session))$('pdfBookmarkStatus').textContent=marked?'Bookmark removed.':'Bookmark saved on this device.';
    }catch(error){if(valid(session))$('pdfBookmarkStatus').textContent=error.message;}
    finally{session.bookmarkBusy=false;if(valid(session))syncPlaces();}
  }
  function syncLinks(){
    const session=ref(),source=current(),list=$('pdfBacklinks');
    list.replaceChildren();
    if(!source)return;
    const fragment=document.createDocumentFragment();
    let count=0;
    for(const book of api.books())for(const [index,page] of book.pages.entries())for(const item of page.items){
      const link=item.pageLink;
      if(link?.page!==source.id||(link.book||book.id)!==session.book)continue;
      count++;
      const entry=document.createElement('li');
      const preview=item.type==='text'?item.text.trim().replace(/\s+/g,' ').slice(0,80):item.type==='image'?'Figure':'Linked object';
      entry.append(button(`${book.title} · Page ${index+1}${preview?' · '+preview:''}`,()=>{
        if(api.ready()&&valid(session,source)&&!api.navigate(book.id,page.id,item.id))api.toast('This note is no longer available.');
      }));
      fragment.append(entry);
    }
    list.append(fragment);
    $('pdfLinksStatus').textContent=count?`${count} linked ${count===1?'object':'objects'} in this workspace`:'No notes or figures link to this page yet.';
  }
  function showPanel(name){
    const session=ref();if(!session)return;
    session.panel=session.panel===name?null:name;
    syncPanels();
    if(session.panel==='search')$('pdfSearchQuery').focus();
  }
  function syncPanels(){
    const session=ref();
    for(const [name,prefix] of Object.entries(panels)){
      const open=session?.panel===name;
      $(prefix+'Panel').hidden=!open;$(prefix+'Toggle').setAttribute('aria-expanded',String(open));
    }
    if(session?.panel==='places'){syncPlaces();loadBookmarks(session);}
    if(session?.panel==='links')syncLinks();
  }
  function onTab(){
    const session=ref();
    $('pdfSearchQuery').value=session?.search?.query||'';
    $('pdfBookmarkStatus').textContent='';
    updateSearch();syncPanels();
  }
  function onPage(){
    clearText();
    const session=ref();
    if(session)session.regions=null;
    if(session?.panel==='places')syncPlaces();
    if(session?.panel==='links')syncLinks();
    paintHighlights();
  }
  function follow(region){
    const session=ref();if(!session)return;
    session.regions=region;paintHighlights();scrollToBox(region[0]);
  }

  function organize(){
    if(!api.ready())return;
    const book=api.book();
    const original=book.pages.map(page=>({id:page.id,turn:page.background?.turn||0}));
    organizer={scope:api.scope(),original,order:original.map(row=>({...row})),checked:new Set()};
    $('organizerStatus').textContent='';
    renderOrganizer();$('pageOrganizer').showModal();
  }
  function renderOrganizer(focus){
    const session=organizer,book=api.book(),pages=new Map(book.pages.map(page=>[page.id,page]));
    const list=$('organizerPages'),fragment=document.createDocumentFragment(),scroll=list.scrollTop;
    let focusButton;
    const action=(label,aria,row,kind,fn)=>{
      const control=button(label,()=>{
        fn();renderOrganizer({id:row.id,kind});
      },aria);
      if(focus?.id===row.id&&focus.kind===kind)focusButton=control;
      return control;
    };
    for(const [index,row] of session.order.entries()){
      const page=pages.get(row.id);if(!page)continue;
      const entry=document.createElement('li');entry.className='organizer-page';
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';
      check.checked=session.checked.has(row.id);
      check.onchange=()=>{if(check.checked)session.checked.add(row.id);else session.checked.delete(row.id);organizerButtons();};
      const title=`Page ${index+1}`;
      const detail=page.background?` · PDF ${page.background.sourcePage}${row.turn?' · '+row.turn+'°':''}`:'';
      label.append(check,title+detail);
      const move=(delta)=>{
        const neighbor=index+delta;
        [session.order[index],session.order[neighbor]]=[session.order[neighbor],session.order[index]];
      };
      const up=action('↑',`Move ${title.toLowerCase()} up`,row,'up',()=>move(-1));
      const down=action('↓',`Move ${title.toLowerCase()} down`,row,'down',()=>move(1));
      up.disabled=index===0;down.disabled=index===session.order.length-1;
      entry.append(label,up,down);
      if(page.background){
        const rotate=action('↻',`Rotate ${title.toLowerCase()} clockwise`,row,'rotate',()=>{row.turn=(row.turn+90)%360;});
        entry.append(rotate);
      }
      fragment.append(entry);
    }
    list.replaceChildren(fragment);list.scrollTop=scroll;
    if(focusButton?.disabled)focusButton=focusButton.parentElement.querySelector('button:not(:disabled)');
    focusButton?.focus({preventScroll:true});organizerButtons();
  }
  function organizerButtons(){
    const session=organizer;if(!session)return;
    $('organizerExtract').disabled=$('organizerExport').disabled=session.busy||!session.checked.size;
    $('organizerExportAnnotated').disabled=session.busy||!api.book()?.pages.some(p=>p.items.length);
    $('organizerApply').disabled=session.busy||!session.order.some((row,i)=>row.id!==session.original[i].id||row.turn!==session.original[i].turn);
    $('organizerPages').inert=Boolean(session.busy);
    for(const id of ['organizerAll','organizerAnnotated','organizerNone'])$(id).disabled=Boolean(session.busy);
  }
  function choosePages(mode){
    if(!organizer||organizer.busy)return;
    organizer.checked=new Set(api.book().pages.filter(p=>mode==='all'||(mode==='annotated'&&p.items.length)).map(p=>p.id));
    renderOrganizer();
  }
  async function organizerAction(mode){
    const session=organizer;
    if(!session||session.busy)return;
    session.busy=true;organizerButtons();const status=$('organizerStatus');
    status.textContent=mode.startsWith('export')?'Preparing PDF…':'Saving pages…';
    try{
      const result=await api.organize(session,mode);
      if(organizer!==session)return;
      if(mode==='apply')$('pageOrganizer').close();
      else status.textContent=result;
    }catch(error){if(organizer===session)status.textContent=error.message||'Could not organize these pages.';}
    finally{if(organizer===session){session.busy=false;organizerButtons();}}
  }
  function init(adapter,reference){
    api=adapter;reader=reference;
    for(const [name,prefix] of Object.entries(panels))$(prefix+'Toggle').onclick=()=>showPanel(name);
    $('pdfSearchPanel').onsubmit=startSearch;$('pdfSearchStop').onclick=()=>stopSearch();
    $('pdfHitPrev').onclick=()=>seek(ref().search.index-1);$('pdfHitNext').onclick=()=>seek(ref().search.index+1);
    $('pdfChapters').onchange=$('pdfBookmarks').onchange=event=>{if(event.target.value!=='')reader.setPage(Number(event.target.value));};
    $('pdfBookmarkToggle').onclick=toggleBookmark;
    $('pdfSelectText').onclick=selectText;
    for(const [id,action] of [['pdfInsertQuote','insert'],['pdfCopyQuote','copy'],['pdfMakeCard','card']]){
      $(id).onpointerdown=event=>{pressedQuote=captureQuote();if(pressedQuote)event.preventDefault();};
      $(id).onpointercancel=()=>{pressedQuote=null;};
      $(id).onclick=()=>quoteAction(action);
    }
    document.addEventListener('selectionchange',()=>{
      if(!ref()?.textWords)return;
      $('pdfInsertQuote').disabled=$('pdfCopyQuote').disabled=$('pdfMakeCard').disabled=!pressedQuote&&!selectionData();
    });
    bindTextSelection();
    new ResizeObserver(resizeText).observe($('studyPdfImage'));
    $('organizerAll').onclick=()=>choosePages('all');
    $('organizerAnnotated').onclick=()=>choosePages('annotated');
    $('organizerNone').onclick=()=>choosePages('none');
    $('organizerApply').onclick=()=>organizerAction('apply');
    $('organizerExtract').onclick=()=>organizerAction('extract');
    $('organizerExport').onclick=()=>organizerAction('export');
    $('organizerExportAnnotated').onclick=()=>organizerAction('exportAnnotated');
    $('pageOrganizer').onclose=()=>{if(!$('pageOrganizer').open)organizer=null;};
  }
  function close(){
    $('pageOrganizer').close();organizer=null;
  }
  global.WindsPdfStudy=Object.freeze({init,stopSearch,clearText,onTab,onPage,follow,captureQuote,organize,close});
})(window);
