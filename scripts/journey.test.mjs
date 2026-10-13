import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { chapterPosition, positionFromBookmark, normalizeChoice, normalizeBookmark, validBookmark, JOURNEY_CHAPTERS } from '../assets/journey.js';

const BASE = '/bamboo-shampoo-demo';
const HOME = `https://example.test${BASE}/en/`;
const production = fs.readFileSync(new URL('../assets/journey.js', import.meta.url), 'utf8');
const saved = overrides => ({ chapter: 'ritual', progress: .4, scroll: 3366, lang: 'en', viewportHeight: 844, viewportWidth: 390,
  layout: 'collection-before-ritual-v1', ...overrides });

test('continuous homepage links use real product and story pages without material popups', () => {
  const h = harness({ continuous: true });
  h.chapters[0].height = 2000;
  for (const route of ['products/aloe/', 'story/', 'refill/', 'faq/']) {
    const link = new h.Element('a', { href: `${BASE}/en/${route}` }, h.chapters[1]);
    assert.equal(h.click(link).defaultPrevented, false);
    assert.equal(h.dialog.open, false);
  }
  const bookmark = JSON.parse(h.memory.get('bamboo-journey-return-v1'));
  assert.equal(bookmark.chapter, 'discover');
  assert.equal(bookmark.scroll, 312);
  assert.equal(bookmark.progress, (312 + 68) / (2000 - (844 - 68)), 'embedded story nav does not add another header offset');
});

test('continuous homepage resumes only after the model has established the final scroll layout', async () => {
  const memory = new Map([['bamboo-journey-return-v1', JSON.stringify(saved())]]);
  const h = harness({ continuous: true, memory, url: `${HOME}?resume=1#ritual`, scroll: 0 });
  await Promise.resolve(); h.flushFrames();
  assert.equal(h.window.scrollY, 0, 'static fallback geometry cannot restore the animated track prematurely');
  h.api.ready(); await Promise.resolve(); h.flushFrames();
  assert.equal(h.window.scrollY, 3366);
  h.window.scrollY = 3512; h.api.ready(); await Promise.resolve(); h.flushFrames();
  assert.equal(h.window.scrollY, 3512, 'subsequent ready notifications do not jump the user');
});

test('scent changes preserve the explicit refill format on native purchase links', () => {
  const h = harness({ continuous: true });
  const world = new h.Element('section', { 'data-world': 'bamboo' }, h.chapters[1]);
  const shampoo = new h.Element('a', { 'data-world-link': '', href: `${BASE}/en/products/bamboo/` }, world);
  const refill = new h.Element('a', { 'data-world-link': '', 'data-world-format': 'refill', href: `${BASE}/en/products/bamboo/?format=refill` }, world);
  h.api.select({ scent: 'argan' });
  assert.equal(shampoo.href, `https://example.test${BASE}/en/products/argan/`);
  assert.equal(refill.href, `https://example.test${BASE}/en/products/argan/?format=refill`);
});

test('cold reload and noncached browser Back restore the continuous track after it is ready', async () => {
  for (const navigationType of ['reload', 'back_forward']) {
    const memory = new Map([['bamboo-journey-return-v1', JSON.stringify(saved())]]);
    const h = harness({ continuous: true, navigationType, memory, scroll: 0 });
    await Promise.resolve(); h.flushFrames(); assert.equal(h.window.scrollY, 0);
    h.api.ready(); await Promise.resolve(); h.flushFrames(); assert.equal(h.window.scrollY, 3366);
  }
});

test('a detour during 3D loading retains its chapter position when returning on another screen size', () => {
  const h = harness({ continuous: true, scroll: 3366 });
  const waiting = h.document.querySelector('[data-product-journey]');
  waiting.top = 2600; waiting.height = 4000; waiting.classList.add('is-loading');
  h.click(h.trigger);
  const point = JSON.parse(h.memory.get('bamboo-journey-return-v1'));
  assert.equal(point.chapter, 'ritual');
  assert.equal(point.progress, (3366 + 68 - 2600) / (4000 - (844 - 68)));
  const restored = positionFromBookmark(point, { top: 2100, height: 3000 }, 568, 64, 320);
  assert.ok(restored > 2100 - 64, 'the pending model does not reset a resized return to the chapter start');
});

