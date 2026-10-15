import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('docs');
const base = '/bamboo-shampoo-demo';
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.xml':'application/xml', '.txt':'text/plain', '.glb':'model/gltf-binary', '.json':'application/json' };
const server = http.createServer((req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  if (pathname === '/') { res.writeHead(302, {Location:`${base}/de/`}); return res.end(); }
  if (pathname.startsWith(`${base}/`)) pathname = pathname.slice(base.length);
  let file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404, {'Content-Type':'text/html'}); return res.end(fs.readFileSync(path.join(root,'404.html'))); }
  res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache'});
  fs.createReadStream(file).pipe(res);
});
const port=Number(process.argv[2]||4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid preview port');
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/bamboo-shampoo-demo/de/`));
