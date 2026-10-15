import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fragrances, prices, formatPrice, cartTotal } from '../assets/catalog.js';
import { BRAND_THEME, PRODUCT_THEMES } from '../assets/product-theme.js';

const root = path.resolve('docs');
const origin = 'https://rabenreiter1.github.io';
const base = '/bamboo-shampoo-demo';
const locales = ['de', 'en'];
const productRoutes = fragrances.map(scent => `products/${scent}/`);
const primaryRoutes = ['', 'shop/', 'refill/', 'story/', 'faq/', 'checkout/', ...productRoutes, 'impressum/', 'privacy/'];
const canonical = (lang, route) => `${origin}${base}/${lang}/${route}`;
const readPage = (lang, route = '') => fs.readFileSync(path.join(root, lang, route, 'index.html'), 'utf8');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(match => match[0]);
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
const hasAttribute = (tag, name) => new RegExp(`\\s${name}(?:\\s|=|>)`).test(tag);
const links = html => tags(html, 'link').map(attrs);
const scriptData = (html, id) => JSON.parse(html.match(new RegExp(`<script[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)<\\/script>`))[1]);
const unescape = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>');

test('the editorial hero illustrates refilling before scent selection and the complete automatic use cycle', () => {
  for (const lang of locales) {
    const main = readPage(lang).match(/<main\b[^>]*\bid="main"[^>]*>([\s\S]*?)<\/main>/)[1];
    assert.equal(tags(main, 'div').filter(tag => attrs(tag)['data-shop-scene']).length, 2);
    assert.match(main, /campaign-hero--home/);
    assert.match(main, /<h1 class="intro-title">/);
    assert.doesNotMatch(main, /<h1 class="campaign-word">BAMBOO/);
    assert.match(main, /data-playback-profile="hero-intro"/);
    assert.ok(main.indexOf('campaign-hero--home') < main.indexOf('id="collection"'));
    assert.ok(main.indexOf('id="collection"') < main.indexOf('data-playback-profile="home-cycle"'));
    assert.doesNotMatch(main, /data-product-journey|data-ritual-scroll/, 'home explanation is no longer a pinned native-scroll track');
    const scenes = tags(main, 'div').map(attrs).filter(tag => tag['data-shop-scene']);
    assert.deepEqual(scenes.map(tag => tag['data-shop-scene']), ['journey', 'journey']);
    assert.equal(scenes[0]['data-art-direction'], 'intro');
    assert.equal(scenes[0]['data-scent'], 'aloe', 'a new visit begins with the sage Aloe world');
    assert.ok(tags(main, 'div').some(tag => attrs(tag)['data-shop-scene'] === 'journey'));
    const phases = tags(main, 'article').map(attrs).filter(tag => tag['data-journey-caption']);
    assert.deepEqual(phases.map(tag => tag['data-journey-caption']), ['closed','uncap','unseal','recap','dose','remove','refill','ready']);
    const guide = main.slice(main.indexOf('<section id="ritual"'), main.indexOf('<section class="section-shell faq-tease'));
    const profile = tags(guide, 'section').map(attrs).find(tag => tag.id === 'ritual');
    assert.equal(profile?.['data-playback-profile'], 'home-cycle');
    assert.match(profile?.class || '', /\bproduct-playback\b/);
    assert.doesNotMatch(profile?.class || '', /product-journey|ritual-scroll/);
    assert.equal(tags(guide, 'button').filter(tag => hasAttribute(tag, 'data-playback-toggle')).length, 1);
    const seek = tags(guide, 'input').find(tag => hasAttribute(tag, 'data-playback-seek'));
    assert.ok(seek, 'the animation has a direct native progress control');
    assert.deepEqual(Object.fromEntries(['type','min','max','step'].map(key => [key,attrs(seek)[key]])), {type:'range',min:'0',max:'1000',step:'1'});
    assert.ok(attrs(seek)['aria-label']?.trim(), 'the progress control has a localized accessible name');
    assert.deepEqual(tags(guide, 'button').map(attrs).filter(tag => tag['data-playback-at']).map(tag => Number(tag['data-playback-at'])), [.10,.20,.54,.875]);
    assert.match(guide, /shop-guide-product-aloe\.webp/, 'the guide starts with its matching closed-product poster');
    assert.doesNotMatch(guide, /<details|data-world-scent|data-world-link|data-journey-leader|<em>/, 'the explanation has no accordions, buying controls or mixed headline styles');
    assert.doesNotMatch(main, /data-detour(?:=|-)/, 'main journey explanations and purchases do not open the old detail panels');
    for (const scent of fragrances) assert.ok(tags(main, 'a').some(tag => attrs(tag).href === `${base}/${lang}/products/${scent}/` && /\sdata-native-route(?:\s|>)/.test(tag)), 'scent cards lead to actual product pages');
    const ui = scriptData(readPage(lang), 'ui-copy');
    assert.equal(ui.shampoo, lang === 'de' ? 'Starter-Set' : 'Starter Set'); assert.equal(ui.refill, 'Refill');
    assert.match(ui.formatAdd.shampoo, lang === 'de' ? /Starter-Set/ : /starter set/i);
  }
});

