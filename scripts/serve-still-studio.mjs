import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('.'),assetRoot=path.join(root,'assets'),prefix='/bamboo-shampoo-demo/assets/';
const material=path.resolve(process.argv[2]||'qa/reference/material-photo.jpg');
const exact=new Map([['/scripts/still-studio.html',path.join(root,'scripts/still-studio.html')],['/scripts/still-studio.js',path.join(root,'scripts/still-studio.js')],['/reference/actual250.pdf',path.join(root,'qa/reference/actual250.pdf')],['/reference/drawing.png',path.join(root,'qa/reference/actual250-1.png')],['/reference/material.jpg',material]]);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.pdf':'application/pdf','.woff2':'font/woff2','.webp':'image/webp'};
http.createServer((req,res)=>{let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}let file=exact.get(name);if(!file&&name.startsWith(prefix)){file=path.resolve(assetRoot,name.slice(prefix.length));if(!file.startsWith(assetRoot+path.sep))file=null;}if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);}).listen(4178,'127.0.0.1',()=>console.log('Private source-locked studio: http://127.0.0.1:4178/scripts/still-studio.html'));
