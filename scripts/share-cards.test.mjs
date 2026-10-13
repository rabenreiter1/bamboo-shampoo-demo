import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('docs'), origin='https://rabenreiter1.github.io/bamboo-shampoo-demo';
const routes=['','shop/','refill/','story/','faq/','checkout/','products/aloe/','products/argan/','products/bamboo/','impressum/','privacy/'];
const read=(lang,route)=>fs.readFileSync(path.join(root,lang,route,'index.html'),'utf8');
const metadata=html=>Object.fromEntries([...html.matchAll(/<meta\b[^>]*>/g)].map(([tag])=>{
  const attrs=Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,name,value])=>[name,value]));
  return [attrs.property||attrs.name,attrs.content];
}));

test('shared links use public landscape images with complete crawler metadata before JavaScript',()=>{
  const images=new Set();
  for(const lang of ['de','en'])for(const route of routes){
    const html=read(lang,route),head=html.match(/<head>([\s\S]*?)<\/head>/)[1],m=metadata(head);
    assert.ok(m['og:image'].startsWith(origin+'/assets/share-'));
    assert.equal(m['og:image:secure_url'],m['og:image']);
    assert.equal(m['twitter:image'],m['og:image']);
    assert.equal(m['og:image:width'],'1200'); assert.equal(m['og:image:height'],'630');
    assert.equal(m['og:image:type'],'image/jpeg');
    assert.ok(m['og:image:alt'].length>30); assert.equal(m['twitter:image:alt'],m['og:image:alt']);
    assert.equal(m['twitter:title'],m['og:title']); assert.equal(m['twitter:description'],m['og:description']);
    assert.ok(m['og:title'].length<=65); assert.ok(m['og:description'].length<=180);
    assert.doesNotMatch(m['og:image'],/shop-product\.jpg|\?/);
    images.add(m['og:image']);
  }
  assert.equal(images.size,10,'each language has a home, refill and three fragrance images');
  const entry=metadata(fs.readFileSync(path.join(root,'index.html'),'utf8'));
  assert.equal(entry['og:image'],metadata(read('de',''))['og:image'],'the bare entry URL can be shared too');
  assert.equal(entry['og:url'],origin+'/de/');
});

test('fragrance and refill links show their own artwork and localized concise copy',()=>{
  for(const lang of ['de','en']){
    const home=metadata(read(lang,'')),refill=metadata(read(lang,'refill/'));
    assert.match(home['og:image'],new RegExp(`/share-home-${lang}-`));
    assert.match(refill['og:image'],new RegExp(`/share-refill-${lang}-`));
    assert.match(refill['og:title'],/Refill/);
    assert.match(refill['og:description'],lang==='de'?/Bambushülle/:/bamboo shell/);
    assert.ok(home['og:description'].length<=130); assert.ok(refill['og:description'].length<=130);
    for(const scent of ['aloe','argan','bamboo']){
      const product=metadata(read(lang,`products/${scent}/`));
      assert.match(product['og:image'],new RegExp(`/share-${scent}-${lang}-`));
      assert.ok(product['og:title'].toLowerCase().includes(scent));
      assert.match(product['og:description'],/250 ml/);
    }
    for(const route of ['shop/','story/','faq/','checkout/','impressum/','privacy/']){
      const html=read(lang,route),m=metadata(html);
      assert.equal(m['og:title'],html.match(/<title>([^<]+)<\/title>/)[1],'information and catalogue shares retain their page-specific title');
    }
  }
});

// Check the actual JPEG SOF header, independently of the declared OG dimensions.
function jpegSize(bytes){
  assert.equal(bytes.readUInt16BE(0),0xffd8);
  for(let offset=2;offset+9<bytes.length;){
    assert.equal(bytes[offset],0xff); const marker=bytes[offset+1];
    const length=bytes.readUInt16BE(offset+2);
    if([0xc0,0xc1,0xc2].includes(marker))return {height:bytes.readUInt16BE(offset+5),width:bytes.readUInt16BE(offset+7)};
    offset+=2+length;
  }
  throw new Error('JPEG frame header is missing');
}

test('every referenced share image is a compact, real 1200 by 630 JPEG in source and publish output',()=>{
  const files=new Set(['de','en'].flatMap(lang=>routes.map(route=>new URL(metadata(read(lang,route))['og:image']).pathname.split('/').at(-1))));
  for(const file of files){
    const published=fs.readFileSync(path.join(root,'assets',file));
    assert.deepEqual(jpegSize(published),{width:1200,height:630},file);
    assert.ok(published.length<150000,`${file} stays light enough for messaging previews`);
    assert.ok(published.equals(fs.readFileSync(path.join('assets',file))),'only the approved finished image is published');
  }
});
