import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { chapterPosition, positionFromBookmark, normalizeChoice, validBookmark } from '../assets/journey.js';

const BASE = '/bamboo-shampoo-demo';
const HOME = `https://example.test${BASE}/en/`;
const production = fs.readFileSync(new URL('../assets/journey.js', import.meta.url), 'utf8');
const saved = overrides => ({ chapter: 'ritual', progress: .4, scroll: 3366, lang: 'en', viewportHeight: 844, viewportWidth: 390, ...overrides });

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

// Execute the complete production controller against a small standard-DOM
// surface. History traversals, native close events, and animation frames are
// separate queues, so a test cannot accidentally treat Back as synchronous.
// This harness checks state/control behavior; it does not claim native focus
// trapping, layout, browser touch arbitration, BFCache, or GPU validation.
function harness({ scroll = 312, state = null, url = HOME, memory = new Map(), main = true, storageBlocked = false } = {}) {
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
  const specs = [['discover', 0, 850], ['materials', 1000, 1050], ['ritual', 2100, 4000], ['collection', 6200, 1400], ['questions', 7700, 800]];
  const chapters = specs.map(([id, top, height]) => { const el = new Element('section', { id, 'data-journey-chapter': id }, mainEl || body); el.top = top; el.height = height; return el; });
  const trigger = new Element('a', { href: `${BASE}/en/products/bamboo/`, 'data-detour': 'product' }, chapters[0]);
  const dialog = new Element('dialog', { id: 'journey-dialog' }, body);
  const close = new Element('button', { 'data-detour-close': '' }, dialog);
  new Element('h2', { 'data-detour-title': '' }, dialog);
  const detailBody = new Element('div', { 'data-detour-body': '' }, dialog);
  const detailPanels = ['product', 'materials', 'refill', 'faq', 'inspect'].map(type => new Element('section', { 'data-detour-panel': type }, detailBody));
  const scent = new Element('a', { href: `${BASE}/en/products/aloe/`, 'data-scent-link': '' }, detailPanels[0]);
  const bag = new Element('dialog', { id: 'bag-dialog' }, body);
  const entries = [{ state: null, url: HOME }, { state, url }]; let index = 1;
  const history = {
    get state() { return entries[index].state; },
    pushState(value, unused, target) { entries.splice(index + 1); entries.push({ state: value, url: new URL(target, location.href).href }); index++; location.href = entries[index].url; },
    replaceState(value, unused, target) { entries[index] = { state: value, url: new URL(target, location.href).href }; location.href = entries[index].url; },
    back() { historyTasks.push(() => { if (!index) return; index--; location.href = entries[index].url; emit('popstate'); }); },
    forward() { historyTasks.push(() => { if (index === entries.length - 1) return; index++; location.href = entries[index].url; emit('popstate'); }); },
  };
  const context = vm.createContext({ document, window, location, history, URL, URLSearchParams,
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
  const modalChanges = [], detailCalls = [];
  const api = context.createJourney({ ui: { base: BASE, lang: 'en', names: { aloe: 'Aloe', argan: 'Argan', bamboo: 'Bamboo' }, scentDescriptions: {}, scentWords: {} },
    reduced: { matches: false }, onModal: value => { if (modalChanges.at(-1) !== value) modalChanges.push(value); },
    onDetail: (type, options, choice) => detailCalls.push({ type, options, choice }) });
  const flushMutations = () => { for (const o of observers) if (o.dirty) { o.dirty = false; o.callback(); } };
  const flushEvents = () => { while (tasks.length) tasks.shift()(); flushMutations(); };
  const flushHistory = () => { while (historyTasks.length) { historyTasks.shift()(); flushEvents(); } };
  const flushFrames = () => { const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback()); };
  const click = (target, options = {}) => { const event = { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...options };
    for (const callback of docListeners.get('click') || []) callback(event); return event; };
  return { api, click, document, window, location, history, trigger, dialog, bag, scent, chapters, modalChanges, detailCalls, memory,
    flushHistory, flushFrames, flushEvents, flushMutations, Element,
    choice: () => JSON.parse(JSON.stringify(api.getChoice())),
    resize(width, height) { window.innerWidth = context.innerWidth = width; window.innerHeight = context.innerHeight = height; emit('resize'); },
  };
}

test('product close uses one asynchronous Back and restores the exact scroll and originating focus', () => {
  const h = harness(); h.trigger.focus(); h.api.open('product', { trigger: h.trigger });
  assert.equal(h.dialog.open, true); assert.equal(h.api.isLocked(), true); assert.equal(h.document.body.style.top, '-312px');
  h.api.close(); assert.equal(h.dialog.open, true);
  h.flushHistory(); h.flushFrames();
  assert.equal(h.dialog.open, false); assert.equal(h.api.isLocked(), false);
  assert.equal(h.window.scrollY, 312); assert.equal(h.document.activeElement, h.trigger);
  assert.deepEqual(h.modalChanges, [true, false]);
});

test('Forward reopens the selected detail and Back returns to the unchanged origin', () => {
  const h = harness({ scroll: 3366 });
  h.api.open('inspect', { trigger: h.trigger, scent: 'aloe', format: 'refill' });
  h.api.close(); h.flushHistory(); h.flushFrames();
  h.history.forward(); h.flushHistory();
  assert.equal(h.dialog.dataset.detour, 'inspect'); assert.equal(h.dialog.open, true);
  assert.deepEqual(h.choice(), { scent: 'aloe', format: 'refill' });
  h.api.close(); h.flushHistory(); h.flushFrames(); assert.equal(h.window.scrollY, 3366); assert.equal(h.dialog.open, false);
});

test('switching details uses one history detour rather than forcing several closes', () => {
  const h = harness(); h.api.open('materials'); h.api.open('refill'); h.api.open('faq');
  assert.equal(h.dialog.dataset.detour, 'faq');
  h.api.close(); h.flushHistory(); assert.equal(h.dialog.open, false);
});

test('Escape closes through history once even when a second close arrives before Back completes', () => {
  const h = harness(); h.api.open('inspect');
  let prevented = false;
  h.dialog.dispatchEvent({ type: 'cancel', preventDefault() { prevented = true; } }); h.api.close();
  assert.equal(prevented, true); h.flushHistory(); h.flushFrames();
  assert.equal(h.dialog.open, false); assert.equal(h.location.href, HOME); assert.equal(h.window.scrollY, 312);
});

test('resizing inside a detour returns to the corresponding point in the same chapter', () => {
  const h = harness({ scroll: 3615 }); h.api.open('materials'); h.resize(844, 390);
  h.api.close(); h.flushHistory(); h.flushFrames();
  assert.equal(h.window.scrollY, 3842); assert.equal(h.document.querySelector('main[data-journey]').dataset.activeChapter, 'ritual');
});

test('a nested bag keeps background scrolling and viewers locked until the last modal closes', () => {
  const h = harness({ scroll: 3366 }); h.trigger.focus(); h.api.open('product', { trigger: h.trigger });
  h.bag.showModal(); h.flushMutations(); h.api.close(); h.flushHistory();
  assert.equal(h.dialog.open, false); assert.equal(h.bag.open, true); assert.equal(h.api.isLocked(), true);
  assert.deepEqual(h.modalChanges, [true]);
  h.bag.close(); h.flushEvents(); h.flushFrames();
  assert.equal(h.api.isLocked(), false); assert.equal(h.window.scrollY, 3366); assert.deepEqual(h.modalChanges, [true, false]);
});

test('ordinary scent selection stays in the panel and preserves the chosen format', () => {
  const h = harness(); h.api.open('product', { format: 'refill' });
  assert.equal(h.click(h.scent).defaultPrevented, true);
  assert.deepEqual(h.choice(), { scent: 'aloe', format: 'refill' }); assert.equal(h.dialog.open, true);
});

test('modified scent-anchor clicks preserve native new-tab/window behavior and current selection', () => {
  for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    const h = harness(); h.api.open('product');
    assert.equal(h.click(h.scent, { [modifier]: true }).defaultPrevented, false, modifier);
    assert.deepEqual(h.choice(), { scent: 'bamboo', format: 'shampoo' }, modifier);
  }
  const h = harness(); h.api.open('product'); h.scent.setAttribute('target', '_blank');
  assert.equal(h.click(h.scent).defaultPrevented, false);
});

test('a cold reload of an open-detour history state can subsequently open and close once', () => {
  const h = harness({ state: { bambooDetail: { type: 'product', scent: 'aloe', format: 'refill' } }, url: `${HOME}#detail-product` });
  if (!h.dialog.open) h.api.open('product');
  h.api.close(); h.flushHistory(); h.flushFrames();
  assert.equal(h.dialog.open, false); assert.equal(h.api.isLocked(), false);
  assert.ok(!h.history.state?.bambooDetail, 'the returned main entry must not still identify an open detail');
});

test('native-route anchors remain real navigation even from the journey', () => {
  const h = harness(); h.trigger.setAttribute('data-native-route', '');
  assert.equal(h.click(h.trigger).defaultPrevented, false); assert.equal(h.dialog.open, false);
});

test('blocked storage still permits local choice, inspection, and exact in-place return', () => {
  const h = harness({ storageBlocked: true, scroll: 3366 });
  h.api.select({ scent: 'argan', format: 'refill' }); h.api.open('inspect');
  assert.deepEqual(h.choice(), { scent: 'argan', format: 'refill' });
  h.api.close(); h.flushHistory(); h.flushFrames();
  assert.equal(h.dialog.open, false); assert.equal(h.window.scrollY, 3366);
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
