/** Local-only export harness. Never copied to the public Pages build. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('assets'),prefix='/bamboo-shampoo-demo/assets/';
const scripts=new Set(['cycles-studio.html','cycles-studio.js','cycles-export.js']);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
const port=Number(process.argv[2]||4182);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Expected an unprivileged TCP port');
http.createServer((request,response)=>{
 let file;
 try{
  const name=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  if(name.startsWith('/scripts/')&&scripts.has(name.slice(9)))file=path.resolve('scripts',name.slice(9));
  else if(name.startsWith(prefix)){
   const candidate=path.resolve(root,name.slice(prefix.length));
   if(candidate.startsWith(root+path.sep))file=candidate;
  }
 }catch{response.writeHead(400);response.end();return;}
 if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);response.end();return;}
 response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
 fs.createReadStream(file).pipe(response);
}).listen(port,'127.0.0.1',()=>console.log(`Source bridge: http://127.0.0.1:${port}/scripts/cycles-studio.html`));
