import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {scenePreviewAsset} from '../assets/scene-preview.js';

const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[key,value]));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export const MOTION_POSTER_SOURCES=Object.freeze(['product-theme.js','shop-scene.js','scene-framing.js','campaign-backdrop.js','journey-pose.js','scene-preview.js','prime-shop.js','assembly/surface-finish.js','assembly/surface-buffers.js','assembly/surface-worker.js','assembly/bamboo-culm-albedo.webp','assembly/studio-environment.js','assembly/body.js','assembly/body-profile.js','assembly/cap-data.js','assembly/ritual-cap.js','assembly/ritual-timeline.js','assembly/ritual-space.js','assembly/ritual-effects.js']);
export const REQUIRED_MOTION_POSTERS=Object.freeze(['detail-product','guide-product','teaser-product','ritual-product'].flatMap(family=>['aloe','argan','bamboo'].map(scent=>Object.freeze({file:`shop-${family}-${scent}.webp`,scent,mode:family==='detail-product'?'product':family==='guide-product'?'journey':'ritual',progress:family==='teaser-product'?.72:0}))));

/** Read-only publication preflight. Must run before any generated file is written. */
export function validateMotionPosterSources({sourceRoot='assets',manifestFile='scripts/surface-finish-manifest.json'}={}){
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8')),provenance=manifest.loadingFrames;
 if(!provenance?.assets||!provenance.source)throw new Error('Motion poster provenance is missing. Actual frame capture is required.');
 for(const file of MOTION_POSTER_SOURCES)if(!/^[a-f0-9]{64}$/i.test(provenance.source[file]||''))throw new Error(`Motion poster source provenance missing: ${file}. Actual frame capture is required.`);
 for(const [file,expected]of Object.entries(provenance.source)){
  const target=path.resolve(sourceRoot,file),root=path.resolve(sourceRoot)+path.sep;
  if(!target.startsWith(root))throw new Error(`Unsafe motion poster source path: ${file}.`);
  if(!fs.existsSync(target)||hash(fs.readFileSync(target))!==expected)throw new Error(`Motion poster source changed: ${file}. Recapture before publication.`);
 }
 for(const {file,mode,scent,progress}of REQUIRED_MOTION_POSTERS){
  const proof=provenance.assets[file],target=path.join(sourceRoot,file);
  if(!proof||proof.mode!==mode||proof.scent!==scent||proof.progress!==progress)throw new Error(`Motion poster provenance missing or incompatible: ${file}. Actual frame capture is required.`);
  if(!/^[a-f0-9]{64}$/i.test(proof.sha256||'')||!fs.existsSync(target))throw new Error(`Motion poster asset missing: ${file}. Actual frame capture is required.`);
  const bytes=fs.readFileSync(target);
  if(hash(bytes)!==proof.sha256||bytes.length!==proof.bytes)throw new Error(`Motion poster bytes differ from source-verified release: ${file}. Recapture before publication.`);
  if(bytes.length>=240000)throw new Error(`Motion poster exceeds render budget: ${file}.`);
 }
 return provenance;
}

/** Enumerate the actual emitted animation stages, not a handwritten asset count. */
export function motionPosterInventory(html){
 const entries=[];
 for(const match of html.matchAll(/<div\b[^>]*\bdata-shop-scene="(?:ritual|journey)"[^>]*>/g)){
  const attrs=attributes(match[0]),mode=attrs['data-shop-scene'],scent=attrs['data-scent'];
  const art=attrs['data-art-direction'];
  const profile=attrs['data-preview-profile']||(mode==='ritual'?(art==='campaign'?'refill-teaser':'ritual'):art==='intro'?'hero-intro':'home-cycle');
  const end=html.indexOf('</div>',match.index),body=html.slice(match.index+match[0].length,end);
  const image=body.match(/<img\b[^>]*>/)?.[0],src=image?attributes(image).src:null;
  entries.push({mode,scent,profile,preview:attrs.class?.split(/\s+/).includes('scene-preview')||false,
   expected:scenePreviewAsset({mode,scent,profile,campaign:art==='campaign'}),actual:src?new URL(src,'https://example.test').pathname.split('/').at(-1):null});
 }
 return entries;
}

export function validateMotionPosters({root='docs',sourceRoot='assets',manifestFile='scripts/surface-finish-manifest.json'}={}){
 const provenance=validateMotionPosterSources({sourceRoot,manifestFile});
 const pages=[],walk=dir=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(item.name==='index.html')pages.push(file);}};
 walk(root);const inventory=[];
 for(const page of pages)for(const stage of motionPosterInventory(fs.readFileSync(page,'utf8'))){
  const label=`${page}: ${stage.mode}/${stage.scent}`;
  if(!stage.preview)throw new Error(`${label}: stage bypasses matched first-paint framing.`);
  if(stage.actual!==stage.expected)throw new Error(`${label}: ${stage.actual} is not the matched ${stage.expected}.`);
  const proof=provenance.assets[stage.expected];
  if(!proof||proof.mode!==stage.mode||proof.scent!==stage.scent)throw new Error(`${label}: current-mode poster provenance is missing.`);
  if(proof.progress!==(stage.profile==='refill-teaser'?.72:0))throw new Error(`${label}: wrong initial pose.`);
  for(const folder of[sourceRoot,path.join(root,'assets')])if(hash(fs.readFileSync(path.join(folder,stage.expected)))!==proof.sha256)throw new Error(`${label}: poster bytes differ from source-verified release.`);
  inventory.push({page:path.relative(root,page).replaceAll('\\','/'),...stage});
 }
 if(!inventory.length)throw new Error('No motion stages were inventoried.');
 return inventory;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=validateMotionPosters();console.log(`Verified ${result.length} motion stages across ${new Set(result.map(row=>row.page)).size} pages; every first frame matches current source, mode and scent.`);
}
