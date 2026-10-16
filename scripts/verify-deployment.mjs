import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {shareCardSpecs} from './share-cards.mjs';
import {verifyRuntimeRelease} from './runtime-release.mjs';

const BASE='/bamboo-shampoo-demo/';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const normalized=bytes=>Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'));

/** Verify the built inventory, including every dependency of each active runtime. */
export async function deploymentInventory({directory='docs'}={}){
 const root=path.resolve(directory),requests=new Map(),runtimes=new Set();
 const add=(file,kind,options={})=>{
  file=file.replaceAll('\\','/');
  if(file.startsWith('/')||file.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error(`Invalid publication path: ${file}`);
  const previous=requests.get(file);
  if(previous?.expected&&options.expected&&previous.expected!==options.expected)throw new Error(`Conflicting publication hashes: ${file}`);
  requests.set(file,{...previous,file,kind:previous?.kind||kind,...options});
 };
 for(const file of await fs.readdir(root,{recursive:true})){
  if(!file.endsWith('.html'))continue;
  add(file,'page',{text:true});
  const html=await fs.readFile(path.join(root,file),'utf8');
  const raw=html.match(/<script type="application\/json" id="ui-copy">([^]*?)<\/script>/)?.[1];
  if(raw){
   const {runtimeBase}=JSON.parse(raw);
   if(typeof runtimeBase!=='string'||!runtimeBase.startsWith(BASE+'assets/releases/'))throw new Error(`Missing immutable runtime in ${file}`);
   runtimes.add(runtimeBase.slice(BASE.length));
  }
  // Verify directly referenced merchandising assets, fonts and styles as well.
  for(const match of html.matchAll(/(?:src|href)="(\/bamboo-shampoo-demo\/assets\/[^"?#]+)(?:[?#][^"]*)?"/g)){
   const asset=decodeURIComponent(match[1].slice(BASE.length));
   add(asset,'page asset',{text:/\.(?:js|json|css|svg|txt)$/.test(asset)});
  }
 }
 if(!runtimes.size)throw new Error('No active runtime releases found in the generated pages.');
 for(const directory of runtimes){
  const manifest=verifyRuntimeRelease(path.join(root,directory));
  add(`${directory}/runtime-release.json`,'runtime manifest',{text:true});
  for(const [file,metadata]of Object.entries(manifest.files))add(`${directory}/${file}`,'runtime dependency',{expected:metadata.sha256,bytes:metadata.bytes,text:false});
 }
 const stills=JSON.parse(await fs.readFile('scripts/current-studio-stills-manifest.json','utf8'));
 for(const [file,asset]of Object.entries(stills.assets))add(`assets/${file}`,'Cycles image',{expected:asset.sha256,text:false});
 for(const card of shareCardSpecs)add(`assets/${card.file}`,'share image');
 for(const file of ['assets/app.js','assets/checkout.js','assets/prime-shop.js','assets/design-switch.js','assets/presentations.js','assets/commerce.js','assets/classic.css','assets/polish.css','assets/shop-scene.js','assets/product-theme.js','assets/product-photos.js','assets/scene-framing.js','assets/scene-preview.js','assembly/body.js','assembly/body-profile.js','assembly/cap-data.js','assembly/ritual-cap.js','assembly/ritual-effects.js','assembly/ritual-timeline.js','assembly/surface-finish.js','assembly/surface-buffers.js','assembly/surface-worker.js','assembly/scene.js','assembly/source-integrity.json'])add(file,'operative code',{text:true});
 add('assembly/original-engraving.svg','original artwork',{expected:stills.engravingSha256,text:false});
 return {root,runtimes:[...runtimes],requests:[...requests.values()]};
}

export async function verifyDeployment({commit,directory='docs',origin='https://rabenreiter1.github.io/bamboo-shampoo-demo/',reportFile='qa/modern-live-release.json',fetcher=fetch}={}){
 if(!/^[a-f0-9]{40}$/.test(commit||''))throw new Error('Expected exact 40-character release commit.');
 const {root,runtimes,requests}=await deploymentInventory({directory});
 const results=[],failures=[];
 for(let start=0;start<requests.length;start+=4){
  await Promise.all(requests.slice(start,start+4).map(async item=>{
   try{
    const url=new URL(item.file,origin);url.searchParams.set('release',commit);
    const response=await fetcher(url,{signal:AbortSignal.timeout(60000)});
    if(!response.ok&&!(item.file==='404.html'&&response.status===404))throw new Error(`HTTP ${response.status}`);
    const remote=Buffer.from(await response.arrayBuffer()),local=await fs.readFile(path.join(root,item.file));
    const expected=item.expected||hash(item.text?normalized(local):local);
    const actual=hash(item.text?normalized(remote):remote);
    if(actual!==expected)throw new Error('Delivered bytes differ from the built release.');
    if(item.bytes!==undefined&&remote.length!==item.bytes)throw new Error('Delivered length differs from runtime manifest.');
    results.push({file:item.file,kind:item.kind,sha256:actual,bytes:remote.length,status:response.status});
   }catch(error){failures.push({file:item.file,error:error.message});}
  }));
 }
 results.sort((a,b)=>a.file.localeCompare(b.file));failures.sort((a,b)=>a.file.localeCompare(b.file));
 const report={commit,checkedAt:new Date().toISOString(),origin,verified:failures.length===0,runtimes,files:results.length,groups:Object.fromEntries([...new Set(requests.map(row=>row.kind))].map(kind=>[kind,results.filter(row=>row.kind===kind).length])),failures,results};
 if(reportFile){await fs.mkdir(path.dirname(reportFile),{recursive:true});await fs.writeFile(reportFile,JSON.stringify(report,null,2)+'\n');}
 return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=await verifyDeployment({commit:process.argv[2]});
 console.log(JSON.stringify({...report,results:undefined},null,2));
 if(!report.verified)process.exitCode=1;
}
