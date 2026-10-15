import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {productPhotoAsset} from '../assets/product-photos.js';
import {shareCardSpecs} from './share-cards.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync('scripts/current-studio-stills-manifest.json','utf8'));

test('commerce starter-set stills use the current finished model frame without product retouching',()=>{
 const finish=JSON.parse(fs.readFileSync('scripts/surface-finish-manifest.json','utf8'));
 assert.equal(manifest.surfaceFinishCodeSha256,finish.code['assembly/surface-finish.js']);
 assert.equal(manifest.engravingSha256,finish.engravingSha256);
 assert.equal(Object.keys(manifest.assets).length,6);
 for(const scent of ['aloe','argan','bamboo'])for(const small of [false,true]){
  const file=productPhotoAsset('product',scent,small),entry=manifest.assets[file],bytes=fs.readFileSync(`assets/${file}`);
  assert.match(file,/^studio-product-.*-20261015/);
  assert.equal(hash(bytes),entry.sha256);assert.ok(bytes.equals(fs.readFileSync(`docs/assets/${file}`)));
  assert.equal(entry.sourceSha256,finish.loadingFrames.assets[entry.sourceFrame].sha256);
  if(!small){assert.equal(entry.byteIdenticalToSource,true);assert.ok(bytes.equals(fs.readFileSync(`assets/${entry.sourceFrame}`)));}
  assert.ok(entry.bytes<(small?120000:240000));assert.equal(entry.hasAlpha,true);
 }
});

test('published collections, product pages, basket mapping and share artwork no longer select legacy starter-set photos',()=>{
 for(const lang of ['de','en'])for(const route of ['','shop/','products/aloe/','products/argan/','products/bamboo/']){
  const html=fs.readFileSync(`docs/${lang}/${route}index.html`,'utf8'),images=[...html.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]).join('\n');
  assert.doesNotMatch(images,/\/photo-product-(aloe|argan|bamboo)/,`${lang}/${route} still selects the old product imagery`);
  for(const scent of route.startsWith('products/')?[route.split('/')[1]]:['aloe','argan','bamboo']){
   assert.ok(images.includes(productPhotoAsset('product',scent)));assert.ok(images.includes(productPhotoAsset('product',scent,true)));
  }
 }
 for(const spec of shareCardSpecs.filter(s=>s.id!=='refill'))assert.equal(spec.product,productPhotoAsset('product',['aloe','argan','bamboo'].includes(spec.id)?spec.id:'aloe'));
 const app=fs.readFileSync('docs/assets/app.js','utf8');assert.match(app,/productPhotoAsset\(row.format==='refill'\?'refill':'product',row.scent,true\)/);
 assert.match(app,/product-photos\.js\?v=shop-20261015-stills7/);
});
