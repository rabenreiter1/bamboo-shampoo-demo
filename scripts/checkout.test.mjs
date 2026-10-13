import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sanitizeCart } from '../assets/catalog.js';
import { CHECKOUT_STEPS, createCheckoutState, restoreCheckoutState, normalizeDemoReceipt, reduceCheckout, checkoutTotals, checkoutCartFingerprint,
  updateCheckoutQuantity, removeCheckoutItem } from '../assets/checkout-state.js';
import { initializeCheckout } from '../assets/checkout.js';
import { createCheckoutPage } from './checkout-page.mjs';

const mixed = () => [{ scent: 'aloe', format: 'shampoo', quantity: 2 }, { scent: 'argan', format: 'refill', quantity: 3 }];
const advanceToReview = cart => CHECKOUT_STEPS.slice(1).reduce(state => reduceCheckout(state, { type: 'next' }), createCheckoutState(cart));
const submit = state => reduceCheckout(reduceCheckout(state, { type: 'accept', value: true }), { type: 'submit' });

test('checkout totals use authoritative mixed-format prices, quantity and integer cents', () => {
  assert.deepEqual(checkoutTotals(mixed()), { count: 5, subtotal: 3850, shipping: 0, total: 3850 });
  assert.deepEqual(checkoutTotals([{ scent: 'bamboo', format: 'refill', quantity: 2, price: 1 }]), { count: 2, subtotal: 900, shipping: 0, total: 900 });
});

test('untrusted cart values cannot create unoffered products or alter prices', () => {
  const cart = [...mixed(), null, { scent: 'aloe', format: 'cap', quantity: 9 }, { scent: 'other', format: 'shampoo', quantity: 2 }, { scent: 'aloe', format: 'refill', quantity: -1 }];
  assert.deepEqual(createCheckoutState(cart).cart, mixed());
});

test('empty checkout cannot skip ahead, approve or submit', () => {
  let state = createCheckoutState([]);
  for (const event of [{ type: 'next' }, { type: 'step', step: 'review' }, { type: 'accept', value: true }, { type: 'submit' }, { type: 'complete', reference: 'DEMO-X' }]) state = reduceCheckout(state, event);
  assert.equal(state.step, 'selection');
  assert.equal(state.accepted, false);
  assert.equal(state.receipt, null);
});

test('forward navigation visits all four steps and only visited steps allow editing', () => {
  let state = createCheckoutState(mixed());
  assert.equal(reduceCheckout(state, { type: 'step', step: 'payment' }), state);
  for (const step of CHECKOUT_STEPS.slice(1)) {
    state = reduceCheckout(state, { type: 'next' });
    assert.equal(state.step, step);
  }
  state = reduceCheckout(state, { type: 'step', step: 'delivery' });
  assert.equal(state.step, 'delivery');
  assert.equal(reduceCheckout(state, { type: 'step', step: 'review' }).step, 'review');
});

test('review requires an explicit simulation acknowledgement', () => {
  const state = advanceToReview(mixed());
  assert.equal(reduceCheckout(state, { type: 'submit' }), state);
  assert.equal(reduceCheckout(state, { type: 'complete' }), state);
  assert.equal(submit(state).submitting, true);
});

test('cart changes invalidate acknowledgement and pending completion', () => {
  const pending = submit(advanceToReview(mixed()));
  const changed = reduceCheckout(pending, { type: 'cart', cart: [{ scent: 'aloe', format: 'refill', quantity: 4 }] });
  assert.equal(changed.accepted, false);
  assert.equal(changed.submitting, false);
  assert.equal(reduceCheckout(changed, { type: 'complete' }).receipt, null);
  assert.equal(checkoutTotals(changed.cart).total, 1800);
});

test('emptying the bag returns to selection and clears visited progression', () => {
  const state = reduceCheckout(submit(advanceToReview(mixed())), { type: 'cart', cart: [] });
  assert.equal(state.step, 'selection');
  assert.equal(state.furthest, 0);
  assert.equal(state.accepted, false);
  assert.equal(state.submitting, false);
});

test('delivery and payment edits preserve cart but require renewed review', () => {
  let state = reduceCheckout(advanceToReview(mixed()), { type: 'accept', value: true });
  state = reduceCheckout(state, { type: 'delivery', value: 'pickup' });
  state = reduceCheckout(state, { type: 'payment', value: 'wallet' });
  assert.equal(state.delivery, 'pickup');
  assert.equal(state.payment, 'wallet');
  assert.equal(state.accepted, false);
  assert.deepEqual(state.cart, mixed());
  assert.equal(reduceCheckout(state, { type: 'payment', value: 'real-payment' }), state);
});

