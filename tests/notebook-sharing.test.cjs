const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{randomUUID}=require('node:crypto');
const {sharingDrive}=require('./helpers/sharing-drive.cjs');
function book(id='physics',title='Physics'){return {id,title,cover:'purple',createdAt:'2026-11-04T10:00:00Z',updatedAt:'2026-11-04T10:00:00Z',pages:[{id:id+'-page',template:'ruled',orientation:'portrait',items:[]}]};}
const sharedFile=(drive,client)=>drive.files.get(client.notebooks[0]._sharing.seedId);
const stroke=id=>({id,type:'stroke',tool:'pen',color:'#123456',size:3,points:[[10,10,.4],[50,50,.8]]});
function client(drive,actor,notebooks=[]){
  const elements=new Map(),toasts=[],saves=[],opened=[];let version=0,generation=1,lastTask=null,writing=false;
  const el=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,textContent:'',disabled:false,classList:{toggle(){}},addEventListener(){},focus(){},select(){}});return elements.get(id);};
  const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const context={URL,URLSearchParams,Headers,Blob,Date,console,setTimeout:callback=>queueMicrotask(callback),crypto:{randomUUID},sessionStorage:storage,navigator:{clipboard:{writeText:async()=>{}}},document:{getElementById:el},
    location:{href:'https://notes.example.test/',origin:'https://notes.example.test',pathname:'/'},prompt:()=>null};context.window=context;
  for(const file of ['native-file.js','shared-notebook-model.js','notebook-sharing.js'])vm.runInNewContext(readFileSync(require.resolve('../'+file),'utf8'),context);
  const session=()=>({profile:{sub:actor,email:drive.actors[actor]},version:generation});
  const check=s=>{if(s.version!==generation||writing){const error=Error('Editing or account changed');error.syncDeferred=true;throw error;}};
  const api={session,check,signIn(){},
    request:async(url,options,s)=>{check(s);const response=await drive.fetch(url,{...options,headers:{...Object.fromEntries(new Headers(options?.headers)),Authorization:'Bearer token-'+actor}});check(s);if(!response.ok){const error=Error('Drive '+response.status);error.status=response.status;throw error;}return response;},
    read:async(response,s)=>{const value=await response.json();check(s);return value;},
    run:task=>{lastTask=task(session());},
    bridge:{notebooks:()=>notebooks,version:()=>version,deleted:()=>false,openNotebook:id=>opened.push(id),toast:t=>toasts.push(t),
      async putShared(value,sharing,expected){check(session());assert.equal(expected,version);const node={...JSON.parse(JSON.stringify(value)),_sharing:JSON.parse(JSON.stringify(sharing))};
        const index=notebooks.findIndex(n=>n.id===node.id);if(index<0)notebooks.push(node);else notebooks[index]=node;version++;saves.push(JSON.parse(JSON.stringify(node)));return version;}}
  };
  context.WindsSharing.init(api);
  return {context,el,notebooks,saves,toasts,opened,api,openLink(id){context.prompt=()=>`https://notes.example.test/?shared=${id}`;el('openSharedNotebook').onclick();return lastTask;},get task(){return lastTask;},
    async invite(id,email){context.WindsSharing.open(id);el('shareEmail').value=email;el('shareForm').onsubmit({preventDefault(){}});await lastTask;},
    sync:(options,manual=false)=>context.WindsSharing.sync(session(),manual,options),edit(id,item){const n=notebooks.find(n=>n.id===id);n.pages[0].items.push(item);n.updatedAt=new Date().toISOString();version++;},
    writing:value=>{writing=value;},changeAccount:(next=[])=>{generation++;notebooks.splice(0,notebooks.length,...next);}};
}

test('sharing grants editor access to one notebook folder without sharing the private workspace or another notebook',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book(),book('secret','Never share this')]);
  await owner.invite('physics','editor@example.test');
  assert.equal(drive.permissions.length,1);assert.equal(drive.permissions[0].role,'writer');
  assert.equal(drive.permissions[0].emailAddress,'editor@example.test');
  const contents=[...drive.files.values()].filter(f=>f.content).map(f=>JSON.stringify(f.content)).join('');
  assert.match(contents,/Physics/);assert.doesNotMatch(contents,/Never share this|winds-notes-backup/);
  assert.match(owner.el('shareLink').value,/\?shared=folder-/);
  assert.equal(owner.notebooks.length,2);assert.ok(owner.notebooks[0]._sharing.baseline);
  assert.equal(owner.notebooks[1]._sharing,undefined);
});

