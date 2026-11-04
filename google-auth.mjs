import {randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual} from 'node:crypto';
import {mkdir, readFile, writeFile, rename, unlink} from 'node:fs/promises';
import {dirname} from 'node:path';

const SCOPES='openid email profile https://www.googleapis.com/auth/drive.file';
const TOKEN_URL='https://oauth2.googleapis.com/token';
const USER_URL='https://openidconnect.googleapis.com/v1/userinfo';
const COOKIE_AGE=34560000; // Browser maximum: 400 days, renewed with use.
const random=()=>randomBytes(32).toString('base64url');
const hash=value=>createHash('sha256').update(value).digest('base64url');
const validSub=value=>typeof value==='string'&&/^[0-9]{5,30}$/.test(value);
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
function seal(value,key,context){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(context));
  const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');
}
function unseal(value,key,context){
  const bytes=Buffer.from(value,'base64url');
  const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
  decipher.setAAD(Buffer.from(context));decipher.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
}
export function sessionKey(value){
  const key=Buffer.from(value||'','base64');
  if(key.length!==32)throw new Error('WINDS_SESSION_KEY must contain 32 random bytes encoded as base64.');
  return key;
}

// The deployment must place this file on persistent storage outside the website.
// A single process owns it; multi-instance hosting requires a shared session store.
export class EncryptedSessionStore {
  constructor(file,key){this.file=file;this.key=key;this.records=null;this.tail=Promise.resolve();}
  async load(){
    if(this.records)return;
    try{this.records=new Map(Object.entries(unseal(await readFile(this.file,'utf8'),this.key,'winds-auth-store-v1')));}
    catch(err){if(err.code!=='ENOENT')throw new Error('Unable to read the encrypted Google session store.');this.records=new Map();}
  }
  async get(id){await this.tail;await this.load();return structuredClone(this.records.get(id));}
  async set(id,value){
    const operation=this.tail.then(async()=>{
      await this.load();
      const next=new Map(this.records);
      if(value===null)next.delete(id);else next.set(id,structuredClone(value));
      await mkdir(dirname(this.file),{recursive:true,mode:0o700});
      const temporary=this.file+'.'+random()+'.tmp';
      try{
        await writeFile(temporary,seal(Object.fromEntries(next),this.key,'winds-auth-store-v1'),{mode:0o600,flag:'wx'});
        await rename(temporary,this.file);this.records=next;
      }finally{await unlink(temporary).catch(()=>{});}
    });
    this.tail=operation.catch(()=>{});return operation;
  }
}

