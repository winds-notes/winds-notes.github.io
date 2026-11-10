import http from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import {resolve, extname, isAbsolute, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGoogleAuth, EncryptedSessionStore, sessionKey} from './google-auth.mjs';
import {createLiveRelay} from './live-relay.mjs';
import {Readable} from 'node:stream';

if(Number(process.versions.node.split('.')[0])<22)throw new Error('The persistent-login server requires Node.js 22 or newer.');
const root=await realpath(resolve(fileURLToPath(new URL('../',import.meta.url))));
const origin=process.env.WINDS_PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL;
if(!origin)throw new Error('Set WINDS_PUBLIC_ORIGIN to the public website origin.');
const key=sessionKey(process.env.WINDS_SESSION_KEY);
const file=process.env.WINDS_SESSION_FILE;
if(!file||!isAbsolute(file)||resolve(file)===root||resolve(file).startsWith(root+sep))throw new Error('WINDS_SESSION_FILE must be an absolute path on persistent storage outside the website directory.');
const config=await readFile(resolve(root,'google-config.js'),'utf8');
const clientId=process.env.GOOGLE_CLIENT_ID||config.match(/WINDS_GOOGLE_CLIENT_ID\s*=\s*['"]([^'"]+)/)?.[1];
const pickerKey=process.env.WINDS_GOOGLE_PICKER_API_KEY||config.match(/WINDS_GOOGLE_PICKER_API_KEY\s*=\s*['"]([^'"]*)/)?.[1]||'';
const store=new EncryptedSessionStore(file,key);await store.load();
let live=null;
const auth=createGoogleAuth({origin,clientId,clientSecret:process.env.GOOGLE_CLIENT_SECRET,key,store,onSessionInvalidated:(id,sub)=>live?.invalidate(id,sub)});
const liveEnabled=process.env.WINDS_LIVE_SYNC==='true';
if(liveEnabled)live=createLiveRelay({origin,authorize:(req,sub)=>auth.authorize(req,sub)});
const assets=new Set(['index.html','theme.js','dark.css','styles.css','privacy.html','terms.html','legal.css','LICENSE','app.js','selection-preview.js','boundary-fill.js','mandala-tools.js','mandala-art.js','creative-tools.js','native-file.js','cloud-drive.js','live-sync.js','notebook-sharing.js','shared-notebook-model.js','pdf-export.js','pdf-import.js','clipboard.js','text-tools.js','interaction-tools.js','eraser-preview.js','page-stack.js','google-config.js','sw.js','manifest.webmanifest']);
const publicAsset=name=>assets.has(name)||name.startsWith('assets/')||name.startsWith('examples/')||name.startsWith('vendor/pdfjs/');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.pdf':'application/pdf','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json','.winds-notes':'application/json'};
http.createServer(async(req,res)=>{
  try{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'");
    const url=new URL(req.url,origin);
    if(url.origin!==new URL(origin).origin){res.writeHead(403).end('Forbidden');return;}
    if(url.pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({ok:true,live:liveEnabled}));return;}
    if(url.pathname.startsWith('/live/')){
      if(!live){res.writeHead(404).end();return;}
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>32768){res.writeHead(413).end();return;}chunks.push(chunk);}
      const controller=new AbortController();res.on('close',()=>controller.abort());
      const result=await live.handle(new Request(url,{method:req.method,headers:req.headers,signal:controller.signal,
        ...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}));
      res.writeHead(result.status,Object.fromEntries(result.headers));res.flushHeaders();
      if(result.body)Readable.fromWeb(result.body).on('error',()=>res.destroy()).pipe(res);else res.end();return;
    }
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
    if(!path.startsWith(root+sep)||!publicAsset(normalized)){res.writeHead(404).end();return;}
    const actual=await realpath(path);
    const actualName=actual.slice(root.length+1);
    if(!actual.startsWith(root+sep)||!publicAsset(actualName)||actualName.split('/').some(part=>part.startsWith('.'))){res.writeHead(404).end();return;}
    let body=await readFile(actual);
    if(relative==='google-config.js')body=Buffer.from(`window.WINDS_GOOGLE_CLIENT_ID=${JSON.stringify(clientId)};\nwindow.WINDS_GOOGLE_PICKER_API_KEY=${JSON.stringify(pickerKey)};\nwindow.WINDS_GOOGLE_AUTH_SERVER=true;\nwindow.WINDS_REALTIME_ENABLED=${liveEnabled};\n`);
    res.writeHead(200,{'Content-Type':normalized==='LICENSE'?'text/plain; charset=utf-8':types[extname(path)]||'application/octet-stream',
      'Cache-Control':relative==='sw.js'||relative==='google-config.js'?'no-store':'no-cache',
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}).end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(Number(process.env.PORT||8080),process.env.HOST||'127.0.0.1',()=>console.log('WiNDS Notes persistent-login server is ready.'));