test('a same-viewport return preserves the raw position even for a short, fully traversed chapter', () => {
  const point = saved({ chapter: 'discover', progress: 1, scroll: 312 });
  assert.equal(positionFromBookmark(point, { top: 0, height: 844 }, 844, 126, 390), 312);
});

test('orientation and width changes preserve the chapter fraction instead of an obsolete pixel offset', () => {
  const point = saved({ progress: .5 });
  assert.equal(positionFromBookmark(point, { top: 2100, height: 3000 }, 390, 100, 844), 3355);
  assert.equal(positionFromBookmark(point, { top: 2100, height: 4000 }, 844, 126, 430), 3615);
});

test('legacy bookmarks without viewport dimensions use chapter-relative restoration', () => {
  const point = saved({ progress: .25, viewportHeight: undefined, viewportWidth: undefined });
  assert.equal(positionFromBookmark(point, { top: 2100, height: 4000 }, 844, 126, 390), 2794.5);
});

test('missing chapter geometry has a nonnegative raw-position fallback', () => {
  assert.equal(positionFromBookmark(saved({ scroll: 229.333 }), null, 390, 100, 844), 229.333);
  assert.equal(positionFromBookmark({ scroll: -12 }, null, 390, 100, 844), 0);
});

test('chapter progress is bounded before and after its actual scroll interval', () => {
  const rect = { top: 2100, height: 4000 };
  assert.equal(chapterPosition(rect, 1000, 844, 126), 0);
  assert.equal(chapterPosition(rect, 10000, 844, 126), 1);
  assert.equal(chapterPosition(rect, 3615, 844, 126), .5);
});

test('partial scent/format choices retain the other valid choice and reject unknown catalog entries', () => {
  const current = { scent: 'aloe', format: 'refill' };
  assert.deepEqual(normalizeChoice({ scent: 'argan' }, current), { scent: 'argan', format: 'refill' });
  assert.deepEqual(normalizeChoice({ format: 'shampoo' }, current), { scent: 'aloe', format: 'shampoo' });
  assert.deepEqual(normalizeChoice({ scent: 'unknown', format: 'other' }, current), current);
  assert.deepEqual(normalizeChoice(null), { scent: 'bamboo', format: 'shampoo' });
});

test('untrusted persisted positions must name a known chapter and finite bounded coordinates', () => {
  assert.ok(validBookmark(saved()));
  assert.ok(!validBookmark(saved({ chapter: 'checkout' })));
  for (const progress of [NaN, Infinity, -.01, 1.01, '.5']) assert.ok(!validBookmark(saved({ progress })));
  for (const scroll of [NaN, Infinity, -1, '12']) assert.ok(!validBookmark(saved({ scroll })));
  assert.ok(!validBookmark(null));
});

test('chapter order follows discover, scent choice, use and questions', () => {
  assert.deepEqual(JOURNEY_CHAPTERS, ['discover', 'collection', 'ritual', 'questions']);
});

test('old material bookmarks migrate to the beginning of use instead of retaining obsolete pixel positions', () => {
  const point = normalizeBookmark(saved({ chapter: 'materials', progress: .8, layout: undefined }));
  assert.equal(point.chapter, 'ritual'); assert.equal(point.progress, 0);
  assert.equal(point.viewportWidth, undefined); assert.equal(point.viewportHeight, undefined);
  assert.equal(positionFromBookmark(point, { top: 2600, height: 4000 }, 844, 68, 390), 2532);
  assert.equal(normalizeBookmark(saved({ chapter: 'materials', progress: Infinity })), null);
});

test('unversioned old-layout returns preserve chapter progress rather than a previous section pixel offset', () => {
  const point = normalizeBookmark(saved({ layout: undefined }));
  assert.equal(point.chapter, 'ritual'); assert.equal(point.progress, .4);
  assert.ok(Math.abs(positionFromBookmark(point, { top: 2600, height: 4000 }, 844, 68, 390) - 3821.6) < 1e-9);
  assert.equal(normalizeBookmark(saved({ chapter: 'unknown' })), null);
});

