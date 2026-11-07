/* Per-notebook Drive sharing. The private workspace file is never shared. */
(function(global){
  'use strict';
  const API='https://www.googleapis.com/drive/v3/files',UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
  const LIMIT=100*1024*1024,MODEL=global.WindsSharedModel,$=id=>document.getElementById(id);
  const EDIT_PREFIX='WiNDS Notes edit v1\n',PART_SIZE=3000,MAX_PARTS=Math.ceil(LIMIT/PART_SIZE);
  const REVISION_RECHECK_MS=15000,REVISION_CLEANUP_THRESHOLD=24;
  const FOLDER='application/vnd.google-apps.folder';
  const validFile=id=>typeof id==='string'&&/^[\w-]{5,200}$/.test(id);
  const seedParent=file=>!file.trashed&&file.appProperties?.windsNotesSharedSeed==='1'&&file.parents?.length===1&&validFile(file.parents[0])?file.parents[0]:null;
  const uuid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  let api=null,selected=null,context=-1,discovered=0,pendingLink='',busy=false,backgroundCursor=0;
  let pendingDiscoveries=[],accessRecovery=null;
  const cache=new Map(),failures=new Map();
  function deferred(){const error=Error('Writing resumed. Sharing will continue when idle.');error.syncDeferred=true;return error;}
  function status(text,error=false){$('shareStatus').textContent=text;$('shareStatus').classList.toggle('error',error);}
  function link(id){const url=new URL(global.location.pathname,global.location.origin);url.searchParams.set('shared',id);return url.href;}
  function readLink(text){try{const url=new URL(text);return url.searchParams.get('shared')||(url.hostname==='drive.google.com'?url.pathname.match(/\/folders\/([\w-]+)/)?.[1]||'':'');}catch{return validFile(text)?text:'';}}
  function session(){const current=api.session();if(!current.profile)throw Error('Sign in to Google Drive first.');return current;}
  function reset(s){if(context!==s.version){cache.clear();failures.clear();context=s.version;discovered=0;backgroundCursor=0;pendingDiscoveries=[];}}
  function check(s,manual=false){api.check(s,manual);reset(s);}
  async function request(url,options,s,manual=false){
    const target=new URL(url);target.searchParams.set('supportsAllDrives','true');
    try{return await api.request(target.href,options,s,manual);}catch(error){error.resourceId=target.pathname.match(/\/files\/([\w-]+)/)?.[1]||'';throw error;}
  }
  async function json(url,options,s,manual=false){const response=await request(url,options,s,manual);return api.read(response,s,manual);}
  async function content(id,s,manual=false){
    return readContent(`${API}/${encodeURIComponent(id)}?alt=media`,s,manual);
  }
  async function readContent(url,s,manual){
    const response=await request(url,{},s,manual);
    if(Number(response.headers.get('content-length')||0)>LIMIT)throw Error('Shared notebook data exceeds the 100 MB limit.');
    const text=api.text?await api.text(response,s,manual):await response.text();check(s,manual);
    if(text.length>LIMIT)throw Error('Shared notebook data exceeds the 100 MB limit.');
    return JSON.parse(text);
  }
  async function list(q,s,manual=false){
    const files=[];let page='';
    do{
      const params=new URLSearchParams({q,fields:'nextPageToken,files(id,name,mimeType,createdTime,appProperties)',pageSize:'1000',orderBy:'createdTime asc',includeItemsFromAllDrives:'true'});
      if(page)params.set('pageToken',page);
      const data=await json(`${API}?${params}`,{},s,manual);files.push(...(data.files||[]));page=data.nextPageToken||'';
      if(files.length>10000)throw Error('This shared notebook has too much history to load safely. Export a copy before continuing.');
    }while(page);
    return files;
  }
  async function listSharedFolders(s,manual=false){
    const files=await list(`trashed = false and mimeType = '${FOLDER}' and appProperties has {key='windsNotesShared' and value='1'}`,s,manual);
    return files.filter(file=>validFile(file.id)&&file.mimeType===FOLDER&&file.appProperties?.windsNotesShared==='1');
  }
  async function upload(name,data,parent,properties,s,manual=false){
    check(s,manual);const body=new Blob([JSON.stringify(data)],{type:'application/json'});
    if(body.size>LIMIT)throw Error('This shared notebook exceeds the 100 MB limit.');
    const metadata={name,mimeType:'application/json',parents:[parent],appProperties:properties};
    let response;
    if(body.size<=5*1024*1024){
      const boundary='winds_'+uuid();
      const multipart=new Blob([`--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,body,`\r\n--${boundary}--\r\n`]);
      response=await request(`${UPLOAD}?uploadType=multipart&fields=id`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body:multipart},s,manual);
    }else{
      const start=await request(`${UPLOAD}?uploadType=resumable&fields=id`,{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(body.size)},body:JSON.stringify(metadata)},s,manual);
      const target=start.headers.get('Location');if(!target?.startsWith('https://www.googleapis.com/'))throw Error('Invalid Drive upload URL.');
      response=await request(target,{method:'PUT',headers:{'Content-Type':'application/json'},body},s,manual);
    }
    return api.read(response,s,manual);
  }
  async function writeSharedFile(entry,s,manual){
    check(s,manual);
    const body=new Blob([JSON.stringify({
      format:'winds-shared-notebook',version:1,notebook:entry.seed,
      syncVersion:1,edits:[...entry.batches.values()]
    })],{type:'application/json'});
    if(body.size>LIMIT)throw Error('This shared notebook exceeds the 100 MB limit.');
    const target=`${UPLOAD}/${entry.seedId}`,query='keepRevisionForever=true&fields=id,headRevisionId';
    if(body.size<=5*1024*1024){
      await request(`${target}?uploadType=media&${query}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body},s,manual);
      return;
    }
    const start=await request(`${target}?uploadType=resumable&${query}`,{method:'PATCH',
      headers:{'X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(body.size)}},s,manual);
    const location=start.headers.get('Location');
    if(!location?.startsWith('https://www.googleapis.com/'))throw Error('Invalid Drive upload URL.');
    await request(location,{method:'PUT',headers:{'Content-Type':'application/json'},body},s,manual);
  }
  async function fileInfo(id,s,manual){
    if(!validFile(id))throw Error('Invalid shared notebook link.');
    const params=new URLSearchParams({fields:'id,name,mimeType,trashed,parents,appProperties,capabilities(canEdit,canShare)'});
    return json(`${API}/${id}?${params}`,{},s,manual);
  }
  async function folder(id,s,manual){
    const data=await fileInfo(id,s,manual);
    if(data.trashed||data.mimeType!==FOLDER||!(data.appProperties?.windsNotesShared==='1'||(data.appProperties?.windsNotesShared==='pending'&&data.capabilities?.canShare)))throw Error('Choose a WiNDS shared notebook folder or its Notebook.json file.');
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
  async function load(id,s,manual=false,seedId){
    check(s,manual);
    if(cache.has(id))return cache.get(id);
    await folder(id,s,manual);
    const files=await list(`'${id}' in parents and trashed = false`,s,manual);
    let seedFile=files.find(file=>file.appProperties?.windsNotesSharedSeed==='1');
    if(!seedFile&&validFile(seedId)){
      const file=await fileInfo(seedId,s,manual);
      if(seedParent(file)===id)seedFile=file;
    }
    if(!seedFile)throw Object.assign(Error('Choose Notebook.json inside this shared folder.'),{needsSeed:true});
    const entry={seedId:seedFile.id,seed:null,batches:new Map(),
      head:null,revisions:new Map(),revisionCheck:0,
      journal:{complete:new Set(),partial:new Map(),characters:0,cursor:0}};
    await refreshSharedFile(entry,s,manual);
    await readEdits(entry,files,s,manual);
    // Recover edits already written by v54. New sync never writes comments.
    try{await readJournal(entry,s,manual);}catch(error){if(!deniedAccess(error))throw error;}
    cache.set(id,entry);return entry;
  }
  function rememberBatch(entry,batch){
    const previous=entry.batches.get(batch.id);
    if(previous&&!MODEL.sameValue(previous,batch))throw Error('Conflicting shared edit identifiers. Your local changes are retained.');
    entry.batches.set(batch.id,batch);
    if(entry.batches.size>10000)throw Error('Shared history exceeds the safe replay limit. Export a copy and start a new shared notebook.');
  }
  function readSnapshot(entry,data){
    if(data?.format!=='winds-shared-notebook'||data.version!==1)throw Error('Invalid shared notebook.');
    if(data.syncVersion!==undefined&&data.syncVersion!==1)throw Error('Update WiNDS Notes to open this version of the shared notebook.');
    const seed=global.WindsFile.validateShared(data.notebook);
    if(entry.seed&&!MODEL.sameValue(entry.seed,seed))throw Error('The shared notebook base changed in Drive. Local edits are retained.');
    entry.seed=seed;
    const ids=new Set(),managed=data.syncVersion===1;
    if(managed){
      if(!Array.isArray(data.edits)||data.edits.length>10000)throw Error('Invalid shared notebook edit history.');
      for(const edit of data.edits){
        const batch=MODEL.validateBatch(edit);
        rememberBatch(entry,batch);
        ids.add(batch.id);
      }
    }
    return {managed,ids};
  }
  async function listPinnedRevisions(url,s,manual){
    const pinned=[];
    let page='',pages=0;
    do{
      const params=new URLSearchParams({fields:'nextPageToken,revisions(id,keepForever,modifiedTime)',pageSize:'100'});
      if(page)params.set('pageToken',page);
      const result=await json(`${url}?${params}`,{},s,manual);
      pinned.push(...(result.revisions||[]).filter(revision=>revision.keepForever));
      page=result.nextPageToken||'';
      if(++pages>50)throw Error('The shared notebook has too many Drive versions to check safely.');
    }while(page);
    return pinned;
  }
  async function refreshSharedFile(entry,s,manual){
    const url=`${API}/${entry.seedId}`,revisionsUrl=`${url}/revisions`;
    const meta=await json(`${url}?fields=headRevisionId,capabilities(canEdit)`,{},s,manual);
    if(!meta.capabilities?.canEdit)throw Error('This Google account needs Editor access to Notebook.json.');
    if(!meta.headRevisionId)throw Error('Google Drive did not return a version for Notebook.json.');
    const headChanged=entry.head?.id!==meta.headRevisionId;
    if(!headChanged&&Date.now()-entry.revisionCheck<REVISION_RECHECK_MS)return;
    entry.revisionCheck=0;
    const pinned=await listPinnedRevisions(revisionsUrl,s,manual);
    const headRevision=pinned.find(revision=>revision.id===meta.headRevisionId);
    if(headChanged){
      const data=headRevision
        ?await readContent(`${revisionsUrl}/${encodeURIComponent(headRevision.id)}?alt=media`,s,manual)
        :await content(entry.seedId,s,manual);
      entry.head={id:meta.headRevisionId,...readSnapshot(entry,data)};
    }
    const visible=new Set(pinned.map(revision=>revision.id));
    for(const id of entry.revisions.keys())if(!visible.has(id))entry.revisions.delete(id);
    for(const revision of pinned){
      if(entry.revisions.has(revision.id))continue;
      let snapshot;
      try{
        snapshot=revision.id===entry.head.id&&headChanged?entry.head
          :readSnapshot(entry,await readContent(`${revisionsUrl}/${encodeURIComponent(revision.id)}?alt=media`,s,manual));
      }catch(error){
        if(error.status===404&&revision.id!==entry.head.id)continue;
        throw error;
      }
      entry.revisions.set(revision.id,{...snapshot,modifiedTime:Date.parse(revision.modifiedTime)});
    }
    entry.revisionCheck=Date.now();
  }
  async function pruneCoveredRevisions(entry,s,manual){
    if(entry.revisions.size<REVISION_CLEANUP_THRESHOLD)return;
    const head=entry.revisions.get(entry.head.id);
    if(!head?.managed)return;
    let remaining=8;
    for(const [id,revision] of entry.revisions){
      // Only remove versions written by this app whose edits are all present
      // in a strictly newer pinned version of the same file.
      if(!revision.managed||!(revision.modifiedTime<head.modifiedTime)||![...revision.ids].every(edit=>head.ids.has(edit)))continue;
      try{
        await request(`${API}/${entry.seedId}/revisions/${encodeURIComponent(id)}`,{method:'DELETE'},s,manual);
      }catch(error){
        if(error.status===403)return;
        if(error.status!==404)throw error;
      }
      entry.revisions.delete(id);
      if(--remaining===0)break;
    }
  }
  async function readEdits(entry,files,s,manual){
    const seen=new Set();
    for(const file of files){
      if(file.appProperties?.windsNotesSharedEdit!=='1'||seen.has(file.id))continue;
      const batch=MODEL.validateBatch(await content(file.id,s,manual));
      rememberBatch(entry,batch);seen.add(file.id);
    }
  }
  function acceptJournalPart(entry,part){
    const {id,index,total,data}=part||{},journal=entry.journal;
    if(typeof id!=='string'||!id||id.length>200||journal.complete.has(id)||
      !Number.isInteger(total)||total<1||total>MAX_PARTS||!Number.isInteger(index)||index<0||index>=total||
      typeof data!=='string'||!data.length||data.length>PART_SIZE)return;
    let batch=journal.partial.get(id);
    if(!batch){
      batch={total,parts:new Map(),characters:0};
      journal.partial.set(id,batch);
    }
    const previous=batch.parts.get(index);
    if(batch.total!==total||(previous!==undefined&&previous!==data))throw Error('Conflicting parts in the shared edit log.');
    if(previous!==undefined)return;
    journal.characters+=data.length;batch.characters+=data.length;
    if(journal.characters>LIMIT)throw Error('The shared edit log exceeds the safe replay limit.');
    batch.parts.set(index,data);
    if(batch.parts.size!==total)return;
    const edit=MODEL.validateBatch(JSON.parse(Array.from({length:total},(_,i)=>batch.parts.get(i)).join('')));
    if(edit.id!==id)throw Error('Invalid shared edit log identifier.');
    rememberBatch(entry,edit);
    journal.complete.add(id);journal.partial.delete(id);journal.characters-=batch.characters;
  }
  async function readJournal(entry,s,manual){
    const journal=entry.journal,url=`${API}/${entry.seedId}/comments`;
    let page='',newest=journal.cursor,count=0;
    do{
      const params=new URLSearchParams({fields:'nextPageToken,comments(content,modifiedTime)',pageSize:'100'});
      if(journal.cursor)params.set('startModifiedTime',new Date(Math.max(0,journal.cursor-60000)).toISOString());
      if(page)params.set('pageToken',page);
      const result=await json(`${url}?${params}`,{},s,manual);
      for(const comment of result.comments||[]){
        newest=Math.max(newest,Date.parse(comment.modifiedTime)||0);
        if(typeof comment.content!=='string'||!comment.content.startsWith(EDIT_PREFIX)||comment.content.length>PART_SIZE*6+500)continue;
        let part;
        try{part=JSON.parse(comment.content.slice(EDIT_PREFIX.length));}catch{continue;}
        acceptJournalPart(entry,part);
      }
      page=result.nextPageToken||'';
      if(++count>500)throw Error('The shared edit log has too many records to open safely.');
    }while(page);
    journal.cursor=newest;
  }
  async function join(id,s,manual=true,explicit=true,seedId){
    const entry=await load(id,s,manual,seedId);
    check(s,manual);
    const existing=api.bridge.notebooks().find(book=>book._sharing?.folderId===id);
    if(existing){if(explicit)api.bridge.openNotebook(existing.id);return existing;}
    const remote=MODEL.replay(entry.seed,entry.batches.values());
    if(!explicit&&api.bridge.deleted(remote.id))return null;
    const sharing={folderId:id,seedId:entry.seedId,baseline:MODEL.fingerprint(remote),pending:[]};
    await put(remote,sharing,api.bridge.version(),s,manual);api.received?.();
    if(explicit)api.bridge.openNotebook(remote.id);return remote;
  }
  async function synchronize(book,s,manual=false){
    check(s,manual);let version=api.bridge.version();
    const entry=await load(book._sharing.folderId,s,manual,book._sharing.seedId);
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
    await refreshSharedFile(entry,s,manual);
    for(const batch of sharing.pending||[])rememberBatch(entry,MODEL.validateBatch(batch));
    check(s,manual);if(version!==api.bridge.version())throw deferred();
    const merged=MODEL.replay(entry.seed,entry.batches.values());
    const missingEdits=[...entry.batches.keys()].some(id=>!entry.head.ids.has(id));
    if(missingEdits){
      await pruneCoveredRevisions(entry,s,manual);
      check(s,manual);if(version!==api.bridge.version())throw deferred();
      await writeSharedFile(entry,s,manual);
      entry.revisionCheck=0;
      check(s,manual);if(version!==api.bridge.version())throw deferred();
    }
    const published=Boolean(sharing.pending?.length);
    const nextSharing={...sharing,pending:[],baseline:MODEL.fingerprint(merged)};
    const received=JSON.stringify(clean)!==JSON.stringify(merged);
    if(received||published)await put(merged,nextSharing,version,s,manual);
    if(received)api.received?.();if(missingEdits)api.uploaded?.();
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
      const folders=await listSharedFolders(s,manual);
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
      try{await work(s);}catch(error){if(api.session().version===s.version&&selectedAtStart===selected){recoverAccess(error,api.bridge.notebooks().find(n=>n.id===selected)?._sharing?.folderId,s,()=>task(work));status(error.syncDeferred?'Finish writing, then try sharing again.':error.message||'Sharing failed. Your notebook remains saved locally.',true);}}
      finally{if(api.session().version===s.version){busy=false;$('shareSubmit').disabled=false;}}
    });
  }
  function deniedAccess(error){
    return error.status===404||(error.status===403&&['appNotAuthorizedToFile','insufficientFilePermissions'].includes(error.reason));
  }
  function recoverAccess(error,id,s,retry,authorizedId){
    if(!(error.needsSeed||deniedAccess(error))||!validFile(id))return false;
    if(api.session().version!==s.version)return false;
    const local=api.bridge.notebooks().find(n=>n.id===selected&&n._sharing?.folderId===id);
    const fileId=validFile(error.resourceId)?error.resourceId:id,resource=fileId===id?'shared folder':'notebook file inside the shared folder';
    accessRecovery={id,bookId:local?.id,fileId,needsSeed:error.needsSeed,s,retry};
    $('sharedAccessMessage').textContent=error.needsSeed?'WiNDS Notes can open the shared folder. Choose Notebook.json inside it to grant access to the notebook.':`WiNDS Notes could not read the ${resource} for ${s.profile.email}. If you can edit it in Google Drive, select it here to give WiNDS Notes access.`;
    $('sharedAccessAuthorize').textContent=error.needsSeed?'Choose Notebook.json':fileId===id?'Choose shared folder':'Choose notebook file';
    $('sharedAccessDrive').href=`https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
    $('sharedAccessCopy').hidden=!local||!api.bridge.copyForSharing;
    $('sharedAccessStatus').textContent=authorizedId===fileId&&!error.needsSeed?`Google Drive still denied access after selection (Drive ${error.status}). You can try again from My notebooks → Open shared from Drive.`:'';
    $('sharedAccessBackdrop').hidden=false;$('sharedAccessAuthorize').disabled=false;$('sharedAccessRetry').disabled=false;$('sharedAccessClose').focus();return true;
  }
  async function retryAccess(authorize){
    const recovery=accessRecovery;if(!recovery)return;
    $('sharedAccessAuthorize').disabled=true;$('sharedAccessRetry').disabled=true;
    try{
      if(api.session().version!==recovery.s.version)throw Error('The account changed. Reopen the invitation in the intended account.');
      let seedId;
      if(authorize){
        $('sharedAccessStatus').textContent='Opening Google Drive…';
        const granted=recovery.needsSeed?await api.pick(recovery.s,recovery.id):await api.authorize(recovery.fileId,recovery.s);
        if(accessRecovery!==recovery||api.session().version!==recovery.s.version)return;
        if(!granted){$('sharedAccessStatus').textContent='Authorization cancelled. Your notes are unchanged.';return;}
        if(recovery.needsSeed)seedId=granted;
      }
      if(accessRecovery!==recovery||api.session().version!==recovery.s.version)return;
      cache.delete(recovery.id);failures.delete(recovery.id);$('sharedAccessBackdrop').hidden=true;accessRecovery=null;
      recovery.retry(seedId,authorize?(seedId||recovery.fileId):null);
    }catch(error){if(accessRecovery===recovery)$('sharedAccessStatus').textContent=error.message;}
    finally{if(accessRecovery===recovery){$('sharedAccessAuthorize').disabled=false;$('sharedAccessRetry').disabled=false;}}
  }
  function reportOpenError(error,s){
    if(api.session().version===s.version)api.bridge.toast(error.syncDeferred?'Finish writing, then open the shared notebook again.':error.message);
  }
  async function afterPicker(work,s,authorizedId){
    try{return await work();}
    catch(error){
      // A fresh Picker grant may not be visible to the Drive API immediately.
      if(!authorizedId||!deniedAccess(error)||(error.resourceId&&error.resourceId!==authorizedId))throw error;
      await new Promise(resolve=>setTimeout(resolve,750));
      check(s,true);
      return work();
    }
  }
  async function openRequested(id,s,seedId,authorizedId=null){
    try{
      await afterPicker(()=>join(id,s,true,true,seedId),s,authorizedId);
      if(pendingLink===id){pendingLink='';sessionStorage.removeItem('winds-pending-shared-notebook');}
      failures.delete(id);
    }catch(error){
      const retry=(pickedSeed,pickedId)=>api.run(current=>{
        if(current.version===s.version)return openRequested(id,current,pickedSeed||seedId,pickedId);
      });
      if(!recoverAccess(error,id,s,retry,authorizedId))reportOpenError(error,s);
    }
  }
  function resume(){
    if(!pendingLink||!api.session().profile)return;
    const id=pendingLink;
    api.run(s=>openRequested(id,s));
  }
  async function openFromDrive(){
    const s=api.session(),button=$('openSharedFromDrive');
    if(button.disabled)return;
    if(!s.profile){api.signIn();return;}
    button.disabled=true;
    try{
      const fileId=await api.pick(s);
      if(!fileId||api.session().version!==s.version)return;
      api.run(async current=>{
        if(current.version!==s.version)return;
        try{
          const file=await afterPicker(()=>fileInfo(fileId,current,true),current,fileId);
          if(file.mimeType===FOLDER)return openRequested(fileId,current,undefined,fileId);
          const parent=seedParent(file);
          if(!parent)throw Error('Choose a WiNDS shared notebook folder or its Notebook.json file.');
          return openRequested(parent,current,fileId,fileId);
        }catch(error){reportOpenError(error,current);}
      });
    }catch(error){reportOpenError(error,s);}
    finally{if(api.session().version===s.version)button.disabled=false;}
  }
  function init(adapter){
    api=adapter;
    $('sharedAccessCopy').onclick=async()=>{const recovery=accessRecovery,id=recovery?.bookId;if(!recovery||!id)return;$('sharedAccessCopy').disabled=true;try{if(api.session().version!==recovery.s.version)throw Error('The account changed.');const copy=await api.bridge.copyForSharing(id);if(accessRecovery!==recovery||api.session().version!==recovery.s.version)return;$('sharedAccessClose').click();open(copy);status('Independent copy saved. Enter an email to send a new invitation. The previous shared notebook is retained.');}catch(error){if(accessRecovery===recovery)$('sharedAccessStatus').textContent=error.message;}finally{$('sharedAccessCopy').disabled=false;}};
    $('sharedAccessAuthorize').onclick=()=>retryAccess(true);$('sharedAccessRetry').onclick=()=>retryAccess(false);
    $('sharedAccessClose').onclick=()=>{api.cancelAuthorization?.();accessRecovery=null;$('sharedAccessBackdrop').hidden=true;};
    $('sharedAccessBackdrop').onkeydown=event=>{if(event.key==='Escape'){$('sharedAccessClose').click();event.preventDefault();}if(event.key==='Tab'){const controls=[...$('sharedAccessBackdrop').querySelectorAll('button,a')].filter(el=>!el.disabled&&!el.hidden),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};
    const fromUrl=new URL(global.location.href).searchParams.get('shared');
    pendingLink=validFile(fromUrl)?fromUrl:sessionStorage.getItem('winds-pending-shared-notebook')||'';
    if(pendingLink)sessionStorage.setItem('winds-pending-shared-notebook',pendingLink);
    $('shareClose').onclick=()=>{$('shareBackdrop').hidden=true;};
    $('shareBackdrop').addEventListener('click',e=>{if(e.target===$('shareBackdrop'))$('shareBackdrop').hidden=true;});
    $('shareForm').onsubmit=e=>{e.preventDefault();const email=$('shareEmail').value.trim(),id=selected;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status('Enter a valid Google account email.',true);return;}task(s=>invite(id,email,s));};
    $('shareCopyLink').onclick=async()=>{try{await navigator.clipboard.writeText($('shareLink').value);status('Notebook link copied. Only invited accounts can open it.');}catch{$('shareLink').select();status('Select and copy this notebook link.');}};
    $('openSharedNotebook').onclick=()=>{const value=prompt('Paste the WiNDS shared notebook link:');if(!value)return;const id=readLink(value.trim());if(!validFile(id)){api.bridge.toast('Choose a valid shared notebook link.');return;}pendingLink=id;sessionStorage.setItem('winds-pending-shared-notebook',id);if(!api.session().profile)api.signIn();else resume();};
    $('openSharedFromDrive').onclick=api.browse;
  }
  function cancel(){api?.cancelAuthorization?.();accessRecovery=null;if(api)$('sharedAccessBackdrop').hidden=true;cache.clear();failures.clear();selected=null;busy=false;context=-1;pendingDiscoveries=[];backgroundCursor=0;if(api){$('shareBackdrop').hidden=true;$('shareSubmit').disabled=false;$('openSharedFromDrive').disabled=false;}}
  global.WindsSharing=Object.freeze({
    init,open,sync,resume,cancel,
    listAvailable:s=>listSharedFolders(s,true),
    openListed:openRequested,
    pickFromDrive:openFromDrive
  });
})(window);
