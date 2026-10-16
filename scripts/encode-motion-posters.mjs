import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PRODUCT_THEMES } from '../assets/product-theme.js';
import { CAP_SOURCE } from '../assets/assembly/cap-data.js';

import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scents=['aloe','argan','bamboo'],allowed=new Set();
for(const scent of scents){for(const family of ['detail','campaign'])for(const mode of ['product','refill'])allowed.add(`shop-${family}-${mode}-${scent}`);for(const family of ['product-front','guide-product','teaser-product','ritual-product','cap'])allowed.add(`shop-${family}-${scent}`);}
const sourceFiles=['product-theme.js','shop-scene.js','scene-framing.js','campaign-backdrop.js','journey-pose.js','scene-preview.js','prime-shop.js','assembly/surface-finish.js','assembly/surface-buffers.js','assembly/surface-worker.js','assembly/bamboo-culm-albedo.webp','assembly/studio-environment.js',
  'assembly/body.js','assembly/body-profile.js','assembly/cap-data.js','assembly/ritual-cap.js','assembly/ritual-timeline.js','assembly/ritual-space.js','assembly/ritual-effects.js'];
const engravingSha='67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa';
const argv=process.argv.slice(2),input=argv.find(value=>!value.startsWith('--'));
if(!input)throw new Error('Usage: node scripts/encode-motion-posters.mjs <Downloads JSON path> [--require-all] [--validate-only]');
for(const option of argv.filter(value=>value.startsWith('--')))if(!['--require-all','--validate-only'].includes(option))throw new Error(`Unknown option ${option}.`);
const bundle=JSON.parse(await fs.readFile(path.resolve(input),'utf8'));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
assert(bundle.schema==='bamboo-motion-posters-v1','Unexpected capture schema.');
assert(JSON.stringify(bundle.reference)==='[1280,1600]','Capture reference must be 1280 × 1600.');
assert(bundle.source?.engravingSha256===engravingSha,'Capture engraving source is unapproved.');
assert(sha(await fs.readFile(path.join(root,'assets/assembly/original-engraving.svg')))===engravingSha,'Local original engraving changed.');
assert(bundle.source?.capReferenceSha256===CAP_SOURCE.source.sha256,'Capture cap reference is unapproved.');
assert(JSON.stringify(bundle.source?.themes)===JSON.stringify(PRODUCT_THEMES),'Capture colours do not match the current shared palette.');
for(const name of sourceFiles)assert(bundle.source?.factorySha256?.[name]===sha(await fs.readFile(path.join(root,'assets',name))),`Factory ${name} changed since these frames were captured. Re-render, rather than mixing camera or material versions.`);
const names=Object.keys(bundle.images||{});assert(names.length>0,'No images in bundle.');
assert(names.every(name=>allowed.has(name)),'Unexpected output name; writes are restricted to the 27 approved poster assets.');
assert(Object.keys(bundle.frames||{}).length===names.length&&names.every(name=>Object.hasOwn(bundle.frames,name)),'Image and frame manifests differ.');
if(argv.includes('--require-all'))assert(names.length===allowed.size&&[...allowed].every(name=>Object.hasOwn(bundle.images,name)),'A complete capture must contain all 27 frames.');
const validated=[];
for(const name of names){
  const value=bundle.images[name],frame=bundle.frames[name],scent=name.split('-').at(-1);
  assert(typeof value==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value),`${name}: expected a PNG data URL.`);
  assert(frame.scent===scent&&JSON.stringify(frame.theme)===JSON.stringify(PRODUCT_THEMES[scent]),`${name}: wrong fragrance or cap palette.`);
  assert(frame.engravingSha256===engravingSha&&frame.capReferenceSha256===CAP_SOURCE.source.sha256,`${name}: frame source is unapproved.`);
  assert(frame.capture?.width===1280&&frame.capture?.height===1600&&frame.capture?.normalisedInBrowser===true,`${name}: frame metadata has the wrong output size.`);
  assert(frame.size?.width===1280&&frame.size?.height===1600,`${name}: camera fitted a different CSS reference.`);
  assert(frame.body?.shellOuterDiameter===58&&frame.body?.shellHeight===170&&frame.body?.inlayBodyOuterDiameter===47&&frame.body?.inlayBodyHeight===165&&frame.body?.flangeOuterDiameter===58&&frame.body?.nominalFillMilliliters===250,`${name}: confirmed product dimensions changed.`);
  assert(frame.framing&&typeof frame.framing==='object',`${name}: missing projection framing.`);
  if(name.includes('guide-'))assert(frame.mode==='journey'&&frame.progress===0,`${name}: guide must capture its closed first frame.`);
  else if(name.includes('ritual-product-'))assert(frame.mode==='ritual'&&frame.progress===0&&frame.automaticYaw===0&&!frame.cameraRegion,`${name}: scroll ritual must capture its unmodified initial camera and closed pose.`);
  else if(name.includes('teaser-'))assert(frame.mode==='ritual'&&frame.progress===.72&&frame.automaticYaw===0,`${name}: teaser first pose is not matched.`);
  else assert(frame.progress===0,`${name}: commerce posters must use their initial pose.`);
  const png=Buffer.from(value.slice(value.indexOf(',')+1),'base64'),image=sharp(png),metadata=await image.metadata();
  assert(metadata.format==='png'&&metadata.width===1280&&metadata.height===1600&&metadata.hasAlpha&&metadata.channels===4,`${name}: expected exact 1280 × 1600 RGBA pixels.`);
  const stats=await image.stats();assert(stats.channels[3].min===0&&stats.channels[3].max>0,`${name}: capture is empty or has a baked opaque background.`);
  for(const [left,top] of [[0,0],[1279,0],[0,1599],[1279,1599]]){const pixel=await sharp(png).extract({left,top,width:1,height:1}).raw().toBuffer();assert(pixel[3]===0,`${name}: background corner is not transparent.`);}
  validated.push({name,png});
}
if(argv.includes('--validate-only')){console.log(`Validated ${validated.length} source-derived RGBA frames. No assets were written.`);process.exit(0);}
// All files pass source/size/palette validation before any output is written.
await fs.mkdir(path.join(root,'qa'),{recursive:true});
for(const {name,png} of validated){
  await fs.writeFile(path.join(root,'qa',`${name}.png`),png);
  const result=await sharp(png).webp({quality:96,alphaQuality:100,effort:6}).toFile(path.join(root,'assets',`${name}.webp`));
  console.log(`${name}: 1280 × 1600 · ${(result.size/1024).toFixed(1)} KB`);
}
await fs.writeFile(path.join(root,'qa/motion-poster-metadata.json'),JSON.stringify({schema:bundle.schema,reference:bundle.reference,source:bundle.source,frames:bundle.frames},null,2));
console.log(`Wrote ${validated.length} approved poster assets and their private source/projection metadata.`);

