import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('assets'),prefix='/bamboo-shampoo-demo/assets/';
const privatePages=new Set(['motion-poster-studio.html','motion-poster-studio.js']);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
const port=Number(process.argv[2]||4177);
http.createServer((req,res)=>{
  let file;
  try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name.startsWith('/scripts/')&&privatePages.has(name.slice(9)))file=path.resolve('scripts',name.slice(9));
    else if(name.startsWith(prefix)){file=path.resolve(root,name.slice(prefix.length));if(!file.startsWith(root+path.sep))file=null;}
  }catch{res.writeHead(400);res.end();return;}
  if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`Private motion source capture: http://127.0.0.1:${port}/scripts/motion-poster-studio.html`));