// Execute the complete production controller against a small standard-DOM
// surface. History traversals, native close events, and animation frames are
// separate queues, so a test cannot accidentally treat Back as synchronous.
// This harness checks state/control behavior; it does not claim native focus
// trapping, layout, browser touch arbitration, BFCache, or GPU validation.
function harness({ scroll = 312, state = null, url = HOME, memory = new Map(), main = true, continuous = false, navigationType = 'navigate', storageBlocked = false } = {}) {
  const frames = new Map(), tasks = [], historyTasks = [], observers = [], stack = [];
  const listeners = new Map(); let frameId = 1;
  const location = new URL(url);
  const window = { scrollY: scroll, innerWidth: 390, innerHeight: 844,
    addEventListener(type, callback) { const list = listeners.get(type) || []; list.push(callback); listeners.set(type, list); },
    scrollTo({ top }) { this.scrollY = top; },
  };
  const emit = (type, event = {}) => { for (const listener of listeners.get(type) || []) listener(event); };
  const docListeners = new Map();
  let document;
  class Element {
    constructor(tag, attrs = {}, parent = null) {
      this.tagName = tag.toUpperCase(); this.dataset = {}; this.attributes = new Map(); this.children = []; this.parentElement = parent;
      this.style = { setProperty(name, value) { this[name] = value; } }; this.hidden = false; this.inert = false; this.open = false;
      this.top = 0; this.height = 100; this.offsetHeight = 0; this.events = new Map(); this.textContent = '';
      const classes = new Set(); this.classList = { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)),
        contains: n => classes.has(n), toggle: (n, force) => { const next = force ?? !classes.has(n); next ? classes.add(n) : classes.delete(n); return next; } };
      for (const [key, value] of Object.entries(attrs)) this.setAttribute(key, value);
      parent?.children.push(this);
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'class') this.classList.add(...String(value).split(/\s+/));
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); }
    getAttribute(name) { if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? null; return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.getAttribute(name) !== null; }
    removeAttribute(name) { this.attributes.delete(name); }
    get href() { return new URL(this.getAttribute('href') || '', location.href).href; }
    set href(value) { this.setAttribute('href', value); }
    matches(selector) {
      return selector.split(',').some(part => {
        const segments = part.trim().split(/\s+/); const current = segments.pop();
        const negative = [...current.matchAll(/:not\(([^)]+)\)/g)].map(m => m[1]);
        if (negative.some(s => this.matches(s))) return false;
        const simple = current.replace(/:not\([^)]+\)/g, '');
        const tag = simple.match(/^[a-z]+/i)?.[0]; if (tag && this.tagName !== tag.toUpperCase()) return false;
        for (const match of simple.matchAll(/#([\w-]+)/g)) if (this.getAttribute('id') !== match[1]) return false;
        for (const match of simple.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(match[1])) return false;
        for (const match of simple.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)) {
          if (!this.hasAttribute(match[1]) || match[2] !== undefined && this.getAttribute(match[1]) !== match[2]) return false;
        }
        if (segments.length) return !!this.parentElement?.closest(segments.join(' '));
        return true;
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    all() { return this.children.flatMap(child => [child, ...child.all()]); }
    querySelectorAll(selector) { return this.all().filter(child => child.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(type, callback) { const list = this.events.get(type) || []; list.push(callback); this.events.set(type, list); }
    dispatchEvent(event) { for (const listener of this.events.get(event.type) || []) listener(event); }
    getBoundingClientRect() { const offset = document.body.style.position === 'fixed' ? -Number.parseFloat(document.body.style.top || 0) : window.scrollY;
      return { top: this.top - offset, height: this.height, left: 0, right: 390, bottom: this.top - offset + this.height }; }
    focus() { const modal = stack.at(-1); if (!modal || this === modal || this.closest(`#${modal.getAttribute('id')}`)) document.activeElement = this; }
    scrollTo({ top }) { this.scrollTop = top; }
    scrollIntoView(options) { this.lastScrollOptions = options; window.scrollY = this.top; }
    showModal() { this.nativeFocus = document.activeElement; this.open = true; stack.push(this); this.focus(); observers.forEach(o => o.dirty = true); }
    close() { if (!this.open) return; this.open = false; stack.splice(stack.indexOf(this), 1); this.nativeFocus?.focus();
      observers.forEach(o => o.dirty = true); tasks.push(() => this.dispatchEvent({ type: 'close' })); }
  }
  const html = new Element('html'), body = new Element('body', {}, html);
  document = { documentElement: html, body, activeElement: body, fonts: { ready: Promise.resolve() },
    querySelectorAll: selector => [html, ...html.all()].filter(el => el.matches(selector)),
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    addEventListener(type, callback) { const list = docListeners.get(type) || []; list.push(callback); docListeners.set(type, list); },
  };
  const header = new Element('header', { class: 'header' }, body); header.offsetHeight = 68;
  const nav = new Element('nav', { 'data-journey-nav': '' }, body); nav.offsetHeight = 58;
  const mainEl = main ? new Element('main', { 'data-journey': '' }, body) : null;
  if (continuous && mainEl) new Element('section', { 'data-product-journey': '' }, mainEl);
  const specs = [['discover', 0, 850], ['collection', 1000, 1400], ['ritual', 2600, 4000], ['questions', 6700, 800]];
  const chapters = specs.map(([id, top, height]) => { const el = new Element('section', { id, 'data-journey-chapter': id }, mainEl || body); el.top = top; el.height = height; return el; });
  const trigger = new Element('a', { href: `${BASE}/en/products/bamboo/`, 'data-detour': 'product' }, chapters[0]);
  const dialog = new Element('dialog', { id: 'journey-dialog' }, body);
  const close = new Element('button', { 'data-detour-close': '' }, dialog);
  new Element('h2', { 'data-detour-title': '' }, dialog);
  const detailBody = new Element('div', { 'data-detour-body': '' }, dialog);
  const detailPanels = ['product', 'materials', 'refill', 'faq', 'inspect'].map(type => new Element('section', { 'data-detour-panel': type }, detailBody));
  const scent = new Element('a', { href: `${BASE}/en/products/aloe/`, 'data-scent-link': '' }, detailPanels[0]);
  const bag = new Element('dialog', { id: 'bag-dialog' }, body);
  const menu = new Element('dialog', { id: 'menu-dialog' }, body);
  const entries = [{ state: null, url: HOME }, { state, url }]; let index = 1;
  const history = {
    get state() { return entries[index].state; },
    pushState(value, unused, target) { entries.splice(index + 1); entries.push({ state: value, url: new URL(target, location.href).href }); index++; location.href = entries[index].url; },
    replaceState(value, unused, target) { entries[index] = { state: value, url: new URL(target, location.href).href }; location.href = entries[index].url; },
    back() { historyTasks.push(() => { if (!index) return; index--; location.href = entries[index].url; emit('popstate'); }); },
    forward() { historyTasks.push(() => { if (index === entries.length - 1) return; index++; location.href = entries[index].url; emit('popstate'); }); },
  };
  const context = vm.createContext({ document, window, location, history, URL, URLSearchParams,
    performance: { getEntriesByType: () => [{ type: navigationType }] },
    innerHeight: window.innerHeight, innerWidth: window.innerWidth,
    sessionStorage: {
      getItem(key) { if (storageBlocked) throw new Error('Storage unavailable'); return memory.get(key) ?? null; },
      setItem(key, value) { if (storageBlocked) throw new Error('Storage unavailable'); memory.set(key, value); },
    },
    Event: class { constructor(type) { this.type = type; } },
    MutationObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} },
    requestAnimationFrame(callback) { const id = frameId++; frames.set(id, callback); return id; },
  });
  vm.runInContext(`${production.replace(/^export /gm, '')}\nglobalThis.createJourney = initializeJourney;`, context);
  const modalChanges = [];
  const api = context.createJourney({ ui: { base: BASE, lang: 'en', names: { aloe: 'Aloe', argan: 'Argan', bamboo: 'Bamboo' }, scentDescriptions: {}, scentWords: {} },
    reduced: { matches: false }, onModal: value => { if (modalChanges.at(-1) !== value) modalChanges.push(value); } });
  const flushMutations = () => { for (const o of observers) if (o.dirty) { o.dirty = false; o.callback(); } };
  const flushEvents = () => { while (tasks.length) tasks.shift()(); flushMutations(); };
  const flushHistory = () => { while (historyTasks.length) { historyTasks.shift()(); flushEvents(); } };
  const flushFrames = () => { const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback()); };
  const click = (target, options = {}) => { const event = { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...options };
    for (const callback of docListeners.get('click') || []) callback(event); return event; };
  return { api, click, document, window, location, history, trigger, dialog, bag, menu, scent, chapters, modalChanges, memory,
    flushHistory, flushFrames, flushEvents, flushMutations, Element,
    choice: () => JSON.parse(JSON.stringify(api.getChoice())),
    resize(width, height) { window.innerWidth = context.innerWidth = width; window.innerHeight = context.innerHeight = height; emit('resize'); },
  };
}

