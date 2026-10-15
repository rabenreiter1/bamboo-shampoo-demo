import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createBody} from '../assets/assembly/body.js';
import {createRitualCap} from '../assets/assembly/ritual-cap.js';
const manifest=JSON.parse(fs.readFileSync('scripts/still-capture-manifest.json','utf8'));
const photographic=JSON.parse(fs.readFileSync('scripts/photographic-stills-manifest.json','utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const codeSha=bytes=>sha(Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n')));

test('selected photographic lower profiles stay within reviewed source-silhouette tolerance',()=>{
 const review=JSON.parse(fs.readFileSync('scripts/photographic-profile-review.json','utf8'));
 assert.equal(review.schema,'bamboo-photo-profile-review-v1');
 assert.equal(review.approvedBaseToCap,58/59);
 assert.ok(review.toleranceRelativeToCap<=.012);
 assert.match(review.limits,/does not certify/);
 assert.deepEqual(Object.keys(review.variants).sort(),['aloe','argan','bamboo']);
 for(const [scent,{reference,selected}]of Object.entries(review.variants)){
  const provenance=photographic.generated[`photo-product-${scent}`];
  assert.equal(selected.sha256,provenance.sourceSha256,'profile review belongs to the selected final image');
  assert.equal(reference.sha256,provenance.baselineCaptureSha256,'profile comparison uses the approved source capture');
  for(const [height,sample]of Object.entries(selected.samples)){
   assert.ok(sample.widthRelativeToCap<1,`${scent}: the lower body must not flare wider than the cap`);
   assert.ok(Math.abs(sample.widthRelativeToCap-reference.samples[height].widthRelativeToCap)<=review.toleranceRelativeToCap,`${scent}: lower silhouette differs from reviewed source`);
  }
 }
});

test('photographic material retouches have recorded output hashes and an honest unchanged source baseline',()=>{
 assert.equal(manifest.schema,'bamboo-source-stills-v1');
 assert.equal(photographic.schema,'bamboo-photographic-stills-v1');
 assert.match(photographic.disclosure,/not camera-captured photographs/);
 assert.match(photographic.disclosure,/not claimed to be mesh-identical or pixel-exact/);
 assert.equal(codeSha(fs.readFileSync(photographic.baseline.file)),photographic.baseline.codeSha256);
 assert.deepEqual(photographic.baseline.source,manifest.source);
 assert.deepEqual(photographic.baseline.assets,manifest.assets);
 assert.equal(codeSha(fs.readFileSync('scripts/still-studio.js')),manifest.captureScriptSha256);
 assert.equal(Object.keys(photographic.assets).length,17);
 assert.equal(Object.keys(photographic.generated).length,9);
 for(const [file,entry] of Object.entries(photographic.assets)){
  const bytes=fs.readFileSync(`assets/${file}`);
  assert.equal(sha(bytes),entry.sha256,`${file} must match the selected photographic output`);
  assert.equal(bytes.length,entry.bytes);
  assert.ok(entry.bytes<entry.budgetBytes,`${file} exceeds its loading budget`);
  assert.equal(entry.hasAlpha,true,`${file} preserves transparent edges`);
  const expected=file.includes('detail')?[1536,1024]:file.includes('-640')?[640,800]:[1280,1600];
  assert.deepEqual([entry.width,entry.height],expected);
  assert.ok(bytes.equals(fs.readFileSync(`docs/assets/${file}`)));
 }
 for(const entry of Object.values(photographic.generated)){
  assert.equal(entry.sourceHasAlpha,true);
  if(fs.existsSync(entry.workspaceCopy))assert.equal(sha(fs.readFileSync(entry.workspaceCopy)),entry.sourceSha256);
  if(fs.existsSync(entry.baselineCapture))assert.equal(sha(fs.readFileSync(entry.baselineCapture)),entry.baselineCaptureSha256);
 }
 assert.equal(Object.keys(manifest.frames).length,9);
 // This is a source-capture claim only. Generative material edits are validated separately above.
 for(const frame of Object.values(manifest.frames))assert.equal(frame.sourceGeometryIdentical,true);
});

test('capture uses the actual 250 ml contour, current cap reference and byte-identical original SVG',()=>{
 for(const [file,hash] of Object.entries(manifest.source)){
  if(file==='actual250Drawing'){
   assert.equal(hash,'7fe76412fe08f68561b2613a2a8d0cbaa771f14f38d3e1084c96b2b0522d9272');
   if(fs.existsSync('qa/reference/actual250.pdf'))assert.equal(sha(fs.readFileSync('qa/reference/actual250.pdf')),hash);
  }else assert.equal((file.endsWith('.js')?codeSha:sha)(fs.readFileSync(`assets/${file}`)),hash,`${file} differs from the rendered source`);
 }
 assert.equal(manifest.source['assembly/original-engraving.svg'],'67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa');
 assert.equal(manifest.source['assembly/cap-reference.jpg'],'dbd0fd9d44a9bc04225e9430fe4d2cd9accadf9a59b2912d20fd49e05a495a41');
 assert.ok(manifest.limits.some(value=>value.includes('placeholder')),'undimensioned details remain explicitly unverified');
});

test('unmodified body and cap factories retain the geometry used by the approved baseline captures',async()=>{
 const body=await createBody({THREE}),cap=await createRitualCap({THREE});
 try{
  const actual={};
  for(const group of [body.components.shell,body.components.inlay,cap.group])group.traverse(o=>{
   if(!o.isMesh)return;
   const attrs={};for(const key of Object.keys(o.geometry.attributes).sort())attrs[key]=sha(Buffer.from(o.geometry.attributes[key].array.buffer));
   if(o.geometry.index)attrs.index=sha(Buffer.from(o.geometry.index.array.buffer));actual[o.name]=attrs;
  });
  assert.deepEqual(actual,manifest.geometry.meshes);
  assert.deepEqual(body.metrics.confirmed,manifest.dimensions);
 }finally{body.dispose();cap.dispose();}
});
