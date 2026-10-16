import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {primeShop,needsPlaybackRestorePreview} from '../assets/prime-shop.js';
import * as journeyModule from '../assets/journey.js';
import * as backdropModule from '../assets/campaign-backdrop.js';
import * as previewModule from '../assets/scene-preview.js';
import * as photoModule from '../assets/product-photos.js';
import * as commerceModule from '../assets/commerce.js';
import * as catalogModule from '../assets/catalog.js';

function fixture(storage,prime=primeShop){
  const fields=new Map(),style=new Map(),link={hidden:true},image={};
  const form={dataset:{id:'argan'},elements:{format:{value:'shampoo'}},querySelectorAll:()=>[],querySelector:key=>{
    if(!fields.has(key))fields.set(key,{});return fields.get(key);
  }};
  const element={dataset:{shopScene:'product',artDirection:'detail',scent:'argan'},classList:{contains:()=>true},
    querySelector:()=>image,closest:()=>null,getBoundingClientRect:()=>({width:390,height:472}),style:{setProperty:(k,v)=>style.set(k,v)}};
  const doc={documentElement:{dataset:{}},querySelector:key=>key==='main'?{hasAttribute:()=>false}:form,
    querySelectorAll:key=>key==='[data-resume-journey]'?[link]:key==='[data-shop-scene].scene-preview'?[element]:[]};
  const ui={base:'/demo',lang:'de',version:'test',formatAdd:{refill:'Refill in die Tasche'},formatNote:{refill:'Gefüllter Einsatz'}};
  prime({doc,storage,href:'https://example.test/de/products/argan/?format=refill',ui});
  return {fields,style,link,image,form,element,doc};
}

test('the first paint already reserves the saved return link and selects the queried filled refill',()=>{
  const bookmark={chapter:'ritual',progress:.6,scroll:4300,layout:'collection-before-ritual-v1'};
  const f=fixture({getItem:key=>key==='bamboo-journey-return-v1'?JSON.stringify(bookmark):null});
  assert.equal(f.link.hidden,false);assert.equal(f.link.href,'/demo/de/?resume=1#ritual');
  assert.equal(f.form.elements.format.value,'refill');assert.equal(f.element.dataset.requestedMode,'refill');
  assert.match(f.image.src,/shop-detail-refill-argan\.webp/);assert.equal(f.fields.get('[data-unit-price]').textContent,'18,00 €');
  assert.equal(f.doc.documentElement.dataset.selectedScent,'argan');assert.ok(f.style.has('--preview-height'));
});

test('denied or corrupt browser storage cannot change the explicitly requested first product frame',()=>{
  for(const storage of [{getItem:()=>{throw new Error('Denied');}},{getItem:()=>'{bad json'},
    {getItem:()=>JSON.stringify({chapter:'javascript:bad',progress:.5,scroll:1})}]){
    const f=fixture(storage);assert.equal(f.link.hidden,true);assert.equal(f.element.dataset.requestedMode,'refill');
    assert.match(f.image.src,/refill-argan/);
  }
});

test('a restored moving pose or inspection never displays a contradictory closed-product poster',()=>{
  const saved=(profile,elapsed,yaw=0)=>({version:1,profile,elapsed,paused:true,yaw});
  assert.equal(needsPlaybackRestorePreview(saved('home-cycle',1),'home-cycle'),false);
  assert.equal(needsPlaybackRestorePreview(saved('home-cycle',31),'home-cycle'),false);
  assert.equal(needsPlaybackRestorePreview(saved('home-cycle',17),'home-cycle'),true);
  assert.equal(needsPlaybackRestorePreview(saved('home-cycle',0,Math.PI/2),'home-cycle'),true);
  assert.equal(needsPlaybackRestorePreview(saved('home-cycle',0,2*Math.PI),'home-cycle'),false);
  assert.equal(needsPlaybackRestorePreview(saved('refill-teaser',0),'refill-teaser'),false);
  assert.equal(needsPlaybackRestorePreview(saved('refill-teaser',8),'refill-teaser'),true);
  assert.equal(needsPlaybackRestorePreview(saved('refill-teaser',14),'refill-teaser'),false);
});

test('invalid or incompatible playback data cannot hide the normal loading illustration',()=>{
  for(const snapshot of [null,{}, {version:0,profile:'home-cycle',elapsed:5,paused:false},
    {version:1,profile:'home-cycle',elapsed:NaN,paused:false},
    {version:1,profile:'home-cycle',elapsed:5,paused:'false'},
    {version:1,profile:'home-cycle',elapsed:-1,paused:false},
    {version:1,profile:'home-cycle',elapsed:5,paused:false,yaw:Infinity},
    {version:1,profile:'refill-teaser',elapsed:5,paused:false}]){
    assert.equal(needsPlaybackRestorePreview(snapshot,'home-cycle'),false);
  }
});

test('serialized prepaint code is valid classic JavaScript and precedes the lower page widgets',()=>{
  const source=fs.readFileSync(new URL('../docs/de/products/argan/index.html',import.meta.url),'utf8');
  const script=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script?.includes('primeShop'));
  assert.doesNotThrow(()=>new Function(script));
  assert.ok(source.indexOf('try{primeShop')<source.indexOf('id="bag-dialog"'));
});

test('the current builder serializes all prepaint commerce dependencies without relying on module globals',()=>{
  const builder=fs.readFileSync('scripts/shop-build.mjs','utf8');
  const expression=builder.match(/const primeCode=([^]*?)\r?\nconst pages=/)?.[1].replace(/;\s*$/,'');
  assert.ok(expression,'the builder exposes its serialized prepaint expression');
  const framingCode=fs.readFileSync('assets/scene-framing.js','utf8').replace(/^import[^\n]*\n/gm,'').replace(/\bexport /g,'');
  const bindings={...journeyModule,...backdropModule,...previewModule,...photoModule,...commerceModule,...catalogModule,framingCode,primeShop,needsPlaybackRestorePreview};
  const serialized=new Function(...Object.keys(bindings),`return ${expression}`)(...Object.values(bindings));
  const detached=new Function(`${serialized};return {primeShop,syncRelatedFormat};`)();
  const f=fixture({getItem:()=>null},detached.primeShop);
  assert.equal(f.form.elements.format.value,'refill');assert.match(f.image.src,/refill-argan/);
  const price={},card={dataset:{fragrance:'argan'},querySelectorAll:()=>[],querySelector:selector=>selector==='.product-card__price'?price:null};
  detached.syncRelatedFormat({querySelectorAll:()=>[card]},{format:'refill',lang:'de',base:'/demo',names:{argan:'Argan'},label:'Refill'});
  assert.equal(price.textContent,'4,50 €','serialized formatPrice and authoritative prices exist when a related card is present');
});
