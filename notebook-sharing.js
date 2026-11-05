/* Per-notebook Drive sharing. The private workspace file is never shared. */
(function(global){
  'use strict';
  const API='https://www.googleapis.com/drive/v3/files',UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
  const LIMIT=100*1024*1024,MODEL=global.WindsSharedModel,$=id=>document.getElementById(id);
  const validFile=id=>typeof id==='string'&&/^[\w-]{5,200}$/.test(id);
  const uuid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  let api=null,selected=null,context=-1,discovered=0,pendingLink='',busy=false,backgroundCursor=0;
  let pendingDiscoveries=[];
  const cache=new Map(),failures=new Map();
  function deferred(){const error=Error('Writing resumed. Sharing will continue when idle.');error.syncDeferred=true;return error;}
  function status(text,error=false){$('shareStatus').textContent=text;$('shareStatus').classList.toggle('error',error);}
  function link(id){const url=new URL(global.location.pathname,global.location.origin);url.searchParams.set('shared',id);return url.href;}
  function readLink(text){try{const url=new URL(text);return url.searchParams.get('shared')||'';}catch{return validFile(text)?text:'';}}
  function session(){const current=api.session();if(!current.profile)throw Error('Sign in to Google Drive first.');return current;}
  function reset(s){if(context!==s.version){cache.clear();failures.clear();context=s.version;discovered=0;backgroundCursor=0;pendingDiscoveries=[];}}
  function check(s,manual=false){api.check(s,manual);reset(s);}
  async function json(url,options,s,manual=false){const response=await api.request(url,options,s,manual);return api.read(response,s,manual);}
  async function content(id,s,manual=false){
    const response=await api.request(`${API}/${encodeURIComponent(id)}?alt=media`,{},s,manual);
    if(Number(response.headers.get('content-length')||0)>LIMIT)throw Error('Shared notebook data exceeds the 100 MB limit.');
    const text=await response.text();check(s,manual);
    if(text.length>LIMIT)throw Error('Shared notebook data exceeds the 100 MB limit.');
    return JSON.parse(text);
  }
  async function list(q,s,manual=false){
    const files=[];let page='';
    do{
      const params=new URLSearchParams({q,fields:'nextPageToken,files(id,name,mimeType,createdTime,appProperties)',pageSize:'1000',orderBy:'createdTime asc'});
      if(page)params.set('pageToken',page);
      const data=await json(`${API}?${params}`,{},s,manual);files.push(...(data.files||[]));page=data.nextPageToken||'';
      if(files.length>10000)throw Error('This shared notebook has too much history to load safely. Export a copy before continuing.');
    }while(page);
    return files;
  }
  async function upload(name,data,parent,properties,s,manual=false){
    check(s,manual);const body=new Blob([JSON.stringify(data)],{type:'application/json'});
    if(body.size>LIMIT)throw Error('This shared notebook exceeds the 100 MB limit.');
    const metadata={name,mimeType:'application/json',parents:[parent],appProperties:properties};
    let response;
    if(body.size<=5*1024*1024){
      const boundary='winds_'+uuid();
      const multipart=new Blob([`--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,body,`\r\n--${boundary}--\r\n`]);
      response=await api.request(`${UPLOAD}?uploadType=multipart&fields=id`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body:multipart},s,manual);
    }else{
      const start=await api.request(`${UPLOAD}?uploadType=resumable&fields=id`,{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(body.size)},body:JSON.stringify(metadata)},s,manual);
      const target=start.headers.get('Location');if(!target?.startsWith('https://www.googleapis.com/'))throw Error('Invalid Drive upload URL.');
      response=await api.request(target,{method:'PUT',headers:{'Content-Type':'application/json'},body},s,manual);
    }
    return api.read(response,s,manual);
  }
  async function folder(id,s,manual){
    if(!validFile(id))throw Error('Invalid shared notebook link.');
    const params=new URLSearchParams({fields:'id,name,mimeType,trashed,appProperties,capabilities(canEdit,canShare)'});
    const data=await json(`${API}/${id}?${params}`,{},s,manual);
    if(data.trashed||data.mimeType!=='application/vnd.google-apps.folder'||!(data.appProperties?.windsNotesShared==='1'||(data.appProperties?.windsNotesShared==='pending'&&data.capabilities?.canShare)))throw Error('This link is not a shared WiNDS notebook.');
    if(!data.capabilities?.canEdit)throw Error('This account needs editing access. Ask the owner to share the notebook with your signed-in Gmail.');
    return data;
  }
  async function put(book,sharing,version,s,manual,attach=false){
    check(s,manual);
    const saved=await api.bridge.putShared(book,sharing,version,attach,manual);
    check(s,manual);
    if(saved!==api.bridge.version())throw deferred();
    return saved;
  }
  async function load(id,s,manual=false){
    check(s,manual);
    if(cache.has(id))return cache.get(id);
    const info=await folder(id,s,manual);
    const files=await list(`'${id}' in parents and trashed = false`,s,manual);
    const seedFile=files.find(file=>file.appProperties?.windsNotesSharedSeed==='1');
    if(!seedFile)throw Error('The shared notebook is still being prepared. Try opening its link again shortly.');
    const seed=await content(seedFile.id,s,manual);
    if(seed.format!=='winds-shared-notebook'||seed.version!==1)throw Error('Invalid shared notebook.');
    const entry={folder:info,seedId:seedFile.id,seed:global.WindsFile.validateShared(seed.notebook),batches:new Map(),seen:new Set(),cursor:''};
    await readEdits(entry,files,s,manual);cache.set(id,entry);return entry;
  }
  async function readEdits(entry,files,s,manual){
    let cursor=entry.cursor;
    for(const file of files){
      if(file.createdTime>cursor)cursor=file.createdTime;
      if(file.appProperties?.windsNotesSharedEdit!=='1'||entry.seen.has(file.id))continue;
      const batch=MODEL.validateBatch(await content(file.id,s,manual));
      if(entry.batches.has(batch.id)&&JSON.stringify(entry.batches.get(batch.id))!==JSON.stringify(batch))throw Error('Conflicting shared edit identifiers. Your local changes are retained.');
      entry.batches.set(batch.id,batch);entry.seen.add(file.id);
      if(entry.batches.size>10000)throw Error('Shared history exceeds the safe replay limit. Export a copy and start a new shared notebook.');
    }
    entry.cursor=cursor;
  }
  async function join(id,s,manual=true,explicit=true){
    const entry=await load(id,s,manual),remote=MODEL.replay(entry.seed,entry.batches.values());
    const existing=api.bridge.notebooks().find(book=>book._sharing?.folderId===id);
    if(existing){if(explicit)api.bridge.openNotebook(existing.id);return existing;}
    if(!explicit&&api.bridge.deleted(remote.id))return null;
    const sharing={folderId:id,seedId:entry.seedId,baseline:MODEL.fingerprint(remote),pending:[]};
    await put(remote,sharing,api.bridge.version(),s,manual);api.received?.();
    if(explicit)api.bridge.openNotebook(remote.id);return remote;
  }
  async function synchronize(book,s,manual=false){
    check(s,manual);let version=api.bridge.version();
    const entry=await load(book._sharing.folderId,s,manual);
    const current=api.bridge.notebooks().find(n=>n.id===book.id);
    if(!current||version!==api.bridge.version())throw deferred();
    let sharing=MODEL.clone(current._sharing),clean=global.WindsFile.validateShared(current);
    if(!sharing.baseline)throw Error('This shared notebook has no saved edit baseline. Reopen its original sharing link.');
    const changes=MODEL.diff(clean,sharing.baseline);
    if(changes.length){
      sharing.pending=sharing.pending||[];
      sharing.pending.push({format:'winds-shared-edit',version:1,id:uuid(),at:new Date().toISOString(),changes});
      sharing.baseline=MODEL.fingerprint(clean);
      version=await put(clean,sharing,version,s,manual);
    }
    async function pull(){
      const cutoff=entry.cursor?new Date(Date.parse(entry.cursor)-60000).toISOString():'';
      const files=await list(`'${entry.folder.id}' in parents and trashed = false${cutoff?` and createdTime >= '${cutoff}'`:''}`,s,manual);
      await readEdits(entry,files,s,manual);
    }
    // Immutable edit files can be published before pulling other people's edits.
    // An uncertain prior reply is reconciled first so retries do not create files again.
    let pulled=false;
    if(entry.uncertainUpload){await pull();entry.uncertainUpload=false;pulled=true;}
    for(const batch of sharing.pending||[]){
      MODEL.validateBatch(batch);
      if(!entry.batches.has(batch.id)){
        entry.uncertainUpload=true;
        const uploaded=await upload(`Edit ${batch.id}.json`,batch,entry.folder.id,{windsNotesSharedEdit:'1'},s,manual);
        entry.seen.add(uploaded.id);entry.batches.set(batch.id,batch);entry.uncertainUpload=false;pulled=false;
      }
    }
    if(!pulled)await pull();
    check(s,manual);if(version!==api.bridge.version())throw deferred();
    const merged=MODEL.replay(entry.seed,entry.batches.values());
    const nextSharing={...sharing,pending:[],baseline:MODEL.fingerprint(merged)};
    const received=JSON.stringify(clean)!==JSON.stringify(merged);
    if(received||sharing.pending?.length)await put(merged,nextSharing,version,s,manual);
    if(received)api.received?.();if(sharing.pending?.length)api.uploaded?.();
  }
  async function sync(s,manual=false,{only=null,exclude=null,limit=Infinity}={}){
    check(s,manual);
    async function attempt(id,work){
      if(!manual&&(failures.get(id)||0)>Date.now())return;
      try{await work();failures.delete(id);}catch(error){
        if(error.syncDeferred)throw error;check(s,manual);
        failures.set(id,Date.now()+45000);api.bridge.toast('A shared notebook could not sync. Local edits are retained. '+error.message);
      }
    }
    if(only){
      const book=api.bridge.notebooks().find(n=>n.id===only&&validFile(n._sharing?.folderId));
      if(book)await attempt(book._sharing.folderId,()=>synchronize(book,s,manual));
      return;
    }
    if(Date.now()-discovered>60000)await attempt('discovery',async()=>{
      const folders=await list("trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has {key='windsNotesShared' and value='1'}",s,manual);
      const known=new Set(api.bridge.notebooks().map(n=>n._sharing?.folderId));
      pendingDiscoveries=[...new Set([...pendingDiscoveries,...folders.filter(item=>!known.has(item.id)).map(item=>item.id)])];
      discovered=Date.now();
    });
    // Automatic background work is bounded and rotates fairly. The open shared
    // notebook was already handled before the private workspace's critical path.
    let remaining=limit;
    while(pendingDiscoveries.length&&remaining>0){
      const id=pendingDiscoveries[0];await attempt(id,()=>join(id,s,manual,false));
      pendingDiscoveries.shift();remaining--;
    }
    const books=api.bridge.notebooks().filter(n=>n.id!==exclude&&validFile(n._sharing?.folderId));
    if(Number.isFinite(limit)){
      if(remaining>0&&books.length){const book=books[backgroundCursor++%books.length];await attempt(book._sharing.folderId,()=>synchronize(book,s,manual));}
    }else for(const book of books)await attempt(book._sharing.folderId,()=>synchronize(book,s,manual));
  }

  async function invite(id,email,s){
    check(s,true);let book=api.bridge.notebooks().find(n=>n.id===id);if(!book)throw Error('Notebook no longer exists.');
    if(!book._sharing){
      const clean=global.WindsFile.validateShared(book),version=api.bridge.version();
      const info=await json(API+'?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`${clean.title} — WiNDS shared notebook`,mimeType:'application/vnd.google-apps.folder',writersCanShare:false,appProperties:{windsNotesShared:'pending'}})},s,true);
      const seed=await upload('Notebook.json',{format:'winds-shared-notebook',version:1,notebook:clean},info.id,{windsNotesSharedSeed:'1'},s,true);
      if(version!==api.bridge.version())throw deferred();
      await put(clean,{folderId:info.id,seedId:seed.id,baseline:MODEL.fingerprint(clean),pending:[]},version,s,true,true);
      book=api.bridge.notebooks().find(n=>n.id===id);discovered=0;
    }
    await synchronize(book,s,true);
    const info=await folder(book._sharing.folderId,s,true);
    if(!info.capabilities.canShare)throw Error('Only the notebook owner can invite another account.');
    if(info.appProperties?.windsNotesShared==='pending')await json(`${API}/${info.id}?fields=id`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({appProperties:{windsNotesShared:'1'}})},s,true);
    const url=link(info.id);
    const params=new URLSearchParams({fields:'id',sendNotificationEmail:'true',emailMessage:`Open and edit this notebook in WiNDS Notes: ${url}`});
    await json(`${API}/${info.id}/permissions?${params}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'user',role:'writer',emailAddress:email})},s,true);
    check(s,true);$('shareLink').value=url;$('shareLinkControl').hidden=false;
    status(`Shared with ${email}. They can view and edit this notebook. Google sends the invitation and app link.`);
  }
  function open(id){
    const book=api.bridge.notebooks().find(n=>n.id===id);if(!book)return;
    selected=id;$('shareNotebookTitle').textContent=book.title;$('shareEmail').value='';$('shareLinkControl').hidden=!book._sharing;
    if(book._sharing)$('shareLink').value=link(book._sharing.folderId);
    status('Invite a Google account to view and edit this notebook. Your other notebooks stay private.');
    $('shareBackdrop').hidden=false;$('shareEmail').focus();
  }
  function task(work){
    if(busy)return;
    if(!api.session().profile){$('shareBackdrop').hidden=true;api.signIn();return;}
    status('Waiting for writing and the current Drive check to finish…');
    const selectedAtStart=selected,sessionAtStart=api.session().version;
    api.run(async s=>{
      if(s.version!==sessionAtStart||selectedAtStart!==selected||$('shareBackdrop').hidden)return;
      busy=true;$('shareSubmit').disabled=true;
      try{await work(s);}catch(error){if(api.session().version===s.version&&selectedAtStart===selected)status(error.syncDeferred?'Finish writing, then try sharing again.':error.message||'Sharing failed. Your notebook remains saved locally.',true);}
      finally{if(api.session().version===s.version){busy=false;$('shareSubmit').disabled=false;}}
    });
  }
  function resume(){
    if(!pendingLink||!api.session().profile)return;
    const id=pendingLink;
    api.run(async s=>{try{await join(id,s);pendingLink='';sessionStorage.removeItem('winds-pending-shared-notebook');}catch(error){api.bridge.toast(error.syncDeferred?'Finish writing, then open the shared notebook link again.':error.message);}});
  }
  function init(adapter){
    api=adapter;
    const fromUrl=new URL(global.location.href).searchParams.get('shared');
    pendingLink=validFile(fromUrl)?fromUrl:sessionStorage.getItem('winds-pending-shared-notebook')||'';
    if(pendingLink)sessionStorage.setItem('winds-pending-shared-notebook',pendingLink);
    $('shareClose').onclick=()=>{$('shareBackdrop').hidden=true;};
    $('shareBackdrop').addEventListener('click',e=>{if(e.target===$('shareBackdrop'))$('shareBackdrop').hidden=true;});
    $('shareForm').onsubmit=e=>{e.preventDefault();const email=$('shareEmail').value.trim(),id=selected;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status('Enter a valid Google account email.',true);return;}task(s=>invite(id,email,s));};
    $('shareCopyLink').onclick=async()=>{try{await navigator.clipboard.writeText($('shareLink').value);status('Notebook link copied. Only invited accounts can open it.');}catch{$('shareLink').select();status('Select and copy this notebook link.');}};
    $('openSharedNotebook').onclick=()=>{const value=prompt('Paste the WiNDS shared notebook link:');if(!value)return;const id=readLink(value.trim());if(!validFile(id)){api.bridge.toast('Choose a valid shared notebook link.');return;}pendingLink=id;sessionStorage.setItem('winds-pending-shared-notebook',id);if(!api.session().profile)api.signIn();else resume();};
  }
  function cancel(){cache.clear();failures.clear();selected=null;busy=false;context=-1;pendingDiscoveries=[];backgroundCursor=0;if(api){$('shareBackdrop').hidden=true;$('shareSubmit').disabled=false;}}
  global.WindsSharing=Object.freeze({init,open,sync,resume,cancel});
})(window);
