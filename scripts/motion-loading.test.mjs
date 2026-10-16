import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createShopPages} from './shop-pages.mjs';
import {createClassicPages} from './classic-pages.mjs';
import {createScenePreviews} from '../assets/scene-preview.js';

const options={BASE:'/demo',icon:()=>'',fragrances:['aloe','argan','bamboo'],formatPrice:value=>String(value),esc:value=>value};
const classic=createShopPages(options),modern=createClassicPages({...options,pages:classic});

function motionStages(html){
 return [...html.matchAll(/<div\b[^>]*data-shop-scene="(?:journey|ritual)"[^>]*>[\s\S]*?<\/div>/g)].map(match=>match[0]);
}

test('every motion stage starts neutrally and cannot request an old product image',()=>{
 let total=0;
 for(const pages of [classic,modern])for(const lang of ['de','en']){
  for(const html of [pages[lang].home,pages[lang].refill,...Object.values(pages[lang].products)]){
   for(const stage of motionStages(html)){
    total++;
    assert.match(stage,/data-loading-state="neutral"/);
    assert.match(stage,/data-preview-profile="(?:hero-intro|home-cycle|refill-teaser|ritual)"/);
    assert.match(stage,/class="scene-loading" role="status" aria-live="polite"/);
    assert.match(stage,/scene-loading__fallback/);
    assert.doesNotMatch(stage,/<img\b|\.webp|\.jpg/);
   }
  }
 }
 assert.ok(total>=20,'both designs and all localized product explanations are covered');
});

test('neutral previews update their scent without inspecting or replacing image URLs',()=>{
 const touched=[];
 const element={dataset:{loadingState:'neutral',shopScene:'journey',scent:'aloe',previewProfile:'home-cycle'},
  classList:{contains:value=>value==='scene-preview'},closest:()=>null,
  ownerDocument:{},getBoundingClientRect:()=>({width:0,height:0}),
  querySelector:selector=>{touched.push(selector);throw new Error('A neutral preview must not inspect images');}};
 const manager=createScenePreviews({elements:[element],base:'/demo',version:'test',window:{addEventListener(){},removeEventListener(){}}});
 assert.equal(manager.update(element,'journey','argan'),true);
 assert.equal(element.dataset.previewScent,'argan');
 assert.equal(element.dataset.previewMode,'journey');
 assert.deepEqual(touched,[]);
 manager.destroy();
});

test('motion states have stationary accessible loading and first-render reveal gates',()=>{
 for(const file of ['assets/classic.css','assets/polish.css']){
  const css=fs.readFileSync(file,'utf8');
  assert.match(css,/\[data-loading-state='neutral'\]\[data-scene-rendered='true'\] > \.scene-loading/);
  assert.match(css,/prefers-reduced-motion: reduce[\s\S]*\.scene-loading \{ transition: none; \}/);
  assert.match(css,/data-scene-status='static'[\s\S]*data-scene-status='error'/);
 }
 for(const pages of [classic,modern])for(const lang of ['de','en']){
  assert.match(pages[lang].products.aloe,/data-product-photo src="\/demo\/assets\/cycles-product-aloe-/);
  assert.ok((pages[lang].home.match(/data-journey-caption=/g)||[]).length>=4);
 }
});
