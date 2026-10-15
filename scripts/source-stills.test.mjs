import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createBody} from '../assets/assembly/body.js';
import {createRitualCap} from '../assets/assembly/ritual-cap.js';
const manifest=JSON.parse(fs.readFileSync('scripts/still-capture-manifest.json','utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const codeSha=bytes=>sha(Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n')));

test('finished stills are the captured source-mesh renders, not substituted AI images',()=>{
 assert.equal(manifest.schema,'bamboo-source-stills-v1');
 assert.equal(codeSha(fs.readFileSync('scripts/still-studio.js')),manifest.captureScriptSha256);
 assert.equal(Object.keys(manifest.assets).length,17);
 for(const [file,entry] of Object.entries(manifest.assets)){
  const bytes=fs.readFileSync(`assets/${file}`);
  assert.equal(sha(bytes),entry.sha256,`${file} must be recaptured and verified when replaced`);
  assert.ok(bytes.equals(fs.readFileSync(`docs/assets/${file}`)));
 }
 assert.equal(Object.keys(manifest.frames).length,9);
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

test('every rendered body and cap mesh matches the current approved factory geometry',async()=>{
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
