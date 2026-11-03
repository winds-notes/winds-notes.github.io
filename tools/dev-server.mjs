import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
http.createServer(async (req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path=resolve(root,'.'+pathname,(pathname.endsWith('/')?'index.html':''));
    if(path!==root && !path.startsWith(root+sep)){res.writeHead(403).end('Forbidden');return;}
    const info=await stat(path);
    if(!info.isFile()){res.writeHead(404).end('Not found');return;}
    const contents=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(contents);
  }catch(e){res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`WiNDS Notes: http://localhost:${port}/`));
