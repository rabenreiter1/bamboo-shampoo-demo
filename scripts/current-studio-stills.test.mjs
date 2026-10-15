import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {productPhotoAsset} from '../assets/product-photos.js';
import {shareCardSpecs} from './share-cards.mjs';
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
 for(const [file,entry]of Object.entries(manifest.source))assert.equal(file.endsWith('.js')?codeHash(fs.readFileSync('assets/'+file)):hash(fs.readFileSync('assets/'+file)),entry.normalizedSha256);
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

test('both presentations select current stills without stale photos or static-to-3D switches',()=>{
 for(const prefix of ['','classic/'])for(const lang of ['de','en'])for(const route of ['','shop/','story/','refill/','products/aloe/','products/argan/','products/bamboo/']){
  const html=fs.readFileSync('docs/'+prefix+lang+'/'+route+'index.html','utf8');
  const images=[...html.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]).join('\n');
  assert.doesNotMatch(images,/\/(?:photo-product|photo-shell|photo-cap|photo-refill|studio-product|studio-shell|studio-cap)/);
  if(route==='story/')for(const mode of ['shell','cap'])for(const small of [false,true])assert.ok(images.includes(productPhotoAsset(mode,'argan',small)));
  if(route.startsWith('products/'))assert.ok(images.includes(productPhotoAsset('product',route.split('/')[1])));
  assert.doesNotMatch(html,/data-media-view|data-product-media/);
 }
 for(const spec of shareCardSpecs)assert.equal(spec.product,productPhotoAsset(spec.id==='refill'?'refill':'product',['aloe','argan','bamboo'].includes(spec.id)?spec.id:'aloe'));
});
