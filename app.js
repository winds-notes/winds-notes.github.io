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
    for(const id of ['pageCanvas','inkCanvas','liveCanvas']){
      if(id==='liveCanvas'&&window.WINDS_REALTIME_ENABLED!==true)continue;
      const c=$(id);if(c.width!==W*RENDER_SCALE)c.width=W*RENDER_SCALE;
      if(c.height!==H*RENDER_SCALE)c.height=H*RENDER_SCALE;
    }
  }
  // Keep expensive storage and page composition out of rapid pen-up/pen-down cycles.
  const SAVE_IDLE_MS = 2500, INK_COMPOSE_IDLE_MS = 2400, PALM_GUARD_MS = 2400;
  const CLOUD_IDLE_MS = 2500;
  const $ = id => document.getElementById(id);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const clone = value => JSON.parse(JSON.stringify(value));
  const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const COVER_COLORS = ['purple','blue','peach','green','lilac','yellow'];
  const COLORS = ['#2b2d4c','#6457ed','#e96576','#e7a43a','#39a68c','#4777c8','#9a62b4'];
  const MORE_COLORS = ['#e2e8f0','#f1f5f9','#ddd6fe','#e9d5ff','#f5d0fe','#fbcfe8','#fecdd3','#fecaca','#fed7aa','#fde68a','#fef08a','#fef9c3','#d9f99d','#bef264','#bbf7d0','#a7f3d0','#99f6e4','#a5f3fc','#bae6fd','#bfdbfe','#c7d2fe','#fce7f3','#fae8ff','#ede9fe','#e0e7ff','#dbeafe','#ccfbf1','#dcfce7'];
  const CREATIVE = window.WindsCreative;
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
    square:'<rect x="5" y="5" width="14" height="14" rx="1"/>',
    ellipse:'<ellipse cx="12" cy="12" rx="9" ry="7"/>',
    circle:'<circle cx="12" cy="12" r="8"/>',
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
    artist:'<path d="M12 19 4 21l2-8L17 2l5 5-10 12zM14 5l5 5M4 21l5-3"/>',
    zoomIn:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5M7.5 10.5h6m-3-3v6"/>',
    zoomOut:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5M7.5 10.5h6"/>',
    chevronLeft:'<path d="m14 18-6-6 6-6"/>',
    chevronRight:'<path d="m10 18 6-6-6-6"/>',
    x:'<path d="M18 6 6 18M6 6l12 12"/>',
    trash:'<path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/>'
  };
  const icon = (key, size=20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[key] || ICONS.plus}</svg>`;
  const state = {notebooks:[],activeId:null,pageIndex:0,tool:'pen',color:COLORS[0],size:7,zoom:1,penOnly:false,artistGrade:'HB',artistGroup:'graphite',artistFlow:1,shapeFillEnabled:false,shapeFillColor:'#b9adff',shapeFillOpacity:1,shapeOutlineColor:'#2b2d4c',shapeOutlineSize:7,shapeOutlineStyle:'solid',selected:-1,draft:null,drag:null,pointers:new Map(),pinch:null,sidebarOpen:false,saveTimer:null,toastTimer:null,editingText:null,lastPenAt:0,stylusSeen:false,stylusPreferenceChanged:false};
  const history = new Map();
  const imageCache = new Map();
  let imageCropSession = null;
  let database = null, persistence = 'indexeddb', saving = false;
  let workspaceId='guest';
  let tombstones={};
  const workspaceDatabaseName=()=>workspaceId==='guest'?'winds-notes-v2':`winds-notes-account-${workspaceId}`;
  const workspaceLocalStorageKey=()=>workspaceId==='guest'?'winds-notes-data-v2':`winds-notes-data-${workspaceId}`;
  let dirtyAll = false, saveVersion = 0, lastInkAt = 0, thumbnailsDirty = true, thumbnailTimer = 0, inkRAF = 0, drawnIndex = 0;
  let inkComposeTimer = 0, bufferedPenInk = false, bufferedPenItems = [];
  let cloudRenderTimer = 0;
  let livePreviewItems=[],livePreviewRAF=0;
  function clearLiveLayer(){
    livePreviewItems=[];if(livePreviewRAF){cancelAnimationFrame(livePreviewRAF);livePreviewRAF=0;}
    const canvas=$('liveCanvas');if(canvas){canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);canvas.dataset.livePreviews='0';}
  }
  function paintLiveLayer(){
    livePreviewRAF=0;
    if(window.WINDS_REALTIME_ENABLED!==true)return;
    if(state.drag||state.pinch||state.editingText||imageCropSession){window.WindsLive?.render();return;}
    const canvas=$('liveCanvas'),n=notebook(),p=page();if(!canvas)return;
    const ctx=canvas.getContext('2d');ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);ctx.clearRect(0,0,W,H);
    canvas.dataset.livePreviews='0';
    if(!n||!p||$('editorView').hidden)return;
    const ids=new Set(p.items.map(item=>item.id)),room=n._sharing?'shared:'+n._sharing.folderId:'account';
    ctx.globalAlpha=.8;
    let painted=0;
    for(const preview of livePreviewItems){const packet=preview.packet;if(preview.room===room&&packet.bookId===n.id&&packet.pageId===p.id&&!ids.has(packet.item.id)){drawItem(ctx,packet.item);painted++;}}
    canvas.dataset.livePreviews=String(painted);
    ctx.globalAlpha=1;
  }
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
    document.querySelectorAll('[data-tool]').forEach(btn => {if(btn.dataset.tool!=='artist')btn.innerHTML=icon(btn.dataset.tool);});
    $('shapeFillSwatches').innerHTML=['#b9adff','#f6b4c4','#f8db8e','#a2e8d1','#a7d6fa','#f7f7f7','#2b2d4c','#f3a75f'].map(c=>`<button class="fill-swatch" type="button" data-fill-color="${c}" title="${c}" aria-label="Use fill color ${c}" style="--fill-color:${c}"></button>`).join('');
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
    window.WindsLive?.changed(n?.id,page()?.id);
    // A writing burst has a single pending state; there are NO writes between letters.
    if($('saveStatus').textContent!=='Unsaved changes')statusText('Unsaved changes',true);
    clearTimeout(state.saveTimer);
    state.saveTimer=setTimeout(()=>saveNow(),SAVE_IDLE_MS);
  }
  async function saveNow(force=false,fromDrive=false){
    clearTimeout(state.saveTimer);
    if(saving){state.saveTimer=setTimeout(()=>saveNow(force,fromDrive),600);return;}
    if(!force && (state.drag||state.pinch||state.editingText||imageCropSession||Date.now()-lastInkAt<SAVE_IDLE_MS-100)){
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
      // Receiving a remote edit is not a new local edit. The merge reports
      // whether this device has additional content that needs uploading.
      if(!fromDrive)window.WindsDrive?.onLocalSave?.();
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
    clearTimeout(state.saveTimer);clearTimeout(thumbnailTimer);clearTimeout(inkComposeTimer);clearTimeout(cloudRenderTimer);
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
  function cloudSyncDelay(){
    if(state.drag||state.pinch||state.editingText||imageCropSession)return CLOUD_IDLE_MS;
    const remaining=CLOUD_IDLE_MS-(Date.now()-lastInkAt);
    if(remaining>0)return remaining;
    return saving||dirtyAll||dirtyBooks.size||dirtyPages.size?1000:0;
  }
  function renderCloudChanges(expectedWorkspace=workspaceId){
    clearTimeout(cloudRenderTimer);
    if(expectedWorkspace!==workspaceId)return;
    const remaining=cloudSyncDelay();
    if(remaining){cloudRenderTimer=setTimeout(()=>renderCloudChanges(expectedWorkspace),remaining);return;}
    if(state.activeId&&notebook()){state.pageIndex=Math.min(state.pageIndex,notebook().pages.length-1);renderEditor();}
    else{state.activeId=null;view('library');renderLibrary();}
  }
  async function mergeWorkspace(snapshot,{manual=false,report=false}={}){
    if(state.drag||state.pinch||state.editingText||imageCropSession||saving||(!manual&&cloudSyncDelay())){
      const error=new Error('Writing or local saving resumed. Cloud synchronization will retry when idle.');
      error.syncDeferred=true;throw error;
    }
    if(!snapshot || snapshot.format!=='winds-notes-backup' || !Array.isArray(snapshot.notebooks) || snapshot.notebooks.length>750)throw new Error('Invalid Drive workspace');
    const remoteDeleted=snapshot.deleted&&typeof snapshot.deleted==='object'?snapshot.deleted:{};
    const mergedDeleted={...tombstones};
    for(const [id,when] of Object.entries(remoteDeleted))if(typeof when==='string' && (!mergedDeleted[id] || when>mergedDeleted[id]))mergedDeleted[id]=when;
    const merged=new Map(state.notebooks.map(n=>[n.id,n])),remoteBooks=new Map();
    for(const n of snapshot.notebooks){
      if(!n || typeof n.id!=='string' || typeof n.title!=='string' || !Array.isArray(n.pages)||!n.pages.length||n.pages.length>500 || n.pages.some(p=>!Array.isArray(p.items)||p.items.length>50000))throw new Error('Invalid Drive notebook data');
      remoteBooks.set(n.id,n);
      const local=merged.get(n.id);
      // Shared edits have their own immutable Drive history. A private backup
      // must not overwrite that notebook's local baseline or pending edits.
      if(local?._sharing)continue;
      if(!local || (n.updatedAt||'')>(local.updatedAt||''))merged.set(n.id,n);
    }
    const final=[...merged.values()].filter(n=>!(mergedDeleted[n.id] && mergedDeleted[n.id]>=(n.updatedAt||'')));
    const hasChanges=JSON.stringify(state.notebooks)!==JSON.stringify(final) || JSON.stringify(tombstones)!==JSON.stringify(mergedDeleted);
    // Newer remote notebooks are already the same objects in `final`; only
    // compare retained local notebooks. A read-only device must not echo the
    // whole workspace back to Drive, but local-only books/deletions still sync.
    const needsUpload=final.length!==snapshot.notebooks.length||final.some(n=>n!==remoteBooks.get(n.id)&&JSON.stringify(n)!==JSON.stringify(remoteBooks.get(n.id)))||
      Object.keys(mergedDeleted).length!==Object.keys(remoteDeleted).length||Object.entries(mergedDeleted).some(([id,when])=>remoteDeleted[id]!==when);
    if(hasChanges){
      state.notebooks=final;tombstones=mergedDeleted;
      dirtyAll=true;saveVersion++;await saveNow(true,report);
      // A new stroke may have started while the IndexedDB write was in flight.
      // Keep that stroke and canvas intact, and compose remote changes when idle.
      renderCloudChanges();
    }
    return report?{changed:hasChanges,needsUpload}:hasChanges;
  }
  function seed(){
    state.notebooks=[makeNotebook('Untitled notebook','purple','ruled')];
  }

  function view(which){$('libraryView').hidden=which!=='library';$('editorView').hidden=which!=='editor';}
  function displayDate(iso){const d=new Date(iso);return Number.isNaN(+d)?'Recently edited':`Edited ${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;}
  function renderLibrary(){
    const query=$('searchNotebooks').value.trim().toLowerCase();
    $('notebookCount').textContent=state.notebooks.length;
    const found=[...state.notebooks].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).filter(n=>n.title.toLowerCase().includes(query));
    if(!found.length){$('notebookGrid').innerHTML=`<div class="empty-state"><div style="font-size:34px">✳</div><h3>${query?'No notebooks found':'Your next idea starts here'}</h3><p>${query?'Try another search term.':'Create a new notebook to start writing.'}</p></div>`;return;}
    $('notebookGrid').innerHTML=found.map(n=>`<article class="notebook-card" data-open="${safe(n.id)}" tabindex="0" role="button" aria-label="Open ${safe(n.title)}"><div class="book-cover cover-${COVER_COLORS.includes(n.cover)?n.cover:'purple'}"><div class="cover-name">${safe(n.title)}</div><div class="cover-rule"></div><div class="cover-foot">WiNDS / NOTES${n._sharing?' · SHARED':''}</div></div><div class="notebook-meta"><div style="min-width:0"><h3>${safe(n.title)}</h3><p>${n.pages.length} ${n.pages.length===1?'page':'pages'} · ${displayDate(n.updatedAt)}${n._sharing?' · Shared':''}</p></div><button type="button" class="card-menu" data-notebook-menu="${safe(n.id)}" title="Notebook actions" aria-label="Actions for ${safe(n.title)}" aria-haspopup="menu" aria-expanded="false">${icon('more')}</button></div></article>`).join('');
  }
  let menuNotebookId=null,menuTrigger=null;
  function closeNotebookMenu(){
    $('notebookCardMenu').hidden=true;menuTrigger?.setAttribute('aria-expanded','false');menuTrigger=null;
  }
  function openNotebookMenu(button){
    const wasOpen=!$('notebookCardMenu').hidden&&menuNotebookId===button.dataset.notebookMenu;
    closeNotebookMenu();if(wasOpen)return;
    menuNotebookId=button.dataset.notebookMenu;menuTrigger=button;
    const n=state.notebooks.find(book=>book.id===menuNotebookId);if(!n)return;
    $('cardDeleteNotebook').textContent=n._sharing?'Remove from my library':'Delete notebook';
    const menu=$('notebookCardMenu'),rect=button.getBoundingClientRect();menu.hidden=false;
    menu.style.left=`${Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,rect.right-menu.offsetWidth))}px`;
    menu.style.top=`${Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,rect.bottom+6))}px`;
    button.setAttribute('aria-expanded','true');$('cardShareNotebook').focus();
  }
  async function putSharedNotebook(book,sharing,version,attach=false,manual=false){
    if(version!==saveVersion||saving||state.drag||state.pinch||state.editingText||imageCropSession||dirtyAll||dirtyBooks.size||dirtyPages.size||(!manual&&cloudSyncDelay())){
      const error=Error('Local editing changed while sharing. Try again when idle.');error.syncDeferred=true;throw error;
    }
    if(!/^[\w-]{5,200}$/.test(sharing?.folderId||''))throw Error('Invalid shared notebook folder');
    const clean=window.WindsFile.validateShared(book),index=state.notebooks.findIndex(n=>n.id===clean.id),current=state.notebooks[index];
    if(current?._sharing&&current._sharing.folderId!==sharing.folderId)throw Error('This notebook ID belongs to another shared notebook.');
    if(current&&!current._sharing&&!attach){
      const copy=window.WindsFile.parse(window.WindsFile.serialize(current)).notebooks[0];
      copy.title=(copy.title+' (private copy)').slice(0,70);state.notebooks.push(copy);
      toast('Your existing notebook was preserved as a private copy');
    }
    const before=current?window.WindsFile.validateShared(current):null;
    const changed=before&&!window.WindsSharedModel.sameValue({...before,updatedAt:null},{...clean,updatedAt:null});
    if(changed&&state.activeId===clean.id)state.selected=-1;
    const next={...clean,_sharing:sharing};if(index<0)state.notebooks.push(next);else state.notebooks[index]=next;
    delete tombstones[clean.id];
    if(changed)for(const p of before.pages){
      const h=history.get(p.id);if(!h)continue;
      const after=new Map((clean.pages.find(next=>next.id===p.id)?.items||[]).map(item=>[item.id,item]));
      const previous=new Map(p.items.map(item=>[item.id,item]));
      // Keep safe stroke undo/redo; an old whole-page snapshot must not erase
      // a collaborator's new marks or changes to the same object.
      h.undo=h.undo.filter(action=>action.kind==='append'&&after.has(action.item.id)&&window.WindsSharedModel.sameValue(previous.get(action.item.id),after.get(action.item.id)));
      h.redo=h.redo.filter(action=>action.kind==='append'&&!after.has(action.item.id));
    }
    dirtyAll=true;const saved=++saveVersion,expectedWorkspace=workspaceId;
    await saveNow(true,true);
    if(saving||dirtyAll||dirtyBooks.size||dirtyPages.size){const error=Error('Shared changes are waiting for durable local saving.');error.syncDeferred=true;throw error;}
    window.WindsLive?.refreshRooms();renderCloudChanges(expectedWorkspace);return saved;
  }
  function openNotebook(id){
    const n=state.notebooks.find(x=>x.id===id);if(!n)return;
    clearLiveLayer();
    state.activeId=id;state.pageIndex=0;state.selected=-1;state.zoom=1;RENDER_SCALE=2;state.draft=null;
    state.sidebarOpen=false;thumbnailsDirty=true;
    view('editor');$('notebookTitle').value=n.title;
    syncPageGeometry();updateSidebar();setTool('pen');renderEditor();resizePage();requestAnimationFrame(updateToolbarArrows);window.WindsLive?.refreshRooms();
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
    clearLiveLayer();composeInkNow();commitText();state.pageIndex=index;state.selected=-1;state.draft=null;syncPageGeometry();resizePage();renderEditor();
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
  function setZoom(value){
    if(!Number.isFinite(value))return;
    finishActiveStroke();state.zoom=Math.min(8,Math.max(.35,Math.round(value*100)/100));
    adjustInkResolution();resizePage();
  }
  function changeZoom(amount){setZoom(state.zoom+amount);}

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
  function applyFillToSelected(){
    const item=page()?.items[state.selected];
    if(!item || item.type!=='shape')return false;
    const fillable=CREATIVE.isFillableShape(item.kind);
    const fill=fillable&&state.shapeFillEnabled?state.shapeFillColor:null;
    const options={fillColor:fill,fillOpacity:state.shapeFillOpacity,
      color:state.shapeOutlineColor,size:state.shapeOutlineSize,strokeStyle:state.shapeOutlineStyle};
    if(Object.entries(options).every(([key,value])=>(item[key]??(key==='strokeStyle'?'solid':null))===value))return true;
    remember();Object.assign(item,options);
    renderCanvas();scheduleSave();renderThumbs();return true;
  }
  function syncFillControls(){
    $('shapeFillEnabled').checked=state.shapeFillEnabled;
    $('shapeFillColor').value=state.shapeFillColor;
    $('shapeFillOpacity').value=String(Math.round(state.shapeFillOpacity*100));
    $('shapeFillOpacityLabel').textContent=`${Math.round(state.shapeFillOpacity*100)}%`;
    $('shapeOutlineColor').value=state.shapeOutlineColor;
    $('shapeOutlineSize').value=String(state.shapeOutlineSize);
    $('shapeOutlineSizeLabel').textContent=String(state.shapeOutlineSize);
    $('shapeOutlineStyle').value=state.shapeOutlineStyle;
    $('shapeFillBtn').classList.toggle('has-fill',state.shapeFillEnabled);
    $('shapeFillBtn').style.setProperty('--active-fill',state.shapeFillEnabled?state.shapeFillColor:'transparent');
    document.querySelectorAll('[data-fill-color]').forEach(b=>b.classList.toggle('selected',b.dataset.fillColor===state.shapeFillColor));
  }
  function setFillOptions({enabled=state.shapeFillEnabled,color=state.shapeFillColor,
    opacity=state.shapeFillOpacity,outlineColor=state.shapeOutlineColor,
    outlineSize=state.shapeOutlineSize,outlineStyle=state.shapeOutlineStyle}={}){
    state.shapeFillEnabled=!!enabled;
    if(/^#[0-9a-f]{6}$/i.test(color))state.shapeFillColor=color;
    state.shapeFillOpacity=Math.max(.05,Math.min(1,Number(opacity)||1));
    if(/^#[0-9a-f]{6}$/i.test(outlineColor))state.shapeOutlineColor=outlineColor;
    state.shapeOutlineSize=Math.max(.5,Math.min(32,Number(outlineSize)||3));
    if(CREATIVE.STROKE_STYLES.has(outlineStyle))state.shapeOutlineStyle=outlineStyle;
    syncFillControls();
  }
  function showFillMenu(e){
    e.stopPropagation();
    const item=page()?.items[state.selected];
    if(item?.type==='shape'){
      setFillOptions({enabled:!!item.fillColor,color:item.fillColor||state.shapeFillColor,
        opacity:item.fillOpacity??1,outlineColor:item.color||state.shapeOutlineColor,
        outlineSize:item.size||state.shapeOutlineSize,
        outlineStyle:item.strokeStyle||'solid'});
    }
    toggleMenu('shapeFillBtn','fillMenu');
  }
  function setArtistGrade(grade){
    if(!CREATIVE.PENCIL_GRADES[grade])return;
    state.artistGrade=grade;state.artistGroup=CREATIVE.ARTIST_MATERIALS[grade].group;
    $('artistGradeBadge').textContent=grade;
    CREATIVE.prepareArtistColor(state.color);setTool('artist');closeMenus();
    toast(`${grade} artist tool selected`);
  }
  function buildArtistLibrary(){
    const list=$('artistGradeList');
    for(const [grade,material] of Object.entries(CREATIVE.ARTIST_MATERIALS)){
      const button=document.createElement('button');button.type='button';button.dataset.grade=grade;button.dataset.collection=material.group;
      const title=document.createElement('b');title.textContent=grade;
      const description=document.createElement('span');description.textContent=material.description;
      const canvas=document.createElement('canvas');canvas.className='graphite-sample';canvas.width=280;canvas.height=52;canvas.dataset.artistPreview=grade;canvas.setAttribute('aria-hidden','true');
      button.append(title,description,canvas);list.append(button);
    }
  }
  function renderArtistPreviews(){
    const material=CREATIVE.ARTIST_MATERIALS[state.artistGrade];
    $('artistMaterialName').textContent=state.artistGrade;$('artistMaterialDetail').textContent=material.detail;
    $('artistSize').value=state.size;$('artistSizeValue').textContent=String(state.size);
    $('artistFlow').value=Math.round(state.artistFlow*100);$('artistFlowValue').textContent=`${Math.round(state.artistFlow*100)}%`;
    document.querySelectorAll('[data-artist-group]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.artistGroup===state.artistGroup)));
    document.querySelectorAll('[data-grade]').forEach(button=>{
      const selected=button.dataset.grade===state.artistGrade;
      button.hidden=button.dataset.collection!==state.artistGroup;
      button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
    });
    function sample(canvas,grade,large){
      const ctx=canvas.getContext('2d'),w=canvas.width/2,h=canvas.height/2;
      ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,w,h);
      const points=Array.from({length:49},(_,i)=>{
        const t=i/48;return [12+(w-24)*t,h/2+(large?6:3)*Math.sin(t*Math.PI*2),.04+.96*t];
      });
      const size=large?Math.min(state.size,14):4.5;
      CREATIVE.drawArtistStroke(ctx,{tool:'artist',grade,color:state.color,size,flow:state.artistFlow,points});
    }
    document.querySelectorAll('[data-artist-preview]').forEach(canvas=>{if(!canvas.parentElement.hidden)sample(canvas,canvas.dataset.artistPreview,false);});
    sample($('artistActivePreview'),state.artistGrade,true);
  }
  function setColor(c){
    if(!/^#[0-9a-f]{6}$/i.test(c))return;
    state.color=c;CREATIVE.prepareArtistColor(c);
    document.querySelectorAll('[data-color],[data-more-color]').forEach(b=>{
      const selected=(b.dataset.color||b.dataset.moreColor)?.toLowerCase()===c.toLowerCase();
      b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));
    });
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
  function updateSize(){state.size=Number($('penSize').value);$('sizeLabel').textContent=String(state.size);const diameter=Math.max(4,Math.min(state.size,19));$('sizePreview').style.width=`${diameter}px`;$('sizePreview').style.height=`${diameter}px`;if(!$('artistMenu').hidden)renderArtistPreviews();}
  function historyForPage(){const key=page()?.id;if(!key)return null;if(!history.has(key))history.set(key,{undo:[],redo:[]});return history.get(key);}
  function recordHistory(action){
    const h=historyForPage();if(!h)return;
    h.undo.push(action);if(h.undo.length>70)h.undo.shift();h.redo=[];updateHistoryButtons();
  }
  function remember(){recordHistory({kind:'snapshot',items:clone(page().items)});}
  function rememberAppend(item){recordHistory({kind:'append',item:clone(item)});window.WindsLive?.append(notebook()?.id,page()?.id,item);}
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
  // Rendering is shared by live ink, saved pages, thumbnails and exports.
  function midpoint(a,b){return [(a[0]+b[0])*.5,(a[1]+b[1])*.5];}
  function smoothPenPart(ctx,item,points,index){
    CREATIVE.drawPenPart(ctx,item,points,index);
  }
  function smoothPenEnd(ctx,item,points){
    CREATIVE.drawPenEnd(ctx,item,points);
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
    }else if(item.tool==='artist'){
      CREATIVE.drawArtistStroke(ctx,item);
    }else{
      for(let i=0;i<ps.length;i++)smoothPenPart(ctx,item,ps,i);
      smoothPenEnd(ctx,item,ps);
    }
    ctx.restore();
  }
  function drawItem(ctx,item){
    ctx.save();
    CREATIVE.rotateContext(ctx,item);
    if(item.type==='stroke'){drawStroke(ctx,item);}
    else if(item.type==='text'){
      ctx.fillStyle=item.color||'#2b2d4c';ctx.font=`${item.size||20}px Arial, sans-serif`;ctx.textBaseline='top';
      const lines=wrapText(ctx,item.text,item.w||490);const lineHeight=(item.size||20)*1.42;
      lines.forEach((line,i)=>ctx.fillText(line,item.x,item.y+i*lineHeight));
    }else if(item.type==='shape'){
      CREATIVE.drawShape(ctx,item);
    }else if(item.type==='sticker'){
      ctx.textBaseline='top';ctx.textAlign='left';
      ctx.font=`${item.size||78}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
      ctx.fillText(item.emoji,item.x,item.y);
    }else if(item.type==='image'){
      if(!imageCache.has(item.src)){
        const img=new Image();imageCache.set(item.src,img);img.onload=()=>{if(!document.hidden)renderCanvas();};img.src=item.src;
      }
      const img=imageCache.get(item.src);if(img?.complete&&img.naturalWidth)CREATIVE.drawImage(ctx,item,img);
    }
    ctx.restore();
  }
  function drawPage(ctx,p,withoutSelection=true){
    if(!p)return;drawTemplate(ctx,p.template||'ruled',pageDimensions(p));
    for(const item of p.items)drawItem(ctx,item);
    if(!withoutSelection){
      if(state.draft)drawItem(ctx,state.draft);
      if(state.selected>=0 && p.items[state.selected]){
        const item=p.items[state.selected],b=itemBounds(item);ctx.save();CREATIVE.rotateContext(ctx,item);ctx.strokeStyle='#6557ed';ctx.lineWidth=1.7;ctx.setLineDash([8,6]);ctx.strokeRect(b.x-8,b.y-8,b.w+16,b.h+16);ctx.restore();
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
    const b=itemBounds(it);ctx.save();CREATIVE.rotateContext(ctx,it);ctx.strokeStyle='#6557ed';ctx.lineWidth=Math.max(1,handleSize()*.18);
    const pad=handleSize()*.65;
    ctx.setLineDash([Math.max(4,pad),Math.max(3,pad*.75)]);
    ctx.strokeRect(b.x-pad,b.y-pad,b.w+pad*2,b.h+pad*2);ctx.setLineDash([]);
    if(resizable(it)){
      const r=handleSize();ctx.fillStyle='#ffffff';ctx.strokeStyle='#6155d9';ctx.lineWidth=Math.max(.8,r*.2);
      for(const [x,y] of Object.values(cornerPositions(b))){ctx.beginPath();ctx.roundRect(x-r,y-r,2*r,2*r,r*.28);ctx.fill();ctx.stroke();}
    }
    ctx.restore();
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
    if(item.tool==='artist'){
      for(let i=drawnIndex;i<pts.length;i++)CREATIVE.drawArtistPart(ctx,item,pts,i);
      if(finalize)CREATIVE.drawArtistEnd(ctx,item,pts);
    }else{
      for(let i=drawnIndex;i<pts.length;i++)smoothPenPart(ctx,item,pts,i);
      if(finalize)smoothPenEnd(ctx,item,pts);
    }
    drawnIndex=pts.length;
    ctx.restore();
  }
  function queueInk(){if(!inkRAF)inkRAF=requestAnimationFrame(()=>paintPendingInk());}
  function renderCanvas(){
    const p=page();if(!p)return;
    syncPageGeometry();
    clearTimeout(inkComposeTimer);inkComposeTimer=0;bufferedPenInk=false;bufferedPenItems=[];
    const canvas=$('pageCanvas'),ctx=canvas.getContext('2d',{alpha:false});
    ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
    drawPage(ctx,p,true);clearInk();
    if(state.draft)queueInk();else drawSelection(inkContext());
    updateSelectionActions();
    paintLiveLayer();window.WindsLive?.render();
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
      const pad=Math.max(7,item.tool==='artist'?CREATIVE.artistBoundsPadding(item):item.size*(item.tool==='highlighter'?3:1));
      return {x:minX-pad,y:minY-pad,w:maxX-minX+2*pad,h:maxY-minY+2*pad};
    }
    if(item.type==='text')return{x:item.x,y:item.y,w:item.w||480,h:textGeometry(item).h};
    if(item.type==='sticker')return{x:item.x,y:item.y,w:item.size||78,h:item.size||78};
    const x=Math.min(item.x,item.x+item.w),y=Math.min(item.y,item.y+item.h);return{x,y,w:Math.abs(item.w),h:Math.abs(item.h)};
  }
  function resizable(item){return Boolean(item&&['image','sticker','shape'].includes(item.type));}
  function handleSize(){
    const width=$('inkCanvas').getBoundingClientRect().width||W;
    return Math.max(1.7,Math.min(14,8*W/width));
  }
  function cornerPositions(bounds){
    return {nw:[bounds.x,bounds.y],ne:[bounds.x+bounds.w,bounds.y],
      sw:[bounds.x,bounds.y+bounds.h],se:[bounds.x+bounds.w,bounds.y+bounds.h]};
  }
  function resizeHit(item,p){
    if(!resizable(item))return null;
    p=CREATIVE.objectPoint(item,p,true);
    const positions=cornerPositions(itemBounds(item));
    const tolerance=handleSize()*2.6;
    for(const [corner,[x,y]] of Object.entries(positions)){
      if(Math.hypot(p.x-x,p.y-y)<tolerance)return corner;
    }
    return null;
  }
  function updateSelectionActions(){
    const item=page()?.items[state.selected];const show=resizable(item)&&state.tool==='select';
    $('selectionActions').hidden=!show;
    $('cropSelectedImage').hidden=!show||item.type!=='image';
    $('rotationControls').hidden=!show||!CREATIVE.rotatable(item);
    if(!show)return;
    $('selectedObjectType').textContent=item.type==='image'?'Image':item.type==='sticker'?'Sticker':'Shape';
    $('selectedWidth').value=String(Math.round(itemBounds(item).w));
    $('selectedRotation').value=String(Math.round(CREATIVE.objectRotation(item)*10)/10);
  }
  function rotateSelectedTo(angle){
    const item=page()?.items[state.selected];if(!CREATIVE.rotatable(item))return;
    if(!Number.isFinite(angle)){updateSelectionActions();return;}
    const rotation=CREATIVE.objectRotation({type:item.type,rotation:angle});
    if(Math.abs(rotation-CREATIVE.objectRotation(item))<1e-8){updateSelectionActions();return;}
    remember();if(rotation)item.rotation=rotation;else delete item.rotation;
    renderCanvas();renderThumbs();scheduleSave();
  }
  function updateImageCropPreview(){
    if(!imageCropSession)return;
    const c=imageCropSession.crop,box=$('imageCropBox');
    Object.assign(box.style,{left:`${c.x*100}%`,top:`${c.y*100}%`,width:`${c.w*100}%`,height:`${c.h*100}%`});
    for(const [id,key] of [['cropLeft','x'],['cropTop','y'],['cropWidth','w'],['cropHeight','h']]){
      $(id).value=String(Math.round(c[key]*1000)/10);
    }
  }
  async function openImageCrop(){
    const item=page()?.items[state.selected];if(item?.type!=='image')return;
    finishActiveStroke();commitText();composeInkNow();closeMenus();
    const bookId=notebook().id,pageId=page().id,account=workspaceId;
    try{
      let img=imageCache.get(item.src);
      if(!img){img=new Image();img.src=item.src;imageCache.set(item.src,img);}
      if(!img.complete||!img.naturalWidth)await img.decode();
      if(workspaceId!==account||notebook()?.id!==bookId||page()?.id!==pageId||page().items[state.selected]?.id!==item.id)return;
      imageCropSession={bookId,pageId,account,itemId:item.id,crop:CREATIVE.imageCrop(item.crop),drag:null};
      $('imageCropSource').src=item.src;
      $('imageCropPreview').style.setProperty('--crop-ratio',String(img.naturalWidth/img.naturalHeight));
      $('imageCropBackdrop').hidden=false;updateImageCropPreview();$('imageCropDialog').focus();
    }catch(err){console.error(err);toast('Could not open this image for cropping');}
  }
  function closeImageCrop(){
    const drag=imageCropSession?.drag;
    if(drag&&$('imageCropPreview').hasPointerCapture(drag.pointerId))$('imageCropPreview').releasePointerCapture(drag.pointerId);
    imageCropSession=null;$('imageCropBackdrop').hidden=true;
    if(!$('cropSelectedImage').hidden)$('cropSelectedImage').focus();
  }
  function applyImageCrop(){
    const session=imageCropSession;
    if(!session||workspaceId!==session.account||notebook()?.id!==session.bookId||page()?.id!==session.pageId){closeImageCrop();return;}
    const item=page().items.find(it=>it.id===session.itemId);if(item?.type!=='image'){closeImageCrop();return;}
    const old=CREATIVE.imageCrop(item.crop),next=CREATIVE.imageCrop(session.crop);
    if(['x','y','w','h'].some(k=>Math.abs(old[k]-next[k])>1e-8)){
      remember();const cropped=CREATIVE.cropImage(item,next);Object.assign(item,cropped);
      if(!cropped.crop)delete item.crop;
      renderCanvas();renderThumbs();scheduleSave();toast('Image cropped · Undo to restore');
    }
    closeImageCrop();
  }
  function imageCropPoint(ev){
    const rect=$('imageCropPreview').getBoundingClientRect();
    return {x:Math.max(0,Math.min(1,(ev.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(ev.clientY-rect.top)/rect.height))};
  }
  function beginImageCropDrag(ev){
    if(!imageCropSession||imageCropSession.drag||ev.button>0)return;
    ev.preventDefault();const p=imageCropPoint(ev),c=imageCropSession.crop;
    let corner=ev.target.closest('[data-crop-corner]')?.dataset.cropCorner;
    if(!corner){
      if(p.x>=c.x&&p.x<=c.x+c.w&&p.y>=c.y&&p.y<=c.y+c.h)corner='move';
      else{corner='se';imageCropSession.crop=CREATIVE.imageCrop({x:p.x,y:p.y,w:.01,h:.01});}
    }
    imageCropSession.drag={pointerId:ev.pointerId,start:p,corner,crop:{...imageCropSession.crop}};
    $('imageCropPreview').setPointerCapture(ev.pointerId);updateImageCropPreview();
  }
  function moveImageCropDrag(ev){
    const drag=imageCropSession?.drag;if(!drag||ev.pointerId!==drag.pointerId)return;
    ev.preventDefault();const p=imageCropPoint(ev);
    imageCropSession.crop=CREATIVE.dragImageCrop(drag.crop,drag.corner,p.x-drag.start.x,p.y-drag.start.y);
    updateImageCropPreview();
  }
  function endImageCropDrag(ev){
    if(imageCropSession?.drag?.pointerId!==ev.pointerId)return;
    if(ev.type==='pointerup')moveImageCropDrag(ev);
    imageCropSession.drag=null;
    if($('imageCropPreview').hasPointerCapture(ev.pointerId))$('imageCropPreview').releasePointerCapture(ev.pointerId);
  }
  function resizeObject(item,newWidth,newHeight,corner='se',bounds=itemBounds(item)){
    const original={type:item.type,x:item.x,y:item.y,w:item.w,h:item.h,size:item.size,rotation:item.rotation};
    // Preserve aspect ratio for imported photos and emoji stickers.
    const ratio=Math.max(.01,bounds.w/Math.max(1,bounds.h));
    let width=Math.max(16,Math.min(2200,newWidth));
    let height=Math.max(16,Math.min(2200,newHeight));
    if(item.type==='image'){height=Math.max(16,Math.min(2200,width/ratio));}
    if(item.type==='sticker'){width=height=Math.max(16,Math.min(1600,width));}
    if(item.type==='shape'){
      width=Math.max(4,width);height=Math.max(4,height);
    }
    const x=corner.includes('w')?bounds.x+bounds.w-width:bounds.x;
    const y=corner.includes('n')?bounds.y+bounds.h-height:bounds.y;
    item.x=x;item.y=y;
    if(item.type==='sticker')item.size=width;
    else{item.w=width;item.h=height;}
    const positioned=CREATIVE.positionObjectRect(original,item);item.x=positioned.x;item.y=positioned.y;
  }
  function resizeSelectedToWidth(width){
    const item=page()?.items[state.selected];if(!resizable(item))return;
    const bounds=itemBounds(item);if(Math.abs(width-bounds.w)<.5)return;
    remember();resizeObject(item,width,bounds.h*width/Math.max(1,bounds.w));
    renderCanvas();renderThumbs();scheduleSave();
  }
  function resizeDragItem(drag,p){
    const i=state.selected,original=drag.startItems[i];if(!resizable(original))return;
    p=CREATIVE.objectPoint(original,p,true);
    const b=drag.bounds,corner=drag.corner;
    const anchorX=corner.includes('w')?b.x+b.w:b.x;
    const anchorY=corner.includes('n')?b.y+b.h:b.y;
    let width=Math.max(16,Math.abs(p.x-anchorX));
    let height=Math.max(16,Math.abs(p.y-anchorY));
    if(original.type==='image'||original.type==='sticker'){
      const ratio=original.type==='sticker'?1:b.w/Math.max(1,b.h);
      if(width/ratio>height)height=width/ratio;else width=height*ratio;
    }
    const item=clone(original);
    // Opposite corner remains fixed, even while dragging outward.
    resizeObject(item,width,height,corner,b);
    page().items[i]=item;
    updateSelectionActions();
    queueBaseRefresh();
  }
  const distToSegment=(px,py,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay;const t=dx*dx+dy*dy?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy))):0;return Math.hypot(px-ax-dx*t,py-ay-dy*t);};
  function nearItem(item,x,y,forEraser=false){
    const local=CREATIVE.objectPoint(item,{x,y},true);x=local.x;y=local.y;
    const b=itemBounds(item),tolerance=forEraser?14:9;
    if(x<b.x-tolerance||x>b.x+b.w+tolerance||y<b.y-tolerance||y>b.y+b.h+tolerance)return false;
    if(item.type!=='stroke')return true;
    const pts=item.points||[];const reach=item.tool==='artist'?CREATIVE.artistBoundsPadding(item):item.size*(item.tool==='highlighter'?2.5:.7);
    if(pts.length===1)return Math.hypot(x-pts[0][0],y-pts[0][1])<tolerance+(item.tool==='artist'?reach:item.size);
    for(let i=1;i<pts.length;i++)if(distToSegment(x,y,...pts[i-1].slice(0,2),...pts[i].slice(0,2))<tolerance+reach)return true;
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
      composeInkNow();
      const existing=page().items[state.selected];
      const corner=resizeHit(existing,p);
      if(corner){
        state.drag={kind:'resize',pointerId:ev.pointerId,pointerType:ev.pointerType,rect,
          corner,bounds:itemBounds(existing),startItems:clone(page().items),changed:false};
        renderCanvas();return;
      }
      const idx=hitTest(p.x,p.y);state.selected=idx;
      state.drag={kind:'select',pointerId:ev.pointerId,pointerType:ev.pointerType,rect,startX:p.x,startY:p.y,startItems:clone(page().items),changed:false};
      renderCanvas();return;
    }
    if(['pen','highlighter','artist'].includes(state.tool))state.draft={id:uid(),type:'stroke',tool:state.tool,color:state.color,grade:state.tool==='artist'?state.artistGrade:undefined,...(state.tool==='artist'?{flow:state.artistFlow}:{}),size:state.size,points:[[p.x,p.y,p.p]]};
    else if(['rectangle','square','ellipse','circle','line','arrow','triangle','diamond','star'].includes(state.tool))state.draft={id:uid(),type:'shape',kind:state.tool,x:p.x,y:p.y,w:0,h:0,color:state.shapeOutlineColor,size:state.shapeOutlineSize,strokeStyle:state.shapeOutlineStyle,fillColor:state.shapeFillEnabled&&CREATIVE.isFillableShape(state.tool)?state.shapeFillColor:null,fillOpacity:state.shapeFillOpacity};
    else return;
    // Only the pen's incremental strokes remain in the live layer across letters.
    // Highlighter/shape previews retain their full-repaint behavior.
    if(!['pen','artist'].includes(state.tool))composeInkNow();
    clearTimeout(inkComposeTimer);inkComposeTimer=0;
    state.drag={kind:'draw',pointerId:ev.pointerId,pointerType:ev.pointerType,rect,startX:p.x,startY:p.y};
    $('pageShell').classList.add('is-handdrawing');
    if(['pen','artist'].includes(state.tool))drawnIndex=0;
    else clearInk();
    queueInk();
  }
  function updateShapeDraft(item,dx,dy){
    if(item.kind==='square' || item.kind==='circle'){
      const side=Math.max(Math.abs(dx),Math.abs(dy));
      item.w=side*(dx<0?-1:1);item.h=side*(dy<0?-1:1);
    }else{item.w=dx;item.h=dy;}
  }
  function pointerMove(ev){
    if(ev.pointerType==='pen'){
      state.lastPenAt=Date.now();
      // Recover when a pressed stylus MOVE arrives without its DOWN event.
      // Hover has pressure 0 and is never converted into handwriting.
      if(!state.drag && !state.pinch && ev.pressure>0.01 &&
         (ev.buttons&1) && ['pen','highlighter','artist'].includes(state.tool) &&
         !state.editingText && page())pointerDown(ev);
    }
    if(ev.pointerType==='touch'&&state.pointers.has(ev.pointerId))state.pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    if(state.pinch){
      if(state.pointers.size>=2){
        const contacts=[...state.pointers.values()];
        const distance=Math.max(12,Math.hypot(contacts[0].x-contacts[1].x,contacts[0].y-contacts[1].y));
        const center={x:(contacts[0].x+contacts[1].x)/2,y:(contacts[0].y+contacts[1].y)/2};
        state.pinch.next={zoom:Math.max(.35,Math.min(8,state.pinch.zoom*distance/state.pinch.distance)),center};
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
    if(state.drag.kind==='resize'){
      if(!state.drag.changed){remember();state.drag.changed=true;}
      resizeDragItem(state.drag,p);return;
    }
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
      }else updateShapeDraft(state.draft,p.x-state.drag.startX,p.y-state.drag.startY);
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
        else updateShapeDraft(state.draft,p.x-state.drag.startX,p.y-state.drag.startY);
      }
      const item=state.draft;
      if(item.type==='stroke' || Math.abs(item.w)+Math.abs(item.h)>3){
        // Commit the data immediately for undo / export; do not compose an entire
        // page or write IndexedDB at the pen-up boundary.
        rememberAppend(item);page().items.push(item);
        if(item.type==='stroke'&&['pen','artist'].includes(item.tool)){
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
    else if(['select','resize'].includes(state.drag.kind)&&state.drag.changed){scheduleSave();renderThumbs();renderCanvas();}
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
      else{state.activeId=null;view('library');renderLibrary();if(!dirtyAll)toast(`${data.notebooks.length} notebook${data.notebooks.length===1?'':'s'} imported without replacing existing notes`);}
    }catch(err){
      console.error('WiNDS Notes import:',err);
      toast(err?.message?.slice(0,110)||'Unable to open this notebook file');
    }
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
  function deleteNotebook(id){const n=state.notebooks.find(n=>n.id===id);if(!n)return;if(!confirm(n._sharing?`Remove "${n.title}" from this account's library? Other collaborators retain their shared notebook.`:`Permanently delete "${n.title}" and all ${n.pages.length} pages? Export a backup first if needed.`))return;tombstones[id]=now();state.notebooks=state.notebooks.filter(n=>n.id!==id);if(state.activeId===id){state.activeId=null;view('library');}scheduleSave(true);saveNow(true);renderLibrary();toast(n._sharing?'Shared notebook removed from your library':'Notebook deleted');}
  function closeMenus(){
    ['exportMenu','paperMenu','orientationMenu','moreMenu','emojiMenu','colorMenu','fillMenu','artistMenu','zoomMenu'].forEach(id=>$(id).hidden=true);
    [['exportBtn','exportMenu'],['paperStyleBtn','paperMenu'],['pageOrientationBtn','orientationMenu'],['moreOptionsBtn','moreMenu'],['emojiBtn','emojiMenu'],['customColorBtn','colorMenu'],['shapeFillBtn','fillMenu'],['artistBtn','artistMenu'],['zoomValue','zoomMenu']].forEach(([button])=>$(button).setAttribute('aria-expanded','false'));
  }
  function toggleMenu(buttonId,menuId){
    const wasClosed=$(menuId).hidden;
    closeMenus();
    if(!wasClosed)return;
    const menu=$(menuId),trigger=$(buttonId);
    menu.hidden=false;trigger.setAttribute('aria-expanded','true');
    positionMenu(trigger,menu);
  }
  function positionMenu(trigger,menu){
    const rect=trigger.getBoundingClientRect(),menuWidth=menu.offsetWidth||220;
    const x=Math.max(8,Math.min(window.innerWidth-menuWidth-8,rect.right-menuWidth));
    menu.style.left=`${x}px`;menu.style.right='auto';
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
    $('notebookGrid').addEventListener('click',e=>{const menu=e.target.closest('[data-notebook-menu]');if(menu){e.stopPropagation();openNotebookMenu(menu);return;}closeNotebookMenu();const card=e.target.closest('[data-open]');if(card)openNotebook(card.dataset.open);});
    $('cardShareNotebook').onclick=()=>{const id=menuNotebookId;closeNotebookMenu();window.WindsSharing?.open(id);};
    $('cardDeleteNotebook').onclick=()=>{const id=menuNotebookId;closeNotebookMenu();deleteNotebook(id);};
    document.addEventListener('click',e=>{if(!e.target.closest('#notebookCardMenu'))closeNotebookMenu();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeNotebookMenu();$('shareBackdrop').hidden=true;}});
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
    $('shapeFillBtn').onclick=showFillMenu;
    $('shapeFillEnabled').onchange=e=>{setFillOptions({enabled:e.target.checked});applyFillToSelected();};
    $('shapeFillColor').oninput=e=>setFillOptions({color:e.target.value,enabled:true});
    $('shapeFillColor').onchange=()=>applyFillToSelected();
    $('shapeFillOpacity').oninput=e=>setFillOptions({opacity:Number(e.target.value)/100});
    $('shapeFillOpacity').onchange=()=>applyFillToSelected();
    $('shapeOutlineColor').oninput=e=>setFillOptions({outlineColor:e.target.value});
    $('shapeOutlineColor').onchange=()=>applyFillToSelected();
    $('shapeOutlineSize').oninput=e=>setFillOptions({outlineSize:Number(e.target.value)});
    $('shapeOutlineSize').onchange=()=>applyFillToSelected();
    $('shapeOutlineStyle').onchange=e=>{setFillOptions({outlineStyle:e.target.value});applyFillToSelected();};
    $('shapeFillSwatches').onclick=e=>{const b=e.target.closest('[data-fill-color]');if(!b)return;setFillOptions({enabled:true,color:b.dataset.fillColor});applyFillToSelected();};
    $('applyShapeFill').onclick=()=>{if(applyFillToSelected())toast('Selected shape fill updated');else toast('Select a shape first');};
    buildArtistLibrary();
    $('artistSize').oninput=()=>{$('penSize').value=$('artistSize').value;updateSize();};
    $('artistFlow').oninput=()=>{state.artistFlow=Number($('artistFlow').value)/100;renderArtistPreviews();};
    $('artistBtn').onclick=e=>{e.stopPropagation();if(state.tool!=='artist')setTool('artist');toggleMenu('artistBtn','artistMenu');if(!$('artistMenu').hidden)renderArtistPreviews();};
    $('artistMenu').onclick=e=>{const group=e.target.closest('[data-artist-group]');if(group){state.artistGroup=group.dataset.artistGroup;$('artistMenu').scrollTop=0;renderArtistPreviews();return;}const b=e.target.closest('[data-grade]');if(b)setArtistGrade(b.dataset.grade);};
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
    document.addEventListener('click',e=>{if(!e.target.closest('.pop-menu')&&!e.target.closest('#exportBtn')&&!e.target.closest('#paperStyleBtn')&&!e.target.closest('#pageOrientationBtn')&&!e.target.closest('#moreOptionsBtn')&&!e.target.closest('#emojiBtn')&&!e.target.closest('#customColorBtn')&&!e.target.closest('#shapeFillBtn')&&!e.target.closest('#artistBtn')&&!e.target.closest('#zoomValue'))closeMenus();});
    document.querySelectorAll('[data-tool]').forEach(btn=>{if(btn.dataset.tool!=='artist')btn.onclick=()=>setTool(btn.dataset.tool);});
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
    $('zoomIn').onclick=()=>changeZoom(state.zoom>=2?.5:.25);
    $('zoomOut').onclick=()=>changeZoom(state.zoom>2?-.5:-.25);
    $('zoomValue').onclick=e=>{e.stopPropagation();toggleMenu('zoomValue','zoomMenu');};
    $('zoomMenu').onclick=e=>{const option=e.target.closest('[data-zoom]');if(!option)return;setZoom(Number(option.dataset.zoom));closeMenus();};
    $('selectedShrink').onclick=()=>{const item=page()?.items[state.selected];if(item)resizeSelectedToWidth(itemBounds(item).w*.85);};
    $('selectedGrow').onclick=()=>{const item=page()?.items[state.selected];if(item)resizeSelectedToWidth(itemBounds(item).w*1.15);};
    $('selectedWidth').onchange=e=>resizeSelectedToWidth(Number(e.target.value));
    $('selectedRotation').onchange=e=>rotateSelectedTo(e.target.valueAsNumber);
    $('rotateSelectedLeft').onclick=()=>rotateSelectedTo(CREATIVE.objectRotation(page()?.items[state.selected])-90);
    $('rotateSelectedRight').onclick=()=>rotateSelectedTo(CREATIVE.objectRotation(page()?.items[state.selected])+90);
    $('cropSelectedImage').onclick=openImageCrop;
    $('closeImageCrop').onclick=$('cancelImageCrop').onclick=closeImageCrop;
    $('applyImageCrop').onclick=applyImageCrop;
    $('resetImageCrop').onclick=()=>{if(imageCropSession){imageCropSession.crop=CREATIVE.imageCrop();updateImageCropPreview();}};
    $('imageCropBackdrop').onclick=e=>{if(e.target===$('imageCropBackdrop'))closeImageCrop();};
    for(const [id,key] of [['cropLeft','x'],['cropTop','y'],['cropWidth','w'],['cropHeight','h']]){
      $(id).onchange=e=>{if(!imageCropSession)return;const value=Number(e.target.value);if(Number.isFinite(value))imageCropSession.crop=CREATIVE.imageCrop({...imageCropSession.crop,[key]:value/100});updateImageCropPreview();};
    }
    $('imageCropPreview').addEventListener('pointerdown',beginImageCropDrag);
    $('imageCropPreview').addEventListener('pointermove',moveImageCropDrag);
    for(const event of ['pointerup','pointercancel','lostpointercapture'])$('imageCropPreview').addEventListener(event,endImageCropDrag);
    $('removeSelected').onclick=()=>{if(state.selected<0)return;remember();page().items.splice(state.selected,1);state.selected=-1;renderCanvas();renderThumbs();scheduleSave();};
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
    // Backups use the same complete validation and fresh IDs as native imports.
    $('restoreFileInput').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)openEditableFile(file);};
    let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.drag?.kind==='draw')return;updateSidebar();resizePage();updateToolbarArrows();if(!$('artistMenu').hidden)positionMenu($('artistBtn'),$('artistMenu'));},160);});
    document.addEventListener('keydown',e=>{
      if(!$('imageCropBackdrop').hidden){
        if(e.key==='Escape'){e.preventDefault();closeImageCrop();}
        else if(e.key==='Tab'){
          const controls=[...$('imageCropDialog').querySelectorAll('button,input')],first=controls[0],last=controls[controls.length-1];
          if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('imageCropDialog'))){e.preventDefault();last.focus();}
          else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
        }else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!e.target.matches('input'))e.preventDefault();
        return;
      }
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
    initIcons();bind();setColor(COLORS[0]);updateSize();syncFillControls();
    await storageOpen();const stored=await loadData();
    if(stored && Array.isArray(stored.notebooks)){state.notebooks=stored.notebooks;tombstones=stored.deleted||{};}
    else{const legacy=await oldDatabase();if(legacy&&Array.isArray(legacy.notebooks)){state.notebooks=legacy.notebooks;toast('Your existing notebooks have been imported');}else seed();dirtyAll=true;saveVersion++;await saveNow(true);}
    renderLibrary();view('library');
    window.WindsDrive?.init({
      getData:workspaceSnapshot,
      switchWorkspace,
      mergeWorkspace,
      isWriting:()=>Boolean(state.drag||state.pinch||state.editingText||imageCropSession||Date.now()-lastInkAt<CLOUD_IDLE_MS),
      isDrawingNow:()=>Boolean(state.drag||state.pinch),
      isEditing:()=>Boolean(state.editingText||imageCropSession),
      isSaving:()=>saving,
      syncIdleDelay:cloudSyncDelay,
      sharing:{notebooks:()=>state.notebooks,activeId:()=>state.activeId,version:()=>saveVersion,putShared:putSharedNotebook,deleted:id=>Boolean(tombstones[id]),openNotebook,toast},
      live:{busy:idle=>Boolean(state.drag||state.pinch||state.editingText||imageCropSession||Date.now()-lastInkAt<idle),
        room:id=>{const n=state.notebooks.find(book=>book.id===id);return n?(n._sharing?'shared:'+n._sharing.folderId:'account'):null;},
        rooms:()=>[...new Set([notebook(),...state.notebooks].filter(n=>n?._sharing).map(n=>'shared:'+n._sharing.folderId))],
        paint:items=>{livePreviewItems=items;if(!livePreviewRAF)livePreviewRAF=requestAnimationFrame(paintLiveLayer);},clear:clearLiveLayer},
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