export function createGoogleAuth({origin,clientId,clientSecret,key,store,fetch:request=fetch,now=Date.now,onSessionInvalidated=()=>{}}){
  const base=new URL(origin);
  if(base.pathname!=='/'||base.search||base.hash||
    (base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname)))){
    throw new Error('WINDS_PUBLIC_ORIGIN must be an HTTPS origin, or localhost for development.');
  }
  if(!clientId||!clientSecret)throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for persistent Google authorization.');
  const secure=base.protocol==='https:',prefix=secure?'__Host-':'';
  const sessionCookie=prefix+'winds_session',flowCookie=prefix+'winds_oauth_flow';
  const redirectUri=new URL('/auth/google/callback',base).href;
  const locks=new Map();
  function cookie(name,value,age){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;}
  function cookies(req){
    return Object.fromEntries((req.headers.get('cookie')||'').split(';').map(part=>{
      const index=part.indexOf('=');return [part.slice(0,index).trim(),part.slice(index+1).trim()];
    }));
  }
  function browserId(req){const id=cookies(req)[sessionCookie];return /^[\w-]{43}$/.test(id||'')?id:null;}
  function response(body,status=200,extra={}){
    return new Response(body===null?null:JSON.stringify(body),{status,headers:{
      'Content-Type':'application/json','Cache-Control':'no-store','Pragma':'no-cache',
      'X-Content-Type-Options':'nosniff',...extra
    }});
  }
  function redirect(path,setCookies=[]){
    const result=response(null,303,{Location:new URL(path,base).href});
    for(const value of setCookies)result.headers.append('Set-Cookie',value);
    return result;
  }
  async function locked(id,task){
    const run=(locks.get(id)||Promise.resolve()).catch(()=>{}).then(task);
    locks.set(id,run);
    try{return await run;}finally{if(locks.get(id)===run)locks.delete(id);}
  }
  async function tokenRequest(fields){
    const result=await request(TOKEN_URL,{method:'POST',body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,...fields}),signal:AbortSignal.timeout(15000)});
    const data=await result.json();
    if(!result.ok){const error=new Error('Google authorization is unavailable.');error.revoked=data.error==='invalid_grant';throw error;}
    if(typeof data.access_token!=='string'||!Number.isFinite(Number(data.expires_in))||Number(data.expires_in)<=0)throw new Error('Invalid Google token response.');
    if(data.scope&&!String(data.scope).split(' ').includes('https://www.googleapis.com/auth/drive.file'))throw new Error('Google Drive permission was not granted.');
    return {...data,expires:now()+Number(data.expires_in)*1000};
  }
  async function start(req,url){
    const state=random(),verifier=random();
    const flow=seal({state,verifier,at:now()},key,'winds-auth-flow-v1');
    const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    target.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:SCOPES,
      access_type:'offline',prompt:url.searchParams.has('switch')?'consent select_account':'consent',
      include_granted_scopes:'true',state,code_challenge:hash(verifier),code_challenge_method:'S256'});
    const hint=url.searchParams.get('account');if(validSub(hint))target.searchParams.set('login_hint',hint);
    const result=response(null,303,{Location:target.href});
    result.headers.set('Set-Cookie',cookie(flowCookie,flow,600));return result;
  }
  async function callback(req,url){
    const clearFlow=cookie(flowCookie,'',0);
    try{
      const flow=unseal(cookies(req)[flowCookie]||'',key,'winds-auth-flow-v1');
      if(!equal(flow.state,url.searchParams.get('state'))||now()-flow.at>600000||flow.at>now()||!url.searchParams.get('code'))throw new Error('Invalid OAuth callback.');
      const tokens=await tokenRequest({grant_type:'authorization_code',code:url.searchParams.get('code'),redirect_uri:redirectUri,code_verifier:flow.verifier});
      const userResponse=await request(USER_URL,{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(15000)});
      if(!userResponse.ok)throw new Error('Google identity verification failed.');
      const user=await userResponse.json();
      if(!validSub(user.sub)||typeof user.email!=='string'||!user.email||user.email_verified!==true)throw new Error('Unverified Google identity.');
      const id=browserId(req)||random();
      return await locked(id,async()=>{
        const record=await store.get(hash(id))||{accounts:{},lastSub:null};
        const refreshToken=tokens.refresh_token||record.accounts[user.sub]?.refreshToken;
        if(typeof refreshToken!=='string'||!refreshToken)throw new Error('Offline Google authorization was not granted.');
        record.accounts[user.sub]={profile:{sub:user.sub,email:user.email,name:String(user.name||user.email)},
          accessToken:tokens.access_token,refreshToken,expires:tokens.expires};
        record.lastSub=user.sub;await store.set(hash(id),record);
        return redirect('/?google_auth=connected',[clearFlow,cookie(sessionCookie,id,COOKIE_AGE)]);
      });
    }catch{return redirect('/?google_auth=error',[clearFlow]);}
  }
  async function session(req,url){
    if(req.headers.get('X-Winds-Request')!=='1')return response({error:'Request header required.'},403);
    const id=browserId(req);if(!id)return response({error:'signed_out'},401);
    return locked(id,async()=>{
      const record=await store.get(hash(id));
      const sub=url.searchParams.get('account')||record?.lastSub;
      const account=validSub(sub)&&record?.accounts[sub];
      if(!account)return response({error:'signed_out'},401);
      if(account.expires<=now()+60000||url.searchParams.get('force')==='1'){
        try{
          const tokens=await tokenRequest({grant_type:'refresh_token',refresh_token:account.refreshToken});
          account.accessToken=tokens.access_token;account.expires=tokens.expires;
          if(tokens.refresh_token)account.refreshToken=tokens.refresh_token;
          await store.set(hash(id),record);
        }catch(err){
          if(err.revoked){
            delete record.accounts[sub];if(record.lastSub===sub)record.lastSub=Object.keys(record.accounts)[0]||null;
            await store.set(hash(id),record.lastSub?record:null);
            onSessionInvalidated(hash(id),sub);
            return response({error:'authorization_revoked'},401);
          }
          return response({error:'temporarily_unavailable'},503);
        }
      }
      return response({profile:account.profile,access_token:account.accessToken,expires:account.expires},200,{
        'Set-Cookie':cookie(sessionCookie,id,COOKIE_AGE)
      });
    });
  }
  async function logout(req){
    if(req.headers.get('Origin')!==base.origin||req.headers.get('X-Winds-Request')!=='1'||
      !req.headers.get('Content-Type')?.startsWith('application/json'))return response({error:'Invalid origin.'},403);
    const id=browserId(req);if(!id)return response(null,204);
    let sub;try{sub=(await req.json()).account;}catch{return response({error:'Invalid request.'},400);}
    if(!validSub(sub))return response({error:'Invalid account.'},400);
    return locked(id,async()=>{
      const record=await store.get(hash(id));if(!record)return response(null,204,{'Set-Cookie':cookie(sessionCookie,'',0)});
      const previous=record.accounts[sub];delete record.accounts[sub];
      if(record.lastSub===sub)record.lastSub=Object.keys(record.accounts)[0]||null;
      await store.set(hash(id),record.lastSub?record:null);
      onSessionInvalidated(hash(id),sub);
      if(previous?.refreshToken){
        try{await request('https://oauth2.googleapis.com/revoke',{method:'POST',body:new URLSearchParams({token:previous.refreshToken}),signal:AbortSignal.timeout(15000)});}catch{}
      }
      return response(null,204,{'Set-Cookie':cookie(sessionCookie,record.lastSub?id:'',record.lastSub?COOKIE_AGE:0)});
    });
  }
  return {async authorize(req,sub){
    const url=new URL('/auth/google/session',base);if(sub)url.searchParams.set('account',sub);
    const headers=new Headers(req.headers);headers.set('X-Winds-Request','1');
    const result=await session(new Request(url,{headers}),url);
    if(!result.ok){const error=new Error('Google session unavailable.');error.status=result.status;throw error;}
    const data=await result.json();return {profile:data.profile,accessToken:data.access_token,expires:data.expires,sessionId:hash(browserId(req))};
  },async handle(req){
    const url=new URL(req.url);
    try{
      if(req.method==='GET'&&url.pathname==='/auth/google/start')return await start(req,url);
      if(req.method==='GET'&&url.pathname==='/auth/google/callback')return await callback(req,url);
      if(req.method==='GET'&&url.pathname==='/auth/google/session')return await session(req,url);
      if(req.method==='POST'&&url.pathname==='/auth/google/logout')return await logout(req);
      return response({error:'Not found.'},404);
    }catch{return response({error:'temporarily_unavailable'},503);}
  }};
}
