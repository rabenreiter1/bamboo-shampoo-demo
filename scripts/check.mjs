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
assert.equal(pages,15);
assert.ok(!fs.existsSync(path.join(root,'CNAME')));
console.log(`Verified ${pages} pages: local links, assets, language, preview indexing, domain isolation and brand restriction.`);
