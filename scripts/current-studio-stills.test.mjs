import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {productPhotoAsset} from '../assets/product-photos.js';
import {shareCardSpecs} from './share-cards.mjs';
import {TUBE_PROFILE} from '../assets/assembly/body-profile.js';
import sharp from 'sharp';
const hash=b=>createHash('sha256').update(b).digest('hex');
const codeHash=b=>hash(Buffer.from(b.toString().replaceAll('\r\n','\n')));
const manifest=JSON.parse(fs.readFileSync('scripts/current-studio-stills-manifest.json','utf8'));

test('Cycles stills bind unchanged operative geometry, original artwork and reproducible renderer',()=>{
 assert.equal(manifest.schema,'bamboo-current-studio-stills-v3');
 assert.equal(manifest.geometryUnchanged,true);assert.deepEqual(manifest.geometryBefore,manifest.geometryAfter);
 assert.deepEqual(manifest.geometryModifiers,[]);
 assert.ok(manifest.liquidOpticalBoundary.sourceMeshes.includes('Measured_250ml_gel_volume'));
 assert.equal(manifest.liquidOpticalBoundary.sourceFloat32PositionsSha256,manifest.liquidOpticalBoundary.renderFloat32PositionsSha256);
 assert.equal(manifest.serializedGeometry.verified,true);assert.equal(manifest.serializedGeometry.glbSha256,manifest.sourceGlbSha256);
 assert.equal(manifest.serializedGeometry.exactPositionBuffers,true);assert.equal(manifest.serializedGeometry.exactUvBuffers,true);assert.equal(manifest.serializedGeometry.exactIndexBuffersAfterMaterialSplitReassembly,true);
 assert.equal(manifest.liquidOpticalBoundary.watertight,false,'The unchanged source meniscus contact gap must be disclosed');
 assert.equal(manifest.capCorrectionSha256,hash(fs.readFileSync('scripts/cap-profile-correction.json')));
 assert.equal(manifest.engravingSha256,'67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa');
 assert.equal(manifest.renderScriptSha256,codeHash(fs.readFileSync('scripts/cycles-render.py')));
 assert.equal(manifest.exportScriptSha256,codeHash(fs.readFileSync('scripts/cycles-export.js')));
 for(const [file,entry]of Object.entries(manifest.source)){
  const bytes=fs.readFileSync('assets/'+file),actual=file.endsWith('.js')?codeHash(bytes):hash(bytes);
  if(file!=='assembly/surface-finish.js'||actual===entry.normalizedSha256){assert.equal(actual,entry.normalizedSha256);continue;}
  // A scheduling-only refactor may preserve the historical Cycles images only
  // after a fresh full-model export proves every mesh and texture unchanged.
  const proof=JSON.parse(fs.readFileSync('scripts/surface-runtime-parity.json','utf8'));
  assert.equal(proof.schema,'bamboo-surface-runtime-parity-v1');assert.equal(proof.verified,true);
  for(const [source,original]of Object.entries(manifest.source))assert.equal(proof.baselineSource[source],original.sha256,'The parity baseline must be the exact Cycles source release.');
  assert.equal(proof.baselineSource[file],entry.sha256);assert.equal(proof.currentSource[file],hash(bytes));
  assert.equal(proof.baselineGeometrySha256,proof.currentGeometrySha256);
  for(const flag of['exactMeshAttributes','exactIndices','exactTransforms','exactDecodedTextureRgba','exactMaterialDefinitions','exactMaterialAssignments'])assert.equal(proof[flag],true);
  assert.equal(proof.textures.length,5);assert.ok(proof.textures.every(texture=>/^[a-f0-9]{64}$/.test(texture.rgbaSha256)));
  for(const runtime of['assembly/surface-finish.js','assembly/surface-buffers.js','assembly/surface-worker.js'])assert.equal(codeHash(fs.readFileSync('assets/'+runtime)),proof.runtime[runtime]);
 }
 assert.ok(manifest.geometryBefore['teardrop-button-traced-original']);
 assert.ok(manifest.geometryBefore['Bamboo_outer_sourced_contour_and_original_engraving']);
});