test('two authorized accounts discover one notebook and preserve simultaneous independent handwriting',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const editor=client(drive,'editor');await editor.sync();assert.equal(editor.notebooks.length,1);
  owner.edit('physics',stroke('owner-ink'));editor.edit('physics',stroke('editor-ink'));
  await owner.sync();await editor.sync();await owner.sync();
  assert.deepEqual(owner.toasts,[]);assert.deepEqual(editor.toasts,[]);
  for(const person of [owner,editor])assert.deepEqual(person.notebooks[0].pages[0].items.map(x=>x.id).sort(),['editor-ink','owner-ink']);
  assert.equal(sharedFile(drive,owner).content.edits.length,2);
  assert.ok(owner.saves.some(n=>n._sharing.pending?.length===1),'outgoing edits are saved durably before upload');
  const outsider=client(drive,'outsider');await outsider.sync();assert.equal(outsider.notebooks.length,0);
});

test('overlapping saves to the same file recover both edits from Drive versions',async()=>{
  const drive=sharingDrive({restrictEditFiles:true}),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const {folderId,seedId}=owner.notebooks[0]._sharing;
  const editor=client(drive,'editor');await editor.openLink(folderId);
  const fetch=drive.fetch;
  let arrived=0,release;
  const bothWriting=new Promise(resolve=>{release=resolve;});
  drive.fetch=async(url,options)=>{
    if(url.includes('/upload/')&&++arrived<=2){
      if(arrived===2)release();
      await bothWriting;
    }
    return fetch(url,options);
  };
  owner.edit('physics',stroke('owner-overlap'));editor.edit('physics',stroke('editor-overlap'));
  await Promise.all([owner.sync({only:'physics'}),editor.sync({only:'physics'})]);
  assert.equal(drive.files.get(seedId).content.edits.length,1,'both writers started from the same file version');
  const reopened=client(drive,'editor',structuredClone(editor.notebooks));await reopened.openLink(folderId);
  await reopened.sync({only:'physics'});
  assert.equal(drive.files.get(seedId).content.edits.length,2,'recovered edits were written back to the original file');
  await owner.sync({only:'physics'});
  for(const person of [owner,reopened])assert.deepEqual(person.notebooks[0].pages[0].items.map(x=>x.id).sort(),['editor-overlap','owner-overlap']);
  assert.equal(drive.comments.size,0);
  assert.equal([...drive.files.values()].filter(file=>file.appProperties?.windsNotesSharedEdit==='1').length,0);
});

test('the original author republishes older edit files on the shared seed without editing again',async()=>{
  const drive=sharingDrive({restrictEditFiles:true}),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const {folderId,seedId}=owner.notebooks[0]._sharing;
  drive.files.set('legacy-edit-file',{id:'legacy-edit-file',parents:[folderId],owner:'owner',createdTime:'2026-11-04T12:00:30Z',
    appProperties:{windsNotesSharedEdit:'1'},content:{format:'winds-shared-edit',version:1,id:'legacy-batch',
      at:'2026-11-04T12:00:30Z',changes:[{key:['item','physics-page','older-ink'],value:stroke('older-ink')}]}});
  const editor=client(drive,'editor');await editor.openLink(folderId);
  assert.equal(editor.notebooks[0].pages[0].items.length,0);
  const upgraded=client(drive,'owner',structuredClone(owner.notebooks));
  await upgraded.sync({only:'physics'});await editor.sync({only:'physics'});
  assert.equal(drive.files.get(seedId).content.edits[0].id,'legacy-batch');
  assert.deepEqual(editor.notebooks[0].pages[0].items.map(item=>item.id),['older-ink']);
});

