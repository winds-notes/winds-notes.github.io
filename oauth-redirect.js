/* WiNDS Notes · silent Google Drive reconnection for static hosting.
 *
 * Google's browser-only token flow issues one-hour access tokens without a
 * refresh token. This module renews them without a popup, using Google's
 * documented OAuth 2.0 client-side redirect flow with prompt=none:
 *
 *  - at launch, an expired account session makes one quick top-level bounce
 *    through Google and back to oauth-callback.html (no UI when the user is
 *    still signed in to Google and has granted access before);
 *  - while the app is open, a hidden iframe attempts the same silent request
 *    (works where the browser allows Google's sign-in cookies in frames).
 *
 * Safety:
 *  - Google shows an error page instead of redirecting when the callback URL
 *    is not registered for the OAuth client. Top-level redirects therefore run
 *    only after this device has received a real response from the callback
 *    (an iframe probe can never strand the user) or when the site owner sets
 *    WINDS_GOOGLE_REDIRECT_URI explicitly in google-config.js.
 *  - Every request carries a random state value that must match on return.
 *  - A failed silent attempt is not retried at launch until the account signs
 *    in again; launch bounces are rate limited, and an attempt that never
 *    returned disables top-level redirects on this device.
 *  - Nothing here runs from Pencil input handlers. No refresh tokens or
 *    secrets exist in the browser.
 */
