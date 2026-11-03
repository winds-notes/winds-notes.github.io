/* WiNDS Notes — GitHub Pages-friendly handwriting web app.
   Writing works completely offline. Optional Google Drive backup uses Google Identity Services. */
(() => {
  'use strict';
  let W = 840, H = 1188;
  let RENDER_SCALE = 2;
  const EXPORT_SCALE = 2;
  const ORIENTATIONS = Object.freeze({portrait:{width:840,height:1188},landscape:{width:1188,height:840}});
  const pageDimensions = p => ORIENTATIONS[p?.orientation==='landscape'?'landscape':'portrait'];
  function syncPageGeometry(){
    const {width,height}=pageDimensions(page());W=width;H=height;
    const shell=$('pageShell');shell.style.aspectRatio=`${W}/${H}`;
    for(const id of ['pageCanvas','inkCanvas']){
      const c=$(id);if(c.width!==W*RENDER_SCALE)c.width=W*RENDER_SCALE;
      if(c.height!==H*RENDER_SCALE)c.height=H*RENDER_SCALE;
    }
  }
  // Keep expensive storage and page composition out of rapid pen-up/pen-down cycles.
  const SAVE_IDLE_MS = 30000, INK_COMPOSE_IDLE_MS = 2400, PALM_GUARD_MS = 2400;
  const $ = id => document.getElementById(id);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const clone = value => JSON.parse(JSON.stringify(value));
  const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const COVER_COLORS = ['purple','blue','peach','green','lilac','yellow'];
  const COLORS = ['#2b2d4c','#6457ed','#e96576','#e7a43a','#39a68c','#4777c8','#9a62b4'];
  const MORE_COLORS = ['#171717','#6b7280','#fafafa','#5735b1','#8b5cf6','#d946ef','#ec4899','#e11d48','#ef4444','#f97316','#f59e0b','#facc15','#65a30d','#22c55e','#14b8a6','#06b6d4','#0284c7','#1d4ed8','#4338ca','#9f1239','#7c2d12','#92400e','#065f46','#164e63','#1e3a8a','#4c1d95','#0f172a','#94a3b8'];
  const EMOJI_STICKERS = [
    ['😊','Smile'],['😍','Love'],['😂','Laugh'],['🥳','Celebrate'],['😎','Cool'],['🤩','Excited'],['🤔','Thinking'],['🥹','Grateful'],['😴','Sleep'],['😇','Angel'],
    ['👍','Thumbs up'],['👏','Clap'],['🙌','Hooray'],['🙏','Thanks'],['💪','Strong'],['✍️','Writing'],['🤝','Together'],['❤️','Heart'],['💜','Purple heart'],['💙','Blue heart'],
    ['⭐','Star'],['✨','Sparkles'],['🔥','Fire'],['💡','Idea'],['🎯','Target'],['✅','Check'],['❌','Cross'],['⚠️','Warning'],['📌','Pin'],['📍','Location'],
    ['📚','Books'],['📖','Reading'],['📝','Notes'],['🎓','Graduate'],['🔬','Science'],['🧪','Chemistry'],['💻','Computer'],['📈','Chart'],['📊','Statistics'],['🚀','Rocket'],
    ['🌻','Flower'],['🌈','Rainbow'],['☀️','Sun'],['🌙','Moon'],['☁️','Cloud'],['🌍','Earth'],['🍀','Clover'],['🌸','Bloom'],['🎨','Art'],['🎵','Music']
  ];
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
    arrow:'<path d="M4 20 20 4M11 4h9v9"/>',
    triangle:'<path d="M12 3 2 21h20z"/>',
    diamond:'<path d="m12 2 10 10-10 10L2 12z"/>',
    star:'<path d="m12 2 3 7 7.5.5-5.7 5 1.8 7.5L12 18l-6.6 4 1.8-7.5-5.7-5L9 9z"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 16-5-5L5 20"/>',
    pages:'<path d="M8 5h11a2 2 0 0 1 2 2v12H8zM5 2h10M3 5v15"/>',
    undo:'<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-2"/>',
    redo:'<path d="m15 14 5-5-5-5m5 5H10a6 6 0 0 0 0 12h2"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    paper:'<path d="M6 2h9l4 4v16H6zM14 2v5h5M9 12h7M9 16h7"/>',
    orientation:'<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M9 3h6M9 21h6"/>',
    pencil:'<path d="M15.5 5.5 18.5 8.5M4 20l5-1 11-11a2.12 2.12 0 0 0-3-3L6 16z"/>',
    zoomIn:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5M7.5 10.5h6m-3-3v6"/>',
    zoomOut:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5M7.5 10.5h6"/>',
    chevronLeft:'<path d="m14 18-6-6 6-6"/>',
    chevronRight:'<path d="m10 18 6-6-6-6"/>',
    x:'<path d="M18 6 6 18M6 6l12 12"/>',
    trash:'<path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/>'
  };
  const icon = (key, size=20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[key] || ICONS.plus}</svg>`;
  const state = {notebooks:[],activeId:null,pageIndex:0,tool:'pen',color:COLORS[0],size:3,zoom:1,penOnly:false,selected:-1,draft:null,drag:null,pointers:new Map(),pinch:null,sidebarOpen:false,saveTimer:null,toastTimer:null,editingText:null,lastPenAt:0,stylusSeen:false,stylusPreferenceChanged:false};
  const history = new Map();
  const imageCache = new Map();
  let database = null, persistence = 'indexeddb', saving = false;
  let workspaceId='guest';
  let tombstones={};
  const workspaceDatabaseName=()=>workspaceId==='guest'?'winds-notes-v2':`winds-notes-account-${workspaceId}`;
  const workspaceLocalStorageKey=()=>workspaceId==='guest'?'winds-notes-data-v2':`winds-notes-data-${workspaceId}`;
  let dirtyAll = false, saveVersion = 0, lastInkAt = 0, thumbnailsDirty = true, thumbnailTimer = 0, inkRAF = 0, drawnIndex = 0;
  let inkComposeTimer = 0, bufferedPenInk = false, bufferedPenItems = [];
  // This log is opt-in, kept entirely on the device, and does not perform any
  // work while its panel is closed. It distinguishes WebKit event loss from
  // application-side stroke rejection when testing on a physical iPad.
  const pencilDiagnostics = {enabled:false,events:[],counts:{down:0,move:0,up:0,cancel:0,touchstart:0,touchend:0,touchmove:0},lastReportAt:0};
  function recordInputEvent(e){
    if(!pencilDiagnostics.enabled)return;
    const target=e.target;
    if(!(target instanceof Element) || !target.closest('#pageShell'))return;
    let kind=e.type.replace('pointer','');
    if(e.type.startsWith('pointer')){
      if(e.type==='pointermove'){
        // Reduce log noise without losing the count of actual input samples.
        pencilDiagnostics.counts.move++;
        if(pencilDiagnostics.counts.move%15!==1)return;
      }else if(kind in pencilDiagnostics.counts)pencilDiagnostics.counts[kind]++;
    }else if(e.type in pencilDiagnostics.counts){
      pencilDiagnostics.counts[e.type]++;
      if(e.type==='touchmove' && pencilDiagnostics.counts.touchmove%15!==1)return;
    }
    const touch=e.changedTouches?.[0];
    const type=e.pointerType||touch?.touchType||'contact';
    const data=`${new Date().toLocaleTimeString()} ${e.type} ${type} ${e.pointerId??touch?.identifier??''}${e.pressure!=null?' p='+e.pressure.toFixed(2):''}`;
    pencilDiagnostics.events.push(data);
    if(pencilDiagnostics.events.length>90)pencilDiagnostics.events.shift();
    const text=$('pencilEventStats');
    if(text){const c=pencilDiagnostics.counts;text.textContent=`Starts ${c.down} · Ends ${c.up} · Cancels ${c.cancel} · Touch starts ${c.touchstart} · Touch ends ${c.touchend}`;}
    const log=$('pencilEventLog');if(log)log.textContent=pencilDiagnostics.events.slice(-15).join('\n');
  }
  function togglePencilDiagnostics(open){
    const panel=$('pencilDiagnostics');if(!panel)return;
    pencilDiagnostics.enabled=Boolean(open);panel.hidden=!open;
    if(open){
      pencilDiagnostics.events=[];
      for(const key of Object.keys(pencilDiagnostics.counts))pencilDiagnostics.counts[key]=0;
      $('pencilEventStats').textContent='Write with Apple Pencil, lifting it between letters.';
      $('pencilEventLog').textContent='Event log will appear here. Nothing is uploaded.';
    }
  }
  function copyPencilDiagnostics(){
    const c=pencilDiagnostics.counts;
    const report=`WiNDS Notes Pencil diagnostics\nBrowser: ${navigator.userAgent}\nCounts: ${JSON.stringify(c)}\nRecent canvas events:\n${pencilDiagnostics.events.join('\n')}`;
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(report).then(()=>toast('Input report copied')).catch(()=>toast('Could not copy report'));
    else toast('Clipboard unavailable on this page');
  }
  // On iPadOS, WebKit's native double-tap / Scribble recognition may consume
  // rapid repeated stylus strokes *before pointerdown is dispatched*.
  // Non-passive touchstart/touchend suppression keeps the browser from treating
  // a handwriting burst as double-tap zoom. touchmove also works around older
  // Scribble interference. Leave two-finger gestures to the application's pan.
  function preventWritingGesture(e){
    if(e.cancelable)e.preventDefault();
  }
  const dirtyBooks = new Set(), dirtyPages = new Set();
  const now = () => new Date().toISOString();
  const makePage = (template,orientation='portrait') => ({id:uid(),template:template || 'ruled',orientation,items:[]});
  const makeNotebook = (title,cover,template,orientation='portrait') => ({id:uid(),title:title.trim() || 'Untitled notebook',cover,createdAt:now(),updatedAt:now(),pages:[makePage(template,orientation)]});
  const notebook = () => state.notebooks.find(n => n.id === state.activeId);
  const page = () => notebook()?.pages[state.pageIndex];
  const filename = title => String(title || 'WiNDS-Notes').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').trim().slice(0,90) || 'WiNDS-Notes';
  const delay = ms => new Promise(resolve => setTimeout(resolve,ms));

  function initIcons(){
    const set = (id, name) => {const el=$(id);if(el)el.innerHTML=icon(name)};
    Object.entries({openFileIcon:'upload',heroPlus:'plus',newPlus:'plus',searchIcon:'search',goLibrary:'back',undoBtn:'undo',redoBtn:'redo',moreOptionsBtn:'more',exportIcon:'download',togglePages:'pages',pencilOnlyIcon:'pencil',insertImageBtn:'image',paperStyleBtn:'paper',pageOrientationBtn:'orientation',addPageSidebar:'plus',addPageTop:'plus',addPageBottomIcon:'plus',zoomOut:'zoomOut',zoomIn:'zoomIn',floatPlus:'plus',prevPage:'chevronLeft',nextPage:'chevronRight',closeModal:'x'}).forEach(([id,name])=>set(id,name));
    document.querySelectorAll('[data-tool]').forEach(btn => btn.innerHTML = icon(btn.dataset.tool));
    $('colorPalette').innerHTML = COLORS.map((c,i)=>`<button class="color-button ${i===0?'selected':''}" data-color="${c}" title="Ink ${i+1}" aria-label="Choose ink color ${i+1}"><span style="background:${c}"></span></button>`).join('');
    $('extendedColors').innerHTML = MORE_COLORS.map(c=>`<button class="extended-swatch" data-more-color="${c}" aria-label="Choose color ${c}" title="${c}" style="--swatch:${c}"></button>`).join('');
    renderEmojiGrid('');
    $('coverChoices').innerHTML = COVER_COLORS.map((c,i)=>`<button class="cover-choice cover-${c} ${i===0?'active':''}" data-cover="${c}" aria-label="${c} cover" title="${c} cover"></button>`).join('');
  }
  // v2 stores notebook metadata and individual pages separately. A stroke saves only
  // its page, rather than serializing every page of every notebook during writing.
  function storageOpen(){
    return new Promise(resolve=>{
      if(!window.indexedDB){persistence='localstorage';resolve();return;}
      try{
        const req=indexedDB.open(workspaceDatabaseName(),1);
        req.onupgradeneeded=()=>{
          const db=req.result;
          if(!db.objectStoreNames.contains('notebooks'))db.createObjectStore('notebooks',{keyPath:'id'});
          if(!db.objectStoreNames.contains('pages'))db.createObjectStore('pages',{keyPath:'id'});
          if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta');
        };
        req.onsuccess=()=>{database=req.result;resolve();};
        req.onerror=req.onblocked=()=>{persistence='localstorage';resolve();};
      }catch(err){persistence='localstorage';resolve();}
    });
  }
  function oldDatabase(){
    return new Promise(resolve=>{
      try{
        const req=indexedDB.open('folio-notes-v1',1);
        req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('app'))req.result.createObjectStore('app');};
        req.onsuccess=()=>{
          const db=req.result;
          try{
            const query=db.transaction('app','readonly').objectStore('app').get('notebooks');
            query.onsuccess=()=>{const result=query.result||null;db.close();resolve(result);};
            query.onerror=()=>{db.close();resolve(null);};
          }catch(err){db.close();resolve(null);}
        };
        req.onerror=()=>resolve(null);
      }catch(err){resolve(null);}
    });
  }
  function loadData(){
    if(persistence==='localstorage'){
      try{return Promise.resolve(JSON.parse(localStorage.getItem(workspaceLocalStorageKey())||(workspaceId==='guest'?localStorage.getItem('folio-notes-data'):null)));}catch(err){return Promise.resolve(null);}
    }
    return new Promise(resolve=>{
      try{
        const tx=database.transaction(['notebooks','pages','meta'],'readonly');
        const booksReq=tx.objectStore('notebooks').getAll();
        const pagesReq=tx.objectStore('pages').getAll();
        const initializedReq=tx.objectStore('meta').get('initialized');
        const deletionsReq=tx.objectStore('meta').get('deleted');
        tx.oncomplete=()=>{
          const books=booksReq.result||[];
          if(!books.length){resolve(initializedReq.result?{version:2,notebooks:[],deleted:deletionsReq.result||{}}:null);return;}
          const byId=new Map((pagesReq.result||[]).map(p=>[p.id,p]));
          const notebooks=books.map(n=>({...n,pages:(n.pages||[]).map(entry=>byId.get(typeof entry==='string'?entry:entry.id)).filter(Boolean)}));
          resolve({version:2,notebooks,deleted:deletionsReq.result||{}});
        };
        tx.onerror=()=>resolve(null);
      }catch(err){resolve(null);}
    });
  }
  function metadata(n){return {...n,pages:n.pages.map(p=>({id:p.id,template:p.template,orientation:p.orientation||'portrait'}))};}
  function writeData(payload){
    if(persistence==='localstorage'){
      localStorage.setItem(workspaceLocalStorageKey(),JSON.stringify({...payload,deleted:tombstones}));return Promise.resolve();
    }
    return new Promise((resolve,reject)=>{
      try{
        const tx=database.transaction(['notebooks','pages','meta'],'readwrite');
        const books=tx.objectStore('notebooks'),pages=tx.objectStore('pages');
        books.clear();pages.clear();tx.objectStore('meta').put(true,'initialized');tx.objectStore('meta').put(tombstones,'deleted');
        for(const n of payload.notebooks){books.put(metadata(n));for(const p of n.pages)pages.put({...p,notebookId:n.id});}
        tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Storage error'));
        tx.onabort=()=>reject(tx.error||new Error('Storage aborted'));
      }catch(err){reject(err);}
    });
  }
  function writeChanged(bookIds,pageIds){
    if(persistence==='localstorage')return writeData({version:2,notebooks:state.notebooks});
    return new Promise((resolve,reject)=>{
      try{
        const tx=database.transaction(['notebooks','pages','meta'],'readwrite');
        const books=tx.objectStore('notebooks'),pages=tx.objectStore('pages');
        tx.objectStore('meta').put(true,'initialized');tx.objectStore('meta').put(tombstones,'deleted');
        for(const id of bookIds){const n=state.notebooks.find(b=>b.id===id);if(n)books.put(metadata(n));}
        for(const id of pageIds){
          for(const n of state.notebooks){const p=n.pages.find(p=>p.id===id);if(p){pages.put({...p,notebookId:n.id});break;}}
        }
        tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Storage error'));
        tx.onabort=()=>reject(tx.error||new Error('Storage aborted'));
      }catch(err){reject(err);}
    });
  }
  function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
  function statusText(message,pending=false){
    const el=$('saveStatus');el.textContent=message;el.classList.toggle('saving',pending);
  }
  function scheduleSave(structural=false){
    const n=notebook();if(n){n.updatedAt=now();dirtyBooks.add(n.id);if(page())dirtyPages.add(page().id);}
    if(structural)dirtyAll=true;
    saveVersion++;lastInkAt=Date.now();
    // A writing burst has a single pending state; there are NO writes between letters.
    if($('saveStatus').textContent!=='Unsaved changes')statusText('Unsaved changes',true);
    clearTimeout(state.saveTimer);
    state.saveTimer=setTimeout(()=>saveNow(),SAVE_IDLE_MS);
  }
  async function saveNow(force=false){
    clearTimeout(state.saveTimer);
    if(saving){state.saveTimer=setTimeout(()=>saveNow(force),600);return;}
    if(!force && (state.drag || Date.now()-lastInkAt<SAVE_IDLE_MS-100)){
      const remaining=Math.max(1000,SAVE_IDLE_MS-(Date.now()-lastInkAt));
      state.saveTimer=setTimeout(()=>saveNow(),remaining);return;
    }
    if(!dirtyAll && !dirtyBooks.size && !dirtyPages.size)return;
    const version=saveVersion,full=dirtyAll;
    const bookIds=[...dirtyBooks],pageIds=[...dirtyPages];
    dirtyAll=false;dirtyBooks.clear();dirtyPages.clear();
    saving=true;
    try{
      if(full)await writeData({version:2,notebooks:state.notebooks});
      else await writeChanged(bookIds,pageIds);
      if(version===saveVersion)statusText('Saved');
      else{statusText('Unsaved changes',true);clearTimeout(state.saveTimer);state.saveTimer=setTimeout(()=>saveNow(),SAVE_IDLE_MS);}
      window.WindsDrive?.onLocalSave?.();
    }catch(err){
      dirtyAll=true;statusText('Not saved — back up your notes',true);
      toast('Saving failed. Export an editable backup to protect your notes.');
      console.error(err);
    }finally{saving=false;}
  }
  // Each signed-in Google identity has a dedicated local IndexedDB.
  // The original installation remains the separate, unsigned guest workspace.
  // Tokens and user credentials are NEVER stored in IndexedDB.
  async function switchWorkspace(accountSub){
    if(accountSub!==null && !/^[a-zA-Z0-9_-]{5,200}$/.test(String(accountSub)))throw new Error('Invalid Google account identifier');
    const target=accountSub?`g-${accountSub}`:'guest';
    if(target===workspaceId)return;
    finishActiveStroke();composeInkNow();commitText();
    await saveNow(true);
    clearTimeout(state.saveTimer);clearTimeout(thumbnailTimer);clearTimeout(inkComposeTimer);
    state.drag=null;state.draft=null;state.pinch=null;state.pointers.clear();
    database?.close();database=null;persistence='indexeddb';workspaceId=target;
    dirtyAll=false;dirtyBooks.clear();dirtyPages.clear();history.clear();
    state.activeId=null;state.pageIndex=0;state.selected=-1;
    await storageOpen();
    const incoming=await loadData();
    state.notebooks=Array.isArray(incoming?.notebooks)?incoming.notebooks:[];
    tombstones=incoming?.deleted&&typeof incoming.deleted==='object'?incoming.deleted:{};
    statusText('Saved');
    $('searchNotebooks').value='';view('library');renderLibrary();
  }
  function workspaceSnapshot(){
    return {format:'winds-notes-backup',version:2,exportedAt:now(),notebooks:clone(state.notebooks),deleted:{...tombstones}};
  }
  async function mergeWorkspace(snapshot){
    if(state.drag)throw new Error('Writing resumed. Cloud synchronization will retry when idle.');
    if(!snapshot || snapshot.format!=='winds-notes-backup' || !Array.isArray(snapshot.notebooks) || snapshot.notebooks.length>750)throw new Error('Invalid Drive workspace');
    const remoteDeleted=snapshot.deleted&&typeof snapshot.deleted==='object'?snapshot.deleted:{};
    const mergedDeleted={...tombstones};
    for(const [id,when] of Object.entries(remoteDeleted))if(typeof when==='string' && (!mergedDeleted[id] || when>mergedDeleted[id]))mergedDeleted[id]=when;
    const merged=new Map(state.notebooks.map(n=>[n.id,n]));
    for(const n of snapshot.notebooks){
      if(!n || typeof n.id!=='string' || typeof n.title!=='string' || !Array.isArray(n.pages)||!n.pages.length||n.pages.length>500 || n.pages.some(p=>!Array.isArray(p.items)||p.items.length>50000))throw new Error('Invalid Drive notebook data');
      const local=merged.get(n.id);
      if(!local || (n.updatedAt||'')>(local.updatedAt||''))merged.set(n.id,n);
    }
    const final=[...merged.values()].filter(n=>!(mergedDeleted[n.id] && mergedDeleted[n.id]>=(n.updatedAt||'')));
    const hasChanges=JSON.stringify(state.notebooks)!==JSON.stringify(final) || JSON.stringify(tombstones)!==JSON.stringify(mergedDeleted);
    if(hasChanges){
      state.notebooks=final;tombstones=mergedDeleted;
      dirtyAll=true;saveVersion++;await saveNow(true);
      // Do not unexpectedly dismiss the writing page during idle cloud sync.
      if(state.activeId && notebook()){state.pageIndex=Math.min(state.pageIndex,notebook().pages.length-1);renderEditor();}
      else{state.activeId=null;view('library');renderLibrary();}
    }
    return hasChanges;
  }
  function seed(){
    const n=makeNotebook('Welcome to WiNDS Notes','purple','dots');const p=n.pages[0];
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
    $('notebookGrid').innerHTML=found.map(n=>`<article class="notebook-card" data-open="${safe(n.id)}" tabindex="0" role="button" aria-label="Open ${safe(n.title)}"><div class="book-cover cover-${COVER_COLORS.includes(n.cover)?n.cover:'purple'}"><div class="cover-name">${safe(n.title)}</div><div class="cover-rule"></div><div class="cover-foot">WiNDS / NOTES</div></div><div class="notebook-meta"><div style="min-width:0"><h3>${safe(n.title)}</h3><p>${n.pages.length} ${n.pages.length===1?'page':'pages'} · ${displayDate(n.updatedAt)}</p></div><button class="card-menu" data-delete="${safe(n.id)}" title="Delete notebook" aria-label="Delete ${safe(n.title)}">${icon('more')}</button></div></article>`).join('');
  }
  function openNotebook(id){
    const n=state.notebooks.find(x=>x.id===id);if(!n)return;
    state.activeId=id;state.pageIndex=0;state.selected=-1;state.zoom=1;RENDER_SCALE=2;state.draft=null;
    state.sidebarOpen=false;thumbnailsDirty=true;
    view('editor');$('notebookTitle').value=n.title;
    syncPageGeometry();updateSidebar();setTool('pen');renderEditor();resizePage();requestAnimationFrame(updateToolbarArrows);
  }
  function goLibrary(){finishActiveStroke();commitText();state.draft=null;composeInkNow();saveNow(true);state.activeId=null;view('library');renderLibrary();}
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
    $('editorScrim').hidden=!state.sidebarOpen;
    $('togglePages').classList.toggle('active',state.sidebarOpen);
    $('togglePages').setAttribute('aria-pressed',String(state.sidebarOpen));
    if(state.sidebarOpen && thumbnailsDirty)renderThumbs(true);
  }
  function switchPage(index){
    finishActiveStroke();const n=notebook();if(!n||index<0||index>=n.pages.length)return;
    composeInkNow();commitText();state.pageIndex=index;state.selected=-1;state.draft=null;syncPageGeometry();resizePage();renderEditor();
    $('pageScroller').scrollTop=0;
    if(state.sidebarOpen){state.sidebarOpen=false;updateSidebar();}
  }
  function addPage(){
    finishActiveStroke();const n=notebook();if(!n)return;
    composeInkNow();commitText();n.pages.splice(state.pageIndex+1,0,makePage(page()?.template||'ruled',page()?.orientation||'portrait'));
    state.pageIndex++;state.selected=-1;syncPageGeometry();resizePage();renderEditor();scheduleSave(true);
    $('pageScroller').scrollTop=0;toast('New page added');
  }
  function duplicatePage(){const n=notebook();if(!n)return;finishActiveStroke();composeInkNow();commitText();const dupe=clone(page());dupe.id=uid();dupe.items.forEach(it=>it.id=uid());n.pages.splice(state.pageIndex+1,0,dupe);state.pageIndex++;syncPageGeometry();resizePage();renderEditor();scheduleSave(true);toast('Page duplicated');}
  function deletePage(index){
    const n=notebook();if(!n)return;
    if(n.pages.length===1){toast('A notebook needs at least one page');return;}
    if(!confirm(`Delete page ${index+1}? This cannot be undone.`))return;
    finishActiveStroke();composeInkNow();commitText();n.pages.splice(index,1);state.pageIndex=Math.min(state.pageIndex,n.pages.length-1);state.selected=-1;syncPageGeometry();resizePage();renderEditor();scheduleSave(true);toast('Page removed');
  }
  function renderThumbs(force=false){
    thumbnailsDirty=true;
    if(!state.sidebarOpen)return;
    clearTimeout(thumbnailTimer);
    if(!force){thumbnailTimer=setTimeout(()=>renderThumbs(true),720);return;}
    const n=notebook();if(!n)return;
    thumbnailsDirty=false;
    $('thumbList').innerHTML=n.pages.map((p,i)=>{
      const d=pageDimensions(p),th=Math.round(250*d.height/d.width);
      return `<div class="page-thumb ${i===state.pageIndex?'active':''}" data-page="${i}"><div class="thumb-canvas-wrap" style="height:${Math.round(125*d.height/d.width)}px"><canvas width="250" height="${th}" data-preview="${i}" aria-hidden="true"></canvas></div><div class="thumb-meta">Page ${i+1}<button data-remove-page="${i}" class="thumb-actions" title="Delete page ${i+1}" aria-label="Delete page ${i+1}">${icon('trash')}</button></div></div>`;
    }).join('');
    document.querySelectorAll('[data-preview]').forEach(el=>{const i=Number(el.dataset.preview),d=pageDimensions(n.pages[i]);const ctx=el.getContext('2d');ctx.setTransform(el.width/d.width,0,0,el.height/d.height,0,0);drawPage(ctx,n.pages[i]);});
  }
  function pageBaseWidth(){const scroller=$('pageScroller');return Math.min(W,Math.max(250,scroller.clientWidth-32));}
  function resizePage(skipRender=false){if($('editorView').hidden)return;if(!skipRender)syncPageGeometry();const width=Math.round(pageBaseWidth()*state.zoom);$('pageShell').style.width=`${width}px`;$('zoomValue').textContent=`${Math.round(state.zoom*100)}%`;if(!skipRender)renderCanvas();}
  function changeZoom(amount){finishActiveStroke();state.zoom=Math.min(3.5,Math.max(.5,Math.round((state.zoom+amount)*100)/100));adjustInkResolution();resizePage();}
  function setOrientation(orientation){
    if(!page() || !ORIENTATIONS[orientation])return;
    finishActiveStroke();composeInkNow();commitText();
    const p=page(),previous=pageDimensions(p),next=ORIENTATIONS[orientation];
    if(previous.width===next.width&&previous.height===next.height)return;
    const factor=Math.min(next.width/previous.width,next.height/previous.height);
    const ox=(next.width-previous.width*factor)/2,oy=(next.height-previous.height*factor)/2;
    if(p.items.length)remember();
    for(const item of p.items){
      if(item.type==='stroke'){
        item.points=item.points.map(([x,y,pressure])=>[x*factor+ox,y*factor+oy,pressure]);
        item.size*=factor;
      }else{
        item.x=item.x*factor+ox;item.y=item.y*factor+oy;
        if(item.w!=null)item.w*=factor;
        if(item.h!=null)item.h*=factor;
        if(item.size!=null)item.size*=factor;
      }
    }
    p.orientation=orientation;state.selected=-1;
    syncPageGeometry();resizePage();renderEditor();renderThumbs();
    scheduleSave();closeMenus();
    requestAnimationFrame(()=>{$('editorToolbar').scrollLeft=0;updateToolbarArrows();});
    toast(orientation==='landscape'?'Landscape page selected':'Portrait page selected');
  }
  function setTool(tool){
    finishActiveStroke();composeInkNow();commitText();state.tool=tool;state.selected=-1;state.draft=null;
    document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    $('inkCanvas').classList.toggle('cursor-eraser',tool==='eraser');
    $('inkCanvas').classList.toggle('cursor-select',tool==='select');
    $('inkCanvas').classList.toggle('cursor-text',tool==='text');
    renderCanvas();
  }
  function setColor(c){
    if(!/^#[0-9a-f]{6}$/i.test(c))return;
    state.color=c;
    document.querySelectorAll('[data-color],[data-more-color]').forEach(b=>b.classList.toggle('selected',(b.dataset.color||b.dataset.moreColor)?.toLowerCase()===c.toLowerCase()));
    $('sizePreview').style.background=c;
    $('customColorInput').value=c;
    $('customColorBtn').style.setProperty('--chosen-color',c);
  }
  function renderEmojiGrid(query){
    const q=String(query||'').trim().toLowerCase();
    const chosen=EMOJI_STICKERS.filter(([emoji,name])=>name.toLowerCase().includes(q)||emoji.includes(q));
    $('emojiGrid').innerHTML=chosen.map(([emoji,name])=>`<button class="emoji-cell" data-emoji="${emoji}" title="${name}" aria-label="Insert ${name}">${emoji}</button>`).join('')||'<p class="emoji-empty">No stickers found</p>';
  }
  function addEmoji(emoji){
    if(!page() || !EMOJI_STICKERS.some(e=>e[0]===emoji))return;
    finishActiveStroke();commitText();composeInkNow();
    const scroller=$('pageScroller'),rect=$('pageCanvas').getBoundingClientRect();
    const viewport=scroller.getBoundingClientRect();
    const x=Math.max(56,Math.min(W-120,(viewport.left+viewport.width*.5-rect.left)/rect.width*W-44));
    const y=Math.max(58,Math.min(H-110,(viewport.top+viewport.height*.35-rect.top)/rect.height*H-44));
    const item={id:uid(),type:'sticker',emoji,x,y,size:Number($('stickerSize').value)||78};
    rememberAppend(item);page().items.push(item);
    setTool('select');state.selected=page().items.length-1;
    closeMenus();renderCanvas();renderThumbs();scheduleSave();toast('Sticker added · drag to move');
  }
  function updateSize(){state.size=Number($('penSize').value);$('sizeLabel').textContent=String(state.size);const diameter=Math.max(4,Math.min(state.size,14));$('sizePreview').style.width=`${diameter}px`;$('sizePreview').style.height=`${diameter}px`;}
  function historyForPage(){const key=page()?.id;if(!key)return null;if(!history.has(key))history.set(key,{undo:[],redo:[]});return history.get(key);}
  function recordHistory(action){
    const h=historyForPage();if(!h)return;
    h.undo.push(action);if(h.undo.length>70)h.undo.shift();h.redo=[];updateHistoryButtons();
  }
  function remember(){recordHistory({kind:'snapshot',items:clone(page().items)});}
  function rememberAppend(item){recordHistory({kind:'append',item:clone(item)});}
  function undo(){
    commitText();const h=historyForPage();if(!h?.undo.length)return;
    const action=h.undo.pop();
    if(action.kind==='append'){
      const index=page().items.findIndex(i=>i.id===action.item.id);
      if(index>=0)page().items.splice(index,1);
      h.redo.push(action);
    }else{h.redo.push({kind:'snapshot',items:clone(page().items)});page().items=action.items;}
    state.selected=-1;renderEditor();scheduleSave();
  }
  function redo(){
    commitText();const h=historyForPage();if(!h?.redo.length)return;
    const action=h.redo.pop();
    if(action.kind==='append'){page().items.push(clone(action.item));h.undo.push(action);}
    else{h.undo.push({kind:'snapshot',items:clone(page().items)});page().items=action.items;}
    state.selected=-1;renderEditor();scheduleSave();
  }
  function updateHistoryButtons(){const h=historyForPage();$('undoBtn').disabled=!h?.undo.length;$('redoBtn').disabled=!h?.redo.length;}
  function drawTemplate(ctx,kind,dimensions){
    const {width:PW,height:PH}=dimensions;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,PW,PH);
    ctx.lineWidth=1;
    if(kind==='ruled'){
      ctx.strokeStyle='#e1e7f3';ctx.beginPath();for(let y=122;y<PH-55;y+=36){ctx.moveTo(0,y+.5);ctx.lineTo(PW,y+.5);}ctx.stroke();
      ctx.strokeStyle='#f2d8dd';ctx.beginPath();ctx.moveTo(73,0);ctx.lineTo(73,PH);ctx.stroke();
    }else if(kind==='grid'){
      ctx.strokeStyle='#e7eaf4';ctx.beginPath();for(let y=0;y<PH;y+=32){ctx.moveTo(0,y+.5);ctx.lineTo(PW,y+.5);}for(let x=0;x<PW;x+=32){ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,PH);}ctx.stroke();
    }else if(kind==='dots'){
      ctx.fillStyle='#d7def0';for(let y=33;y<PH;y+=30)for(let x=33;x<PW;x+=30){ctx.beginPath();ctx.arc(x,y,1.15,0,Math.PI*2);ctx.fill();}
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
  // Quadratic midpoint ink: continuous rounded curves instead of visibly
  // angular joins. The same routine is used by the live Pencil layer, local
  // pages and exported files. Pressure is blended to prevent sudden spikes.
  function inkWidth(item,point){
    const pressure=Number.isFinite(point?.[2])?point[2]:.68;
    return Math.max(.85,item.size*(.35+.65*Math.max(.1,Math.min(1,pressure))));
  }
  function midpoint(a,b){return [(a[0]+b[0])*.5,(a[1]+b[1])*.5];}
  function inkLine(ctx,item,a,b,control){
    if(control){
      ctx.beginPath();ctx.moveTo(a[0],a[1]);
      ctx.quadraticCurveTo(control[0],control[1],b[0],b[1]);
    }else{ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}
    ctx.stroke();
  }
  function smoothPenPart(ctx,item,points,index){
    const n=points.length;
    if(index===0){
      const pt=points[0];ctx.beginPath();ctx.arc(pt[0],pt[1],inkWidth(item,pt)*.5,0,Math.PI*2);ctx.fill();return;
    }
    if(index===1){
      const a=points[0],b=points[1];
      ctx.lineWidth=(inkWidth(item,a)+inkWidth(item,b))*.5;
      inkLine(ctx,item,a,midpoint(a,b));return;
    }
    const a=points[index-2],b=points[index-1],c=points[index];
    const wa=inkWidth(item,a),wb=inkWidth(item,b),wc=inkWidth(item,c);
    // Blend adjacent pressure samples to avoid sharp thick/thin jumps.
    ctx.lineWidth=(wa+2*wb+wc)*.25;
    inkLine(ctx,item,midpoint(a,b),midpoint(b,c),b);
  }
  function smoothPenEnd(ctx,item,points){
    if(points.length<2)return;
    const a=points[points.length-2],b=points[points.length-1];
    ctx.lineWidth=(inkWidth(item,a)+inkWidth(item,b))*.5;
    inkLine(ctx,item,midpoint(a,b),b);
  }
  function drawStroke(ctx,item){
    const ps=item.points;if(!ps?.length)return;
    ctx.save();ctx.strokeStyle=item.color;ctx.fillStyle=item.color;
    ctx.lineCap='round';ctx.lineJoin='round';
    if(item.tool==='highlighter'){
      ctx.globalAlpha=.27;ctx.lineWidth=Math.max(8,item.size*5.7);
      ctx.beginPath();ctx.moveTo(ps[0][0],ps[0][1]);
      if(ps.length===1){ctx.arc(ps[0][0],ps[0][1],ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}
      else{
        for(let i=1;i<ps.length-1;i++){const m=midpoint(ps[i],ps[i+1]);ctx.quadraticCurveTo(ps[i][0],ps[i][1],m[0],m[1]);}
        const end=ps[ps.length-1];ctx.lineTo(end[0],end[1]);ctx.stroke();
      }
    }else{
      for(let i=0;i<ps.length;i++)smoothPenPart(ctx,item,ps,i);
      smoothPenEnd(ctx,item,ps);
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
      else if(item.kind==='triangle'){ctx.moveTo(item.x+item.w/2,item.y);ctx.lineTo(item.x+item.w,item.y+item.h);ctx.lineTo(item.x,item.y+item.h);ctx.closePath();}
      else if(item.kind==='diamond'){ctx.moveTo(item.x+item.w/2,item.y);ctx.lineTo(item.x+item.w,item.y+item.h/2);ctx.lineTo(item.x+item.w/2,item.y+item.h);ctx.lineTo(item.x,item.y+item.h/2);ctx.closePath();}
      else if(item.kind==='star'){
        const cx=item.x+item.w/2,cy=item.y+item.h/2,rOuter=Math.max(1,Math.min(Math.abs(item.w),Math.abs(item.h))/2),rInner=rOuter*.44;
        for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?rInner:rOuter;const px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();
      }else{
        ctx.moveTo(item.x,item.y);ctx.lineTo(item.x+item.w,item.y+item.h);
        if(item.kind==='arrow'){
          const ang=Math.atan2(item.h,item.w),len=Math.min(25,Math.max(12,item.size*5));
          const ex=item.x+item.w,ey=item.y+item.h;
          ctx.moveTo(ex-len*Math.cos(ang-.58),ey-len*Math.sin(ang-.58));ctx.lineTo(ex,ey);ctx.lineTo(ex-len*Math.cos(ang+.58),ey-len*Math.sin(ang+.58));
        }
      }
      ctx.stroke();
    }else if(item.type==='sticker'){
      ctx.textBaseline='top';ctx.textAlign='left';
      ctx.font=`${item.size||78}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
      ctx.fillText(item.emoji,item.x,item.y);
    }else if(item.type==='image'){
      if(!imageCache.has(item.src)){
        const img=new Image();imageCache.set(item.src,img);img.onload=()=>{if(!document.hidden)renderCanvas();};img.src=item.src;
      }
      const img=imageCache.get(item.src);if(img?.complete&&img.naturalWidth)ctx.drawImage(img,item.x,item.y,item.w,item.h);
    }
    ctx.restore();
  }
  function drawPage(ctx,p,withoutSelection=true){
    if(!p)return;drawTemplate(ctx,p.template||'ruled',pageDimensions(p));
    for(const item of p.items)drawItem(ctx,item);
    if(!withoutSelection){
      if(state.draft)drawItem(ctx,state.draft);
      if(state.selected>=0 && p.items[state.selected]){
        const b=itemBounds(p.items[state.selected]);ctx.save();ctx.strokeStyle='#6557ed';ctx.lineWidth=1.7;ctx.setLineDash([8,6]);ctx.strokeRect(b.x-8,b.y-8,b.w+16,b.h+16);ctx.restore();
      }
    }
  }
  // The committed page is redrawn only after a completed edit, never on every
  // Apple Pencil movement. The transparent ink layer renders new segments only.
  function inkContext(){const ctx=$('inkCanvas').getContext('2d');ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);return ctx;}
  function scheduleInkComposition(){
    // New letters stay on the transparent live-ink canvas until writing pauses.
    // The idle merge is incremental: never repaint all earlier strokes.
    bufferedPenInk=true;
    clearTimeout(inkComposeTimer);
    inkComposeTimer=setTimeout(()=>{
      inkComposeTimer=0;
      if(state.drag?.kind==='draw'||state.draft){scheduleInkComposition();return;}
      composeInkNow();
    },INK_COMPOSE_IDLE_MS);
  }
  function composeInkNow(){
    clearTimeout(inkComposeTimer);inkComposeTimer=0;
    if(!bufferedPenInk)return;
    const ctx=$('pageCanvas').getContext('2d',{alpha:false});
    ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
    for(const item of bufferedPenItems)drawItem(ctx,item);
    bufferedPenItems=[];bufferedPenInk=false;
    clearInk();
    if(state.selected>=0)drawSelection(inkContext());
  }
  function clearInk(){
    if(inkRAF){cancelAnimationFrame(inkRAF);inkRAF=0;}
    const ctx=inkContext();ctx.clearRect(0,0,W,H);drawnIndex=0;
  }
  function drawSelection(ctx){
    const it=page()?.items[state.selected];if(!it)return;
    const b=itemBounds(it);ctx.save();ctx.strokeStyle='#6557ed';ctx.lineWidth=1.7;ctx.setLineDash([8,6]);ctx.strokeRect(b.x-8,b.y-8,b.w+16,b.h+16);ctx.restore();
  }
  function paintPendingInk(finalize=false){
    inkRAF=0;
    const ctx=inkContext(),item=state.draft;
    if(!item){drawSelection(ctx);return;}
    if(item.type!=='stroke'||item.tool==='highlighter'){
      ctx.clearRect(0,0,W,H);drawItem(ctx,item);drawSelection(ctx);return;
    }
    const pts=item.points;
    ctx.save();ctx.strokeStyle=item.color;ctx.fillStyle=item.color;
    ctx.lineCap='round';ctx.lineJoin='round';
    for(let i=drawnIndex;i<pts.length;i++)smoothPenPart(ctx,item,pts,i);
    drawnIndex=pts.length;
    if(finalize)smoothPenEnd(ctx,item,pts);
    ctx.restore();
  }
  function queueInk(){if(!inkRAF)inkRAF=requestAnimationFrame(paintPendingInk);}
  function renderCanvas(){
    const p=page();if(!p)return;
    syncPageGeometry();
    clearTimeout(inkComposeTimer);inkComposeTimer=0;bufferedPenInk=false;bufferedPenItems=[];
    const canvas=$('pageCanvas'),ctx=canvas.getContext('2d',{alpha:false});
    ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
    drawPage(ctx,p,true);clearInk();
    if(state.draft)queueInk();else drawSelection(inkContext());
  }
  function commitInkToPage(item){
    const ctx=$('pageCanvas').getContext('2d');
    ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);drawItem(ctx,item);clearInk();
    if(state.selected>=0)drawSelection(inkContext());
  }
  function renderExportCanvas(p){
    const canvas=document.createElement('canvas');const dims=pageDimensions(p);canvas.width=dims.width*EXPORT_SCALE;canvas.height=dims.height*EXPORT_SCALE;
    const ctx=canvas.getContext('2d',{alpha:false});ctx.setTransform(EXPORT_SCALE,0,0,EXPORT_SCALE,0,0);drawPage(ctx,p,true);return canvas;
  }
  function itemBounds(item){
    if(item.type==='stroke'){
      const pts=item.points||[];if(!pts.length)return{x:0,y:0,w:0,h:0};
      // Incremental bounds avoid argument-list overflow for long pencil strokes.
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const point of pts){minX=Math.min(minX,point[0]);minY=Math.min(minY,point[1]);maxX=Math.max(maxX,point[0]);maxY=Math.max(maxY,point[1]);}
      const pad=Math.max(7,item.size*(item.tool==='highlighter'?3:1));
      return {x:minX-pad,y:minY-pad,w:maxX-minX+2*pad,h:maxY-minY+2*pad};
    }
    if(item.type==='text')return{x:item.x,y:item.y,w:item.w||480,h:textGeometry(item).h};
    if(item.type==='sticker')return{x:item.x,y:item.y,w:item.size||78,h:item.size||78};
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
  function point(ev,rect=state.drag?.rect){rect=rect||$('inkCanvas').getBoundingClientRect();return{x:(ev.clientX-rect.left)/rect.width*W,y:(ev.clientY-rect.top)/rect.height*H,p:ev.pointerType==='pen'&&ev.pressure>0?ev.pressure:.68};}
  function clampPoint(p){return{x:Math.max(0,Math.min(W,p.x)),y:Math.max(0,Math.min(H,p.y)),p:p.p};}
  function appendPoint(stroke,p){const arr=stroke.points,prev=arr[arr.length-1];if(!prev){arr.push([p.x,p.y,p.p]);return;}const d=Math.hypot(prev[0]-p.x,prev[1]-p.y);if(d>=.55){const pressure=Math.max(.12,Math.min(1,prev[2]*.58+p.p*.42));arr.push([p.x,p.y,pressure]);}else if(d>.03){prev[2]=prev[2]*.72+p.p*.28;}}
  let pinchRAF=0;
  function queuePinchFrame(){
    if(pinchRAF)return;
    pinchRAF=requestAnimationFrame(()=>{
      pinchRAF=0;const pinch=state.pinch;
      if(!pinch?.next||!page())return;
      const {zoom,center}=pinch.next;
      state.zoom=zoom;
      // Transform only the CSS page width. The high-resolution ink canvas
      // is not re-rendered every time a finger moves.
      resizePage(true);
      const rect=$('pageShell').getBoundingClientRect();
      const scroller=$('pageScroller');
      scroller.scrollLeft+=rect.left+rect.width*pinch.anchorX-center.x;
      scroller.scrollTop+=rect.top+rect.height*pinch.anchorY-center.y;
    });
  }
  function endPinch(){
    if(pinchRAF){cancelAnimationFrame(pinchRAF);pinchRAF=0;}
    state.pinch=null;state.drag=null;
    // Redraw vector strokes once, AFTER the gesture (never per finger move).
    if(adjustInkResolution())renderCanvas();
  }
  function adjustInkResolution(){
    const next=state.zoom>=1.6?2.75:2;
    if(Math.abs(RENDER_SCALE-next)<.1)return false;
    RENDER_SCALE=next;return true;
  }
  function pointerDown(ev){
    if(!page()||state.editingText)return;
    if(ev.pointerType==='mouse' && ev.button!==0)return;
    if(ev.pointerType==='pen'){
      state.lastPenAt=Date.now();
      // A new Apple Pencil contact is definitive evidence that the preceding
      // contact ended. Some WebKit builds omit pointerup/lostpointercapture,
      // leaving state.drag set and causing every subsequent letter to be lost.
      // Do not throw away the previous stroke: finish it before accepting this.
      if(state.drag?.kind==='draw' || state.drag?.kind==='erase' || state.drag?.kind==='select'){
        finishPointer({pointerId:state.drag.pointerId},true);
      }
      if(!state.stylusSeen){
        state.stylusSeen=true;
        // Do not silently change the user's input mode. Safari may report
        // mixed pointer types during rapid Pencil contacts; auto-switching
        // to stylus-only can mistakenly reject valid contacts. Users may
        // explicitly enable Stylus only when they want finger panning.
      }
      // A resting finger/palm must NEVER lock out the next Apple Pencil stroke.
      if(state.drag?.pointerId!==undefined && state.drag.pointerId!==ev.pointerId && state.drag.pointerType==='touch'){
        const previous=state.drag.pointerId;
        finishPointer({pointerId:previous},true);
      }
      if(state.drag?.kind==='pan' || state.pinch){state.drag=null;state.pinch=null;}
      state.pointers.clear();
    }
    const sincePencil=Date.now()-state.lastPenAt;
    if(ev.pointerType==='touch'){
      // Track two contacts even when finger drawing is enabled. The former
      // implementation restricted zoom to the Stylus-only toggle.
      state.pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
      if(state.pointers.size===2 && state.drag?.pointerType!=='pen'){
        const contacts=[...state.pointers.values()];
        const center={x:(contacts[0].x+contacts[1].x)/2,y:(contacts[0].y+contacts[1].y)/2};
        const rect=$('pageShell').getBoundingClientRect();
        const distance=Math.max(12,Math.hypot(contacts[0].x-contacts[1].x,contacts[0].y-contacts[1].y));
        // Remove accidental finger ink as the second finger establishes zoom.
        if(state.drag?.pointerType==='touch'){
          state.drag=null;state.draft=null;
          $('pageShell').classList.remove('is-handdrawing');
          renderCanvas();
        }
        state.pinch={distance,zoom:state.zoom,anchorX:(center.x-rect.left)/rect.width,anchorY:(center.y-rect.top)/rect.height};
        for(const id of state.pointers.keys())try{ev.currentTarget.setPointerCapture(id);}catch{}
        if(ev.cancelable)ev.preventDefault();return;
      }
      if(state.pinch){if(ev.cancelable)ev.preventDefault();return;}
      if(state.drag || state.pointers.size!==1)return;
      // A single palm contact after Pencil input must never begin a stroke.
      if(sincePencil<PALM_GUARD_MS){if(ev.cancelable)ev.preventDefault();return;}
      if(state.penOnly){
        state.drag={kind:'pan',pointerId:ev.pointerId,pointerType:'touch',lastX:ev.clientX,lastY:ev.clientY};
        try{ev.currentTarget.setPointerCapture(ev.pointerId);}catch{}
        if(ev.cancelable)ev.preventDefault();return;
      }
    }
    const rect=$('inkCanvas').getBoundingClientRect();
    const p=clampPoint(point(ev,rect));
    if(state.drag || state.pinch || (state.penOnly && ev.pointerType!=='pen'))return;
    if(ev.cancelable)ev.preventDefault();
    if(state.tool==='text'){
      const at=hitTest(p.x,p.y);
      if(at!==-1&&page().items[at].type==='text')beginText(p.x,p.y,at);else beginText(p.x,p.y);
      return;
    }
    try{ev.currentTarget.setPointerCapture(ev.pointerId);}catch(err){}
    if(state.tool==='eraser'){
      composeInkNow();state.drag={kind:'erase',pointerId:ev.pointerId,pointerType:ev.pointerType,rect,changed:false};eraseAt(p.x,p.y);return;
    }
    if(state.tool==='select'){
      composeInkNow();const idx=hitTest(p.x,p.y);state.selected=idx;
      state.drag={kind:'select',pointerId:ev.pointerId,pointerType:ev.pointerType,rect,startX:p.x,startY:p.y,startItems:clone(page().items),changed:false};
      renderCanvas();return;
    }
    if(state.tool==='pen'||state.tool==='highlighter')state.draft={id:uid(),type:'stroke',tool:state.tool,color:state.color,size:state.size,points:[[p.x,p.y,p.p]]};
    else if(['rectangle','ellipse','line','arrow','triangle','diamond','star'].includes(state.tool))state.draft={id:uid(),type:'shape',kind:state.tool,x:p.x,y:p.y,w:0,h:0,color:state.color,size:state.size};
    else return;
    // Only the pen's incremental strokes remain in the live layer across letters.
    // Highlighter/shape previews retain their full-repaint behavior.
    if(state.tool!=='pen')composeInkNow();
    clearTimeout(inkComposeTimer);inkComposeTimer=0;
    state.drag={kind:'draw',pointerId:ev.pointerId,pointerType:ev.pointerType,rect,startX:p.x,startY:p.y};
    $('pageShell').classList.add('is-handdrawing');
    if(state.tool==='pen')drawnIndex=0;
    else clearInk();
    queueInk();
  }
  function pointerMove(ev){
    if(ev.pointerType==='pen'){
      state.lastPenAt=Date.now();
      // Recover when a pressed stylus MOVE arrives without its DOWN event.
      // Hover has pressure 0 and is never converted into handwriting.
      if(!state.drag && !state.pinch && ev.pressure>0.01 &&
         (ev.buttons&1) && ['pen','highlighter'].includes(state.tool) &&
         !state.editingText && page())pointerDown(ev);
    }
    if(ev.pointerType==='touch'&&state.pointers.has(ev.pointerId))state.pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    if(state.pinch){
      if(state.pointers.size>=2){
        const contacts=[...state.pointers.values()];
        const distance=Math.max(12,Math.hypot(contacts[0].x-contacts[1].x,contacts[0].y-contacts[1].y));
        const center={x:(contacts[0].x+contacts[1].x)/2,y:(contacts[0].y+contacts[1].y)/2};
        state.pinch.next={zoom:Math.max(.5,Math.min(3.5,state.pinch.zoom*distance/state.pinch.distance)),center};
        queuePinchFrame();
      }
      if(ev.cancelable)ev.preventDefault();return;
    }
    if(!state.drag||state.drag.pointerId!==ev.pointerId)return;
    if(ev.cancelable)ev.preventDefault();
    const p=clampPoint(point(ev));
    if(state.drag.kind==='pan'){
      const scroller=$('pageScroller');scroller.scrollLeft-=ev.clientX-state.drag.lastX;
      scroller.scrollTop-=ev.clientY-state.drag.lastY;state.drag.lastX=ev.clientX;state.drag.lastY=ev.clientY;return;
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
      page().items[i]=item;queueBaseRefresh();return;
    }
    if(state.drag.kind==='draw'&&state.draft){
      if(state.draft.type==='stroke'){
        const events=ev.getCoalescedEvents?ev.getCoalescedEvents():[ev];
        for(const co of events)appendPoint(state.draft,clampPoint(point(co)));
        appendPoint(state.draft,p);
      }else{state.draft.w=p.x-state.drag.startX;state.draft.h=p.y-state.drag.startY;}
      queueInk();
    }
  }
  let baseRefreshRAF=0;
  function queueBaseRefresh(){if(!baseRefreshRAF)baseRefreshRAF=requestAnimationFrame(()=>{baseRefreshRAF=0;renderCanvas();});}
  function finishPointer(ev,cancelled=false){
    state.pointers.delete(ev.pointerId);
    if(state.pinch){if(state.pointers.size<2){endPinch();state.pointers.clear();}return;}
    if(!state.drag||state.drag.pointerId!==ev.pointerId)return;
    if(state.drag.kind==='draw'&&state.draft){
      if(!cancelled && Number.isFinite(ev.clientX) && Number.isFinite(ev.clientY)){
        const p=clampPoint(point(ev));
        if(state.draft.type==='stroke')appendPoint(state.draft,p);
        else{state.draft.w=p.x-state.drag.startX;state.draft.h=p.y-state.drag.startY;}
      }
      const item=state.draft;
      if(item.type==='stroke' || Math.abs(item.w)+Math.abs(item.h)>3){
        // Commit the data immediately for undo / export; do not compose an entire
        // page or write IndexedDB at the pen-up boundary.
        rememberAppend(item);page().items.push(item);
        if(item.type==='stroke'&&item.tool==='pen'){
          if(inkRAF){cancelAnimationFrame(inkRAF);inkRAF=0;}
          paintPendingInk(true);
          state.draft=null;
          bufferedPenItems.push(item);scheduleInkComposition();
        }else{
          state.draft=null;renderCanvas();
        }
        scheduleSave();renderThumbs();
      }else{state.draft=null;renderCanvas();}
    }else if(state.drag.kind==='erase'&&state.drag.changed){scheduleSave();renderThumbs();renderCanvas();}
    else if(state.drag.kind==='select'&&state.drag.changed){scheduleSave();renderThumbs();renderCanvas();}
    state.drag=null;$('pageShell').classList.remove('is-handdrawing');
  }
  function pointerUp(ev){finishPointer(ev,false);}
  function pointerCancel(ev){finishPointer(ev,true);}
  function pointerLostCapture(ev){if(state.drag?.pointerId===ev.pointerId)finishPointer(ev,true);}
  function finishActiveStroke(){if(state.drag?.kind==='draw')finishPointer({pointerId:state.drag.pointerId},true);}
  function eraseAt(x,y){const idx=hitTest(x,y,true);if(idx<0)return;if(!state.drag?.changed){remember();state.drag.changed=true;}page().items.splice(idx,1);state.selected=-1;queueBaseRefresh();}
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
  async function backup(){commitText();await saveNow();const json=JSON.stringify({format:'winds-notes-backup',version:1,exportedAt:now(),notebooks:state.notebooks},null,2);downloadBlob(new Blob([json],{type:'application/json'}),'WiNDS-Notes-backup.json');toast('Backup downloaded');}
  function saveNativeNotebook(){
    const n=notebook();if(!n)return;
    finishActiveStroke();commitText();
    // The native file contains the complete editable notebook: pen sample points,
    // typed text, shapes, imported images, paper styles, and all pages.
    try{
      const json=window.WindsFile.serialize(n);
      downloadBlob(new Blob([json],{type:'application/octet-stream'}),`${filename(n.title)}.winds-notes`);
      toast('Editable WiNDS Notes file saved · choose Save to Files on iPad');
    }catch(err){console.error(err);toast('Could not save this notebook');}
  }
  async function openEditableFile(file){
    if(!file)return;
    if(file.size>window.WindsFile.MAX_FILE_BYTES){toast('File is too large (100 MB maximum)');return;}
    try{
      // Parsing validates each object before any current notebook is modified.
      const data=window.WindsFile.parse(await file.text());
      finishActiveStroke();commitText();
      // Re-key imported notebook/page/object IDs, preserving all other data.
      // This is non-destructive: importing never overwrites any existing notebook.
      state.notebooks.push(...data.notebooks);
      dirtyAll=true;saveVersion++;
      await saveNow(true);
      if(dirtyAll){toast('Notebook opened, but device storage could not save it. Export another copy.');}
      $('searchNotebooks').value='';
      if(data.single){openNotebook(data.notebooks[0].id);if(!dirtyAll)toast('Notebook opened · all pages remain editable');}
      else{state.activeId=null;view('library');renderLibrary();if(!dirtyAll)toast(`${data.notebooks.length} notebooks imported without replacing existing notes`);}
    }catch(err){
      console.error('WiNDS Notes import:',err);
      toast(err?.message?.slice(0,110)||'Unable to open this notebook file');
    }
  }
  async function restore(file){
    if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(data.format==='winds-notes'){await openEditableFile(file);return;}
      if(!['winds-notes-backup','folio-notes-backup'].includes(data.format)||!Array.isArray(data.notebooks)||data.notebooks.length>500)throw Error('Invalid notebook backup');
      const valid=data.notebooks.every(n=>typeof n.title==='string'&&Array.isArray(n.pages)&&n.pages.length>0&&n.pages.every(p=>Array.isArray(p.items)&&['ruled','grid','dots','blank'].includes(p.template)));
      if(!valid)throw Error('Invalid notebook structure');
      if(!confirm(`Import ${data.notebooks.length} notebook(s)? Notebooks with matching IDs will be replaced.`))return;
      for(const incoming of data.notebooks){const index=state.notebooks.findIndex(n=>n.id===incoming.id);if(index>=0)state.notebooks[index]=incoming;else state.notebooks.push(incoming);}
      dirtyAll=true;saveVersion++;await saveNow(true);goLibrary();renderLibrary();toast('Notebooks restored successfully');
    }catch(err){console.error(err);toast('Not a valid WiNDS Notes backup');}
  }
  async function exportCurrent(format){
    const n=notebook();if(!n)return;
    commitText();closeMenus();
    if(format==='native'){saveNativeNotebook();return;}
    if(format==='json'){await backup();return;}
    const button=$('exportBtn');button.disabled=true;button.querySelector('span:last-child').textContent='Working…';
    try{
      if(format==='pdf'){
        const images=[];
        for(let i=0;i<n.pages.length;i++){
          const c=renderExportCanvas(n.pages[i]);const bytes=window.WindsPDF.dataUrlToBytes(c.toDataURL('image/jpeg',.9));
          images.push({width:c.width,height:c.height,bytes});await delay(0);
        }
        downloadBlob(window.WindsPDF.writePdf(images),`${filename(n.title)}.pdf`);
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
    $('modalBackdrop').hidden=false;$('newNotebookTitle').value='Untitled notebook';$('newPaperStyle').value='ruled';$('newPageOrientation').value='portrait';
    document.querySelectorAll('[data-cover]').forEach((b,i)=>b.classList.toggle('active',i===0));
    setTimeout(()=>$('newNotebookTitle').select(),20);
  }
  function hideModal(){$('modalBackdrop').hidden=true;}
  function createNotebook(){
    const title=$('newNotebookTitle').value.trim()||'Untitled notebook';const cover=document.querySelector('.cover-choice.active')?.dataset.cover||'purple';
    const n=makeNotebook(title,cover,$('newPaperStyle').value,$('newPageOrientation').value);state.notebooks.push(n);scheduleSave(true);hideModal();openNotebook(n.id);toast('Your notebook is ready');
  }
  function deleteNotebook(id){const n=state.notebooks.find(n=>n.id===id);if(!n)return;if(!confirm(`Permanently delete "${n.title}" and all ${n.pages.length} pages? Export a backup first if needed.`))return;tombstones[id]=now();state.notebooks=state.notebooks.filter(n=>n.id!==id);if(state.activeId===id){state.activeId=null;view('library');}scheduleSave(true);saveNow(true);renderLibrary();toast('Notebook deleted');}
  function closeMenus(){
    ['exportMenu','paperMenu','orientationMenu','moreMenu','emojiMenu','colorMenu'].forEach(id=>$(id).hidden=true);
    [['exportBtn','exportMenu'],['paperStyleBtn','paperMenu'],['pageOrientationBtn','orientationMenu'],['moreOptionsBtn','moreMenu'],['emojiBtn','emojiMenu'],['customColorBtn','colorMenu']].forEach(([button])=>$(button).setAttribute('aria-expanded','false'));
  }
  function toggleMenu(buttonId,menuId){
    const wasClosed=$(menuId).hidden;
    closeMenus();
    if(!wasClosed)return;
    const menu=$(menuId),trigger=$(buttonId);
    menu.hidden=false;trigger.setAttribute('aria-expanded','true');
    const rect=trigger.getBoundingClientRect();
    const menuWidth=menu.offsetWidth||220;
    const x=Math.max(8,Math.min(window.innerWidth-menuWidth-8,rect.right-menuWidth));
    menu.style.left=`${x}px`;
    menu.style.right='auto';
    menu.style.top=`${Math.min(window.innerHeight-20,rect.bottom+9)}px`;
  }
  function updateToolbarArrows(){
    const strip=$('editorToolbar'),prev=$('toolbarPrev'),next=$('toolbarNext');
    if(!strip)return;
    const overflow=strip.scrollWidth-strip.clientWidth>3;
    prev.hidden=!overflow||strip.scrollLeft<=3;
    next.hidden=!overflow||strip.scrollLeft+strip.clientWidth>=strip.scrollWidth-3;
  }
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
    $('notebookTitle').addEventListener('change',e=>{const n=notebook();if(!n)return;n.title=e.target.value.trim()||'Untitled notebook';e.target.value=n.title;scheduleSave(true);});
    $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
    $('exportBtn').onclick=e=>{e.stopPropagation();toggleMenu('exportBtn','exportMenu');};
    $('moreOptionsBtn').onclick=e=>{e.stopPropagation();toggleMenu('moreOptionsBtn','moreMenu');};
    $('paperStyleBtn').onclick=e=>{e.stopPropagation();toggleMenu('paperStyleBtn','paperMenu');};
    $('pageOrientationBtn').onclick=e=>{e.stopPropagation();toggleMenu('pageOrientationBtn','orientationMenu');};
    $('emojiBtn').onclick=e=>{e.stopPropagation();toggleMenu('emojiBtn','emojiMenu');$('emojiSearch').value='';renderEmojiGrid('');};
    $('customColorBtn').onclick=e=>{e.stopPropagation();toggleMenu('customColorBtn','colorMenu');};
    $('emojiSearch').oninput=e=>renderEmojiGrid(e.target.value);
    $('stickerSize').oninput=e=>{$('stickerSizeValue').textContent=e.target.value;};
    $('emojiGrid').onclick=e=>{const btn=e.target.closest('[data-emoji]');if(btn)addEmoji(btn.dataset.emoji);};
    $('extendedColors').onclick=e=>{const btn=e.target.closest('[data-more-color]');if(btn){setColor(btn.dataset.moreColor);closeMenus();}};
    $('customColorInput').oninput=e=>setColor(e.target.value);
    $('customColorInput').onchange=()=>closeMenus();
    document.querySelectorAll('[data-export]').forEach(el=>el.onclick=()=>exportCurrent(el.dataset.export));
    document.querySelectorAll('[data-paper]').forEach(el=>el.onclick=()=>{if(!page())return;page().template=el.dataset.paper;closeMenus();renderEditor();scheduleSave();toast('Paper template changed');});
    document.querySelectorAll('[data-orientation]').forEach(el=>el.onclick=()=>setOrientation(el.dataset.orientation));
    $('moreMenu').onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;closeMenus();const a=b.dataset.action;if(a==='fit'){finishActiveStroke();state.zoom=1;resizePage();}else if(a==='rename'){$('notebookTitle').focus();$('notebookTitle').select();}else if(a==='duplicate')duplicatePage();else if(a==='backup')backup();else if(a==='restore')$('restoreFileInput').click();else if(a==='open')$('openNotebookInput').click();else if(a==='pencilTest')togglePencilDiagnostics(true);else if(a==='drive')window.WindsDrive?.open();else if(a==='deleteNotebook')deleteNotebook(state.activeId);};
    document.addEventListener('click',e=>{if(!e.target.closest('.pop-menu')&&!e.target.closest('#exportBtn')&&!e.target.closest('#paperStyleBtn')&&!e.target.closest('#pageOrientationBtn')&&!e.target.closest('#moreOptionsBtn')&&!e.target.closest('#emojiBtn')&&!e.target.closest('#customColorBtn'))closeMenus();});
    document.querySelectorAll('[data-tool]').forEach(btn=>btn.onclick=()=>setTool(btn.dataset.tool));
    $('colorPalette').onclick=e=>{const b=e.target.closest('[data-color]');if(b)setColor(b.dataset.color);};
    $('penSize').oninput=updateSize;
    $('toolbarPrev').onclick=()=>$('editorToolbar').scrollBy({left:-230,behavior:'smooth'});
    $('toolbarNext').onclick=()=>$('editorToolbar').scrollBy({left:230,behavior:'smooth'});
    $('editorToolbar').addEventListener('scroll',updateToolbarArrows,{passive:true});
    $('editorToolbar').addEventListener('wheel',event=>{
      if(event.target.closest('input'))return;
      if($('editorToolbar').scrollWidth<=$('editorToolbar').clientWidth+3)return;
      if(Math.abs(event.deltaY)>Math.abs(event.deltaX)){
        event.preventDefault();
        $('editorToolbar').scrollLeft+=event.deltaY;
      }
    },{passive:false});
    if(window.ResizeObserver)new ResizeObserver(updateToolbarArrows).observe($('editorToolbar'));
    $('pencilOnly').onchange=e=>{state.stylusPreferenceChanged=true;state.penOnly=e.target.checked;toast(state.penOnly?'Stylus input enabled — palm contacts ignored while writing':'Finger drawing enabled');};
    $('addPageSidebar').onclick=$('addPageBottom').onclick=$('addPageFloat').onclick=$('addPageTop').onclick=addPage;
    $('thumbList').onclick=e=>{const remove=e.target.closest('[data-remove-page]');if(remove){deletePage(Number(remove.dataset.removePage));return;}const thumb=e.target.closest('[data-page]');if(thumb)switchPage(Number(thumb.dataset.page));};
    $('prevPage').onclick=()=>switchPage(state.pageIndex-1);$('nextPage').onclick=()=>switchPage(state.pageIndex+1);
    $('togglePages').onclick=()=>{state.sidebarOpen=!state.sidebarOpen;updateSidebar();};
    $('editorScrim').onclick=()=>{state.sidebarOpen=false;updateSidebar();};
    $('zoomIn').onclick=()=>changeZoom(.15);$('zoomOut').onclick=()=>changeZoom(-.15);
    // Critical iPadOS guard: the canvas must cancel its single-contact Touch
    // Events, not just PointerEvents. Without this, consecutive Apple Pencil
    // contacts can be silently consumed by WebKit's double-tap recognizer.
    const ink=$('inkCanvas');
    for(const type of ['touchstart','touchmove','touchend','touchcancel'])ink.addEventListener(type,preventWritingGesture,{passive:false,capture:false});
    for(const type of ['gesturestart','gesturechange','gestureend'])$('pageScroller').addEventListener(type,e=>{if(e.cancelable)e.preventDefault();},{passive:false});
    ink.addEventListener('pointerdown',pointerDown);ink.addEventListener('pointermove',pointerMove);
    ink.addEventListener('pointerup',pointerUp);ink.addEventListener('pointercancel',pointerCancel);
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend'])
      window.addEventListener(type,recordInputEvent,{capture:true,passive:true});
    $('closePencilDiagnostics').onclick=()=>togglePencilDiagnostics(false);
    $('copyPencilDiagnostics').onclick=copyPencilDiagnostics;
    $('inkCanvas').addEventListener('contextmenu',e=>e.preventDefault());
    $('pageShell').addEventListener('contextmenu',e=>{if(e.cancelable)e.preventDefault();});
    $('inkCanvas').addEventListener('lostpointercapture',pointerLostCapture);
    $('inlineTextEditor').addEventListener('blur',commitText);
    $('inlineTextEditor').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();commitText();}});
    $('insertImageBtn').onclick=()=>$('imageFileInput').click();
    $('imageFileInput').onchange=e=>{const f=e.target.files[0];if(f)importImage(f);e.target.value='';};
    $('openNotebookFile').onclick=()=>$('openNotebookInput').click();
    $('openNotebookInput').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)openEditableFile(file);};
    $('restoreFileInput').onchange=e=>{restore(e.target.files[0]);e.target.value='';};
    let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.drag?.kind==='draw')return;updateSidebar();resizePage();updateToolbarArrows();},160);});
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
    document.addEventListener('visibilitychange',()=>{if(document.hidden){finishActiveStroke();saveNow(true);}});
    window.addEventListener('pagehide',()=>{finishActiveStroke();saveNow(true);});
  }
  async function boot(){
    initIcons();bind();setColor(COLORS[0]);updateSize();
    await storageOpen();const stored=await loadData();
    if(stored && Array.isArray(stored.notebooks)){state.notebooks=stored.notebooks;tombstones=stored.deleted||{};}
    else{const legacy=await oldDatabase();if(legacy&&Array.isArray(legacy.notebooks)){state.notebooks=legacy.notebooks;toast('Your existing notebooks have been imported');}else seed();dirtyAll=true;saveVersion++;await saveNow(true);}
    renderLibrary();view('library');
    window.WindsDrive?.init({
      getData:workspaceSnapshot,
      switchWorkspace,
      mergeWorkspace,
      isWriting:()=>Boolean(state.drag || Date.now()-lastInkAt<45000),
      isDrawingNow:()=>Boolean(state.drag),
      importData:async text=>{
        if(text.length>window.WindsFile.MAX_FILE_BYTES)throw Error('Backup file is too large');
        const parsed=window.WindsFile.parse(text);
        finishActiveStroke();commitText();
        state.notebooks.push(...parsed.notebooks);
        dirtyAll=true;saveVersion++;
        await saveNow(true);
        $('searchNotebooks').value='';view('library');state.activeId=null;renderLibrary();
        return parsed.notebooks.length;
      },toast
    });
    if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
      window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
    }
  }
  boot().catch(err=>{console.error(err);toast('Something went wrong loading notebooks');});
})();