test('reads a prior Drive comment edit once and saves it into the notebook file',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const {folderId,seedId}=owner.notebooks[0]._sharing;
  const edit={format:'winds-shared-edit',version:1,id:'legacy-comment',at:'2026-11-04T12:00:30Z',
    changes:[{key:['item','physics-page','older-comment-ink'],value:stroke('older-comment-ink')}]};
  drive.comments.set(seedId,[{id:'old-comment',modifiedTime:edit.at,
    content:'WiNDS Notes edit v1\n'+JSON.stringify({id:edit.id,index:0,total:1,data:JSON.stringify(edit)})}]);
  const editor=client(drive,'editor');await editor.openLink(folderId);
  await editor.sync({only:'physics'});
  assert.equal(drive.files.get(seedId).content.edits[0].id,edit.id);
  assert.equal(drive.comments.get(seedId).length,1);
});

test('an accepted upload with a lost response survives reload without duplicate strokes or repeated invitations',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  owner.edit('physics',stroke('offline-ink'));drive.failUploadAfterCommit();
  await owner.sync();assert.match(owner.toasts.at(-1),/Local edits are retained/);
  const saved=JSON.parse(JSON.stringify(owner.notebooks));assert.equal(saved[0]._sharing.pending.length,1);
  const reopened=client(drive,'owner',saved);await reopened.sync();
  assert.equal(reopened.notebooks[0]._sharing.pending.length,0);
  assert.equal(reopened.notebooks[0].pages[0].items.length,1);
  assert.equal(sharedFile(drive,owner).content.edits.length,1);
  assert.equal(drive.permissions.length,1);
});

test('old app recovery versions are pruned only after their edits are in a newer pinned version',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const {seedId}=owner.notebooks[0]._sharing;
  for(let index=0;index<26;index++){
    owner.edit('physics',stroke('recovery-'+index));
    await owner.sync({only:'physics'});
  }
  assert.equal(sharedFile(drive,owner).content.edits.length,26);
  assert.ok(drive.revisions.get(seedId).length<27);
  assert.ok(drive.revisions.get(seedId).some(revision=>!revision.keepForever),'the original version is retained');
  assert.equal(owner.toasts.length,0);
});

test('shared sync defers all requests during writing and leaves local edits intact',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  owner.edit('physics',stroke('waiting'));owner.writing(true);const before=drive.requests.length;
  await assert.rejects(owner.sync(),error=>error.syncDeferred===true);
  assert.equal(drive.requests.length,before);assert.equal(owner.notebooks[0].pages[0].items.length,1);
  owner.writing(false);await owner.sync();assert.equal(owner.notebooks[0].pages[0].items.length,1);
});

test('an editor cannot invite a third account when the owner disallows resharing',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const editor=client(drive,'editor');await editor.sync();await editor.invite('physics','outsider@example.test');
  assert.equal(drive.permissions.length,1);assert.match(editor.el('shareStatus').textContent,/Only the notebook owner/);
});

test('revoked access retains offline edits without writing to the shared folder',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const editor=client(drive,'editor');await editor.sync();
  const folder=[...drive.files.values()].find(f=>f.mimeType==='application/vnd.google-apps.folder');delete folder.grants['editor@example.test'];
  editor.edit('physics',stroke('kept-offline'));await editor.sync();
  assert.equal(editor.notebooks[0]._sharing.pending.length,1);assert.equal(editor.notebooks[0].pages[0].items[0].id,'kept-offline');
  assert.equal([...drive.files.values()].filter(f=>f.appProperties?.windsNotesSharedEdit==='1').length,0);
  assert.match(editor.toasts.at(-1),/Local edits are retained/);
});

test('an upload reply arriving after an account switch cannot replace the new account notebook',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const original=drive.fetch;let release;const gate=new Promise(resolve=>{release=resolve;});
  drive.fetch=async(url,options)=>{if(url.includes('/upload/'))await gate;return original(url,options);};
  owner.edit('physics',stroke('old-account'));const sync=owner.sync();
  for(let i=0;i<50;i++)await Promise.resolve();
  owner.changeAccount([book('new-account','New private notes')]);release();
  await assert.rejects(sync,error=>error.syncDeferred===true);
  assert.equal(owner.notebooks.length,1);assert.equal(owner.notebooks[0].id,'new-account');
  assert.equal(owner.notebooks[0]._sharing,undefined);
});

