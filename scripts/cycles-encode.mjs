/** Encode completed source-locked Cycles renders. No generative pixel edits. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {productPhotoAsset} from '../assets/product-photos.js';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const codeSha=b=>sha(Buffer.from(b.toString().replaceAll('\r\n','\n')));
const directory=process.argv[2];if(!directory)throw Error('Usage: node scripts/cycles-encode.mjs <complete-render-directory>');
const render=JSON.parse(await fs.readFile(path.join(directory,'render-manifest.json'),'utf8'));
if(!render.geometryUnchanged||JSON.stringify(render.geometryBefore)!==JSON.stringify(render.geometryAfter))throw Error('Cycles changed source geometry');
const boundary=render.liquidOpticalBoundary;
if(!boundary||![boundary.sourceFloat32PositionsSha256,boundary.renderFloat32PositionsSha256].every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value))||boundary.sourceFloat32PositionsSha256!==boundary.renderFloat32PositionsSha256)throw Error('Missing or changed liquid optical boundary positions');
const job=JSON.parse(await fs.readFile(path.join(directory,'job-provenance.json'),'utf8'));
const recipeSnapshot=await fs.readFile(path.join(directory,job.renderRecipeSnapshot));
if(sha(recipeSnapshot)!==job.renderRecipeSha256||sha(await fs.readFile('scripts/cycles-render.py'))!==job.renderRecipeSha256)throw Error('Executed render recipe differs from recorded snapshot');
if(render.renderRecipeSha256!==job.renderRecipeSha256)throw Error('Renderer did not confirm its launch recipe hash');
if(!(new Date(job.recipeLastWriteUtc)<new Date(job.processStartedUtc)))throw Error('The recipe changed after the render process started');
const serialized=JSON.parse(await fs.readFile(path.join(directory,'geometry-serialization-check.json'),'utf8'));
if(!serialized.verified||serialized.glbSha256!==render.sourceGlbSha256||!serialized.exactPositionBuffers||!serialized.exactUvBuffers||!serialized.exactIndexBuffersAfterMaterialSplitReassembly||!serialized.sourceTransformsPreserved)throw Error('Serialized factory geometry was not verified');
const engraving=sha(await fs.readFile('assets/assembly/original-engraving.svg'));
if(engraving!==render.originalEngravingSha256||engraving!=='67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa')throw Error('Original engraving changed');
const source={};for(const [file,hash]of Object.entries(render.source)){
 const bytes=await fs.readFile(`assets/${file}`);if(sha(bytes)!==hash)throw Error(`Source changed after render: ${file}`);
 source[file]={sha256:hash,normalizedSha256:file.endsWith('.js')?codeSha(bytes):hash};
}
const manifest={schema:'bamboo-current-studio-stills-v3',method:'Blender Cycles raytraced product visualization. Fresh current operative factory export; no legacy model, geometry modifiers or generative image edits. WebP encoding and responsive resizing only.',renderer:render.blenderVersion,sourceGlbSha256:render.sourceGlbSha256,source,engravingSha256:engraving,capCorrectionSha256:sha(await fs.readFile('scripts/cap-profile-correction.json')),geometryUnchanged:true,geometryBefore:render.geometryBefore,geometryAfter:render.geometryAfter,geometryModifiers:render.geometryModifiers,opticalBevelOnlyMetres:render.opticalBevelOnlyMetres,frames:render.frames,renderScriptSha256:codeSha(await fs.readFile('scripts/cycles-render.py')),exportScriptSha256:codeSha(await fs.readFile('scripts/cycles-export.js')),assets:{}};
const validated=[];
manifest.encoder={sharp:sharp.versions.sharp,vips:sharp.versions.vips,webp:sharp.versions.webp};
manifest.renderJob=job;
manifest.serializedGeometry=serialized;
manifest.reusedOpaqueJob=render.reusedOpaqueJob;
manifest.reusedFrameJob=render.reusedFrameJob;
manifest.macroSurfaceShading=render.macroSurfaceShading;
manifest.liquidOpticalBoundary={...boundary,sourceMeniscusContactGapMillimetres:.20436392741156,watertight:false,assumption:'The source free-surface perimeter is 0.204364 mm above the side wall. Exact source triangles retain that small contact gap. Single-object Cycles optical approximation; no connecting faces or changed contours.'};
for(const [name,frame]of Object.entries(render.frames)){
 const bytes=await fs.readFile(path.join(directory,`${name}.png`));if(sha(bytes)!==frame.sha256)throw Error(`PNG changed: ${name}`);
 const meta=await sharp(bytes).metadata();if(meta.width!==frame.width||meta.height!==frame.height||!meta.hasAlpha)throw Error(`Invalid capture ${name}`);
 if(frame.samples<128)throw Error('Proof renders cannot be published');
 const mode=frame.mode==='detail'?'detail':frame.mode;
 for(const small of mode==='detail'?[false]:[false,true]){
  const filename=productPhotoAsset(mode,frame.scent,small),budget=small?120000:240000;
  let output,quality=94;
  do {output=await sharp(bytes).resize(small?640:meta.width,small?800:meta.height).webp({quality,alphaQuality:100,effort:6}).toBuffer();quality-=2;}while(output.length>=budget&&quality>=84);
  if(output.length>=budget)throw Error(`${filename}: exceeds budget with acceptable quality`);
  const m=await sharp(output).metadata();validated.push({filename,bytes:output});
  manifest.assets[filename]={mode,scent:frame.scent,sourceFrame:name,sourceSha256:frame.sha256,sha256:sha(output),bytes:output.length,width:m.width,height:m.height,hasAlpha:m.hasAlpha,budgetBytes:budget,quality:quality+2,sourceGeometryIdentical:true};
 }
}
if(validated.length!==17)throw Error(`Expected 17 final assets, got ${validated.length}`);
for(const {filename,bytes}of validated){await fs.writeFile(`assets/${filename}`,bytes);console.log(filename,bytes.length);}
await fs.writeFile('scripts/current-studio-stills-manifest.json',JSON.stringify(manifest,null,2)+'\n');