test('one form-owned priced selector below each model chooses starter set or refill without changing format keys', () => {
  for (const lang of locales) for (const scent of fragrances) {
    const main = readPage(lang, `products/${scent}/`).match(/<main\b[^>]*\bid="main"[^>]*>([\s\S]*?)<\/main>/)[1];
    assert.doesNotMatch(main,/data-gallery-view/, 'there is no second image-only selector');
    const choices=tags(main,'input').map(attrs).filter(tag=>tag.name==='format');
    assert.deepEqual(choices.map(tag=>tag.value),['shampoo','refill']);
    assert.ok(choices.every(tag=>tag.form===`product-form-${scent}`),'both choices belong to the actual purchasing form');
    assert.equal(tags(main,'form').filter(tag=>attrs(tag).id===`product-form-${scent}`).length,1);
    assert.ok(main.indexOf('product-format')>main.indexOf('data-product-photo-viewer'));
    const selector=main.match(/<fieldset class="product-format">([\s\S]*?)<\/fieldset>/)[1];
    assert.match(selector,/12,50|12\.50/); assert.match(selector,/4,50|4\.50/);
    assert.match(selector,lang==='de'?/Starter-Set/:/Starter Set/);
    assert.match(selector,/Refill/);
    assert.match(main,new RegExp(`cycles-product-${scent}-20261015-perspective2\\.webp`));
  }
});

test('the refill teaser illustrates reuse while every purchase points to a filled insert', () => {
  for (const lang of locales) {
    const main=readPage(lang,'refill/').match(/<main\b[^>]*\bid="main"[^>]*>([\s\S]*?)<\/main>/)[1];
    const teaser=main.slice(main.indexOf('<section class="campaign-hero'),main.indexOf('<section class="section-shell refill-selection'));
    assert.equal(tags(teaser,'section').map(attrs).filter(tag=>tag['data-playback-profile']==='refill-teaser').length,1);
    assert.ok(tags(teaser,'div').some(tag=>attrs(tag)['data-shop-scene']==='ritual'),'the teaser illustrates a refill in the existing assembly');
    assert.match(teaser,/shop-teaser-product-aloe\.webp/);
    assert.match(teaser,/<h1 class="campaign-word">REFILL/);
    assert.equal(tags(teaser,'button').filter(tag=>hasAttribute(tag,'data-playback-toggle')).length,1);
    assert.deepEqual(tags(teaser,'button').map(attrs).filter(tag=>tag['data-playback-at']).map(tag=>Number(tag['data-playback-at'])),[.765,.83,.90,.96]);
    assert.match(teaser,lang==='de'?/>Kappe auf<\/button>/:/>Cap on<\/button>/);
    assert.doesNotMatch(teaser,/>Entsiegeln<\/button>|>Peel<\/button>/,'the short swap preserves the new seal, so it must describe recapping rather than invent a second peel');
    const purchase=teaser.match(/<div class="campaign-purchase">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(purchase);
    assert.match(purchase,lang==='de'?/gefüllter Einsatz/:/filled insert/);
    assert.ok(unescape(purchase).includes(formatPrice(450,lang)));
    assert.doesNotMatch(purchase,/12,50|12\.50|Starter-Set|Starter Set/,'the animation does not imply the shell or cap is sold with the refill');
    assert.ok(main.indexOf('id="refill-scents"')<main.indexOf('data-ritual-scroll'),'the complete native-scroll explanation remains after the selection');
    for(const tag of tags(main,'button').filter(tag=>hasAttribute(tag,'data-add'))){
      assert.equal(attrs(tag)['data-format'],'refill');
      assert.equal(attrs(tag)['data-quick-format'],'refill');
    }
    for(const scent of fragrances)assert.ok(tags(main,'a').map(attrs).some(link=>link.href===`${base}/${lang}/products/${scent}/?format=refill`));
  }
});

test('informational routes contain no inspection or explanation popup, and shell artwork shows only the tube',()=>{
  for(const lang of locales)for(const route of primaryRoutes){
    const html=readPage(lang,route);
    assert.doesNotMatch(html,/journey-dialog|data-detour(?:=|-)|data-inspection|notice-dialog/);
  }
  for(const lang of locales){
    const story=readPage(lang,'story/');
    const firstComponent=story.match(/<article class="component-row"[^>]*>([\s\S]*?)<\/article>/)[1];
    assert.match(firstComponent,/cycles-shell-20261015-perspective2\.webp/); assert.doesNotMatch(firstComponent,/\bsrc="[^"]*\/photo-product/);
    assert.match(firstComponent,/data-photo-default-mode="shell"/, 'the image depicts the actual empty tube');
    assert.doesNotMatch(firstComponent,/data-shop-scene|data-product-media/, 'the still has no hidden inspector or view switch');
  }
});

