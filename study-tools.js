/* Notebook links, reusable pages, PDF references and presentation controls. */
(function(global){
  'use strict';
  const $=id=>document.getElementById(id);
  let api,linkEdit,templateEdit,reference,presentation;
  const pdfStudy=global.WindsPdfStudy,tabs=new Map();
  const templatesKey='personal-page-templates-v1';
  const pdfZoomMin=50,pdfZoomMax=400;
  const splitMin=30,splitMax=70;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const layoutBusy=()=>api.layoutBusy()||Boolean(reference?.drag)||reference?.transfer!=null;
  function optionList(select,entries){
    select.replaceChildren(...entries.map(([value,label])=>new Option(label,value)));
  }
  function pageLabel(page,index){
    return page.background?`Page ${index+1} · PDF page ${page.background.sourcePage}`:`Page ${index+1}`;
  }
  function closeDialog(id){const dialog=$(id);if(dialog.open)dialog.close();}
  function openLink(){
    const item=api.selected();if(!item||!api.ready())return;
    linkEdit={scope:api.scope(),item};
    optionList($('linkBook'),api.books().map(book=>[book.id,book.title]));
    const {pageLink}=item;
    const book=api.books().find(book=>book.id===(pageLink?.book||linkEdit.scope.book));
    $('linkBook').value=book?.id||linkEdit.scope.book;
    linkPages();
    if(book?.pages.some(p=>p.id===pageLink?.page))$('linkPage').value=pageLink.page;
    else if(book?.id===linkEdit.scope.book&&book.pages.length>1){
      const current=book.pages.findIndex(page=>page.id===linkEdit.scope.page);
      $('linkPage').selectedIndex=current+1<book.pages.length?current+1:0;
    }
    $('removePageLink').hidden=!pageLink;
    $('pageLinkDialog').showModal();
  }
  function linkPages(){
    const book=api.books().find(book=>book.id===$('linkBook').value);
    optionList($('linkPage'),book?.pages.map((page,index)=>[page.id,pageLabel(page,index)])||[]);
  }
  function commitLink(remove=false){
    const edit=linkEdit;
    if(!edit)return;
    const book=$('linkBook').value,page=$('linkPage').value;
    if(!remove&&!api.books().some(b=>b.id===book&&b.pages.some(p=>p.id===page)))return;
    closeDialog('pageLinkDialog');
    const link=remove?null:{page,...(book!==edit.scope.book?{book}:{})};
    const previous=edit.item.pageLink;
    if(link&&previous?.pdfRegion&&previous.page===page&&(previous.book||edit.scope.book)===book)link.pdfRegion=previous.pdfRegion;
    if(api.setLink(edit,link))api.toast(remove?'Page link removed':'Page link saved');
  }
  function follow(item=api.selected()){
    const link=item?.pageLink;
    if(!link)return;
    const bookId=link.book||api.scope().book;
    if(link.pdfRegion&&api.books().some(book=>book.id===bookId&&book.pages.some(p=>p.id===link.page&&p.background))){
      const target=showReference(bookId,link.page);
      if(target)pdfStudy.follow(link.pdfRegion);
      return;
    }
    if(!api.navigate(bookId,link.page))api.toast('The linked page is unavailable in this workspace.');
  }
  function syncSelection(item){
    const button=$('followPageLink');
    if(button)button.hidden=!item?.pageLink;
  }
  async function openTemplates(){
    if(!api.ready()||templateEdit)return;
    const edit=templateEdit={scope:api.scope(),entries:[],busy:true};
    $('pageTemplateName').value='';optionList($('pageTemplateList'),[]);showTemplates(edit,'Loading templates…');
    $('pageTemplatesDialog').showModal();
    try{
      const stored=await api.read(templatesKey,edit.scope);
      if(edit!==templateEdit)return;
      edit.entries=Array.isArray(stored)?stored:[];
      edit.busy=false;showTemplates(edit);
    }catch(error){
      if(edit===templateEdit)showTemplates(edit,error.message);
    }
  }
  function showTemplates(edit,message){
    const select=$('pageTemplateList'),current=select.value;
    optionList(select,edit.entries.map(({id,name})=>[id,name]));
    if(edit.entries.some(entry=>entry.id===current))select.value=current;
    else if(edit.entries.length)select.selectedIndex=0;
    templateButtons(edit);
    $('templateStatus').textContent=message??(edit.entries.length?'Templates are saved on this device.':'No saved templates on this device.');
  }
  function templateButtons(edit){
    $('deletePageTemplate').disabled=$('insertPageTemplate').disabled=edit.busy||!$('pageTemplateList').value;
    $('pageTemplateForm').querySelector('button').disabled=edit.busy;
  }
  async function changeTemplates(remove){
    const edit=templateEdit;
    if(!edit||edit.busy||!api.matches(edit.scope))return;
    const name=$('pageTemplateName').value.trim(),id=$('pageTemplateList').value;
    try{
      if(!remove&&!name)return;
      const entry=remove?null:{id:api.id(),name,...api.capturePage()};
      edit.busy=true;templateButtons(edit);
      edit.entries=await api.update(templatesKey,edit.scope,current=>{
        if(remove)return current.filter(item=>item.id!==id);
        if(current.length>=50)throw Error('Delete a saved template to make room for another.');
        if(current.reduce((total,item)=>total+(item.bytes??JSON.stringify(item.page).length),entry.bytes)>50*1024*1024)
          throw Error('The template library is full. Delete a template to make room.');
        return [...current,entry];
      });
      if(edit!==templateEdit)return;
      edit.busy=false;
      if(!remove)$('pageTemplateName').value='';
      showTemplates(edit,remove?'Template deleted':'Template saved on this device');
      if(entry)$('pageTemplateList').value=entry.id;
    }catch(error){
      if(edit===templateEdit){edit.busy=false;showTemplates(edit,error.message);}
    }
  }
  function insertTemplate(){
    const edit=templateEdit,entry=edit?.entries.find(item=>item.id===$('pageTemplateList').value);
    if(!entry||edit.busy||!api.matches(edit.scope))return;
    closeDialog('pageTemplatesDialog');
    try{api.insertPage(entry.page);}catch(error){api.toast(error.message);}
  }
  function openSource(){
    if(!api.ready())return;
    const books=api.books().filter(book=>book.pages.some(page=>page.background));
    optionList($('studySource'),books.map(book=>[book.id,book.title]));
    if(books.some(book=>book.id===api.scope().book))$('studySource').value=api.scope().book;
    $('openStudySource').disabled=!books.length;
    $('studySourceDialog').showModal();
  }
  function closeReference(){
    tabs.clear();
    $('pdfToolsMenu').hidden=true;$('pdfToolsToggle').setAttribute('aria-expanded','false');
    if(!reference)return;
    const divider=$('studyDivider'),pane=$('studyPane');
    suspendReference();
    reference=null;
    divider.hidden=pane.hidden=true;
    pane.style.removeProperty('--study-split');
    $('studyPdfImage').removeAttribute('src');
    $('editorView').classList.remove('has-study-pane');
    api.layout();
  }
  function suspendReference(){
    const divider=$('studyDivider'),scroll=$('studyPdfScroll');
    const {splitFrame,splitDrag}=reference;
    if(splitFrame)cancelAnimationFrame(splitFrame);
    if(splitDrag&&divider.hasPointerCapture(splitDrag.id))divider.releasePointerCapture(splitDrag.id);
    reference.splitFrame=0;reference.splitDrag=null;
    reference.scroll={left:scroll.scrollLeft,top:scroll.scrollTop};
    pdfStudy.stopSearch(reference);pdfStudy.clearText();global.WindsPdfInk.close();
  }
  function renderTabs(){
    const current=$('pdfTabs'),fragment=document.createDocumentFragment();
    for(const tab of tabs.values()){
      const button=document.createElement('button');button.type='button';button.className='btn btn-outline';
      button.textContent=button.title=tab.title;
      button.setAttribute('aria-pressed',String(tab===reference));
      button.onclick=()=>{if(showReference(tab.book))current.querySelector('[aria-pressed="true"]')?.focus();};
      fragment.append(button);
    }
    current.replaceChildren(fragment);
    $('closePdfTab').hidden=tabs.size<2;
    const active=current.querySelector('[aria-pressed="true"]');
    if(active)current.scrollLeft=Math.max(0,active.offsetLeft-current.firstChild.offsetLeft-current.clientWidth/2);
  }
  function closeCurrentTab(){
    if(!reference)return;
    tabs.delete(reference.book);
    const available=new Set(api.books().filter(book=>book.pages.some(p=>p.background)).map(book=>book.id));
    for(const id of tabs.keys())if(!available.has(id))tabs.delete(id);
    const next=[...tabs.keys()].at(-1);
    if(!next||!showReference(next))closeReference();
  }
  function showReference(bookId,targetId){
    if(!api.ready())return null;
    const book=api.books().find(book=>book.id===bookId);
    const pages=book?.pages.filter(page=>page.background);
    if(!pages?.length){api.toast('This PDF is no longer available.');return null;}
    closeDialog('studySourceDialog');
    const pane=$('studyPane'),divider=$('studyDivider'),body=$('editorView').querySelector('.editor-body');
    const opening=!reference,priorSplit=reference?.split;
    let tab=tabs.get(bookId);
    if(!tab){
      tab={account:api.scope().account,book:bookId,pages,index:0,zoom:100};
      tabs.set(bookId,tab);
    }
    if(reference&&reference!==tab)suspendReference();
    const sameTab=reference===tab;
    reference=tab;tab.title=book.title;tab.split=priorSplit;
    const oldId=opening&&bookId===api.scope().book?api.scope().page:tab.pages[tab.index]?.id;
    if(tab.pages.length!==pages.length||tab.pages.some((p,i)=>p.id!==pages[i].id||p.background!==pages[i].background)){
      pdfStudy.stopSearch(tab);tab.search=null;
      tab.pages=pages;
    }
    if(opening)body.append(divider,pane);
    divider.hidden=pane.hidden=false;
    $('editorView').classList.add('has-study-pane');
    $('studyPdfName').textContent=book.title;
    renderTabs();
    optionList($('studyPdfPage'),pages.map((page,index)=>[String(index),`${index+1} · PDF page ${page.background.sourcePage}`]));
    setPdfZoom(tab.zoom);
    syncNotesZoom(api.notesZoom());
    const index=Math.max(0,pages.findIndex(p=>p.id===(targetId||oldId)));
    if(!sameTab||targetId||tab.pages===pages)setReferencePage(index);
    const source=tab.pages[index];
    if(!sameTab&&!targetId&&tab.scroll){
      const scroll=$('studyPdfScroll'),image=$('studyPdfImage');
      const restore=()=>{if(reference===tab&&tab.pages[tab.index]===source)scroll.scrollTo(tab.scroll.left,tab.scroll.top);};
      if(image.complete)requestAnimationFrame(restore);else image.addEventListener('load',restore,{once:true});
    }
    pdfStudy.onTab();
    syncDivider();
    if(opening)api.layout();
    return tab;
  }
  function setReferencePage(index){
    if(!reference)return;
    global.WindsPdfInk.setPage();
    reference.index=clamp(index,0,reference.pages.length-1);
    const background=reference.pages[reference.index].background,image=$('studyPdfImage');
    reference.box=null;reference.drag=null;reference.transfer=null;reference.picking=false;
    $('studyPdfPage').value=String(reference.index);
    $('studyPdfPrevious').disabled=reference.index===0;
    $('studyPdfNext').disabled=reference.index===reference.pages.length-1;
    $('studyPdfStatus').textContent='';
    const scroller=$('studyPdfScroll');
    scroller.scrollTop=0;scroller.scrollLeft=0;
    const surface=$('studyPdfSurface'),{turn=0,width,height}=background;
    const sideways=turn%180!==0;
    surface.toggleAttribute('data-turned',Boolean(turn));
    surface.style.aspectRatio=sideways?`${height}/${width}`:`${width}/${height}`;
    surface.style.setProperty('--pdf-turn',`${turn}deg`);
    surface.style.setProperty('--pdf-content-width',sideways?`${width*100/height}%`:'100%');
    image.alt=`${background.sourceName}, page ${background.sourcePage}`;
    image.src=background.src;showFigure();pdfStudy.onPage();global.WindsPdfInk.refresh();
  }
  function setPdfZoom(value){
    if(!reference||reference.drag||reference.transfer!=null)return;
    const scroller=$('studyPdfScroll'),surface=$('studyPdfSurface');
    const center=()=>({x:scroller.scrollLeft+scroller.clientWidth/2,y:scroller.scrollTop+scroller.clientHeight/2});
    const before=center();
    const ratioX=clamp((before.x-surface.offsetLeft)/(surface.offsetWidth||1),0,1);
    const ratioY=clamp((before.y-surface.offsetTop)/(surface.offsetHeight||1),0,1);
    const zoom=reference.zoom=clamp(value,pdfZoomMin,pdfZoomMax);
    surface.style.setProperty('--pdf-zoom',`${zoom}%`);
    $('studyPdfZoomValue').value=`${zoom}%`;
    $('pdfQuickZoom').textContent=`${Math.round(zoom)}%`;
    $('studyPdfZoomOut').disabled=zoom===pdfZoomMin;
    $('studyPdfZoomIn').disabled=zoom===pdfZoomMax;
    scroller.scrollLeft=surface.offsetLeft+surface.offsetWidth*ratioX-scroller.clientWidth/2;
    scroller.scrollTop=surface.offsetTop+surface.offsetHeight*ratioY-scroller.clientHeight/2;
  }
  function syncNotesZoom(zoom){
    if(!reference)return;
    $('studyNotesZoomValue').value=`${Math.round(zoom*100)}%`;
    $('studyNotesZoomOut').disabled=zoom<=.35;
    $('studyNotesZoomIn').disabled=zoom>=8;
  }
  const stacked=()=>global.matchMedia('(max-width: 670px)').matches;
  function syncDivider(){
    if(!reference)return;
    const divider=$('studyDivider');
    divider.setAttribute('aria-orientation',stacked()?'horizontal':'vertical');
    divider.setAttribute('aria-valuenow',String(reference.split??(stacked()?42:36)));
    divider.setAttribute('aria-valuetext',`${divider.getAttribute('aria-valuenow')} percent PDF`);
  }
  function setSplit(value){
    const ref=reference;if(!ref)return;
    ref.nextSplit=clamp(Math.round(value),splitMin,splitMax);
    if(ref.splitFrame)return;
    const apply=()=>{
      ref.splitFrame=0;
      if(reference!==ref)return;
      if(layoutBusy()){ref.splitFrame=requestAnimationFrame(apply);return;}
      if(ref.split===ref.nextSplit)return;
      ref.split=ref.nextSplit;
      api.layout(()=>$('studyPane').style.setProperty('--study-split',`${ref.split}%`));
      syncDivider();
    };
    ref.splitFrame=requestAnimationFrame(apply);
  }
  function bindStudyView(){
    $('studyPdfZoomOut').onclick=()=>{if(reference)setPdfZoom(reference.zoom-25);};
    $('studyPdfZoomIn').onclick=()=>{if(reference)setPdfZoom(reference.zoom+25);};
    $('studyPdfZoomFit').onclick=()=>setPdfZoom(100);
    $('studyNotesZoomOut').onclick=()=>api.zoomNotes(api.notesZoom()-.25);
    $('studyNotesZoomIn').onclick=()=>api.zoomNotes(api.notesZoom()+.25);
    $('studyNotesZoomFit').onclick=()=>api.zoomNotes(1);
    const divider=$('studyDivider');
    divider.onpointerdown=event=>{
      if(!reference||reference.splitDrag||event.button!==0||layoutBusy())return;
      divider.setPointerCapture(event.pointerId);
      const vertical=stacked(),body=divider.parentElement,rect=body.getBoundingClientRect();
      const pane=$('studyPane').getBoundingClientRect();
      reference.splitDrag={id:event.pointerId,vertical,extent:vertical?rect.height:rect.width,
        size:vertical?pane.height:pane.width,start:vertical?event.clientY:event.clientX};
      divider.focus({preventScroll:true});event.preventDefault();
    };
    divider.onpointermove=event=>{
      const drag=reference?.splitDrag;
      if(drag?.id!==event.pointerId)return;
      const position=drag.vertical?event.clientY:event.clientX;
      setSplit((drag.size+drag.start-position)*100/drag.extent);
    };
    const end=event=>{if(reference?.splitDrag?.id===event.pointerId)reference.splitDrag=null;};
    divider.onpointerup=event=>{divider.onpointermove(event);end(event);};
    divider.onpointercancel=divider.onlostpointercapture=end;
    divider.onkeydown=event=>{
      if(!reference||event.altKey||event.metaKey||event.ctrlKey)return;
      const grow=stacked()?'ArrowUp':'ArrowLeft',shrink=stacked()?'ArrowDown':'ArrowRight';
      const current=reference.nextSplit??Number(divider.getAttribute('aria-valuenow'));
      if(event.key===grow)setSplit(current+5);
      else if(event.key===shrink)setSplit(current-5);
      else if(event.key==='Home')setSplit(splitMin);
      else if(event.key==='End')setSplit(splitMax);
      else return;
      event.preventDefault();
    };
    global.addEventListener('resize',syncDivider,{passive:true});
  }
  function showFigure(){
    const box=reference?.box,marker=$('studyFigureBox');
    $('studyPdfSurface').classList.toggle('select-figure',Boolean(reference?.picking));
    $('pickStudyFigure').setAttribute('aria-pressed',String(Boolean(reference?.picking)));
    marker.hidden=!box;$('insertStudyFigure').disabled=!box||Boolean(reference?.picking);
    if(box)Object.assign(marker.style,{left:`${box.x*100}%`,top:`${box.y*100}%`,width:`${box.w*100}%`,height:`${box.h*100}%`});
    global.WindsPdfInk.refresh();
  }
  function figurePoint(event){
    const r=$('studyPdfImage').getBoundingClientRect();
    const turn=reference.pages[reference.index].background.turn||0;
    const [x,y]=global.WindsPdfText.turnPoint(clamp((event.clientX-r.left)/r.width,0,1),
      clamp((event.clientY-r.top)/r.height,0,1),(360-turn)%360);
    return {x,y};
  }
  async function insertFigure(drop){
    const ref=reference,box=ref?.box,image=$('studyPdfImage');
    if(!box||ref.inserting||!image.naturalWidth||ref.account!==api.scope().account)return;
    const source=ref.pages[ref.index],scope=api.scope();
    ref.inserting=true;
    const canvas=document.createElement('canvas');
    try{
      const w=box.w*image.naturalWidth,h=box.h*image.naturalHeight,scale=Math.min(1,1600/Math.max(w,h));
      canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
      const ctx=canvas.getContext('2d');
      ctx.drawImage(image,box.x*image.naturalWidth,box.y*image.naturalHeight,w,h,0,0,canvas.width,canvas.height);
      const src=canvas.toDataURL('image/png');
      const pasted=await api.loadImage(src);
      if(reference!==ref||ref.pages[ref.index]!==source||!api.matches(scope)||!api.ready())return;
      if(!api.books().some(book=>book.id===ref.book&&book.pages.some(page=>page.id===source.id)))
        throw Error('The source page was removed. Open another PDF reference.');
      api.insertFigure(src,pasted,scope,{page:source.id,book:ref.book,pdfRegion:[[box.x,box.y,box.w,box.h]]},drop);
      $('studyPdfStatus').textContent='Figure inserted with a link to its PDF page.';
    }catch(error){if(reference===ref)$('studyPdfStatus').textContent=error.message||'Could not insert this figure.';}
    finally{ref.inserting=false;canvas.width=canvas.height=1;}
  }
  function bindReference(){
    bindStudyView();
    const menu=$('pdfToolsMenu'),toggle=$('pdfToolsToggle');
    const closeTools=()=>{menu.hidden=true;toggle.setAttribute('aria-expanded','false');};
    toggle.onclick=()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));};
    $('pdfQuickZoom').onclick=()=>setPdfZoom(100);
    menu.addEventListener('click',event=>{
      if(event.target.closest('.pdf-reading-actions,#pickStudyFigure,#insertStudyFigure,#closePdfTab'))closeTools();
    });
    document.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!toggle.contains(event.target))closeTools();},{passive:true});
    $('studyPane').addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!menu.hidden){event.preventDefault();closeTools();toggle.focus();}
    });
    $('openStudySource').onclick=()=>showReference($('studySource').value);
    $('importStudyPdf').onclick=()=>{closeDialog('studySourceDialog');api.importReference();};
    $('closeStudyPane').onclick=()=>{closeTools();closeReference();};
    $('addPdfTab').onclick=openSource;
    $('closePdfTab').onclick=closeCurrentTab;
    $('studyPdfPage').onchange=event=>setReferencePage(Number(event.target.value));
    $('studyPdfPrevious').onclick=()=>setReferencePage(reference.index-1);
    $('studyPdfNext').onclick=()=>setReferencePage(reference.index+1);
    $('studyPdfImage').onerror=()=>{$('studyPdfStatus').textContent='This PDF page could not be displayed.';};
    $('pickStudyFigure').onclick=()=>{
      if(!reference||!$('studyPdfImage').naturalWidth)return;
      pdfStudy.clearText();
      reference.picking=!reference.picking;
      if(reference.picking){reference.box=null;$('studyPdfStatus').textContent='Drag around the figure you want to insert.';}
      showFigure();
    };
    $('insertStudyFigure').onclick=()=>insertFigure();
    const surface=$('studyPdfSurface');
    surface.onpointerdown=event=>{
      if(!reference?.picking||reference.drag||event.button!==0)return;
      surface.setPointerCapture(event.pointerId);
      event.preventDefault();reference.drag={id:event.pointerId,start:figurePoint(event)};
    };
    function updateBox(event){
      if(reference?.drag?.id!==event.pointerId)return;
      const {start}=reference.drag,end=figurePoint(event);
      reference.box={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)};
      showFigure();
    }
    surface.onpointermove=updateBox;
    surface.onpointerup=event=>{
      if(reference?.drag?.id!==event.pointerId)return;
      updateBox(event);reference.drag=null;
      const box=reference.box,image=$('studyPdfImage');
      if(box.w*image.offsetWidth<8||box.h*image.offsetHeight<8)reference.box=null;
      else{reference.picking=false;$('studyPdfStatus').textContent='Drag the selection onto the notebook or choose Insert figure.';}
      showFigure();
    };
    const cancel=event=>{if(reference?.drag?.id===event.pointerId){reference.drag=null;reference.box=null;showFigure();}};
    surface.onpointercancel=surface.onlostpointercapture=cancel;
    const type='application/x-winds-pdf-figure';
    const marker=$('studyFigureBox');
    marker.ondragstart=event=>{
      if(!reference?.box||reference.picking){event.preventDefault();return;}
      event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData(type,'figure');
    };
    marker.onpointerdown=event=>{
      if(event.pointerType==='mouse'||event.button!==0||!reference?.box||reference.picking||reference.transfer!=null)return;
      event.preventDefault();event.stopPropagation();
      marker.setPointerCapture(event.pointerId);
      reference.transfer=event.pointerId;
    };
    marker.onpointerup=event=>{
      if(reference?.transfer!==event.pointerId)return;
      reference.transfer=null;
      const x=event.clientX,y=event.clientY,r=$('inkCanvas').getBoundingClientRect();
      if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom&&document.elementFromPoint(x,y)===$('inkCanvas'))
        insertFigure({x,y});
    };
    marker.onpointercancel=marker.onlostpointercapture=event=>{
      if(reference?.transfer===event.pointerId)reference.transfer=null;
    };
    $('pageShell').addEventListener('dragover',event=>{
      if(reference?.box&&Array.from(event.dataTransfer.types).includes(type)){
        event.preventDefault();event.dataTransfer.dropEffect='copy';
      }
    });
    $('pageShell').addEventListener('drop',event=>{
      if(reference?.box&&event.dataTransfer.getData(type)==='figure'){
        event.preventDefault();insertFigure({x:event.clientX,y:event.clientY});
      }
    });
  }
  function startPresentation(){
    if(!api.ready())return;
    if(presentation){$('presentHere').focus();return;}
    const book=api.book();
    const scope=api.scope();
    presentation={scope,pageId:scope.page,index:book.pages.findIndex(p=>p.id===scope.page),count:null,frame:0,revision:0};
    $('presentationDialog').show();
    $('presentHere').focus();
    updatePresentation();
  }
  function presentationPage(){
    const book=api.book();
    if(!presentation||book?.id!==presentation.scope.book||api.scope().account!==presentation.scope.account)return null;
    const match=book.pages.findIndex(page=>page.id===presentation.pageId);
    const index=match>=0?match:clamp(presentation.index,0,book.pages.length-1);
    return {page:book.pages[index],index,total:book.pages.length};
  }
  function closePresentation(){
    const session=presentation;presentation=null;
    if(session){
      if(session.frame)cancelAnimationFrame(session.frame);
      clearTimeout(session.laserTimer);
      if(session.window&&!session.window.closed)session.window.close();
    }
    hideStage();closeDialog('presentationDialog');
    $('presentPreviewLaser').hidden=true;
    for(const id of ['presentPreview','presentationCanvas'])$(id).width=$(id).height=1;
  }
  function hideStage(){
    const stage=$('presentationStage');
    if(document.fullscreenElement===stage)document.exitFullscreen?.()?.catch(()=>{});
    stage.hidden=true;$('presentationLaser').hidden=true;
    if($('presentationDialog').open)$('presentHere').focus();
  }
  function queuePresentation(){
    const session=presentation;if(!session||session.frame)return;
    session.frame=requestAnimationFrame(async()=>{
      session.frame=0;
      const current=presentationPage();
      if(!current||session!==presentation)return;
      const revision=++session.revision;
      const valid=()=>session===presentation&&session.revision===revision&&presentationPage()?.page===current.page;
      try{
        await api.preparePage(current.page,valid);
        if(!valid())return;
        const count=session.count??current.page.items.length;
        for(const canvas of [$('presentPreview'),!$('presentationStage').hidden?$('presentationCanvas'):null,session.window?.closed?null:session.canvas]){
          if(canvas)api.paintPage(canvas,current.page,count,canvas.id==='presentPreview'?360:1000);
        }
      }catch(error){if(valid())$('presentStatus').textContent=error.message||'Could not display this page.';}
    });
  }
  function updatePresentation(){
    const current=presentationPage();if(!current)return;
    presentation.index=current.index;presentation.pageId=current.page.id;
    const max=current.page.items.length,count=clamp(presentation.count??max,0,max);
    if(presentation.count!==null)presentation.count=count;
    $('presentPage').textContent=`Page ${current.index+1} of ${current.total}`;
    $('presentStep').max=max;$('presentStep').value=count;
    $('presentStepCount').textContent=`${count} of ${max}`;
    $('presentPrevious').disabled=$('presentStagePrev').disabled=current.index===0;
    $('presentNext').disabled=$('presentStageNext').disabled=current.index+1===current.total;
    $('presentReveal').disabled=$('presentStageReveal').disabled=count>=max;
    queuePresentation();
  }
  function presentMove(delta){
    const current=presentationPage();if(!current)return;
    presentation.index=clamp(current.index+delta,0,current.total-1);
    presentation.pageId=api.book().pages[presentation.index].id;
    presentation.count=null;updatePresentation();
  }
  function presentCount(value){
    const current=presentationPage();if(!current)return;
    presentation.count=clamp(value,0,current.page.items.length);updatePresentation();
  }
  function openProjector(){
    if(!presentation)return;
    if(presentation.window&&!presentation.window.closed){presentation.window.focus();return;}
    const popup=global.open('','_blank','popup,width=1100,height=800');
    if(!popup){$('presentStatus').textContent='The browser blocked the projector window. Choose Present here or allow pop-ups for WiNDS Notes.';return;}
    try{
      const doc=popup.document;
      popup.opener=null;
      doc.title='WiNDS Notes · Presentation';
      const style=doc.createElement('style');
      style.textContent='body{margin:0;background:#141521;display:grid;place-items:center;height:100vh;overflow:hidden}main{position:relative;line-height:0}canvas{display:block;max-width:100vw;max-height:100vh;width:auto;height:auto;object-fit:contain;touch-action:none}span{position:absolute;pointer-events:none;width:14px;height:14px;border-radius:50%;background:#ff3259;box-shadow:0 0 10px 3px #ff3259;transform:translate(-50%,-50%)}';
      doc.head.append(style);
      const main=doc.createElement('main'),canvas=doc.createElement('canvas'),laser=doc.createElement('span');
      laser.hidden=true;canvas.setAttribute('aria-label','Presented notebook page');
      main.append(canvas,laser);doc.body.replaceChildren(main);
      Object.assign(presentation,{window:popup,canvas,laser});
      doc.addEventListener('keydown',presentKeys);
      bindLaser(canvas);
      $('presentStatus').textContent='Move the projector window to your display. Point on the preview to use the laser.';
      queuePresentation();
    }catch(error){popup.close();$('presentStatus').textContent='This browser could not open a separate projector window. Choose Present here.';}
  }
  function pointLaser(event){
    const session=presentation;
    if(!session)return;
    const rect=event.currentTarget.getBoundingClientRect();
    const x=clamp((event.clientX-rect.left)/rect.width,0,1),y=clamp((event.clientY-rect.top)/rect.height,0,1);
    const dots=[$('presentationLaser'),$('presentPreviewLaser'),session.window?.closed?null:session.laser];
    for(const dot of dots)if(dot){dot.style.left=`${x*100}%`;dot.style.top=`${y*100}%`;dot.hidden=false;}
    clearTimeout(session.laserTimer);
    session.laserTimer=setTimeout(()=>{for(const dot of dots)if(dot)dot.hidden=true;},650);
  }
  function bindLaser(canvas){
    canvas.onpointerdown=event=>{event.preventDefault();pointLaser(event);};
    canvas.onpointermove=event=>{if(event.buttons)pointLaser(event);};
  }
  function presentKeys(event){
    if(event.target.matches('input,button,select')&&event.key!=='Escape')return;
    if(event.key==='ArrowLeft')presentMove(-1);
    else if(event.key==='ArrowRight')presentMove(1);
    else if(event.key===' '){const current=presentationPage();if(current)presentCount((presentation.count??current.page.items.length)+1);}
    else if(event.key==='Escape'){if(!$('presentationStage').hidden)hideStage();else closePresentation();}
    else return;
    event.preventDefault();event.stopPropagation();
  }
  function bindPresentation(){
    $('presentHere').onclick=()=>{
      const stage=$('presentationStage');
      stage.hidden=false;stage.requestFullscreen?.()?.catch(()=>{});
      $('presentStageClose').focus();queuePresentation();
    };
    $('presentWindow').onclick=openProjector;
    $('presentPrevious').onclick=$('presentStagePrev').onclick=()=>presentMove(-1);
    $('presentNext').onclick=$('presentStageNext').onclick=()=>presentMove(1);
    $('presentStep').oninput=event=>presentCount(Number(event.target.value));
    $('presentReset').onclick=()=>presentCount(0);
    $('presentReveal').onclick=$('presentStageReveal').onclick=()=>$('presentStep').valueAsNumber<$('presentStep').max&&presentCount($('presentStep').valueAsNumber+1);
    $('presentStageClose').onclick=hideStage;
    $('presentationStage').onkeydown=$('presentationDialog').onkeydown=presentKeys;
    for(const id of ['presentPreview','presentationCanvas'])bindLaser($(id));
  }
  function bindLinkTaps(){
    const canvas=$('inkCanvas');
    let tap=null;
    canvas.addEventListener('pointerdown',event=>{
      if(!api.linksEnabled()||event.button!==0)return;
      if(tap){tap=null;return;}
      tap={id:event.pointerId,x:event.clientX,y:event.clientY,scope:api.scope()};
    },{passive:true});
    canvas.addEventListener('pointermove',event=>{
      if(tap?.id===event.pointerId&&Math.hypot(tap.x-event.clientX,tap.y-event.clientY)>6)tap=null;
    },{passive:true});
    for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{
      if(tap?.id===event.pointerId)tap=null;
    },{passive:true});
    canvas.addEventListener('pointerup',event=>{
      const start=tap;tap=null;
      if(!start||start.id!==event.pointerId||Math.hypot(start.x-event.clientX,start.y-event.clientY)>6)return;
      setTimeout(()=>{
        if(!api.linksEnabled()||!api.matches(start.scope)||!api.ready())return;
        const item=api.linkedAt(event);if(item?.pageLink)follow(item);
      },0);
    },{passive:true});
  }
  function init(adapter){
    api=adapter;
    global.WindsPdfInk.init(api.pdfInk,{
      current:()=>reference,setPage:setReferencePage,zoom:setPdfZoom,
      clearTools(){pdfStudy.clearText();if(reference){reference.picking=false;reference.box=null;showFigure();}}
    });
    pdfStudy.init(api,{
      current:()=>reference,setPage:setReferencePage,
      clearFigure(){if(reference){reference.picking=false;reference.box=null;showFigure();}}
    });
    for(const button of document.querySelectorAll('[data-close-study]'))button.onclick=()=>button.closest('dialog').close();
    $('pageLinkDialog').onclose=()=>{if(!$('pageLinkDialog').open)linkEdit=null;};
    $('pageTemplatesDialog').onclose=()=>{if(!$('pageTemplatesDialog').open)templateEdit=null;};
    $('presentationDialog').onclose=()=>{if(presentation&&!$('presentationDialog').open)closePresentation();};
    $('linkBook').onchange=linkPages;
    $('pageLinkForm').onsubmit=event=>{event.preventDefault();commitLink();};
    $('removePageLink').onclick=()=>commitLink(true);
    $('followPageLink').onclick=()=>follow();
    $('pageTemplateForm').onsubmit=event=>{event.preventDefault();changeTemplates(false);};
    $('pageTemplateList').onchange=()=>{if(templateEdit)templateButtons(templateEdit);};
    $('deletePageTemplate').onclick=()=>changeTemplates(true);
    $('insertPageTemplate').onclick=insertTemplate;
    bindReference();bindPresentation();bindLinkTaps();
  }
  function close(){
    closeDialog('pageLinkDialog');closeDialog('pageTemplatesDialog');closeDialog('studySourceDialog');
    closeReference();closePresentation();pdfStudy.close();
  }
  function refreshReference(){
    const tab=reference;if(!tab||!api.ready())return;
    const book=api.books().find(book=>book.id===tab.book),pages=book?.pages.filter(p=>p.background);
    if(!pages?.length){closeCurrentTab();return;}
    if(book.title!==tab.title||pages.length!==tab.pages.length||pages.some((p,i)=>p!==tab.pages[i]))
      showReference(tab.book);
    global.WindsPdfInk.refresh();
  }
  global.WindsStudy=Object.freeze({init,openLink,follow,syncSelection,openTemplates,openSource,showReference,refreshReference,startPresentation,close,updatePresentation,syncNotesZoom});
})(window);
