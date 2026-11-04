/* WiNDS Notes · Google Drive per-account workspace.
 * Static-hosted OAuth with Google Identity Services. One public OAuth client ID
 * serves all users, but the OAuth access token grants access ONLY to the
 * user's own Google Drive files. A short-lived token survives refresh only in
 * sessionStorage and can be passed to another open WiNDS tab. Only the account
 * profile is remembered across visits; passwords and refresh tokens are never stored.
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
  const SESSION_KEY='winds-drive-session-v1';
  const ACCOUNT_KEY='winds-drive-last-account-v1';
  const $=id=>document.getElementById(id);
  let bridge=null,oauth=null,token=null,expires=0,profile=null,activeId=null;
  let syncing=false,signingIn=false,generation=0,timer=0,expiryTimer=0,lastSync=0;
  let auto=true,localVersion=0,lastSyncedVersion=-1,deviceId='';
  let channel=null,peerRequest=null,remoteSignedOut=false;
  const connected=()=>Boolean(token&&profile&&Date.now()<expires-30000);
  const safeText=s=>String(s||'').replace(/[\u0000-\u001F]/g,' ').slice(0,110);
  function rememberSession(){
    try{
      if(profile&&!remoteSignedOut)global.sessionStorage.setItem(SESSION_KEY,JSON.stringify({
        clientId:global.WINDS_GOOGLE_CLIENT_ID,profile,token,expires
      }));
      else global.sessionStorage.removeItem(SESSION_KEY);
    }catch{} // Storage may be blocked; the current in-memory connection still works.
  }
  function validProfile(value){
    return value&&typeof value.sub==='string'&&/^[0-9]{5,30}$/.test(value.sub)&&
      typeof value.email==='string'&&Boolean(value.email);
  }
  function validSession(value){
    return value&&value.clientId===global.WINDS_GOOGLE_CLIENT_ID&&validProfile(value.profile)&&
      (value.token===null||typeof value.token==='string')&&Number.isFinite(value.expires);
  }
  function savedSession(){
    try{
      const saved=JSON.parse(global.sessionStorage.getItem(SESSION_KEY));
      if(!saved)return null;
      if(!validSession(saved))throw new Error('Invalid saved Google session');
      return saved;
    }catch{try{global.sessionStorage.removeItem(SESSION_KEY);}catch{}return null;}
  }
  function rememberedAccount(){
    try{
      const saved=JSON.parse(localStorage.getItem(ACCOUNT_KEY));
      if(saved?.clientId===global.WINDS_GOOGLE_CLIENT_ID&&validProfile(saved.profile))return saved;
    }catch{}
    return null;
  }
  function rememberAccount(onlyIfMissing=false){
    if(!profile||remoteSignedOut||(onlyIfMissing&&rememberedAccount()))return;
    try{localStorage.setItem(ACCOUNT_KEY,JSON.stringify({clientId:global.WINDS_GOOGLE_CLIENT_ID,profile}));}catch{}
  }
  function publish(type,details){
    try{channel?.postMessage({type,clientId:global.WINDS_GOOGLE_CLIENT_ID,...details});}catch{}
  }
  function initSessionChannel(){
    if(!global.BroadcastChannel)return;
    try{
      channel=new global.BroadcastChannel(SESSION_KEY);
      channel.onmessage=event=>{
        const data=event.data;
        if(!data||data.clientId!==global.WINDS_GOOGLE_CLIENT_ID)return;
        if(data.type==='request-session'&&connected()&&!signingIn&&data.sub===profile.sub&&typeof data.requestId==='string'){
          publish('session',{requestId:data.requestId,session:{
            clientId:global.WINDS_GOOGLE_CLIENT_ID,profile,token,expires
          }});
        }else if(data.type==='session'&&peerRequest&&data.requestId===peerRequest.id&&
          validSession(data.session)&&data.session.profile.sub===peerRequest.sub&&
          data.session.token&&Date.now()<data.session.expires-30000){
          peerRequest.finish(data.session);
        }else if(data.type==='signed-out'&&profile?.sub===data.sub){
          // Invalidate Drive access immediately, but keep local notes on screen.
          // No workspace save or re-render interrupts writing in this tab.
          generation++;token=null;expires=0;remoteSignedOut=true;signingIn=false;
          peerRequest?.finish(null);rememberSession();updateUI();
          message('Signed out in another tab. Your local notebooks remain open; reconnect Google Drive to resume sync.');
        }
      };
    }catch{channel=null;}
  }
  function sessionFromPeer(sub){
    if(!channel)return Promise.resolve(null);
    return new Promise(resolve=>{
      const id=crypto.randomUUID?.()||Math.random().toString(36).slice(2);
      const timeout=setTimeout(()=>finish(null),750);
      function finish(value){clearTimeout(timeout);peerRequest=null;resolve(value);}
      peerRequest={id,sub,finish};
      publish('request-session',{sub,requestId:id});
    });
  }
  function connectionMessage(){
    if(connected())return `This is ${profile.email}'s private workspace. Your notebooks sync when writing is idle.`;
    return profile?`Your local notebooks for ${profile.email} are open. Reconnect Google Drive to resume sync.`:
      'Sign in to open your personal notebooks. Each Google account has its own Drive files and on-device workspace.';
  }
  function loadAutoPreference(){
    try{auto=localStorage.getItem(`winds-drive-auto-${profile.sub}`)!=='false';}catch{auto=true;}
  }
  function message(value,error=false){const el=$('cloudMessage');if(el){el.textContent=value;el.classList.toggle('error',error);}}
  function updateUI(){
    const yes=connected();
    $('cloudConnection').classList.toggle('connected',yes);
    $('cloudConnectionText').textContent=yes?`Signed in as ${profile.email}`:profile?`${profile.email} · Drive reconnect needed`:'Not signed in';
    $('cloudEntryLabel').textContent=profile?`${profile.email}${yes?'':' · Reconnect'}`:'Sign in with Google';
    $('googleConnect').hidden=yes;
    $('googleConnect').textContent=profile?'Reconnect Google Drive':'Sign in with Google';
    $('googleConnect').disabled=signingIn;
    $('googleSwitchAccount').hidden=!profile;
    $('googleSwitchAccount').disabled=signingIn||syncing;
    $('googleDisconnect').hidden=!profile;
    $('googleDisconnect').disabled=signingIn||syncing;
    for(const id of ['googleSync','googleBackup','googleRestore','cloudAutoControl'])$(id).hidden=!yes;
    $('googleSync').disabled=syncing;
    $('cloudAutoBackup').checked=auto;
    clearTimeout(expiryTimer);
    if(yes)expiryTimer=setTimeout(updateUI,expires-Date.now()-30000);
    if(!yes){$('cloudBackupList').hidden=true;clearTimeout(timer);}
  }
  function open(){
    $('cloudBackdrop').hidden=false;updateUI();
    // Keep the sign-in action visible even before website setup. Clicking it
    // explains the missing public client ID instead of appearing broken.
    if(!String(global.WINDS_GOOGLE_CLIENT_ID||'').trim()){
      message('Google sign-in is not enabled for this website yet. The website owner must add a Web OAuth client ID to google-config.js and redeploy.',true);
    }else{
      message(connectionMessage());
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
      if(response.status===401){token=null;expires=0;rememberSession();updateUI();}
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
    const previousSession={token,expires,profile,activeId,auto,remoteSignedOut};
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
      loadAutoPreference();
      message(`Opening ${identity.email}'s personal notebooks…`);
      await bridge.switchWorkspace(identity.sub);
      if(nextGeneration!==generation)return;
      remoteSignedOut=false;rememberSession();rememberAccount();updateUI();
      try{
        if(!bridge.isWriting())await refreshFromDrive(nextGeneration);
        if(nextGeneration!==generation)return;
        message(`Connected to ${identity.email}. Notebook changes sync to this Google account when idle.`);
      }catch(err){
        if(nextGeneration===generation)message(`Your local notebooks are open. ${err.message||'Drive is unavailable; sync will retry when idle.'}`,true);
      }
      localVersion++;
    }catch(err){
      console.error('WiNDS sign-in:',err);
      if(nextGeneration===generation){
        ({token,expires,profile,activeId,auto,remoteSignedOut}=previousSession);
        rememberSession();await bridge.switchWorkspace(profile?.sub||null).catch(()=>{});
        message(err.message||'Could not open this Google account.',true);updateUI();
      }
    }finally{signingIn=false;updateUI();schedule();}
  }
  function connect(switchAccount=false){
    // Initiated directly by a click, required by Google's OAuth popup.
    if(signingIn||syncing)return;
    const clientId=String(global.WINDS_GOOGLE_CLIENT_ID||'').trim();
    if(!clientId){message('Google sign-in is not enabled yet. Ask the website owner to configure a Google OAuth Web client ID in google-config.js and republish.',true);return;}
    if(!global.google?.accounts?.oauth2?.initTokenClient){message('Google Sign-In script is unavailable. Check the internet connection.',true);return;}
    try{
      if(!oauth){oauth=global.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SCOPE,callback:connectCallback,
        error_callback:()=>message('Google authorization did not open or was closed. Select Reconnect or Sign in to try again.',true)});}
      oauth.requestAccessToken(profile&&!switchAccount?{prompt:'',hint:profile.sub}:{prompt:'select_account'});
    }catch(err){console.error(err);message('Unable to open Google authorization. Check the OAuth authorized JavaScript origin.',true);}
  }
  async function restoreSession(){
    const account=rememberedAccount();
    let saved=savedSession()||(account?{...account,token:null,expires:0}:null);
    if(!saved)return;
    const expected=++generation;
    signingIn=true;profile=saved.profile;loadAutoPreference();updateUI();
    try{
      // Reopen this tab's account or the last used account, including offline.
      // The existing account database names and guest migration stay unchanged.
      await bridge.switchWorkspace(profile.sub);
      if(expected!==generation)return;
      message(connectionMessage());
      if(!saved.token || Date.now()>=saved.expires-30000){
        saved=await sessionFromPeer(profile.sub);
        if(!saved||expected!==generation)return;
      }
      const identity=await getProfile(saved.token);
      if(expected!==generation)return;
      if(identity.sub!==saved.profile.sub)throw new Error('Google account changed. Reconnect to verify the account.');
      profile=identity;token=saved.token;expires=saved.expires;
      message(connectionMessage());
      // Sync later through the existing idle guard; never interrupt new writing.
      localVersion++;
    }catch(err){
      if(expected===generation){
        token=null;expires=0;
        message('Your account needs reconnecting. Local notebooks remain on this device. '+(err.message||''),true);
      }
    }finally{
      if(expected===generation){
        signingIn=false;
        if(!connected()){token=null;expires=0;}
        rememberSession();rememberAccount(true);updateUI();schedule();
      }
    }
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
    const previousSub=profile?.sub;
    const previous=token;token=null;profile=null;expires=0;activeId=null;lastSyncedVersion=-1;
    rememberSession();
    try{if(rememberedAccount()?.profile.sub===previousSub)localStorage.removeItem(ACCOUNT_KEY);}catch{}
    publish('signed-out',{sub:previousSub});
    updateUI();message('Signed out. This device’s guest notes are now separate from all Google accounts.');
    try{await bridge.switchWorkspace(null);}catch(err){message('Unable to open local guest notes: '+err.message,true);}
    if(previous&&global.google?.accounts?.oauth2?.revoke){try{global.google.accounts.oauth2.revoke(previous,()=>{});}catch{}}
  }
  async function init(appBridge){
    bridge=appBridge;
    try{deviceId=localStorage.getItem('winds-drive-device-id')||'';if(!deviceId){deviceId=crypto.randomUUID?.()||Math.random().toString(36).slice(2);localStorage.setItem('winds-drive-device-id',deviceId);}}catch{deviceId=Math.random().toString(36).slice(2);}
    $('cloudConnectHome').onclick=open;
    $('cloudClose').onclick=close;
    $('cloudBackdrop').addEventListener('click',e=>{if(e.target===$('cloudBackdrop'))close();});
    $('googleConnect').onclick=()=>connect();
    $('googleSwitchAccount').onclick=()=>connect(true);
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
    initSessionChannel();
    await restoreSession();
  }
  global.WindsDrive=Object.freeze({init,open,onLocalSave});
})(window);
