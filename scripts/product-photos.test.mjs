import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { productPhotoAsset,updateProductPhoto,primeProductPhotos } from '../assets/product-photos.js';

function root(mode,scent,{form,world=false}={}){
 const image={alt:`original ${mode} description`},scene={dataset:{}};
 const data={photoDefaultMode:mode,photoDefaultScent:scent,mediaView:'photo',photoProductAlt:'The filled starter set',photoRefillAlt:'The sealed refill only'};
 return {dataset:data,closest:selector=>selector==='main.pdp-page'&&form?{querySelector:()=>form}:selector==='[data-world]'&&world?{}:null,
   querySelector:selector=>selector==='[data-product-photo]'?image:selector==='[data-shop-scene]'?scene:null,image,scene};
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
 assert.equal(productPhotoAsset('product','bad-path'),'photo-product-aloe.webp');
});
test('an explicit refill route gets the matching photograph before the first paint',()=>{
 const form={dataset:{id:'argan'}},pdp=root('product','argan',{form}),cap=root('cap','argan'),shell=root('shell','aloe');
 const doc={querySelectorAll:()=>[pdp,cap,shell]};
 primeProductPhotos({doc,base:'/demo',version:'photography',choice:{format:'refill',scent:'bamboo'}});
 assert.equal(pdp.image.src,'/demo/assets/photo-refill-argan.webp?v=photography');
 assert.match(pdp.image.srcset,/photo-refill-argan-640\.webp\?v=photography 640w/);
 assert.equal(pdp.scene.dataset.requestedMode,'refill');assert.equal(pdp.image.alt,'The sealed refill only');
 assert.equal(pdp.dataset.mediaView,'photo','prepaint never requests the GPU view');
 assert.equal(cap.image.src,'/demo/assets/photo-cap-argan.webp?v=photography');
 assert.equal(cap.image.alt,'original cap description');
 assert.equal(shell.image.src,'/demo/assets/photo-shell.webp?v=photography');
});
test('changing one photographic viewer does not change its neighbouring scent or model choice',()=>{
 const aloe=root('product','aloe'),bamboo=root('refill','bamboo');
 updateProductPhoto(aloe,{base:'/demo',mode:'refill',scent:'argan'});
 assert.equal(aloe.image.src,'/demo/assets/photo-refill-argan.webp');
 assert.equal(bamboo.image.src,undefined);assert.equal(bamboo.dataset.photoDefaultScent,'bamboo');
 assert.equal(updateProductPhoto(null,{base:'/demo'}),false);
});
test('product images are the default while automatic stories retain their original matched loading frames',()=>{
 for(const lang of ['de','en']){
  const home=fs.readFileSync(`docs/${lang}/index.html`,'utf8');
  const hero=home.slice(home.indexOf('class="shop-scene intro-stage'),home.indexOf('class="intro-annotations'));
  assert.match(hero,/shop-guide-product-aloe\.webp/);assert.doesNotMatch(hero,/photo-product/);
  for(const scent of ['aloe','argan','bamboo']){
   const page=fs.readFileSync(`docs/${lang}/products/${scent}/index.html`,'utf8');
   assert.match(page,/data-product-photo-viewer data-media-view="photo"/);
   assert.match(page,new RegExp(`data-product-photo src="[^"]*photo-product-${scent}\\.webp`));
   assert.match(page,/data-product-media="model" aria-pressed="false"/);
   assert.match(page,/data-shop-scene="product"[^>]*aria-hidden="true" inert/);
  }
 }
});