(function(global){
  'use strict';
  const AUTH_ENDPOINT='https://accounts.google.com/o/oauth2/v2/auth';
  const SCOPE='openid email profile https://www.googleapis.com/auth/drive.file';
  const PENDING_KEY='winds-oauth-pending-v1';
  const RESULT_KEY='winds-oauth-result-v1';
  const VERIFIED_KEY='winds-oauth-redirect-verified-v1';
  const BROKEN_KEY='winds-oauth-redirect-broken-v1';
  const LAUNCH_AT_KEY='winds-oauth-launch-at-v1';
  const PROBE_AT_KEY='winds-oauth-probe-at-v1';
  const BLOCKED_PREFIX='winds-oauth-silent-blocked-v1-';
  // Existing cloud-drive.js storage keys (read-only here).
  const SESSION_KEY='winds-drive-session-v1';
  const ACCOUNT_KEY='winds-drive-last-account-v1';
  const PERSIST_PREFIX='winds-drive-persistent-session-v1-';
  const LOGOUT_PREFIX='winds-drive-logout-v1-';
  const RENEW_BEFORE_MS=5*60*1000;
  const LAUNCH_GAP_MS=3*60*1000;
  const PENDING_TTL_MS=10*60*1000;
  const PROBE_GAP_MS=6*60*60*1000;
  const BROKEN_TTL_MS=24*60*60*1000;
  const IFRAME_TIMEOUT_MS=12000;
  const SUB_PATTERN=/^[0-9]{5,30}$/;

  const ls={
    get(key){try{return global.localStorage.getItem(key);}catch{return null;}},
    set(key,value){try{global.localStorage.setItem(key,value);return true;}catch{return false;}},
    remove(key){try{global.localStorage.removeItem(key);}catch{}}
  };
  const ss={
    get(key){try{return global.sessionStorage.getItem(key);}catch{return null;}},
    set(key,value){try{global.sessionStorage.setItem(key,value);return true;}catch{return false;}},
    remove(key){try{global.sessionStorage.removeItem(key);}catch{}}
  };
  const json=value=>{try{return JSON.parse(value);}catch{return null;}};
  const now=()=>Date.now();
  const clientId=()=>String(global.WINDS_GOOGLE_CLIENT_ID||'').trim();

  function configuredUri(){
    const value=String(global.WINDS_GOOGLE_REDIRECT_URI||'').trim();
    if(!value)return '';
    try{const url=new URL(value,global.location.href);return url.origin===global.location.origin?url.origin+url.pathname:'';}catch{return '';}
  }
  function redirectUri(){
    const configured=configuredUri();
    if(configured)return configured;
    try{const url=new URL('./oauth-callback.html',global.location.href);return url.origin+url.pathname;}catch{return '';}
  }
  function secureContext(){
    const loc=global.location||{};
    return loc.protocol==='https:'||(loc.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(loc.hostname));
  }
  function enabled(){
    return Boolean(clientId())&&global.WINDS_GOOGLE_AUTH_SERVER!==true&&global.WINDS_GOOGLE_SILENT_RENEWAL!==false&&secureContext()&&Boolean(redirectUri());
  }
  function verificationKey(){return `${clientId()} ${redirectUri()}`;}
  function verified(){
    if(!enabled())return false;
    if(configuredUri())return true;
    const saved=json(ls.get(VERIFIED_KEY));
    return saved?.key===verificationKey();
  }
  function markVerified(){
    if(!enabled())return;
    ls.set(VERIFIED_KEY,JSON.stringify({key:verificationKey(),at:now()}));
    ls.remove(BROKEN_KEY);
  }
  function broken(){
    const saved=json(ls.get(BROKEN_KEY));
    return Boolean(saved&&saved.key===verificationKey()&&now()-Number(saved.at||0)<BROKEN_TTL_MS);
  }
  function markBroken(){ls.set(BROKEN_KEY,JSON.stringify({key:verificationKey(),at:now()}));ls.remove(VERIFIED_KEY);}
  /** Top-level redirects are allowed: the callback URL is known to work here. */
  function redirectReady(){return enabled()&&verified()&&!broken();}

  function randomState(){
    const bytes=new Uint8Array(16);
    try{global.crypto.getRandomValues(bytes);}catch{for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);}
    return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }
  function buildUrl({state,hint,prompt}){
    const params=new URLSearchParams({client_id:clientId(),redirect_uri:redirectUri(),response_type:'token',
      scope:SCOPE,include_granted_scopes:'true',state});
    if(hint)params.set('login_hint',String(hint));
    if(prompt)params.set('prompt',prompt);
    return `${AUTH_ENDPOINT}?${params}`;
  }
  /** Parse a callback fragment/query into a plain, length-limited record. */
  function parseResponse(raw){
    const params=new URLSearchParams(String(raw||'').replace(/^[#?]/,''));
    const field=(name,max=4096)=>String(params.get(name)||'').slice(0,max);
    return {state:field('state',128),access_token:field('access_token'),expires_in:field('expires_in',12),
      scope:field('scope',1024),error:field('error',64)};
  }
  function safeReturnPath(value){
    const text=String(value||'');
    // Same-origin absolute path only: never "//host", "/\host" or a scheme.
    return /^\/(?![\/\\])[^\\\s]*$/.test(text)&&text.length<2048?text:'';
  }

  function validProfile(profile){return profile&&SUB_PATTERN.test(String(profile.sub||''))&&typeof profile.email==='string'&&profile.email;}
  function logoutStamp(sub){return ls.get(LOGOUT_PREFIX+sub)||'';}
  /** The account this tab would restore, mirroring cloud-drive.js. */
  function rememberedAccount(){
    const tab=json(ss.get(SESSION_KEY));
    if(tab&&tab.clientId===clientId()&&validProfile(tab.profile)&&(tab.logoutStamp||'')===logoutStamp(tab.profile.sub))return tab.profile;
    const last=json(ls.get(ACCOUNT_KEY));
    if(last&&last.clientId===clientId()&&validProfile(last.profile))return last.profile;
    return null;
  }
  function tokenExpiry(sub){
    let best=0;
    for(const saved of [json(ss.get(SESSION_KEY)),json(ls.get(PERSIST_PREFIX+sub))]){
      if(saved&&saved.clientId===clientId()&&saved.profile?.sub===sub&&typeof saved.token==='string'&&saved.token&&
        (saved.logoutStamp||'')===logoutStamp(sub)&&Number.isFinite(saved.expires))best=Math.max(best,saved.expires);
    }
    return best;
  }
  function needsRenewal(sub,margin=RENEW_BEFORE_MS){return tokenExpiry(sub)-now()<margin;}
  function silentBlocked(sub){return Boolean(ls.get(BLOCKED_PREFIX+sub));}
  function blockSilent(sub,reason){if(SUB_PATTERN.test(String(sub||'')))ls.set(BLOCKED_PREFIX+sub,JSON.stringify({reason:String(reason||'').slice(0,64),at:now()}));}
  function unblockSilent(sub){if(sub)ls.remove(BLOCKED_PREFIX+sub);}

  function savePending(record){ls.set(PENDING_KEY,JSON.stringify(record));}
  /** Begin a top-level redirect. Resolves false when it cannot start. */
  function begin({mode='silent',sub=null,hint=null,prompt=mode==='silent'?'none':'',returnTo=null}={}){
    if(!redirectReady())return false;
    const state=randomState();
    const back=safeReturnPath(returnTo??`${global.location.pathname}${global.location.search}`)||'/';
    savePending({state,mode,sub:SUB_PATTERN.test(String(sub||''))?String(sub):null,returnTo:back,at:now(),key:verificationKey()});
    ss.remove(RESULT_KEY);
    if(mode==='silent')ls.set(LAUNCH_AT_KEY,String(now()));
    const url=buildUrl({state,hint,prompt});
    try{mode==='silent'?global.location.replace(url):global.location.assign(url);}catch{return false;}
    return true;
  }
  /**
   * Read and clear a completed redirect. Returns null when there was none,
   * {mode,sub,token,expiresIn} on success, or {mode,sub,error} otherwise.
   */
  function consume(){
    const pending=json(ls.get(PENDING_KEY));
    const raw=ss.get(RESULT_KEY)||ls.get(RESULT_KEY);
    ss.remove(RESULT_KEY);ls.remove(RESULT_KEY);
    if(!pending){return null;}
    ls.remove(PENDING_KEY);
    const fresh=now()-Number(pending.at||0)<PENDING_TTL_MS&&pending.key===verificationKey();
    const result=json(raw);
    if(!result){
      // A recent silent attempt that never came back: prompt=none shows no UI,
      // so Google likely displayed an error page (for example an unregistered
      // callback URL). An interactive user may simply have gone back.
      if(fresh&&pending.mode==='silent')markBroken();
      return fresh?{mode:pending.mode,sub:pending.sub,error:'no_response'}:null;
    }
    if(!fresh||typeof result.state!=='string'||result.state!==pending.state)return {mode:pending.mode,sub:pending.sub,error:'state_mismatch'};
    markVerified();
    if(result.error||!result.access_token)return {mode:pending.mode,sub:pending.sub,error:result.error||'no_token'};
    const expiresIn=Math.max(60,Math.min(86400,Number(result.expires_in)||3600));
    return {mode:pending.mode,sub:pending.sub,token:result.access_token,expiresIn,scope:result.scope};
  }
  function hasPendingResult(){return Boolean(ss.get(RESULT_KEY)||ls.get(RESULT_KEY));}

  /** Hidden-iframe silent request; also verifies that the callback URL works. */
  let iframeTask=null;
  function silentIframe({hint=null,timeout=IFRAME_TIMEOUT_MS}={}){
    if(!enabled()||!global.document?.body)return Promise.resolve({error:'unavailable'});
    if(iframeTask)return iframeTask;
    iframeTask=new Promise(resolve=>{
      const state=randomState(),frame=global.document.createElement('iframe');
      let timer=0,done=false;
      const finish=value=>{
        if(done)return;done=true;clearTimeout(timer);
        global.removeEventListener('message',onMessage);
        try{frame.remove();}catch{}
        iframeTask=null;resolve(value);
      };
      function onMessage(event){
        if(event.origin!==global.location.origin||event.source!==frame.contentWindow)return;
        const data=event.data;
        if(!data||data.type!=='winds-oauth'||data.state!==state)return;
        markVerified();
        if(data.error||!data.access_token){finish({error:String(data.error||'no_token').slice(0,64)});return;}
        finish({token:String(data.access_token),expiresIn:Math.max(60,Math.min(86400,Number(data.expires_in)||3600))});
      }
      global.addEventListener('message',onMessage);
      frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.title='Google Drive connection';
      frame.style.cssText='position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none';
      frame.src=buildUrl({state,hint,prompt:'none'});
      timer=setTimeout(()=>finish({error:'timeout'}),timeout);
      global.document.body.appendChild(frame);
    });
    return iframeTask;
  }
  /** Run a verification probe at most every few hours until it succeeds once. */
  function probeDue(){
    if(!enabled()||verified()||configuredUri())return false;
    return now()-Number(ls.get(PROBE_AT_KEY)||0)>PROBE_GAP_MS;
  }
  function noteProbe(){ls.set(PROBE_AT_KEY,String(now()));}

  /**
   * Early launch check (runs from <head>): when the remembered account's token
   * has expired, bounce through Google once to get a fresh one silently.
   */
  function launchCandidate(){
    if(!redirectReady()||global.top!==global.self||global.navigator?.onLine===false)return null;
    if(/oauth-callback\.html$/.test(global.location.pathname)||hasPendingResult())return null;
    if(global.document?.visibilityState&&global.document.visibilityState!=='visible')return null;
    const profile=rememberedAccount();
    if(!profile||silentBlocked(profile.sub)||!needsRenewal(profile.sub))return null;
    if(now()-Number(ls.get(LAUNCH_AT_KEY)||0)<LAUNCH_GAP_MS)return null;
    // A pending record means an earlier bounce is still unresolved; app code
    // consumes it first so a broken callback URL is detected, not repeated.
    const pending=json(ls.get(PENDING_KEY));
    if(pending&&now()-Number(pending.at||0)<PENDING_TTL_MS)return null;
    return profile;
  }
  function showSplash(text){
    try{
      const doc=global.document,style=doc.createElement('style');
      style.textContent='html.winds-auth-wait body>*{visibility:hidden}html.winds-auth-wait:after{content:attr(data-auth-text);position:fixed;inset:0;display:grid;place-items:center;font:600 15px/1.4 system-ui,-apple-system,sans-serif;color:#5b5f7a;background:#f8f9fc;letter-spacing:.01em}@media(prefers-color-scheme:dark){html.winds-auth-wait:after{background:#15161f;color:#b9bcd3}}';
      doc.head.appendChild(style);
      doc.documentElement.dataset.authText=text;doc.documentElement.classList.add('winds-auth-wait');
      return ()=>doc.documentElement.classList.remove('winds-auth-wait');
    }catch{return ()=>{};}
  }
  async function reachable(timeout=2500){
    if(typeof global.fetch!=='function')return true;
    const controller=global.AbortController?new global.AbortController():null;
    const timer=setTimeout(()=>controller?.abort(),timeout);
    try{
      await global.fetch('https://accounts.google.com/generate_204',{mode:'no-cors',cache:'no-store',credentials:'omit',signal:controller?.signal});
      return true;
    }catch{return false;}finally{clearTimeout(timer);}
  }
  let launchPromise=Promise.resolve(false);
  function bootRedirect(){
    let profile=null;
    try{profile=launchCandidate();}catch{profile=null;}
    if(!profile)return launchPromise;
    const hide=showSplash('Reconnecting Google Drive…');
    // Returning with the Back gesture restores this page from memory.
    try{global.addEventListener('pageshow',event=>{if(event.persisted)hide();});}catch{}
    launchPromise=reachable().then(online=>{
      if(!online){hide();return false;}
      const started=begin({mode:'silent',sub:profile.sub,hint:profile.email,prompt:'none'});
      if(!started)hide();
      return started;
    }).catch(()=>{hide();return false;});
    return launchPromise;
  }

  global.WindsOAuth=Object.freeze({
    enabled,redirectUri,redirectReady,verified,markVerified,broken,markBroken,buildUrl,parseResponse,safeReturnPath,
    begin,consume,silentIframe,probeDue,noteProbe,needsRenewal,silentBlocked,blockSilent,unblockSilent,
    rememberedAccount,launchCandidate,bootRedirect,launching:()=>launchPromise,
    RESULT_KEY,PENDING_KEY
  });
  if(global.WINDS_OAUTH_AUTOSTART!==false&&global.document&&global.location)bootRedirect();
})(typeof window!=='undefined'?window:globalThis);