test('shared edits are durably queued and merge the current file before writing',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  owner.edit('physics',stroke('fast-ink'));const from=drive.requests.length;
  await owner.sync({only:'physics'});
  const requests=drive.requests.slice(from);
  assert.ok(new URL(requests[0].url).searchParams.get('fields').includes('headRevisionId'));
  assert.equal(requests[1].method,'PATCH');
  assert.ok(new URL(requests[1].url).pathname.endsWith('/'+owner.notebooks[0]._sharing.seedId));
  assert.ok(owner.saves.some(n=>n._sharing.pending?.[0]?.changes.some(c=>JSON.stringify(c).includes('fast-ink'))));
  assert.equal(owner.notebooks[0]._sharing.pending.length,0);
});

test('an uncertain upload is reconciled before same-session retry, without another edit file',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  owner.edit('physics',stroke('uncertain-ink'));drive.failUploadAfterCommit();await owner.sync({only:'physics'});
  const before=drive.requests.length;await owner.sync({only:'physics'},true);
  assert.ok(!drive.requests[before].url.includes('/upload/'),'reconcile an ambiguous reply first');
  assert.equal(sharedFile(drive,owner).content.edits.length,1);
  assert.equal(owner.notebooks[0]._sharing.pending.length,0);
  assert.equal(owner.notebooks[0].pages[0].items.length,1);
});

test('automatic background sharing checks rotate one notebook at a time and exclude the priority notebook',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book('one'),book('two'),book('three'),book('four')]);
  for(const id of ['one','two','three','four'])await owner.invite(id,'editor@example.test');
  const queried=[];
  for(let i=0;i<3;i++){
    const from=drive.requests.length;await owner.sync({exclude:'four',limit:1});
    const heads=drive.requests.slice(from).map(r=>new URL(r.url)).filter(url=>url.searchParams.get('fields')?.startsWith('headRevisionId'));
    assert.equal(heads.length,1);queried.push(heads[0].pathname.split('/').at(-1));
  }
  assert.equal(new Set(queried).size,3);
  assert.ok(!queried.includes(owner.notebooks.find(n=>n.id==='four')._sharing.seedId));
});

test('shared discovery failure has its own backoff and cannot block existing notebook sync',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const original=drive.fetch;let discoveries=0;
  drive.fetch=async(url,options)=>{
    const q=new URL(url).searchParams.get('q')||'';
    if(q.includes('windsNotesShared')&&!q.includes('in parents')){discoveries++;return Response.json({error:{message:'Temporary discovery failure'}},{status:503});}
    return original(url,options);
  };
  owner.edit('physics',stroke('keep-syncing'));await owner.sync({limit:1});await owner.sync({limit:1});
  assert.equal(discoveries,1);assert.equal(owner.notebooks[0]._sharing.pending.length,0);
  assert.equal(sharedFile(drive,owner).content.edits.length,1);
});

test('writing resumed during early shared upload preserves its outbox and reconciles safely later',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const original=drive.fetch;let release,started;const gate=new Promise(r=>{release=r;}),began=new Promise(r=>{started=r;});
  drive.fetch=async(url,options)=>{if(url.includes('/upload/')){started();await gate;}return original(url,options);};
  owner.edit('physics',stroke('resumed-ink'));const work=owner.sync({only:'physics'});await began;
  owner.writing(true);release();await assert.rejects(work,e=>e.syncDeferred===true);
  assert.equal(owner.notebooks[0]._sharing.pending.length,1);
  owner.writing(false);await owner.sync({only:'physics'},true);
  assert.equal(owner.notebooks[0]._sharing.pending.length,0);
  assert.equal(sharedFile(drive,owner).content.edits.length,1);
});


