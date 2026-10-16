import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {createRuntimeRelease,verifyRuntimeRelease} from './runtime-release.mjs';

function fixture(t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bamboo-runtime-test-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const sourceRoot=path.join(directory,'source'),outputRoot=path.join(directory,'published');fs.mkdirSync(sourceRoot);
  const write=(name,bytes)=>{const target=path.join(sourceRoot,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);};
  write('app.js',"import './assembly/body.js';\r\n");write('shop-scene.js',"import './assembly/body.js';\n");write('product-scene.js','REJECTED');
  write('assembly/body.js','export const radius=29;\r\n');write('assembly/cap-data.json','{"cap":59}\r\n');
  write('assembly/original-engraving.svg','<svg>\r\noriginal\r\n</svg>');write('assembly/textures/bamboo.jpg',Buffer.from([255,216,255,0]));
  write('assembly/models/archive.glb','DO NOT SHIP');write('assembly/models/archived.js','DO NOT SHIP');write('assembly/private.blend','DO NOT SHIP');
  write('shop-guide-product-aloe.webp',Buffer.from([1,2,3]));write('shop-ritual-product-argan-pose12.webp',Buffer.from([4,5,6]));write('cycles-product-aloe.webp','STATIC PHOTOGRAPH');
  return {sourceRoot,outputRoot,write};
}

test('runtime release copies the allowed source layout and excludes rejected, archived and merchandising assets',t=>{
  const options=fixture(t),release=createRuntimeRelease(options);
  assert.match(release.hash,/^[a-f0-9]{16}$/);
  assert.equal(release.baseSuffix,`/assets/releases/${release.hash}`);
  assert.deepEqual(Object.keys(release.files),['app.js','assembly/body.js','assembly/cap-data.json','assembly/original-engraving.svg','assembly/textures/bamboo.jpg','shop-scene.js']);
  for(const [name,metadata]of Object.entries(release.files)){
    const bytes=fs.readFileSync(path.join(release.directory,name));
    assert.equal(bytes.length,metadata.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),metadata.sha256);
  }
  assert.equal(fs.readFileSync(path.join(release.directory,'app.js'),'utf8'),"import './assembly/body.js';\n");
  assert.equal(fs.readFileSync(path.join(release.directory,'assembly/original-engraving.svg'),'utf8'),'<svg>\r\noriginal\r\n</svg>');
  const manifest=JSON.parse(fs.readFileSync(path.join(release.directory,'runtime-release.json'),'utf8'));
  assert.deepEqual(manifest,{schema:1,hash:release.hash,baseSuffix:release.baseSuffix,files:release.files});
});

test('runtime release is deterministic across input order and CRLF/LF checkout differences',t=>{
  const options=fixture(t),first=createRuntimeRelease({...options,files:['shop-scene.js','app.js','app.js']});
  const modified=fs.statSync(path.join(first.directory,'app.js')).mtimeMs;
  options.write('app.js',"import './assembly/body.js';\n");options.write('assembly/body.js','export const radius=29;\n');
  const second=createRuntimeRelease({...options,files:['app.js','shop-scene.js']});
  assert.deepEqual(second,first);assert.equal(fs.statSync(path.join(first.directory,'app.js')).mtimeMs,modified,'A repeated build does not touch immutable files');
});

test('runtime source changes publish a new folder while keeping the earlier release intact',t=>{
  const options=fixture(t),first=createRuntimeRelease(options);
  options.write('assembly/body.js','export const radius=30;\n');
  const second=createRuntimeRelease(options);
  assert.notEqual(first.hash,second.hash);assert.ok(fs.existsSync(first.directory));
  assert.equal(fs.readFileSync(path.join(first.directory,'assembly/body.js'),'utf8'),'export const radius=29;\n');
});

test('runtime allowlist never copies rejected modules or accepts path traversal',t=>{
  const options=fixture(t),release=createRuntimeRelease({...options,files:['app.js','product-scene.js']});
  assert.ok(!('shop-scene.js' in release.files));assert.ok(!('product-scene.js' in release.files));
  assert.throws(()=>createRuntimeRelease({...options,files:['../outside.js']}),/top-level JS/);
  assert.throws(()=>createRuntimeRelease({...options,files:['assembly\\body.js']}),/top-level JS/);
});

test('runtime release refuses to overwrite an existing immutable file',t=>{
  const options=fixture(t),release=createRuntimeRelease(options);
  fs.writeFileSync(path.join(release.directory,'app.js'),'corrupted');
  assert.throws(()=>createRuntimeRelease(options),/different bytes/);
});

test('runtime verification rejects tampering and missing local module dependencies',t=>{
  const options=fixture(t),first=createRuntimeRelease(options);
  assert.equal(verifyRuntimeRelease(first.directory).hash,first.hash);
  fs.writeFileSync(path.join(first.directory,'assembly/body.js'),'changed');
  assert.throws(()=>verifyRuntimeRelease(first.directory),/bytes differ/);
  options.write('app.js',"import './missing.js';\n");
  const second=createRuntimeRelease(options);
  assert.throws(()=>verifyRuntimeRelease(second.directory),/dependency missing/);
});

test('operational source modules form a complete immutable runtime dependency tree',t=>{
  const outputRoot=fs.mkdtempSync(path.join(os.tmpdir(),'bamboo-runtime-operational-'));
  t.after(()=>fs.rmSync(outputRoot,{recursive:true,force:true}));
  const release=createRuntimeRelease({sourceRoot:'assets',outputRoot});
  const manifest=verifyRuntimeRelease(release.directory);
  assert.ok(manifest.files['shop-scene.js']);
  assert.ok(manifest.files['assembly/vendor/three.module.js']);
  assert.ok(manifest.files['assembly/original-engraving.svg']);
});
