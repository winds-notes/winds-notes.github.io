const test=require('node:test');
const assert=require('node:assert/strict');
const {mkdtemp,readFile,stat,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {randomBytes}=require('node:crypto');
const origin='https://notes.example.test';
const A={sub:'1111111111',email:'a@example.test',name:'Account A'};
const B={sub:'2222222222',email:'b@example.test',name:'Account B'};

async function fixture(t){
  const {createGoogleAuth,EncryptedSessionStore}=await import('../server/google-auth.mjs');
  const directory=await mkdtemp(join(tmpdir(),'winds-auth-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const file=join(directory,'sessions.enc'),key=randomBytes(32),jar=new Map(),requests=[],invalidations=[];
  let now=Date.now(),offline=false,revoked=false,refreshGate=null;
  const options={origin,clientId:'test-public-client',clientSecret:'test-only-server-secret',key,now:()=>now,onSessionInvalidated:(id,sub)=>invalidations.push({id,sub}),
    async fetch(url,options){
      requests.push({url,grant:options.body?.get('grant_type')});
      if(offline)throw new Error('Offline');
      if(url.endsWith('/token')){
        const refresh=options.body.get('grant_type')==='refresh_token';
        if(refreshGate&&refresh)await refreshGate;
        if(revoked&&refresh)return Response.json({error:'invalid_grant'},{status:400});
        const account=(options.body.get('refresh_token')||options.body.get('code')).endsWith('-b')?'b':'a';
        return Response.json({access_token:(refresh?'renewed-':'access-')+account,refresh_token:'refresh-'+account,
          expires_in:3600,scope:'openid email profile https://www.googleapis.com/auth/drive.file'});
      }
      if(url.endsWith('/userinfo'))return Response.json({...(options.headers.Authorization.endsWith('-b')?B:A),email_verified:true});
      if(url.endsWith('/revoke'))return new Response(null,{status:200});
      throw new Error('Unexpected network request');
    }
  };
  let auth=createGoogleAuth({...options,store:new EncryptedSessionStore(file,key)});
  async function call(path,{method='GET',json,headers={},apply=true}={}){
    const result=await auth.handle(new Request(origin+path,{method,headers:{
      Cookie:[...jar].map(([key,value])=>key+'='+value).join('; '),
      'X-Winds-Request':'1',...headers,...(json?{'Content-Type':'application/json'}:{})
    },...(json?{body:JSON.stringify(json)}:{})}));
    if(apply)for(const cookie of result.headers.getSetCookie()){
      const [part]=cookie.split(';'),index=part.indexOf('='),name=part.slice(0,index),value=part.slice(index+1);
      if(cookie.includes('Max-Age=0;')||cookie.endsWith('Max-Age=0'))jar.delete(name);else jar.set(name,value);
    }
    return result;
  }
  return {file,key,jar,requests,call,invalidations,
    authorize:sub=>auth.authorize(new Request(origin+'/live/events',{headers:{Cookie:[...jar].map(([key,value])=>key+'='+value).join('; ')}}),sub),
    advance(ms){now+=ms;},setOffline(value){offline=value;},setRevoked(value){revoked=value;},setGate(value){refreshGate=value;},
    restart(){auth=createGoogleAuth({...options,store:new EncryptedSessionStore(file,key)});},
    async login(account='a'){
      const start=await call('/auth/google/start');
      const url=new URL(start.headers.get('Location'));
      assert.equal(url.searchParams.get('access_type'),'offline');
      assert.equal(url.searchParams.get('code_challenge_method'),'S256');
      const callback=await call('/auth/google/callback?'+new URLSearchParams({state:url.searchParams.get('state'),code:'code-'+account}));
      assert.match(callback.headers.get('Location'),/google_auth=connected/);return callback;
    }
  };
}

test('persistent HttpOnly session survives server restart and renews expired Google access automatically',async t=>{
  const app=await fixture(t),callback=await app.login();
  const cookie=callback.headers.getSetCookie().find(value=>value.startsWith('__Host-winds_session='));
  for(const flag of ['HttpOnly','SameSite=Lax','Secure','Max-Age=34560000'])assert.ok(cookie.includes(flag));
  assert.ok(!cookie.includes('access-a')&&!cookie.includes('refresh-a'));
  const disk=await readFile(app.file,'utf8');
  assert.ok(!disk.includes('refresh-a')&&!disk.includes(A.email));
  assert.equal((await stat(app.file)).mode&0o777,0o600);
  app.advance(7200000);app.restart();
  const response=await app.call('/auth/google/session');
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  const session=await response.json();
  assert.deepEqual(session.profile,A);
  assert.equal(session.access_token,'renewed-a');
  assert.equal(session.refresh_token,undefined);
  assert.equal(app.requests.filter(request=>request.grant==='refresh_token').length,1);
});

test('accounts remain independent and explicit logout removes only the selected account',async t=>{
  const app=await fixture(t);await app.login();await app.login('b');
  assert.deepEqual((await (await app.call('/auth/google/session?account='+A.sub)).json()).profile,A);
  assert.deepEqual((await (await app.call('/auth/google/session')).json()).profile,B);
  const result=await app.call('/auth/google/logout',{method:'POST',headers:{Origin:origin},json:{account:A.sub}});
  assert.equal(result.status,204);
  assert.equal((await app.call('/auth/google/session?account='+A.sub)).status,401);
  assert.equal((await app.call('/auth/google/session?account='+B.sub)).status,200);
  await app.call('/auth/google/logout',{method:'POST',headers:{Origin:origin},json:{account:B.sub}});
  assert.equal(app.jar.has('__Host-winds_session'),false);
  app.restart();assert.equal((await app.call('/auth/google/session')).status,401);
});

test('CSRF, invalid OAuth state and expired callbacks cannot create or remove a session',async t=>{
  const app=await fixture(t);await app.login();
  const bad=await app.call('/auth/google/logout',{method:'POST',headers:{Origin:'https://attacker.example'},json:{account:A.sub}});
  assert.equal(bad.status,403);
  assert.equal((await app.call('/auth/google/session',{headers:{'X-Winds-Request':''}})).status,403);
  assert.equal((await app.call('/auth/google/session')).status,200);
  const count=app.requests.length;
  await app.call('/auth/google/start');
  const mismatch=await app.call('/auth/google/callback?state=wrong&code=code-a');
  assert.match(mismatch.headers.get('Location'),/google_auth=error/);
  assert.equal(app.requests.length,count);
  const start=await app.call('/auth/google/start'),state=new URL(start.headers.get('Location')).searchParams.get('state');
  app.advance(600001);
  const expired=await app.call('/auth/google/callback?'+new URLSearchParams({state,code:'code-a'}));
  assert.match(expired.headers.get('Location'),/google_auth=error/);
  assert.equal(app.requests.length,count);
});

test('temporary network failures preserve the server session for automatic retry',async t=>{
  const app=await fixture(t);await app.login();app.advance(7200000);app.setOffline(true);
  assert.equal((await app.call('/auth/google/session')).status,503);
  app.restart();app.setOffline(false);
  assert.equal((await app.call('/auth/google/session')).status,200);
});

test('concurrent requests renew once and logout cannot be undone by an in-flight refresh',async t=>{
  const app=await fixture(t);await app.login();app.advance(7200000);
  const responses=await Promise.all([app.call('/auth/google/session'),app.call('/auth/google/session'),app.call('/auth/google/session')]);
  assert.ok(responses.every(response=>response.status===200));
  assert.equal(app.requests.filter(request=>request.grant==='refresh_token').length,1);
  app.advance(7200000);let release;app.setGate(new Promise(resolve=>{release=resolve;}));
  const refreshing=app.call('/auth/google/session',{apply:false});
  const loggingOut=app.call('/auth/google/logout',{method:'POST',headers:{Origin:origin},json:{account:A.sub}});
  release();await Promise.all([refreshing,loggingOut]);
  assert.equal((await app.call('/auth/google/session')).status,401);
});

test('Google revocation requires renewed permission without affecting another account',async t=>{
  const app=await fixture(t);await app.login();await app.login('b');app.advance(7200000);app.setRevoked(true);
  const response=await app.call('/auth/google/session?account='+A.sub);
  assert.equal(response.status,401);
  assert.equal((await response.json()).error,'authorization_revoked');
  app.setRevoked(false);assert.equal((await app.call('/auth/google/session?account='+B.sub)).status,200);
});

test('the relay authorizer uses verified cookie accounts and never trusts a requested foreign subject',async t=>{
  const app=await fixture(t);await app.login();
  const identity=await app.authorize(A.sub);
  assert.equal(identity.profile.sub,A.sub);assert.equal(identity.accessToken,'access-a');assert.match(identity.sessionId,/^[\w-]{43}$/);
  await assert.rejects(app.authorize(B.sub),error=>error.status===401);
  await app.call('/auth/google/logout',{method:'POST',headers:{Origin:origin},json:{account:A.sub}});
  assert.equal(app.invalidations.length,1);assert.equal(app.invalidations[0].id,identity.sessionId);assert.equal(app.invalidations[0].sub,A.sub);
  await assert.rejects(app.authorize(A.sub),error=>error.status===401);
});