test('every shop route is directly readable with one semantic heading and localized document metadata', () => {
  for (const lang of locales) {
    const titles = new Set();
    for (const route of primaryRoutes) {
      const html = readPage(lang, route);
      assert.match(html, new RegExp(`<html\\b[^>]*lang="${lang}"`), `${lang}/${route} language`);
      assert.equal(tags(html, 'main').filter(tag => attrs(tag).id === 'main').length, 1, `${lang}/${route} main landmark`);
      assert.equal(tags(html, 'h1').length, 1, `${lang}/${route} unique primary heading`);
      const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
      assert.ok(title?.trim(), `${lang}/${route} title`);
      assert.ok(!titles.has(title), `${lang}/${route} has a route-specific title`);
      titles.add(title);
      const metadata = tags(html, 'meta').map(attrs);
      assert.ok(metadata.some(tag => tag.name === 'description' && tag.content?.trim()), `${lang}/${route} description`);
      assert.ok(metadata.some(tag => tag.name === 'robots' && /^noindex\b/.test(tag.content)), `${lang}/${route} remains a preview`);
      assert.equal(metadata.find(tag => tag.property === 'og:url')?.content, canonical(lang, route));
      assert.ok(metadata.some(tag => tag.name === 'twitter:card' && tag.content === 'summary_large_image'));
      for (const tag of tags(html, 'img')) assert.ok(Object.hasOwn(attrs(tag), 'alt'), `${lang}/${route} image has text alternative decision`);
    }
  }
});

test('canonical and reciprocal hreflang links stay on the GitHub preview for every locale and route', () => {
  for (const route of primaryRoutes) {
    const reference = locales.map(lang => ({ hreflang: lang, href: canonical(lang, route) }));
    reference.push({ hreflang: 'x-default', href: canonical('de', route) });
    for (const lang of locales) {
      const html = readPage(lang, route);
      const pageLinks = links(html);
      assert.deepEqual(pageLinks.filter(link => link.rel === 'canonical').map(link => link.href), [canonical(lang, route)]);
      const alternates = pageLinks.filter(link => link.rel === 'alternate' && link.hreflang)
        .map(({ hreflang, href }) => ({ hreflang, href }))
        .sort((a, b) => a.hreflang.localeCompare(b.hreflang));
      assert.deepEqual(alternates, [...reference].sort((a, b) => a.hreflang.localeCompare(b.hreflang)), `${lang}/${route} complete reciprocal alternates`);
      const other = lang === 'de' ? 'en' : 'de';
      assert.ok(tags(html, 'a').some(tag => {
        const attributes = attrs(tag);
        return attributes.hreflang === other && attributes.href === `${base}/${other}/${route}`;
      }), `${lang}/${route} language switch keeps route context`);
      assert.doesNotMatch(html, /https?:\/\/(?:www\.)?bamboo-shampoo\.(?:com|de)\b/, 'custom domains are not published');
    }
  }
  assert.equal(fs.existsSync(path.join(root, 'CNAME')), false);
});

