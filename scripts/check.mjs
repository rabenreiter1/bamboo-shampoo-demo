import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {PRESENTATIONS,presentationRouteBase} from '../assets/presentations.js';
import {verifyRuntimeRelease} from './runtime-release.mjs';

const BASE='/bamboo-shampoo-demo',ORIGIN='https://rabenreiter1.github.io';
const imprintHash='98bb34fbe5b95cd714f2e20d0a2a641ceca1b400a6ce017dfdc15c387c184782';

/** Discover the built inventory instead of pinning a previous release's page count. */
export function verifyPublishedShop(directory='docs') {
  const root=path.resolve(directory),files=[];
  function walk(dir){for(const file of fs.readdirSync(dir,{withFileTypes:true})){const name=path.join(dir,file.name);file.isDirectory()?walk(name):files.push(name);}}
  walk(root);
  const pages=[],localized=[],redirects=[],runtimeReleases=new Map();
  for(const file of files){
    const relative=path.relative(root,file).replaceAll('\\','/');
    assert.ok(!/jubam/i.test(relative),`Forbidden brand in a served filename: ${relative}`);
    if(!/\.(html|css|js|json|svg|xml|txt)$/.test(file))continue;
    const text=fs.readFileSync(file,'utf8');
    if(!/(^|\/)impressum\/index\.html$/.test(relative))assert.ok(!/jubam/i.test(text),`Forbidden brand outside legal notice: ${relative}`);
    assert.ok(!/bamboo-shampoo\.(com|de)/.test(text),`Custom domain reference in ${relative}`);
    if(!relative.endsWith('.html'))continue;
    pages.push(relative);
    assert.match(text,/<meta name="robots" content="noindex/,`Preview must not be indexed: ${relative}`);
    assert.match(text,/<html lang="(?:de|en)"/,`Document must declare its language: ${relative}`);
    for(const match of text.matchAll(/(?:href|src|action)="(\/bamboo-shampoo-demo\/[^"#?]*)(?:[?#][^"]*)?"/g)){
      const link=decodeURIComponent(match[1].slice(BASE.length+1));
      const target=path.resolve(root,link,match[1].endsWith('/')?'index.html':'');
      assert.ok(target.startsWith(root+path.sep),`Local URL escapes publication root: ${match[1]}`);
      assert.ok(fs.existsSync(target),`Broken local link ${match[1]} in ${relative}`);
    }
    const raw=text.match(/<script type="application\/json" id="ui-copy">([^]*?)<\/script>/)?.[1];
    if(!raw){if(/http-equiv="refresh"/i.test(text))redirects.push({relative,text});continue;}
    const ui=JSON.parse(raw),presentation=PRESENTATIONS[ui.presentation];
    assert.ok(presentation,`Unknown presentation in ${relative}`);
    const routeBase=presentationRouteBase(BASE,ui.presentation);
    assert.equal(ui.base,BASE,`Shared asset base in ${relative}`);
    assert.equal(ui.routeBase,routeBase,`Presentation route base in ${relative}`);
    assert.equal(ui.design,presentation.style,`Legacy render style in ${relative}`);
    assert.equal(ui.bookmarkKey,presentation.bookmarkKey,`Separate semantic journey storage in ${relative}`);
    assert.equal(ui.bookmarkLayout,presentation.bookmarkLayout,`Compatible saved journey layout in ${relative}`);
    assert.match(ui.runtimeBase,new RegExp(`^${BASE}/assets/releases/[a-f0-9]{16}$`),`Immutable runtime URL in ${relative}`);
    assert.equal(ui.previewBase,ui.runtimeBase,`Motion posters share their runtime release in ${relative}`);
    if(!runtimeReleases.has(ui.runtimeBase))runtimeReleases.set(ui.runtimeBase,verifyRuntimeRelease(path.join(root,ui.runtimeBase.slice(BASE.length+1))));
    const imports=JSON.parse(text.match(/<script type="importmap">([^]*?)<\/script>/)?.[1]||'{}').imports;
    assert.equal(imports?.three,`${ui.runtimeBase}/assembly/vendor/three.module.js`,`Three and addons share one immutable dependency in ${relative}`);
    assert.ok(text.includes(`src="${ui.runtimeBase}/app.js`),`Entrypoint uses the same immutable release in ${relative}`);
    assert.ok(text.includes(`data-presentation="${ui.presentation}"`),`Presentation known before first paint: ${relative}`);
    assert.ok(text.includes(`data-design="${presentation.style}"`),`Render style known before first paint: ${relative}`);
    const lang=text.match(/<html lang="(de|en)"/)[1];
    const pagePath=relative.replace(/index\.html$/,'');
    const prefix=routeBase.slice(BASE.length).replace(/^\//,'');
    const expectedPrefix=`${prefix?prefix+'/':''}${lang}/`;
    assert.ok(pagePath.startsWith(expectedPrefix),`Page route belongs to its presentation: ${relative}`);
    const route=pagePath.slice(expectedPrefix.length);
    const canonical=text.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    assert.equal(canonical,`${ORIGIN}${routeBase}/${lang}/${route}`,`Canonical remains in its presentation: ${relative}`);
    assert.ok(text.includes('data-design-trigger')&&text.includes('data-design-options hidden'),`Hidden inline comparison in ${relative}`);
    assert.ok(!text.includes('/classic/assets/')&&!text.includes('/classic/assembly/'),`Assets cannot inherit a presentation prefix: ${relative}`);
    for(const anchor of text.matchAll(/<a\b[^>]*>/g)){
      const href=anchor[0].match(/href="([^"]+)"/)?.[1];
      if(!href?.startsWith(BASE+'/')||anchor[0].includes('data-design-target')||href.startsWith(BASE+'/assembly/'))continue;
      const pathname=new URL(href,ORIGIN).pathname;
      if(/\/(de|en)\//.test(pathname))assert.ok(pathname.startsWith(routeBase+'/')&&(ui.presentation!=='modern'||!pathname.startsWith(BASE+'/design/')),`Navigation leaves its presentation: ${relative}: ${href}`);
    }
    if(route==='impressum/'){
      const fragment=text.match(/<div class="legal-copy" lang="de">([^]*?)<\/div>/)?.[1];
      assert.ok(fragment,`Operator fragment in ${relative}`);
      assert.equal(crypto.createHash('sha256').update(fragment).digest('hex'),imprintHash,`Original operator fragment preserved: ${relative}`);
    }
    localized.push({relative,presentation:ui.presentation,lang,route});
  }
  const routes=localized.filter(page=>page.presentation==='modern'&&page.lang==='de').map(page=>page.route).sort();
  assert.ok(routes.length>0,'Modern DE inventory must exist');
  for(const presentation of Object.keys(PRESENTATIONS))for(const lang of ['de','en'])assert.deepEqual(localized.filter(page=>page.presentation===presentation&&page.lang===lang).map(page=>page.route).sort(),routes,`Complete matching ${presentation}/${lang} inventory`);
  assert.ok(!fs.existsSync(path.join(root,'CNAME')),'Custom domain must remain disconnected');
  return {pages:pages.length,localized:localized.length,redirects:redirects.length,routes};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyPublishedShop();
  console.log(`Verified ${result.pages} pages (${result.localized} localized, ${result.redirects} redirects): presentation inventory, local links, assets, language, noindex, canonicals, domain isolation and legal integrity.`);
}
