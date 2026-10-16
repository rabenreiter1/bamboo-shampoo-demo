import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createShopPages} from './shop-pages.mjs';
import {createClassicPages} from './classic-pages.mjs';
import {initializeProductJourney} from '../assets/journey-caption.js';

const args={BASE:'/bamboo-shampoo-demo',fragrances:['aloe','argan','bamboo'],formatPrice:value=>`${value/100} €`,icon:()=>'<svg></svg>',esc:String};
const pages=createShopPages(args);

test('Modern campaign routing is independent from the shared asset base',()=>{
  const modern=createClassicPages({...args,pages});
  const isolated=createClassicPages({...args,pages,routeBase:'/bamboo-shampoo-demo/preview'});
  for(const lang of ['de','en']){
    assert.match(modern[lang].home,new RegExp(`href="/bamboo-shampoo-demo/${lang}/products/bamboo/"`));
    assert.match(isolated[lang].home,new RegExp(`href="/bamboo-shampoo-demo/preview/${lang}/products/bamboo/"`));
    assert.match(isolated[lang].home,/src="\/bamboo-shampoo-demo\/assets\//);
    assert.doesNotMatch(isolated[lang].home,/preview\/assets\//);
  }
});

test('Modern scroll chapters each target an authored marker understood by the scene controller',()=>{
  const modern=createClassicPages({...args,pages});
  for(const lang of ['de','en']){
    const home=modern[lang].home;
    for(const [id,at,until] of [['open','.07','.15'],['peel','.16','.27'],['dose','.36','.72'],['refill','.735','.96']]){
      assert.match(home,new RegExp(`href="#ritual-${id}" data-guide-chapter="${id}"`));
      const marker=home.match(new RegExp(`<span id="ritual-${id}"[^>]+>`))?.[0];
      assert.ok(marker,`Missing ${lang} chapter marker ${id}`);
      assert.ok(marker.includes(`data-journey-at="${Number(at)}"`));
      assert.ok(marker.includes(`data-journey-until="${Number(until)}"`));
    }
    assert.equal((home.match(/data-guide-chapter=/g)||[]).length,4);
    assert.equal((home.match(/data-journey-caption=/g)||[]).length,8,'Every written action remains available without WebGL');
  }
});

test('Modern hero has one starter-set purchase action with size and price',()=>{
  const modern=createClassicPages({...args,pages});
  for(const lang of ['de','en']){
    const hero=modern[lang].home.slice(0,modern[lang].home.indexOf('<section class="section-shell home-collection'));
    assert.equal((hero.match(/class="hero-buy"/g)||[]).length,1);
    assert.match(hero,/<small>250 ml · 12.5 €<\/small>/);
    assert.match(hero,/class="campaign-word">BAMBOO/);
    assert.doesNotMatch(hero,/data-shop-scene/,'The opening stays static product photography');
  }
});

test('Modern chapter navigation announces the displayed action in forward and reverse playback',()=>{
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  const links=['open','peel','dose','refill'].map(id=>({dataset:{guideChapter:id},attributes:new Map(),setAttribute(key,value){this.attributes.set(key,value);},removeAttribute(key){this.attributes.delete(key);}}));
  const classes=new Set(),stage={getBoundingClientRect:()=>({height:700})};
  const section={dataset:{},style:{setProperty(){}},classList:{add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));},contains:name=>classes.has(name)},getBoundingClientRect:()=>({top:64,height:6400,bottom:6464}),querySelector:selector=>selector==='[data-shop-scene="journey"]'||selector==='.product-journey__sticky'?stage:null,querySelectorAll:selector=>selector==='[data-guide-chapter]'?links:[]};
  globalThis.window={scrollY:0,addEventListener(){},removeEventListener(){},scrollTo(){}};
  globalThis.document={documentElement:{clientWidth:390},querySelector:()=>({offsetHeight:64})};
  try{
    const controller=initializeProductJourney(section);
    const phases=[['closed','open'],['uncap','open'],['unseal','peel'],['recap','peel'],['dose','dose'],['remove','refill'],['refill','refill'],['ready','refill']];
    for(const [phase,chapter]of [...phases,...phases.toReversed()]){
      controller.enhance({q:.5,phase});
      assert.deepEqual(links.filter(link=>link.attributes.has('aria-current')).map(link=>link.dataset.guideChapter),[chapter]);
    }
    controller.fallback();assert.ok(links.every(link=>!link.attributes.has('aria-current')));
    controller.suspend();
  }finally{
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  }
});


test('Modern chapter anchors apply the fixed header offset once, keeping Peel in the unseal phase',()=>{
  const css=fs.readFileSync(new URL('../assets/classic.css',import.meta.url),'utf8');
  assert.match(css,/html:has\(\[data-product-journey\]\)\s*\{[^}]*scroll-padding-top:\s*var\(--header\)/);
  const markerRules=[...css.matchAll(/\.product-journey--guide \.product-journey__marker\s*\{([^}]+)\}/g)];
  const margin=markerRules.at(-1)?.[1].match(/scroll-margin-block-start:\s*([^;]+)/)?.[1].trim();
  assert.equal(margin,'0','The document already supplies the header padding; markers must not add it again');
  const header=64,travel=6000,target=.16;
  assert.equal((target*travel-Number(margin))/travel,target);
  assert.ok((target*travel-header)/travel<.15,'A second 64px offset would regress Peel into the preceding uncap pose');
});
