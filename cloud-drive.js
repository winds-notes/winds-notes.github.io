/* WiNDS Notes · Google Drive per-account workspace.
 * Static-hosted OAuth with Google Identity Services. One public OAuth client ID
 * serves all users, but the OAuth access token grants access ONLY to the
 * user's own Google Drive files. Passwords and OAuth tokens are never stored.
 * Live handwriting never calls this module or waits for the network.
 */
(function(global){
  'use strict';
  const SCOPE='openid email profile https://www.googleapis.com/auth/drive.file';
  const API='https://www.googleapis.com/drive/v3/files';
  const UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
  const WORKSPACE_NAME='WiNDS Notes Workspace.json';
  const AUTO_DELAY_MS=8000;
  const AUTO_RETRY_MS=45000;
  const MAX_BYTES=100*1024*1024;
  const $=id=>document.getElementById(id);
  let bridge=null,oauth=null,token=null,expires=0,profile=null,activeId=null;
  let syncing=false,signingIn=false,generation=0,timer=0,lastSync=0;
  let auto=true,localVersion=0,lastSyncedVersion=-1,deviceId='';
  const connected=()=>Boolean(token&&profile&&Date.now()<expires-30000);
  const safeText=s=>String(s||'').replace(/[\u0000-\u001F]/g,' ').slice(0,110);
  function message(value,error=false){const el=$('cloudMessage');if(el){el.textContent=value;el.classList.toggle('error',error);}}
  function updateUI(){
    const yes=connected();
    $('cloudConnection').classList.toggle('connected',yes);
    $('cloudConnectionText').textContent=yes?`Signed in as ${profile.email}`:'Not signed in';
    $('cloudEntryLabel').textContent=yes?profile.email:'Google Drive';
    $('googleConnect').hidden=yes;
    $('googleSwitchAccount').hidden=!yes;
    for(const id of ['googleSync','googleBackup','googleRestore','cloudAutoControl','googleDisconnect'])$(id).hidden=!yes;
    $('googleSync').disabled=syncing;
    $('cloudAutoBackup').checked=auto;
    if(!yes){$('cloudBackupList').hidden=true;clearTimeout(timer);}
  }
  function open(){
    $('cloudBackdrop').hidden=false;updateUI();
    if(!global.WINDS_GOOGLE_CLIENT_ID){
      message('Google sign-in requires the website owner to configure google-config.js with a Google Cloud Web OAuth Client ID.',true);
      $('googleConnect').disabled=true;
    }else{
      $('googleConnect').disabled=false;
      message(connected()?`This is ${profile.email}'s private workspace. Your notebooks sync when writing is idle.`:'Sign in to open your personal notebooks. Each Google account has its own Drive files and on-device workspace.');
    }
  }
  function close(){$('cloudBackdrop').hidden=true;}
  function ensureSession(expected){
    if(expected!==generation||!connected())throw new Error('Account changed or Google sign-in expired. Please reconnect.');
  }
  async function driveRequest(url,options={},expected=generation){
    ensureSession(expected);
    const headers=new Headers(options.headers||{});
    headers.set('Authorization',`Bearer ${token}`);
    const response=await fetch(url,{...options,headers});
    ensureSession(expected);
    if(!response.ok){
      let reason='';try{const error=await response.json();reason=error.error?.message||'';}catch{}
      if(response.status===401){expires=0;updateUI();}
      throw new Error(`Google Drive ${response.status}${reason?': '+safeText(reason):''}`);
    }
    return response;
  }
  async function getProfile(accessToken){
    const response=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{
      headers:{Authorization:`Bearer ${accessToken}`}
    });
    if(!response.ok)throw new Error('Could not verify your Google identity. Check that Google Identity scopes are enabled.');
    const user=await response.json();
    if(!/^[0-9]{5,30}$/.test(String(user.sub||''))||!user.email||user.email_verified!==true)throw new Error('Google account identity was not verified.');
    return {sub:String(user.sub),email:String(user.email),name:String(user.name||user.email)};
  }
  async function connectCallback(result){
    if(!result||result.error||!result.access_token){message('Google sign-in was cancelled or incomplete.',true);return;}
    const nextGeneration=++generation;
    signingIn=true;clearTimeout(timer);
    const newToken=result.access_token;
    const newExpires=Date.now()+Math.max(60,Number(result.expires_in)||3600)*1000;
    try{
      message('Verifying your Google account…');
      const identity=await getProfile(newToken);
      if(nextGeneration!==generation)return;
      // No account workspace is opened until we know the verified Google ID.
      // Save and close the previous account first, then load the new one.
      token=newToken;expires=newExpires;profile=identity;activeId=null;
      try{auto=localStorage.getItem(`winds-drive-auto-${identity.sub}`)!=='false';}catch{auto=true;}
      message(`Opening ${identity.email}'s personal notebooks…`);
      await bridge.switchWorkspace(identity.sub);
      if(nextGeneration!==generation)return;
      updateUI();
      await refreshFromDrive(nextGeneration);
      if(nextGeneration!==generation)return;
      message(`Connected to ${identity.email}. Notebook changes sync to this Google account when idle.`);
      localVersion++;schedule();
    }catch(err){
      console.error('WiNDS sign-in:',err);
      if(nextGeneration===generation){
        token=null;expires=0;profile=null;activeId=null;
        await bridge.switchWorkspace(null).catch(()=>{});
        message(err.message||'Could not open this Google account.',true);updateUI();
      }
    }finally{signingIn=false;updateUI();}
  }
  function connect(){
    // Initiated directly by a click, required by Google's OAuth popup.
    const clientId=String(global.WINDS_GOOGLE_CLIENT_ID||'').trim();
    if(!clientId){message('Configure a Google OAuth Web client ID in google-config.js.',true);return;}
    if(!global.google?.accounts?.oauth2?.initTokenClient){message('Google Sign-In script is unavailable. Check the internet connection.',true);return;}
    try{
      if(!oauth){oauth=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SCOPE,callback:connectCallback});}
      oauth.requestAccessToken({prompt:'select_account'});
    }catch(err){console.error(err);message('Unable to open Google authorization. Check the OAuth authorized JavaScript origin.',true);}
  }
  async function listFiles(expected=generation){
    const found=[];let next='';
    do{
      const q="trashed = false and (appProperties has {key='windsNotesWorkspace' and value='1'} or appProperties has {key='windsNotesBackup' and value='1'})";
      const params=new URLSearchParams({q,fields:'nextPageToken,files(id,name,mimeType,modifiedTime,size,appProperties)',pageSize:'100',orderBy:'modifiedTime desc'});
      if(next)params.set('pageToken',next);
      const response=await driveRequest(`${API}?${params}`,{},expected);
      const data=await response.json();found.push(...(data.files||[]));next=data.nextPageToken||'';
    }while(next&&found.length<500);
    return found;
  }
  async function fetchWorkspace(fileId,expected=generation){
    const response=await driveRequest(`${API}/${encodeURIComponent(fileId)}?alt=media`,{},expected);
    const length=Number(response.headers.get('content-length')||0);
    if(length>MAX_BYTES)throw new Error('This Google Drive workspace is too large to open safely.');
    const text=await response.text();ensureSession(expected);
    if(text.length>MAX_BYTES)throw new Error('The Drive workspace exceeds the 100 MB safety limit.');
    const data=JSON.parse(text);
    if(data.format!=='winds-notes-backup'||!Array.isArray(data.notebooks))throw new Error('The Drive workspace file is not a valid WiNDS Notes document.');
    return data;
  }
  async function refreshFromDrive(expected=generation){
    const files=await listFiles(expected);
    const workspace=files.find(f=>f.appProperties?.windsNotesWorkspace==='1'&&f.name===WORKSPACE_NAME);
    activeId=workspace?.id||null;
    if(workspace){
      const data=await fetchWorkspace(workspace.id,expected);
      ensureSession(expected);
      await bridge.mergeWorkspace(data);
    }
    return workspace;
  }
  async function upload(name,content,oldId,properties,expected=generation){
    const blob=new Blob([content],{type:'application/json'});
    if(blob.size>MAX_BYTES)throw new Error('Notebook storage is larger than 100 MB. Export individual .winds-notes files.');
    const metadata={name,mimeType:'application/json',appProperties:properties};
    const target=UPLOAD+(oldId?'/'+encodeURIComponent(oldId):'');
    let result;
    if(blob.size<=5*1024*1024){
      const boundary='winds_'+Math.random().toString(36).slice(2);
      const body=new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n`,blob,
        `\r\n--${boundary}--\r\n`
      ],{type:`multipart/related; boundary=${boundary}`});
      result=await driveRequest(target+'?uploadType=multipart&fields=id,name,modifiedTime',{
        method:oldId?'PATCH':'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body
      },expected);
    }else{
      const init=await driveRequest(target+'?uploadType=resumable&fields=id,name,modifiedTime',{
        method:oldId?'PATCH':'POST',
        headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(blob.size)},
        body:JSON.stringify(metadata)
      },expected);
      const location=init.headers.get('Location');
      if(!location||!location.startsWith('https://www.googleapis.com/'))throw new Error('Drive did not provide an authorized upload URL.');
      result=await driveRequest(location,{method:'PUT',headers:{'Content-Type':'application/json'},body:blob},expected);
    }
    return result.json();
  }
  async function sync(manual=false){
    if(syncing||signingIn||!connected())return;
    if(!manual && !auto)return;
    if(bridge.isDrawingNow()){if(manual)message('Finish the current stroke, then select Sync now.',true);else schedule(AUTO_RETRY_MS);return;}
    if(!manual && bridge.isWriting()){schedule(AUTO_RETRY_MS);return;}
    const expected=generation;
    syncing=true;updateUI();
    if(manual)message('Synchronizing this account’s notebooks with Google Drive…');
    try{
      // Re-read latest Drive state before writing so another device's newly
      // created notebooks are not inadvertently overwritten.
      await refreshFromDrive(expected);
      ensureSession(expected);
      const snapshot=bridge.getData();
      if(!snapshot.notebooks.length&&!Object.keys(snapshot.deleted||{}).length){
        if(manual)message('There are no notebooks to sync in this account.');
        return;
      }
      const versionAtStart=localVersion;
      const created=await upload(WORKSPACE_NAME,JSON.stringify(snapshot),activeId,{windsNotesWorkspace:'1',windsNotesVersion:'2'},expected);
      ensureSession(expected);
      activeId=created.id;
      lastSync=Date.now();lastSyncedVersion=versionAtStart;
      if(manual){message(`Synced ${snapshot.notebooks.length} notebook${snapshot.notebooks.length===1?'':'s'} to ${profile.email}'s Google Drive.`);bridge.toast('Your Google Drive workspace is up to date');}
    }catch(err){
      console.error('WiNDS Drive sync:',err);
      if(expected===generation){message(err.message||'Sync failed. Local notes are safe; reconnect to retry.',true);if(manual)bridge.toast('Google Drive sync failed — your local notes are safe');}
    }finally{syncing=false;updateUI();if(expected===generation&&lastSyncedVersion!==localVersion&&auto)schedule(AUTO_RETRY_MS);}
  }
  function schedule(delay=AUTO_DELAY_MS){
    clearTimeout(timer);
    if(!connected()||!auto||signingIn||lastSyncedVersion===localVersion)return;
    timer=setTimeout(()=>sync(false),delay);
  }
  function onLocalSave(){
    if(!connected()||signingIn)return;
    localVersion++;schedule();
  }
  function backupName(){return `WiNDS Notes Backup ${new Date().toISOString().replace(/[:.]/g,'-')}.json`;}
  async function backup(){
    if(!connected()||syncing)return;
    const expected=generation;syncing=true;$('googleBackup').disabled=true;
    try{
      message('Creating a dated backup in your own Google Drive…');
      const data=JSON.stringify(bridge.getData());
      const result=await upload(backupName(),data,null,{windsNotesBackup:'1',deviceId},expected);
      ensureSession(expected);message(`Backup “${result.name}” saved in ${profile.email}'s Drive.`);bridge.toast('Dated Google Drive backup saved');
    }catch(err){console.error(err);message(err.message||'Google Drive backup failed.',true);}
    finally{syncing=false;$('googleBackup').disabled=false;updateUI();}
  }
  async function browse(){
    if(!connected()||syncing)return;
    const expected=generation;syncing=true;$('googleRestore').disabled=true;
    try{
      message('Finding this Google account’s notebook backups…');
      const files=(await listFiles(expected)).filter(f=>f.appProperties?.windsNotesBackup==='1'&&f.mimeType==='application/json');
      const list=$('cloudBackupList');list.replaceChildren();
      if(!files.length){list.textContent='No dated backups in this account yet.';list.hidden=false;return;}
      for(const file of files){
        const row=document.createElement('div');row.className='cloud-backup-item';
        const title=document.createElement('div');title.textContent=file.name;
        const time=document.createElement('small');time.textContent=file.modifiedTime?new Date(file.modifiedTime).toLocaleString():'';title.appendChild(time);
        const button=document.createElement('button');button.textContent='Import copy';button.type='button';button.onclick=()=>restore(file.id,file.name);
        row.append(title,button);list.appendChild(row);
      }
      list.hidden=false;message(`Found ${files.length} dated backup(s). Import creates separate notebooks.`);
    }catch(err){if(expected===generation)message(err.message||'Could not load backups.',true);}
    finally{syncing=false;$('googleRestore').disabled=false;updateUI();}
  }
  async function restore(id,name){
    if(!connected()||syncing)return;
    if(!confirm(`Import “${name}” as new notebook copies into ${profile.email}'s workspace?`))return;
    const expected=generation;syncing=true;
    try{
      const response=await driveRequest(`${API}/${encodeURIComponent(id)}?alt=media`,{},expected);
      const text=await response.text();ensureSession(expected);
      const count=await bridge.importData(text);
      ensureSession(expected);message(`Imported ${count} notebook(s) into ${profile.email}'s workspace.`);
      bridge.toast('Imported editable notebook copies from Google Drive');localVersion++;schedule();
    }catch(err){if(expected===generation)message(err.message||'Could not import this backup.',true);}
    finally{syncing=false;updateUI();}
  }
  async function disconnect(){
    if(signingIn)return;
    generation++;clearTimeout(timer);
    const previous=token;token=null;profile=null;expires=0;activeId=null;lastSyncedVersion=-1;
    updateUI();message('Signed out. This device’s guest notes are now separate from all Google accounts.');
    try{await bridge.switchWorkspace(null);}catch(err){message('Unable to open local guest notes: '+err.message,true);}
    if(previous&&global.google?.accounts?.oauth2?.revoke){try{global.google.accounts.oauth2.revoke(previous,()=>{});}catch{}}
  }
  function init(appBridge){
    bridge=appBridge;
    try{deviceId=localStorage.getItem('winds-drive-device-id')||'';if(!deviceId){deviceId=crypto.randomUUID?.()||Math.random().toString(36).slice(2);localStorage.setItem('winds-drive-device-id',deviceId);}}catch{deviceId=Math.random().toString(36).slice(2);}
    $('cloudConnectHome').onclick=open;
    $('cloudClose').onclick=close;
    $('cloudBackdrop').addEventListener('click',e=>{if(e.target===$('cloudBackdrop'))close();});
    $('googleConnect').onclick=connect;
    $('googleSwitchAccount').onclick=connect;
    $('googleSync').onclick=()=>sync(true);
    $('googleBackup').onclick=backup;
    $('googleRestore').onclick=browse;
    $('googleDisconnect').onclick=disconnect;
    $('cloudAutoBackup').onchange=e=>{
      auto=e.target.checked;
      if(profile)try{localStorage.setItem(`winds-drive-auto-${profile.sub}`,String(auto));}catch{}
      if(auto){localVersion++;message('Automatic sync enabled. Cloud uploads happen only after writing and local saving are idle.');schedule();}
      else{clearTimeout(timer);message('Automatic cloud sync paused. Notes are still saved locally and can be synced manually.');}
    };
    updateUI();
  }
  global.WindsDrive=Object.freeze({init,open,onLocalSave});
})(window);
