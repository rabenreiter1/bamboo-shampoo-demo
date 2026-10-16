import test from 'node:test';
import assert from 'node:assert/strict';
import {cartAddition, syncRelatedFormat, createCheckoutLoader} from '../assets/commerce.js';

test('cart additions report actual increments and limits, rather than a false success at twenty',()=>{
  assert.deepEqual(cartAddition(20,1),{quantity:20,added:0,limited:true});
  assert.deepEqual(cartAddition(19,4),{quantity:20,added:1,limited:true});
  assert.deepEqual(cartAddition(0,2),{quantity:2,added:2,limited:false});
  assert.deepEqual(cartAddition(0,Infinity),{quantity:20,added:20,limited:false});
});

function cardHarness(){
  const attrs=()=>({setAttribute(name,value){this[name]=value;}});
  const art=attrs(),meta={},formatName={},price={},image={},add={...attrs(),dataset:{}};
  const links=[{href:'https://shop.test/bamboo-shampoo-demo/classic/en/products/bamboo/'},{href:'https://shop.test/bamboo-shampoo-demo/classic/en/products/bamboo/'}];
  const elements={'.product-card__art':art,'.product-card__meta span':meta,'.product-card__info h3 span':formatName,'.product-card__price':price,'.product-card__art img':image,'[data-quick-add]':add};
  const card={dataset:{fragrance:'bamboo',format:'shampoo'},querySelector:key=>elements[key],querySelectorAll:()=>links};
  const scope={querySelectorAll:()=>[card]};
  return {scope,card,art,meta,formatName,price,image,add,links};
}

test('related scent cards preserve modern localized routes and switch every commerce surface together',()=>{
  const h=cardHarness(),args={lang:'en',base:'/bamboo-shampoo-demo',version:'release-test',names:{bamboo:'Bamboo'}};
  syncRelatedFormat(h.scope,{...args,format:'refill',label:'Refill'});
  assert.equal(h.card.dataset.format,'refill');
  assert.ok(h.links.every(link=>link.href==='https://shop.test/bamboo-shampoo-demo/classic/en/products/bamboo/?format=refill'));
  assert.equal(h.meta.textContent,'REFILL');assert.equal(h.formatName.textContent,'Refill');
  assert.match(h.image.src,/cycles-refill-bamboo-.*\.webp\?v=release-test$/);
  assert.match(h.image.srcset,/-640\.webp\?v=release-test 640w/);
  assert.equal(h.image.alt,'Bamboo Refill · 250 ml');
  assert.match(h.price.textContent,/4\.50/);
  assert.equal(h.add.dataset.format,'refill');assert.equal(h.add.dataset.quickFormat,'refill');
  assert.equal(h.add['aria-label'],'Bamboo Refill add to bag');
  syncRelatedFormat(h.scope,{...args,format:'shampoo',label:'Starter Set'});
  assert.ok(h.links.every(link=>!link.href.includes('?format=')));
  assert.match(h.image.src,/cycles-product-bamboo-/);
  assert.match(h.price.textContent,/12\.50/);
  assert.equal(h.add.dataset.quickFormat,'shampoo');
});

test('a failed checkout can retry with a fresh attempt while preventing duplicate controller initialization',async()=>{
  const states=[],attempts=[];let initializeCount=0,release;
  const controller={syncCart(){}};
  const loader=createCheckoutLoader({
    load:attempt=>{attempts.push(attempt);if(attempt===1)throw new Error('network offline');return new Promise(resolve=>{release=()=>resolve({initializeCheckout(){}});});},
    initialize:()=>{initializeCount++;return controller;},onState:state=>states.push(state)
  });
  assert.equal(await loader.start(),null);
  assert.deepEqual(states,['loading','error']);
  const first=loader.start(),second=loader.start();assert.equal(first,second);
  await Promise.resolve();release();
  assert.equal(await first,controller);assert.equal(await loader.start(),controller);
  assert.equal(initializeCount,1);assert.deepEqual(attempts,[1,2]);
  assert.deepEqual(states,['loading','error','loading','ready']);
});

test('checkout initialization failure is recoverable and does not mark the page ready',async()=>{
  let count=0;const states=[];
  const loader=createCheckoutLoader({load:async()=>({}),initialize:()=>++count===1?null:{},onState:state=>states.push(state)});
  assert.equal(await loader.start(),null);assert.equal(states.at(-1),'error');
  assert.ok(await loader.start());assert.equal(states.at(-1),'ready');
});
