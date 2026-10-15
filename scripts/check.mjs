import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('docs');
const files=[];
function walk(dir){for(const file of fs.readdirSync(dir,{withFileTypes:true})){const name=path.join(dir,file.name);file.isDirectory()?walk(name):files.push(name);}}
walk(root);
let pages=0;
const allowed=/[\\/]impressum[\\/]index\.html$/;
for(const file of files){
  assert.ok(!/jubam/i.test(path.relative(root,file)),'Forbidden brand in a served filename');
  if (!/\.(html|css|js|json|svg|xml|txt)$/.test(file))continue;
  const text=fs.readFileSync(file,'utf8');
  if(!allowed.test(file))assert.ok(!/jubam/i.test(text),`Forbidden brand outside legal notice: ${file}`);
  assert.ok(!/bamboo-shampoo\.(com|de)/.test(text),'Custom domains must not be connected or used as canonicals yet');
  if(!file.endsWith('.html'))continue;
  pages++;
  assert.match(text,/<meta name="robots" content="noindex/,'Preview must not be indexed');
  assert.match(text,/<html lang="(de|en)"/,'Document must have a language');
  for(const match of text.matchAll(/(?:href|src)="(\/bamboo-shampoo-demo\/[^"#?]*)(?:[?#][^"]*)?"/g)){
    const relative=decodeURIComponent(match[1].replace('/bamboo-shampoo-demo/',''));
    let target=path.join(root,relative);
    if(match[1].endsWith('/'))target=path.join(target,'index.html');
    assert.ok(fs.existsSync(target),`Broken local link ${match[1]} in ${path.relative(root,file)}`);
  }
}
const localizedRoutes=['','shop/','refill/','story/','faq/','checkout/','products/aloe/','products/argan/','products/bamboo/','impressum/','privacy/'];
for(const variant of ['','classic/'])for(const lang of ['de','en'])for(const route of localizedRoutes){
  const text=fs.readFileSync(path.join(root,variant,lang,route,'index.html'),'utf8');
  assert.match(text,new RegExp(`data-design="${variant?'classic':'current'}"`),'Correct presentation declared before first paint');
  assert.ok(text.includes(`<link rel="canonical" href="https://rabenreiter1.github.io/bamboo-shampoo-demo/${lang}/${route}">`),'Comparison canonicals point to the public current design');
  const ui=JSON.parse(text.match(/<script type="application\/json" id="ui-copy">([^]*?)<\/script>/)[1]);
  assert.equal(ui.base,'/bamboo-shampoo-demo','Assets stay shared between variants');
  assert.equal(ui.routeBase,`/bamboo-shampoo-demo${variant?'/classic':''}`,'Navigation stays inside its presentation');
  assert.ok(text.includes('data-design-trigger')&&text.includes('data-design-options hidden'),'Every shop page exposes the same hidden inline comparison');
  assert.ok(!text.includes('/classic/assets/')&&!text.includes('/classic/assembly/'),'No duplicated product or animation asset roots');
  if(variant){
    for(const href of text.matchAll(/<a\b[^>]*href="(\/bamboo-shampoo-demo\/(?:de|en)\/[^"#?]*)/g)){
      const suffix=text.slice(href.index,href.index+href[0].length+50);
      assert.ok(suffix.includes('data-design-target="current"'),'Classic ordinary navigation cannot escape its variant');
    }
  }
}
// 44 localized documents, 12 compatible product redirects, 2 entries/404 and the assembly page.
assert.equal(pages,localizedRoutes.length*2*2+3*2*2+3);
assert.ok(!fs.existsSync(path.join(root,'CNAME')));
console.log(`Verified ${pages} pages: local links, assets, language, preview indexing, domain isolation and brand restriction.`);