test('navigation is consistent and the useful first product image is prioritized before 3D',()=>{
 for(const lang of locales)for(const route of primaryRoutes){
   const html=readPage(lang,route),header=html.match(/<header[^>]*>[\s\S]*?<\/header>/)[0];
   for(const tag of tags(header,'a').filter(tag=>/\/(?:shop|refill|story)\//.test(attrs(tag).href||'')))assert.match(tag,/data-native-route/,'top-level navigation does not silently become a home section jump');
   assert.ok(links(html).some(link=>link.rel==='stylesheet'&&/polish\.css/.test(link.href)));
   assert.ok(html.indexOf('@view-transition{navigation:auto}') < html.indexOf('<link rel="stylesheet"'),'transition opt-in is available before external CSS arrives');
 }
 for(const lang of locales)for(const route of ['','refill/',...productRoutes]){
   const html=readPage(lang,route);
   const scent=route.startsWith('products/')?route.split('/')[1]:'aloe';
   const family=route==='refill/'?'teaser':route.startsWith('products/')?'detail':'guide';
   const expected=route.startsWith('products/')?`${base}/assets/cycles-product-${scent}-20261015-perspective2.webp`:`${base}/assets/shop-${family}-product-${scent}.webp`;
   const leadImage=tags(html,'img').map(attrs).find(image=>image.fetchpriority==='high');
   assert.ok(leadImage?.src.startsWith(expected),`${lang}/${route} prioritizes its matching scent and camera poster`);
   assert.ok(links(html).some(link=>link.rel==='preload'&&link.as==='image'&&link.href===leadImage.src),'the exact first visible poster is preloaded before GPU warmup');
 }
});

test('published pages use one sage and ivory theme with independent pastel fragrance finishes',()=>{
 for(const lang of locales)for(const route of primaryRoutes){
   const html=readPage(lang,route);
   assert.match(html,new RegExp(`--paper:\\s*${BRAND_THEME.ivory}`,'i'));
   assert.match(html,new RegExp(`--ink:\\s*${BRAND_THEME.ink}`,'i'));
   assert.match(html,new RegExp(`--sage:\\s*${BRAND_THEME.sage}`,'i'));
   for(const [scent,theme] of Object.entries(PRODUCT_THEMES)){
     const declarations=html.match(new RegExp(`\\.scent-${scent}\\s*\\{([^}]+)\\}`))?.[1];
     assert.ok(declarations,`${lang}/${route} contains ${scent} theme values at first paint`);
     assert.match(declarations,new RegExp(`--world-bg:\\s*${theme.world.base}`,'i'));
     assert.match(declarations,new RegExp(`--cap-color:\\s*${theme.cap}`,'i'));
   }
   const themeColor=tags(html,'meta').map(attrs).find(meta=>meta.name==='theme-color')?.content;
   assert.equal(themeColor?.toLowerCase(),BRAND_THEME.sage.toLowerCase());
 }
 const styles=fs.readFileSync(path.join(root,'assets','style.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'assets','polish.css'),'utf8');
 const editorialFace=[...styles.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(match=>match[1]).find(face=>/font-family:\s*Editorial\s*;/.test(face));
 assert.ok(editorialFace,'the regular editorial face is declared');
 assert.match(editorialFace,/editorial\.woff2/,'the editorial face is served locally');
 assert.match(editorialFace,/font-weight:\s*400\s*;/,'editorial headings use the regular face');
 assert.match(styles,/\.display\s*\{[^}]*font-family:\s*Editorial/,'editorial headings use the regular face');
 assert.match(styles,/grid-template-columns:\s*repeat\(3,\s*86vw\)/,'mobile fragrance cards retain the agreed large swipe width');
 assert.match(styles,/scroll-snap-type:\s*x mandatory/);
 const playbackRoom=styles.match(/\.product-playback\s*\{([^}]+)\}/)?.[1];
 assert.ok(playbackRoom);
 assert.doesNotMatch(playbackRoom,/position:\s*(?:fixed|sticky)|(?:block-size|height):\s*\d{3,}svh/,'the home story occupies normal document flow');
 assert.equal(fs.readFileSync(path.join(root,'assets','product-theme.js'),'utf8'),fs.readFileSync(path.join('assets','product-theme.js'),'utf8'));
});

test('structured data follows the visible content routes without inventing purchasable offers or reviews', () => {
  for (const lang of locales) for (const route of primaryRoutes) {
    const html = readPage(lang, route);
    const text = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    const data = JSON.parse(text);
    assert.equal(data['@context'], 'https://schema.org');
    const graph = data['@graph'];
    assert.ok(Array.isArray(graph));
    const site = graph.find(item => item['@type'] === 'WebSite');
    assert.equal(site?.url, `${origin}${base}/`);
    const page = graph.find(item => item.url === canonical(lang, route));
    assert.equal(page?.inLanguage, lang);
    const crumbs = graph.find(item => item['@type'] === 'BreadcrumbList')?.itemListElement;
    assert.equal(crumbs?.[0].item, canonical(lang, ''));
    if (route.startsWith('products/')) {
      const scent = route.split('/')[1];
      assert.equal(crumbs.length, 3, 'product breadcrumbs retain the collection level');
      assert.equal(crumbs[1].item, canonical(lang, 'shop/'));
      assert.equal(crumbs[2].item, canonical(lang, route));
      assert.equal(crumbs[2].name.toLowerCase(), scent);
    }
    if (route === 'shop/') {
      assert.equal(page['@type'], 'CollectionPage');
      assert.deepEqual(page.mainEntity.itemListElement.map(item => item.url).sort(), productRoutes.map(productRoute => canonical(lang, productRoute)).sort());
    }
    assert.doesNotMatch(text, /"(?:offers|aggregateRating|review)"\s*:/, 'preview metadata does not imply live purchases or invent customer evidence');
  }
});

test('the sitemap includes localized public content and excludes the session-only selection review', () => {
  const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const actual = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => unescape(match[1]));
  const expected = locales.flatMap(lang => primaryRoutes.filter(route => route !== 'checkout/').map(route => canonical(lang, route)));
  assert.equal(new Set(actual).size, actual.length, 'no duplicate sitemap URLs');
  assert.deepEqual([...actual].sort(), [...expected].sort());
  assert.ok(!actual.some(url => /\/checkout\//.test(url)), 'private session selections are not advertised as public content');
  const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
  assert.match(robots, new RegExp(`Sitemap: ${origin}${base}/sitemap\\.xml`));
  assert.doesNotMatch(robots, /Disallow:\s*\/\s*(?:\n|$)/, 'crawlers can see each page noindex declaration');
});

test('old fragrance URLs resolve to the corresponding product route with the same SEO destination', () => {
  for (const lang of locales) for (const scent of fragrances) {
    const html = readPage(lang, `shop/${scent}/`);
    const destination = `${base}/${lang}/products/${scent}/`;
    assert.deepEqual(links(html).filter(link => link.rel === 'canonical').map(link => link.href), [origin + destination]);
    assert.ok(tags(html, 'meta').map(attrs).some(tag => tag['http-equiv']?.toLowerCase() === 'refresh' && tag.content.includes(destination)));
    assert.ok(tags(html, 'a').map(attrs).some(tag => tag.href === destination), 'redirect has a usable no-script destination');
    assert.match(html, /location\.search/, 'existing refill query remains usable when script is enabled');
  }
});

test('both legal notices preserve the exact published operator fragment', () => {
  // Captured from the already published DE/EN legal-copy before the redesign.
  // This locks preservation; it does not assert that legal wording is current.
  const expected = '98bb34fbe5b95cd714f2e20d0a2a641ceca1b400a6ce017dfdc15c387c184782';
  for (const lang of locales) {
    const html = readPage(lang, 'impressum/');
    const fragment = html.match(/<div class="legal-copy" lang="de">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(fragment, `${lang} operator text remains in its original language`);
    assert.equal(fragment.length, 741);
    assert.equal(digest(fragment), expected, `${lang} operator content is verbatim`);
  }
  for (const lang of locales) for (const route of primaryRoutes.filter(route => route !== 'impressum/')) {
    assert.doesNotMatch(readPage(lang, route), /jubam/i, `${lang}/${route} keeps operator brand limited to legal notice`);
  }
});

test('all three 250 ml scents retain both formats, briefing prices and reachable refill choices', () => {
  assert.deepEqual([...fragrances].sort(), ['aloe', 'argan', 'bamboo']);
  assert.deepEqual(prices, { shampoo: 1250, refill: 450 });
  assert.equal(cartTotal([{ scent: 'aloe', format: 'shampoo', quantity: 1 }, { scent: 'argan', format: 'refill', quantity: 1 }]), 1700);
  for (const lang of locales) {
    const collection = readPage(lang, 'shop/');
    const refill = readPage(lang, 'refill/');
    for (const scent of fragrances) {
      const product = readPage(lang, `products/${scent}/`);
      assert.match(product, /250\s*ml/i);
      assert.ok(unescape(product).includes(formatPrice(1250, lang)), `${lang}/${scent} shampoo price`);
      assert.ok(unescape(product).includes(formatPrice(450, lang)), `${lang}/${scent} refill price`);
      // The single selector is next to the model and belongs to the form by ID.
      const main = product.match(/<main\b[^>]*\bid="main"[^>]*>([\s\S]*?)<\/main>/)?.[1];
      assert.ok(main, `${lang}/${scent} dedicated product content`);
      const forms = [...main.matchAll(/<form\b[^>]*\bdata-product-form\b[^>]*>([\s\S]*?)<\/form>/g)];
      assert.equal(forms.length, 1, `${lang}/${scent} one dedicated product form`);
      const inputs = tags(main, 'input').map(attrs).filter(input=>!input.form||input.form===`product-form-${scent}`);
      assert.ok(inputs.some(input => input.name === 'scent' && input.value === scent), `${lang}/${scent} identifies its own scent`);
      assert.deepEqual(inputs.filter(input => input.name === 'format').map(input => input.value).sort(), ['refill', 'shampoo']);
      assert.ok(inputs.some(input => input.name === 'quantity' && input.type === 'number' && input.min === '1' && input.max === '20'));
      const productPath = `${base}/${lang}/products/${scent}/`;
      assert.ok(tags(collection, 'a').map(attrs).some(link => link.href === productPath), `${lang}/${scent} reachable from collection`);
      assert.ok(tags(refill, 'a').map(attrs).some(link => link.href === `${productPath}?format=refill`), `${lang}/${scent} has explicit refill link`);
    }
  }
});

test('selection, review and motion remain accessible static previews without transaction collection', () => {
  for (const lang of locales) for (const route of primaryRoutes) {
    const html = readPage(lang, route);
    assert.ok(tags(html, 'dialog').map(attrs).some(dialog => dialog.id === 'bag-dialog'));
    assert.ok(tags(html, 'dialog').map(attrs).some(dialog => dialog.id === 'menu-dialog'));
    assert.equal(scriptData(html, 'ui-copy').lang, lang);
    for (const tag of tags(html, 'form')) {
      const attributes = attrs(tag);
      assert.ok(!attributes.action || !/^https?:/i.test(attributes.action), 'product selection does not send customer data');
      assert.notEqual(attributes.method?.toLowerCase(), 'post');
    }
    for (const tag of tags(html, 'input')) {
      const input = attrs(tag);
      assert.ok(!['email', 'tel', 'password'].includes(input.type), 'no customer contact or credential fields');
      if(input.name==='demo-payment'){
        assert.equal(input.type,'radio');assert.ok(['card','wallet'].includes(input.value),'only preset simulated methods');
      }else assert.ok(!/card|payment|address|email|phone|password/i.test(input.name || ''), 'no real transaction fields');
    }
    for (const tag of tags(html, 'script').filter(tag => attrs(tag).src)) assert.ok(attrs(tag).src.startsWith(`${base}/`), 'runtime scripts are self-hosted');
    assert.equal(tags(html, 'iframe').length, 0, 'the shop does not embed the infinite-scroll approval page');
    for (const tag of tags(html, 'div').filter(tag => Object.hasOwn(attrs(tag), 'data-shop-scene'))) {
      assert.equal(attrs(tag).role, 'group', 'interactive canvases are not hidden within an atomic image role');
    }
  }
  for (const lang of locales) {
    const review = readPage(lang, 'checkout/');
    assert.match(review, /data-checkout-items/);
    assert.match(review, /data-checkout-total/);
    assert.match(review, /data-checkout-panel="complete"/);
    assert.match(review, /data-checkout-submit disabled/);
    assert.match(review, lang === 'de' ? /keine\s+(?:Zahlungen|Bestellungen)|keine\s+Bestellung|kein\s+Checkout/i : /no\s+(?:payments|orders|checkout)|does\s+not\s+accept\s+orders/i);
    const refill = readPage(lang, 'refill/');
    assert.match(refill, /data-ritual-scroll/);
    assert.ok(tags(refill, 'a').map(attrs).some(link => link.href === `${base}/assembly/`), 'fullscreen ritual remains directly reachable');
    assert.ok([...refill.matchAll(/data-ritual-step="([0-4])"/g)].length >= 5, 'native-scroll sequence has a written alternative');
  }
});

test('published 3D assets retain approved artwork and exclude rejected legacy renderers', () => {
  // Approved Three.js helper modules use the bare "three" specifier. The
  // shop must map it before its entry module runs, as the fullscreen viewer
  // already does, or browsers silently fall back after module loading fails.
  for (const lang of locales) for (const route of primaryRoutes) {
    const html = readPage(lang, route);
    const importMap = html.match(/<script[^>]*type="importmap"[^>]*>([\s\S]*?)<\/script>/);
    assert.ok(importMap, `${lang}/${route} provides the approved helper import map`);
    assert.equal(JSON.parse(importMap[1]).imports?.three, `${base}/assembly/vendor/three.module.js`);
    const entry = html.match(/<script[^>]*\bsrc="[^\"]*\/assets\/app\.js(?:\?[^\"]*)?"[^>]*>/);
    assert.ok(entry, `${lang}/${route} has a shop entry module`);
    assert.ok(importMap.index + importMap[0].length <= entry.index, 'the import map precedes the shop entry module');
  }
  const original = path.join('assets', 'assembly', 'original-engraving.svg');
  const published = path.join(root, 'assembly', 'original-engraving.svg');
  const expected = '67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa';
  assert.equal(digest(fs.readFileSync(original)), expected);
  assert.equal(digest(fs.readFileSync(published)), expected);
  for (const filename of ['product-scene.js', 'engraving-aloe.svg', 'engraving-argan.svg', 'engraving-bamboo.svg']) {
    assert.equal(fs.existsSync(path.join(root, 'assets', filename)), false, `${filename} is not published`);
  }
  const sourceViewer = fs.readFileSync(path.join('assets', 'shop-scene.js'), 'utf8');
  const publishedViewer = fs.readFileSync(path.join(root, 'assets', 'shop-scene.js'), 'utf8');
  assert.equal(publishedViewer, sourceViewer.replaceAll('./assembly/', '../assembly/'), 'published shop viewer only adapts the approved module directory');
  const imports = [...publishedViewer.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const specifier of imports) {
    assert.ok(specifier.startsWith('../assembly/') || ['./intro-pose.js','./journey-pose.js','./campaign-backdrop.js','./scene-framing.js','./product-theme.js'].includes(specifier.split('?')[0]), 'approved models use the pose adapter, shared preview framing and coherent fragrance theme');
    assert.ok(fs.existsSync(path.resolve(root, 'assets', specifier.split('?')[0])), `${specifier} resolves after publishing`);
  }
  const poseSource = fs.readFileSync(path.join('assets', 'journey-pose.js'), 'utf8');
  assert.equal(fs.readFileSync(path.join(root, 'assets', 'journey-pose.js'), 'utf8'), poseSource.replaceAll('./assembly/', '../assembly/'));
  for (const match of poseSource.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) assert.ok(match[1].startsWith('./assembly/'), 'intro adapts the approved operating timeline');
  for (const filename of ['shop-product.jpg', 'shop-refill.jpg', 'shop-cap.jpg']) {
    const image = fs.readFileSync(path.join(root, 'assets', filename));
    assert.ok(image.length > 2000, `${filename} contains an actual product render`);
    assert.deepEqual([...image.subarray(0, 2)], [255, 216], `${filename} is a JPEG image`);
  }
});
