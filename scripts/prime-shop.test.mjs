import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {primeShop} from '../assets/prime-shop.js';

function fixture(storage){
  const fields=new Map(),style=new Map(),link={hidden:true},image={};
  const form={dataset:{id:'argan'},elements:{format:{value:'shampoo'}},querySelectorAll:()=>[],querySelector:key=>{
    if(!fields.has(key))fields.set(key,{});return fields.get(key);
  }};
  const element={dataset:{shopScene:'product',artDirection:'detail',scent:'argan'},classList:{contains:()=>true},
    querySelector:()=>image,closest:()=>null,getBoundingClientRect:()=>({width:390,height:472}),style:{setProperty:(k,v)=>style.set(k,v)}};
  const doc={documentElement:{dataset:{}},querySelector:key=>key==='main'?{hasAttribute:()=>false}:form,
    querySelectorAll:key=>key==='[data-resume-journey]'?[link]:key==='[data-shop-scene].scene-preview'?[element]:[]};
  const ui={base:'/demo',lang:'de',version:'test',formatAdd:{refill:'Refill in die Tasche'},formatNote:{refill:'Gefüllter Einsatz'}};
  primeShop({doc,storage,href:'https://example.test/de/products/argan/?format=refill',ui});
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

test('serialized prepaint code is valid classic JavaScript and precedes the lower page widgets',()=>{
  const source=fs.readFileSync(new URL('../docs/de/products/argan/index.html',import.meta.url),'utf8');
  const script=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script?.includes('primeShop'));
  assert.doesNotThrow(()=>new Function(script));
  assert.ok(source.indexOf('try{primeShop')<source.indexOf('id="bag-dialog"'));
});