test('product and explanation links are native even with leftover detour attributes on an older page', () => {
  for (const main of [true, false]) for (const continuous of [true, false]) {
    const h = harness({ main, continuous });
    for (const [route, type] of [['en/products/aloe/', 'product'], ['en/story/', 'materials'], ['en/refill/', 'refill'], ['en/faq/', 'faq'], ['assembly/', 'inspect']]) {
      const link = new h.Element('a', { href: `${BASE}/${route}`, 'data-detour': type }, h.document.body);
      assert.equal(h.click(link).defaultPrevented, false, route);
      assert.equal(h.dialog.open, false);
      assert.equal(h.api.isLocked(), false);
    }
    assert.equal(h.api.open, undefined, 'the retired detail controller has no popup entry point');
  }
});

test('basket close restores the same page position and native originating focus without history entries', () => {
  const h = harness(); h.trigger.focus(); h.bag.showModal(); h.flushMutations();
  assert.equal(h.api.isLocked(), true); assert.equal(h.document.body.style.top, '-312px');
  assert.equal(h.api.getTopDialog(), h.bag);
  h.bag.close(); h.flushEvents(); h.flushFrames();
  assert.equal(h.api.isLocked(), false); assert.equal(h.window.scrollY, 312);
  assert.equal(h.document.activeElement, h.trigger); assert.equal(h.location.href, HOME);
  assert.deepEqual(h.modalChanges, [true, false]);
});

