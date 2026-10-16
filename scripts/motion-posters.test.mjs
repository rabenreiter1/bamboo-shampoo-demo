import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {motionPosterInventory,validateMotionPosters,validateMotionPosterSources,MOTION_POSTER_SOURCES,REQUIRED_MOTION_POSTERS} from './motion-posters.mjs';

const status='<span class="scene-loading" role="status" aria-live="polite"><span class="scene-loading__pending">Animation wird vorbereitet</span><span class="scene-loading__fallback">Die Animation ist nicht verfügbar. Alle Schritte stehen unten.</span></span>';
const steps=Array.from({length:8},(_,i)=>`<article data-journey-caption="${i}"><h2>Step ${i}</h2><p>Complete written instruction.</p></article>`).join('');
const stage=(body=status,extra='')=>`<div class="ritual-stage scene-preview" data-shop-scene="ritual" data-preview-profile="ritual" data-loading-state="neutral" data-art-direction="ritual" data-scent="argan" ${extra}>${body}</div>${steps}`;

test('inventory separates neutral loading state from archived camera-specific image families',()=>{
 const [ritual]=motionPosterInventory(stage());assert.equal(ritual.profile,'ritual');assert.equal(ritual.explicitProfile,'ritual');assert.equal(ritual.actual,null);assert.equal(ritual.loadingState,'neutral');assert.equal(ritual.visualAsset,false);assert.equal(ritual.status.role,'status');
 const [nested]=motionPosterInventory(stage('<div>Nested status wrapper</div><img src="/stale.webp">'+status));assert.equal(nested.visualAsset,true,'a nested wrapper cannot hide a stale image from the publication gate');
 const [guide]=motionPosterInventory('<div class="scene-preview" data-shop-scene="journey" data-preview-profile="home-cycle" data-art-direction="journey" data-scent="bamboo">'+status+'</div>');assert.equal(guide.profile,'home-cycle');
});

test('neutral publication rejects images, missing accessibility, ambiguous profiles and missing written steps',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bamboo-neutral-motion-'));
 try{
  const root=path.join(dir,'docs');fs.mkdirSync(root);
  const write=html=>fs.writeFileSync(path.join(root,'index.html'),html),check=()=>validateMotionPosters({root,sourceRoot:path.join(dir,'no-assets'),manifestFile:path.join(dir,'no-manifest')});
  write(stage());assert.equal(check().length,1,'no captured asset is required or published for a neutral first paint');
  for(const html of [stage().replace(' scene-preview',''),stage().replace('data-loading-state="neutral"',''),stage().replace('data-preview-profile="ritual"',''),stage(status.replace('role="status"','')),stage(status.replace('aria-live="polite"','')),stage(status.replace(/<span class="scene-loading__fallback">[^<]+<\/span>/,'')),stage().replace(steps,'')]){write(html);assert.throws(check);}
  for(const asset of ['<img src="/old.webp">','<picture><source srcset="/old.webp"></picture>','<div style="background-image:url(/old.webp)"></div>','<video poster="/old.webp"></video>']){write(stage(status+asset));assert.throws(check,/unverified visual asset/);}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('source preflight explicitly selects neutral loading without relabeling archived captures',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bamboo-motion-policy-'));
 try{
  const manifestFile=path.join(dir,'archive.json');const original='{"loadingFrames":{"method":"historical, unmodified capture"}}\n';fs.writeFileSync(manifestFile,original);
  assert.deepEqual(validateMotionPosterSources({manifestFile}),{policy:'neutral',posterAssets:[]});assert.equal(fs.readFileSync(manifestFile,'utf8'),original);
  assert.throws(()=>validateMotionPosterSources({manifestFile,policy:'captured'}),/provenance is missing/);
  assert.throws(()=>validateMotionPosterSources({manifestFile,policy:'unknown'}),/Unknown motion loading policy/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('future captured loading remains fail-closed for missing proof, stale source and changed bytes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bamboo-captured-preflight-'));
 try{
  const sourceRoot=path.join(dir,'assets'),manifestFile=path.join(dir,'manifest.json');fs.mkdirSync(sourceRoot);
  const bytes=Buffer.from('verified'),digest=crypto.createHash('sha256').update(bytes).digest('hex'),manifest={loadingFrames:{source:{},assets:{}}};
  for(const file of MOTION_POSTER_SOURCES){const target=path.join(sourceRoot,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);manifest.loadingFrames.source[file]=digest;}
  for(const poster of REQUIRED_MOTION_POSTERS){fs.writeFileSync(path.join(sourceRoot,poster.file),bytes);manifest.loadingFrames.assets[poster.file]={...poster,bytes:bytes.length,sha256:digest};}
  const save=()=>fs.writeFileSync(manifestFile,JSON.stringify(manifest)),check=()=>validateMotionPosterSources({sourceRoot,manifestFile,policy:'captured'});save();assert.equal(Object.keys(check().assets).length,12);
  const missing=REQUIRED_MOTION_POSTERS[0].file,proof=manifest.loadingFrames.assets[missing];delete manifest.loadingFrames.assets[missing];save();assert.throws(check,/Actual frame capture/);
  manifest.loadingFrames.assets[missing]=proof;save();fs.writeFileSync(path.join(sourceRoot,missing),'changed');assert.throws(check,/bytes differ/);fs.writeFileSync(path.join(sourceRoot,missing),bytes);
  fs.writeFileSync(path.join(sourceRoot,MOTION_POSTER_SOURCES[0]),'stale');assert.throws(check,/source changed/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