test('revisiting an earlier step clears stale acknowledgement', () => {
  const accepted = reduceCheckout(advanceToReview(mixed()), { type: 'accept', value: true });
  const edited = reduceCheckout(accepted, { type: 'step', step: 'selection' });
  assert.equal(edited.accepted, false);
  assert.equal(edited.step, 'selection');
});

test('pending completion locks edits and rejects a repeated submit', () => {
  const pending = submit(advanceToReview(mixed()));
  for (const event of [{ type: 'next' }, { type: 'step', step: 'selection' }, { type: 'payment', value: 'wallet' }, { type: 'submit' }]) assert.equal(reduceCheckout(pending, event), pending);
  assert.equal(reduceCheckout(pending, { type: 'cancel' }).submitting, false);
});

test('receipt snapshots are isolated from cart clearing and contain no customer data', () => {
  const cart = mixed();
  const pending = submit(advanceToReview(cart));
  const complete = reduceCheckout(pending, { type: 'complete', reference: '<DEMO-ABC>', createdAt: '2026-10-13T15:00:00Z' });
  const cleared = reduceCheckout(complete, { type: 'cart', cart: [] });
  cart[0].quantity = 20;
  assert.equal(cleared.step, 'complete');
  assert.equal(cleared.receipt.reference, 'DEMO-ABC');
  assert.equal(cleared.receipt.total, 3850);
  assert.equal(cleared.receipt.items[0].quantity, 2);
  assert.equal(cleared.receipt.simulation, true);
  assert.deepEqual(Object.keys(cleared.receipt).sort(), ['createdAt', 'delivery', 'items', 'payment', 'reference', 'shipping', 'simulation', 'subtotal', 'total']);
  assert.throws(() => { cleared.receipt.items[0].quantity = 9; }, TypeError);
});

test('a completed run cannot submit or create another receipt', () => {
  const complete = reduceCheckout(submit(advanceToReview(mixed())), { type: 'complete', reference: 'DEMO-ONE' });
  for (const event of [{ type: 'submit' }, { type: 'complete', reference: 'DEMO-TWO' }, { type: 'step', step: 'selection' }]) assert.equal(reduceCheckout(complete, event), complete);
});

test('quantity edits constrain catalog quantities without modifying their input', () => {
  const cart = mixed();
  assert.equal(updateCheckoutQuantity(cart, 'aloe:shampoo', 999)[0].quantity, 20);
  assert.equal(updateCheckoutQuantity(cart, 'aloe:shampoo', -5)[0].quantity, 1);
  assert.equal(updateCheckoutQuantity(cart, 'aloe:shampoo', 2.9)[0].quantity, 2);
  for (const value of ['', NaN, Infinity, 'bad']) assert.deepEqual(updateCheckoutQuantity(cart, 'aloe:shampoo', value), cart);
  assert.equal(cart[0].quantity, 2);
  assert.deepEqual(updateCheckoutQuantity(cart, 'other:cap', 5), cart);
});

test('remove and cart fingerprint preserve distinct formats and ignore row ordering', () => {
  const cart = [...mixed(), { scent: 'aloe', format: 'refill', quantity: 2 }];
  assert.deepEqual(removeCheckoutItem(cart, 'aloe:shampoo'), cart.slice(1));
  assert.equal(checkoutCartFingerprint(cart), checkoutCartFingerprint([...cart].reverse()));
});

