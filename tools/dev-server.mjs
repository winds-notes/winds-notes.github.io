import http from 'node:http';
import {readFile, stat, realpath} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await realpath(resolve(fileURLToPath(new URL('../',import.meta.url))));
const port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.pdf':'application/pdf','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json'};
http.createServer(async (req,res)=>{
  try {
    const requested=new URL(req.url,'http://'+req.headers.host);
    if(!['localhost','127.0.0.1','[::1]'].includes(requested.hostname)||Number(requested.port||80)!==port){
      res.writeHead(403).end('Forbidden');return;
    }
    if(req.headers.origin&&req.headers.origin!==requested.origin){res.writeHead(403).end('Forbidden');return;}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end('Method not allowed');return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.split('/').some(part=>part.startsWith('.'))||/\.(?:enc|key|pem|p12|pfx)$/i.test(pathname)){
      res.writeHead(403).end('Forbidden');return;
    }
    const path=await realpath(resolve(root,'.'+pathname,(pathname.endsWith('/')?'index.html':'')));
    if(path!==root && !path.startsWith(root+sep)){res.writeHead(403).end('Forbidden');return;}
    const relative=path.slice(root.length+1);
    if(relative.split(sep).some(part=>part.startsWith('.'))||/\.(?:enc|key|pem|p12|pfx)$/i.test(relative)){
      res.writeHead(403).end('Forbidden');return;
    }
    const info=await stat(path);
    if(!info.isFile()){res.writeHead(404).end('Not found');return;}
    const contents=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      // The OAuth return page must load in the same-origin renewal iframe.
      'X-Frame-Options':relative==='oauth-callback.html'?'SAMEORIGIN':'DENY'}).end(req.method==='HEAD'?undefined:contents);
  }catch(e){res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`WiNDS Notes: http://localhost:${port}/`));