test('a shared-folder 404 offers account-specific recovery and authorization retries the original invitation',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const id=owner.notebooks[0]._sharing.folderId,fetch=drive.fetch;let denied=true,authorized=[];
  drive.fetch=async(url,options)=>new URL(url).pathname.endsWith('/'+id)&&new Headers(options.headers).get('Authorization')==='Bearer token-editor'&&denied?Response.json({error:{message:'File not found'}},{status:404}):fetch(url,options);
  const editor=client(drive,'editor');editor.api.authorize=async(file,s)=>{assert.equal(s.profile.sub,'editor');authorized.push(file);denied=false;return true;};
  await editor.openLink(id);assert.equal(editor.notebooks.length,0);assert.equal(editor.el('sharedAccessBackdrop').hidden,false);assert.match(editor.el('sharedAccessMessage').textContent,/editor@example.test/);
  assert.equal(editor.el('sharedAccessDrive').href,'https://drive.google.com/drive/folders/'+id);
  await editor.el('sharedAccessAuthorize').onclick();await editor.task;
  assert.deepEqual(authorized,[id]);assert.equal(editor.notebooks.length,1);assert.equal(editor.el('sharedAccessBackdrop').hidden,true);
});

test('a fresh Picker grant retries one denied Drive read and identifies a persistent denial',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const {folderId}=owner.notebooks[0]._sharing,fetch=drive.fetch;
  let denials=Infinity,reads=0;
  drive.fetch=async(url,options)=>{
    if(new URL(url).pathname.endsWith('/'+folderId)&&new Headers(options.headers).get('Authorization')==='Bearer token-editor'){
      reads++;
      if(denials-->0)return Response.json({error:{message:'File not found'}},{status:404});
    }
    return fetch(url,options);
  };
  const editor=client(drive,'editor');editor.api.authorize=async()=>true;
  await editor.openLink(folderId);
  await editor.el('sharedAccessAuthorize').onclick();await editor.task;
  assert.equal(reads,3,'one read before selection and two after it');
  assert.match(editor.el('sharedAccessStatus').textContent,/denied access after selection \(Drive 404\)/);
  denials=1;
  await editor.el('sharedAccessAuthorize').onclick();await editor.task;
  assert.equal(editor.notebooks[0]._sharing.folderId,folderId);
  assert.equal(editor.el('sharedAccessBackdrop').hidden,true);
});

test('missing seed authorization selects that file and account changes invalidate recovery',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const {folderId,seedId}=owner.notebooks[0]._sharing,fetch=drive.fetch;let release,started;
  drive.fetch=async(url,options)=>new URL(url).pathname.endsWith('/'+seedId)&&new Headers(options.headers).get('Authorization')==='Bearer token-editor'?Response.json({error:{message:'File not found'}},{status:404}):fetch(url,options);
  const editor=client(drive,'editor'),began=new Promise(r=>{started=r;});let cancelled=0;
  editor.api.authorize=async id=>{assert.equal(id,seedId);started();return new Promise(r=>{release=r;});};editor.api.cancelAuthorization=()=>{cancelled++;};
  await editor.openLink(folderId);const authorizing=editor.el('sharedAccessAuthorize').onclick();await began;editor.changeAccount();editor.context.WindsSharing.cancel();release(true);await authorizing;
  assert.equal(cancelled,1);assert.equal(editor.notebooks.length,0);assert.equal(editor.el('sharedAccessBackdrop').hidden,true);
});

