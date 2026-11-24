/* Continuous notebook pages. One writing canvas; nearby inactive previews only. */
(function(global){
  'use strict';
  let api,observer,bookId='',pages=[],visible=new Set(),dirty=new Set(),painting=false,timer=0,scrollTimer=0,generation=0,layoutWidth=0,lastScrollAt=0;
  const $=id=>document.getElementById(id),cards=new Map();
  const retained=new Map(),versions=new Map(),SCROLL_IDLE=180;
  let pagesById=new Map();
  function isScrolling(){return Boolean(api?.panActive?.()||Date.now()-lastScrollAt<SCROLL_IDLE);}
  function busy(){return api.busy()||isScrolling();}
  function markDirty(id){dirty.add(id);versions.set(id,(versions.get(id)||0)+1);}
  function retain(id){
    retained.delete(id);retained.set(id,true);
    // Keep a few recently visited pages warm without retaining an entire book.
    let count=0,pixels=0;
    for(const key of [...retained.keys()].reverse()){
      const canvas=cards.get(key)?.querySelector('canvas');if(!canvas||canvas.width<=1){retained.delete(key);continue;}
      if(visible.has(key))continue;
      count++;pixels+=canvas.width*canvas.height;
      if(count>3||pixels>3000000){canvas.width=canvas.height=1;retained.delete(key);markDirty(key);}
    }
  }
  function resize(zoom){
    const available=api.availableWidth();let maximum=0;
    for(const page of pages){const width=Math.min(api.dimensions(page).width,available);maximum=Math.max(maximum,width);if(available!==layoutWidth)cards.get(page.id)?.style.setProperty('--page-base',width+'px');}
    layoutWidth=available;$('notebookStack').style.setProperty('--stack-zoom',zoom);$('notebookStack').style.width=`${maximum*zoom}px`;
  }
  function queue(){clearTimeout(timer);timer=setTimeout(paint,Math.max(16,SCROLL_IDLE-(Date.now()-lastScrollAt)));}
  async function paint(){
    if(painting||!visible.size)return;if(busy()){queue();return;}painting=true;const stamp=generation,scope=api.scope();
    try{for(const id of visible){if(stamp!==generation||!api.matches(scope))break;if(busy()){queue();break;}
      const card=cards.get(id),page=pagesById.get(id);if(!card||!page||id===api.active())continue;
      const canvas=card.querySelector('canvas');if(!dirty.has(id)&&canvas.width>1)continue;
      const version=versions.get(id),current=()=>stamp===generation&&api.matches(scope)&&pagesById.get(id)===page&&versions.get(id)===version&&visible.has(id)&&id!==api.active()&&!busy();
      const painted=await api.paint(canvas,page,scope,current);
      if(!current()||painted===false){queue();break;}
      dirty.delete(id);retain(id);
      // Decode and paint at most one page in a task so input can run between pages.
      queue();break;
    }}catch(error){if(!error.cancelled)console.warn('Notebook page preview:',error.message);}finally{painting=false;}
  }
  function sync(){
    const book=api.book();if(!book)return;const root=$('notebookStack'),shell=$('pageShell');
    if(bookId!==book.id){generation++;observer.disconnect();visible.clear();dirty.clear();cards.clear();retained.clear();versions.clear();pagesById.clear();root.replaceChildren(shell);bookId=book.id;layoutWidth=0;}
    pages=book.pages;
    const previous=pagesById;pagesById=new Map(pages.map(page=>[page.id,page]));
    for(const [id,card] of cards)if(!pagesById.has(id)){if(card.contains(shell))root.append(shell);observer.unobserve(card);card.remove();cards.delete(id);visible.delete(id);dirty.delete(id);retained.delete(id);versions.delete(id);}
    for(let index=0;index<pages.length;index++){
      const page=pages[index],d=api.dimensions(page);let card=cards.get(page.id);
      if(previous.get(page.id)!==page)markDirty(page.id);
      if(!card){card=document.createElement('section');card.className='notebook-stack-page';card.dataset.stackPage=page.id;
        const header=document.createElement('div');header.className='stack-page-header';
        const button=document.createElement('button');button.className='stack-page-heading';button.type='button';button.onclick=()=>{if(!api.busy())api.activate(page.id,false);};
        const pdfText=document.createElement('button');pdfText.className='stack-page-pdf-text';pdfText.type='button';pdfText.textContent='Select PDF text';pdfText.onclick=()=>api.selectPdfText(page.id);
        const remove=document.createElement('button');remove.className='stack-page-delete';remove.type='button';remove.textContent='Delete';remove.onclick=()=>{if(!busy())api.remove(page.id);};
        header.append(button,pdfText,remove);
        const body=document.createElement('div');body.className='stack-page-body';const canvas=document.createElement('canvas');canvas.width=canvas.height=1;canvas.setAttribute('aria-hidden','true');body.append(canvas);card.append(header,body);cards.set(page.id,card);root.append(card);observer.observe(card);markDirty(page.id);layoutWidth=0;
        body.onclick=event=>{if(event.target===canvas&&!api.busy())api.activate(page.id,true);};
      }
      const heading=card.querySelector('button'),current=page.id===api.active();
      heading.textContent=`Page ${index+1}`;
      heading.setAttribute('aria-label',current?`Page ${index+1}, current page`:`Write on page ${index+1}`);
      heading.title=current?'Current page':`Write on page ${index+1}`;
      const pdfText=card.querySelector('.stack-page-pdf-text');pdfText.hidden=page.background?.type!=='pdf';pdfText.setAttribute('aria-label',`Select PDF text on page ${index+1}`);
      const remove=card.querySelector('.stack-page-delete');remove.disabled=pages.length===1;remove.setAttribute('aria-label',`Delete page ${index+1}`);remove.title=pages.length===1?'A notebook needs at least one page':`Delete page ${index+1}`;
      const body=card.querySelector('.stack-page-body'),ratio=`${d.width}/${d.height}`;if(body.style.aspectRatio!==ratio){body.style.aspectRatio=ratio;layoutWidth=0;}
      card.classList.toggle('active-page',current);if(current&&shell.parentElement!==body){
        const old=shell.parentElement?.closest('.notebook-stack-page'),oldCanvas=old?.querySelector('canvas');
        if(oldCanvas&&api.capture?.(oldCanvas,pagesById.get(old.dataset.stackPage))){dirty.delete(old.dataset.stackPage);retain(old.dataset.stackPage);}
        body.append(shell);card.querySelector('canvas').width=card.querySelector('canvas').height=1;retained.delete(page.id);markDirty(page.id);
      }
      const at=root.children[index];if(at!==card)root.insertBefore(card,at||null);
    }
    resize(api.zoom());queue();
  }
  function focus(id){const card=cards.get(id);if(!card)return;const scroller=$('pageScroller');scroller.scrollTop+=card.getBoundingClientRect().top-scroller.getBoundingClientRect().top-12;}
  function findActive(){
    if(busy()){scrollTimer=setTimeout(findActive,120);return;}
    const root=$('pageScroller').getBoundingClientRect(),middle=root.top+root.height*.42;let best=null,distance=Infinity;
    for(const id of visible){const card=cards.get(id);if(!card)continue;const r=card.getBoundingClientRect();if(r.bottom<root.top||r.top>root.bottom)continue;const delta=middle<r.top?r.top-middle:middle>r.bottom?middle-r.bottom:0;if(delta<distance){best=id;distance=delta;}}
    if(best&&best!==api.active())api.activate(best,true);
  }
  function init(adapter){
    api=adapter;observer=new IntersectionObserver(entries=>{for(const entry of entries){const id=entry.target.dataset.stackPage;if(cards.get(id)!==entry.target)continue;if(entry.isIntersecting){visible.add(id);retained.delete(id);}else{visible.delete(id);retain(id);}}queue();},{root:$('pageScroller'),rootMargin:'180px'});
    $('pageScroller').addEventListener('scroll',()=>{lastScrollAt=Date.now();clearTimeout(scrollTimer);scrollTimer=setTimeout(findActive,SCROLL_IDLE);queue();},{passive:true});
  }
  function reset(){generation++;clearTimeout(timer);clearTimeout(scrollTimer);visible.clear();dirty.clear();cards.clear();retained.clear();versions.clear();pagesById.clear();if(observer)observer.disconnect();bookId='';lastScrollAt=0;}
  global.WindsPageStack=Object.freeze({init,sync,resize,focus,reset,isScrolling,dirty:id=>{markDirty(id);queue();}});
})(window);
