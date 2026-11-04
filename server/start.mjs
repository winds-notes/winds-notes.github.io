import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, isAbsolute, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGoogleAuth, EncryptedSessionStore, sessionKey} from './google-auth.mjs';

if(Number(process.versions.node.split('.')[0])<22)throw new Error('The persistent-login server requires Node.js 22 or newer.');
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const origin=process.env.WINDS_PUBLIC_ORIGIN;
if(!origin)throw new Error('Set WINDS_PUBLIC_ORIGIN to the public website origin.');
const key=sessionKey(process.env.WINDS_SESSION_KEY);
const file=process.env.WINDS_SESSION_FILE;
if(!file||!isAbsolute(file)||resolve(file)===root||resolve(file).startsWith(root+sep))throw new Error('WINDS_SESSION_FILE must be an absolute path on persistent storage outside the website directory.');
const config=await readFile(resolve(root,'google-config.js'),'utf8');
const clientId=process.env.GOOGLE_CLIENT_ID||config.match(/WINDS_GOOGLE_CLIENT_ID\s*=\s*['"]([^'"]+)/)?.[1];
const store=new EncryptedSessionStore(file,key);await store.load();
const auth=createGoogleAuth({origin,clientId,clientSecret:process.env.GOOGLE_CLIENT_SECRET,key,store});
const assets=new Set(['index.html','styles.css','privacy.html','terms.html','legal.css','LICENSE','app.js','creative-tools.js','native-file.js','cloud-drive.js','pdf-export.js','google-config.js','sw.js','manifest.webmanifest']);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.winds-notes':'application/json'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,origin);
    if(url.pathname.startsWith('/auth/')){
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413).end();return;}chunks.push(chunk);}
      const result=await auth.handle(new Request(url,{method:req.method,headers:req.headers,
        ...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}));
      const headers=Object.fromEntries(result.headers);
      const cookies=result.headers.getSetCookie?.()||[];if(cookies.length)headers['set-cookie']=cookies;
      res.writeHead(result.status,headers).end(Buffer.from(await result.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
    const path=resolve(root,relative);
    const normalized=path.slice(root.length+1);
    if(!path.startsWith(root+sep)||(!assets.has(normalized)&&!normalized.startsWith('assets/')&&!normalized.startsWith('examples/'))){res.writeHead(404).end();return;}
    let body=await readFile(path);
    if(relative==='google-config.js')body=Buffer.from(`window.WINDS_GOOGLE_CLIENT_ID=${JSON.stringify(clientId)};\nwindow.WINDS_GOOGLE_AUTH_SERVER=true;\n`);
    res.writeHead(200,{'Content-Type':normalized==='LICENSE'?'text/plain; charset=utf-8':types[extname(path)]||'application/octet-stream',
      'Cache-Control':relative==='sw.js'||relative==='google-config.js'?'no-store':'no-cache',
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}).end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(Number(process.env.PORT||8080),process.env.HOST||'127.0.0.1',()=>console.log('WiNDS Notes persistent-login server is ready.'));