test('all seventeen static assets derive from completed Cycles frames within responsive budgets',()=>{
 assert.equal(Object.keys(manifest.assets).length,17);assert.equal(Object.keys(manifest.frames).length,9);
 for(const [file,entry]of Object.entries(manifest.assets)){
  const bytes=fs.readFileSync('assets/'+file),frame=manifest.frames[entry.sourceFrame];
  assert.equal(hash(bytes),entry.sha256);assert.ok(bytes.equals(fs.readFileSync('docs/assets/'+file)));
  assert.equal(entry.sourceSha256,frame.sha256);assert.ok(frame.samples>=128,'proof frames cannot ship');
  assert.equal(entry.hasAlpha,true);assert.equal(entry.sourceGeometryIdentical,true);
  assert.ok(entry.bytes<(file.includes('-640')?120000:240000));assert.ok(entry.quality>=84);
  assert.deepEqual([entry.width,entry.height],entry.mode==='detail'?[1536,1024]:file.includes('-640')?[640,800]:[1280,1600]);
 }
});

test('commerce perspective follows the live viewer and does not exaggerate the bamboo base',()=>{
 for(const scent of ['aloe','argan','bamboo']){
  const frame=manifest.frames[`product-${scent}`];
  assert.equal(frame.projection,'PERSP');assert.equal(frame.verticalFieldOfViewDegrees,30);
  assert.equal(frame.shadowCatcherVisible,false,'cut-out product images must not contain a clipped floor slab');
  const offset=frame.camera.map((v,i)=>v-frame.center[i]);
  assert.ok(Math.abs(offset[0]/-offset[1]-.19)<1e-6);
  assert.ok(Math.abs(offset[2]/-offset[1]-.44)<1e-6);
  const distance=Math.hypot(...offset),up=offset[2]/distance;
  const diameterAt=(y,r)=>2*r*.001/(distance-(y*.001-frame.center[2])*up);
  const [bottomY,bottomR]=TUBE_PROFILE[0],middle=TUBE_PROFILE.find(([y])=>y===84);
  const apparentRatio=diameterAt(bottomY,bottomR)/diameterAt(...middle);
  assert.ok(apparentRatio>.95&&apparentRatio<1.06,`base/middle projection ${apparentRatio} should read like the live product`);
 }
 assert.equal(manifest.frames['shell-aloe'].projection,'PERSP');
 assert.equal(manifest.frames['shell-aloe'].shadowCatcherVisible,false);
});

test('bamboo cut-outs have transparent borders without cropped floor shadows',async()=>{
 for(const scent of ['aloe','argan','bamboo'])for(const small of [false,true]){
  const file=`assets/${productPhotoAsset('product',scent,small)}`,{width,height}=await sharp(file).metadata();
  for(const edge of [{left:0,top:0,width,height:1},{left:0,top:height-1,width,height:1},{left:0,top:0,width:1,height},{left:width-1,top:0,width:1,height}]){
   const {data,info}=await sharp(file).extract(edge).raw().toBuffer({resolveWithObject:true});
   assert.equal(info.channels,4);
   for(let i=3;i<data.length;i+=info.channels)assert.equal(data[i],0,`${file}: the product or floor shadow is clipped at an image border`);
  }
 }
});

test('both presentations select current stills without stale photos or static-to-3D switches',()=>{
 for(const prefix of ['','design/classic/'])for(const lang of ['de','en'])for(const route of ['','shop/','story/','refill/','products/aloe/','products/argan/','products/bamboo/']){
  const html=fs.readFileSync('docs/'+prefix+lang+'/'+route+'index.html','utf8');
  const images=[...html.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]).join('\n');
  assert.doesNotMatch(images,/\/(?:photo-product|photo-shell|photo-cap|photo-refill|studio-product|studio-shell|studio-cap)/);
  if(route==='story/')for(const mode of ['shell','cap'])for(const small of [false,true])assert.ok(images.includes(productPhotoAsset(mode,'argan',small)));
  if(route.startsWith('products/'))assert.ok(images.includes(productPhotoAsset('product',route.split('/')[1])));
  assert.doesNotMatch(html,/data-media-view|data-product-media/);
 }
 for(const spec of shareCardSpecs)assert.equal(spec.product,productPhotoAsset(spec.id==='refill'?'refill':'product',['aloe','argan','bamboo'].includes(spec.id)?spec.id:'aloe'));
});
