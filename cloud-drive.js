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
  const AUTO_DELAY_MS=0;
  const AUTO_RETRY_MS=45000;
  const AUTO_POLL_MS=1000;
  const ACTIVE_RECHECK_MS=1000;
  const MAX_BYTES=100*1024*1024;
  const SESSION_KEY='winds-drive-session-v1';
  const ACCOUNT_KEY='winds-drive-last-account-v1';
  const PERSIST_PREFIX='winds-drive-persistent-session-v1-';
  const LOGOUT_PREFIX='winds-drive-logout-v1-';
  const LOGOUT_EVENT='winds-drive-last-logout-event-v1';
  const SERVER_AUTH=global.WINDS_GOOGLE_AUTH_SERVER===true;
  const PENDING_LOGOUT='winds-drive-pending-server-logout-v1';
  // Static hosting: renew the one-hour Google token silently a few minutes early.
  const SILENT_RENEW_BEFORE_MS=5*60*1000;
  const SILENT_RETRY_MS=30*60*1000;
  const $=id=>document.getElementById(id);
  let bridge=null,oauth=null,token=null,expires=0,profile=null,activeId=null,remoteRevision=null;
  let syncing=false,signingIn=false,generation=0,timer=0,expiryTimer=0,lastSync=0;
  let auto=true,localVersion=0,lastSyncedVersion=-1,deviceId='';
  let channel=null,peerRequest=null,remoteSignedOut=false,logoutStamp='';
  let renewalTimer=0,renewing=null,authorizationRequired=false,forceRenewal=false;
  let manualBusy=false,queuedAction=null,driveController=null,uiState='';
  let syncDetails={checked:0,received:0,uploaded:0,elapsed:null};
  let workspaceHistory={id:null,revisions:new Map(),checked:0};
  let silentTimer=0,silentRunning=false,silentRetryAt=0,silentResult=null,lastSyncFailed=false,chipState='';
  const connected=()=>Boolean(token&&profile&&Date.now()<expires-30000);
  const oauthHelper=()=>!SERVER_AUTH&&global.WindsOAuth?.enabled?.()?global.WindsOAuth:null;
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
  function nextSession(){
    generation++;clearTimeout(timer);clearTimeout(renewalTimer);clearTimeout(silentTimer);
    silentRetryAt=0;lastSyncFailed=false;
    workspaceHistory={id:null,revisions:new Map(),checked:0};
    syncDetails={checked:0,received:0,uploaded:0,elapsed:null};
    global.WindsSharing?.cancel();
    global.WindsLive?.stop();
    $('cloudBackupList').hidden=true;
    driveController?.abort();
    driveController=global.AbortController?new global.AbortController():null;
    syncing=false;manualBusy=false;queuedAction=null;
    return generation;
  }
  function sharingSession(){return {profile:connected()?profile:null,version:generation,deviceId};}
  async function runSharingTask(task){
    if(signingIn)return;
    if(!connected()){open();return;}
    if(queueAfterSync(()=>runSharingTask(task)))return;
    const expected=generation;syncing=true;manualBusy=true;updateUI();
    try{await task(sharingSession());}
    catch(error){if(expected===generation)message(error.message||'Notebook sharing is unavailable.',true);}
    finally{if(expected===generation&&!finishOperation(expected))schedule(AUTO_POLL_MS);}
  }
  function queueAfterSync(action){
    if(!syncing)return false;
    queuedAction=action;message('Finishing the current Google Drive request…');return true;
  }
  function finishOperation(expected){
    if(expected!==generation)return false;
    syncing=false;manualBusy=false;updateUI();
    const next=queuedAction;queuedAction=null;
    if(next){clearTimeout(timer);timer=setTimeout(next,0);return true;}
    return false;
  }
  function signedOutElsewhere(sub){
    if(profile?.sub!==sub)return;
    // Stop Drive access without a workspace save or re-render during writing.
    nextSession();token=null;expires=0;remoteSignedOut=true;signingIn=false;
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
        }else if(data.type==='workspace-updated'&&profile?.sub===data.sub&&data.revision!==remoteRevision){
          // A hint only: fetch and verify this account's own Drive file as usual.
          // Never copy another tab's workspace or credentials into this account.
          schedule();
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
  function message(value,error=false){const el=$('cloudMessage');if(el){if(el.textContent!==value)el.textContent=value;el.classList.toggle('error',error);}}
  function updateSyncDetails(){
    const panel=$('cloudSyncDetails');if(!panel)return;
    const hidden=!profile||remoteSignedOut;if(panel.hidden!==hidden)panel.hidden=hidden;
    if(hidden||!panel.open||$('cloudBackdrop').hidden)return;
    const time=value=>value?new Date(value).toLocaleTimeString():'None in this tab yet';
    const values={cloudSyncMode:global.WINDS_REALTIME_ENABLED===true?'Drive + live previews enabled':'Drive only · live previews are not enabled on this site',
      cloudLastChecked:time(syncDetails.checked),cloudLastReceived:time(syncDetails.received),cloudLastUploaded:time(syncDetails.uploaded),
      cloudCycleDuration:syncDetails.elapsed===null?'Waiting for a completed cycle':`${(syncDetails.elapsed/1000).toFixed(2)} seconds`};
    for(const [id,value] of Object.entries(values)){const el=$(id);if(el&&el.textContent!==value)el.textContent=value;}
  }
  function updateUI(){
    updateSyncDetails();
    const yes=connected();
    // Metadata polling does not change account controls. Avoid rewriting the
    // dialog or flashing disabled states at the background polling cadence.
    const next=JSON.stringify([yes,profile?.sub,profile?.email,expires,authorizationRequired,signingIn,manualBusy,auto]);
    if(next===uiState)return;
    uiState=next;
    $('cloudConnection').classList.toggle('connected',yes);
    $('cloudConnectionText').textContent=yes?`Signed in as ${profile.email}`:profile?`${profile.email} · ${SERVER_AUTH&&!authorizationRequired?'Drive sync waiting for connection':'Drive authorization needed'}`:'Not signed in';
    $('cloudEntryLabel').textContent=profile?profile.email:'Sign in with Google';chipState='';
    $('googleConnect').hidden=yes||Boolean(SERVER_AUTH&&profile&&!authorizationRequired);
    $('googleConnect').textContent=profile?'Reconnect Google Drive':'Sign in with Google';
    $('googleConnect').disabled=signingIn;
    $('googleSwitchAccount').hidden=!profile;
    $('googleSwitchAccount').disabled=signingIn;
    $('googleDisconnect').hidden=!profile;
    $('googleDisconnect').disabled=signingIn;
    for(const id of ['googleSync','googleBackup','googleRestore','cloudAutoControl'])$(id).hidden=!yes;
    for(const id of ['googleSync','googleBackup','googleRestore'])$(id).disabled=signingIn||manualBusy;
    const sharedButton=$('googleBrowseShared');
    if(sharedButton){
      sharedButton.hidden=!yes||!global.WindsSharing?.listAvailable;
      sharedButton.disabled=signingIn||manualBusy;
    }
    $('cloudAutoBackup').checked=auto;
    clearTimeout(expiryTimer);
    if(yes)expiryTimer=setTimeout(()=>{updateUI();if(SERVER_AUTH)renewServerSession();else trySilentRenewal();},expires-Date.now()-30000);
    if(!yes){$('cloudBackupList').hidden=true;clearTimeout(timer);}
    updateChip();
  }
  /* Compact sync status for the editor and library header. "Resume sync" is a
   * single tap that reconnects the same account; nothing here runs during
   * active Pencil input. */
  function currentChipState(){
    if(!profile)return 'guest';
    if(remoteSignedOut)return 'signedout';
    if(signingIn)return 'connecting';
    if(SERVER_AUTH&&!connected()&&!authorizationRequired)return 'waiting';
    if(!connected())return 'reconnect';
    if(global.navigator?.onLine===false)return 'offline';
    if(!auto)return 'paused';
    if(lastSyncFailed)return 'retrying';
    return lastSyncedVersion===localVersion?'synced':'syncing';
  }
  const CHIP_TEXT={guest:'',signedout:'Sign in to sync',connecting:'Connecting…',waiting:'Waiting for connection',
    reconnect:'Resume sync',offline:'Offline · saved here',paused:'Sync paused',retrying:'Sync retrying',syncing:'Syncing…',synced:'Synced'};
  const CHIP_TITLE={signedout:'Signed out in another tab. Tap to sign in again.',connecting:'Connecting to Google Drive',
    waiting:'Drive sync resumes automatically when the connection returns',reconnect:'Google Drive access expired. Tap once to reconnect — your notes are saved on this device.',
    offline:'No internet connection. Notes are saved on this device and sync later.',paused:'Automatic sync is paused. Tap for Google Drive options.',
    retrying:'Google Drive did not respond. Retrying automatically; notes are saved on this device.',syncing:'Uploading changes to Google Drive',synced:'All notebooks are saved to Google Drive'};
  function updateChip(){
    const next=currentChipState();
    if(next===chipState)return;
    // Never change header layout while the Pencil is down.
    if(bridge?.isDrawingNow?.()){clearTimeout(updateChip.timer);updateChip.timer=setTimeout(updateChip,1250);return;}
    chipState=next;
    const chip=$('syncChip');
    if(chip){
      chip.hidden=next==='guest';
      chip.className=`sync-chip sync-${next}`;
      chip.title=CHIP_TITLE[next]||'';
      const label=$('syncChipLabel');if(label)label.textContent=CHIP_TEXT[next]||'';
    }
    const entry=$('cloudConnectHome'),attention=next==='reconnect'||next==='signedout';
    if(entry){
      entry.classList?.toggle('needs-attention',attention);
      entry.classList?.toggle('is-synced',next==='synced'||next==='syncing');
      const label=$('cloudEntryLabel'),text=attention?'Resume Drive sync':profile?profile.email:'Sign in with Google';
      if(label&&label.textContent!==text)label.textContent=text;
      const title=attention?CHIP_TITLE[next]:'Google Drive and account';
      if(entry.title!==title)entry.title=title;
    }
  }
  /** Chip action: reconnect the same account in one tap, otherwise open Drive. */
  function resume(){
    const state=currentChipState();
    // The dialog shows progress and any error; connect() still runs inside
    // this tap, as Google's popup requires.
    open();
    if(state==='reconnect'||state==='signedout')connect();
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
    if(bridge.isDrawingNow()||bridge.isEditing?.())return ACTIVE_RECHECK_MS;
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
  async function readDriveText(response,expected,manual=false){
    ensureIdle(expected,manual);
    if(Number(response.headers?.get('content-length')||0)>MAX_BYTES)throw Error('Google Drive data exceeds the 100 MB safety limit.');
    const reader=response.body?.getReader?.();
    if(!reader){
      const text=await response.text();ensureIdle(expected,manual);
      if(text.length>MAX_BYTES)throw Error('Google Drive data exceeds the 100 MB safety limit.');
      return text;
    }
    const decoder=new TextDecoder(),parts=[];
    let bytes=0,finished=false;
    try{
      while(true){
        const chunk=await reader.read();ensureIdle(expected,manual);
        if(chunk.done){finished=true;break;}
        bytes+=chunk.value.byteLength;
        if(bytes>MAX_BYTES)throw Error('Google Drive data exceeds the 100 MB safety limit.');
        parts.push(decoder.decode(chunk.value,{stream:true}));
      }
      parts.push(decoder.decode());
      return parts.join('');
    }finally{
      if(!finished)try{await reader.cancel();}catch{}
      reader.releaseLock();
    }
  }
  async function readDriveJson(response,expected,manual=false){
    const text=await readDriveText(response,expected,manual);
    return JSON.parse(text);
  }
  async function driveRequest(url,options={},expected=generation,manual=false){
    ensureIdle(expected,manual);
    const headers=new Headers(options.headers||{});
    headers.set('Authorization',`Bearer ${token}`);
    const response=await fetch(url,{...options,headers,cache:'no-store',signal:driveController?.signal});
    ensureIdle(expected,manual);
    if(!response.ok){
      const text=await response.text();ensureIdle(expected,manual);
      let reason='',code='';try{const detail=JSON.parse(text).error;reason=detail?.message||'';code=detail?.errors?.[0]?.reason||'';}catch{}
      if(response.status===401){
        token=null;expires=0;rememberSession();persistSession();updateUI();
        if(SERVER_AUTH){forceRenewal=true;scheduleRenewal(1000);}
        else{silentRetryAt=0;scheduleSilentRenewal(1000);}
      }
      const error=new Error(`Google Drive ${response.status}${reason?': '+safeText(reason):''}`);
      error.status=response.status;error.reason=code;throw error;
    }
    return response;
  }
  let pickerLoader=null,activeAccessPicker=null,cancelAccessPicker=null;
  function closeAccessPicker(){cancelAccessPicker?.();cancelAccessPicker=null;activeAccessPicker?.dispose();activeAccessPicker=null;}
  async function authorizeSharedAccess(id,s,parent=null){
    const key=String(global.WINDS_GOOGLE_PICKER_API_KEY||'').trim();
    if(!key)throw Error('The website owner must configure the public Google Picker API key in google-config.js to authorize shared files. See docs/NOTEBOOK_SHARING.md.');
    ensureIdle(s.version,true);
    if(!pickerLoader)pickerLoader=new Promise((resolve,reject)=>{
      const load=()=>global.gapi.load('picker',{callback:resolve,onerror:()=>reject(Error('Google Picker could not load.')),timeout:15000,ontimeout:()=>reject(Error('Google Picker timed out.'))});
      if(global.gapi?.load){load();return;}
      const script=document.createElement('script');script.src='https://apis.google.com/js/api.js';script.onload=load;script.onerror=()=>reject(Error('Google Picker could not load. Check your connection.'));document.head.appendChild(script);
    }).catch(error=>{pickerLoader=null;throw error;});
    await pickerLoader;ensureIdle(s.version,true);
    if(activeAccessPicker)throw Error('Finish the current Google Drive selection first.');
    const picker=global.google.picker,project=String(global.WINDS_GOOGLE_CLIENT_ID||'').split('-')[0];
    if(!/^\d+$/.test(project))throw Error('The Google OAuth client ID must belong to the Picker API project.');
    return new Promise((resolve,reject)=>{
      let finished=false;
      const finish=(error,value)=>{
        if(finished)return;finished=true;
        const current=activeAccessPicker;cancelAccessPicker=null;activeAccessPicker=null;current?.dispose();
        error?reject(error):resolve(value);
      };
      cancelAccessPicker=()=>finish(Error('Account changed or authorization cancelled.'));
      try{
        const view=new picker.DocsView(picker.ViewId.DOCS).setMode(picker.DocsViewMode.LIST).setIncludeFolders(!parent).setSelectFolderEnabled(!parent);
        if(id)view.setFileIds(id);
        else if(parent)view.setParent(parent).setMimeTypes('application/json');
        else view.setOwnedByMe(false).setMimeTypes('application/json,application/vnd.google-apps.folder');
        const title=id?'Authorize this shared notebook for WiNDS Notes':parent?'Select Notebook.json in this shared folder':'Open a shared WiNDS notebook';
        activeAccessPicker=new picker.PickerBuilder().addView(view).setAppId(project).setDeveloperKey(key).setOAuthToken(token).setOrigin(global.location.origin)
          .setTitle(title).setCallback(data=>{
            if(data.action===picker.Action.CANCEL){finish(null,false);return;}
            if(data.action===picker.Action.ERROR){finish(Error('Google Drive could not open its file picker. Try opening it again.'));return;}
            if(data.action!==picker.Action.PICKED)return;
            try{
              ensureIdle(s.version,true);
              const file=data.docs?.length===1?data.docs[0]:null,picked=file?.id;
              if(typeof picked!=='string'||!/^[-\w]{5,200}$/.test(picked)||(id&&picked!==id))throw Error(id?'Select the notebook file shown in the invitation.':'Select one shared WiNDS notebook folder or Notebook.json file.');
              if(file.driveSuccess===false||file.driveError){
                const code=typeof file.driveError==='string'&&/^[\w-]{1,50}$/.test(file.driveError)?` (${file.driveError})`:'';
                throw Error(`Google Drive could not give WiNDS Notes access to the selected item${code}. Select it again in Google Drive.`);
              }
              finish(null,id?true:picked);
            }catch(error){finish(error);}
          }).build();
        activeAccessPicker.setVisible(true);
      }catch(error){finish(error);}
    });
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
        rememberSession();persistSession();updateUI();schedule();global.WindsLive?.start();return true;
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
    if(!result||result.error||!result.access_token){message('Google sign-in was cancelled or incomplete.',true);return false;}
    let succeeded=false;
    const previousSession={token,expires,profile,activeId,auto,remoteSignedOut,logoutStamp};
    const before=logoutEvent();
    const nextGeneration=nextSession();
    signingIn=true;clearTimeout(timer);
    updateUI();
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
      succeeded=true;global.WindsOAuth?.unblockSilent?.(identity.sub);
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
    }finally{if(nextGeneration===generation){signingIn=false;updateUI();schedule();scheduleSilentRenewal();global.WindsSharing?.resume();global.WindsLive?.start();}}
    return succeeded&&nextGeneration===generation;
  }
  /** Accept a silently renewed token for the SAME signed-in account only. */
  async function applyRenewedToken(newToken,expiresIn,expected=generation){
    const sub=profile?.sub,before=logoutEvent();
    if(!sub||remoteSignedOut||typeof newToken!=='string'||!newToken)return false;
    let identity;
    try{identity=await getProfile(newToken);}catch{return false;}
    if(expected!==generation||profile?.sub!==sub||remoteSignedOut)return false;
    if(identity.sub!==sub||loggedOutSince(before,sub)||!currentSession(sessionSnapshot()))return false;
    token=newToken;expires=Date.now()+Math.max(60,Number(expiresIn)||3600)*1000;profile=identity;authorizationRequired=false;
    global.WindsOAuth?.unblockSilent?.(sub);
    rememberSession();persistSession();updateUI();message(connectionMessage());
    // Pick up edits saved while access had expired, through the idle guards.
    localVersion++;schedule();global.WindsSharing?.resume();global.WindsLive?.start();
    return true;
  }
  function scheduleSilentRenewal(delay){
    clearTimeout(silentTimer);
    if(!oauthHelper()||!profile||remoteSignedOut||signingIn)return;
    const wait=delay??(connected()?expires-Date.now()-SILENT_RENEW_BEFORE_MS:silentRetryAt-Date.now());
    silentTimer=setTimeout(()=>trySilentRenewal(),Math.max(1000,wait));
  }
  /* Hidden-iframe renewal while the app is open. Browsers that block Google's
   * cookies in frames (Safari) fail quickly; the next launch then renews with
   * a top-level bounce, or the "Resume sync" chip reconnects in one tap. */
  async function trySilentRenewal(){
    const helper=oauthHelper();
    if(!helper||!profile||remoteSignedOut||signingIn||silentRunning)return false;
    if(connected()&&expires-Date.now()>SILENT_RENEW_BEFORE_MS){scheduleSilentRenewal();return true;}
    if(global.navigator?.onLine===false||document.hidden)return false; // online/visible events retry
    if(Date.now()<silentRetryAt){scheduleSilentRenewal();return false;}
    const probing=!helper.verified();
    if(probing&&!helper.probeDue())return false;
    const wait=idleDelay(false);
    if(wait){scheduleSilentRenewal(wait);return false;}
    const expected=generation,sub=profile.sub;
    silentRunning=true;
    if(probing)helper.noteProbe();
    try{
      const result=await helper.silentIframe({hint:profile.email});
      if(expected!==generation||profile?.sub!==sub)return false;
      if(result.token&&await applyRenewedToken(result.token,result.expiresIn,expected))return true;
      silentRetryAt=Date.now()+SILENT_RETRY_MS;
      return false;
    }finally{
      silentRunning=false;
      if(expected===generation){updateChip();scheduleSilentRenewal();}
    }
  }
  async function connect(switchAccount=false){
    // Initiated directly by a click, required by Google's OAuth popup.
    if(signingIn)return;
    const helper=oauthHelper();
    if(helper?.redirectReady?.()){
      // Same-tab redirect: reliable on iPad (including Home Screen apps) where
      // popups can be blocked. Local notes are saved first.
      signingIn=true;updateUI();message('Opening Google sign-in…');
      try{await bridge.prepareNavigation?.();}
      catch(err){signingIn=false;updateUI();message(err.message||'Finish saving your notes, then try again.',true);return;}
      const fresh=switchAccount||!profile;
      if(helper.begin({mode:'interactive',sub:fresh?null:profile.sub,hint:fresh?null:profile.email,prompt:fresh?'select_account':''}))return;
      signingIn=false;updateUI();
    }
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
    // A launch-time silent renewal returned a fresh token for this account.
    if(saved&&silentResult?.token&&silentResult.sub===saved.profile.sub)
      saved={...saved,token:silentResult.token,expires:Date.now()+silentResult.expiresIn*1000};
    silentResult=null;
    const expected=nextSession();
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
          renewalTimer=setTimeout(()=>restoreSession(),Math.max(ACTIVE_RECHECK_MS,idleDelay()));return;
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
      global.WindsOAuth?.unblockSilent?.(identity.sub);
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
        rememberSession();rememberAccount(true);updateUI();schedule();if(profile)scheduleRenewal();global.WindsSharing?.resume();global.WindsLive?.start();
        // Expired on static hosting: try a hidden renewal once startup is idle.
        if(profile&&!SERVER_AUTH)scheduleSilentRenewal(connected()?undefined:4000);
      }
    }
  }
  /** Handle a completed Google redirect before the normal session restore. */
  async function consumeRedirect(){
    let result=null;
    try{result=SERVER_AUTH?null:global.WindsOAuth?.consume?.()||null;}catch{result=null;}
    if(!result)return false;
    if(result.token&&result.mode==='interactive')return connectCallback({access_token:result.token,expires_in:result.expiresIn});
    if(result.token&&result.mode==='silent'){silentResult=result;return false;}
    // prompt=none could not complete (signed out of Google, consent changed):
    // stop bouncing at launch until this account signs in again.
    if(result.mode==='silent'&&result.sub&&!['no_response','state_mismatch'].includes(result.error))global.WindsOAuth.blockSilent(result.sub,result.error);
    if(result.mode==='interactive'&&result.error&&result.error!=='no_response')
      setTimeout(()=>{open();message(result.error==='access_denied'?'Google sign-in was cancelled. Your notes are safe on this device.':'Google sign-in did not finish. Please try again.',true);},0);
    return false;
  }
  async function listFiles(expected=generation,manual=false,backups=false){
    const found=[];let next='';
    do{
      const key=backups?'windsNotesBackup':'windsNotesWorkspace';
      const q=`trashed = false and appProperties has {key='${key}' and value='1'}`;
      const params=new URLSearchParams({q,fields:'nextPageToken,files(id,name,mimeType,modifiedTime,headRevisionId,appProperties)',pageSize:'100',orderBy:'modifiedTime desc'});
      if(next)params.set('pageToken',next);
      const response=await driveRequest(`${API}?${params}`,{},expected,manual);
      const data=await readDriveJson(response,expected,manual);found.push(...(data.files||[]));next=data.nextPageToken||'';
    }while(next&&found.length<500);
    return found;
  }
  async function findWorkspace(expected,manual){
    if(activeId){
      try{
        const params=new URLSearchParams({fields:'id,name,mimeType,modifiedTime,headRevisionId,appProperties,trashed'});
        const response=await driveRequest(`${API}/${encodeURIComponent(activeId)}?${params}`,{},expected,manual);
        const file=await readDriveJson(response,expected,manual);
        if(!file.trashed&&file.id===activeId&&file.name===WORKSPACE_NAME&&file.appProperties?.windsNotesWorkspace==='1')return file;
      }catch(err){
        // Only a missing file calls for rediscovery. A network/auth/quota error
        // must not be mistaken for an empty Drive and create a duplicate file.
        if(err.status!==404)throw err;
      }
    }
    const files=await listFiles(expected,manual);
    ensureIdle(expected,manual);
    return files.find(f=>f.appProperties?.windsNotesWorkspace==='1'&&f.name===WORKSPACE_NAME);
  }
  async function fetchWorkspace(fileId,expected=generation,manual=false,revision=null){
    const path=revision?`/revisions/${encodeURIComponent(revision)}`:'';
    const response=await driveRequest(`${API}/${encodeURIComponent(fileId)}${path}?alt=media`,{},expected,manual);
    const text=await readDriveText(response,expected,manual);
    const data=JSON.parse(text);
    if(data.format!=='winds-notes-backup'||!Array.isArray(data.notebooks))throw new Error('The Drive workspace file is not a valid WiNDS Notes document.');
    return data;
  }
  async function refreshWorkspaceHistory(workspace,expected,manual){
    if(workspaceHistory.id!==workspace.id)workspaceHistory={id:workspace.id,revisions:new Map(),checked:0};
    const history=workspaceHistory,pinned=[];let page='';
    do{
      const params=new URLSearchParams({fields:'nextPageToken,revisions(id,keepForever,modifiedTime)',pageSize:'100'});if(page)params.set('pageToken',page);
      const response=await driveRequest(`${API}/${encodeURIComponent(workspace.id)}/revisions?${params}`,{},expected,manual);
      const data=await readDriveJson(response,expected,manual);pinned.push(...(data.revisions||[]).filter(r=>r.keepForever));page=data.nextPageToken||'';
      if(pinned.length>200)throw new Error('Too many protected workspace versions. Your local notes remain safe.');
    }while(page);
    const versions=[{id:workspace.headRevisionId},...pinned.filter(r=>r.id!==workspace.headRevisionId)],visible=new Set(versions.map(r=>r.id));
    for(const id of history.revisions.keys())if(!visible.has(id))history.revisions.delete(id);
    const before=localVersion;
    for(const revision of versions){
      let saved=history.revisions.get(revision.id);
      if(!saved){
        try{
          const protectedRevision=pinned.some(r=>r.id===revision.id);
          const data=await fetchWorkspace(workspace.id,expected,manual,protectedRevision?revision.id:null);
          if(!protectedRevision){
            const current=await findWorkspace(expected,manual);
            if(current?.headRevisionId!==workspace.headRevisionId){const error=new Error('The workspace changed while downloading. Retrying safely.');error.syncDeferred=true;throw error;}
          }
          saved={data,applied:false};
        }
        catch(error){if(error.status===404&&revision.id!==workspace.headRevisionId)continue;throw error;}
        history.revisions.set(revision.id,saved);
      }
      if(!saved.applied){
        const merged=await bridge.mergeWorkspace(saved.data,{manual,report:true});ensureIdle(expected,manual);
        saved.applied=true;if(merged?.changed!==false)syncDetails.received=Date.now();
      }
    }
    ensureIdle(expected,manual);
    const head=history.revisions.get(workspace.headRevisionId)?.data;
    if(!head)throw new Error('The latest workspace version is unavailable.');
    if(global.WindsWorkspaceModel.equivalent(bridge.getData(),head)&&before===localVersion)lastSyncedVersion=localVersion;
    else localVersion++;
    // Only discard a pinned version after a newer durable head contains all its
    // causal history (including deletion markers and any recovery notebooks).
    if(pinned.length>=16){let remaining=8;
      const headTime=Date.parse(workspace.modifiedTime);
      for(const revision of pinned){
        const saved=history.revisions.get(revision.id)?.data;
        if(revision.id===workspace.headRevisionId||!(Date.parse(revision.modifiedTime)<headTime)||!saved||!global.WindsWorkspaceModel.covers(head,saved))continue;
        try{await driveRequest(`${API}/${encodeURIComponent(workspace.id)}/revisions/${encodeURIComponent(revision.id)}`,{method:'DELETE'},expected,manual);}
        catch(error){if(error.status===403)break;if(error.status!==404)throw error;}
        history.revisions.delete(revision.id);if(--remaining===0)break;
      }
    }
    history.checked=Date.now();
  }
  async function refreshFromDrive(expected=generation,manual=false){
    const workspace=await findWorkspace(expected,manual);
    ensureIdle(expected,manual);
    const revision=workspace?(workspace.headRevisionId?`${workspace.id}:${workspace.headRevisionId}`:workspace.modifiedTime?`${workspace.id}:${workspace.modifiedTime}`:null):null;
    const changed=workspace&&(activeId!==workspace.id||!revision||remoteRevision!==revision);
    activeId=workspace?.id||null;
    if(workspace?.headRevisionId){
      if(!global.WindsWorkspaceModel)throw new Error('Reload WiNDS Notes to load its sync components.');
      if(changed||Date.now()-workspaceHistory.checked>=10000)await refreshWorkspaceHistory(workspace,expected,manual);
    }else if(changed){
      const data=await fetchWorkspace(workspace.id,expected,manual);
      ensureIdle(expected,manual);
      const versionBefore=localVersion;
      const merged=await bridge.mergeWorkspace(data,{manual,report:true});
      ensureIdle(expected,manual);
      if(merged?.needsUpload===false&&versionBefore===localVersion)lastSyncedVersion=localVersion;
      else if(merged?.needsUpload===true)localVersion++;
      if(merged?.changed!==false)syncDetails.received=Date.now();
    }
    remoteRevision=revision;syncDetails.checked=Date.now();updateSyncDetails();
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
      result=await driveRequest(target+'?uploadType=multipart&fields=id,name,modifiedTime'+(name===WORKSPACE_NAME?'&keepRevisionForever=true':''),{
        method:oldId?'PATCH':'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body
      },expected,manual);
    }else{
      const init=await driveRequest(target+'?uploadType=resumable&fields=id,name,modifiedTime'+(name===WORKSPACE_NAME?'&keepRevisionForever=true':''),{
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
  async function syncWorkspace(expected,manual){
    // Re-read latest Drive state before writing so another device's newly
    // created notebooks are not inadvertently overwritten.
    await refreshFromDrive(expected,manual);
    ensureIdle(expected,manual);
    if(!manual&&activeId&&lastSyncedVersion===localVersion)return;
    const versionAtStart=localVersion;
    const snapshot=bridge.getData();
    const count=snapshot.notebooks.length;
    if(!count&&!Object.keys(snapshot.deleted||{}).length){
      lastSyncedVersion=versionAtStart;
      if(manual)message('There are no notebooks to sync in this account.');
      return;
    }
    ensureIdle(expected,manual);
    const created=await upload(WORKSPACE_NAME,JSON.stringify(snapshot),activeId,{windsNotesWorkspace:'1',windsNotesVersion:'2'},expected,manual);
    ensureIdle(expected,manual);
    activeId=created.id;
    // The revision-based reader will verify this upload's head on the next poll.
    remoteRevision=created.modifiedTime?`${created.id}:${created.modifiedTime}`:null;
    lastSync=Date.now();syncDetails.uploaded=lastSync;lastSyncedVersion=versionAtStart;
    publish('workspace-updated',{sub:profile.sub,revision:remoteRevision});
    if(manual){message(`Synced ${count} notebook${count===1?'':'s'} to ${profile.email}'s Google Drive.`);bridge.toast('Your Google Drive workspace is up to date');}
    else message(`Notebook changes synced automatically to ${profile.email}'s Google Drive.`);
  }
  async function sync(manual=false){
    if(syncing){if(manual)queueAfterSync(()=>sync(true));return;}
    if(signingIn||(!connected()&&!(SERVER_AUTH&&profile&&!authorizationRequired)))return;
    if(!manual && !auto)return;
    const wait=idleDelay(manual);
    if(wait){if(manual)message('Finish writing and local saving, then select Sync now.');schedule(wait);return;}
    if(global.navigator?.onLine===false||document.hidden){schedule(AUTO_RETRY_MS);return;}
    const expected=generation,pollStartedAt=Date.now();
    syncing=true;manualBusy=manual;updateUI();
    if(manual)message('Synchronizing this account’s notebooks with Google Drive…');
    let nextDelay=null;
    try{
      if(SERVER_AUTH&&!connected()&&!await renewServerSession()){nextDelay=AUTO_RETRY_MS;return;}
      if(manual){
        await global.WindsSharing?.sync(sharingSession(),true);
        await syncWorkspace(expected,true);
      }
      else{
        const priority=bridge.sharing?.activeId?.();
        if(priority)await global.WindsSharing?.sync(sharingSession(),false,{only:priority});
        await syncWorkspace(expected,false);
        ensureIdle(expected,false);
        await global.WindsSharing?.sync(sharingSession(),false,{exclude:priority,limit:1});
      }
    }catch(err){
      nextDelay=err.syncDeferred?Math.max(100,idleDelay()):AUTO_RETRY_MS;
      if(expected===generation&&!err.syncDeferred){
        lastSyncFailed=connected();
        console.error('WiNDS Drive sync:',err);
        if(expected===generation){message('Google Drive sync will retry automatically. Your notes remain saved on this device.',true);if(manual)bridge.toast('Google Drive sync failed — your local notes are safe');}
      }
    }finally{
      if(expected===generation&&nextDelay===null){syncDetails.elapsed=Date.now()-pollStartedAt;lastSyncFailed=false;}
      if(expected===generation)updateChip();
      if(expected===generation&&!finishOperation(expected)&&auto){
        // Poll from the start of the previous check: network time must not be
        // followed by another full polling interval. Never overlap requests.
        const delay=nextDelay!==null?nextDelay:lastSyncedVersion!==localVersion?AUTO_DELAY_MS:Math.max(100,AUTO_POLL_MS-(Date.now()-pollStartedAt));
        schedule(delay);
      }
    }
  }
  function schedule(delay=AUTO_DELAY_MS){
    clearTimeout(timer);
    if(!auto||signingIn||remoteSignedOut||(!connected()&&!(SERVER_AUTH&&profile&&!authorizationRequired)))return;
    timer=setTimeout(()=>sync(false),delay);
  }
  function onLocalSave(){
    if(!profile||remoteSignedOut||signingIn)return;
    localVersion++;schedule();global.WindsLive?.refreshRooms();if(SERVER_AUTH&&!connected())scheduleRenewal(AUTO_RETRY_MS);
    updateChip();
  }
  function backupName(){return `WiNDS Notes Backup ${new Date().toISOString().replace(/[:.]/g,'-')}.json`;}
  async function backup(){
    if(!connected()||signingIn||queueAfterSync(backup))return;
    const expected=generation;syncing=true;manualBusy=true;updateUI();
    try{
      message('Creating a dated backup in your own Google Drive…');
      ensureIdle(expected,true);
      const data=JSON.stringify(bridge.getData());
      const result=await upload(backupName(),data,null,{windsNotesBackup:'1',deviceId},expected,true);
      ensureSession(expected);message(`Backup “${result.name}” saved in ${profile.email}'s Drive.`);bridge.toast('Dated Google Drive backup saved');
    }catch(err){if(expected===generation){console.error(err);message(err.message||'Google Drive backup failed.',true);}}
    finally{if(expected===generation&&!finishOperation(expected))schedule(AUTO_POLL_MS);}
  }
  function showDriveList(files,action,choose,emptyMessage){
    const list=$('cloudBackupList');
    list.replaceChildren();
    if(!files.length)list.textContent=emptyMessage;
    for(const file of files){
      const row=document.createElement('div');row.className='cloud-backup-item';
      const title=document.createElement('div');title.textContent=file.name;
      if(file.modifiedTime){
        const time=document.createElement('small');time.textContent=new Date(file.modifiedTime).toLocaleString();
        title.appendChild(time);
      }
      const button=document.createElement('button');button.textContent=action;button.type='button';button.onclick=()=>choose(file);
      row.append(title,button);list.appendChild(row);
    }
    list.hidden=false;
    return list;
  }
  async function browse(){
    if(!connected()||signingIn||queueAfterSync(browse))return;
    const expected=generation;syncing=true;manualBusy=true;updateUI();
    try{
      message('Finding this Google account’s notebook backups…');
      const files=(await listFiles(expected,true,true)).filter(f=>f.appProperties?.windsNotesBackup==='1'&&f.mimeType==='application/json');
      showDriveList(files,'Import copy',file=>{if(expected===generation)return restore(file.id,file.name);},'No dated backups in this account yet.');
      if(files.length)message(`Found ${files.length} dated backup(s). Import creates separate notebooks.`);
    }catch(err){if(expected===generation)message(err.message||'Could not load backups.',true);}
    finally{if(expected===generation&&!finishOperation(expected))schedule(AUTO_POLL_MS);}
  }
  function browseShared(){
    open();
    const sharing=global.WindsSharing,expected=generation;
    if(!sharing?.listAvailable)return;
    return runSharingTask(async s=>{
      if(s.version!==expected||$('cloudBackdrop').hidden)return;
      $('cloudBackupList').hidden=true;
      message('Finding shared WiNDS notebooks in Google Drive…');
      let files=[],listingError=null;
      try{files=await sharing.listAvailable(s);}
      catch(error){if(error.syncDeferred)throw error;listingError=error;}
      ensureSession(expected);
      if($('cloudBackdrop').hidden)return;
      const list=showDriveList(files,'Open notebook',file=>{
        if(expected!==generation)return;
        return runSharingTask(current=>{
          if(current.version!==expected||$('cloudBackdrop').hidden)return;
          close();
          return sharing.openListed(file.id,current);
        });
      },listingError?'The shared notebook list could not load.':'No shared WiNDS notebooks are visible to the app yet.');
      const picker=document.createElement('button');
      picker.type='button';picker.className='btn btn-outline btn-small';picker.textContent='Choose from Google Drive';
      picker.onclick=()=>{
        if(expected!==generation)return;
        close();
        return sharing.pickFromDrive();
      };
      list.appendChild(picker);
      if(listingError)message(listingError.message||'Could not load shared notebooks.',true);
      else message(files.length?'Choose a notebook to open the original and sync edits with its collaborators.':'Choose from Google Drive to grant WiNDS Notes access to a shared notebook.');
    });
  }
  async function restore(id,name){
    if(!connected()||signingIn||queueAfterSync(()=>restore(id,name)))return;
    if(!confirm(`Import “${name}” as new notebook copies into ${profile.email}'s workspace?`))return;
    const expected=generation;syncing=true;manualBusy=true;updateUI();
    try{
      const response=await driveRequest(`${API}/${encodeURIComponent(id)}?alt=media`,{},expected,true);
      const text=await readDriveText(response,expected,true);
      const count=await bridge.importData(text);
      ensureSession(expected);message(`Imported ${count} notebook(s) into ${profile.email}'s workspace.`);
      bridge.toast('Imported editable notebook copies from Google Drive');localVersion++;schedule();
    }catch(err){if(expected===generation)message(err.message||'Could not import this backup.',true);}
    finally{if(expected===generation&&!finishOperation(expected))schedule(AUTO_POLL_MS);}
  }
  async function disconnect(){
    if(signingIn)return;
    nextSession();
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
    if(bridge.live)global.WindsLive?.init({bridge:bridge.live,session:()=>({profile:SERVER_AUTH&&!remoteSignedOut&&!authorizationRequired?profile:null,auto}),
      catchup:()=>schedule(),authLost:()=>{forceRenewal=true;scheduleRenewal(0);}});
    if(bridge.sharing)global.WindsSharing?.init({bridge:bridge.sharing,session:sharingSession,check:(s,manual)=>ensureIdle(s.version,manual),
      authorize:authorizeSharedAccess,pick:(s,parent)=>authorizeSharedAccess(null,s,parent),cancelAuthorization:closeAccessPicker,request:(url,options,s,manual)=>driveRequest(url,options,s.version,manual),read:(response,s,manual)=>readDriveJson(response,s.version,manual),text:(response,s,manual)=>readDriveText(response,s.version,manual),run:runSharingTask,signIn:open,browse:browseShared,
      received:()=>{syncDetails.received=Date.now();updateSyncDetails();},uploaded:()=>{syncDetails.uploaded=Date.now();updateSyncDetails();}});
    try{deviceId=localStorage.getItem('winds-drive-device-id')||'';if(!deviceId){deviceId=crypto.randomUUID?.()||Math.random().toString(36).slice(2);localStorage.setItem('winds-drive-device-id',deviceId);}}catch{deviceId=Math.random().toString(36).slice(2);}
    if($('cloudSyncDetails'))$('cloudSyncDetails').ontoggle=updateSyncDetails;
    $('cloudConnectHome').onclick=resume;
    if($('syncChip'))$('syncChip').onclick=resume;
    $('cloudClose').onclick=close;
    $('cloudBackdrop').addEventListener('click',e=>{if(e.target===$('cloudBackdrop'))close();});
    $('googleConnect').onclick=()=>connect();
    $('googleSwitchAccount').onclick=()=>connect(true);
    $('googleSync').onclick=()=>sync(true);
    $('googleBackup').onclick=backup;
    $('googleRestore').onclick=browse;
    if($('googleBrowseShared'))$('googleBrowseShared').onclick=browseShared;
    $('googleDisconnect').onclick=disconnect;
    $('cloudAutoBackup').onchange=e=>{
      auto=e.target.checked;
      if(profile)try{localStorage.setItem(`winds-drive-auto-${profile.sub}`,String(auto));}catch{}
      if(auto){localVersion++;message('Automatic sync enabled. Cloud uploads happen only after writing and local saving are idle.');schedule();}
      else{clearTimeout(timer);message('Automatic cloud sync paused. Notes are still saved locally and can be synced manually.');}
      global.WindsLive?.start();
    };
    updateUI();
    global.addEventListener?.('storage',event=>{
      if(profile&&event.key===LOGOUT_PREFIX+profile.sub&&!currentSession(sessionSnapshot()))signedOutElsewhere(profile.sub);
    });
    const resumeSync=()=>{
      updateChip();
      if(SERVER_AUTH&&!connected())scheduleRenewal(0);
      else if(!SERVER_AUTH&&profile&&(!connected()||expires-Date.now()<SILENT_RENEW_BEFORE_MS))scheduleSilentRenewal(1500);
      schedule();
    };
    global.addEventListener?.('offline',updateChip);
    global.addEventListener?.('online',resumeSync);
    global.addEventListener?.('focus',resumeSync);
    global.addEventListener?.('pageshow',resumeSync);
    document.addEventListener?.('visibilitychange',()=>{if(!document.hidden)resumeSync();});
    initSessionChannel();
    if(!SERVER_AUTH&&await global.WindsOAuth?.launching?.()){
      // This page is leaving for a launch-time renewal. If the Back gesture
      // restores it from memory, continue with the saved session instead.
      global.addEventListener?.('pageshow',event=>{if(event.persisted)restoreSession();});
      return;
    }
    if(await consumeRedirect())return;
    await restoreSession();
  }
  global.WindsDrive=Object.freeze({init,open,onLocalSave,resume,status:()=>currentChipState()});
})(window);
