/* Continuous notebook pages. One writing canvas; nearby inactive previews only. */
(function(global){
  'use strict';
  let api,observer,bookId='',pages=[],visible=new Set(),dirty=new Set(),painting=false,timer=0,scrollTimer=0,generation=0,layoutWidth=0;
  const $=id=>document.getElementById(id),cards=new Map();
  function busy(){return api.busy();}
  function resize(zoom){
    const available=Math.max(250,$('pageScroller').clientWidth-32);let maximum=0;
    for(const page of pages){const width=Math.min(api.dimensions(page).width,available);maximum=Math.max(maximum,width);if(available!==layoutWidth)cards.get(page.id)?.style.setProperty('--page-base',width+'px');}
    layoutWidth=available;$('notebookStack').style.setProperty('--stack-zoom',zoom);$('notebookStack').style.width=`${maximum*zoom}px`;
  }
  function queue(){clearTimeout(timer);timer=setTimeout(paint,100);}
  async function paint(){
    if(painting)return;if(busy()){queue();return;}painting=true;const stamp=generation,scope=api.scope();
    try{for(const id of visible){if(stamp!==generation||!api.matches(scope))break;if(busy()){queue();break;}
      const card=cards.get(id),page=pages.find(p=>p.id===id);if(!card||!page||id===api.active())continue;
      const canvas=card.querySelector('canvas');if(!dirty.has(id)&&canvas.width>1)continue;
      await api.paint(canvas,page,scope);if(stamp!==generation||!api.matches(scope))break;dirty.delete(id);if(!visible.has(id))canvas.width=canvas.height=1;
    }}catch(error){if(!error.cancelled)console.warn('Notebook page preview:',error.message);}finally{painting=false;}
  }
  function sync(){
    const book=api.book();if(!book)return;const root=$('notebookStack'),shell=$('pageShell');
    if(bookId!==book.id){generation++;observer.disconnect();visible.clear();cards.clear();root.replaceChildren(shell);bookId=book.id;layoutWidth=0;}
    pages=book.pages;layoutWidth=0;const wanted=new Set(pages.map(p=>p.id));
    for(const [id,card] of cards)if(!wanted.has(id)){if(card.contains(shell))root.append(shell);observer.unobserve(card);card.remove();cards.delete(id);visible.delete(id);}
    for(let index=0;index<pages.length;index++){
      const page=pages[index],d=api.dimensions(page);let card=cards.get(page.id);
      if(!card){card=document.createElement('section');card.className='notebook-stack-page';card.dataset.stackPage=page.id;
        const header=document.createElement('div');header.className='stack-page-header';
        const button=document.createElement('button');button.className='stack-page-heading';button.type='button';button.onclick=()=>{if(!busy())api.activate(page.id,false);};
        const remove=document.createElement('button');remove.className='stack-page-delete';remove.type='button';remove.textContent='Delete';remove.onclick=()=>{if(!busy())api.remove(page.id);};
        header.append(button,remove);
        const body=document.createElement('div');body.className='stack-page-body';const canvas=document.createElement('canvas');canvas.width=canvas.height=1;canvas.setAttribute('aria-hidden','true');body.append(canvas);card.append(header,body);cards.set(page.id,card);root.append(card);observer.observe(card);dirty.add(page.id);layoutWidth=0;
        body.onclick=event=>{if(event.target===canvas&&!busy())api.activate(page.id,true);};
      }
      const heading=card.querySelector('button'),current=page.id===api.active();
      heading.textContent=`Page ${index+1}`;
      heading.setAttribute('aria-label',current?`Page ${index+1}, current page`:`Write on page ${index+1}`);
      heading.title=current?'Current page':`Write on page ${index+1}`;
      const remove=card.querySelector('.stack-page-delete');remove.disabled=pages.length===1;remove.setAttribute('aria-label',`Delete page ${index+1}`);remove.title=pages.length===1?'A notebook needs at least one page':`Delete page ${index+1}`;
      const body=card.querySelector('.stack-page-body');body.style.aspectRatio=`${d.width}/${d.height}`;
      card.classList.toggle('active-page',page.id===api.active());if(page.id===api.active()){body.append(shell);card.querySelector('canvas').width=card.querySelector('canvas').height=1;}
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
    api=adapter;observer=new IntersectionObserver(entries=>{for(const entry of entries){const id=entry.target.dataset.stackPage;if(entry.isIntersecting)visible.add(id);else{visible.delete(id);const canvas=entry.target.querySelector('canvas');canvas.width=canvas.height=1;dirty.add(id);}}queue();},{root:$('pageScroller'),rootMargin:'180px'});
    $('pageScroller').addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(findActive,140);},{passive:true});
  }
  function reset(){generation++;clearTimeout(timer);clearTimeout(scrollTimer);visible.clear();dirty.clear();if(observer)observer.disconnect();bookId='';}
  global.WindsPageStack=Object.freeze({init,sync,resize,focus,reset,dirty:id=>{dirty.add(id);queue();}});
})(window);
