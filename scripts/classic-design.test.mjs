import test from 'node:test';
import assert from 'node:assert/strict';
import {designDestination,initializeDesignSwitch} from '../assets/design-switch.js';
import {createShopPages} from './shop-pages.mjs';
import {createClassicPages} from './classic-pages.mjs';
import {campaignWorld} from '../assets/campaign-backdrop.js';
import {PRODUCT_THEMES} from '../assets/product-theme.js';
import {normalizeBookmark} from '../assets/journey.js';
import {classicGuideRegion,playbackPreviewBox} from '../assets/scene-framing.js';
const base='/bamboo-shampoo-demo',origin='https://rabenreiter1.github.io';

test('design comparison preserves the exact localized route and selection, but starts at the top',()=>{
  const source=`${origin}${base}/en/products/argan/?format=refill&resume=1#ritual`;
  assert.equal(designDestination(source,base,'classic'),`${origin}${base}/classic/en/products/argan/?format=refill`);
  assert.equal(designDestination(`${origin}${base}/classic/de/checkout/?step=review#confirmation`,base),`${origin}${base}/de/checkout/?step=review`);
  assert.equal(designDestination(`${origin}/outside/de/`,base),null);
});

test('the footer opens only after a close double activation, supports keyboard and survives page restoration',()=>{
  const events=new Map(),panelEvents=new Map(),windowEvents=new Map(),attributes={};let time=0,focused=false;
  const links=['current','classic'].map(design=>({dataset:{designTarget:design},focus:()=>{focused=true;}}));
  const trigger={setAttribute:(key,value)=>attributes[key]=value,addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key),focus:()=>{focused=true;}};
  const panel={hidden:true,querySelector:()=>links[0],querySelectorAll:()=>links,addEventListener:(key,fn)=>panelEvents.set(key,fn),removeEventListener:key=>panelEvents.delete(key)};
  const doc={querySelector:key=>key==='[data-design-trigger]'?trigger:panel};
  const win={location:{href:`${origin}${base}/de/products/aloe/?format=refill`},addEventListener:(key,fn)=>windowEvents.set(key,fn),removeEventListener:key=>windowEvents.delete(key)};
  const control=initializeDesignSwitch({base,document:doc,window:win,now:()=>time});
  win.location.href=`${origin}${base}/de/products/argan/?format=refill`;
  events.get('click')();assert.equal(panel.hidden,true);time=600;events.get('click')();assert.equal(panel.hidden,true);
  time=1049;events.get('click')();assert.equal(panel.hidden,false);assert.equal(attributes['aria-expanded'],'true');
  panelEvents.get('keydown')({key:'Escape'});assert.equal(panel.hidden,true);assert.equal(focused,true);
  events.get('keydown')({key:'Enter',currentTarget:trigger,preventDefault(){}});assert.equal(panel.hidden,false);
  let prevented=false;
  panelEvents.get('keydown')({key:'Enter',currentTarget:panel,target:links[1],preventDefault(){prevented=true;}});
  assert.equal(prevented,false,'Enter on the design link must retain native navigation');
  assert.match(links[1].href,/classic\/de\/products\/argan\/\?format=refill$/);
  control.destroy();assert.equal(events.size,0);assert.equal(panelEvents.size,0);assert.equal(windowEvents.size,0);
});

test('classic presentation restores the old large-word opening and the current scroll-controlled assembly',()=>{
  const args={BASE:base,fragrances:['aloe','argan','bamboo'],formatPrice:String,icon:()=>'<svg></svg>',esc:String};
  const current=createShopPages(args),classic=createClassicPages({...args,pages:current});
  for(const lang of ['de','en']){
    assert.match(classic[lang].home,/class="campaign-word">BAMBOO/);
    assert.match(classic[lang].home,/data-product-journey/);
    assert.doesNotMatch(classic[lang].home,/data-playback-profile|intro-hero|data-detour/);
    assert.match(current[lang].home,/data-playback-profile="hero-intro"/);
    assert.match(classic[lang].refill,/class="campaign-word">REFILL/);
    assert.match(classic[lang].refill,/data-ritual-scroll/);
    assert.doesNotMatch(classic[lang].refill,/data-playback-profile|data-playback-controls/);
    for(const key of ['home','refill'])assert.equal((classic[lang][key].match(/<div(?: |>)/g)||[]).length,(classic[lang][key].match(/<\/div>/g)||[]).length,`${lang}/${key} divs balanced`);
    assert.equal(classic[lang].products,current[lang].products);
    assert.equal(classic[lang].checkout,current[lang].checkout);
  }
});

test('a classic world changes the presentation without recoloring any silicone material',()=>{
  const before=JSON.stringify(PRODUCT_THEMES);
  assert.equal(campaignWorld('bamboo','classic').base,'#cdc0e8');
  assert.equal(campaignWorld('bamboo').base,'#E2EBF1');
  assert.equal(PRODUCT_THEMES.bamboo.cap,'#B6CBDE');
  assert.equal(JSON.stringify(PRODUCT_THEMES),before);
});

test('variant bookmarks preserve semantic progress and reject incompatible saved pixels',()=>{
  const old={chapter:'ritual',progress:.42,scroll:5000,viewportWidth:390,viewportHeight:800,layout:'sage-autoplay-guide-v2'};
  const classic=normalizeBookmark(old,'classic-scroll-guide-v1');
  assert.equal(classic.progress,.42);assert.equal(classic.layout,'classic-scroll-guide-v1');assert.equal(classic.viewportWidth,undefined);
  assert.equal(normalizeBookmark({...classic,viewportWidth:390},'classic-scroll-guide-v1').viewportWidth,390);
});

test('classic loading still uses the same reserved caption region as the scroll-driven camera',()=>{
  const region=classicGuideRegion({width:390,height:700,copyHeight:166,viewportHeight:800});
  assert.deepEqual(region,{minX:.035,maxX:.965,minY:.075,maxY:(700-166-32)/700,layout:'studio'});
  assert.deepEqual(classicGuideRegion({width:844,height:332,viewportHeight:390}),{minX:.36,maxX:.97,minY:.1,maxY:.93,layout:'beside'});
  const unreserved=playbackPreviewBox({width:390,height:700}),reserved=playbackPreviewBox({width:390,height:700,region});
  assert.ok(reserved.top<unreserved.top,'Product stays above the stable caption area');
  assert.ok(reserved.height<unreserved.height,'Loading poster respects the same smaller camera region');
});
