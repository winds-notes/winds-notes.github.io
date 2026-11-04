/* WiNDS Notes · Google Drive per-account workspace.
 * Static-hosted OAuth with Google Identity Services. One public OAuth client ID
 * serves all users, but the OAuth access token grants access ONLY to the
 * user's own Google Drive files. Account sessions persist on this browser until
 * logout. Access tokens retain Google's original expiry; passwords and refresh
 * tokens are never stored in the browser or included in source files.
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
  const AUTO_POLL_MS=60000;
  const MAX_BYTES=100*1024*1024;
  const SESSION_KEY='winds-drive-session-v1';
  const ACCOUNT_KEY='winds-drive-last-account-v1';
  const PERSIST_PREFIX='winds-drive-persistent-session-v1-';
  const LOGOUT_PREFIX='winds-drive-logout-v1-';
  const LOGOUT_EVENT='winds-drive-last-logout-event-v1';
  const SERVER_AUTH=global.WINDS_GOOGLE_AUTH_SERVER===true;
  const PENDING_LOGOUT='winds-drive-pending-server-logout-v1';
  const $=id=>document.getElementById(id);
  let bridge=null,oauth=null,token=null,expires=0,profile=null,activeId=null,remoteRevision=null;
  let syncing=false,signingIn=false,generation=0,timer=0,expiryTimer=0,lastSync=0;
  let auto=true,localVersion=0,lastSyncedVersion=-1,deviceId='';
  let channel=null,peerRequest=null,remoteSignedOut=false,logoutStamp='';
  let renewalTimer=0,renewing=null,authorizationRequired=false,forceRenewal=false;
  const connected=()=>Boolean(token&&profile&&Date.now()<expires-30000);
  const safeText=s=>String(s||'').replace(/[\u0000-\u001F]/g,' ').slice(0,110);
  function currentLogoutStamp(sub){
    try{return localStorage.getItem(LOGOUT_PREFIX+sub)||'';}catch{return '';}
  }
  function logoutEvent(){try{return localStorage.getItem(LOGOUT_EVENT)||'';}catch{return '';}}
  function loggedOutSince(before,sub){
    const current=logoutEvent();
    try{return current!==before&&JSON.parse(current)?.sub===sub;}catch{return false;}
  }
  function currentSession(saved){
    return (saved.logoutStamp||'')===currentLogoutStamp(saved.profile.sub);
  }
  function sessionSnapshot(){
    return {clientId:global.WINDS_GOOGLE_CLIENT_ID,profile,token,expires,logoutStamp};
  }
  function rememberSession(){
    try{
      if(profile&&!remoteSignedOut)global.sessionStorage.setItem(SESSION_KEY,JSON.stringify(sessionSnapshot()));
      else global.sessionStorage.removeItem(SESSION_KEY);
    }catch{} // Storage may be blocked; the current in-memory connection still works.
  }
  function persistSession(){
    if(!profile||remoteSignedOut||!currentSession(sessionSnapshot()))return;
    const saved=sessionSnapshot();
    if(SERVER_AUTH){saved.token=null;saved.expires=0;}
    try{localStorage.setItem(PERSIST_PREFIX+profile.sub,JSON.stringify(saved));}catch{}
  }
  function validProfile(value){
    return value&&typeof value.sub==='string'&&/^[0-9]{5,30}$/.test(value.sub)&&
      typeof value.email==='string'&&Boolean(value.email);
  }
  function validSession(value){
    return value&&value.clientId===global.WINDS_GOOGLE_CLIENT_ID&&validProfile(value.profile)&&
      (value.token===null||typeof value.token==='string')&&Number.isFinite(value.expires)&&
      (value.logoutStamp===undefined||typeof value.logoutStamp==='string');
  }
  function savedSession(){
    try{
      const saved=JSON.parse(global.sessionStorage.getItem(SESSION_KEY));
      if(!saved)return null;
      if(!validSession(saved)||!currentSession(saved))throw new Error('Invalid saved Google session');
      return saved;
    }catch{try{global.sessionStorage.removeItem(SESSION_KEY);}catch{}return null;}
  }
  function persistentSession(sub){
    try{
      const saved=JSON.parse(localStorage.getItem(PERSIST_PREFIX+sub));
      if(validSession(saved)&&saved.profile.sub===sub&&currentSession(saved))return saved;
    }catch{}
    return null;
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
  function signedOutElsewhere(sub){
    if(profile?.sub!==sub)return;
    // Stop Drive access without a workspace save or re-render during writing.
    generation++;token=null;expires=0;remoteSignedOut=true;signingIn=false;clearTimeout(renewalTimer);
    peerRequest?.finish(null);rememberSession();updateUI();
    message('Signed out in another tab. Your local notebooks remain open; sign in to resume Drive sync.');
  }
  function initSessionChannel(){
    if(!global.BroadcastChannel)return;
    try{
      channel=new global.BroadcastChannel(SESSION_KEY);
      channel.onmessage=event=>{
        const data=event.data;
        if(!data||data.clientId!==global.WINDS_GOOGLE_CLIENT_ID)return;
        if(data.type==='request-session'&&connected()&&!signingIn&&data.sub===profile.sub&&typeof data.requestId==='string'){
          if(currentSession(sessionSnapshot()))publish('session',{requestId:data.requestId,session:sessionSnapshot()});
        }else if(data.type==='session'&&peerRequest&&data.requestId===peerRequest.id&&
          validSession(data.session)&&data.session.profile.sub===peerRequest.sub&&
          currentSession(data.session)&&data.session.token&&Date.now()<data.session.expires-30000){
          peerRequest.finish(data.session);
        }else if(data.type==='signed-out'&&profile?.sub===data.sub){
          signedOutElsewhere(data.sub);
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
    if(connected()){
      const status=auto?'Automatic sync is on and waits until writing and local saving are idle.':'Automatic sync is paused. Select Sync notebooks now to upload changes.';
      return `This is ${profile.email}'s private workspace. ${status}${lastSync?' Last synced at '+new Date(lastSync).toLocaleTimeString()+'.':''}`;
    }
    if(SERVER_AUTH&&profile&&!authorizationRequired)return `Your account ${profile.email} is remembered. Drive sync will resume automatically when a connection is available.`;
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
    $('cloudConnectionText').textContent=yes?`Signed in as ${profile.email}`:profile?`${profile.email} · ${SERVER_AUTH&&!authorizationRequired?'Drive sync waiting for connection':'Drive authorization needed'}`:'Not signed in';
    $('cloudEntryLabel').textContent=profile?profile.email:'Sign in with Google';
    $('googleConnect').hidden=yes||Boolean(SERVER_AUTH&&profile&&!authorizationRequired);
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
    if(yes)expiryTimer=setTimeout(()=>{updateUI();if(SERVER_AUTH)renewServerSession();},expires-Date.now()-30000);
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
    if(profile&&!currentSession(sessionSnapshot()))signedOutElsewhere(profile.sub);
    if(expected!==generation||!connected())throw new Error('Account changed or Google sign-in expired. Please reconnect.');
  }
  function idleDelay(manual=false){
    if(bridge.isDrawingNow()||bridge.isEditing?.())return AUTO_RETRY_MS;
    if(bridge.isSaving?.())return 1000;
    if(!manual){
      if(bridge.syncIdleDelay)return Math.max(0,bridge.syncIdleDelay());
      if(bridge.isWriting())return AUTO_RETRY_MS;
    }
    return 0;
  }
  function ensureIdle(expected,manual=false){
    ensureSession(expected);
    if(idleDelay(manual)){
      const error=new Error('Google Drive sync is waiting for writing and local saving to finish.');
      error.syncDeferred=true;throw error;
    }
  }
  async function readDriveJson(response,expected,manual=false){
    ensureIdle(expected,manual);
    const text=await response.text();
    ensureIdle(expected,manual);
    return JSON.parse(text);
  }
  async function driveRequest(url,options={},expected=generation,manual=false){
    ensureIdle(expected,manual);
    const headers=new Headers(options.headers||{});
    headers.set('Authorization',`Bearer ${token}`);
    const response=await fetch(url,{...options,headers});
    ensureIdle(expected,manual);
    if(!response.ok){
      const text=await response.text();ensureIdle(expected,manual);
      let reason='';try{reason=JSON.parse(text).error?.message||'';}catch{}
      if(response.status===401){
        token=null;expires=0;rememberSession();persistSession();updateUI();
        if(SERVER_AUTH){forceRenewal=true;scheduleRenewal(1000);}
      }
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
  function pendingLogouts(){
    try{const list=JSON.parse(localStorage.getItem(PENDING_LOGOUT)||'[]');return Array.isArray(list)?list.filter(sub=>typeof sub==='string'&&/^[0-9]{5,30}$/.test(sub)):[];}catch{return [];}
  }
  async function finishServerLogouts(){
    for(const sub of pendingLogouts()){
      const response=await fetch('/auth/google/logout',{method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Winds-Request':'1'},body:JSON.stringify({account:sub})});
      if(!response.ok)throw new Error('Server sign-out will finish when the connection is restored.');
      try{localStorage.setItem(PENDING_LOGOUT,JSON.stringify(pendingLogouts().filter(value=>value!==sub)));}catch{}
    }
  }
  async function getServerSession(sub,force=false){
    const before=logoutEvent();
    const params=new URLSearchParams();if(sub)params.set('account',sub);if(force)params.set('force','1');
    const query=params.toString();
    const response=await fetch('/auth/google/session'+(query?'?'+query:''),{
      credentials:'same-origin',cache:'no-store',headers:{'X-Winds-Request':'1'}
    });
    if(!response.ok){
      const error=new Error(response.status===401?'Google authorization needs attention. Your local notebooks are still available.':'Drive is temporarily unavailable. Your account is still remembered.');
      error.authorizationRequired=response.status===401;throw error;
    }
    const data=await response.json();
    if(loggedOutSince(before,data.profile?.sub)){
      const error=new Error('Signed out in another tab.');error.signedOut=true;throw error;
    }
    if(!validProfile(data.profile)||(sub&&data.profile.sub!==sub)||typeof data.access_token!=='string'||!Number.isFinite(data.expires)||data.expires<=Date.now())throw new Error('Could not verify the saved Google session.');
    return {clientId:global.WINDS_GOOGLE_CLIENT_ID,profile:data.profile,token:data.access_token,expires:data.expires,logoutStamp:currentLogoutStamp(data.profile.sub)};
  }
  function scheduleRenewal(delay){
    clearTimeout(renewalTimer);
    if(!SERVER_AUTH||!profile||remoteSignedOut||authorizationRequired)return;
    renewalTimer=setTimeout(()=>renewServerSession(),delay??(forceRenewal?1000:connected()?Math.max(1000,expires-Date.now()-60000):AUTO_RETRY_MS));
  }
  async function renewServerSession(){
    if(renewing)return renewing;
    if(!SERVER_AUTH||!profile||remoteSignedOut||authorizationRequired)return false;
    if(idleDelay()){scheduleRenewal(idleDelay());return false;}
    const expected=generation,sub=profile.sub;
    renewing=(async()=>{
      try{
        const forced=forceRenewal,saved=await getServerSession(sub,forced);
        if(expected!==generation||!currentSession(sessionSnapshot()))return false;
        token=saved.token;expires=saved.expires;authorizationRequired=false;
        if(forced)forceRenewal=false;
        rememberSession();persistSession();updateUI();schedule();return true;
      }catch(err){
        if(err.signedOut)signedOutElsewhere(sub);
        if(expected===generation){
          if(err.authorizationRequired){token=null;expires=0;authorizationRequired=true;}
          message(err.message,true);updateUI();
        }
        return false;
      }finally{renewing=null;scheduleRenewal();}
    })();
    return renewing;
  }
  async function connectCallback(result){
    if(!result||result.error||!result.access_token){message('Google sign-in was cancelled or incomplete.',true);return;}
    const previousSession={token,expires,profile,activeId,auto,remoteSignedOut,logoutStamp};
    const before=logoutEvent();
    const nextGeneration=++generation;
    signingIn=true;clearTimeout(timer);
    const newToken=result.access_token;
    const newExpires=Date.now()+Math.max(60,Number(result.expires_in)||3600)*1000;
    try{
      message('Verifying your Google account…');
      const identity=await getProfile(newToken);
      if(nextGeneration!==generation)return;
      if(loggedOutSince(before,identity.sub))throw new Error('Signed out in another tab. Select Sign in to start a new session.');
      // No account workspace is opened until we know the verified Google ID.
      // Save and close the previous account first, then load the new one.
      token=newToken;expires=newExpires;profile=identity;activeId=null;remoteRevision=null;lastSync=0;
      logoutStamp=currentLogoutStamp(identity.sub);
      loadAutoPreference();
      message(`Opening ${identity.email}'s personal notebooks…`);
      await bridge.switchWorkspace(identity.sub);
      if(nextGeneration!==generation)return;
      remoteSignedOut=false;rememberSession();persistSession();rememberAccount();updateUI();
      try{
        if(!bridge.isWriting())await refreshFromDrive(nextGeneration);
        if(nextGeneration!==generation)return;
        message(`Connected to ${identity.email}. Notebook changes sync to this Google account when idle.`);
      }catch(err){
        if(nextGeneration===generation&&!err.syncDeferred)message(`Your local notebooks are open. ${err.message||'Drive is unavailable; sync will retry when idle.'}`,true);
      }
      localVersion++;
    }catch(err){
      console.error('WiNDS sign-in:',err);
      if(nextGeneration===generation){
        ({token,expires,profile,activeId,auto,remoteSignedOut,logoutStamp}=previousSession);
        rememberSession();await bridge.switchWorkspace(profile?.sub||null).catch(()=>{});
        message(err.message||'Could not open this Google account.',true);updateUI();
      }
    }finally{signingIn=false;updateUI();schedule();}
  }
  async function connect(switchAccount=false){
    // Initiated directly by a click, required by Google's OAuth popup.
    if(signingIn||syncing)return;
    if(SERVER_AUTH){
      try{
        await finishServerLogouts();
        const params=new URLSearchParams();
        if(switchAccount)params.set('switch','1');else if(profile)params.set('account',profile.sub);
        const query=params.toString();global.location.assign('/auth/google/start'+(query?'?'+query:''));
      }catch(err){message(err.message||'Connect to the internet to sign in.',true);}
      return;
    }
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
    if(!saved&&!SERVER_AUTH)return;
    if(saved)saved=persistentSession(saved.profile.sub)||saved;
    const expected=++generation;
    signingIn=true;
    if(saved){profile=saved.profile;logoutStamp=saved.logoutStamp||currentLogoutStamp(profile.sub);loadAutoPreference();}
    updateUI();
    try{
      // Local notebooks can reopen offline even if the session server is down.
      const openedSub=SERVER_AUTH&&saved?profile.sub:null;
      if(openedSub)await bridge.switchWorkspace(openedSub);
      if(SERVER_AUTH){
        await finishServerLogouts();
        saved=await getServerSession(profile?.sub);
        if(expected!==generation)return;
        if(!profile&&bridge.isWriting()){
          renewalTimer=setTimeout(()=>restoreSession(),AUTO_RETRY_MS);return;
        }
        profile=saved.profile;logoutStamp=saved.logoutStamp;loadAutoPreference();
      }
      // Reopen this tab's account or the last used account, including offline.
      // The existing account database names and guest migration stay unchanged.
      if(profile.sub!==openedSub)await bridge.switchWorkspace(profile.sub);
      if(expected!==generation)return;
      message(connectionMessage());
      if(!saved.token || Date.now()>=saved.expires-30000){
        saved=await sessionFromPeer(profile.sub);
        if(!saved||expected!==generation)return;
      }
      const identity=SERVER_AUTH?saved.profile:await getProfile(saved.token);
      if(expected!==generation)return;
      if(!currentSession(saved)){signedOutElsewhere(profile.sub);return;}
      if(identity.sub!==saved.profile.sub)throw new Error('Google account changed. Reconnect to verify the account.');
      profile=identity;token=saved.token;expires=saved.expires;
      logoutStamp=saved.logoutStamp||'';persistSession();
      message(connectionMessage());
      // Sync later through the existing idle guard; never interrupt new writing.
      localVersion++;
    }catch(err){
      if(err.signedOut&&profile)signedOutElsewhere(profile.sub);
      if(expected===generation){
        token=null;expires=0;
        authorizationRequired=Boolean(err.authorizationRequired);
        message(err.message||'Local notebooks remain on this device. Drive sync is unavailable.',true);
      }
    }finally{
      if(expected===generation){
        signingIn=false;
        if(!connected()){token=null;expires=0;}
        rememberSession();rememberAccount(true);updateUI();schedule();if(profile)scheduleRenewal();
      }
    }
  }
  async function listFiles(expected=generation,manual=false){
    const found=[];let next='';
    do{
      const q="trashed = false and (appProperties has {key='windsNotesWorkspace' and value='1'} or appProperties has {key='windsNotesBackup' and value='1'})";
      const params=new URLSearchParams({q,fields:'nextPageToken,files(id,name,mimeType,modifiedTime,size,appProperties)',pageSize:'100',orderBy:'modifiedTime desc'});
      if(next)params.set('pageToken',next);
      const response=await driveRequest(`${API}?${params}`,{},expected,manual);
      const data=await readDriveJson(response,expected,manual);found.push(...(data.files||[]));next=data.nextPageToken||'';
    }while(next&&found.length<500);
    return found;
  }
  async function fetchWorkspace(fileId,expected=generation,manual=false){
    const response=await driveRequest(`${API}/${encodeURIComponent(fileId)}?alt=media`,{},expected,manual);
    const length=Number(response.headers.get('content-length')||0);
    if(length>MAX_BYTES)throw new Error('This Google Drive workspace is too large to open safely.');
    const text=await response.text();ensureIdle(expected,manual);
    if(text.length>MAX_BYTES)throw new Error('The Drive workspace exceeds the 100 MB safety limit.');
    const data=JSON.parse(text);
    if(data.format!=='winds-notes-backup'||!Array.isArray(data.notebooks))throw new Error('The Drive workspace file is not a valid WiNDS Notes document.');
    return data;
  }
  async function refreshFromDrive(expected=generation,manual=false){
    const files=await listFiles(expected,manual);
    ensureIdle(expected,manual);
    const workspace=files.find(f=>f.appProperties?.windsNotesWorkspace==='1'&&f.name===WORKSPACE_NAME);
    const revision=workspace?.modifiedTime?`${workspace.id}:${workspace.modifiedTime}`:null;
    const changed=workspace&&(activeId!==workspace.id||!revision||remoteRevision!==revision);
    activeId=workspace?.id||null;
    if(changed){
      const data=await fetchWorkspace(workspace.id,expected,manual);
      ensureIdle(expected,manual);
      await bridge.mergeWorkspace(data,{manual});
      ensureIdle(expected,manual);
    }
    remoteRevision=revision;
    return workspace;
  }
  async function upload(name,content,oldId,properties,expected=generation,manual=false){
    ensureIdle(expected,manual);
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
      },expected,manual);
    }else{
      const init=await driveRequest(target+'?uploadType=resumable&fields=id,name,modifiedTime',{
        method:oldId?'PATCH':'POST',
        headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(blob.size)},
        body:JSON.stringify(metadata)
      },expected,manual);
      const location=init.headers.get('Location');
      if(!location||!location.startsWith('https://www.googleapis.com/'))throw new Error('Drive did not provide an authorized upload URL.');
      result=await driveRequest(location,{method:'PUT',headers:{'Content-Type':'application/json'},body:blob},expected,manual);
    }
    return readDriveJson(result,expected,manual);
  }
  async function sync(manual=false){
    if(syncing){schedule(AUTO_RETRY_MS);return;}
    if(signingIn||(!connected()&&!(SERVER_AUTH&&profile&&!authorizationRequired)))return;
    if(!manual && !auto)return;
    const wait=idleDelay(manual);
    if(wait){if(manual)message('Finish writing and local saving, then select Sync now.');schedule(wait);return;}
    if(global.navigator?.onLine===false||document.hidden){schedule(AUTO_RETRY_MS);return;}
    const expected=generation;
    syncing=true;updateUI();
    if(manual)message('Synchronizing this account’s notebooks with Google Drive…');
    let nextDelay=AUTO_POLL_MS;
    try{
      if(SERVER_AUTH&&!connected()&&!await renewServerSession()){nextDelay=AUTO_RETRY_MS;return;}
      // Re-read latest Drive state before writing so another device's newly
      // created notebooks are not inadvertently overwritten.
      await refreshFromDrive(expected,manual);
      ensureIdle(expected,manual);
      if(!manual&&activeId&&lastSyncedVersion===localVersion)return;
      const versionAtStart=localVersion;
      const snapshot=bridge.getData();
      if(!snapshot.notebooks.length&&!Object.keys(snapshot.deleted||{}).length){
        lastSyncedVersion=versionAtStart;
        if(manual)message('There are no notebooks to sync in this account.');
        return;
      }
      ensureIdle(expected,manual);
      const created=await upload(WORKSPACE_NAME,JSON.stringify(snapshot),activeId,{windsNotesWorkspace:'1',windsNotesVersion:'2'},expected,manual);
      ensureIdle(expected,manual);
      activeId=created.id;
      remoteRevision=created.modifiedTime?`${created.id}:${created.modifiedTime}`:null;
      lastSync=Date.now();lastSyncedVersion=versionAtStart;
      if(manual){message(`Synced ${snapshot.notebooks.length} notebook${snapshot.notebooks.length===1?'':'s'} to ${profile.email}'s Google Drive.`);bridge.toast('Your Google Drive workspace is up to date');}
      else message(`Notebook changes synced automatically to ${profile.email}'s Google Drive.`);
    }catch(err){
      nextDelay=err.syncDeferred?Math.max(1000,idleDelay()):AUTO_RETRY_MS;
      if(!err.syncDeferred){
        console.error('WiNDS Drive sync:',err);
        if(expected===generation){message('Google Drive sync will retry automatically. Your notes remain saved on this device.',true);if(manual)bridge.toast('Google Drive sync failed — your local notes are safe');}
      }
    }finally{
      syncing=false;updateUI();
      if(expected===generation&&auto)schedule(nextDelay===AUTO_POLL_MS&&lastSyncedVersion!==localVersion?AUTO_DELAY_MS:nextDelay);
    }
  }
  function schedule(delay=AUTO_DELAY_MS){
    clearTimeout(timer);
    if(!auto||signingIn||remoteSignedOut||(!connected()&&!(SERVER_AUTH&&profile&&!authorizationRequired)))return;
    timer=setTimeout(()=>sync(false),delay);
  }
  function onLocalSave(){
    if(!profile||remoteSignedOut||signingIn)return;
    localVersion++;schedule();if(SERVER_AUTH&&!connected())scheduleRenewal(AUTO_RETRY_MS);
  }
  function backupName(){return `WiNDS Notes Backup ${new Date().toISOString().replace(/[:.]/g,'-')}.json`;}
  async function backup(){
    if(!connected()||syncing)return;
    const expected=generation;syncing=true;$('googleBackup').disabled=true;
    try{
      message('Creating a dated backup in your own Google Drive…');
      ensureIdle(expected,true);
      const data=JSON.stringify(bridge.getData());
      const result=await upload(backupName(),data,null,{windsNotesBackup:'1',deviceId},expected,true);
      ensureSession(expected);message(`Backup “${result.name}” saved in ${profile.email}'s Drive.`);bridge.toast('Dated Google Drive backup saved');
    }catch(err){console.error(err);message(err.message||'Google Drive backup failed.',true);}
    finally{syncing=false;$('googleBackup').disabled=false;updateUI();}
  }
  async function browse(){
    if(!connected()||syncing)return;
    const expected=generation;syncing=true;$('googleRestore').disabled=true;
    try{
      message('Finding this Google account’s notebook backups…');
      const files=(await listFiles(expected,true)).filter(f=>f.appProperties?.windsNotesBackup==='1'&&f.mimeType==='application/json');
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
      const response=await driveRequest(`${API}/${encodeURIComponent(id)}?alt=media`,{},expected,true);
      const text=await response.text();ensureIdle(expected,true);
      const count=await bridge.importData(text);
      ensureSession(expected);message(`Imported ${count} notebook(s) into ${profile.email}'s workspace.`);
      bridge.toast('Imported editable notebook copies from Google Drive');localVersion++;schedule();
    }catch(err){if(expected===generation)message(err.message||'Could not import this backup.',true);}
    finally{syncing=false;updateUI();}
  }
  async function disconnect(){
    if(signingIn)return;
    generation++;clearTimeout(timer);clearTimeout(renewalTimer);
    const previousSub=profile?.sub;
    if(SERVER_AUTH&&previousSub)try{localStorage.setItem(PENDING_LOGOUT,JSON.stringify([...new Set([...pendingLogouts(),previousSub])]));}catch{}
    try{
      if(previousSub){
        const stamp=crypto.randomUUID?.()||Math.random().toString(36).slice(2);
        localStorage.setItem(LOGOUT_PREFIX+previousSub,stamp);
        localStorage.setItem(LOGOUT_EVENT,JSON.stringify({sub:previousSub,stamp}));
        localStorage.removeItem(PERSIST_PREFIX+previousSub);
      }
    }catch{}
    const previous=token;token=null;profile=null;expires=0;activeId=null;remoteRevision=null;lastSyncedVersion=-1;lastSync=0;
    rememberSession();
    try{if(rememberedAccount()?.profile.sub===previousSub)localStorage.removeItem(ACCOUNT_KEY);}catch{}
    publish('signed-out',{sub:previousSub});
    updateUI();message('Signed out. This device’s guest notes are now separate from all Google accounts.');
    try{await bridge.switchWorkspace(null);}catch(err){message('Unable to open local guest notes: '+err.message,true);}
    if(SERVER_AUTH){try{await finishServerLogouts();}catch(err){message('Signed out on this device. '+err.message,true);}}
    else if(previous&&global.google?.accounts?.oauth2?.revoke){try{global.google.accounts.oauth2.revoke(previous,()=>{});}catch{}}
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
    global.addEventListener?.('storage',event=>{
      if(profile&&event.key===LOGOUT_PREFIX+profile.sub&&!currentSession(sessionSnapshot()))signedOutElsewhere(profile.sub);
    });
    const resumeSync=()=>{if(SERVER_AUTH&&!connected())scheduleRenewal(1000);schedule(1000);};
    global.addEventListener?.('online',resumeSync);
    global.addEventListener?.('pageshow',resumeSync);
    document.addEventListener?.('visibilitychange',()=>{if(!document.hidden)resumeSync();});
    initSessionChannel();
    await restoreSession();
  }
  global.WindsDrive=Object.freeze({init,open,onLocalSave});
})(window);
