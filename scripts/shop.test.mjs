import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fragrances, prices, formatPrice, cartTotal } from '../assets/catalog.js';

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
const links = html => tags(html, 'link').map(attrs);
const scriptData = (html, id) => JSON.parse(html.match(new RegExp(`<script[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)<\\/script>`))[1]);
const unescape = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>');

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
      const inputs = tags(product, 'input').map(attrs);
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
      assert.ok(!/card|payment|address|email|phone|password/i.test(input.name || ''), 'no transaction fields');
    }
    for (const tag of tags(html, 'script').filter(tag => attrs(tag).src)) assert.ok(attrs(tag).src.startsWith(`${base}/`), 'runtime scripts are self-hosted');
    assert.equal(tags(html, 'iframe').length, 0, 'the shop does not embed the infinite-scroll approval page');
  }
  for (const lang of locales) {
    const review = readPage(lang, 'checkout/');
    assert.match(review, /data-review-items/);
    assert.match(review, /data-review-total/);
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
    assert.ok(specifier.startsWith('../assembly/'), 'shop models come from the approved assembly');
    assert.ok(fs.existsSync(path.resolve(root, 'assets', specifier.split('?')[0])), `${specifier} resolves after publishing`);
  }
  for (const filename of ['shop-product.jpg', 'shop-refill.jpg', 'shop-cap.jpg']) {
    const image = fs.readFileSync(path.join(root, 'assets', filename));
    assert.ok(image.length > 2000, `${filename} contains an actual product render`);
    assert.deepEqual([...image.subarray(0, 2)], [255, 216], `${filename} is a JPEG image`);
  }
});
