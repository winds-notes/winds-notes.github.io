/* WiNDS Notes: optional, per-user Google Drive backup for static GitHub Pages.
 * OAuth access tokens live only in memory; no passwords or client secret here.
 * The writing path never calls this module. Data is uploaded only when the
 * owner explicitly requests it or opts in to occasional idle backups.
 */
(function (global) {
  'use strict';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const API = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  const AUTO_DELAY_MS = 120000;             // another 2 minutes beyond local save
  const AUTO_MIN_INTERVAL_MS = 10*60000;   // cap at one automatic backup per 10 minutes
  const MAX_BACKUP_BYTES = 100*1024*1024;
  const $ = id => document.getElementById(id);
  let bridge = null;
  let tokenClient = null;
  let accessToken = null;
  let expiresAt = 0;
  let pendingTimer = 0;
  let busy = false;
  let lastAutoTime = 0;
  let autoEnabled = false;
  let localChangeVersion = 0;
  let lastUploadedVersion = -1;
  let deviceId = '';
  function currentToken(){return accessToken && Date.now() < expiresAt-30000;}
  function message(text, error=false){const el=$('cloudMessage');if(!el)return;el.textContent=text;el.classList.toggle('error',error);}
  function updateUI(){
    const connected=Boolean(currentToken());
    $('cloudConnection').classList.toggle('connected',connected);
    $('cloudConnectionText').textContent=connected?'Google Drive connected · this session':'Not connected';
    $('cloudEntryLabel').textContent=connected?'Drive connected':'Google Drive';
    $('googleConnect').hidden=connected;
    $('googleConnect').textContent=accessToken && !connected?'Reconnect Google Drive':'Connect Google Drive';
    for(const id of ['googleBackup','googleRestore','cloudAutoControl','googleDisconnect'])$(id).hidden=!connected;
    $('cloudAutoBackup').checked=autoEnabled;
    if(!connected){$('cloudBackupList').hidden=true;clearTimeout(pendingTimer);}
  }
  function open(){
    $('cloudBackdrop').hidden=false;
    updateUI();
    if(!global.WINDS_GOOGLE_CLIENT_ID){
      message('Google Drive needs one-time setup by the website owner. Add your Web OAuth Client ID to google-config.js and authorize this GitHub Pages domain.',true);
      $('googleConnect').disabled=true;
    }else{
      $('googleConnect').disabled=false;
      message(currentToken()?'Connected. Back up all your notebooks or restore copies from Drive.':'Sign in only when you want to back up or restore. Local writing always works without Google.');
    }
  }
  function close(){$('cloudBackdrop').hidden=true;}
  function connect(){
    // Called synchronously from a real click: Google requires user activation.
    const clientId=String(global.WINDS_GOOGLE_CLIENT_ID||'').trim();
    if(!clientId){message('The website owner must enter a Google OAuth Client ID in google-config.js.',true);return;}
    if(!global.google?.accounts?.oauth2?.initTokenClient){message('Google sign-in is not ready. Check your internet connection and try again.',true);return;}
    try{
      if(!tokenClient){
        tokenClient=google.accounts.oauth2.initTokenClient({
          client_id:clientId,
          scope:SCOPE,
          callback:result=>{
            if(result.error||!result.access_token){message('Google sign-in was not completed. Please try again.',true);return;}
            if(!google.accounts.oauth2.hasGrantedAllScopes(result,SCOPE)){message('Google Drive permission was not granted.',true);return;}
            accessToken=result.access_token;
            expiresAt=Date.now()+(Math.max(60,Number(result.expires_in)||3600)*1000);
            message('Connected! Your notes are still local until you select Back up or enable automatic backup.');
            updateUI();
          }
        });
      }
      tokenClient.requestAccessToken({prompt:''});
    }catch(err){console.error('WiNDS Google OAuth:',err);message('Could not open Google sign-in. Check that the authorized origin matches this website.',true);}
  }
  async function request(url, options={}){
    if(!currentToken()){
      updateUI();
      throw new Error('Google session expired. Choose Reconnect Google Drive and try again.');
    }
    const headers = new Headers(options.headers||{});
    headers.set('Authorization','Bearer '+accessToken);
    const response=await fetch(url,{...options,headers});
    if(!response.ok){
      let reason='';try{const data=await response.json();reason=data?.error?.message||'';}catch{}
      if(response.status===401){accessToken=null;updateUI();}
      throw new Error(`Google Drive error ${response.status}${reason?': '+reason:''}`);
    }
    return response;
  }
  function nameFor(automatic){
    const d=new Date().toISOString().replace(/[:.]/g,'-');
    return automatic?`WiNDS Notes Auto ${deviceId}.json`:`WiNDS Notes Backup ${d}.json`;
  }
  async function listFiles(){
    // Only app-created files are visible with drive.file; appProperties provides
    // a second filter to prevent picking up unrelated JSON files.
    const q="trashed = false and appProperties has { key='windsNotesBackup' and value='1' }";
    let next='';const files=[];
    do{
      const params=new URLSearchParams({q,fields:'nextPageToken,files(id,name,mimeType,modifiedTime,size,appProperties)',pageSize:'100',orderBy:'modifiedTime desc'});
      if(next)params.set('pageToken',next);
      const data=await (await request(API+'?'+params.toString())).json();
      files.push(...(data.files||[]).filter(f=>f.name?.startsWith('WiNDS Notes') && f.mimeType==='application/json'));
      next=data.nextPageToken||'';
    }while(next && files.length<500);
    return files;
  }
  async function uploadFile(name,text,existingId){
    const bytes=new Blob([text],{type:'application/json'});
    if(bytes.size>MAX_BACKUP_BYTES)throw new Error('Cloud backup exceeds 100 MB. Export notebooks to .winds-notes files instead.');
    const metadata={name,mimeType:'application/json',appProperties:{windsNotesBackup:'1',deviceId}};
    const create=!existingId;
    const target=UPLOAD+(existingId?'/'+encodeURIComponent(existingId):'');
    if(bytes.size<=5*1024*1024){
      // Multipart REST upload: one request, correct metadata, user-visible file.
      const boundary='winds_'+Math.random().toString(36).slice(2);
      const body=new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n`,bytes,
        `\r\n--${boundary}--\r\n`
      ],{type:`multipart/related; boundary=${boundary}`});
      const res=await request(target+'?uploadType=multipart&fields=id,name,modifiedTime',{
        method:create?'POST':'PATCH',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body
      });
      return res.json();
    }
    // Drive's resumable upload is recommended for larger media and iPad networks.
    const init=await request(target+'?uploadType=resumable&fields=id,name,modifiedTime',{
      method:create?'POST':'PATCH',
      headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(bytes.size)},
      body:JSON.stringify(metadata)
    });
    const location=init.headers.get('Location');
    if(!location||!location.startsWith('https://www.googleapis.com/'))throw new Error('Drive did not provide an upload location. Try a smaller notebook or export locally.');
    const finished=await request(location,{method:'PUT',headers:{'Content-Type':'application/json'},body:bytes});
    return finished.json();
  }
  async function save(automatic=false){
    if(busy)return;
    if(automatic && (bridge.isWriting() || !currentToken() || !autoEnabled))return;
    busy=true;
    $('googleBackup').disabled=true;
    try{
      if(!automatic)message('Preparing a copy of your notebooks…');
      const snapshot=bridge.getData();
      if(!snapshot.notebooks.length)throw new Error('No notebooks to back up yet.');
      const serialized=JSON.stringify(snapshot);
      if(automatic){
        const all=await listFiles();
        const old=all.find(f=>f.name===nameFor(true));
        // A unique per-browser file avoids one device silently replacing another's backup.
        await uploadFile(nameFor(true),serialized,old?.id);
        lastAutoTime=Date.now();lastUploadedVersion=localChangeVersion;
      }else{
        // Manual backups create dated restore points, rather than overwriting older copies.
        await uploadFile(nameFor(false),serialized);
        lastUploadedVersion=localChangeVersion;
      }
      if(!$('cloudBackdrop').hidden)message(`Saved ${snapshot.notebooks.length} notebook${snapshot.notebooks.length===1?'':'s'} to your Google Drive.`);
      if(!automatic)bridge.toast('Google Drive backup saved');
    }catch(err){console.error('WiNDS Drive backup:',err);message(err?.message||'Could not back up to Google Drive.',true);if(!automatic)bridge.toast('Drive backup failed; your local notes are unchanged');}
    finally{busy=false;$('googleBackup').disabled=false;updateUI();}
  }
  async function browse(){
    if(busy)return;
    busy=true;$('googleRestore').disabled=true;
    try{
      message('Finding WiNDS Notes backups in your Google Drive…');
      const files=await listFiles();
      const list=$('cloudBackupList');list.innerHTML='';
      if(!files.length){list.textContent='No WiNDS Notes backups were found for this Google account.';list.hidden=false;message('Create a backup first to see it here.');return;}
      for(const file of files){
        const row=document.createElement('div');row.className='cloud-backup-item';
        const name=document.createElement('div');name.textContent=file.name;
        const small=document.createElement('small');small.textContent=file.modifiedTime?new Date(file.modifiedTime).toLocaleString():'';
        name.appendChild(small);
        const button=document.createElement('button');button.type='button';button.textContent='Import';
        button.onclick=()=>restoreFrom(file.id,file.name);
        row.append(name,button);list.appendChild(row);
      }
      list.hidden=false;message(`${files.length} available backup${files.length===1?'':'s'}. Import creates copies, leaving current notebooks untouched.`);
    }catch(err){console.error(err);message(err.message||'Could not list Google Drive backups.',true);}
    finally{busy=false;$('googleRestore').disabled=false;}
  }
  async function restoreFrom(id,name){
    if(busy)return;
    if(!confirm(`Import notebooks from "${name}"? They will be added as new copies, not replace your existing notebooks.`))return;
    busy=true;
    try{
      message('Downloading and checking this backup…');
      const res=await request(API+'/'+encodeURIComponent(id)+'?alt=media');
      const text=await res.text();
      const count=await bridge.importData(text); // same file validator as native imports
      message(`Imported ${count} notebook${count===1?'':'s'} without overwriting existing notes.`);
      bridge.toast('Notebooks imported from Google Drive');
      $('cloudBackupList').hidden=true;
    }catch(err){console.error(err);message(err.message||'Unable to import this backup.',true);}
    finally{busy=false;}
  }
  function scheduleAuto(){
    clearTimeout(pendingTimer);
    if(!autoEnabled||!currentToken()||lastUploadedVersion===localChangeVersion)return;
    const due=Math.max(AUTO_DELAY_MS, AUTO_MIN_INTERVAL_MS-(Date.now()-lastAutoTime));
    pendingTimer=setTimeout(async()=>{
      if(bridge?.isWriting()){scheduleAuto();return;}
      if(lastUploadedVersion!==localChangeVersion)await save(true);
    },due);
  }
  function onLocalSave(){localChangeVersion++;scheduleAuto();}
  function disconnect(){
    clearTimeout(pendingTimer);
    const oldToken=accessToken;accessToken=null;expiresAt=0;
    // Prevent accidental backups to an account that is no longer connected.
    updateUI();message('Disconnected. Local notebooks are unchanged.');
    if(oldToken&&global.google?.accounts?.oauth2?.revoke){try{google.accounts.oauth2.revoke(oldToken,()=>{});}catch{}}
  }
  function init(appBridge){
    bridge=appBridge;
    try{deviceId=localStorage.getItem('winds-drive-device-id')||'';if(!deviceId){deviceId=crypto.randomUUID?.()||Math.random().toString(36).slice(2);localStorage.setItem('winds-drive-device-id',deviceId);}}catch{deviceId=Math.random().toString(36).slice(2);}
    try{autoEnabled=localStorage.getItem('winds-drive-auto')==='true';}catch{}
    $('cloudConnectHome').onclick=open;
    $('cloudClose').onclick=close;
    $('cloudBackdrop').addEventListener('click',e=>{if(e.target===$('cloudBackdrop'))close();});
    $('googleConnect').onclick=connect;
    $('googleBackup').onclick=()=>save(false);
    $('googleRestore').onclick=browse;
    $('googleDisconnect').onclick=disconnect;
    $('cloudAutoBackup').onchange=e=>{
      autoEnabled=e.target.checked;
      try{localStorage.setItem('winds-drive-auto',String(autoEnabled));}catch{}
      if(autoEnabled){message('Automatic backups run only while this app is open, connected and idle.');localChangeVersion++;scheduleAuto();}
      else{clearTimeout(pendingTimer);message('Automatic Drive backup disabled. Local autosave stays on.');}
    };
    updateUI();
  }
  global.WindsDrive=Object.freeze({init,open,onLocalSave});
})(window);