test('a menu and basket keep the page locked until the final required dialog closes', () => {
  const h = harness({ scroll: 3366 }); h.menu.showModal(); h.flushMutations();
  h.bag.showModal(); h.flushMutations();
  assert.equal(h.api.getTopDialog(), h.bag);
  h.menu.close(); h.flushEvents();
  assert.equal(h.api.isLocked(), true); assert.equal(h.bag.open, true);
  assert.deepEqual(h.modalChanges, [true]);
  h.bag.close(); h.flushEvents(); h.flushFrames();
  assert.equal(h.api.isLocked(), false); assert.equal(h.window.scrollY, 3366);
  assert.deepEqual(h.modalChanges, [true, false]);
});

test('orientation inside the basket returns to the corresponding point of the guide', () => {
  const h = harness({ scroll: 3615 }); h.bag.showModal(); h.flushMutations();
  h.resize(844, 390); h.bag.close(); h.flushEvents(); h.flushFrames();
  assert.ok(Math.abs(h.window.scrollY - 3772.8348567946373) < 1e-9, `returned at ${h.window.scrollY}`);
  assert.equal(h.document.querySelector('main[data-journey]').dataset.activeChapter, 'ritual');
});

test('ordinary and modified scent anchors always preserve native navigation and the current choice', () => {
  for (const modifier of [null, 'ctrlKey', 'metaKey', 'shiftKey', 'altKey', 'download', 'target']) {
    const h = harness();
    if (modifier === 'target') h.scent.setAttribute('target', '_blank');
    if (modifier === 'download') h.scent.setAttribute('download', '');
    assert.equal(h.click(h.scent, modifier && !['target', 'download'].includes(modifier) ? { [modifier]: true } : {}).defaultPrevented, false);
    assert.deepEqual(h.choice(), { scent: 'bamboo', format: 'shampoo' });
    assert.equal(h.dialog.open, false);
  }
});

test('cold visits clean removed detail hashes and state while retaining unrelated history state', () => {
  for (const state of [null, { keep: 7, bambooDetail: null }, { keep: 7, bambooDetail: { type: 'inspect' } }]) {
    const h = harness({ state, url: `${HOME}?format=refill#detail-inspect` });
    assert.equal(h.location.hash, ''); assert.equal(h.location.search, '?format=refill');
    assert.equal(h.history.state?.bambooDetail, undefined);
    if (state) assert.equal(h.history.state.keep, 7);
    assert.equal(h.dialog.open, false); assert.equal(h.api.isLocked(), false);
  }
});

