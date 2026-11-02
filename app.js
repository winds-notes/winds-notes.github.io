/* Folio Notes — GitHub Pages-friendly handwriting web app.
   No server, account, tracking, or third-party JavaScript required. */
(() => {
  'use strict';
  const W = 840, H = 1188, RENDER_SCALE = 2;
  const $ = id => document.getElementById(id);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const clone = value => JSON.parse(JSON.stringify(value));
  const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const COVER_COLORS = ['purple','blue','peach','green','lilac','yellow'];
  const COLORS = ['#2b2d4c','#6457ed','#e96576','#e7a43a','#39a68c','#4777c8','#9a62b4'];
  const ICONS = {
    plus:'<path d="M12 5v14M5 12h14"/>',
    back:'<path d="M19 12H5m7-7-7 7 7 7"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
    upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 17v4h16v-4"/>',
    search:'<circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/>',
    pen:'<path d="m13 6 5 5M4 20l5-.9L20 7a2.1 2.1 0 0 0-3-3L5 16z"/>',
    highlighter:'<path d="m3 17 4 4 4-4-4-4zM7 13 17.4 2.6l4 4L11 17M2 22h13"/>',
    eraser:'<path d="m20 16-4 4H9L2.7 13.7a2 2 0 0 1 0-2.8l8.2-8.2a2 2 0 0 1 2.8 0l7.6 7.6a2 2 0 0 1 0 2.8L18 16M7 18l8-8M14 20h8"/>',
    select:'<path d="m5 3 14 9-8 1-3 7z"/>',
    text:'<path d="M4 5h16M12 5v15M7 20h10M4 5v3M20 5v3"/>',
    rectangle:'<rect x="4" y="5" width="16" height="14" rx="1"/>',
    ellipse:'<ellipse cx="12" cy="12" rx="9" ry="7"/>',
    line:'<path d="M4 20 20 4"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 16-5-5L5 20"/>',
    pages:'<path d="M8 5h11a2 2 0 0 1 2 2v12H8zM5 2h10M3 5v15"/>',
    undo:'<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-2"/>',
    redo:'<path d="m15 14 5-5-5-5m5 5H10a6 6 0 0 0 0 12h2"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    paper:'<path d="M6 2h9l4 4v16H6zM14 2v5h5M9 12h7M9 16h7"/>',
    pencil:'<path d="M15.5 5.5 18.5 8.5M4 20l5-1 11-11a2.12 2.12 0 0 0-3-3L6 16z"/>',
    zoomIn:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5M7.5 10.5h6m-3-3v6"/>',
    zoomOut:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5M7.5 10.5h6"/>',
    chevronLeft:'<path d="m14 18-6-6 6-6"/>',
    chevronRight:'<path d="m10 18 6-6-6-6"/>',
    x:'<path d="M18 6 6 18M6 6l12 12"/>',
    trash:'<path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/>'
  };
  const icon = (key, size=20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[key] || ICONS.plus}</svg>`;
  const state = {notebooks:[],activeId:null,pageIndex:0,tool:'pen',color:COLORS[0],size:3,zoom:1,penOnly:false,selected:-1,draft:null,drag:null,pointers:new Map(),pinch:null,sidebarOpen:true,saveTimer:null,toastTimer:null,editingText:null};
  const history = new Map();
  const imageCache = new Map();
  let database = null, persistence = 'indexeddb', installPrompt = null, saving = false;
  const now = () => new Date().toISOString();
  const makePage = template => ({id:uid(),template:template || 'ruled',items:[]});
  const makeNotebook = (title,cover,template) => ({id:uid(),title:title.trim() || 'Untitled notebook',cover,createdAt:now(),updatedAt:now(),pages:[makePage(template)]});
  const notebook = () => state.notebooks.find(n => n.id === state.activeId);
  const page = () => notebook()?.pages[state.pageIndex];
  const filename = title => String(title || 'Folio-notes').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').trim().slice(0,90) || 'Folio-notes';
  const delay = ms => new Promise(resolve => setTimeout(resolve,ms));

  function initIcons(){
    const set = (id, name) => {const el=$(id);if(el)el.innerHTML=icon(name)};
    Object.entries({backupButton:'download',restoreButton:'upload',heroPlus:'plus',newPlus:'plus',searchIcon:'search',goLibrary:'back',undoBtn:'undo',redoBtn:'redo',moreOptionsBtn:'more',exportIcon:'download',togglePages:'pages',pencilOnlyIcon:'pencil',insertImageBtn:'image',paperStyleBtn:'paper',addPageSidebar:'plus',addPageBottomIcon:'plus',zoomOut:'zoomOut',zoomIn:'zoomIn',floatPlus:'plus',prevPage:'chevronLeft',nextPage:'chevronRight',closeModal:'x'}).forEach(([id,name])=>set(id,name));
    document.querySelectorAll('[data-tool]').forEach(btn => btn.innerHTML = icon(btn.dataset.tool));
    $('colorPalette').innerHTML = COLORS.map((c,i)=>`<button class="color-button ${i===0?'selected':''}" data-color="${c}" title="Ink ${i+1}" aria-label="Choose ink color ${i+1}"><span style="background:${c}"></span></button>`).join('');
    $('coverChoices').innerHTML = COVER_COLORS.map((c,i)=>`<button class="cover-choice cover-${c} ${i===0?'active':''}" data-cover="${c}" aria-label="${c} cover" title="${c} cover"></button>`).join('');
  }
  function storageOpen(){
    return new Promise(resolve => {
      if (!window.indexedDB){persistence='localstorage';resolve();return;}
      try{
        const request=indexedDB.open('folio-notes-v1',1);
        request.onupgradeneeded=()=>{ if(!request.result.objectStoreNames.contains('app'))request.result.createObjectStore('app');};
        request.onsuccess=()=>{database=request.result;resolve();};
        request.onerror=()=>{persistence='localstorage';resolve();};
        request.onblocked=()=>{persistence='localstorage';resolve();};
      }catch(e){persistence='localstorage';resolve();}
    });
  }
  function loadData(){
    if(persistence==='localstorage'){try{return Promise.resolve(JSON.parse(localStorage.getItem('folio-notes-data')));}catch(e){return Promise.resolve(null);}}
    return new Promise(resolve=>{try{const tx=database.transaction('app','readonly');const req=tx.objectStore('app').get('notebooks');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);}catch(e){resolve(null);}});
  }
  function writeData(payload){
    if(persistence==='localstorage'){localStorage.setItem('folio-notes-data',JSON.stringify(payload));return Promise.resolve();}
    return new Promise((resolve,reject)=>{try{const tx=database.transaction('app','readwrite');tx.objectStore('app').put(payload,'notebooks');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Storage error'));}catch(e){reject(e);}});
  }
  function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
  function scheduleSave(){
    const n=notebook();if(n)n.updatedAt=now();
    $('saveStatus').classList.add('saving');$('saveStatus').textContent='Saving…';
    clearTimeout(state.saveTimer);state.saveTimer=setTimeout(saveNow,450);
  }
  async function saveNow(){
    clearTimeout(state.saveTimer);
    if(saving){state.saveTimer=setTimeout(saveNow,500);return;}
    saving=true;
    try{await writeData({version:1,notebooks:clone(state.notebooks)});$('saveStatus').textContent='Saved on this device';$('saveStatus').classList.remove('saving');}
    catch(err){$('saveStatus').textContent='Storage full / not saved';$('saveStatus').classList.add('saving');toast('Could not save. Export a backup and free device storage.');console.error(err);}
    finally{saving=false;}
  }
  function seed(){
    const n=makeNotebook('Welcome to Folio','purple','dots');const p=n.pages[0];
    p.items.push({id:uid(),type:'text',x:75,y:104,w:700,size:40,color:'#454063',text:'Hello, creative mind. ✳'});
    p.items.push({id:uid(),type:'text',x:79,y:192,w:680,size:18,color:'#74768d',text:'Your digital notebook is ready.\nHere are a few things you can try:'});
    p.items.push({id:uid(),type:'text',x:82,y:305,w:665,size:20,color:'#56536b',text:'01  Pick up a stylus and start writing.\n\n02  Choose a pen, highlighter, color, or paper.\n\n03  Add pages or create more notebooks.\n\n04  Export your work as a PDF or image.\n\n05  Back up your notebooks to move devices.'});
    p.items.push({id:uid(),type:'text',x:80,y:790,w:660,size:24,color:'#6557ed',text:'An idea deserves a beautiful place to live.'});
    p.items.push({id:uid(),type:'stroke',tool:'pen',color:'#e6a25a',size:5,points:[[82,837,0.7],[160,831,0.7],[240,833,0.7],[325,829,0.7],[412,834,0.7],[540,828,0.7],[680,832,0.7]]});
    state.notebooks=[n];
  }

  function view(which){$('libraryView').hidden=which!=='library';$('editorView').hidden=which!=='editor';}
  function displayDate(iso){const d=new Date(iso);return Number.isNaN(+d)?'Recently edited':`Edited ${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;}
  function renderLibrary(){
    const query=$('searchNotebooks').value.trim().toLowerCase();
    $('notebookCount').textContent=state.notebooks.length;
    const found=[...state.notebooks].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).filter(n=>n.title.toLowerCase().includes(query));
    if(!found.length){$('notebookGrid').innerHTML=`<div class="empty-state"><div style="font-size:34px">✳</div><h3>${query?'No notebooks found':'Your next idea starts here'}</h3><p>${query?'Try another search term.':'Create a new notebook to start writing.'}</p></div>`;return;}
    $('notebookGrid').innerHTML=found.map(n=>`<article class="notebook-card" data-open="${safe(n.id)}" tabindex="0" role="button" aria-label="Open ${safe(n.title)}"><div class="book-cover cover-${COVER_COLORS.includes(n.cover)?n.cover:'purple'}"><div class="cover-name">${safe(n.title)}</div><div class="cover-rule"></div><div class="cover-foot">FOLIO / NOTES</div></div><div class="notebook-meta"><div style="min-width:0"><h3>${safe(n.title)}</h3><p>${n.pages.length} ${n.pages.length===1?'page':'pages'} · ${displayDate(n.updatedAt)}</p></div><button class="card-menu" data-delete="${safe(n.id)}" title="Delete notebook" aria-label="Delete ${safe(n.title)}">${icon('more')}</button></div></article>`).join('');
  }
  function openNotebook(id){
    const n=state.notebooks.find(x=>x.id===id);if(!n)return;
    state.activeId=id;state.pageIndex=0;state.selected=-1;state.zoom=1;state.draft=null;
    state.sidebarOpen=window.innerWidth>750;
    view('editor');$('notebookTitle').value=n.title;
    updateSidebar();setTool('pen');renderEditor();resizePage();
  }
  function goLibrary(){commitText();state.draft=null;saveNow();state.activeId=null;view('library');renderLibrary();}
  function renderEditor(){
    const n=notebook();if(!n)return;
    $('notebookTitle').value=n.title;
    $('pageCount').textContent=n.pages.length;
    $('pageBreadcrumb').textContent=`Page ${state.pageIndex+1} of ${n.pages.length}`;
    $('pageIndicator').textContent=`${state.pageIndex+1} / ${n.pages.length}`;
    $('prevPage').disabled=state.pageIndex===0;
    $('nextPage').disabled=state.pageIndex===n.pages.length-1;
    renderThumbs();renderCanvas();updateHistoryButtons();
  }
  function updateSidebar(){
    $('pagesSidebar').classList.toggle('collapsed',!state.sidebarOpen);
    $('editorScrim').hidden=!(window.innerWidth<=750 && state.sidebarOpen);
  }
  function switchPage(index){
    const n=notebook();if(!n||index<0||index>=n.pages.length)return;
    commitText();state.pageIndex=index;state.selected=-1;state.draft=null;renderEditor();
    $('pageScroller').scrollTop=0;
    if(window.innerWidth<=750){state.sidebarOpen=false;updateSidebar();}
  }
  function addPage(){
    const n=notebook();if(!n)return;
    commitText();n.pages.splice(state.pageIndex+1,0,makePage(page()?.template||'ruled'));
    state.pageIndex++;state.selected=-1;renderEditor();scheduleSave();
    $('pageScroller').scrollTop=0;toast('New page added');
  }
  function duplicatePage(){const n=notebook();if(!n)return;commitText();const dupe=clone(page());dupe.id=uid();dupe.items.forEach(it=>it.id=uid());n.pages.splice(state.pageIndex+1,0,dupe);state.pageIndex++;renderEditor();scheduleSave();toast('Page duplicated');}
  function deletePage(index){
    const n=notebook();if(!n)return;
    if(n.pages.length===1){toast('A notebook needs at least one page');return;}
    if(!confirm(`Delete page ${index+1}? This cannot be undone.`))return;
    commitText();n.pages.splice(index,1);state.pageIndex=Math.min(state.pageIndex,n.pages.length-1);state.selected=-1;renderEditor();scheduleSave();toast('Page removed');
  }
  function renderThumbs(){
    const n=notebook();if(!n)return;
    $('thumbList').innerHTML=n.pages.map((p,i)=>`<div class="page-thumb ${i===state.pageIndex?'active':''}" data-page="${i}"><div class="thumb-canvas-wrap"><canvas width="250" height="354" data-preview="${i}" aria-hidden="true"></canvas></div><div class="thumb-meta">Page ${i+1}<button data-remove-page="${i}" class="thumb-actions" title="Delete page ${i+1}" aria-label="Delete page ${i+1}">${icon('trash')}</button></div></div>`).join('');
    document.querySelectorAll('[data-preview]').forEach(el=>{const i=Number(el.dataset.preview);const ctx=el.getContext('2d');ctx.setTransform(250/W,0,0,354/H,0,0);drawPage(ctx,n.pages[i]);});
  }
  function pageBaseWidth(){const scroller=$('pageScroller');return Math.min(W,Math.max(250,scroller.clientWidth-58));}
  function resizePage(){if($('editorView').hidden)return;const width=Math.round(pageBaseWidth()*state.zoom);$('pageShell').style.width=`${width}px`;$('zoomValue').textContent=`${Math.round(state.zoom*100)}%`;renderCanvas();}
  function changeZoom(amount){state.zoom=Math.min(2.5,Math.max(.5,Math.round((state.zoom+amount)*100)/100));resizePage();}
  function setTool(tool){
    commitText();state.tool=tool;state.selected=-1;state.draft=null;
    document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    $('pageCanvas').classList.toggle('cursor-eraser',tool==='eraser');
    $('pageCanvas').classList.toggle('cursor-select',tool==='select');
    $('pageCanvas').classList.toggle('cursor-text',tool==='text');
    renderCanvas();
  }
  function setColor(c){state.color=c;document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('selected',b.dataset.color===c));$('sizePreview').style.background=c;}
  function updateSize(){state.size=Number($('penSize').value);$('sizeLabel').textContent=String(state.size);const diameter=Math.max(4,Math.min(state.size,14));$('sizePreview').style.width=`${diameter}px`;$('sizePreview').style.height=`${diameter}px`;}
  function historyForPage(){const key=page()?.id;if(!key)return null;if(!history.has(key))history.set(key,{undo:[],redo:[]});return history.get(key);}
  function remember(){const h=historyForPage();if(!h)return;h.undo.push(clone(page().items));if(h.undo.length>60)h.undo.shift();h.redo=[];updateHistoryButtons();}
  function undo(){commitText();const h=historyForPage();if(!h?.undo.length)return;h.redo.push(clone(page().items));page().items=h.undo.pop();state.selected=-1;renderEditor();scheduleSave();}
  function redo(){commitText();const h=historyForPage();if(!h?.redo.length)return;h.undo.push(clone(page().items));page().items=h.redo.pop();state.selected=-1;renderEditor();scheduleSave();}
  function updateHistoryButtons(){const h=historyForPage();$('undoBtn').disabled=!h?.undo.length;$('redoBtn').disabled=!h?.redo.length;}
  function drawTemplate(ctx,kind){
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
    ctx.lineWidth=1;
    if(kind==='ruled'){
      ctx.strokeStyle='#e1e7f3';ctx.beginPath();for(let y=122;y<H-55;y+=36){ctx.moveTo(0,y+.5);ctx.lineTo(W,y+.5);}ctx.stroke();
      ctx.strokeStyle='#f2d8dd';ctx.beginPath();ctx.moveTo(73,0);ctx.lineTo(73,H);ctx.stroke();
    }else if(kind==='grid'){
      ctx.strokeStyle='#e7eaf4';ctx.beginPath();for(let y=0;y<H;y+=32){ctx.moveTo(0,y+.5);ctx.lineTo(W,y+.5);}for(let x=0;x<W;x+=32){ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,H);}ctx.stroke();
    }else if(kind==='dots'){
      ctx.fillStyle='#d7def0';for(let y=33;y<H;y+=30)for(let x=33;x<W;x+=30){ctx.beginPath();ctx.arc(x,y,1.15,0,Math.PI*2);ctx.fill();}
    }
  }
  function wrapText(ctx,text,maxWidth){
    const lines=[];
    for(const para of String(text).split('\n')){
      if(!para){lines.push('');continue;}
      let line='';
      for(const word of para.split(/\s+/)){
        const test=line?`${line} ${word}`:word;
        if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;
      }
      lines.push(line);
    }
    return lines;
  }
  function textGeometry(item){
    const temp=document.createElement('canvas').getContext('2d');temp.font=`${item.size||20}px Arial, sans-serif`;
    const lines=wrapText(temp,item.text,item.w||480);
    return {lines,h:Math.max(1,lines.length)*(item.size||20)*1.42};
  }
  function drawStroke(ctx,item){
    const ps=item.points;if(!ps?.length)return;
    ctx.save();ctx.strokeStyle=item.color;ctx.fillStyle=item.color;ctx.lineCap='round';ctx.lineJoin='round';
    if(item.tool==='highlighter'){
      ctx.globalAlpha=.27;ctx.lineWidth=Math.max(8,item.size*5.7);ctx.beginPath();ctx.moveTo(ps[0][0],ps[0][1]);for(let i=1;i<ps.length;i++)ctx.lineTo(ps[i][0],ps[i][1]);if(ps.length===1){ctx.arc(ps[0][0],ps[0][1],ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();
    }else{
      if(ps.length===1){ctx.beginPath();ctx.arc(ps[0][0],ps[0][1],Math.max(.5,item.size*(ps[0][2]||.65)*.5),0,Math.PI*2);ctx.fill();}
      else for(let i=1;i<ps.length;i++){
        const a=ps[i-1],b=ps[i];ctx.lineWidth=Math.max(.85,item.size*(.35+.65*((a[2]+b[2])/2||.7)));
        ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawItem(ctx,item){
    ctx.save();
    if(item.type==='stroke'){drawStroke(ctx,item);}
    else if(item.type==='text'){
      ctx.fillStyle=item.color||'#2b2d4c';ctx.font=`${item.size||20}px Arial, sans-serif`;ctx.textBaseline='top';
      const lines=wrapText(ctx,item.text,item.w||490);const lineHeight=(item.size||20)*1.42;
      lines.forEach((line,i)=>ctx.fillText(line,item.x,item.y+i*lineHeight));
    }else if(item.type==='shape'){
      ctx.strokeStyle=item.color;ctx.lineWidth=item.size||3;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
      if(item.kind==='rectangle')ctx.rect(item.x,item.y,item.w,item.h);
      else if(item.kind==='ellipse')ctx.ellipse(item.x+item.w/2,item.y+item.h/2,Math.max(.1,Math.abs(item.w/2)),Math.max(.1,Math.abs(item.h/2)),0,0,Math.PI*2);
      else {ctx.moveTo(item.x,item.y);ctx.lineTo(item.x+item.w,item.y+item.h);}
      ctx.stroke();
    }else if(item.type==='image'){
      if(!imageCache.has(item.src)){
        const img=new Image();imageCache.set(item.src,img);img.onload=()=>{if(!document.hidden)renderCanvas();};img.src=item.src;
      }
      const img=imageCache.get(item.src);if(img?.complete&&img.naturalWidth)ctx.drawImage(img,item.x,item.y,item.w,item.h);
    }
    ctx.restore();
  }
  function drawPage(ctx,p,withoutSelection=true){
    if(!p)return;drawTemplate(ctx,p.template||'ruled');
    for(const item of p.items)drawItem(ctx,item);
    if(!withoutSelection){
      if(state.draft)drawItem(ctx,state.draft);
      if(state.selected>=0 && p.items[state.selected]){
        const b=itemBounds(p.items[state.selected]);ctx.save();ctx.strokeStyle='#6557ed';ctx.lineWidth=1.7;ctx.setLineDash([8,6]);ctx.strokeRect(b.x-8,b.y-8,b.w+16,b.h+16);ctx.restore();
      }
    }
  }
  function renderCanvas(){
    const p=page();if(!p)return;
    const canvas=$('pageCanvas'),ctx=canvas.getContext('2d');
    ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);ctx.clearRect(0,0,W,H);drawPage(ctx,p,false);
  }
  function renderExportCanvas(p){
    const canvas=document.createElement('canvas');canvas.width=W*RENDER_SCALE;canvas.height=H*RENDER_SCALE;
    const ctx=canvas.getContext('2d',{alpha:false});ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);drawPage(ctx,p,true);return canvas;
  }
  function itemBounds(item){
    if(item.type==='stroke'){
      const pts=item.points||[];if(!pts.length)return{x:0,y:0,w:0,h:0};
      const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const pad=Math.max(7,item.size*(item.tool==='highlighter'?3:1));
      const x=Math.min(...xs)-pad,y=Math.min(...ys)-pad;return {x,y,w:Math.max(...xs)-Math.min(...xs)+2*pad,h:Math.max(...ys)-Math.min(...ys)+2*pad};
    }
    if(item.type==='text')return{x:item.x,y:item.y,w:item.w||480,h:textGeometry(item).h};
    const x=Math.min(item.x,item.x+item.w),y=Math.min(item.y,item.y+item.h);return{x,y,w:Math.abs(item.w),h:Math.abs(item.h)};
  }
  const distToSegment=(px,py,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay;const t=dx*dx+dy*dy?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy))):0;return Math.hypot(px-ax-dx*t,py-ay-dy*t);};
  function nearItem(item,x,y,forEraser=false){
    const b=itemBounds(item),tolerance=forEraser?14:9;
    if(x<b.x-tolerance||x>b.x+b.w+tolerance||y<b.y-tolerance||y>b.y+b.h+tolerance)return false;
    if(item.type!=='stroke')return true;
    const pts=item.points||[];if(pts.length===1)return Math.hypot(x-pts[0][0],y-pts[0][1])<tolerance+item.size;
    for(let i=1;i<pts.length;i++)if(distToSegment(x,y,...pts[i-1].slice(0,2),...pts[i].slice(0,2))<tolerance+item.size*(item.tool==='highlighter'?2.5:0.7))return true;
    return false;
  }
  function hitTest(x,y,eraser=false){const items=page()?.items||[];for(let i=items.length-1;i>=0;i--)if(nearItem(items[i],x,y,eraser))return i;return -1;}
  function point(ev){const rect=$('pageCanvas').getBoundingClientRect();return{x:(ev.clientX-rect.left)/rect.width*W,y:(ev.clientY-rect.top)/rect.height*H,p:ev.pointerType==='pen'&&ev.pressure>0?ev.pressure:.68};}
  function clampPoint(p){return{x:Math.max(0,Math.min(W,p.x)),y:Math.max(0,Math.min(H,p.y)),p:p.p};}
  function appendPoint(stroke,p){const arr=stroke.points;const prev=arr[arr.length-1];if(!prev||Math.hypot(prev[0]-p.x,prev[1]-p.y)>1)arr.push([p.x,p.y,p.p]);}
  function pointerDown(ev){
    if(!page()||state.editingText)return;
    if(ev.button!=null && ev.button!==0)return;
    const p=clampPoint(point(ev));
    if(ev.pointerType==='touch'){
      state.pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
      if(state.pointers.size===2){state.draft=null;state.drag=null;const values=[...state.pointers.values()];state.pinch={distance:Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y),zoom:state.zoom};return;}
      if(state.pointers.size>2)return;
      if(state.penOnly){state.drag={kind:'pan',pointerId:ev.pointerId,lastX:ev.clientX,lastY:ev.clientY};ev.currentTarget.setPointerCapture(ev.pointerId);return;}
    }
    if(state.pinch || (state.penOnly && ev.pointerType!=='pen'))return;
    if(ev.pointerType==='pen' && ev.isPrimary===false)return;
    if(state.tool==='text'){
      ev.preventDefault(); // Keep the inline editor focused when a pointer click creates it.
      const at=hitTest(p.x,p.y);
      if(at!==-1&&page().items[at].type==='text')beginText(p.x,p.y,at);else beginText(p.x,p.y);
      return;
    }
    if(state.tool==='eraser'){
      state.drag={kind:'erase',pointerId:ev.pointerId,changed:false};eraseAt(p.x,p.y);ev.currentTarget.setPointerCapture(ev.pointerId);return;
    }
    if(state.tool==='select'){
      const idx=hitTest(p.x,p.y);state.selected=idx;state.drag={kind:'select',pointerId:ev.pointerId,startX:p.x,startY:p.y,startItems:clone(page().items),changed:false};renderCanvas();ev.currentTarget.setPointerCapture(ev.pointerId);return;
    }
    if(state.tool==='pen'||state.tool==='highlighter')state.draft={id:uid(),type:'stroke',tool:state.tool,color:state.color,size:state.size,points:[[p.x,p.y,p.p]]};
    else if(['rectangle','ellipse','line'].includes(state.tool))state.draft={id:uid(),type:'shape',kind:state.tool,x:p.x,y:p.y,w:0,h:0,color:state.color,size:state.size};
    else return;
    state.drag={kind:'draw',pointerId:ev.pointerId,startX:p.x,startY:p.y};
    $('pageShell').classList.add('is-handdrawing');ev.currentTarget.setPointerCapture(ev.pointerId);renderCanvas();
  }
  function pointerMove(ev){
    if(ev.pointerType==='touch'&&state.pointers.has(ev.pointerId))state.pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    if(state.pinch){
      if(state.pointers.size>=2){const v=[...state.pointers.values()];const d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);state.zoom=Math.max(.5,Math.min(2.5,state.pinch.zoom*d/Math.max(1,state.pinch.distance)));resizePage();}
      return;
    }
    if(!state.drag||state.drag.pointerId!==ev.pointerId)return;
    const p=clampPoint(point(ev));
    if(state.drag.kind==='pan'){
      const scroller=$('pageScroller');scroller.scrollLeft-=ev.clientX-state.drag.lastX;scroller.scrollTop-=ev.clientY-state.drag.lastY;state.drag.lastX=ev.clientX;state.drag.lastY=ev.clientY;return;
    }
    if(state.drag.kind==='erase'){eraseAt(p.x,p.y);return;}
    if(state.drag.kind==='select'){
      const i=state.selected;if(i<0)return;
      const dx=p.x-state.drag.startX,dy=p.y-state.drag.startY;
      if(Math.hypot(dx,dy)<1)return;
      if(!state.drag.changed){remember();state.drag.changed=true;}
      const original=state.drag.startItems[i],item=clone(original);
      if(item.type==='stroke')item.points=original.points.map(q=>[q[0]+dx,q[1]+dy,q[2]]);
      else{item.x=original.x+dx;item.y=original.y+dy;}
      page().items[i]=item;renderCanvas();return;
    }
    if(state.drag.kind==='draw'&&state.draft){
      if(state.draft.type==='stroke'){
        const events=ev.getCoalescedEvents?ev.getCoalescedEvents():[ev];for(const co of events){const t=clampPoint(point(co));appendPoint(state.draft,t);}
      }else{state.draft.w=p.x-state.drag.startX;state.draft.h=p.y-state.drag.startY;}
      renderCanvas();
    }
  }
  function pointerUp(ev){
    state.pointers.delete(ev.pointerId);
    if(state.pinch){if(state.pointers.size<2){state.pinch=null;state.drag=null;state.draft=null;}return;}
    if(!state.drag||state.drag.pointerId!==ev.pointerId)return;
    if(state.drag.kind==='draw'&&state.draft){
      const item=state.draft;
      if(item.type==='stroke'||Math.abs(item.w)+Math.abs(item.h)>3){remember();page().items.push(item);scheduleSave();renderThumbs();}
      state.draft=null;renderCanvas();
    }else if(state.drag.kind==='select'&&state.drag.changed){scheduleSave();renderThumbs();}
    state.drag=null;$('pageShell').classList.remove('is-handdrawing');
  }
  function pointerCancel(ev){state.pointers.delete(ev.pointerId);state.drag=null;state.draft=null;state.pinch=null;$('pageShell').classList.remove('is-handdrawing');renderCanvas();}
  function eraseAt(x,y){const idx=hitTest(x,y,true);if(idx<0)return;if(!state.drag?.changed){remember();state.drag.changed=true;}page().items.splice(idx,1);state.selected=-1;renderCanvas();renderThumbs();scheduleSave();}
  function beginText(x,y,idx=-1){
    const existing=idx>=0?page().items[idx]:null;
    const item=existing?clone(existing):{id:uid(),type:'text',x,y,w:Math.min(500,W-x-28),size:Math.max(18,Math.min(40,12+state.size*2.4)),color:state.color,text:''};
    const editor=$('inlineTextEditor'),rect=$('pageCanvas').getBoundingClientRect(),scale=rect.width/W;
    editor.hidden=false;editor.style.left=`${item.x*scale}px`;editor.style.top=`${item.y*scale}px`;
    editor.style.width=`${Math.max(100,item.w*scale)}px`;editor.style.height=`${Math.max(65,Math.min(340,((item.text||'').split('\n').length+2)*item.size*1.42*scale))}px`;
    editor.style.fontSize=`${item.size*scale}px`;editor.style.color=item.color;
    editor.value=item.text;state.editingText={item,idx};editor.focus();editor.setSelectionRange(editor.value.length,editor.value.length);
  }
  function commitText(){
    if(!state.editingText)return;
    const editor=$('inlineTextEditor'),text=editor.value.trimEnd(),{item,idx}=state.editingText;
    editor.hidden=true;state.editingText=null;
    if(!page())return;
    if(text.trim()){
      item.text=text;
      if(idx<0){remember();page().items.push(item);}
      else if(text!==page().items[idx]?.text){remember();page().items[idx]=item;}
      else return;
      scheduleSave();renderThumbs();renderCanvas();
    }else if(idx>=0){remember();page().items.splice(idx,1);scheduleSave();renderThumbs();renderCanvas();}
  }
  async function importImage(file){
    if(!file||!file.type.startsWith('image/')){toast('Please select an image file');return;}
    if(file.size>25*1024*1024){toast('Image too large. Use a file smaller than 25 MB.');return;}
    try{
      const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      const img=new Image();img.src=src;await img.decode();
      const scale=Math.min(1,1500/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      const output=c.toDataURL('image/jpeg',.84);
      const w=Math.min(650,img.width/img.height*650,650),h=w*img.height/img.width;
      const maxH=900,ratio=Math.min(1,maxH/h);
      const item={id:uid(),type:'image',x:(W-w*ratio)/2,y:120,w:w*ratio,h:h*ratio,src:output};
      remember();page().items.push(item);state.selected=page().items.length-1;setTool('select');state.selected=page().items.length-1;
      const cached=new Image();cached.src=output;imageCache.set(output,cached);cached.onload=renderCanvas;
      renderCanvas();renderThumbs();scheduleSave();toast('Image inserted. Use Select to move it.');
    }catch(err){console.error(err);toast('Could not open image');}
  }
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  async function backup(){commitText();await saveNow();const json=JSON.stringify({format:'folio-notes-backup',version:1,exportedAt:now(),notebooks:state.notebooks},null,2);downloadBlob(new Blob([json],{type:'application/json'}),'FolioNotes-backup.json');toast('Backup downloaded');}
  async function restore(file){
    if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(data.format!=='folio-notes-backup'||!Array.isArray(data.notebooks)||data.notebooks.length>500)throw Error('Invalid Folio backup');
      const valid=data.notebooks.every(n=>typeof n.title==='string'&&Array.isArray(n.pages)&&n.pages.length>0&&n.pages.every(p=>Array.isArray(p.items)&&['ruled','grid','dots','blank'].includes(p.template)));
      if(!valid)throw Error('Invalid notebook structure');
      if(!confirm(`Import ${data.notebooks.length} notebook(s)? Notebooks with matching IDs will be replaced.`))return;
      for(const incoming of data.notebooks){const index=state.notebooks.findIndex(n=>n.id===incoming.id);if(index>=0)state.notebooks[index]=incoming;else state.notebooks.push(incoming);}
      await saveNow();goLibrary();renderLibrary();toast('Notebooks restored successfully');
    }catch(err){console.error(err);toast('Not a valid Folio Notes backup');}
  }
  async function exportCurrent(format){
    const n=notebook();if(!n)return;
    commitText();$('exportMenu').hidden=true;
    if(format==='json'){await backup();return;}
    const button=$('exportBtn');button.disabled=true;button.querySelector('span:last-child').textContent='Working…';
    try{
      if(format==='pdf'){
        const images=[];
        for(let i=0;i<n.pages.length;i++){
          const c=renderExportCanvas(n.pages[i]);const bytes=window.FolioPDF.dataUrlToBytes(c.toDataURL('image/jpeg',.9));
          images.push({width:c.width,height:c.height,bytes});await delay(0);
        }
        downloadBlob(window.FolioPDF.writePdf(images),`${filename(n.title)}.pdf`);
        toast(`Exported ${n.pages.length} page${n.pages.length===1?'':'s'} as PDF`);
      }else{
        const c=renderExportCanvas(page());const mime=format==='png'?'image/png':'image/jpeg';
        const blob=await new Promise(resolve=>c.toBlob(resolve,mime,format==='png'?undefined:.93));
        if(!blob)throw Error('Image export not supported');
        downloadBlob(blob,`${filename(n.title)}-page-${state.pageIndex+1}.${format==='png'?'png':'jpg'}`);
        toast(`Page ${state.pageIndex+1} exported as ${format.toUpperCase()}`);
      }
    }catch(err){console.error(err);toast('Export failed. Try exporting fewer pages.');}
    finally{button.disabled=false;button.querySelector('span:last-child').textContent='Export';}
  }
  function showModal(){
    $('modalBackdrop').hidden=false;$('newNotebookTitle').value='Untitled notebook';$('newPaperStyle').value='ruled';
    document.querySelectorAll('[data-cover]').forEach((b,i)=>b.classList.toggle('active',i===0));
    setTimeout(()=>$('newNotebookTitle').select(),20);
  }
  function hideModal(){$('modalBackdrop').hidden=true;}
  function createNotebook(){
    const title=$('newNotebookTitle').value.trim()||'Untitled notebook';const cover=document.querySelector('.cover-choice.active')?.dataset.cover||'purple';
    const n=makeNotebook(title,cover,$('newPaperStyle').value);state.notebooks.push(n);scheduleSave();hideModal();openNotebook(n.id);toast('Your notebook is ready');
  }
  function deleteNotebook(id){const n=state.notebooks.find(n=>n.id===id);if(!n)return;if(!confirm(`Permanently delete "${n.title}" and all ${n.pages.length} pages? Export a backup first if needed.`))return;state.notebooks=state.notebooks.filter(n=>n.id!==id);if(state.activeId===id)goLibrary();scheduleSave();renderLibrary();toast('Notebook deleted');}
  function closeMenus(){['exportMenu','paperMenu','moreMenu'].forEach(id=>$(id).hidden=true);}
  function bind(){
    $('heroCreate').onclick=$('newNotebook').onclick=showModal;
    $('closeModal').onclick=$('cancelModal').onclick=hideModal;
    $('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))hideModal();});
    $('newNotebookTitle').addEventListener('keydown',e=>{if(e.key==='Enter')createNotebook();});
    $('createNotebookConfirm').onclick=createNotebook;
    $('coverChoices').onclick=e=>{const button=e.target.closest('[data-cover]');if(!button)return;document.querySelectorAll('[data-cover]').forEach(x=>x.classList.toggle('active',x===button));};
    $('notebookGrid').addEventListener('click',e=>{const remove=e.target.closest('[data-delete]');if(remove){deleteNotebook(remove.dataset.delete);return;}const card=e.target.closest('[data-open]');if(card)openNotebook(card.dataset.open);});
    $('notebookGrid').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-open]'))openNotebook(e.target.dataset.open);});
    $('searchNotebooks').oninput=renderLibrary;
    $('goLibrary').onclick=goLibrary;
    $('notebookTitle').addEventListener('change',e=>{const n=notebook();if(!n)return;n.title=e.target.value.trim()||'Untitled notebook';e.target.value=n.title;scheduleSave();});
    $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
    $('exportBtn').onclick=e=>{e.stopPropagation();const shouldShow=$('exportMenu').hidden;closeMenus();$('exportMenu').hidden=!shouldShow;};
    $('moreOptionsBtn').onclick=e=>{e.stopPropagation();const shouldShow=$('moreMenu').hidden;closeMenus();$('moreMenu').hidden=!shouldShow;};
    $('paperStyleBtn').onclick=e=>{e.stopPropagation();const shouldShow=$('paperMenu').hidden;closeMenus();$('paperMenu').hidden=!shouldShow;};
    document.querySelectorAll('[data-export]').forEach(el=>el.onclick=()=>exportCurrent(el.dataset.export));
    document.querySelectorAll('[data-paper]').forEach(el=>el.onclick=()=>{if(!page())return;page().template=el.dataset.paper;$('paperMenu').hidden=true;renderEditor();scheduleSave();toast('Paper template changed');});
    $('moreMenu').onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;closeMenus();const a=b.dataset.action;if(a==='rename'){$('notebookTitle').focus();$('notebookTitle').select();}else if(a==='duplicate')duplicatePage();else if(a==='backup')backup();else if(a==='deleteNotebook')deleteNotebook(state.activeId);};
    document.addEventListener('click',e=>{if(!e.target.closest('.pop-menu')&&!e.target.closest('#exportBtn')&&!e.target.closest('#paperStyleBtn')&&!e.target.closest('#moreOptionsBtn'))closeMenus();});
    document.querySelectorAll('[data-tool]').forEach(btn=>btn.onclick=()=>setTool(btn.dataset.tool));
    $('colorPalette').onclick=e=>{const b=e.target.closest('[data-color]');if(b)setColor(b.dataset.color);};
    $('penSize').oninput=updateSize;
    $('pencilOnly').onchange=e=>{state.penOnly=e.target.checked;toast(state.penOnly?'Stylus only enabled — use fingers to pan or pinch':'Finger drawing enabled');};
    $('addPageSidebar').onclick=$('addPageBottom').onclick=$('addPageFloat').onclick=addPage;
    $('thumbList').onclick=e=>{const remove=e.target.closest('[data-remove-page]');if(remove){deletePage(Number(remove.dataset.removePage));return;}const thumb=e.target.closest('[data-page]');if(thumb)switchPage(Number(thumb.dataset.page));};
    $('prevPage').onclick=()=>switchPage(state.pageIndex-1);$('nextPage').onclick=()=>switchPage(state.pageIndex+1);
    $('togglePages').onclick=()=>{state.sidebarOpen=!state.sidebarOpen;updateSidebar();resizePage();};
    $('editorScrim').onclick=()=>{state.sidebarOpen=false;updateSidebar();resizePage();};
    $('zoomIn').onclick=()=>changeZoom(.15);$('zoomOut').onclick=()=>changeZoom(-.15);$('fitPage').onclick=()=>{state.zoom=1;resizePage();};
    $('pageCanvas').addEventListener('pointerdown',pointerDown);$('pageCanvas').addEventListener('pointermove',pointerMove);
    $('pageCanvas').addEventListener('pointerup',pointerUp);$('pageCanvas').addEventListener('pointercancel',pointerCancel);
    $('pageCanvas').addEventListener('contextmenu',e=>e.preventDefault());
    $('inlineTextEditor').addEventListener('blur',commitText);
    $('inlineTextEditor').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();commitText();}});
    $('insertImageBtn').onclick=()=>$('imageFileInput').click();
    $('imageFileInput').onchange=e=>{const f=e.target.files[0];if(f)importImage(f);e.target.value='';};
    $('backupButton').onclick=backup;$('restoreButton').onclick=()=>$('restoreFileInput').click();
    $('restoreFileInput').onchange=e=>{restore(e.target.files[0]);e.target.value='';};
    window.addEventListener('resize',()=>{if(window.innerWidth>750){$('editorScrim').hidden=true;}else updateSidebar();resizePage();});
    document.addEventListener('keydown',e=>{
      if(!$('modalBackdrop').hidden && e.key==='Escape'){hideModal();return;}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){if(['TEXTAREA','INPUT'].includes(document.activeElement?.tagName))return;e.preventDefault();if(e.shiftKey)redo();else undo();return;}
      if(e.target.matches('input,textarea,select,[contenteditable]'))return;
      if(e.key==='Escape'){closeMenus();state.selected=-1;renderCanvas();return;}
      if($('editorView').hidden)return;
      const shortcuts={p:'pen',h:'highlighter',e:'eraser',v:'select',t:'text'};
      if(shortcuts[e.key.toLowerCase()])setTool(shortcuts[e.key.toLowerCase()]);
      if((e.key==='Delete'||e.key==='Backspace')&&state.selected>=0){remember();page().items.splice(state.selected,1);state.selected=-1;renderEditor();scheduleSave();}
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow();});
    window.addEventListener('pagehide',()=>saveNow());
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installButton').hidden=false;});
    $('installButton').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installButton').hidden=true;}};
  }
  async function boot(){
    initIcons();bind();setColor(COLORS[0]);updateSize();
    await storageOpen();const stored=await loadData();
    if(stored && Array.isArray(stored.notebooks))state.notebooks=stored.notebooks;
    else{seed();await saveNow();}
    renderLibrary();view('library');
    if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
      window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
    }
  }
  boot().catch(err=>{console.error(err);toast('Something went wrong loading notebooks');});
})();
