import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {PRESENTATIONS,presentationRouteBase,localizedPresentationSuffix} from '../assets/presentations.js';
import {designDestination} from '../assets/design-switch.js';
import {verifyPublishedShop} from './check.mjs';

const base='/bamboo-shampoo-demo',origin='https://rabenreiter1.github.io';
const routes=['','shop/','refill/','story/','faq/','checkout/','products/aloe/','products/argan/','products/bamboo/','impressum/','privacy/'];
const read=relative=>fs.readFileSync(path.join('docs',relative),'utf8');

test('presentation descriptors separate public names, historical render IDs and existing bookmarks',()=>{
  assert.ok(Object.isFrozen(PRESENTATIONS));
  assert.ok(Object.isFrozen(PRESENTATIONS.modern)&&Object.isFrozen(PRESENTATIONS.classic));
  assert.equal(PRESENTATIONS.modern.name,'Modern');assert.equal(PRESENTATIONS.modern.style,'classic');
  assert.equal(PRESENTATIONS.classic.name,'Classic');assert.equal(PRESENTATIONS.classic.style,'current');
  assert.equal(presentationRouteBase(base,'modern'),base);
  assert.equal(presentationRouteBase(base+'/','classic'),base+'/design/classic');
  assert.equal(PRESENTATIONS.modern.bookmarkKey,'bamboo-journey-return-v1:classic');
  assert.equal(PRESENTATIONS.classic.bookmarkKey,'bamboo-journey-return-v1');
  assert.notEqual(PRESENTATIONS.modern.bookmarkLayout,PRESENTATIONS.classic.bookmarkLayout);
});

test('localized suffix resolves both current presentations and the historical purple namespace',()=>{
  for(const prefix of ['','/classic','/design/classic'])assert.equal(localizedPresentationSuffix(`${origin}${base}${prefix}/en/products/argan/?format=refill#ritual`,base),'/en/products/argan/');
  assert.equal(localizedPresentationSuffix(origin+'/outside/de/',base),null);
  assert.equal(localizedPresentationSuffix(`${origin}${base}/assembly/`,base),null);
  assert.equal(localizedPresentationSuffix(`${origin}${base}/designer/en/`,base),null);
});

test('semantic design switching preserves localized product choice and clears obsolete scroll restoration',()=>{
  const source=`${origin}${base}/classic/en/products/argan/?format=refill&resume=1#ritual`;
  assert.equal(designDestination(source,base),`${origin}${base}/en/products/argan/?format=refill`);
  assert.equal(designDestination(source,base,'classic'),`${origin}${base}/design/classic/en/products/argan/?format=refill`);
  assert.equal(designDestination(source,base,'current'),`${origin}${base}/design/classic/en/products/argan/?format=refill`);
  assert.equal(designDestination(`${origin}${base}/design/classic/de/checkout/?step=review`,base,'modern'),`${origin}${base}/de/checkout/?step=review`);
});

test('published presentation inventory has every canonical route and preserves all historical links',()=>{
  const result=verifyPublishedShop();
  assert.equal(result.localized,44);
  assert.deepEqual(result.routes,[...routes].sort());
  const expected=new Set(['index.html','404.html','assembly/index.html']);
  for(const presentation of ['modern','classic'])for(const lang of ['de','en']){
    const prefix=PRESENTATIONS[presentation].prefix.replace(/^\//,'');
    for(const route of routes)expected.add(`${prefix?prefix+'/':''}${lang}/${route}index.html`);
    for(const scent of ['aloe','argan','bamboo'])expected.add(`${prefix?prefix+'/':''}${lang}/shop/${scent}/index.html`);
  }
  for(const lang of ['de','en']){
    for(const route of routes)expected.add(`classic/${lang}/${route}index.html`);
    for(const scent of ['aloe','argan','bamboo'])expected.add(`classic/${lang}/shop/${scent}/index.html`);
  }
  const actual=[];
  const walk=dir=>{for(const file of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,file.name);if(file.isDirectory())walk(full);else if(file.name.endsWith('.html'))actual.push(path.relative('docs',full).replaceAll('\\','/'));}};
  walk('docs');
  assert.deepEqual(actual.sort(),[...expected].sort());
  assert.equal(result.pages,expected.size);
});

test('published compatibility redirects preserve query and fragment and target the correct presentation',()=>{
  const redirects=[];
  for(const lang of ['de','en']){
    for(const route of routes)redirects.push([`classic/${lang}/${route}index.html`,`${base}/${lang}/${route}`]);
    for(const scent of ['aloe','argan','bamboo']){
      redirects.push([`classic/${lang}/shop/${scent}/index.html`,`${base}/${lang}/products/${scent}/`]);
      for(const presentation of ['modern','classic']){
        const prefix=PRESENTATIONS[presentation].prefix.replace(/^\//,'');
        redirects.push([`${prefix?prefix+'/':''}${lang}/shop/${scent}/index.html`,`${presentationRouteBase(base,presentation)}/${lang}/products/${scent}/`]);
      }
    }
  }
  for(const [relative,destination] of redirects){
    const html=read(relative);
    assert.ok(html.includes(`rel="canonical" href="${origin}${destination}"`),relative+' canonical');
    assert.ok(html.includes(`href="${destination}"`),relative+' no-script navigation');
    const script=html.match(/<script>([^]*?)<\/script>/)?.[1];assert.ok(script,relative+' redirect script');
    let received;
    vm.runInNewContext(script,{location:{search:'?format=refill',hash:'#ritual-dose',replace:value=>{received=value;}}});
    assert.equal(received,destination+'?format=refill#ritual-dose',relative+' query/hash preservation');
  }
});