test('both localized templates have one heading, native collection links and no real data collection', () => {
  for (const lang of ['de', 'en']) {
    const html = createCheckoutPage({ BASE: '/bamboo-shampoo-demo', lang, icon: () => '<svg></svg>', esc: value => String(value).replaceAll('"', '&quot;') });
    assert.equal((html.match(/<main\b/g) || []).length, 1);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.match(html, /data-checkout-root/);
    assert.match(html, new RegExp(`href="/bamboo-shampoo-demo/${lang}/shop/"`));
    for (const step of [...CHECKOUT_STEPS, 'complete']) assert.match(html, new RegExp(`data-checkout-panel="${step}"`));
    assert.ok(!/<input[^>]+(?:type="(?:email|password|tel)"|name="(?:address|card|email))/.test(html));
    assert.ok(!/<form[^>]+action=|<iframe|<dialog/.test(html));
    assert.match(html, lang === 'de' ? /Keine Bestellung\. Keine Zahlung/ : /No orders\. No payments/);
  }
});

test('checkout has no network, payment-provider or permanent storage dependency', () => {
  const source = fs.readFileSync(new URL('../assets/checkout.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|sendBeacon|localStorage)\s*(?:\.|\()/);
  assert.doesNotMatch(source, /https?:\/\//);
});

test('restored demo receipts whitelist fields and recompute authoritative totals', () => {
  const original = reduceCheckout(submit(advanceToReview(mixed())), { type: 'complete', reference: 'DEMO-VALID' }).receipt;
  const restored = normalizeDemoReceipt({ ...original, total: 1, shipping: 999, email: 'example@example.test', address: { street: 'Ignored' } });
  assert.equal(restored.total, 3850);
  assert.equal(restored.shipping, 0);
  assert.equal(Object.hasOwn(restored, 'email'), false);
  assert.equal(Object.hasOwn(restored, 'address'), false);
  assert.equal(restoreCheckoutState([], restored).step, 'complete');
  assert.equal(restoreCheckoutState(mixed(), restored).step, 'selection', 'a new bag takes priority over a previous demo');
  for (const value of [null, {}, { ...original, reference: '<bad>' }, { ...original, items: [] }, { ...original, payment: 'actual-card' }]) assert.equal(normalizeDemoReceipt(value), null);
});

// A minimal browser surface executes the actual controller. These checks cover
// bag callbacks, focus/navigation and asynchronous duplicate/race protection.
class Element {
  constructor(tag = 'div', attributes = {}) {
    this.tagName = tag.toUpperCase(); this.attrs = new Map(Object.entries(attributes)); this.dataset = {};
    for (const [name, value] of this.attrs) if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    this.disabled = false; this.hidden = false; this.checked = false; this.textContent = ''; this.innerHTML = ''; this.children = new Map();
  }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  closest(selector) {
    if (selector === 'button') return this.tagName === 'BUTTON' ? this : null;
    if (selector === '.checkout-steps') return this.inSteps ? this : null;
    if (selector === '[data-checkout-key]') return this.item || null;
    return null;
  }
  querySelector(selector) {
    if (!this.children.has(selector)) this.children.set(selector, new Element('span'));
    return this.children.get(selector);
  }
  focus() { this.focused = true; }
  getBoundingClientRect() { return { top: 100, height: 80 }; }
}

function harness({ cart = mixed(), delay = 0, storage } = {}) {
  let current = sanitizeCart(cart);
  const callbacks = [], listeners = new Map(), nodes = new Map();
  const node = selector => { if (!nodes.has(selector)) nodes.set(selector, new Element()); return nodes.get(selector); };
  const stepButtons = CHECKOUT_STEPS.map(step => { const button = new Element('button', { 'data-checkout-step': step }); button.inSteps = true; return button; });
  const panels = [...CHECKOUT_STEPS, 'complete'].map(step => new Element('section', { 'data-checkout-panel': step }));
  const view = { scrollY: 0, addEventListener: (name, handler) => listeners.set(`view:${name}`, handler), removeEventListener: name => listeners.delete(`view:${name}`),
    scrollTo: options => { view.lastScroll = options; }, matchMedia: () => ({ matches: true }), crypto: { getRandomValues: bytes => { bytes.fill(7); return bytes; } } };
  const root = new Element('main');
  root.ownerDocument = { defaultView: view, querySelector: selector => node(selector) };
  root.contains = () => true;
  root.querySelector = selector => node(selector);
  root.querySelectorAll = selector => selector === '[data-checkout-panel]' ? panels : selector === '[data-checkout-step]' ? stepButtons
    : selector.startsWith('input[name=') || selector === '[data-checkout-nonempty]' ? [] : [node(selector)];
  root.addEventListener = (name, handler) => listeners.set(name, handler);
  root.removeEventListener = name => listeners.delete(name);
  let api;
  api = initializeCheckout({ root, lang: 'en', base: '/bamboo-shampoo-demo', getCart: () => current, completionDelay: delay, receiptStore: storage,
    onCartChange(next) { current = sanitizeCart(next); api.syncCart(); },
    onComplete(receipt) { callbacks.push(receipt); current = []; api.syncCart(); } });
  const click = (attr, value = '') => {
    const element = new Element('button', { [attr]: value });
    listeners.get('click')?.({ target: element });
  };
  const accept = () => {
    const element = new Element('input', { 'data-checkout-accept': '' }); element.checked = true;
    listeners.get('change')?.({ target: element });
  };
  const review = () => { click('data-checkout-next'); click('data-checkout-next'); click('data-checkout-next'); };
  return { api, root, view, callbacks, nodes, listeners, click, accept, review,
    external(next) { current = sanitizeCart(next); api.syncCart(); }, getCart: () => current };
}

const settle = ms => new Promise(resolve => setTimeout(resolve, ms));

test('controller executes full checkout once, clears the shared bag and retains receipt totals', async () => {
  const h = harness(); h.review(); h.accept();
  h.click('data-checkout-submit'); h.click('data-checkout-submit');
  await settle(15);
  assert.equal(h.callbacks.length, 1);
  assert.deepEqual(h.getCart(), []);
  assert.equal(h.api.getState().step, 'complete');
  assert.equal(h.nodes.get('[data-checkout-total]').textContent, '€38.50');
  assert.equal(h.nodes.get('[data-checkout-reference]').textContent, 'DEMO-07070707');
  assert.equal(h.nodes.get('[data-checkout-panel="complete"] h2').focused, true);
  assert.equal(h.view.lastScroll.behavior, 'auto', 'reduced motion avoids smooth navigation');
  h.api.destroy();
});

test('controller prevents a stale pending completion after an external bag edit', async () => {
  const h = harness({ delay: 30 }); h.review(); h.accept(); h.click('data-checkout-submit');
  h.external([{ scent: 'bamboo', format: 'refill', quantity: 2 }]);
  await settle(45);
  assert.equal(h.callbacks.length, 0);
  assert.equal(h.api.getState().submitting, false);
  assert.equal(h.api.getState().accepted, false);
  assert.equal(h.api.getState().step, 'review');
  h.accept(); h.click('data-checkout-submit'); await settle(45);
  assert.equal(h.callbacks.length, 1);
  assert.equal(h.callbacks[0].total, 900);
  h.api.destroy();
});

test('empty bag synchronization and controller destruction cancel pending completion', async () => {
  const h = harness({ delay: 20 }); h.review(); h.accept(); h.click('data-checkout-submit');
  h.external([]); await settle(30);
  assert.equal(h.api.getState().step, 'selection');
  assert.equal(h.callbacks.length, 0);
  const other = harness({ delay: 20 }); other.review(); other.accept(); other.click('data-checkout-submit');
  other.api.destroy(); await settle(30);
  assert.equal(other.callbacks.length, 0);
  assert.equal(other.listeners.has('click'), false);
  h.api.destroy();
});

test('pagehide cancels simulation until the visitor deliberately reviews again', async () => {
  const h = harness({ delay: 20 }); h.review(); h.accept(); h.click('data-checkout-submit');
  h.listeners.get('view:pagehide')(); await settle(30);
  assert.equal(h.callbacks.length, 0);
  assert.equal(h.api.getState().accepted, false);
  assert.equal(h.api.getState().submitting, false);
  h.api.destroy();
});

function receiptStore() {
  const memory = new Map();
  return { memory, getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
}

test('a completed demo survives cold reload without repeating completion or retaining customer data', async () => {
  const storage = receiptStore();
  const first = harness({ storage }); first.review(); first.accept(); first.click('data-checkout-submit'); await settle(15);
  assert.equal(storage.memory.size, 1);
  const saved = JSON.parse(storage.memory.get('bamboo-demo-receipt-v1'));
  assert.deepEqual(Object.keys(saved).sort(), ['createdAt', 'delivery', 'items', 'payment', 'reference', 'shipping', 'simulation', 'subtotal', 'total']);
  first.api.destroy();
  const reloaded = harness({ cart: [], storage });
  assert.equal(reloaded.api.getState().step, 'complete');
  assert.equal(reloaded.nodes.get('[data-checkout-total]').textContent, '€38.50');
  reloaded.click('data-checkout-submit'); await settle(10);
  assert.equal(reloaded.callbacks.length, 0);
  reloaded.api.destroy();
});

test('a new bag invalidates an earlier receipt on both live update and cold navigation', async () => {
  const storage = receiptStore();
  const first = harness({ storage }); first.review(); first.accept(); first.click('data-checkout-submit'); await settle(15);
  first.external([{ scent: 'bamboo', format: 'refill', quantity: 1 }]);
  assert.equal(first.api.getState().step, 'selection');
  assert.equal(first.api.getState().receipt, null);
  assert.equal(storage.memory.size, 0);
  assert.equal(first.nodes.get('.checkout-steps').hidden, false);
  assert.match(first.nodes.get('.checkout-summary__note').textContent, /€0\.00 delivery/);
  first.api.destroy();
  const completed = harness({ storage }); completed.review(); completed.accept(); completed.click('data-checkout-submit'); await settle(15);
  completed.api.destroy();
  const newBag = harness({ cart: [{ scent: 'aloe', format: 'shampoo', quantity: 1 }], storage });
  assert.equal(newBag.api.getState().step, 'selection');
  assert.equal(storage.memory.size, 0);
  newBag.api.destroy();
});

test('pending acknowledgement and submission never persist, and storage denial remains usable', async () => {
  const storage = receiptStore();
  const pending = harness({ storage, delay: 30 }); pending.review(); pending.accept(); pending.click('data-checkout-submit');
  assert.equal(storage.memory.size, 0);
  pending.api.destroy();
  const denied = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const local = harness({ storage: denied }); local.review(); local.accept(); local.click('data-checkout-submit'); await settle(15);
  assert.equal(local.api.getState().step, 'complete');
  assert.equal(local.callbacks.length, 1);
  assert.deepEqual(local.getCart(), []);
  local.api.destroy();
});
