import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {motionPosterInventory,validateMotionPosters,validateMotionPosterSources,MOTION_POSTER_SOURCES,REQUIRED_MOTION_POSTERS} from './motion-posters.mjs';

const stage=(src='shop-ritual-product-argan.webp',cls='ritual-stage scene-preview')=>`<div class="${cls}" data-shop-scene="ritual" data-preview-profile="ritual" data-art-direction="ritual" data-scent="argan"><img src="/demo/assets/${src}?v=release"></div>`;
test('inventory covers plain ritual, guide and teaser families without depending on filename blacklist',()=>{
 const [ritual]=motionPosterInventory(stage());assert.equal(ritual.expected,'shop-ritual-product-argan.webp');assert.equal(ritual.profile,'ritual');assert.equal(ritual.actual,ritual.expected);
 const [guide]=motionPosterInventory('<div class="scene-preview" data-shop-scene="journey" data-art-direction="journey" data-scent="bamboo"><img src="/assets/shop-guide-product-bamboo.webp"></div>');assert.equal(guide.expected,'shop-guide-product-bamboo.webp');
 const [teaser]=motionPosterInventory('<div class="scene-preview" data-shop-scene="ritual" data-art-direction="campaign" data-scent="aloe"><img src="/assets/shop-teaser-product-aloe.webp"></div>');assert.equal(teaser.profile,'refill-teaser');
});

test('publication gate rejects unframed stages, stale family, missing proof and changed bytes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bamboo-motion-'));
 try{
  const root=path.join(dir,'docs'),sourceRoot=path.join(dir,'assets'),manifestFile=path.join(dir,'manifest.json');
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});fs.mkdirSync(sourceRoot);const bytes=Buffer.from('verified-test-poster'),file='shop-ritual-product-argan.webp';
  for(const folder of[sourceRoot,path.join(root,'assets')])fs.writeFileSync(path.join(folder,file),bytes);
  const manifest={loadingFrames:{source:{},assets:{}}};
  for(const name of MOTION_POSTER_SOURCES){const target=path.join(sourceRoot,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);manifest.loadingFrames.source[name]=crypto.createHash('sha256').update(bytes).digest('hex');}
  for(const poster of REQUIRED_MOTION_POSTERS){for(const folder of[sourceRoot,path.join(root,'assets')])fs.writeFileSync(path.join(folder,poster.file),bytes);manifest.loadingFrames.assets[poster.file]={mode:poster.mode,scent:poster.scent,progress:poster.progress,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}
  const write=html=>{fs.writeFileSync(path.join(root,'index.html'),html);fs.writeFileSync(manifestFile,JSON.stringify(manifest));};
  const check=()=>validateMotionPosters({root,sourceRoot,manifestFile});
  write(stage());assert.equal(check().length,1);
  write(stage(file,'ritual-stage'));assert.throws(check,/bypasses/);
  write(stage('shop-product-front-argan.webp'));assert.throws(check,/not the matched/);
  write(stage());const proof=manifest.loadingFrames.assets[file];delete manifest.loadingFrames.assets[file];write(stage());assert.throws(check,/provenance/);
  manifest.loadingFrames.assets[file]=proof;write(stage());fs.writeFileSync(path.join(root,'assets',file),'changed');assert.throws(check,/bytes differ/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('source-only preflight fails closed before the builder creates docs for missing captures or stale source',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bamboo-preflight-'));
 try{
  const sourceRoot=path.join(dir,'assets'),manifestFile=path.join(dir,'scripts/surface-finish-manifest.json'),root=path.join(dir,'docs');
  fs.mkdirSync(sourceRoot,{recursive:true});fs.mkdirSync(path.dirname(manifestFile));const bytes=Buffer.from('verified'),digest=crypto.createHash('sha256').update(bytes).digest('hex');
  const manifest={loadingFrames:{source:{},assets:{}}};
  for(const file of MOTION_POSTER_SOURCES){const target=path.join(sourceRoot,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);manifest.loadingFrames.source[file]=digest;}
  for(const poster of REQUIRED_MOTION_POSTERS){fs.writeFileSync(path.join(sourceRoot,poster.file),bytes);manifest.loadingFrames.assets[poster.file]={...poster,bytes:bytes.length,sha256:digest};}
  const save=()=>fs.writeFileSync(manifestFile,JSON.stringify(manifest)),check=()=>validateMotionPosterSources({sourceRoot,manifestFile});save();assert.equal(Object.keys(check().assets).length,12);assert.equal(fs.existsSync(root),false);
  const missing=REQUIRED_MOTION_POSTERS[0].file,proof=manifest.loadingFrames.assets[missing];delete manifest.loadingFrames.assets[missing];save();assert.throws(check,/Actual frame capture/);assert.equal(fs.existsSync(root),false);
  manifest.loadingFrames.assets[missing]=proof;save();fs.writeFileSync(path.join(sourceRoot,missing),'changed');assert.throws(check,/bytes differ/);fs.writeFileSync(path.join(sourceRoot,missing),bytes);
  fs.writeFileSync(path.join(sourceRoot,MOTION_POSTER_SOURCES[0]),'stale');assert.throws(check,/source changed/);
  const build=spawnSync(process.execPath,[fileURLToPath(new URL('./shop-build.mjs',import.meta.url))],{cwd:dir,encoding:'utf8'});
  assert.equal(build.status,1);assert.match(build.stderr,/Motion poster source changed/);assert.equal(fs.existsSync(root),false,'preflight precedes all mkdir/copy/build writes');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
