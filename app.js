/* WiNDS Notes — GitHub Pages-friendly handwriting web app.
   Writing works completely offline. Optional Google Drive backup uses Google Identity Services. */
(() => {
  'use strict';
  let W = 840, H = 1188;
  let RENDER_SCALE = 2;
  const EXPORT_SCALE = 2;
  const ORIENTATIONS = Object.freeze({portrait:{width:840,height:1188},landscape:{width:1188,height:840}});
  const pageDimensions = p => p?.background?.type==='pdf'&&Number.isFinite(p.background.width)&&Number.isFinite(p.background.height)&&p.background.width>0&&p.background.height>0&&p.background.width<=2376&&p.background.height<=2376?{width:p.background.width/2,height:p.background.height/2}:ORIENTATIONS[p?.orientation==='landscape'?'landscape':'portrait'];
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
  const workspaceActor = 'tab-'+uid();
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
  // Education add-on: regular editable stickers, available offline.
  const EDUCATION_STICKERS = [
    ['🏫','School','classroom campus university'],['🎒','Backpack','school bag supplies'],
    ['🧑‍🏫','Teacher','professor tutor lesson classroom'],['🧑‍🎓','Student','graduate learner university'],
    ['📕','Red textbook','book reading study'],['📗','Green textbook','book reading study'],
    ['📘','Blue textbook','book reading study'],['📙','Orange textbook','book reading study'],
    ['📓','Notebook','journal homework study'],['📔','Study journal','notebook diary reading'],
    ['📒','Lesson planner','timetable schedule notebook'],['📃','Worksheet','assignment paper homework'],
    ['📄','Assignment','document essay paper'],['📑','Revision tabs','bookmark exam notes'],
    ['🔖','Bookmark','reading revision study'],['📋','Study checklist','clipboard task homework'],
    ['🗂️','Subject folders','organize files index'],['🗃️','Flashcards','revision memory study cards'],
    ['📎','Paperclip','stationery organize'],['🖇️','Linked paperclips','stationery connection'],
    ['✏️','Pencil','writing sketch stationery'],['🖊️','Ballpoint pen','writing ink stationery'],
    ['🖋️','Fountain pen','writing calligraphy ink'],['🖌️','Paintbrush','art painting design'],
    ['🖍️','Crayon','art coloring drawing'],['📐','Set square','geometry triangle maths math'],
    ['📏','Ruler','measurement length geometry maths math'],['✂️','Scissors','craft art cut'],
    ['🧮','Abacus','calculation arithmetic maths math'],['🔢','Numbers','counting arithmetic maths math'],
    ['➕','Addition','plus arithmetic maths math'],['➖','Subtraction','minus arithmetic maths math'],
    ['✖️','Multiplication','times arithmetic maths math'],['➗','Division','divide arithmetic maths math'],
    ['🟰','Equals','equation algebra maths math'],['♾️','Infinity','calculus algebra maths math'],
    ['⚛️','Atom','physics science atomic'],['🧬','DNA','biology genetics science'],
    ['🔭','Telescope','astronomy space science'],['🧫','Petri dish','biology bacteria laboratory science'],
    ['⚗️','Chemistry flask','experiment laboratory science'],['🧲','Magnet','physics magnetism science'],
    ['🔋','Battery','physics electricity energy circuit science'],['⚙️','Gear','engineering mechanics technology'],
    ['🌡️','Thermometer','temperature physics chemistry science'],['🌋','Volcano','geology geography earth science'],
    ['🧭','Compass','geography navigation direction'],['🗺️','World map','geography countries atlas'],
    ['🗣️','Speaking practice','language speech presentation debate'],['🏅','Achievement medal','award success exam reward']
  ];
  const ALL_STICKERS=[...EMOJI_STICKERS,...EDUCATION_STICKERS];
  let stickerCollection='all';
  const ICONS = {
    plus:'<path d="M12 5v14M5 12h14"/>',
    back:'<path d="M19 12H5m7-7-7 7 7 7"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
    upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 17v4h16v-4"/>',
    search:'<circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/>',
    pen:'<path d="m13 6 5 5M4 20l5-.9L20 7a2.1 2.1 0 0 0-3-3L5 16z"/>',
    highlighter:'<path d="m3 17 4 4 4-4-4-4zM7 13 17.4 2.6l4 4L11 17M2 22h13"/>',
    eraser:'<path d="m4 12 8.2-8.2a2 2 0 0 1 2.8 0L21 9.7a2 2 0 0 1 0 2.8L13.5 20h-5L4 15a2 2 0 0 1 0-3Z"/><path d="m8 8 8.5 8.5M13.5 20H22"/>',
    pan:'<path d="M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v10c0 4-3 6-7 6-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2z"/>',
    area:'<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><path d="M8 12h8m-4-4v8"/>',
    select:'<path d="M4 8V4h4m8 0h4v4m0 8v4h-4M8 20H4v-4"/><path d="m8 7 9 6-4.3.8-2.2 3.6Z" fill="currentColor" stroke-width="1"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 5V4H6a2 2 0 0 0-2 2v10h1"/>',
    cut:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.2 8.2 12.3 12.3M8.2 15.8 20.5 3.5"/>',
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
  const state = {notebooks:[],activeId:null,pageIndex:0,tool:'pen',color:COLORS[0],size:7,pendingInteractions:0,eraserSize:28,eraserInkOnly:false,zoom:1,penOnly:true,textStyle:null,artistGrade:'HB',artistGroup:'graphite',artistFlow:1,shapeFillEnabled:false,shapeFillColor:'#b9adff',shapeFillOpacity:1,shapeOutlineColor:'#2b2d4c',shapeOutlineSize:7,shapeOutlineStyle:'solid',selected:-1,draft:null,drag:null,pointers:new Map(),pinch:null,sidebarOpen:false,saveTimer:null,toastTimer:null,editingText:null,lastPenAt:0,stylusSeen:false,stylusPreferenceChanged:false};
  let eraserPreview=null,eraserPrepareTimer=0;
  const history = new Map();
  const imageCache = new Map(),pdfBackgroundCache=new Map();
  let pdfRepaintTimer=0,preparedExport=null,preparedExportTimer=0;
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
    if(state.drag||state.pinch||state.editingText||state.pendingInteractions||imageCropSession||globalThis.WindsText?.isOpen()){window.WindsLive?.render();return;}
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
    set('copySelected','copy');set('cutSelected','cut');
    Object.entries({openFileIcon:'upload',heroPlus:'plus',newPlus:'plus',searchIcon:'search',goLibrary:'back',undoBtn:'undo',redoBtn:'redo',moreOptionsBtn:'more',exportIcon:'download',togglePages:'pages',pencilOnlyIcon:'pencil',insertImageBtn:'image',paperStyleBtn:'paper',pageOrientationBtn:'orientation',addPageSidebar:'plus',addPageTop:'plus',addPageBottomIcon:'plus',zoomOut:'zoomOut',zoomIn:'zoomIn',floatPlus:'plus',prevPage:'chevronLeft',nextPage:'chevronRight',closeModal:'x'}).forEach(([id,name])=>set(id,name));
    document.querySelectorAll('[data-tool]').forEach(btn => {if(btn.dataset.tool!=='artist')btn.innerHTML=icon(btn.dataset.tool);});
    document.querySelectorAll('[data-shape-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.shapeIcon);});
    restoreShapePreference();
    $('shapeFillSwatches').innerHTML=['#b9adff','#f6b4c4','#f8db8e','#a2e8d1','#a7d6fa','#f7f7f7','#2b2d4c','#f3a75f'].map(c=>`<button class="fill-swatch" type="button" data-fill-color="${c}" title="${c}" aria-label="Use fill color ${c}" style="--fill-color:${c}"></button>`).join('');
    $('colorPalette').innerHTML = COLORS.map((c,i)=>`<button class="color-button ${i===0?'selected':''}" data-color="${c}" title="Ink ${i+1}" aria-label="Choose ink color ${i+1}"><span style="background:${c}"></span></button>`).join('');
    $('extendedColors').innerHTML = MORE_COLORS.map(c=>`<button class="extended-swatch" data-more-color="${c}" aria-label="Choose color ${c}" title="${c}" style="--swatch:${c}"></button>`).join('');
    renderEmojiGrid('');
    $('coverChoices').innerHTML = COVER_COLORS.map((c,i)=>`<button class="cover-choice cover-${c} ${i===0?'active':''}" data-cover="${c}" aria-label="${c} cover" title="${c} cover"></button>`).join('');
  }
  // v2 stores notebook metadata and individual pages separately. A stroke saves only
  // its page, rather than serializing every page of every notebook during writing.
  function storageOpen(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB){persistence='localstorage';resolve();return;}
      let settled=false;
      try{
        const req=indexedDB.open(workspaceDatabaseName(),1);
        req.onupgradeneeded=()=>{
          const db=req.result;
          if(!db.objectStoreNames.contains('notebooks'))db.createObjectStore('notebooks',{keyPath:'id'});
          if(!db.objectStoreNames.contains('pages'))db.createObjectStore('pages',{keyPath:'id'});
          if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta');
        };
        req.onsuccess=()=>{
          if(settled){req.result.close();return;}
          settled=true;database=req.result;resolve();
        };
        req.onerror=()=>{if(settled)return;settled=true;persistence='localstorage';resolve();};
        req.onblocked=()=>{
          if(settled)return;settled=true;
          reject(new Error('Notebook storage is busy in another tab. Close that tab and try again.'));
        };
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
      try{
        const stored=JSON.parse(localStorage.getItem(workspaceLocalStorageKey())||(workspaceId==='guest'?localStorage.getItem('folio-notes-data'):null));
        if(stored!==null&&(!Array.isArray(stored.notebooks)||stored.notebooks.some(n=>!n||!Array.isArray(n.pages)||!n.pages.length)))throw new Error('Saved notebook storage is damaged. Keep your website data and restore a backup.');
        return Promise.resolve(stored);
      }catch(err){return Promise.reject(err);}
    }
    return new Promise((resolve,reject)=>{
      try{
        const tx=database.transaction(['notebooks','pages','meta'],'readonly');
        const booksReq=tx.objectStore('notebooks').getAll();
        const pagesReq=tx.objectStore('pages').getAll();
        const initializedReq=tx.objectStore('meta').get('initialized');
        const deletionsReq=tx.objectStore('meta').get('deleted');
        tx.oncomplete=()=>{
          try{
            const books=booksReq.result||[];
            if(!books.length){resolve(initializedReq.result?{version:2,notebooks:[],deleted:deletionsReq.result||{}}:null);return;}
            const byId=new Map((pagesReq.result||[]).map(p=>[p.id,p]));
            const notebooks=books.map(n=>{
              if(!Array.isArray(n.pages)||!n.pages.length)throw new Error('Saved notebook pages could not be read. Keep your website data and restore a backup.');
              return {...n,pages:n.pages.map(entry=>{
                const saved=byId.get(typeof entry==='string'?entry:entry.id);
                if(!saved)throw new Error('A saved notebook page could not be read. Keep your website data and restore a backup.');
                return saved;
              })};
            });
            resolve({version:2,notebooks,deleted:deletionsReq.result||{}});
          }catch(error){reject(error);}
        };
        tx.onerror=()=>reject(tx.error||new Error('Unable to read saved notebooks'));
        tx.onabort=()=>reject(tx.error||new Error('Reading saved notebooks was interrupted'));
      }catch(err){reject(err);}
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
        // Commit now rather than after the request callbacks: a save started
        // while the page closes or reloads still reaches the disk.
        try{tx.commit?.();}catch{}
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
        // Commit now rather than after the request callbacks: a save started
        // while the page closes or reloads still reaches the disk.
        try{tx.commit?.();}catch{}
      }catch(err){reject(err);}
    });
  }
  function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
  function statusText(message,pending=false){
    const el=$('saveStatus');el.textContent=message;el.classList.toggle('saving',pending);
  }
  function scheduleSave(structural=false,eraserOnly=false){
    if(!eraserOnly)state.erasePreviewRevision=(state.erasePreviewRevision||0)+1;
    const n=notebook();if(n){n.updatedAt=now();dirtyBooks.add(n.id);if(page())dirtyPages.add(page().id);}
    if(structural)dirtyAll=true;
    window.WindsPageStack?.dirty(page()?.id);
    saveVersion++;lastInkAt=Date.now();
    window.WindsLive?.changed(n?.id,page()?.id);
    // A writing burst has a single pending state; there are NO writes between letters.
    if($('saveStatus').textContent!=='Unsaved changes')statusText('Unsaved changes',true);
    clearTimeout(state.saveTimer);
    state.saveTimer=setTimeout(()=>saveNow(),SAVE_IDLE_MS);
    if(state.tool==='eraser')queueEraserPreparation();
  }
  let saveTask=null;
  async function saveNow(force=false,fromDrive=false){
    clearTimeout(state.saveTimer);
    while(saving){
      if(!force){state.saveTimer=setTimeout(()=>saveNow(false,fromDrive),600);return;}
      // Explicit saves must finish before an account can close this database.
      await saveTask?.catch(()=>{});
    }
    if(!force && (state.drag||state.pinch||state.editingText||state.pendingInteractions||imageCropSession||globalThis.WindsText?.isOpen()||Date.now()-lastInkAt<SAVE_IDLE_MS-100)){
      const remaining=Math.max(1000,SAVE_IDLE_MS-(Date.now()-lastInkAt));
      state.saveTimer=setTimeout(()=>saveNow(),remaining);return;
    }
    if(!dirtyAll && !dirtyBooks.size && !dirtyPages.size)return;
    const version=saveVersion,full=dirtyAll;
    const bookIds=[...dirtyBooks],pageIds=[...dirtyPages];
    dirtyAll=false;dirtyBooks.clear();dirtyPages.clear();
    saving=true;
    try{
      for(const n of state.notebooks)if(full||bookIds.includes(n.id))globalThis.WindsWorkspaceModel.capture(n,workspaceActor);
      saveTask=full?writeData({version:2,notebooks:state.notebooks}):writeChanged(bookIds,pageIds);
      await saveTask;
      if(version===saveVersion)statusText('Saved');
      else{statusText('Unsaved changes',true);clearTimeout(state.saveTimer);state.saveTimer=setTimeout(()=>saveNow(),SAVE_IDLE_MS);}
      // Receiving a remote edit is not a new local edit. The merge reports
      // whether this device has additional content that needs uploading.
      if(!fromDrive)window.WindsDrive?.onLocalSave?.();
      return true;
    }catch(err){
      dirtyAll=true;statusText('Not saved — back up your notes',true);
      toast('Saving failed. Export an editable backup to protect your notes.');
      console.error(err);
      return false;
    }finally{saving=false;saveTask=null;}
  }
  // Each signed-in Google identity has a dedicated local IndexedDB.
  // The original installation remains the separate, unsigned guest workspace.
  // Tokens and user credentials are NEVER stored in IndexedDB.
  let interfaceLocks=0;
  function lockInterface(){
    interfaceLocks++;document.body.inert=true;
    let released=false;
    return ()=>{
      if(released)return;released=true;
      interfaceLocks--;document.body.inert=interfaceLocks>0;
    };
  }
  let workspaceTransition=Promise.resolve();
  function switchWorkspace(accountSub){
    const next=workspaceTransition.then(()=>activateWorkspace(accountSub));
    workspaceTransition=next.catch(()=>{});
    return next;
  }
  async function activateWorkspace(accountSub){
    if(accountSub!==null && !/^[a-zA-Z0-9_-]{5,200}$/.test(String(accountSub)))throw new Error('Invalid Google account identifier');
    const target=accountSub?`g-${accountSub}`:'guest';
    if(target===workspaceId)return;
    const unlock=lockInterface();
    try{
      globalThis.WindsMandala?.close();cancelBoundaryFill(true);globalThis.WindsText?.close();globalThis.WindsClipboard?.clear();closePageReader();clearPreparedExport();
      finishActiveStroke();composeInkNow();commitText();
      while(state.pendingInteractions)await delay(100);
      await saveNow(true);
      if(saving||dirtyAll||dirtyBooks.size||dirtyPages.size)throw new Error('Your current notes could not be saved. Export a backup before switching accounts.');
      clearTimeout(state.saveTimer);clearTimeout(thumbnailTimer);clearTimeout(inkComposeTimer);clearTimeout(cloudRenderTimer);
      state.drag=null;state.draft=null;state.pinch=null;state.pointers.clear();
      const previous={database,persistence,workspaceId};
      database=null;persistence='indexeddb';workspaceId=target;
      let incoming;
      try{
        await storageOpen();
        incoming=await loadData();
      }catch(error){
        if(database!==previous.database)database?.close();
        database=previous.database;persistence=previous.persistence;workspaceId=previous.workspaceId;
        throw error;
      }
      previous.database?.close();
      window.WindsPageStack.reset();eraserPreview?.reset();groupSelection=null;
      dirtyAll=false;dirtyBooks.clear();dirtyPages.clear();history.clear();
      state.activeId=null;state.pageIndex=0;state.selected=-1;
      state.notebooks=Array.isArray(incoming?.notebooks)?incoming.notebooks:[];
      tombstones=incoming?.deleted&&typeof incoming.deleted==='object'?incoming.deleted:{};
      initializeSyncHistory();
      statusText('Saved');
      $('searchNotebooks').value='';view('library');renderLibrary();
    }finally{unlock();}
    resumeLastNotebook();
  }

  function initializeSyncHistory(){
    // Establish old notebooks' baseline before the first edit. It is persisted
    // by the next idle save; a read-only reopen computes the same baseline.
    for(const n of state.notebooks)if(!n._sync&&!n._sharing)globalThis.WindsWorkspaceModel.capture(n,workspaceActor);
  }
  function workspaceSnapshot(){
    // Drive serializes this view synchronously before starting the upload.
    return {format:'winds-notes-backup',version:2,exportedAt:now(),syncVersion:1,notebooks:state.notebooks,deleted:tombstones};
  }
  function cloudSyncDelay(){
    if(globalThis.WindsMandala?.isOpen()||globalThis.WindsBoundaryFill?.isActive()||state.drag||state.pinch||state.editingText||state.pendingInteractions||imageCropSession||globalThis.WindsText?.isOpen()||globalThis.WindsPDFImport?.isOpen())return CLOUD_IDLE_MS;
    const remaining=CLOUD_IDLE_MS-(Date.now()-lastInkAt);
    if(remaining>0)return remaining;
    return saving||dirtyAll||dirtyBooks.size||dirtyPages.size?1000:0;
  }
  function renderCloudChanges(expectedWorkspace=workspaceId){
    clearTimeout(cloudRenderTimer);
    if(expectedWorkspace!==workspaceId)return;
    const remaining=cloudSyncDelay();
    if(remaining){cloudRenderTimer=setTimeout(()=>renderCloudChanges(expectedWorkspace),remaining);return;}
    if(state.activeId&&notebook()){for(const p of notebook().pages)globalThis.WindsPageStack?.dirty(p.id);state.pageIndex=Math.min(state.pageIndex,notebook().pages.length-1);renderEditor();}
    else{state.activeId=null;view('library');renderLibrary();}
  }
  function reconcileCloudHistory(final,model){
    const nextBooks=new Map(final.map(n=>[n.id,n]));
    for(const before of state.notebooks){
      if(before._sharing)continue;
      const after=nextBooks.get(before.id),nextPages=new Map((after?.pages||[]).map(p=>[p.id,p]));
      for(const p of before.pages){
        const next=nextPages.get(p.id),h=history.get(p.id);
        if(!next){history.delete(p.id);continue;}
        const unchanged=model.equal(p.items,next.items);
        if(!unchanged&&state.activeId===before.id){state.selected=-1;groupSelection=null;}
        if(!h)continue;
        const oldItems=new Map(p.items.map(i=>[i.id,i])),nextItems=new Map(next.items.map(i=>[i.id,i]));
        h.undo=h.undo.filter(action=>action.kind==='append'?nextItems.has(action.item.id)&&model.equal(oldItems.get(action.item.id),nextItems.get(action.item.id)):unchanged);
        h.redo=h.redo.filter(action=>{
          if(action.kind!=='append')return unchanged;
          const key=JSON.stringify(['item',p.id,action.item.id]);
          return !nextItems.has(action.item.id)&&model.equal(before._sync?.fields[key],after._sync?.fields[key]);
        });
      }
    }
  }
  async function mergeWorkspace(snapshot,{manual=false,report=false}={}){
    const account=workspaceId;
    if(globalThis.WindsMandala?.isOpen()||globalThis.WindsBoundaryFill?.isActive()||state.drag||state.pinch||state.editingText||state.pendingInteractions||imageCropSession||globalThis.WindsText?.isOpen()||globalThis.WindsPDFImport?.isOpen()||saving||dirtyAll||dirtyBooks.size||dirtyPages.size||(!manual&&cloudSyncDelay())){
      const error=new Error('Writing or local saving resumed. Cloud synchronization will retry when idle.');
      error.syncDeferred=true;throw error;
    }
    if(!snapshot || snapshot.format!=='winds-notes-backup' || !Array.isArray(snapshot.notebooks) || snapshot.notebooks.length>750)throw new Error('Invalid Drive workspace');
    const model=globalThis.WindsWorkspaceModel;
    if(!model)throw new Error('Sync components are unavailable. Reload the app before syncing.');
    const remoteDeleted=snapshot.deleted&&typeof snapshot.deleted==='object'?snapshot.deleted:{};
    const mergedDeleted={...tombstones};
    for(const [id,mark] of Object.entries(remoteDeleted))mergedDeleted[id]=model.mergeDeletion(mergedDeleted[id],mark);
    const merged=new Map(state.notebooks.map(n=>[n.id,n])),remoteBooks=new Map();
    for(const raw of snapshot.notebooks){
      const n=clone(raw);
      if(!n || typeof n.id!=='string' || typeof n.title!=='string' || !Array.isArray(n.pages)||!n.pages.length||n.pages.length>500 || n.pages.some(p=>!Array.isArray(p.items)||p.items.length>50000))throw new Error('Invalid Drive notebook data');
      remoteBooks.set(n.id,raw);
      const local=merged.get(n.id);
      // Shared notebooks retain their separate immutable edit history/outbox.
      if(local?._sharing)continue;
      if(n._sharing){if(!local)merged.set(n.id,n);continue;}
      if(!local){model.capture(n);merged.set(n.id,n);}
      else{
        const result=model.merge(local,n);
        if(!model.equal(local,result.book))merged.set(n.id,result.book);
      }
    }
    const final=[...merged.values()].filter(n=>!model.removes(mergedDeleted[n.id],n));
    const hasChanges=final.length!==state.notebooks.length||final.some((n,index)=>n!==state.notebooks[index])||!model.equal(mergedDeleted,tombstones);
    const needsUpload=final.length!==snapshot.notebooks.length||final.some(n=>!model.equal(n,remoteBooks.get(n.id)))||!model.equal(mergedDeleted,remoteDeleted);
    if(hasChanges){
      reconcileCloudHistory(final,model);
      const activePage=page()?.id;
      state.notebooks=final;tombstones=mergedDeleted;
      const activeIndex=notebook()?.pages.findIndex(p=>p.id===activePage);if(activeIndex>=0)state.pageIndex=activeIndex;
      dirtyAll=true;saveVersion++;
      if(await saveNow(true,report)===false)throw new Error('Received changes could not be saved locally. Sync will retry.');
      // A new stroke may have started while the IndexedDB write was in flight.
      // Keep that stroke and canvas intact, and compose remote changes when idle.
      renderCloudChanges(account);
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
  async function copyNotebookForSharing(id){
    if(state.drag||state.pinch||state.editingText||state.pendingInteractions||imageCropSession||globalThis.WindsText?.isOpen()||saving||cloudSyncDelay())throw Error('Finish writing and try again when the notebook is saved.');
    const original=state.notebooks.find(n=>n.id===id);if(!original)throw Error('Notebook no longer exists.');
    const account=workspaceId,copy=window.WindsFile.parse(window.WindsFile.serialize(original)).notebooks[0];
    copy.title=(original.title+' (sharing copy)').slice(0,70);copy.updatedAt=now();
    state.notebooks.push(copy);dirtyAll=true;saveVersion++;await saveNow(true);
    if(account!==workspaceId)throw Error('The account changed. The copy stays in the original account.');
    if(dirtyAll)throw Error('The copy could not be saved on this device. Export a backup before sharing.');
    renderLibrary();return copy.id;
  }
  async function putSharedNotebook(book,sharing,version,attach=false,manual=false){
    if(version!==saveVersion||saving||state.drag||state.pinch||state.editingText||state.pendingInteractions||imageCropSession||globalThis.WindsText?.isOpen()||globalThis.WindsPDFImport?.isOpen()||dirtyAll||dirtyBooks.size||dirtyPages.size||(!manual&&cloudSyncDelay())){
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
  /* Reopen the notebook and page after a reload, an iPad tab discard or a
   * Google reconnect bounce. Per-tab (sessionStorage) and account-scoped. */
  const RESUME_KEY='winds-notes-resume-v1',bootStartedAt=Date.now();
  let resumeHandled=false;
  function rememberResumePoint(){
    try{
      if(state.activeId&&notebook())sessionStorage.setItem(RESUME_KEY,JSON.stringify({workspace:workspaceId,bookId:state.activeId,pageIndex:state.pageIndex,at:Date.now()}));
      else sessionStorage.removeItem(RESUME_KEY);
    }catch{}
  }
  function resumeLastNotebook(){
    if(resumeHandled)return;
    if(state.activeId||Date.now()-bootStartedAt>60000){resumeHandled=true;return;}
    let saved=null;try{saved=JSON.parse(sessionStorage.getItem(RESUME_KEY)||'null');}catch{}
    if(!saved){resumeHandled=true;return;}
    if(saved.workspace!==workspaceId)return; // the remembered account may still be opening
    resumeHandled=true;
    // Startup opens guest notes first; a remembered Google account replaces them.
    if(workspaceId==='guest'){try{if(sessionStorage.getItem('winds-drive-session-v1')||localStorage.getItem('winds-drive-last-account-v1'))return;}catch{}}
    const n=state.notebooks.find(book=>book.id===saved.bookId);if(!n)return;
    openNotebook(n.id);
    const index=Math.min(Math.max(0,Number(saved.pageIndex)|0),n.pages.length-1);
    if(index>0)switchPage(index);
  }
  async function prepareNavigation(){
    cancelBoundaryFill(true);finishActiveStroke();composeInkNow();commitText();
    while(state.pendingInteractions)await delay(80);
    await saveNow(true);
    if(saving||dirtyAll||dirtyBooks.size||dirtyPages.size)throw new Error('Your latest notes are still saving. Try again in a moment.');
    rememberResumePoint();
  }
  function openNotebook(id){
    cancelBoundaryFill(true);
    finishActiveStroke();if(state.pendingInteractions){setTimeout(()=>openNotebook(id),100);return;}
    const n=state.notebooks.find(x=>x.id===id);if(!n)return;
    clearLiveLayer();prunePdfImages(n);
    state.activeId=id;state.pageIndex=0;state.selected=-1;state.zoom=1;RENDER_SCALE=2;state.draft=null;
    state.sidebarOpen=false;thumbnailsDirty=true;
    view('editor');$('notebookTitle').value=n.title;
    syncPageGeometry();updateSidebar();setTool('pen');renderEditor();resizePage();window.WindsPageStack.focus(page().id);requestAnimationFrame(updateToolbarArrows);window.WindsLive?.refreshRooms();
  }
  function goLibrary(){cancelBoundaryFill(true);finishActiveStroke();if(state.pendingInteractions){setTimeout(goLibrary,100);return;}window.WindsPageStack.reset();eraserPreview?.reset();groupSelection=null;commitText();state.draft=null;composeInkNow();saveNow(true);state.activeId=null;view('library');renderLibrary();}
  function renderEditor(){
    eraserPreview?.invalidate();
    const n=notebook();if(!n)return;
    $('notebookTitle').value=n.title;
    $('pageCount').textContent=n.pages.length;
    const pdf=page()?.background;
    $('pageBreadcrumb').textContent=`Page ${state.pageIndex+1} of ${n.pages.length}${pdf?' · PDF page '+pdf.sourcePage:''}`;
    $('paperStyleBtn').disabled=$('pageOrientationBtn').disabled=Boolean(pdf);
    $('paperStyleBtn').title=pdf?'PDF background is fixed':'Change paper template';
    $('pageOrientationBtn').title=pdf?'PDF page orientation is preserved':'Page orientation: Portrait / Landscape';
    $('pageIndicator').textContent=`${state.pageIndex+1} / ${n.pages.length}`;
    $('prevPage').disabled=state.pageIndex===0;
    $('nextPage').disabled=state.pageIndex===n.pages.length-1;
    $('moreMenu').querySelector('[data-action="deletePage"]').disabled=n.pages.length===1;
    window.WindsPageStack.sync();renderThumbs();renderCanvas();updateHistoryButtons();
  }
  function updateSidebar(){
    $('pagesSidebar').classList.toggle('collapsed',!state.sidebarOpen);
    $('editorScrim').hidden=!state.sidebarOpen;
    $('togglePages').classList.toggle('active',state.sidebarOpen);
    $('togglePages').setAttribute('aria-pressed',String(state.sidebarOpen));
    if(state.sidebarOpen && thumbnailsDirty)renderThumbs(true);
  }
  function switchPage(index,preserveScroll=false){
    cancelBoundaryFill(true);
    finishActiveStroke();if(state.pendingInteractions){setTimeout(()=>switchPage(index,preserveScroll),100);return;}
    finishActiveStroke();const n=notebook();if(!n||index<0||index>=n.pages.length)return;
    clearLiveLayer();composeInkNow();commitText();state.pageIndex=index;state.selected=-1;state.draft=null;syncPageGeometry();resizePage();renderEditor();
    if(!preserveScroll)window.WindsPageStack.focus(page().id);
    if(state.sidebarOpen){state.sidebarOpen=false;updateSidebar();}
  }
  function addPage(){
    finishActiveStroke();if(state.pendingInteractions){setTimeout(addPage,100);return;}const n=notebook();if(!n)return;
    composeInkNow();commitText();n.pages.splice(state.pageIndex+1,0,makePage(page()?.template||'ruled',page()?.orientation||'portrait'));
    state.pageIndex++;state.selected=-1;syncPageGeometry();resizePage();renderEditor();scheduleSave(true);
    window.WindsPageStack.focus(page().id);toast('New page added');
  }
  function duplicatePage(){finishActiveStroke();if(state.pendingInteractions){setTimeout(duplicatePage,100);return;}const n=notebook();if(!n)return;finishActiveStroke();composeInkNow();commitText();const dupe=clone(page());dupe.id=uid();dupe.items.forEach(it=>it.id=uid());n.pages.splice(state.pageIndex+1,0,dupe);state.pageIndex++;syncPageGeometry();resizePage();renderEditor();scheduleSave(true);toast('Page duplicated');}
  function deletePage(pageId,target={account:workspaceId,notebook:notebook()}){
    const n=notebook();if(!n||n!==target.notebook||workspaceId!==target.account||$('editorView').hidden)return;
    const index=n.pages.findIndex(p=>p.id===pageId);if(index<0)return;
    finishActiveStroke();if(state.pendingInteractions){setTimeout(()=>deletePage(pageId,target),100);return;}
    if(n.pages.length===1){toast('A notebook needs at least one page');return;}
    if(!confirm(`Delete page ${index+1}? This cannot be undone.`))return;
    cancelBoundaryFill(true);finishActiveStroke();composeInkNow();commitText();
    const activeId=page()?.id;n.pages.splice(index,1);
    const activeIndex=n.pages.findIndex(p=>p.id===activeId);
    state.pageIndex=activeIndex>=0?activeIndex:Math.min(index,n.pages.length-1);
    state.selected=-1;syncPageGeometry();resizePage();renderEditor();scheduleSave(true);toast('Page removed');
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
      return `<div class="page-thumb ${i===state.pageIndex?'active':''}" data-page="${i}"><div class="thumb-canvas-wrap" style="height:${Math.round(125*d.height/d.width)}px"><canvas width="250" height="${th}" data-preview="${i}" aria-hidden="true"></canvas></div><div class="thumb-meta">Page ${i+1}<button data-remove-page="${safe(p.id)}" class="thumb-actions" title="Delete page ${i+1}" aria-label="Delete page ${i+1}" ${n.pages.length===1?'disabled':''}>${icon('trash')}</button></div></div>`;
    }).join('');
    document.querySelectorAll('[data-preview]').forEach(el=>{const i=Number(el.dataset.preview),d=pageDimensions(n.pages[i]);const ctx=el.getContext('2d');ctx.setTransform(el.width/d.width,0,0,el.height/d.height,0,0);drawPage(ctx,n.pages[i]);});
  }
  function pageBaseWidth(){const scroller=$('pageScroller');return Math.min(W,Math.max(250,scroller.clientWidth-32));}
  function resizePage(skipRender=false){if($('editorView').hidden)return;if(!skipRender)syncPageGeometry();const width=Math.round(pageBaseWidth()*state.zoom);$('pageShell').style.width=`${width}px`;window.WindsPageStack.resize(state.zoom);$('zoomValue').textContent=`${Math.round(state.zoom*100)}%`;if(!skipRender)renderCanvas();}
  function setZoom(value){
    if(!Number.isFinite(value))return;
    if(!imageCropSession)finishActiveStroke();
    state.zoom=Math.min(8,Math.max(.35,Math.round(value*100)/100));
    adjustInkResolution();resizePage();
  }
  function changeZoom(amount){setZoom(state.zoom+amount);}

  function setOrientation(orientation){
    finishActiveStroke();if(state.pendingInteractions){setTimeout(()=>setOrientation(orientation),100);return;}
    if(!page() || !ORIENTATIONS[orientation] || page().background)return;
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
  function setTool(tool,{inkOnly=false}={}){
    if(boundaryFillSession)cancelBoundaryFill();
    finishActiveStroke();composeInkNow();commitText();state.tool=tool;state.selected=-1;state.draft=null;
    if(tool==='eraser')state.eraserInkOnly=inkOnly;
    if(SHAPE_KINDS.includes(tool))syncShapeTrigger(tool);
    document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    $('inkCanvas').classList.toggle('cursor-eraser',tool==='eraser');
    $('inkCanvas').classList.toggle('cursor-select',tool==='select');
    $('inkCanvas').classList.toggle('cursor-text',tool==='text');
    $('inkCanvas').classList.toggle('cursor-pan',tool==='pan');$('inkCanvas').classList.toggle('cursor-area',tool==='area');
    groupSelection=null;configureSize();
    renderCanvas();if(tool==='eraser')prepareEraserPreview(true);else eraserPreview?.releaseCache();
  }
  /* All figures share one toolbar button (like Fill): the button draws the
   * current shape and its ⌄ opens the shape picker. The last choice is kept. */
  const SHAPE_KINDS=['rectangle','square','ellipse','circle','triangle','diamond','star','line','arrow'];
  const SHAPE_NAMES={rectangle:'Rectangle',square:'Square',ellipse:'Ellipse',circle:'Circle',triangle:'Triangle',diamond:'Diamond',star:'Star',line:'Line',arrow:'Arrow'};
  const SHAPE_PREFERENCE_KEY='winds-notes-shape-v1';
  function syncShapeTrigger(kind){
    const trigger=$('shapeToolBtn');if(!trigger||!SHAPE_KINDS.includes(kind))return;
    if(trigger.dataset.tool!==kind){trigger.dataset.tool=kind;trigger.innerHTML=icon(kind);}
    trigger.setAttribute('aria-label',`Shapes · ${SHAPE_NAMES[kind]}`);trigger.title=`Shapes · ${SHAPE_NAMES[kind]} (R)`;
    document.querySelectorAll('#shapeMenu [data-shape]').forEach(button=>button.setAttribute('aria-checked',String(button.dataset.shape===kind)));
  }
  function chooseShape(kind){
    if(!SHAPE_KINDS.includes(kind))return;
    try{localStorage.setItem(SHAPE_PREFERENCE_KEY,kind);}catch{}
    closeMenus();setTool(kind);
  }
  function restoreShapePreference(){
    let saved=null;try{saved=localStorage.getItem(SHAPE_PREFERENCE_KEY);}catch{}
    syncShapeTrigger(SHAPE_KINDS.includes(saved)?saved:'rectangle');
  }
  let boundaryFillSession=null;
  function cancelBoundaryFill(restore=false){
    const session=boundaryFillSession;boundaryFillSession=null;
    globalThis.WindsBoundaryFill?.setActive(false);globalThis.WindsBoundaryFill?.setSelected?.(false);
    $('activeFillColor')?.setAttribute('hidden','');
    $('fillClosedArea')?.replaceChildren(document.createTextNode('Use Fill tool'));
    $('shapeFillBtn').setAttribute('aria-pressed','false');
    syncColorControls();syncFillControls();
    $('inkCanvas').classList.remove('cursor-fill');$('fillClosedArea')?.setAttribute('aria-pressed','false');
    $('shapeFillBtn').classList.remove('boundary-fill-active');
    if(restore&&session&&state.tool==='pan')setTool(session.previousTool);
  }
  function armBoundaryFill(){
    if(boundaryFillSession){closeMenus();return;}
    if(!page()||!globalThis.WindsBoundaryFill)return;
    const previousTool=state.tool;setTool('pan');closeMenus();
    boundaryFillSession={previousTool,scope:clipboardContext(),version:saveVersion,color:state.shapeFillColor,opacity:state.shapeFillOpacity,pointers:new Set(),tap:null,pending:false};
    globalThis.WindsBoundaryFill.setSelected?.(true);globalThis.WindsBoundaryFill.setActive(false);
    document.querySelectorAll('[data-tool]').forEach(button=>{button.classList.remove('active');button.setAttribute('aria-pressed','false');});
    $('activeFillColor')?.removeAttribute('hidden');$('fillClosedArea').textContent='Continue filling';
    $('shapeFillBtn').setAttribute('aria-pressed','true');syncColorControls();syncFillControls();
    $('inkCanvas').classList.add('cursor-fill');$('fillClosedArea').setAttribute('aria-pressed','true');
    $('shapeFillBtn').classList.add('boundary-fill-active');
    toast('Fill selected · tap closed areas. Use toolbar colors to change color.');
  }
  async function applyBoundaryFill(session,point){
    let surface,output;
    const check=()=>{
      if(boundaryFillSession!==session||!clipboardMatches(session.scope)||saveVersion!==session.version||$('editorView').hidden)throw Error('The page changed. Choose Fill and try again.');
    };
    const pause=async()=>{
      await delay(0);check();
      while(inputBusy()||state.pendingInteractions){await delay(80);check();}
    };
    try{
      await pause();
      const target=page(),dimensions=pageDimensions(target);
      surface=document.createElement('canvas');surface.width=dimensions.width;surface.height=dimensions.height;
      const ctx=surface.getContext('2d',{willReadFrequently:true});
      if(!ctx)throw Error('Not enough canvas memory. Close another notebook tab and try again.');
      // Built-in closed shapes retain their editable vector fill and outline.
      for(let i=target.items.length-1;i>=0;i--){
        if(i%32===0)await pause();
        const item=target.items[i];
        if(item.type!=='shape'||!CREATIVE.isFillableShape(item.kind)||item.erasures?.length)continue;
        const local=CREATIVE.objectPoint(item,point,true);CREATIVE.shapePath(ctx,item);
        if(ctx.isPointInPath(local.x,local.y)){
          if(item.fillColor!==session.color||item.fillOpacity!==session.opacity){remember();item.fillColor=session.color;item.fillOpacity=session.opacity;scheduleSave();renderThumbs();}
          renderCanvas();toast('Closed shape filled · Fill remains selected');return;
        }
      }
      // Notebook ruling and PDF backgrounds are not barriers. Color stays below ink.
      ctx.clearRect(0,0,surface.width,surface.height);
      for(let i=0;i<target.items.length;i++){
        if(i%16===0)await pause();
        const item=target.items[i];if(item.boundaryFill)continue;
        if(item.type==='image'){
          let image=imageCache.get(item.src);
          if(!image){image=new Image();image.src=item.src;imageCache.set(item.src,image);}
          if(!image.complete||!image.naturalWidth)await image.decode();
          await pause();
        }
        drawItem(ctx,item);
      }
      await pause();
      const area=await globalThis.WindsBoundaryFill.region(ctx.getImageData(0,0,surface.width,surface.height).data,surface.width,surface.height,point.x,point.y,pause);
      const rgba=await globalThis.WindsBoundaryFill.colorize(area,session.color,session.opacity,pause);
      output=document.createElement('canvas');output.width=area.w;output.height=area.h;
      const layer=output.getContext('2d',{willReadFrequently:true});
      if(!layer)throw Error('Not enough canvas memory to fill this area.');
      // Recolor a previous fill of this exact region rather than stacking colors.
      let previous=null;
      for(const item of target.items){
        if(!item.boundaryFill||item.rotation||item.crop||item.erasures?.length||item.x!==area.x||item.y!==area.y||item.w!==area.w||item.h!==area.h)continue;
        const image=new Image();image.src=item.src;await image.decode();await pause();
        layer.clearRect(0,0,area.w,area.h);layer.drawImage(image,0,0);
        if(await globalThis.WindsBoundaryFill.sameMask(area,layer.getImageData(0,0,area.w,area.h).data,pause)){previous=item;break;}
      }
      const data=layer.createImageData(area.w,area.h);data.data.set(rgba);layer.putImageData(data,0,0);
      const src=output.toDataURL('image/png'),image=new Image();image.src=src;await image.decode();await pause();
      if(!previous||previous.src!==src){
        remember();
        if(previous){imageCache.delete(previous.src);previous.src=src;}
        else{
          const item={id:uid(),type:'image',boundaryFill:true,x:area.x,y:area.y,w:area.w,h:area.h,src};
          const index=target.items.findIndex(item=>!item.boundaryFill);
          target.items.splice(index<0?target.items.length:index,0,item);
        }
        imageCache.set(src,image);scheduleSave();renderThumbs();
      }
      renderCanvas();toast('Closed area filled · tap another section or change color');
    }catch(error){
      if(boundaryFillSession===session){
        if(saveVersion!==session.version)session.queue=[];
        if(!clipboardMatches(session.scope)||$('editorView').hidden)cancelBoundaryFill(true);
        toast(error.message||'This area could not be filled.');
      }
    }finally{
      if(boundaryFillSession===session){
        session.pending=false;session.version=saveVersion;
        const next=session.queue?.shift();
        if(next)queueBoundaryFill(session,next);else globalThis.WindsBoundaryFill.setActive(false);
      }
      if(surface)surface.width=surface.height=1;
      if(output)output.width=output.height=1;
    }
  }
  function bindBoundaryFill(){
    let button=$('fillClosedArea');
    if(!button){button=document.createElement('button');button.id='fillClosedArea';button.type='button';button.textContent='Use Fill tool';button.setAttribute('aria-pressed','false');$('fillMenu').append(button);}
    button.disabled=!globalThis.WindsBoundaryFill;button.onclick=armBoundaryFill;
    $('shapeFillBtn').removeAttribute('aria-expanded');
    if(!$('fillSettingsBtn')){
      const settings=document.createElement('button');settings.type='button';settings.id='fillSettingsBtn';settings.className='tool-button fill-settings-trigger';settings.textContent='⌄';settings.setAttribute('aria-label','Fill settings and mandala coloring pages');settings.setAttribute('aria-expanded','false');$('shapeFillBtn').after(settings);
    }
    if(!$('activeFillColor')){
      const input=document.createElement('input');input.type='color';input.id='activeFillColor';input.className='active-fill-color';input.hidden=true;input.setAttribute('aria-label','Current fill color');$('fillSettingsBtn').after(input);
    }
    const canvas=$('inkCanvas');
    // Observe taps only. Existing Pencil, touch suppression and pinch handlers
    // retain their events; flood fill runs on a later task after input is idle.
    canvas.addEventListener('pointerdown',event=>{
      const session=boundaryFillSession;if(!session||event.pointerType==='mouse'&&event.button!==0)return;
      if(event.pointerType==='touch'&&session.tap?.pointerType==='pen')return;
      if(event.pointerType==='pen')session.pointers.clear();
      session.pointers.add(event.pointerId);
      if(session.pointers.size===1)session.tap={id:event.pointerId,pointerType:event.pointerType,x:event.clientX,y:event.clientY,valid:true};
      else if(session.tap)session.tap.valid=false;
    },{capture:true,passive:true});
    canvas.addEventListener('pointermove',event=>{
      const tap=boundaryFillSession?.tap;
      if(tap?.id===event.pointerId&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>6)tap.valid=false;
    },{capture:true,passive:true});
    canvas.addEventListener('pointerup',event=>{
      const session=boundaryFillSession;if(!session)return;session.pointers.delete(event.pointerId);
      const tap=session.tap;
      if(!tap?.valid||tap.id!==event.pointerId||session.pointers.size||Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>6)return;
      const rect=canvas.getBoundingClientRect(),point={x:(event.clientX-rect.left)/rect.width*W,y:(event.clientY-rect.top)/rect.height*H};
      session.tap=null;
      queueBoundaryFill(session,{point,scope:clipboardContext(),color:state.shapeFillColor,opacity:state.shapeFillOpacity});
    },{capture:true,passive:true});
    canvas.addEventListener('pointercancel',event=>{const session=boundaryFillSession;if(session){session.pointers.delete(event.pointerId);if(session.tap?.id===event.pointerId)session.tap.valid=false;}},{capture:true,passive:true});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&boundaryFillSession)cancelBoundaryFill(true);});
  }
  function queueBoundaryFill(session,request){
    if(boundaryFillSession!==session)return;
    if(session.pending){
      session.queue=session.queue||[];
      if(session.queue.length<32)session.queue.push(request);
      return;
    }
    session.scope=request.scope;session.version=saveVersion;session.color=request.color;session.opacity=request.opacity;session.pending=true;
    globalThis.WindsBoundaryFill.setActive(true);
    setTimeout(()=>applyBoundaryFill(session,request.point),0);
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
    $('shapeFillBtn').classList.toggle('has-fill',state.shapeFillEnabled||Boolean(boundaryFillSession));
    $('shapeFillBtn').style.setProperty('--active-fill',state.shapeFillEnabled||boundaryFillSession?state.shapeFillColor:'transparent');
    if($('activeFillColor'))$('activeFillColor').value=state.shapeFillColor;
    if(boundaryFillSession)syncColorControls();
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
    toggleMenu('fillSettingsBtn','fillMenu');
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
  function syncColorControls(){
    const filling=Boolean(boundaryFillSession),c=filling?state.shapeFillColor:state.color;
    document.querySelectorAll('[data-color],[data-more-color]').forEach(button=>{
      const color=button.dataset.color||button.dataset.moreColor;
      const selected=color?.toLowerCase()===c.toLowerCase();
      button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
      button.setAttribute('aria-label',`Use ${filling?'fill':'ink'} color ${color}`);
    });
    $('colorPalette').setAttribute('aria-label',filling?'Fill colors':'Ink colors');
    $('drawingSizeControl').hidden=filling||state.tool==='eraser';
    $('sizePreview').style.background=c;$('customColorInput').value=c;
    $('customColorBtn').style.setProperty('--chosen-color',c);
    $('customColorBtn').setAttribute('aria-label',filling?'More fill colors':'More ink colors');
  }
  function setColor(c){
    if(!/^#[0-9a-f]{6}$/i.test(c))return;
    if(boundaryFillSession){setFillOptions({color:c});return;}
    state.color=c;CREATIVE.prepareArtistColor(c);syncColorControls();
  }
  function ensureStickerCollections(){
    const menu=$('emojiMenu');
    let collections=$('stickerCollections');
    if(!collections){
      collections=document.createElement('div');collections.id='stickerCollections';
      menu.insertBefore(collections,$('emojiSearch'));
    }
    if(!collections.children.length){
      collections.className='sticker-collections';collections.setAttribute('role','group');
      collections.setAttribute('aria-label','Sticker collections');
      for(const [id,label,count] of [['all','All',ALL_STICKERS.length],['everyday','Everyday',EMOJI_STICKERS.length],['education','Education',EDUCATION_STICKERS.length]]){
        const button=document.createElement('button');button.type='button';button.dataset.stickerCollection=id;
        button.append(document.createTextNode(label+' '));
        const badge=document.createElement('span');badge.textContent=count;button.append(badge);collections.append(button);
      }
    }
    if(!$('stickerCount')){
      const count=document.createElement('p');count.id='stickerCount';count.className='sticker-count';
      count.setAttribute('role','status');menu.insertBefore(count,$('emojiGrid'));
    }
  }
  function renderEmojiGrid(query){
    ensureStickerCollections();
    const q=String(query||'').trim().toLowerCase();
    const source=stickerCollection==='education'?EDUCATION_STICKERS:stickerCollection==='everyday'?EMOJI_STICKERS:ALL_STICKERS;
    const chosen=source.filter(([emoji,name,keywords=''])=>`${name} ${keywords}`.toLowerCase().includes(q)||emoji.includes(q));
    $('stickerCollections').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stickerCollection===stickerCollection)));
    $('stickerCount').textContent=`${chosen.length} sticker${chosen.length===1?'':'s'}${stickerCollection==='education'?' · Education collection':''}`;
    $('emojiGrid').innerHTML=chosen.map(([emoji,name])=>`<button type="button" class="emoji-cell" data-emoji="${safe(emoji)}" title="${safe(name)}" aria-label="Insert ${safe(name)}">${emoji}</button>`).join('')||'<p class="emoji-empty">No stickers found. Try another search or collection.</p>';
    $('emojiGrid').scrollTop=0;
  }
  function addEmoji(emoji){
    if(!page() || !ALL_STICKERS.some(e=>e[0]===emoji))return;
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
  function configureSize(){
    const eraser=state.tool==='eraser',input=$('penSize');input.min=eraser?'4':'1';input.max=eraser?'128':'32';input.step=eraser?'1':'0.5';input.value=eraser?state.eraserSize:state.size;input.setAttribute('aria-label',eraser?'Eraser toolbar size':'Drawing width');$('drawingSizeControl').hidden=eraser;$('drawingSizeControl').title='Drawing width';paintSize();syncEraserControls();
  }
  function paintSize(){const value=state.tool==='eraser'?state.eraserSize:state.size;$('sizeLabel').textContent=String(value);const diameter=Math.max(4,Math.min(value,19));$('sizePreview').style.width=diameter+'px';$('sizePreview').style.height=diameter+'px';}
  function updateSize(){if(state.tool==='eraser'){setEraserSize($('penSize').value);return;}else state.size=Number($('penSize').value);paintSize();if(!$('artistMenu').hidden)renderArtistPreviews();}
  function setEraserSize(value){
    const size=Number(value);if(!Number.isFinite(size)||String(value).trim()==='')return;
    state.eraserSize=Math.max(4,Math.min(128,Math.round(size)));
    if(state.tool==='eraser'){$('penSize').value=state.eraserSize;paintSize();}
    syncEraserControls();persistEraserPreferences();
  }
  function persistEraserPreferences(){try{localStorage.setItem('winds-notes-eraser-preferences-v1',JSON.stringify({size:state.eraserSize,inkOnly:state.eraserInkOnly}));}catch{}}
  function restoreInputPreferences(){
    try{const value=JSON.parse(localStorage.getItem('winds-notes-input-preferences-v1'));if(typeof value?.stylusOnly==='boolean'){state.penOnly=value.stylusOnly;state.stylusPreferenceChanged=true;}}catch{}
    $('pencilOnly').checked=state.penOnly;
  }
  function persistInputPreferences(){try{localStorage.setItem('winds-notes-input-preferences-v1',JSON.stringify({stylusOnly:state.penOnly}));}catch{}}
  function restoreEraserPreferences(){try{const value=JSON.parse(localStorage.getItem('winds-notes-eraser-preferences-v1'));if(value&&typeof value.size==='number'&&Number.isFinite(value.size))state.eraserSize=Math.max(4,Math.min(128,Math.round(value.size)));if(typeof value?.inkOnly==='boolean')state.eraserInkOnly=value.inkOnly;}catch{}}
  function syncEraserControls(){
    for(const id of ['eraserSize','eraserSizeNumber'])$(id).value=String(state.eraserSize);
    $('eraserSizeLabel').textContent=String(state.eraserSize);$('eraserBtn').dataset.size=String(state.eraserSize);
    $('eraserMode').value=state.eraserInkOnly?'ink':'all';
    $('eraserHelp').textContent=state.eraserInkOnly?'Erases only the brushed area of handwriting. Tap Eraser or choose All objects to include pasted text and images.':'Erases only the brushed area, including pasted text and images. PDF backgrounds stay fixed.';
    document.querySelectorAll('[data-eraser-size]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.eraserSize)===state.eraserSize)));
  }
  function historyForPage(){const key=page()?.id;if(!key)return null;if(!history.has(key))history.set(key,{undo:[],redo:[]});return history.get(key);}
  function recordHistory(action){
    const h=historyForPage();if(!h)return;
    h.undo.push(action);if(h.undo.length>70)h.undo.shift();h.redo=[];updateHistoryButtons();
  }
  function remember(){recordHistory({kind:'snapshot',items:clone(page().items)});}
  function rememberAppend(item){recordHistory({kind:'append',item:clone(item)});window.WindsLive?.append(notebook()?.id,page()?.id,item);}
  function undo(){
    if(state.pendingInteractions){setTimeout(undo,100);return;}
    if(imageCropSession||state.drag?.kind==='rotate')finishActiveStroke();
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
    if(state.pendingInteractions){setTimeout(redo,100);return;}
    if(imageCropSession||state.drag?.kind==='rotate')finishActiveStroke();
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
    const temp=document.createElement('canvas').getContext('2d');return window.WindsText.layout(temp,item);
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
    item=eraserPreview?.effective(item)||item;
    if(item.erasures?.length){CREATIVE.drawErasedItem(ctx,item,itemBounds(item),clipboardBounds(item),drawSourceItem);return;}
    drawSourceItem(ctx,item);
  }
  function drawSourceItem(ctx,item){
    ctx.save();
    CREATIVE.rotateContext(ctx,item);
    if(item.type==='stroke'){drawStroke(ctx,item);}
    else if(item.type==='text'){
      window.WindsText.draw(ctx,item);
    }else if(item.type==='shape'){
      CREATIVE.drawShape(ctx,item);
    }else if(item.type==='sticker'){
      if(CREATIVE.drawSticker)CREATIVE.drawSticker(ctx,item);
      else{
        ctx.textBaseline='top';ctx.textAlign='left';
        ctx.font=`${item.size||78}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
        ctx.fillText(item.emoji,item.x,item.y);
      }
    }else if(item.type==='image'){
      if(!imageCache.has(item.src)){
        const img=new Image(),account=workspaceId;imageCache.set(item.src,img);img.onload=()=>{if(!document.hidden&&account===workspaceId)renderCloudChanges(account);};img.src=item.src;
      }
      const img=imageCache.get(item.src);if(img?.complete&&img.naturalWidth)CREATIVE.drawImage(ctx,item,img);
    }
    ctx.restore();
  }
  function pdfImage(src,thumbnail=false){
    if(pdfBackgroundCache.has(src))return pdfBackgroundCache.get(src);
    const img=new Image(),account=workspaceId,entry={img,thumbnail,ready:false,promise:null};
    entry.promise=new Promise((resolve,reject)=>{
      img.onload=()=>{
        entry.ready=true;resolve(img);
        if(account!==workspaceId)return;
        const current=page(),active=current?.background&&(current.background.src===src||current.background.thumbnail===src);
        if(active&&!current.items.length&&!state.drag&&!state.pinch&&!state.editingText&&!state.pendingInteractions&&!imageCropSession&&!globalThis.WindsText?.isOpen()&&!bufferedPenInk){
          requestAnimationFrame(()=>{
            if(account===workspaceId&&page()===current&&!current.items.length&&!state.drag&&!state.pinch&&!state.editingText&&!state.pendingInteractions&&!imageCropSession&&!globalThis.WindsText?.isOpen()&&!bufferedPenInk)renderCanvas();
            else if(account===workspaceId){clearTimeout(pdfRepaintTimer);pdfRepaintTimer=setTimeout(()=>renderCloudChanges(account),60);}
          });
        }else if(active||state.sidebarOpen){clearTimeout(pdfRepaintTimer);pdfRepaintTimer=setTimeout(()=>renderCloudChanges(account),60);}
      };
      img.onerror=()=>reject(Error('Could not decode a PDF page background.'));
    });
    entry.promise.catch(()=>{});pdfBackgroundCache.set(src,entry);img.src=src;
    const active=page()?.background?.src;
    const full=[...pdfBackgroundCache].filter(([key,value])=>!value.thumbnail&&key!==active&&key!==src);
    while(full.length>1)pdfBackgroundCache.delete(full.shift()[0]);
    return entry;
  }
  function prunePdfImages(book){
    const used=new Set(book.pages.flatMap(p=>p.background?[p.background.src,p.background.thumbnail]:[]));
    for(const key of pdfBackgroundCache.keys())if(!used.has(key))pdfBackgroundCache.delete(key);
  }
  function drawPdfBackground(ctx,p){
    const background=p.background;if(!background)return;
    const small=ctx.canvas.width<=300,entry=pdfImage(small?background.thumbnail:background.src,small);
    const fallback=small?null:pdfImage(background.thumbnail,true),image=entry.ready?entry.img:fallback?.ready?fallback.img:null;
    if(image){const b=CREATIVE.pageBackgroundRect(background,pageDimensions(p));ctx.save();ctx.globalAlpha=1;ctx.drawImage(image,b.x,b.y,b.w,b.h);ctx.restore();}
  }
  async function preparePdfExport(p,account){
    const busy=()=>Boolean(state.drag||state.pinch||state.editingText||state.pendingInteractions||imageCropSession||globalThis.WindsText?.isOpen()||globalThis.WindsPDFImport?.isOpen()||Date.now()-lastInkAt<SAVE_IDLE_MS);
    while(true){
      if(account!==workspaceId)throw Error('The account changed during export.');
      if(busy()){await delay(100);continue;}
      if(p?.background)await pdfImage(p.background.src).promise;
      if(account!==workspaceId)throw Error('The account changed during export.');
      if(!busy())return;
    }
  }
  function drawPage(ctx,p,withoutSelection=true,skipItem=null){
    if(!p)return;drawTemplate(ctx,p.background?'blank':p.template||'ruled',pageDimensions(p));drawPdfBackground(ctx,p);
    for(const item of p.items)if(item!==skipItem)drawItem(ctx,item);
    if(!withoutSelection){
      if(state.draft)drawItem(ctx,state.draft);
      if(state.selected>=0 && p.items[state.selected]){
        const item=p.items[state.selected],b=selectionBounds(item);ctx.save();CREATIVE.rotateContext(ctx,item);ctx.strokeStyle='#6557ed';ctx.lineWidth=1.7;ctx.setLineDash([8,6]);ctx.strokeRect(b.x-8,b.y-8,b.w+16,b.h+16);ctx.restore();
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
    drawSelection(inkContext());
  }
  function clearInk(){
    state.eraseCursorBounds=null;
    if(inkRAF){cancelAnimationFrame(inkRAF);inkRAF=0;}
    const ctx=inkContext();ctx.clearRect(0,0,W,H);drawnIndex=0;
  }
  function drawSelection(ctx){
    if(drawInteractionOverlay(ctx))return;
    const transform=state.selectionTransform;
    const it=state.drag?.kind==='rotate'?state.drag.preview:selectedDisplayItem();
    if(!it||imageCropSession)return;
    const b=selectionBounds(it);ctx.save();
    if(transform?.kind==='select'&&it===transform.original&&it.type==='stroke')ctx.translate(transform.dx,transform.dy);
    CREATIVE.rotateContext(ctx,it);ctx.strokeStyle='#6557ed';ctx.lineWidth=Math.max(1,handleSize()*.18);
    const pad=resizable(it)?0:handleSize()*.65;
    if(pad)ctx.setLineDash([Math.max(4,pad),Math.max(3,pad*.75)]);
    ctx.strokeRect(b.x-pad,b.y-pad,b.w+pad*2,b.h+pad*2);ctx.setLineDash([]);
    if(resizable(it)){
      const r=handleSize();ctx.fillStyle='#ffffff';ctx.strokeStyle='#6155d9';ctx.lineWidth=Math.max(.8,r*.2);
      for(const [corner,[x,y]] of Object.entries(cornerPositions(b))){
        ctx.fillStyle=state.drag?.kind==='resize'&&state.drag.corner===corner?'#54da8d':'#fff';
        ctx.beginPath();ctx.roundRect(x-r,y-r,2*r,2*r,r*.28);ctx.fill();ctx.stroke();
      }
    }
    ctx.restore();
  }
  function paintPendingInk(finalize=false){
    inkRAF=0;
    const ctx=inkContext(),item=state.draft;
    if(item)eraserPreview?.stopPainting();
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
    eraserPreview?.beforeRender(state.drag?.kind==='erase'?state.drag:null);
    const p=page();if(!p)return;
    syncPageGeometry();
    clearTimeout(inkComposeTimer);inkComposeTimer=0;bufferedPenInk=false;bufferedPenItems=[];
    const canvas=$('pageCanvas'),ctx=canvas.getContext('2d',{alpha:false});
    ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
    drawPage(ctx,p,true,imageCropSession?.item);clearInk();
    if(state.draft)queueInk();else drawSelection(inkContext());
    updateSelectionActions();
    paintLiveLayer();window.WindsLive?.render();queueEraserPreparation();
  }
  function commitInkToPage(item){
    const ctx=$('pageCanvas').getContext('2d');
    ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);drawItem(ctx,item);clearInk();
    drawSelection(inkContext());
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
  function selectionBounds(item){
    return (item.type==='sticker'&&CREATIVE.stickerSelectionBounds?.(item))||itemBounds(item);
  }
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
    const positions=cornerPositions(selectionBounds(item));
    const tolerance=handleSize()*2.6;
    for(const [corner,[x,y]] of Object.entries(positions)){
      if(Math.hypot(p.x-x,p.y-y)<tolerance)return corner;
    }
    return null;
  }
  function selectedDisplayItem(){
    const item=page()?.items[state.selected],gesture=state.selectionTransform;
    return item&&gesture?.original===item?gesture.preview:item;
  }
  function updateSelectionActions(){
    const item=selectedDisplayItem(),group=activeGroup();
    const show=Boolean(!imageCropSession&&item&&['select','area'].includes(state.tool));
    const precision=show&&!group&&resizable(item);
    $('selectionActions').hidden=!show;
    $('clearAreaSelection').hidden=!show||!group;
    $('removeSelected').hidden=!show;
    $('selectionPrecision').hidden=!precision;
    $('rotationControls').hidden=!precision||!CREATIVE.rotatable(item);
    positionRotationHandle(show&&!group&&state.tool==='select'?item:null);
    if(!precision)return;
    $('selectedWidth').value=String(Math.round(itemBounds(item).w));
    $('selectedRotation').value=String(Math.round(CREATIVE.objectRotation(item)*10)/10);
  }
  function positionObjectOverlay(element,bounds,angle){
    Object.assign(element.style,{left:`${bounds.x/W*100}%`,top:`${bounds.y/H*100}%`,
      width:`${bounds.w/W*100}%`,height:`${bounds.h/H*100}%`,transform:`rotate(${angle}deg)`});
  }
  function positionRotationHandle(item){
    const frame=$('objectRotationFrame');
    if(!frame)return;
    frame.hidden=!CREATIVE.rotatable(item);
    if(frame.hidden)return;
    const angle=CREATIVE.objectRotation(item);
    const bounds=selectionBounds(item);
    const center=CREATIVE.objectPoint(item,{x:bounds.x+bounds.w/2,y:bounds.y+bounds.h/2});
    positionObjectOverlay(frame,{...bounds,x:center.x-bounds.w/2,y:center.y-bounds.h/2},angle);
    frame.style.setProperty('--object-action-angle',`${-angle}deg`);
    const cropHandle=$('objectCropHandle');
    if(cropHandle)cropHandle.hidden=item.type!=='image'||!$('imageCropOverlay');
  }
  function rotateSelectedTo(angle){
    const item=page()?.items[state.selected];
    if(!CREATIVE.rotatable(item)||state.drag||imageCropSession)return;
    if(!Number.isFinite(angle)){updateSelectionActions();return;}
    const rotation=CREATIVE.objectRotation({type:item.type,rotation:angle});
    if(Math.abs(rotation-CREATIVE.objectRotation(item))<1e-8){updateSelectionActions();return;}
    remember();if(rotation)item.rotation=rotation;else delete item.rotation;
    renderCanvas();renderThumbs();scheduleSave();
  }
  function beginObjectRotation(ev){
    const item=page()?.items[state.selected];
    if(ev.button!==0||state.tool!=='select'||!CREATIVE.rotatable(item)||state.drag||state.pinch||state.pendingInteractions||imageCropSession)return;
    const handle=ev.currentTarget,rect=$('inkCanvas').getBoundingClientRect();
    try{handle.setPointerCapture(ev.pointerId);}catch{return;}
    ev.preventDefault();
    state.drag={kind:'rotate',pointerId:ev.pointerId,pointerType:ev.pointerType,rect,handle,item,
      preview:item,start:point(ev,rect),angle:CREATIVE.objectRotation(item),page:page(),frame:0};
  }
  function moveObjectRotation(ev){
    const drag=state.drag;
    if(drag?.kind!=='rotate'||drag.pointerId!==ev.pointerId||drag.finished)return;
    ev.preventDefault();
    drag.angle=CREATIVE.rotationFromDrag(drag.item,drag.start,point(ev,drag.rect),ev.shiftKey);
    queueObjectRotation(drag);
  }
  function endObjectRotation(ev){
    const drag=state.drag;
    if(drag?.kind!=='rotate'||drag.pointerId!==ev.pointerId||drag.finished)return;
    if(ev.type==='pointerup')moveObjectRotation(ev);
    drag.finished=ev.type==='pointerup'?'apply':'cancel';
    queueObjectRotation(drag);
  }
  function queueObjectRotation(drag){
    if(drag.frame)return;
    drag.frame=requestAnimationFrame(()=>{
      drag.frame=0;
      if(state.drag!==drag)return;
      if(drag.finished){finishObjectRotation(drag.finished==='apply');return;}
      if(CREATIVE.objectRotation(drag.preview)!==drag.angle)paintObjectRotation(drag);
    });
  }
  function finishObjectRotation(apply=false){
    const drag=state.drag;
    if(drag?.kind!=='rotate')return;
    state.drag=null;
    if(drag.frame)cancelAnimationFrame(drag.frame);
    if(drag.handle.hasPointerCapture(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);
    if(page()!==drag.page)return;
    if(apply&&page().items[state.selected]===drag.item&&Math.abs(drag.angle-CREATIVE.objectRotation(drag.item))>1e-8){
      rotateSelectedTo(drag.angle);
    }else if(drag.preview!==drag.item)renderCanvas();
  }
  function rotationPaintBounds(item){
    const bounds=clipboardBounds(item);
    const pad=item.type==='shape'?Math.max(4,(item.size||1)/2+2)+(item.kind==='arrow'?25:0):4;
    return {x:bounds.x-pad,y:bounds.y-pad,w:bounds.w+2*pad,h:bounds.h+2*pad};
  }
  function paintObjectRotation(drag){
    const preview={...drag.item,rotation:drag.angle};
    const region=interactions.union([rotationPaintBounds(drag.preview),rotationPaintBounds(preview)]);
    if(!drag.layers)drag.layers=drag.page.items.map(item=>({item,bounds:rotationPaintBounds(item)}));
    const ctx=$('pageCanvas').getContext('2d');
    ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
    // Redraw only the swept rectangle. Paint neighbors in page order so a
    // rotating object keeps the same stacking and eraser masks as on release.
    ctx.save();
    try{
      ctx.beginPath();ctx.rect(region.x,region.y,region.w,region.h);ctx.clip();
      drawTemplate(ctx,drag.page.background?'blank':drag.page.template||'ruled',pageDimensions(drag.page));
      drawPdfBackground(ctx,drag.page);
      for(const layer of drag.layers){
        if(layer.item===drag.item)drawItem(ctx,preview);
        else if(interactions.intersects(region,layer.bounds))drawItem(ctx,layer.item);
      }
    }finally{ctx.restore();}
    drag.preview=preview;
    clearInk();drawSelection(inkContext());positionRotationHandle(preview);
    $('selectedRotation').value=String(Math.round(drag.angle*10)/10);
  }
  function updateImageCropPreview(){
    if(!imageCropSession)return;
    const crop=imageCropSession.crop;
    const bounds={left:`${crop.x*100}%`,top:`${crop.y*100}%`,width:`${crop.w*100}%`,height:`${crop.h*100}%`};
    for(const id of ['imageCropBox','imageCropShadeBox'])Object.assign($(id).style,bounds);
    for(const [id,key] of [['cropLeft','x'],['cropTop','y'],['cropWidth','w'],['cropHeight','h']]){
      $(id).value=String(Math.round(crop[key]*1000)/10);
    }
  }
  function paintImageCropSource(full){
    const canvas=$('imageCropSource');
    const scale=Math.min(2,2048/Math.max(full.w,full.h));
    canvas.width=Math.max(1,Math.round(full.w*scale));
    canvas.height=Math.max(1,Math.round(full.h*scale));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('The crop preview could not be drawn.');
    ctx.setTransform(canvas.width/full.w,0,0,canvas.height/full.h,0,0);
    drawItem(ctx,{...full,x:0,y:0,rotation:0});
  }
  async function openImageCrop(){
    const item=page()?.items[state.selected];
    if(item?.type!=='image'||state.drag||state.pinch||state.pendingInteractions||imageCropSession)return;
    commitText();composeInkNow();closeMenus();
    const scope=clipboardContext();
    try{
      let img=imageCache.get(item.src);
      if(!img){img=new Image();img.src=item.src;imageCache.set(item.src,img);}
      if(!img.complete||!img.naturalWidth)await img.decode();
      if(!clipboardMatches(scope)||page()?.items[state.selected]!==item||state.drag||state.pinch||imageCropSession)return;
      const full=CREATIVE.cropImage(item,CREATIVE.imageCrop(),Infinity);
      paintImageCropSource(full);
      imageCropSession={scope,item,full,crop:CREATIVE.imageCrop(item.crop),drag:null,frame:0};
      positionObjectOverlay($('imageCropPreview'),full,CREATIVE.objectRotation(full));
      $('imageCropOverlay').hidden=$('imageCropControls').hidden=false;
      updateImageCropPreview();renderCanvas();
      $('applyImageCrop').focus({preventScroll:true});
    }catch(err){
      if(imageCropSession?.item===item)closeImageCrop();
      console.error(err);toast('Could not open this image for cropping');
    }
  }
  function closeImageCrop(){
    const session=imageCropSession;
    if(!session)return;
    imageCropSession=null;
    if(session.frame)cancelAnimationFrame(session.frame);
    const preview=$('imageCropPreview'),pointerId=session.drag?.pointerId;
    if(pointerId!==undefined&&preview.hasPointerCapture(pointerId))preview.releasePointerCapture(pointerId);
    $('imageCropOverlay').hidden=$('imageCropControls').hidden=true;
    const canvas=$('imageCropSource');canvas.width=canvas.height=1;
    renderCanvas();
    if(!$('objectRotationFrame').hidden&&!$('objectCropHandle').hidden)$('objectCropHandle').focus({preventScroll:true});
  }
  function applyImageCrop(){
    const session=imageCropSession;
    if(!session||session.drag)return;
    const item=session.item;
    if(!clipboardMatches(session.scope)||!page().items.includes(item)){closeImageCrop();return;}
    const old=CREATIVE.imageCrop(item.crop),next=CREATIVE.imageCrop(session.crop);
    const changed=['x','y','w','h'].some(key=>Math.abs(old[key]-next[key])>1e-8);
    if(changed){
      remember();Object.assign(item,CREATIVE.cropImage(item,next));
      if(next.x===0&&next.y===0&&next.w===1&&next.h===1)delete item.crop;
    }
    closeImageCrop();
    if(changed){renderThumbs();scheduleSave();toast('Image cropped · Undo to restore');}
  }
  function imageCropPoint(ev,full,rect){
    const local=CREATIVE.objectPoint(full,point(ev,rect),true);
    return {x:(local.x-full.x)/full.w,y:(local.y-full.y)/full.h};
  }
  function beginImageCropDrag(ev){
    const session=imageCropSession;
    if(!session||session.drag||ev.button!==0)return;
    const corner=ev.target.closest('[data-crop-corner]')?.dataset.cropCorner;
    if(!corner&&!ev.target.closest('#imageCropBox'))return;
    const rect=$('inkCanvas').getBoundingClientRect();
    try{ev.currentTarget.setPointerCapture(ev.pointerId);}catch{return;}
    ev.preventDefault();
    session.drag={pointerId:ev.pointerId,rect,start:imageCropPoint(ev,session.full,rect),corner:corner||'move',crop:session.crop};
  }
  function queueImageCropPreview(session){
    if(session.frame)return;
    session.frame=requestAnimationFrame(()=>{session.frame=0;if(imageCropSession===session)updateImageCropPreview();});
  }
  function moveImageCropDrag(ev){
    const session=imageCropSession,drag=session?.drag;
    if(!drag||ev.pointerId!==drag.pointerId)return;
    ev.preventDefault();
    const p=imageCropPoint(ev,session.full,drag.rect);
    session.crop=CREATIVE.dragImageCrop(drag.crop,drag.corner,p.x-drag.start.x,p.y-drag.start.y);
    queueImageCropPreview(session);
  }
  function endImageCropDrag(ev){
    const session=imageCropSession,drag=session?.drag;
    if(!drag||drag.pointerId!==ev.pointerId)return;
    if(ev.type==='pointerup')moveImageCropDrag(ev);
    else{session.crop=drag.crop;queueImageCropPreview(session);}
    session.drag=null;
  }
  function mountObjectTransformHandles(){
    const shell=$('pageShell'),scroller=$('pageScroller');
    if(!shell||!scroller)return;
    // Mount from the editor script so cached pages can use the same handles.
    if(!$('objectRotationFrame'))shell.insertAdjacentHTML('beforeend',`
      <div class="object-rotation-frame" id="objectRotationFrame" hidden>
        <button type="button" id="objectRotationHandle" aria-label="Rotate selected object" title="Drag to rotate. Hold Shift to snap to 15°.">
          <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M20 11a8 8 0 1 0-1.5 5.7M20 5v6h-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    `);
    if(!$('objectCropHandle'))$('objectRotationFrame').insertAdjacentHTML('beforeend',`
      <button type="button" id="objectCropHandle" aria-label="Crop image on the page" title="Crop image" hidden>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 3v14a1 1 0 0 0 1 1h14M3 6h14a1 1 0 0 1 1 1v14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>`);
    if($('imageCropOverlay'))return;
    // The previous modal used the same input IDs as the crop controls.
    $('imageCropBackdrop')?.remove();
    scroller.insertAdjacentHTML('beforebegin',`
      <section class="image-crop-controls" id="imageCropControls" aria-label="Crop image" hidden>
        <div class="crop-command-row"><div><strong>Crop image</strong><p>Drag an edge or corner on the page.</p></div><button type="button" id="resetImageCrop">Reset</button><button type="button" id="cancelImageCrop">Cancel</button><button type="button" id="applyImageCrop">Apply crop</button></div>
        <details><summary>Exact crop</summary><div class="image-crop-fields">
          <label>Left <input id="cropLeft" aria-label="Crop left percentage" type="number" min="0" max="99" step="0.1"/> %</label>
          <label>Top <input id="cropTop" aria-label="Crop top percentage" type="number" min="0" max="99" step="0.1"/> %</label>
          <label>Width <input id="cropWidth" aria-label="Crop width percentage" type="number" min="1" max="100" step="0.1"/> %</label>
          <label>Height <input id="cropHeight" aria-label="Crop height percentage" type="number" min="1" max="100" step="0.1"/> %</label>
        </div></details>
      </section>
    `);
    shell.insertAdjacentHTML('beforeend',`
      <div class="image-crop-overlay" id="imageCropOverlay" hidden>
        <div class="image-crop-preview" id="imageCropPreview">
          <canvas id="imageCropSource" width="1" height="1" aria-hidden="true"></canvas>
          <div class="image-crop-shade" aria-hidden="true"><div id="imageCropShadeBox"></div></div>
          <div class="image-crop-box" id="imageCropBox" aria-hidden="true">
            <span data-crop-corner="nw"></span><span data-crop-corner="ne"></span><span data-crop-corner="sw"></span><span data-crop-corner="se"></span>
            <span data-crop-corner="n"></span><span data-crop-corner="s"></span><span data-crop-corner="w"></span><span data-crop-corner="e"></span>
          </div>
        </div>
      </div>
    `);
  }
  function bindObjectTransformHandles(){
    const rotationHandle=$('objectRotationHandle');
    if(rotationHandle){
      rotationHandle.addEventListener('pointerdown',beginObjectRotation);
      rotationHandle.addEventListener('pointermove',moveObjectRotation);
      for(const event of ['pointerup','pointercancel','lostpointercapture']){
        rotationHandle.addEventListener(event,endObjectRotation);
      }
      rotationHandle.onclick=event=>{
        if(event.detail===0){
          const angle=CREATIVE.objectRotation(page()?.items[state.selected]);
          rotateSelectedTo(angle+(event.shiftKey?-15:15));
        }
      };
    }
    if(!$('imageCropOverlay'))return;

    const cropHandle=$('objectCropHandle');
    if(cropHandle)cropHandle.onclick=openImageCrop;
    $('cancelImageCrop').onclick=closeImageCrop;
    $('applyImageCrop').onclick=applyImageCrop;
    $('resetImageCrop').onclick=()=>{
      if(!imageCropSession)return;
      imageCropSession.crop=CREATIVE.imageCrop();
      updateImageCropPreview();
    };
    for(const [id,key] of [['cropLeft','x'],['cropTop','y'],['cropWidth','w'],['cropHeight','h']]){
      $(id).onchange=event=>{
        if(!imageCropSession)return;
        const value=event.target.valueAsNumber;
        if(Number.isFinite(value))imageCropSession.crop=CREATIVE.imageCrop({...imageCropSession.crop,[key]:value/100});
        updateImageCropPreview();
      };
    }
    const cropPreview=$('imageCropPreview');
    cropPreview.addEventListener('pointerdown',beginImageCropDrag);
    cropPreview.addEventListener('pointermove',moveImageCropDrag);
    for(const event of ['pointerup','pointercancel','lostpointercapture']){
      cropPreview.addEventListener(event,endImageCropDrag);
    }
  }
  function resizeObject(item,newWidth,newHeight,corner='se',bounds=itemBounds(item)){
    if(item.type==='sticker'&&CREATIVE.resizeSticker){
      Object.assign(item,CREATIVE.resizeSticker(item,newWidth,corner));
      return;
    }
    const original={type:item.type,x:item.x,y:item.y,w:item.w,h:item.h,size:item.size,rotation:item.rotation};
    // Preserve aspect ratio for imported photos and emoji stickers.
    const ratio=Math.max(.01,bounds.w/Math.max(1,bounds.h));
    let width=Math.max(16,Math.min(2200,newWidth));
    let height=Math.max(16,Math.min(2200,newHeight));
    if(item.type==='image'){height=Math.max(16,Math.min(2200,width/ratio));}
    if(item.type==='sticker'){width=height=Math.min(1600,width);}
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
  function resizeDragPreview(drag,p){
    const original=drag.original;if(!resizable(original))return;
    p=CREATIVE.objectPoint(original,p,true);
    const b=drag.bounds,corner=drag.corner;
    const anchorX=corner.includes('w')?b.x+b.w:b.x;
    const anchorY=corner.includes('n')?b.y+b.h:b.y;
    const minSide=original.type==='sticker'?16*b.w/(original.size||78):16;
    let width=Math.max(minSide,Math.abs(p.x-anchorX));
    let height=Math.max(minSide,Math.abs(p.y-anchorY));
    if(original.type==='image'||original.type==='sticker'){
      const ratio=original.type==='sticker'?1:b.w/Math.max(1,b.h);
      if(width/ratio>height)height=width/ratio;else width=height*ratio;
    }
    const item={...original};
    // Opposite corner remains fixed, even while dragging outward.
    const newWidth=original.type==='sticker'?width*(original.size||78)/b.w:width;
    resizeObject(item,newWidth,height,corner,b);
    return item;
  }
  const distToSegment=(px,py,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay;const t=dx*dx+dy*dy?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy))):0;return Math.hypot(px-ax-dx*t,py-ay-dy*t);};
  function nearItem(item,x,y,forEraser=false,tolerance=forEraser?14:9){
    if(!forEraser&&CREATIVE.erasedAt(item,itemBounds(item),{x,y}))return false;
    const local=CREATIVE.objectPoint(item,{x,y},true);x=local.x;y=local.y;
    const b=selectionBounds(item),padding=item.type==='shape'?(item.kind==='arrow'?25:Math.max(0,(item.size||3)/2)):0;
    if(x<b.x-tolerance-padding||x>b.x+b.w+tolerance+padding||y<b.y-tolerance-padding||y>b.y+b.h+tolerance+padding)return false;
    if(!forEraser&&item.type==='shape')return CREATIVE.shapeHit(item,{x,y},tolerance);
    if(item.type!=='stroke')return true;
    const pts=item.points||[];const reach=item.tool==='artist'?CREATIVE.artistBoundsPadding(item):item.size*(item.tool==='highlighter'?2.5:.7);
    if(pts.length===1)return Math.hypot(x-pts[0][0],y-pts[0][1])<tolerance+(item.tool==='artist'?reach:item.size);
    for(let i=1;i<pts.length;i++)if(distToSegment(x,y,...pts[i-1].slice(0,2),...pts[i].slice(0,2))<tolerance+reach)return true;
    return false;
  }
  function hitTest(x,y,eraser=false){const items=page()?.items||[],width=$('inkCanvas').getBoundingClientRect().width||W,tolerance=eraser?14:8*W/width;for(let i=items.length-1;i>=0;i--)if(nearItem(items[i],x,y,eraser,tolerance))return i;return -1;}
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
  function beginSelectionTransform(ev,rect,p,kind,corner=null){
    const original=page().items[state.selected];if(!original)return;
    const gesture={kind,corner,original,page:page(),scope:clipboardContext(),rect,pointerId:ev.pointerId,pointerType:ev.pointerType,
      startX:p.x,startY:p.y,point:p,dx:0,dy:0,changed:false,frame:0,bounds:selectionBounds(original),preview:original,epoch:state.selectionEpoch};
    state.drag=state.selectionTransform=gesture;queueSelectionTransform(gesture);
  }
  function updateSelectionTransform(gesture,p){
    gesture.point=p;gesture.dx=p.x-gesture.startX;gesture.dy=p.y-gesture.startY;
    if(!gesture.changed&&Math.hypot(gesture.dx,gesture.dy)*gesture.rect.width/W<3)return;
    gesture.changed=true;queueSelectionTransform(gesture);
  }
  function queueSelectionTransform(gesture){
    if(gesture.frame)return;
    gesture.frame=requestAnimationFrame(()=>{
      gesture.frame=0;
      if(state.selectionTransform!==gesture||!clipboardMatches(gesture.scope)||page()!==gesture.page)return;
      const original=gesture.original;
      gesture.preview=!gesture.changed?original:gesture.kind==='resize'?resizeDragPreview(gesture,gesture.point):original.type==='stroke'?original:{...original,x:original.x+gesture.dx,y:original.y+gesture.dy};
      if(gesture.changed){
        if(!gesture.prepared){
          gesture.prepared=true;
          const engine=window.WindsSelectionPreview?.create({makeCanvas:()=>document.createElement('canvas'),
            background:(ctx,p)=>{drawTemplate(ctx,p.background?'blank':p.template||'ruled',pageDimensions(p));drawPdfBackground(ctx,p);},
            draw:drawItem,bounds:rotationPaintBounds,rotate:CREATIVE.rotateContext,rect:CREATIVE.objectRect});
          if(engine?.prepare(gesture.page,original,W,H))gesture.renderer=engine;
        }
        const ctx=$('pageCanvas').getContext('2d');ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
        if(!gesture.renderer?.paint(ctx,gesture.preview,gesture.dx,gesture.dy,gesture.kind==='resize'))paintSelectionFallback(ctx,gesture);
        gesture.painted=true;
      }
      clearInk();drawSelection(inkContext());updateSelectionActions();
    });
  }
  function paintSelectionFallback(ctx,gesture){
    const original=gesture.original,preview=gesture.preview;
    const next=gesture.kind==='resize'?rotationPaintBounds(preview):{...rotationPaintBounds(original),x:rotationPaintBounds(original).x+gesture.dx,y:rotationPaintBounds(original).y+gesture.dy};
    const region=interactions.union([gesture.previousBounds||rotationPaintBounds(original),next]);
    if(!gesture.layers)gesture.layers=gesture.page.items.map(item=>({item,bounds:rotationPaintBounds(item)}));
    ctx.save();
    try{
      ctx.beginPath();ctx.rect(region.x,region.y,region.w,region.h);ctx.clip();
      drawTemplate(ctx,gesture.page.background?'blank':gesture.page.template||'ruled',pageDimensions(gesture.page));drawPdfBackground(ctx,gesture.page);
      for(const layer of gesture.layers){
        if(layer.item===original){ctx.save();if(gesture.kind==='select'&&original.type==='stroke')ctx.translate(gesture.dx,gesture.dy);drawItem(ctx,preview);ctx.restore();}
        else if(interactions.intersects(region,layer.bounds))drawItem(ctx,layer.item);
      }
    }finally{ctx.restore();}
    gesture.previousBounds=next;
  }
  function endSelectionTransform(gesture,repaint=true){
    if(gesture.frame)cancelAnimationFrame(gesture.frame);gesture.frame=0;
    if(gesture.renderer)requestAnimationFrame(()=>gesture.renderer.release());
    if(state.selectionTransform!==gesture)return;
    state.selectionTransform=null;
    const restore=()=>{
      if(!clipboardMatches(gesture.scope))return;
      if(state.drag||state.pinch||state.draft||bufferedPenInk){setTimeout(restore,40);return;}
      if(repaint&&gesture.painted)renderCanvas();else{clearInk();drawSelection(inkContext());updateSelectionActions();}
    };
    requestAnimationFrame(restore);
  }
  function pointerDown(ev){
    if(!page()||state.editingText||state.drag?.kind==='rotate')return;
    if(ev.pointerType==='mouse' && ev.button!==0)return;
    if(ev.pointerType==='pen'){
      state.lastPenAt=Date.now();
      // A new Apple Pencil contact is definitive evidence that the preceding
      // contact ended. Some WebKit builds omit pointerup/lostpointercapture,
      // leaving state.drag set and causing every subsequent letter to be lost.
      // Do not throw away the previous stroke: finish it before accepting this.
      if(['draw','erase','select','area','areaMove'].includes(state.drag?.kind)){
        finishPointer({pointerId:state.drag.pointerId},true);
      }
      if(!state.stylusSeen){
        state.stylusSeen=true;
        // Do not silently change the user's input mode. Safari may report
        // mixed pointer types during rapid Pencil contacts; auto-switching
        // to stylus-only can mistakenly reject valid contacts. Users may
        // keep their explicit input choice even though Stylus only is the default.
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
          if(state.drag.kind==='erase')eraserPreview?.complete(state.drag);
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
      if(sincePencil<PALM_GUARD_MS&&state.tool!=='pan'){if(ev.cancelable)ev.preventDefault();return;}
      if(state.penOnly){
        state.drag={kind:'pan',pointerId:ev.pointerId,pointerType:'touch',lastX:ev.clientX,lastY:ev.clientY};
        try{ev.currentTarget.setPointerCapture(ev.pointerId);}catch{}
        if(ev.cancelable)ev.preventDefault();return;
      }
    }
    const rect=$('inkCanvas').getBoundingClientRect();
    const p=clampPoint(point(ev,rect));
    if(state.drag || state.pinch || (state.penOnly && ev.pointerType==='touch'))return;
    if(ev.cancelable)ev.preventDefault();
    if(state.tool==='text'){
      const at=hitTest(p.x,p.y);
      if(at!==-1&&page().items[at].type==='text')beginText(p.x,p.y,at);else beginText(p.x,p.y);
      return;
    }
    try{ev.currentTarget.setPointerCapture(ev.pointerId);}catch(err){}
    if(state.tool==='eraser'){
      state.drag={kind:'erase',pointerId:ev.pointerId,pointerType:ev.pointerType,rect,scope:clipboardContext(),originals:page().items.slice(),points:[],radius:state.eraserSize/2,inkOnly:state.eraserInkOnly};eraseAt(p.x,p.y);return;
    }
    if(state.tool==='pan'){state.drag={kind:'pan',pointerId:ev.pointerId,pointerType:ev.pointerType,lastX:ev.clientX,lastY:ev.clientY};return;}
    const group=activeGroup();
    const insideGroup=group&&window.WindsInteractions.contains(group.bounds,{x:p.x,y:p.y,w:0,h:0},8);
    if(state.tool==='area'||(state.tool==='select'&&insideGroup)){
      state.selectionEpoch=(state.selectionEpoch||0)+1;
      state.drag={kind:insideGroup?'areaMove':'area',pointerId:ev.pointerId,pointerType:ev.pointerType,rect,scope:clipboardContext(),start:p,end:p,dx:0,dy:0,group:insideGroup?group:null,epoch:state.selectionEpoch};if(!insideGroup){state.selected=-1;groupSelection=null;}queueInteractionOverlay();return;
    }
    if(state.tool==='select'){
      state.selectionEpoch=(state.selectionEpoch||0)+1;groupSelection=null;
      composeInkNow();
      const existing=page().items[state.selected];
      const corner=resizeHit(existing,p);
      if(corner){
        beginSelectionTransform(ev,rect,p,'resize',corner);return;
      }
      const idx=hitTest(p.x,p.y);state.selected=idx;
      if(idx<0){queueInteractionOverlay();return;}
      beginSelectionTransform(ev,rect,p,'select');return;
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
      // A new Pencil eraser ID can also reveal a lost previous UP. Hover never
      // starts a stroke or an erase; keep the existing pressed-contact guards.
      const lostEraseStart=state.tool==='eraser'&&state.drag?.kind==='erase'&&state.drag.pointerType==='pen'&&state.drag.pointerId!==ev.pointerId;
      if((!state.drag || lostEraseStart) && !state.pinch && ev.pressure>0.01 &&
         (ev.buttons&1) && ['pen','highlighter','artist','eraser'].includes(state.tool) &&
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
    if(['area','areaMove'].includes(state.drag.kind)){state.drag.end=p;state.drag.dx=p.x-state.drag.start.x;state.drag.dy=p.y-state.drag.start.y;queueInteractionOverlay();return;}
    if(state.drag.kind==='erase'){
      const events=ev.getCoalescedEvents?ev.getCoalescedEvents():[];
      for(const sample of events){const q=clampPoint(point(sample));eraseAt(q.x,q.y);}
      eraseAt(p.x,p.y);return;
    }
    if(['select','resize'].includes(state.drag.kind)){updateSelectionTransform(state.drag,p);return;}
    if(state.drag.kind==='draw'&&state.draft){
      if(state.draft.type==='stroke'){
        const events=ev.getCoalescedEvents?ev.getCoalescedEvents():[ev];
        for(const co of events)appendPoint(state.draft,clampPoint(point(co)));
        appendPoint(state.draft,p);
      }else updateShapeDraft(state.draft,p.x-state.drag.startX,p.y-state.drag.startY);
      queueInk();
    }
  }
  function finishPointer(ev,cancelled=false){
    state.pointers.delete(ev.pointerId);
    if(state.pinch){if(state.pointers.size<2){endPinch();state.pointers.clear();}return;}
    if(!state.drag||state.drag.pointerId!==ev.pointerId)return;
    if(['select','resize'].includes(state.drag.kind)&&state.drag.scope){
      const gesture=state.drag;
      if(!cancelled&&Number.isFinite(ev.clientX)&&Number.isFinite(ev.clientY))updateSelectionTransform(gesture,clampPoint(point(ev)));
      state.drag=null;gesture.finished=true;
      if(gesture.changed&&(!cancelled||gesture.pointerType!=='touch'))deferInteraction(gesture);
      else endSelectionTransform(gesture);
      return;
    }
    if(['erase','area','areaMove'].includes(state.drag.kind)){
      const gesture=state.drag;
      if(gesture.kind==='erase'&&!cancelled&&Number.isFinite(ev.clientX)&&Number.isFinite(ev.clientY)){
        const p=clampPoint(point(ev));eraseAt(p.x,p.y);
      }
      state.drag=null;
      // Like handwriting, keep sampled Pencil contacts when WebKit omits an
      // end event or drops capture. Finger cancellation still rolls back so a
      // second finger can establish pinch without leaving an accidental edit.
      if(!cancelled||(gesture.kind==='erase'&&gesture.pointerType==='pen'))deferInteraction(gesture);
      else if(gesture.kind==='erase'&&eraserPreview?.has(gesture)){gesture.cancelledPreview=true;deferInteraction(gesture);}
      else queueInteractionOverlay();return;
    }
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
  function pointerLostCapture(ev){
    if(state.drag?.pointerId!==ev.pointerId)return;
    if(state.drag.kind==='rotate')return; // The floating rotation handle owns this contact.
    if(['select','resize'].includes(state.drag.kind)){
      // A delayed loss from a previous contact can arrive after a new DOWN.
      // Keep the newer capture, or recover it while its button is still down.
      const target=ev.currentTarget;
      try{
        if(target?.hasPointerCapture?.(ev.pointerId))return;
        target?.setPointerCapture?.(ev.pointerId);
        if(target?.hasPointerCapture?.(ev.pointerId))return;
      }catch{}
    }
    finishPointer(ev,true);
  }
  function finishActiveStroke(){
    if(imageCropSession)closeImageCrop();
    if(state.drag?.kind==='rotate')finishObjectRotation(state.drag.finished==='apply');
    else if(state.drag)finishPointer({pointerId:state.drag.pointerId},state.drag.kind==='draw');
  }
  function eraseAt(x,y){const d=state.drag;if(!d||d.kind!=='erase')return;if(!d.previewStarted){d.previewStarted=true;eraserPreview?.begin(d,eraserPreviewKey());}const last=d.points.at(-1);if(!last||Math.hypot(x-last.x,y-last.y)>1){if(d.points.length>=2048)d.points=d.points.filter((_,i)=>i%2===0);d.points.push({x,y});eraserPreview?.add(d,{x,y});}queueInteractionOverlay();}
  function beginText(x,y,idx=-1){
    const existing=idx>=0?page().items[idx]:null;
    const item=existing?clone(existing):{id:uid(),type:'text',x,y,w:Math.min(500,W-x-28),...textDefaults(),color:state.color,text:''};
    const editor=$('inlineTextEditor'),rect=$('pageCanvas').getBoundingClientRect(),scale=rect.width/W;
    editor.hidden=false;editor.style.left=`${item.x*scale}px`;editor.style.top=`${item.y*scale}px`;
    editor.style.width=`${Math.max(100,item.w*scale)}px`;editor.style.height=`${Math.max(65,Math.min(340,((item.text||'').split('\n').length+2)*item.size*window.WindsText.style(item).lineHeight*scale))}px`;
    const format=window.WindsText.style(item);editor.style.fontSize=`${format.size*scale}px`;editor.style.color=item.color;editor.style.fontFamily=window.WindsText.stack(format);editor.style.fontWeight=format.bold?'700':'400';editor.style.fontStyle=format.italic?'italic':'normal';editor.style.textDecoration=format.underline?'underline':'none';editor.style.textAlign=format.align;editor.style.lineHeight=String(format.lineHeight);
    editor.value=item.text;state.editingText={item,idx};editor.focus();editor.setSelectionRange(editor.value.length,editor.value.length);
  }
  function commitText(){
    if(!state.editingText)return;
    const editor=$('inlineTextEditor'),text=editor.value.trimEnd(),{item,idx}=state.editingText;
    state.editingText=null;editor.hidden=true;
    if(!page())return;
    if(text.trim()){
      item.text=text;
      if(idx<0){remember();page().items.push(item);}
      else if(text!==page().items[idx]?.text){remember();page().items[idx]=item;}
      else{state.selected=idx;return;}
      state.selected=idx<0?page().items.length-1:idx;
      scheduleSave();renderThumbs();renderCanvas();
    }else if(idx>=0){remember();page().items.splice(idx,1);scheduleSave();renderThumbs();renderCanvas();}
  }
  async function importImage(file){
    if(!file||!file.type.startsWith('image/')){toast('Please select an image file');return;}
    if(file.size>25*1024*1024){toast('Image too large. Use a file smaller than 25 MB.');return;}
    const account=workspaceId,target=page(),scope=clipboardContext();
    if(!target)return;
    try{
      const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      const img=new Image();img.src=src;await img.decode();
      await clipboardWait(scope);
      if(account!==workspaceId||target!==page())throw new Error('The destination changed. Insert the image again on the intended page.');
      if(!img.width||!img.height||img.width*img.height>100000000)throw new Error('This image is too large to insert. Use an image under 100 megapixels.');
      const scale=Math.min(1,1500/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      const output=c.toDataURL(file.type==='image/jpeg'?'image/jpeg':'image/png',.9);
      c.width=c.height=1;
      const w=Math.min(650,img.width/img.height*650,650),h=w*img.height/img.width;
      const maxH=900,ratio=Math.min(1,maxH/h);
      const item={id:uid(),type:'image',x:(W-w*ratio)/2,y:120,w:w*ratio,h:h*ratio,src:output};
      remember();page().items.push(item);state.selected=page().items.length-1;setTool('select');state.selected=page().items.length-1;
      const cached=new Image();cached.src=output;imageCache.set(output,cached);cached.onload=()=>renderCloudChanges(account);
      renderCanvas();renderThumbs();scheduleSave();toast('Image inserted. Use Select to move it.');
    }catch(err){console.error(err);toast(err?.message||'Could not open image');}
  }
  function clearPreparedExport(){
    clearTimeout(preparedExportTimer);if(preparedExport)URL.revokeObjectURL(preparedExport);preparedExport=null;
    const link=$('preparedExportLink');link.hidden=true;link.removeAttribute('href');
  }
  function downloadBlob(blob,name){
    clearPreparedExport();const url=URL.createObjectURL(blob);preparedExport=url;
    const link=$('preparedExportLink');link.href=url;link.download=name;link.textContent=`Download ${name}`;link.hidden=false;
    const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    preparedExportTimer=setTimeout(clearPreparedExport,300000);
  }
  async function backup(){
    const account=workspaceId;
    finishActiveStroke();commitText();
    while(state.pendingInteractions)await delay(80);
    if(account!==workspaceId)return;
    await saveNow();
    while(inputBusy()||state.pendingInteractions)await delay(80);
    if(account!==workspaceId)return;
    const json=JSON.stringify({format:'winds-notes-backup',version:1,exportedAt:now(),notebooks:state.notebooks},null,2);
    downloadBlob(new Blob([json],{type:'application/json'}),'WiNDS-Notes-backup.json');
    toast('Backup downloaded');
  }
  async function saveNativeNotebook(){
    const account=workspaceId;finishActiveStroke();while(state.pendingInteractions)await delay(80);if(account!==workspaceId)return;
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
  async function createMandalaPage(designId,scope,valid){
    const check=()=>{
      if(!valid()||scope.workspace!==workspaceId||scope.bookId!==state.activeId)throw Error('The notebook changed. Reopen the coloring studio.');
    };
    check();while(inputBusy()||state.pendingInteractions){await delay(80);check();}
    const target=notebook(),design=CREATIVE.MANDALA_DESIGNS.find(item=>item.id===designId);
    if(!target||!design)throw Error('Choose an available mandala design.');
    if(target.pages.length>=750)throw Error('This notebook has 750 pages. Create a new notebook for coloring.');
    const index=target.pages.findIndex(item=>item.id===scope.pageId);
    if(index<0)throw Error('The original page is no longer available.');
    const prepared=await CREATIVE.prepareMandala(designId);check();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1400;
    try{
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('Not enough canvas memory. Close another notebook tab and try again.');
      CREATIVE.drawMandala(ctx,designId,1400,prepared);
      const src=canvas.toDataURL('image/png'),image=new Image();image.src=src;await image.decode();check();
      const added=makePage('blank','portrait');
      added.items=[
        {id:uid(),type:'text',x:70,y:78,w:700,size:30,color:'#30344c',text:design.name},
        {id:uid(),type:'text',x:70,y:128,w:700,size:15,color:'#74788f',text:'Choose Fill, then tap a closed section. Undo to try another color.'},
        {id:uid(),type:'image',x:70,y:230,w:700,h:700,src}
      ];
      // Normal editable page objects keep native files and Drive data compatible.
      const clean=window.WindsFile.validateShared({id:target.id,title:target.title,pages:[added]}).pages[0];
      const proposed={...target,pages:[...target.pages.slice(0,index+1),clean,...target.pages.slice(index+1)]};
      if(window.WindsFile.serialize(proposed).length>window.WindsFile.MAX_FILE_BYTES)throw Error('This notebook would exceed 100 MB. Add coloring pages to a new notebook instead.');
      check();imageCache.set(src,image);target.pages.splice(index+1,0,clean);state.pageIndex=index+1;state.selected=-1;
      syncPageGeometry();resizePage();renderEditor();scheduleSave(true);window.WindsPageStack.focus(clean.id);
      return clean.id;
    }finally{canvas.width=canvas.height=1;}
  }
  async function commitPdfPages(result,context){
    if(context.workspace!==workspaceId)throw Error('The account changed. Reopen the PDF in the intended account.');
    const target=result.append?state.notebooks.find(n=>n.id===context.bookId):null;
    if(result.append&&!target)throw Error('The destination notebook is no longer available.');
    const pages=result.pages.map(p=>({...p,id:uid()})),stamp=now();
    const proposed=target?{...target,pages:[...target.pages,...pages],updatedAt:stamp}:{id:uid(),title:result.title.slice(0,70),cover:'blue',createdAt:stamp,updatedAt:stamp,pages};
    if(proposed.pages.length>750)throw Error('This notebook would exceed 750 pages. Create a new notebook instead.');
    const imported=window.WindsFile.validateShared({...proposed,pages});
    const validated=target?{...target,pages:[...target.pages,...imported.pages],updatedAt:stamp}:imported;
    if(window.WindsFile.serialize(validated).length>window.WindsFile.MAX_FILE_BYTES)throw Error('This notebook would exceed 100 MB. Import fewer pages into a new notebook.');
    await pdfImage(pages[0].background.src).promise;
    if(context.workspace!==workspaceId)throw Error('The account changed. Reopen the PDF in the intended account.');
    if(target){const index=state.notebooks.indexOf(target);if(index<0)throw Error('The destination notebook changed.');state.notebooks[index]={...validated,...(target._sharing?{_sharing:target._sharing}:{})};}
    else state.notebooks.push(validated);
    dirtyAll=true;saveVersion++;await saveNow(true);const saved=!dirtyAll;
    if(context.workspace!==workspaceId)throw Error('The account changed after saving. Open the original account to find these PDF pages.');
    $('searchNotebooks').value='';openNotebook(validated.id);if(target)switchPage(target.pages.length);
    return {saved};
  }
  async function openEditableFile(file){
    if(!file)return;
    if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){window.WindsPDFImport.open(file);return;}
    if(file.size>window.WindsFile.MAX_FILE_BYTES){toast('File is too large (100 MB maximum)');return;}
    const account=workspaceId;
    try{
      const source=await file.text();
      while(inputBusy()||state.pendingInteractions)await delay(80);
      if(account!==workspaceId)throw new Error('The account changed. Reopen the file in the intended account.');
      // Parsing validates each object before any current notebook is modified.
      const data=window.WindsFile.parse(source);
      finishActiveStroke();commitText();
      // Re-key imported notebook/page/object IDs, preserving all other data.
      // This is non-destructive: importing never overwrites any existing notebook.
      state.notebooks.push(...data.notebooks);
      dirtyAll=true;saveVersion++;
      await saveNow(true);
      if(account!==workspaceId)return;
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
    const account=workspaceId;finishActiveStroke();
    const button=$('exportBtn');button.disabled=true;button.querySelector('span:last-child').textContent='Working…';
    try{
      if(format==='pdf'){
        const images=[];
        for(let i=0;i<n.pages.length;i++){
          await preparePdfExport(n.pages[i],account);
          const c=renderExportCanvas(n.pages[i]);const bytes=window.WindsPDF.dataUrlToBytes(c.toDataURL('image/jpeg',.9));
          images.push({width:c.width,height:c.height,bytes});await delay(0);
        }
        await preparePdfExport(null,account);
        downloadBlob(window.WindsPDF.writePdf(images),`${filename(n.title)}.pdf`);
        toast(`Exported ${n.pages.length} page${n.pages.length===1?'':'s'} as PDF`);
      }else{
        const exportPage=page();await preparePdfExport(exportPage,account);
        const c=renderExportCanvas(exportPage);const mime=format==='png'?'image/png':'image/jpeg';
        const blob=await new Promise(resolve=>c.toBlob(resolve,mime,format==='png'?undefined:.93));
        if(!blob)throw Error('Image export not supported');
        if(account!==workspaceId)throw Error('The account changed during export.');
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
  function deleteNotebook(id){const n=state.notebooks.find(n=>n.id===id);if(!n)return;if(!confirm(n._sharing?`Remove "${n.title}" from this account's library? Other collaborators retain their shared notebook.`:`Permanently delete "${n.title}" and all ${n.pages.length} pages? Export a backup first if needed.`))return;tombstones[id]=globalThis.WindsWorkspaceModel.deletion(n,now(),workspaceActor);state.notebooks=state.notebooks.filter(n=>n.id!==id);if(state.activeId===id){state.activeId=null;view('library');}scheduleSave(true);saveNow(true);renderLibrary();toast(n._sharing?'Shared notebook removed from your library':'Notebook deleted');}
  function closeMenus(){
    ['exportMenu','paperMenu','orientationMenu','moreMenu','emojiMenu','colorMenu','fillMenu','artistMenu','zoomMenu','eraserMenu','shapeMenu'].forEach(id=>{const menu=$(id);if(menu)menu.hidden=true;});
    [['exportBtn','exportMenu'],['paperStyleBtn','paperMenu'],['pageOrientationBtn','orientationMenu'],['moreOptionsBtn','moreMenu'],['emojiBtn','emojiMenu'],['customColorBtn','colorMenu'],['fillSettingsBtn','fillMenu'],['artistBtn','artistMenu'],['zoomValue','zoomMenu'],['eraserSettingsBtn','eraserMenu'],['shapeMenuBtn','shapeMenu']].forEach(([button])=>$(button)?.setAttribute('aria-expanded','false'));
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
  function compactSelectionActions(){
    // Reuse the controls from the HTML so an older cached shell gets the same bar.
    const precision=document.createElement('details');
    precision.id='selectionPrecision';
    precision.hidden=true;
    const summary=document.createElement('summary');
    summary.textContent='Size and angle';
    const widthRow=document.createElement('div');
    widthRow.className='selection-width-row';
    widthRow.append($('selectedShrink'),$('selectedWidth').closest('label'),$('selectedGrow'));
    precision.append(summary,widthRow,$('rotationControls'));

    const clear=$('clearAreaSelection'),remove=$('removeSelected');
    clear.textContent='Clear selection';
    remove.textContent='Delete selection';
    remove.hidden=true;
    $('moreMenu').querySelector('[data-action="scroll"]').before(precision,clear,remove);
    $('selectionActions').replaceChildren($('copySelected'),$('cutSelected'));
  }
  function bind(){
    compactSelectionActions();
    $('heroCreate').onclick=$('newNotebook').onclick=showModal;
    $('importPdfHome').onclick=()=>$('pdfFileInput').click();
    $('pdfFileInput').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)window.WindsPDFImport.open(file);};
    $('closeModal').onclick=$('cancelModal').onclick=hideModal;
    $('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))hideModal();});
    $('newNotebookTitle').addEventListener('keydown',e=>{if(e.key==='Enter')createNotebook();});
    $('createNotebookConfirm').onclick=createNotebook;
    $('coverChoices').onclick=e=>{const button=e.target.closest('[data-cover]');if(!button)return;document.querySelectorAll('[data-cover]').forEach(x=>x.classList.toggle('active',x===button));};
    $('notebookGrid').addEventListener('click',e=>{const menu=e.target.closest('[data-notebook-menu]');if(menu){e.stopPropagation();openNotebookMenu(menu);return;}closeNotebookMenu();const card=e.target.closest('[data-open]');if(card)openNotebook(card.dataset.open);});
    $('cardScrollNotebook').onclick=()=>{const id=menuNotebookId;closeNotebookMenu();openNotebook(id);setTool('pan');};
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
    bindBoundaryFill();
    $('shapeFillBtn').onclick=event=>{event.stopPropagation();armBoundaryFill();};
    $('fillSettingsBtn').onclick=showFillMenu;
    $('shapeMenuBtn').onclick=()=>toggleMenu('shapeMenuBtn','shapeMenu');
    document.querySelectorAll('#shapeMenu [data-shape]').forEach(button=>{button.onclick=()=>chooseShape(button.dataset.shape);});
    $('activeFillColor').oninput=event=>setFillOptions({color:event.target.value});
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
    $('stickerCollections').onclick=e=>{
      const button=e.target.closest('[data-sticker-collection]');
      if(!button||!['all','everyday','education'].includes(button.dataset.stickerCollection))return;
      stickerCollection=button.dataset.stickerCollection;renderEmojiGrid($('emojiSearch').value);
    };
    $('stickerSize').oninput=e=>{$('stickerSizeValue').textContent=e.target.value;};
    $('emojiGrid').onclick=e=>{const btn=e.target.closest('[data-emoji]');if(btn)addEmoji(btn.dataset.emoji);};
    $('extendedColors').onclick=e=>{const btn=e.target.closest('[data-more-color]');if(btn){setColor(btn.dataset.moreColor);closeMenus();}};
    $('customColorInput').oninput=e=>setColor(e.target.value);
    $('customColorInput').onchange=()=>closeMenus();
    document.querySelectorAll('[data-export]').forEach(el=>el.onclick=()=>exportCurrent(el.dataset.export));
    document.querySelectorAll('[data-paper]').forEach(el=>el.onclick=()=>{if(!page()||page().background)return;page().template=el.dataset.paper;closeMenus();renderEditor();scheduleSave();toast('Paper template changed');});
    document.querySelectorAll('[data-orientation]').forEach(el=>el.onclick=()=>setOrientation(el.dataset.orientation));
    $('moreMenu').onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;closeMenus();const a=b.dataset.action;if(a==='fit'){finishActiveStroke();state.zoom=1;resizePage();}else if(a==='scroll'){setTool('pan');toast('Drag to scroll between notebook pages. Tap Pen to write.');}else if(a==='editText')editSelectedText();else if(a==='copy')window.WindsClipboard.copy();else if(a==='cut')window.WindsClipboard.copy(true);else if(a==='paste')window.WindsClipboard.paste();else if(a==='pasteInternal')window.WindsClipboard.paste(true);else if(a==='rename'){$('notebookTitle').focus();$('notebookTitle').select();}else if(a==='duplicate')duplicatePage();else if(a==='deletePage')deletePage(page()?.id);else if(a==='backup')backup();else if(a==='restore')$('restoreFileInput').click();else if(a==='open')$('openNotebookInput').click();else if(a==='pdf')$('pdfFileInput').click();else if(a==='pencilTest')togglePencilDiagnostics(true);else if(a==='drive')window.WindsDrive?.open();else if(a==='deleteNotebook')deleteNotebook(state.activeId);};
    document.addEventListener('click',e=>{if(!e.target.closest('.pop-menu')&&!e.target.closest('#exportBtn')&&!e.target.closest('#paperStyleBtn')&&!e.target.closest('#pageOrientationBtn')&&!e.target.closest('#moreOptionsBtn')&&!e.target.closest('#emojiBtn')&&!e.target.closest('#customColorBtn')&&!e.target.closest('#shapeFillBtn')&&!e.target.closest('#fillSettingsBtn')&&!e.target.closest('#artistBtn')&&!e.target.closest('#zoomValue')&&!e.target.closest('#eraserBtn')&&!e.target.closest('#eraserSettingsBtn')&&!e.target.closest('#shapeMenuBtn'))closeMenus();});
    document.querySelectorAll('[data-tool]').forEach(btn=>{if(!['artist','eraser'].includes(btn.dataset.tool))btn.onclick=()=>setTool(btn.dataset.tool);});
    $('eraserBtn').onclick=event=>{event.stopPropagation();setTool('eraser');closeMenus();};
    $('eraserSettingsBtn').onclick=event=>{
      event.stopPropagation();
      setTool('eraser',{inkOnly:state.eraserInkOnly});
      toggleMenu('eraserSettingsBtn','eraserMenu');
    };
    $('eraserSize').oninput=event=>setEraserSize(event.target.value);
    $('eraserSizeNumber').oninput=event=>{const size=Number(event.target.value);if(size>=4&&size<=128)setEraserSize(size);};
    $('eraserSizeNumber').onchange=$('eraserSizeNumber').onblur=event=>{setEraserSize(event.target.value);syncEraserControls();};
    document.querySelectorAll('[data-eraser-size]').forEach(button=>button.onclick=()=>setEraserSize(button.dataset.eraserSize));
    $('closeEraserMenu').onclick=()=>{closeMenus();$('eraserBtn').focus();};
    $('eraserMenu').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenus();$('eraserBtn').focus();}});
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
    $('pencilOnly').onchange=e=>{state.stylusPreferenceChanged=true;state.penOnly=e.target.checked;persistInputPreferences();toast(state.penOnly?'Stylus drawing enabled · fingers scroll and pinch':'Finger drawing enabled');};
    $('addPageSidebar').onclick=$('addPageBottom').onclick=$('addPageFloat').onclick=$('addPageTop').onclick=addPage;
    $('thumbList').onclick=e=>{const remove=e.target.closest('[data-remove-page]');if(remove){deletePage(remove.dataset.removePage);return;}const thumb=e.target.closest('[data-page]');if(thumb)switchPage(Number(thumb.dataset.page));};
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
    mountObjectTransformHandles();
    bindObjectTransformHandles();
    $('removeSelected').onclick=()=>{closeMenus();deleteSelection();};
    $('clearAreaSelection').onclick=()=>{closeMenus();groupSelection=null;state.selected=-1;renderCanvas();};
    $('eraserMode').onchange=e=>{state.eraserInkOnly=e.target.value==='ink';syncEraserControls();persistEraserPreferences();prepareEraserPreview(true);};
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
    $('inkCanvas').addEventListener('dblclick',event=>{if(state.tool!=='select'&&state.tool!=='text')return;const p=point(event),index=hitTest(p.x,p.y);if(page()?.items[index]?.type==='text'){state.selected=index;editSelectedText();}});
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
    let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.drag)return;updateSidebar();resizePage();updateToolbarArrows();if(!$('artistMenu').hidden)positionMenu($('artistBtn'),$('artistMenu'));if(!$('eraserMenu').hidden)positionMenu($('eraserSettingsBtn'),$('eraserMenu'));},160);});
    document.addEventListener('keydown',e=>{
      if(globalThis.WindsText?.isOpen()||globalThis.WindsPDFImport?.isOpen()||!$('pageReader').hidden||!$('sharedAccessBackdrop').hidden||!$('clipboardBackdrop').hidden)return;
      if(imageCropSession){
        if(e.key==='Escape'){e.preventDefault();closeImageCrop();}
        else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!e.target.matches('input'))e.preventDefault();
        return;
      }
      if(state.drag?.kind==='rotate'){
        if(e.key==='Escape'){e.preventDefault();finishObjectRotation();}
        return;
      }
      if(!$('modalBackdrop').hidden && e.key==='Escape'){hideModal();return;}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){if(['TEXTAREA','INPUT'].includes(document.activeElement?.tagName))return;e.preventDefault();if(e.shiftKey)redo();else undo();return;}
      if(e.target.matches('input,textarea,select,[contenteditable]'))return;
      if((e.metaKey||e.ctrlKey)&&['c','x','v'].includes(e.key.toLowerCase()))return;
      if(e.key==='Escape'){closeMenus();state.selected=-1;renderCanvas();return;}
      if($('editorView').hidden)return;
      const shortcuts={p:'pen',h:'highlighter',e:'eraser',v:'select',t:'text',s:'pan',l:'area'};
      if(shortcuts[e.key.toLowerCase()])setTool(shortcuts[e.key.toLowerCase()]);
      else if(e.key.toLowerCase()==='r'&&!e.metaKey&&!e.ctrlKey&&!e.altKey)setTool($('shapeToolBtn')?.dataset.tool||'rectangle');
      if((e.key==='Delete'||e.key==='Backspace')&&state.selected>=0){e.preventDefault();deleteSelection();}
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden){finishActiveStroke();saveNow(true);rememberResumePoint();}});
    window.addEventListener('pagehide',()=>{finishActiveStroke();saveNow(true);rememberResumePoint();});
  }
  function textDefaults(){return state.textStyle?{...state.textStyle}:{size:Math.max(18,Math.min(40,12+state.size*2.4))};}
  function editSelectedText(){
    if(state.drag||state.pinch||globalThis.WindsText.isOpen())return;
    let id=page()?.items[state.selected]?.id;if(state.editingText){id=state.editingText.item.id;commitText();}
    const index=page()?.items.findIndex(item=>item.id===id&&item.type==='text');
    if(!(index>=0)){toast('Use Select to choose a text box, then tap Edit text.');return;}
    composeInkNow();closeMenus();state.selected=index;
    const item=page().items[index];window.WindsText.open(item,{account:workspaceId,book:state.activeId,page:page().id,item,version:saveVersion});
  }
  function applyEditedText(item,scope){
    if(scope.account!==workspaceId||scope.book!==state.activeId||scope.page!==page()?.id)throw Error('The account or page changed. Reopen the text in the intended notebook.');
    const index=page().items.indexOf(scope.item);if(index<0||scope.version!==saveVersion)throw Error('This notebook changed while editing. Reopen the text to keep its latest content.');
    if(state.drag||state.pinch||state.editingText||state.pendingInteractions||imageCropSession)throw Error('Finish the current interaction before applying text.');
    const next={...scope.item,...item,...window.WindsText.style(item),id:scope.item.id};
    if(JSON.stringify(next)===JSON.stringify(scope.item))return;
    remember();if(next.text.trim()){page().items[index]=next;state.textStyle=window.WindsText.style(next);state.selected=index;}else{page().items.splice(index,1);state.selected=-1;}
    scheduleSave();renderCanvas();renderThumbs();toast('Text updated · Undo restores the previous text and formatting');
  }
  // Gesture callbacks only collect coordinates. Geometry, snapshots and page
  // composition run after input is idle, never between Pencil samples.
  let interactionRAF=0,groupSelection=null,interactionQueue=Promise.resolve();
  const interactions=window.WindsInteractions;
  function inputBusy(){return Boolean(state.drag||state.pinch||state.editingText||imageCropSession||globalThis.WindsText?.isOpen()||Date.now()-state.lastPenAt<180);}
  async function interactionIdle(){while(inputBusy())await delay(80);}
  function activeGroup(){return groupSelection&&state.selected>=0&&groupSelection.version===saveVersion&&clipboardMatches(groupSelection.scope)?groupSelection:null;}
  function selectionItems(){const group=activeGroup();return group?page().items.filter(item=>group.ids.has(item.id)):[page()?.items[state.selected]].filter(Boolean);}
  function selectGroup(items){
    if(groupSelection?.bitmap)groupSelection.bitmap.width=groupSelection.bitmap.height=1;
    groupSelection=null;if(!items.length){state.selected=-1;return;}
    state.selected=page().items.indexOf(items[0]);const bounds=interactions.union(items.map(clipboardBounds));
    let bitmap=document.createElement('canvas');const scale=Math.min(1,1400/Math.max(bounds.w,bounds.h,1));bitmap.width=Math.max(1,Math.ceil(bounds.w*scale+16));bitmap.height=Math.max(1,Math.ceil(bounds.h*scale+16));
    const ctx=bitmap.getContext('2d');
    if(ctx){try{ctx.scale(scale,scale);ctx.translate(8/scale-bounds.x,8/scale-bounds.y);for(const item of items)drawItem(ctx,item);}catch(error){bitmap.width=bitmap.height=1;throw error;}}
    else{bitmap.width=bitmap.height=1;bitmap=null;}
    groupSelection={ids:new Set(items.map(i=>i.id)),scope:clipboardContext(),version:saveVersion,bounds,bitmap,scale};
  }
  function deleteSelection(){if(!clipboardEnabled())return;const items=selectionItems();if(!items.length)return;const ids=new Set(items.map(i=>i.id));remember();page().items=page().items.filter(i=>!ids.has(i.id));state.selected=-1;groupSelection=null;renderCanvas();renderThumbs();scheduleSave();}
  function queueInteractionOverlay(){if(interactionRAF)return;interactionRAF=requestAnimationFrame(()=>{interactionRAF=0;if(state.drag?.kind==='draw'||bufferedPenItems.length)return;if(eraserPreview?.hasWork()){const ctx=$('pageCanvas').getContext('2d');if(ctx){ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);eraserPreview.paint(ctx,clipboardContext());}else eraserPreview.beforeRender();}if(state.drag?.kind==='erase'){const ctx=inkContext(),old=state.eraseCursorBounds;if(old)ctx.clearRect(old.x,old.y,old.w,old.h);drawSelection(ctx);const point=state.drag.points.at(-1),r=state.drag.radius+handleSize()+2;if(point)state.eraseCursorBounds={x:point.x-r,y:point.y-r,w:2*r,h:2*r};}else{clearInk();drawSelection(inkContext());}if(eraserPreview?.hasWork())queueInteractionOverlay();});}
  function drawInteractionOverlay(ctx){
    const d=state.drag,group=activeGroup();let box=null;
    if(d?.kind==='erase'){
      const p=d.points.at(-1);if(!p)return true;ctx.save();ctx.strokeStyle='#ed728b';ctx.fillStyle='#ed728b22';ctx.lineWidth=Math.max(1,handleSize()*.2);ctx.beginPath();ctx.arc(p.x,p.y,d.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();return true;
    }
    if(d?.kind==='area')box=interactions.rect(d.start,d.end);
    else if(group){box={...group.bounds};if(d?.kind==='areaMove'){box.x+=d.dx;box.y+=d.dy;ctx.save();ctx.globalAlpha=.8;if(group.bitmap)ctx.drawImage(group.bitmap,box.x-8/group.scale,box.y-8/group.scale,group.bitmap.width/group.scale,group.bitmap.height/group.scale);ctx.restore();}}
    if(!box)return false;ctx.save();ctx.strokeStyle='#6557ed';ctx.fillStyle='#6557ed0b';ctx.lineWidth=Math.max(1,handleSize()*.18);ctx.setLineDash([7,5]);ctx.fillRect(box.x,box.y,box.w,box.h);ctx.strokeRect(box.x-3,box.y-3,box.w+6,box.h+6);ctx.restore();return true;
  }
  function eraserPreviewKey(){return {scope:clipboardContext(),revision:state.erasePreviewRevision||0,width:W,height:H,inkOnly:state.eraserInkOnly};}
  function prepareEraserPreview(explicit=false){
    clearTimeout(eraserPrepareTimer);if(!eraserPreview||state.tool!=='eraser'||!page()||$('editorView').hidden)return false;
    if(state.drag||state.pinch||state.editingText||imageCropSession||globalThis.WindsText?.isOpen()||(!explicit&&inputBusy()))return false;
    const p=page();if(p.background&&!pdfImage(p.background.src).ready)return false;
    if(state.eraserInkOnly&&p.items.some(item=>item.type==='image'&&!imageCache.get(item.src)?.complete))return false;
    return eraserPreview.prepare(eraserPreviewKey(),p.items,ctx=>{drawTemplate(ctx,p.background?'blank':p.template||'ruled',pageDimensions(p));drawPdfBackground(ctx,p);if(state.eraserInkOnly)for(const item of p.items)if(item.type!=='stroke')drawItem(ctx,item);});
  }
  function queueEraserPreparation(wait=0){
    if(!eraserPreview||state.tool!=='eraser'||!page()||$('editorView').hidden||eraserPreview.ready(eraserPreviewKey()))return;
    clearTimeout(eraserPrepareTimer);eraserPrepareTimer=setTimeout(()=>{if(state.pendingInteractions||inputBusy()){queueEraserPreparation(100);return;}prepareEraserPreview();},wait);
  }
  function initEraserPreview(){
    if(!window.WindsEraserPreview)return;eraserPreview=window.WindsEraserPreview.create({makeCanvas:()=>document.createElement('canvas'),bounds:itemBounds,visualBounds:clipboardBounds,localPoint:(item,point)=>CREATIVE.objectPoint(item,point,true)});
  }
  function commitDeferredItems(items,selection=null,eraserOnly=false){
    const target=page(),previous=target.items,selected=state.selected,group=groupSelection;
    composeInkNow();const h=historyForPage(),undo=h.undo.slice(),redo=h.redo;
    remember();
    try{
      target.items=items;state.selected=-1;groupSelection=null;
      if(selection)selectGroup(selection);
      renderCanvas();
    }catch(error){
      target.items=previous;state.selected=selected;groupSelection=group;h.undo=undo;h.redo=redo;updateHistoryButtons();
      try{renderCanvas();}catch{}
      throw error;
    }
    if(group?.bitmap&&group!==groupSelection)group.bitmap.width=group.bitmap.height=1;
    scheduleSave(false,eraserOnly);if(groupSelection)groupSelection.version=saveVersion;
    renderThumbs();
  }
  function deferInteraction(gesture){
    state.pendingInteractions++;
    interactionQueue=interactionQueue.then(async()=>{
      const transform=['select','resize'].includes(gesture.kind);
      if(transform){
        await delay(0);
        while(state.drag||state.pinch||state.editingText||imageCropSession||globalThis.WindsText?.isOpen()||(['pen','highlighter','artist','eraser'].includes(state.tool)&&inputBusy()))await delay(40);
      }else await interactionIdle();
      if(!clipboardMatches(gesture.scope))return;
      const p=page();
      if(gesture.cancelledPreview){eraserPreview?.complete(gesture);eraserPreview?.invalidate();renderCanvas();return;}
      if(gesture.kind==='area'){
        if(!['area','select'].includes(state.tool))return;
        if(gesture.epoch!==undefined&&gesture.epoch!==state.selectionEpoch)return;
        const bounds=interactions.rect(gesture.start,gesture.end),chosen=[];
        for(let i=0;i<p.items.length;i++){if(i&&i%40===0){await delay(0);await interactionIdle();if(!clipboardMatches(gesture.scope))return;}const item=p.items[i];if(item.type==='stroke'&&interactions.contains(bounds,clipboardBounds(item)))chosen.push(item);}
        if(chosen.length>100){toast('Select up to 100 strokes at a time.');return;}
        await interactionIdle();if(gesture.epoch!==undefined&&gesture.epoch!==state.selectionEpoch)return;composeInkNow();selectGroup(chosen);renderCanvas();toast(chosen.length?`${chosen.length} strokes selected · Drag inside the box to move`:'Draw a box around complete handwriting strokes');
      }else if(gesture.kind==='areaMove'){
        const originals=p.items.filter(item=>gesture.group.ids.has(item.id));if(!originals.length||Math.hypot(gesture.dx,gesture.dy)<1)return;
        const moved=interactions.translate(originals,gesture.dx,gesture.dy),byId=new Map(moved.map(i=>[i.id,i]));commitDeferredItems(p.items.map(i=>byId.get(i.id)||i),moved);
      }else if(transform){
        const index=p.items.findIndex(item=>item.id===gesture.original.id);if(index<0)return;
        const current=p.items[index];
        const next=gesture.kind==='resize'?resizeDragPreview({...gesture,original:current,bounds:selectionBounds(current)},gesture.point):interactions.translate([current],gesture.dx,gesture.dy)[0];
        if(gesture.kind==='select'&&Math.hypot(gesture.dx,gesture.dy)<.01)return;
        if(gesture.kind==='resize'&&['x','y','w','h','size'].every(key=>next[key]===current[key]))return;
        const selected=gesture.epoch===state.selectionEpoch?current.id:p.items[state.selected]?.id;
        if(state.selectionTransform===gesture)state.selectionTransform=null;
        commitDeferredItems(p.items.map((item,i)=>i===index?next:item));
        state.selected=p.items.findIndex(item=>item.id===selected);queueInteractionOverlay();updateSelectionActions();
      }else if(gesture.kind==='erase'){
        const edits=[];
        const unchanged=(a,b)=>Boolean(a&&b&&Object.keys(a).filter(k=>k!=='erasures').every(k=>a[k]===b[k])&&Object.keys(b).filter(k=>k!=='erasures').every(k=>a[k]===b[k]));
        for(let i=0;i<gesture.originals.length;i++){
          if(i&&i%20===0){await delay(0);await interactionIdle();if(!clipboardMatches(gesture.scope))return;}
          const item=gesture.originals[i];if(gesture.inkOnly&&item.type!=='stroke')continue;
          if(await interactions.eraseHitAsync(item,gesture.points,gesture.radius,clipboardBounds(item),item.tool==='artist'?CREATIVE.artistBoundsPadding(item):(item.size||1)*(item.tool==='highlighter'?2.5:.7),gesture.inkOnly,async()=>{await delay(0);await interactionIdle();if(!clipboardMatches(gesture.scope))throw Error('The page changed during erasing.');})){
            const current=p.items.find(it=>it.id===item.id);if(!unchanged(item,current))continue;
            const mask=CREATIVE.erasurePath(gesture.points,gesture.radius,itemBounds(current),point=>CREATIVE.objectPoint(current,point,true));
            if((current.erasures?.length||0)>=2048||(current.erasures||[]).reduce((n,m)=>n+m.points.length,0)+mask.points.length>200000)throw Error('This object has too many erased areas.');
            edits.push({original:item,mask});
          }
        }
        await interactionIdle();if(!clipboardMatches(gesture.scope))return;
        const byId=new Map();for(const {original,mask} of edits){const current=p.items.find(it=>it.id===original.id);if(unchanged(original,current))byId.set(current.id,{...current,erasures:[...(current.erasures||[]),mask]});}
        const previewPainted=eraserPreview?.complete(gesture);
        if(byId.size)commitDeferredItems(p.items.map(item=>byId.get(item.id)||item),null,true);else if(previewPainted){eraserPreview?.invalidate();renderCanvas();}else queueInteractionOverlay();
      }
    }).catch(error=>{const previewPainted=eraserPreview?.complete(gesture);if(previewPainted&&clipboardMatches(gesture.scope)){eraserPreview?.invalidate();try{renderCanvas();}catch{}}console.error('Deferred page edit:',error);toast(error.code==='CANVAS_MEMORY'?error.message:`Page edit failed: ${String(error.message||'Unknown drawing error').slice(0,150)}`);}).finally(()=>{eraserPreview?.complete(gesture);if(['select','resize'].includes(gesture.kind))endSelectionTransform(gesture);state.pendingInteractions--;queueInteractionOverlay();queueEraserPreparation();});
  }
  function initPageStack(){
    window.WindsPageStack.init({busy:()=>inputBusy()||Boolean(state.pendingInteractions)||$('editorView').hidden,scope:clipboardContext,matches:clipboardMatches,dimensions:pageDimensions,book:notebook,active:()=>page()?.id,zoom:()=>state.zoom,remove:deletePage,
      activate:(id,preserve)=>{const index=notebook()?.pages.findIndex(p=>p.id===id);if(index>=0){if(index!==state.pageIndex)switchPage(index,preserve);else if(!preserve)window.WindsPageStack.focus(id);}},
      paint:async(canvas,p,scope)=>{
        if(p.background)await pdfImage(p.background.src).promise;
        for(const item of p.items){if(item.type!=='image')continue;let image=imageCache.get(item.src);if(!image){image=new Image();image.src=item.src;imageCache.set(item.src,image);}if(!image.complete)try{await image.decode();}catch{}}
        await interactionIdle();if(!clipboardMatches(scope)||$('editorView').hidden)return;
        const d=pageDimensions(p);canvas.width=Math.round(Math.min(840,d.width));canvas.height=Math.round(canvas.width*d.height/d.width);const ctx=canvas.getContext('2d');ctx.setTransform(canvas.width/d.width,0,0,canvas.height/d.height,0,0);drawPage(ctx,p);
      }});
  }

  let clipboardPlacement=null;
  function clipboardContext(){return {account:workspaceId,book:state.activeId,page:page()?.id};}
  function clipboardMatches(scope){return scope.account===workspaceId&&scope.book===state.activeId&&scope.page===page()?.id;}
  function clipboardEnabled(){return Boolean(page()&&!$('editorView').hidden&&!state.drag&&!state.pinch&&!state.editingText&&!state.pendingInteractions&&!imageCropSession&&!globalThis.WindsText?.isOpen()&&!globalThis.WindsPDFImport?.isOpen()&&$('pageReader').hidden&&$('sharedAccessBackdrop').hidden&&$('shareBackdrop').hidden&&$('cloudBackdrop').hidden&&$('modalBackdrop').hidden);}
  async function clipboardWait(scope){
    while(true){if(!clipboardMatches(scope))throw Error('The account or page changed. Paste again on the intended page.');
      if(!state.drag&&!state.pinch&&!state.editingText&&!state.pendingInteractions&&!imageCropSession&&!globalThis.WindsText?.isOpen()&&Date.now()-state.lastPenAt>=150)return;await delay(100);}
  }
  function clipboardBounds(item){
    const b=selectionBounds(item);if(!CREATIVE.objectRotation(item))return b;
    const corners=[[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]].map(([x,y])=>CREATIVE.objectPoint(item,{x,y}));
    const x=Math.min(...corners.map(p=>p.x)),y=Math.min(...corners.map(p=>p.y));return {x,y,w:Math.max(...corners.map(p=>p.x))-x,h:Math.max(...corners.map(p=>p.y))-y};
  }
  async function clipboardImage(file,scope){
    if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>25*1024*1024)throw Error('Paste a PNG, JPEG, WebP or GIF image under 25 MB.');
    const url=URL.createObjectURL(file),image=new Image();
    try{image.src=url;await image.decode();await clipboardWait(scope);if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>100000000)throw Error('This image is too large to paste.');
      const scale=Math.min(1,1500/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const src=canvas.toDataURL(file.type==='image/jpeg'?'image/jpeg':'image/png',.9),ratio=Math.min(1,650/image.naturalWidth,900/image.naturalHeight),item={type:'image',x:0,y:0,w:image.naturalWidth*ratio,h:image.naturalHeight*ratio,src};canvas.width=canvas.height=1;
      const cached=new Image();cached.src=src;await cached.decode();if(!clipboardMatches(scope))throw Error('The account or page changed.');imageCache.set(src,cached);return item;
    }finally{URL.revokeObjectURL(url);}
  }
  async function clipboardPng(snapshot){
    await clipboardWait(snapshot.scope);const items=snapshot.items||[snapshot.item];
    for(const item of items)if(item.type==='image'){
      let image=imageCache.get(item.src);if(!image){image=new Image();image.src=item.src;await image.decode();imageCache.set(item.src,image);}else if(!image.complete)await image.decode();
    }
    await clipboardWait(snapshot.scope);const b=interactions.union(items.map(clipboardBounds)),padding=8,scale=Math.min(2,2048/(b.w+padding*2),2048/(b.h+padding*2)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.ceil((b.w+padding*2)*scale));canvas.height=Math.max(1,Math.ceil((b.h+padding*2)*scale));const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.translate(padding-b.x,padding-b.y);for(const item of items)drawItem(ctx,item);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));canvas.width=canvas.height=1;if(!blob)throw Error('Could not copy the selected image.');return blob;
  }
  function insertClipboardItems(items,scope){
    if(!clipboardMatches(scope)||!clipboardEnabled())throw Error('The page changed or writing resumed. Paste again when idle.');
    const bounds=items.map(clipboardBounds),left=Math.min(...bounds.map(b=>b.x)),top=Math.min(...bounds.map(b=>b.y)),width=Math.max(...bounds.map(b=>b.x+b.w))-left,height=Math.max(...bounds.map(b=>b.y+b.h))-top;
    const rect=$('pageCanvas').getBoundingClientRect(),viewport=$('pageScroller').getBoundingClientRect();
    const step=clipboardPlacement?.page===scope.page?(clipboardPlacement.step+1)%6:0;clipboardPlacement={page:scope.page,step};const offset=step*24;
    const x=Math.max(16,Math.min(W-width-16,(viewport.left+viewport.width*.5-rect.left)/rect.width*W-width/2+offset)),y=Math.max(16,Math.min(H-height-16,(viewport.top+viewport.height*.35-rect.top)/rect.height*H+offset));
    const pasted=window.WindsClipboard.moveItems(items,x-left,y-top,uid);remember();page().items.push(...pasted);setTool('select');state.selected=page().items.length-1;scheduleSave();if(pasted.length>1)selectGroup(pasted);renderCanvas();renderThumbs();
    for(const item of pasted)window.WindsLive?.append(notebook().id,page().id,item);
  }
  function initClipboard(){
    window.WindsClipboard.init({context:clipboardContext,matches:clipboardMatches,enabled:clipboardEnabled,wait:clipboardWait,
      capture:()=>{const originals=selectionItems();return originals.length?{scope:clipboardContext(),version:saveVersion,originals,original:originals[0],items:clone(originals),item:clone(originals[0])}:null;},
      remove:snapshot=>{if(!clipboardMatches(snapshot.scope)||snapshot.version!==saveVersion||!clipboardEnabled()||!snapshot.originals.every(item=>page().items.includes(item)))return false;remember();const originals=new Set(snapshot.originals);page().items=page().items.filter(item=>!originals.has(item));state.selected=-1;groupSelection=null;renderCanvas();renderThumbs();scheduleSave();return true;},
      png:clipboardPng,imageItem:clipboardImage,textItem:text=>({type:'text',x:0,y:0,w:Math.min(500,W-56),...textDefaults(),color:state.color,text}),insert:insertClipboardItems,toast});
  }
  let pageReaderObserver=null,pageReaderSession=0;
  function closePageReader(){
    pageReaderSession++;pageReaderObserver?.disconnect();pageReaderObserver=null;
    $('pageReader').hidden=true;$('pageReaderList').replaceChildren();
  }
  function openPageReader(){
    cancelBoundaryFill(true);
    const book=notebook();if(!book)return;
    finishActiveStroke();composeInkNow();commitText();closeMenus();saveNow(true);
    closePageReader();const session=pageReaderSession,account=workspaceId,list=$('pageReaderList');
    $('pageReader').hidden=false;
    const valid=()=>session===pageReaderSession&&account===workspaceId;
    const pending=new Set();let painting=false;
    async function paintVisible(){
      if(painting)return;painting=true;
      try{for(const card of pending){
        pending.delete(card);if(!valid())break;if(card.dataset.visible!=='true')continue;
        const p=book.pages[Number(card.dataset.index)];
        if(p.background)await pdfImage(p.background.src).promise;
        for(const item of p.items.filter(i=>i.type==='image')){
          let image=imageCache.get(item.src);
          if(!image){image=new Image();imageCache.set(item.src,image);image.src=item.src;}
          if(!image.complete)await new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});});
        }
        if(!valid()||card.dataset.visible!=='true')continue;
        const c=card.querySelector('canvas'),d=pageDimensions(p);c.width=Math.round(Math.min(840,d.width));c.height=Math.round(c.width*d.height/d.width);
        const ctx=c.getContext('2d');ctx.setTransform(c.width/d.width,0,0,c.height/d.height,0,0);drawPage(ctx,p);
        await delay(0);
      }}catch(error){console.error('Page preview:',error);toast('A page preview could not be loaded');}
      finally{painting=false;}
    }
    pageReaderObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){const card=entry.target;card.dataset.visible=String(entry.isIntersecting);
        if(entry.isIntersecting)pending.add(card);else{pending.delete(card);const c=card.querySelector('canvas');c.width=c.height=1;}}
      paintVisible();
    },{root:list,rootMargin:'150px'});
    book.pages.forEach((p,index)=>{
      const card=document.createElement('section');card.className='reader-page';card.dataset.index=index;
      const label=document.createElement('button');label.className='btn btn-outline';label.textContent=`Page ${index+1} · Write on this page`;
      label.onclick=()=>{if(!valid())return;const target=notebook()?.pages.findIndex(current=>current.id===p.id);closePageReader();if(target>=0)switchPage(target);else toast('This page changed while reading. Reopen the notebook to see its latest pages.');$('moreOptionsBtn').focus();};
      const canvas=document.createElement('canvas'),d=pageDimensions(p);canvas.width=canvas.height=1;canvas.style.aspectRatio=`${d.width} / ${d.height}`;canvas.setAttribute('aria-label',`Preview of page ${index+1}`);
      card.append(label,canvas);list.append(card);pageReaderObserver.observe(card);
    });
    $('closePageReader').onclick=()=>{closePageReader();$('moreOptionsBtn').focus();};
    $('pageReader').onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();$('closePageReader').click();}
      if(event.key==='Tab'){const buttons=[...$('pageReader').querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};
    list.scrollTop=0;$('closePageReader').focus();
  }
  function registerOfflineShell(){
    if(!('serviceWorker'in navigator)||!location.protocol.startsWith('http'))return;
    const register=()=>navigator.serviceWorker.register('./sw.js').catch(()=>{});
    if(document.readyState==='complete')register();
    else window.addEventListener('load',register,{once:true});
  }
  function showStartupError(error){
    console.error('Opening notebooks:',error);
    statusText('Saved notes could not be opened',true);
    const dialog=document.createElement('dialog');
    dialog.className='startup-recovery';
    dialog.setAttribute('aria-labelledby','startupRecoveryTitle');
    dialog.setAttribute('aria-describedby','startupRecoveryMessage');
    const title=document.createElement('h2');title.id='startupRecoveryTitle';title.textContent='Your notes could not be opened';
    const message=document.createElement('p');message.id='startupRecoveryMessage';
    message.textContent='Your saved notes have not been replaced. Close other WiNDS Notes tabs, then reload to try again. Keep this browser’s website data so your notebooks remain available for recovery.';
    const retry=document.createElement('button');retry.type='button';retry.className='btn btn-primary';retry.textContent='Reload and try again';retry.onclick=()=>location.reload();
    dialog.addEventListener('cancel',event=>event.preventDefault());
    dialog.append(title,message,retry);document.body.append(dialog);dialog.showModal();retry.focus();
  }
  async function boot(){
    restoreInputPreferences();restoreEraserPreferences();initEraserPreview();initPageStack();initIcons();bind();setColor(COLORS[0]);updateSize();syncFillControls();
    await storageOpen();const stored=await loadData();
    if(stored && Array.isArray(stored.notebooks)){state.notebooks=stored.notebooks;tombstones=stored.deleted||{};}
    else{const legacy=await oldDatabase();if(legacy&&Array.isArray(legacy.notebooks)){state.notebooks=legacy.notebooks;toast('Your existing notebooks have been imported');}else seed();dirtyAll=true;saveVersion++;await saveNow(true);}
    initializeSyncHistory();
    renderLibrary();view('library');window.WindsText.init({apply:applyEditedText});initClipboard();
    resumeLastNotebook();
    globalThis.WindsMandala?.init({
      context:()=>({workspace:workspaceId,bookId:state.activeId,pageId:page()?.id,version:saveVersion}),
      prepare:async()=>{cancelBoundaryFill(true);closeMenus();finishActiveStroke();composeInkNow();commitText();while(state.pendingInteractions)await delay(80);},
      commit:createMandalaPage,toast
    });
    window.WindsPDFImport.init({context:()=>({workspace:workspaceId,bookId:state.activeId,bookTitle:notebook()?.title||''}),
      prepare:async()=>{cancelBoundaryFill();finishActiveStroke();composeInkNow();commitText();await saveNow(true);},commit:commitPdfPages,toast});
    window.WindsDrive?.init({
      getData:workspaceSnapshot,
      switchWorkspace,
      mergeWorkspace,
      isWriting:()=>Boolean(state.drag||state.pinch||state.editingText||state.pendingInteractions||imageCropSession||globalThis.WindsText?.isOpen()||Date.now()-lastInkAt<CLOUD_IDLE_MS),
      isDrawingNow:()=>Boolean(state.drag||state.pinch),
      isEditing:()=>Boolean(globalThis.WindsMandala?.isOpen()||globalThis.WindsBoundaryFill?.isActive()||state.editingText||state.pendingInteractions||imageCropSession||globalThis.WindsText?.isOpen()||globalThis.WindsPDFImport?.isOpen()),
      isSaving:()=>saving,
      syncIdleDelay:cloudSyncDelay,
      prepareNavigation,
      sharing:{copyForSharing:copyNotebookForSharing,notebooks:()=>state.notebooks,activeId:()=>state.activeId,version:()=>saveVersion,putShared:putSharedNotebook,deleted:id=>Boolean(tombstones[id])&&!state.notebooks.some(n=>n.id===id),openNotebook,toast},
      live:{busy:idle=>Boolean(globalThis.WindsMandala?.isOpen()||globalThis.WindsBoundaryFill?.isActive()||state.drag||state.pinch||state.editingText||state.pendingInteractions||imageCropSession||globalThis.WindsText?.isOpen()||globalThis.WindsPDFImport?.isOpen()||Date.now()-lastInkAt<idle),
        room:id=>{const n=state.notebooks.find(book=>book.id===id);return n?(n._sharing?'shared:'+n._sharing.folderId:'account'):null;},
        rooms:()=>[...new Set([notebook(),...state.notebooks].filter(n=>n?._sharing).map(n=>'shared:'+n._sharing.folderId))],
        paint:items=>{livePreviewItems=items;if(!livePreviewRAF)livePreviewRAF=requestAnimationFrame(paintLiveLayer);},clear:clearLiveLayer},
      importData:async text=>{
        const account=workspaceId;
        if(text.length>window.WindsFile.MAX_FILE_BYTES)throw Error('Backup file is too large');
        const parsed=window.WindsFile.parse(text);
        finishActiveStroke();commitText();
        state.notebooks.push(...parsed.notebooks);
        dirtyAll=true;saveVersion++;
        await saveNow(true);
        if(account!==workspaceId)throw new Error('The account changed after saving. Open the original account to find the imported notebooks.');
        $('searchNotebooks').value='';view('library');state.activeId=null;renderLibrary();
        return parsed.notebooks.length;
      },toast
    });
    registerOfflineShell();
  }
  const unlockStartup=lockInterface();
  boot().then(unlockStartup).catch(error=>{unlockStartup();showStartupError(error);});
})();