test('Back and Forward sanitize legacy detail entries without reopening popups or locking the page', () => {
  const h = harness();
  h.history.pushState({ keep: 'old', bambooDetail: { type: 'product' } }, '', '#detail-product');
  h.history.pushState({ keep: 'new' }, '', HOME);
  h.history.back(); h.flushHistory(); h.flushFrames();
  assert.equal(h.history.state.keep, 'old'); assert.equal(h.history.state.bambooDetail, undefined);
  assert.equal(h.location.hash, ''); assert.equal(h.dialog.open, false); assert.equal(h.api.isLocked(), false);
  h.history.forward(); h.flushHistory(); h.flushFrames();
  assert.equal(h.history.state.keep, 'new'); assert.equal(h.dialog.open, false);
});

test('the collection shortcut only intercepts a normal click when the collection exists', () => {
  const h = harness({ continuous: true });
  const link = new h.Element('a', { href: `${BASE}/en/shop/` }, h.document.body);
  assert.equal(h.click(link).defaultPrevented, true); assert.equal(h.window.scrollY, 1000);
  assert.equal(h.click(link, { ctrlKey: true }).defaultPrevented, false);
  link.setAttribute('data-native-route', ''); assert.equal(h.click(link).defaultPrevented, false);
  const absent = harness({ main: false });
  assert.equal(absent.click(new absent.Element('a', { href: `${BASE}/en/shop/` }, absent.document.body)).defaultPrevented, false);
});

test('the mobile menu collection shortcut closes the menu before moving to the collection', () => {
  const h = harness({ continuous: true }); h.menu.showModal(); h.flushMutations();
  const link = new h.Element('a', { href: `${BASE}/en/shop/` }, h.menu);
  assert.equal(h.click(link).defaultPrevented, true); h.flushEvents(); h.flushFrames();
  assert.equal(h.menu.open, false); assert.equal(h.api.isLocked(), false); assert.equal(h.window.scrollY, 1000);
});

test('blocked storage still permits choice and exact basket return', () => {
  const h = harness({ storageBlocked: true, scroll: 3366 });
  h.api.select({ scent: 'argan', format: 'refill' }); h.bag.showModal(); h.flushMutations();
  assert.deepEqual(h.choice(), { scent: 'argan', format: 'refill' });
  h.bag.close(); h.flushEvents(); h.flushFrames();
  assert.equal(h.api.isLocked(), false); assert.equal(h.window.scrollY, 3366);
});

test('a normal fresh homepage visit does not force a stored return position', async () => {
  const memory = new Map([['bamboo-journey-return-v1', JSON.stringify(saved())]]);
  const h = harness({ scroll: 0, memory }); await Promise.resolve(); h.flushFrames();
  assert.equal(h.window.scrollY, 0);
});

test('an explicit resume restores a valid same-viewport bookmark after font readiness', async () => {
  const memory = new Map([['bamboo-journey-return-v1', JSON.stringify(saved())]]);
  const h = harness({ scroll: 0, url: `${HOME}?resume=1#ritual`, memory }); await Promise.resolve(); h.flushFrames();
  assert.equal(h.window.scrollY, 3366);
});

test('invalid saved data does not force a scroll even for an explicit resume URL', async () => {
  const memory = new Map([['bamboo-journey-return-v1', JSON.stringify(saved({ chapter: 'unknown' }))]]);
  const h = harness({ scroll: 0, url: `${HOME}?resume=1`, memory }); await Promise.resolve(); h.flushFrames();
  assert.equal(h.window.scrollY, 0);
});

test('a legacy materials hash enters the actual use sequence after the model establishes its layout', async () => {
  const h = harness({ continuous: true, scroll: 0, url: `${HOME}#materials` });
  assert.equal(h.location.hash, '#ritual'); assert.equal(h.window.scrollY, 0);
  h.api.ready(); await Promise.resolve(); h.flushFrames();
  assert.equal(h.window.scrollY, 2600);
});

test('a legacy material return waits for the model and resumes at the start of the new use sequence', async () => {
  const memory = new Map([['bamboo-journey-return-v1', JSON.stringify(saved({ chapter: 'materials', progress: .7, layout: undefined }))]]);
  const h = harness({ continuous: true, scroll: 0, memory, url: `${HOME}?resume=1` });
  assert.equal(h.window.scrollY, 0); h.api.ready(); await Promise.resolve(); h.flushFrames();
  assert.equal(h.window.scrollY, 2532);
});
