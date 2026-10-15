import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createShopPages} from './shop-pages.mjs';
import { productPhotoAsset,updateProductPhoto,primeProductPhotos } from '../assets/product-photos.js';

function root(mode,scent,{form,world=false}={}){
 const image={alt:`original ${mode} description`};
 const data={photoDefaultMode:mode,photoDefaultScent:scent,photoProductAlt:'The filled starter set',photoRefillAlt:'The sealed refill only'};
 return {dataset:data,closest:selector=>selector==='main.pdp-page'&&form?{querySelector:()=>form}:selector==='[data-world]'&&world?{}:null,
   querySelector:selector=>selector==='[data-product-photo]'?image:null,image};
}
test('all six photo variants have small responsive derivatives and keep animation images separate',()=>{
 for(const scent of ['aloe','argan','bamboo'])for(const mode of ['product','refill'])for(const small of [false,true]){
  const file=productPhotoAsset(mode,scent,small),bytes=fs.readFileSync(`assets/${file}`);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(bytes.toString('ascii',12,16),'VP8X');
  assert.ok(bytes[20]&16,'the photographic cutout retains real alpha');
  assert.equal(bytes.readUIntLE(24,3)+1,small?640:1280);
  assert.equal(bytes.readUIntLE(27,3)+1,small?800:1600);
  assert.ok(bytes.length<(small?120000:240000),'fine material detail is delivered within the image budget');
  assert.ok(bytes.equals(fs.readFileSync(`docs/assets/${file}`)),'the published photo is the reviewed asset');
 }
 assert.equal(productPhotoAsset('journey','aloe'),null);
 assert.equal(productPhotoAsset('ritual','argan'),null);
 assert.equal(productPhotoAsset('product','bad-path'),'studio-product-aloe-20261015b.webp');
});
test('an explicit refill route gets the matching photograph before the first paint',()=>{
 const form={dataset:{id:'argan'}},pdp=root('product','argan',{form}),cap=root('cap','argan'),shell=root('shell','aloe');
 const doc={querySelectorAll:()=>[pdp,cap,shell]};
 primeProductPhotos({doc,base:'/demo',version:'photography',choice:{format:'refill',scent:'bamboo'}});
 assert.equal(pdp.image.src,'/demo/assets/photo-refill-argan.webp?v=photography');
 assert.match(pdp.image.srcset,/photo-refill-argan-640\.webp\?v=photography 640w/);
 assert.equal(pdp.dataset.photoMode,'refill');assert.equal(pdp.image.alt,'The sealed refill only');
 assert.equal(cap.image.src,'/demo/assets/studio-cap-argan-20261015b.webp?v=photography');
 assert.equal(cap.image.alt,'original cap description');
 assert.equal(shell.image.src,'/demo/assets/studio-shell-20261015b.webp?v=photography');
});
test('changing one photographic viewer does not change its neighbouring scent',()=>{
 const aloe=root('product','aloe'),bamboo=root('refill','bamboo');
 updateProductPhoto(aloe,{base:'/demo',mode:'refill',scent:'argan'});
 assert.equal(aloe.image.src,'/demo/assets/photo-refill-argan.webp');
 assert.equal(bamboo.image.src,undefined);assert.equal(bamboo.dataset.photoDefaultScent,'bamboo');
 assert.equal(updateProductPhoto(null,{base:'/demo'}),false);
});
test('static galleries have no 3D inspector while motion stages retain their matched loading frames',()=>{
 const pages=createShopPages({BASE:'/demo',icon:()=>'',fragrances:['aloe','argan','bamboo'],formatPrice:value=>String(value),esc:value=>value});
 for(const lang of ['de','en']){
  const home=pages[lang].home;
  const hero=home.slice(home.indexOf('class="shop-scene intro-stage'),home.indexOf('class="intro-annotations'));
  assert.match(hero,/shop-guide-product-aloe\.webp/);assert.doesNotMatch(hero,/photo-product/);
  for(const scent of ['aloe','argan','bamboo']){
   const page=pages[lang].products[scent];
   assert.match(page,/data-product-photo-viewer data-photo-default-mode="product"/);
   assert.ok(page.includes('data-product-photo src="/demo/assets/studio-product-'+scent+'-20261015b.webp'));
   assert.doesNotMatch(page,/data-product-media|data-media-view|data-shop-scene="product"|product-gallery__hint/);
   assert.equal((page.match(/name="format"/g)||[]).length,2,'one starter-set/refill selector is retained');
  }
  assert.doesNotMatch(pages[lang].story,/data-product-media|data-media-view|data-shop-scene="(?:product|shell|cap|refill)"|scene-hint/);
  assert.match(pages[lang].refill,/data-shop-scene="ritual"/);
 }
 const app=fs.readFileSync('assets/app.js','utf8');
 assert.doesNotMatch(app,/data-product-media|mediaView/,'the dormant inspector controller is removed');
 assert.match(app,/if\(photograph\)\{[\s\S]*?updateProductPhoto[\s\S]*?return;/,'format changes update the still without requesting a renderer');
});