test('opening a shared Drive folder or seed keeps both editors on the same notebook',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const {folderId,seedId}=owner.notebooks[0]._sharing;
  const fetch=drive.fetch;
  drive.fetch=async(url,options)=>{
    const response=await fetch(url,options);
    if(new Headers(options.headers).get('Authorization')==='Bearer token-editor'&&new URL(url).searchParams.get('q')?.includes(folderId)){
      const result=await response.json();
      return Response.json({...result,files:result.files.filter(file=>file.id!==seedId)});
    }
    return response;
  };
  const editor=client(drive,'editor');
  editor.api.pick=async(s,parent)=>{assert.equal(s.profile.sub,'editor');return parent===folderId?seedId:folderId;};
  await editor.context.WindsSharing.pickFromDrive();await editor.task;
  assert.equal(editor.notebooks.length,0);
  assert.equal(editor.el('sharedAccessAuthorize').textContent,'Choose Notebook.json');
  await editor.el('sharedAccessAuthorize').onclick();await editor.task;
  assert.deepEqual(editor.opened,['physics']);assert.equal(editor.notebooks[0]._sharing.folderId,folderId);

  const reopened=client(drive,'editor',structuredClone(editor.notebooks));
  reopened.api.pick=async()=>seedId;
  await reopened.context.WindsSharing.pickFromDrive();await reopened.task;
  assert.deepEqual(reopened.opened,['physics']);assert.equal(reopened.notebooks.length,1);
  reopened.edit('physics',stroke('editor-picked'));owner.edit('physics',stroke('owner-picked'));
  await reopened.sync();await owner.sync();await reopened.sync();
  for(const person of [owner,reopened])assert.deepEqual(person.notebooks[0].pages[0].items.map(item=>item.id).sort(),['editor-picked','owner-picked']);
  const edits=[...drive.files.values()].filter(file=>file.appProperties?.windsNotesSharedEdit==='1');
  assert.equal(edits.length,0);
  assert.equal(drive.files.get(seedId).content.edits.length,2);
  assert.equal([...drive.files.values()].filter(file=>file.appProperties?.windsNotesSharedSeed==='1').length,1);
});

test('Drive picker rejects unrelated files and ignores selections from a previous account',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  const {seedId}=owner.notebooks[0]._sharing;
  const file={...drive.files.get(seedId),id:'unrelated-json',appProperties:{}};
  drive.files.set(file.id,file);
  const editor=client(drive,'editor');editor.api.pick=async()=>file.id;
  await editor.context.WindsSharing.pickFromDrive();await editor.task;
  assert.match(editor.toasts.at(-1),/Choose a WiNDS shared notebook/);assert.equal(editor.notebooks.length,0);
  let release;
  editor.api.pick=()=>new Promise(resolve=>{release=resolve;});
  const selection=editor.context.WindsSharing.pickFromDrive(),count=drive.requests.length;
  editor.changeAccount();editor.context.WindsSharing.cancel();release(seedId);await selection;
  assert.equal(drive.requests.length,count);assert.equal(editor.el('openSharedFromDrive').disabled,false);
});

test('sharing requests declare shared-drive support without broadening OAuth scopes',async()=>{
  const drive=sharingDrive(),owner=client(drive,'owner',[book()]);await owner.invite('physics','editor@example.test');
  assert.ok(drive.requests.length>0);for(const request of drive.requests)assert.equal(new URL(request.url).searchParams.get('supportsAllDrives'),'true');
  const list=drive.requests.find(request=>new URL(request.url).searchParams.has('q'));assert.equal(new URL(list.url).searchParams.get('includeItemsFromAllDrives'),'true');
});

test('unchanged shared polls skip handwriting validation while still receiving the next remote edit',async()=>{
  const drive=sharingDrive(),large=book();
  large.pages[0].items=Array.from({length:240},(_,i)=>({...stroke('sample-'+i),points:Array.from({length:80},(_,j)=>[10+j,10+i,.5])}));
  const owner=client(drive,'owner',[large]);await owner.invite('physics','editor@example.test');
  const editor=client(drive,'editor');await editor.sync({only:'physics'});await editor.openLink(owner.notebooks[0]._sharing.folderId);
  await owner.sync({only:'physics'});
  let validations=0;
  const native=owner.context.WindsFile;
  owner.context.WindsFile={...native,validateShared(...args){validations++;return native.validateShared(...args);}};
  const saves=owner.saves.length;
  for(let i=0;i<5;i++)await owner.sync({only:'physics'});
  assert.equal(validations,0,'metadata-only polls must not revisit thousands of handwriting points');
  assert.equal(owner.saves.length,saves,'idle polling must not create new local writes');
  editor.edit('physics',stroke('remote-after-idle'));await editor.sync({only:'physics'});await owner.sync({only:'physics'});
  assert.ok(validations>0,'a new Drive revision still runs full validation');
  assert.ok(owner.notebooks[0].pages[0].items.some(item=>item.id==='remote-after-idle'));
  assert.deepEqual(owner.toasts,[]);assert.deepEqual(editor.toasts,[]);
});
