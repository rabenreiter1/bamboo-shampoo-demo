import {productPhotoAsset} from './product-photos.js?v=modern-20261016-1';
import { formatPrice, prices, productKey, sanitizeCart } from './catalog.js';
import { CHECKOUT_STEPS, restoreCheckoutState, normalizeDemoReceipt, reduceCheckout, checkoutTotals, checkoutCartFingerprint,
  updateCheckoutQuantity, removeCheckoutItem } from './checkout-state.js';

const names = Object.freeze({ aloe: 'Aloe', argan: 'Argan', bamboo: 'Bamboo' });
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const icon = name => `<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">${name === 'minus' ? '<path d="M5 12h14"/>' : '<path d="M5 12h14M12 5v14"/>'}</svg>`;

/**
 * The shared shop owns the bag. This controller owns only demo checkout state.
 * Call syncCart() after shared bag changes; onComplete(receipt) clears that bag.
 * Receipts retain only catalog lines and demo method IDs for this browser
 * session. No personal details, network requests or payment providers.
 */
export function initializeCheckout({
  root = globalThis.document?.querySelector('[data-checkout-root]'), lang = 'de', base = '', routeBase = base,
  getCart = () => [], onCartChange = () => {}, onComplete = () => {}, completionDelay = 420, receiptStore
} = {}) {
  if (!root) return null;
  const de = lang === 'de';
  const text = (german, english) => de ? german : english;
  const price = cents => formatPrice(cents, lang);
  const doc = root.ownerDocument || globalThis.document;
  const view = doc?.defaultView || globalThis.window;
  const all = selector => [...root.querySelectorAll(selector)];
  const one = selector => root.querySelector(selector);
  const write = (selector, value) => all(selector).forEach(element => { element.textContent = value; });
  const html = (selector, value) => all(selector).forEach(element => { element.innerHTML = value; });
  let destroyed = false, completionTimer = null, submissionEpoch = 0;
  const readCart = () => {
    try { return sanitizeCart(getCart()); } catch { return []; }
  };
  const RECEIPT_KEY = 'bamboo-demo-receipt-v1';
  const receiptStorage = (() => {
    try { return receiptStore === undefined ? view?.sessionStorage : receiptStore; } catch { return null; }
  })();
  function discardReceipt() {
    try { receiptStorage?.removeItem(RECEIPT_KEY); } catch { /* Page-local confirmation still works. */ }
  }
  function savedReceipt() {
    try { return normalizeDemoReceipt(JSON.parse(receiptStorage?.getItem(RECEIPT_KEY) || 'null')); } catch { return null; }
  }
  function retainReceipt(receipt) {
    try { receiptStorage?.setItem(RECEIPT_KEY, JSON.stringify(normalizeDemoReceipt(receipt))); } catch { /* Storage is optional. */ }
  }
  let state = restoreCheckoutState(readCart(), savedReceipt());
  if (!state.receipt) discardReceipt();

  const label = format => format === 'refill' ? 'Refill' : text('Starter-Set', 'Starter Set');
  const productURL = item => `${routeBase}/${lang}/products/${item.scent}/${item.format === 'refill' ? '?format=refill' : ''}`;
  const imageURL = item => `${base}/assets/${productPhotoAsset(item.format === 'refill' ? 'refill' : 'product',item.scent,true)}`;
  const deliveryLabel = id => id === 'pickup' ? text('Beispiel-Abholpunkt', 'Sample pickup point') : text('Beispieladresse', 'Sample address');
  const paymentLabel = id => id === 'wallet' ? 'Demo-Wallet' : text('Demo-Karte · •••• 4242', 'Demo card · •••• 4242');
  const address = id => id === 'pickup'
    ? text('Bamboo Demo-Station<br>Musterallee 8<br>10115 Berlin', 'Bamboo demo station<br>8 Sample Avenue<br>10115 Berlin')
    : text('Alex Beispiel<br>Musterstraße 12<br>10115 Berlin', 'Alex Example<br>12 Sample Street<br>10115 Berlin');

  function announce(message) { write('[data-checkout-status]', message); }

  function lineItem(item) {
    const key = productKey(item.scent, item.format);
    const name = `${names[item.scent]} ${label(item.format)}`;
    return `<article class="checkout-line" data-checkout-key="${key}">
      <a class="checkout-line__art scent-${item.scent}" href="${productURL(item)}" data-native-route aria-label="${escape(text(`${name} ansehen`, `View ${name}`))}"><img src="${imageURL(item)}" alt="${escape(name)}" width="112" height="140" loading="lazy" decoding="async"></a>
      <div class="checkout-line__copy"><a href="${productURL(item)}" data-native-route><h3>${names[item.scent]}</h3></a><p>${label(item.format)} · 250 ml</p><small>${price(prices[item.format])} ${text('pro Stück', 'each')}</small>
        <div class="checkout-line__controls"><div class="checkout-quantity"><button type="button" data-checkout-quantity="-1" aria-label="${escape(text(`${name}: Menge reduzieren`, `${name}: decrease quantity`))}" ${item.quantity <= 1 ? 'disabled' : ''}>${icon('minus')}</button><input type="number" min="1" max="20" step="1" inputmode="numeric" value="${item.quantity}" data-checkout-number aria-label="${escape(text(`Menge: ${name}`, `Quantity: ${name}`))}"><button type="button" data-checkout-quantity="1" aria-label="${escape(text(`${name}: Menge erhöhen`, `${name}: increase quantity`))}" ${item.quantity >= 20 ? 'disabled' : ''}>${icon('plus')}</button></div><button type="button" class="checkout-remove" data-checkout-remove>${text('Entfernen', 'Remove')}</button></div>
      </div><strong class="checkout-line__amount">${price(prices[item.format] * item.quantity)}</strong>
    </article>`;
  }

  function reviewItems(items) {
    return `<ul class="checkout-review-list">${items.map(item => `<li><span><strong>${names[item.scent]}</strong><small>${label(item.format)} · 250 ml · ${item.quantity} ${text('Stück', item.quantity === 1 ? 'item' : 'items')}</small></span><span>${price(prices[item.format] * item.quantity)}</span></li>`).join('')}</ul>`;
  }

  function summaryPreview(items) {
    return items.map(item => `<div class="checkout-summary-product scent-${item.scent}"><img src="${imageURL(item)}" alt="" width="44" height="55" loading="lazy" decoding="async"><span><strong>${names[item.scent]}</strong><small>${item.quantity} × ${label(item.format)} · 250 ml</small></span></div>`).join('');
  }

  function render({ focus = false } = {}) {
    if (destroyed) return;
    const completed = !!state.receipt;
    const items = completed ? state.receipt.items : state.cart;
    const totals = completed ? state.receipt : checkoutTotals(items);
    root.dataset.checkoutStep = state.step;
    root.dataset.checkoutBusy = String(state.submitting);
    one('.checkout-steps').hidden = completed;
    for (const panel of all('[data-checkout-panel]')) panel.hidden = panel.dataset.checkoutPanel !== state.step;
    for (const control of all('[data-checkout-step]')) {
      const index = CHECKOUT_STEPS.indexOf(control.dataset.checkoutStep);
      control.disabled = completed || state.submitting || index > state.furthest || index > 0 && !state.cart.length;
      if (control.closest('.checkout-steps') && control.dataset.checkoutStep === state.step) control.setAttribute('aria-current', 'step');
      else control.removeAttribute('aria-current');
    }
    html('[data-checkout-items]', state.cart.map(lineItem).join(''));
    one('[data-checkout-empty]').hidden = !!state.cart.length;
    all('[data-checkout-nonempty]').forEach(element => { element.hidden = !state.cart.length; });
    write('[data-checkout-subtotal]', price(totals.subtotal));
    write('[data-checkout-shipping]', price(totals.shipping));
    write('[data-checkout-total]', price(totals.total));
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    write('[data-checkout-count]', `${count} ${text(count === 1 ? 'Artikel' : 'Artikel', count === 1 ? 'item' : 'items')}`);
    html('[data-checkout-summary-preview]', summaryPreview(items));
    html('[data-checkout-address]', address(state.delivery));
    html('[data-checkout-review-items]', reviewItems(state.cart));
    html('[data-checkout-review-delivery]', `${deliveryLabel(state.delivery)} · ${price(0)}<br>${address(state.delivery)}`);
    write('[data-checkout-review-payment]', paymentLabel(state.payment));
    all('input[name="demo-delivery"]').forEach(input => { input.checked = input.value === state.delivery; input.disabled = state.submitting; });
    all('input[name="demo-payment"]').forEach(input => { input.checked = input.value === state.payment; input.disabled = state.submitting; });
    const accept = one('[data-checkout-accept]');
    accept.checked = state.accepted;
    accept.disabled = state.submitting;
    const submit = one('[data-checkout-submit]');
    submit.disabled = !state.accepted || state.submitting || completed || !state.cart.length;
    submit.setAttribute('aria-busy', String(state.submitting));
    submit.querySelector('span').textContent = state.submitting
      ? text('Demo wird abgeschlossen…', 'Completing demo…') : text('Demo abschließen', 'Complete demo');
    write('[data-checkout-reference]', state.receipt?.reference || '');
    if (completed) one('.checkout-summary').setAttribute('aria-label', text('Zusammenfassung der abgeschlossenen Demo', 'Completed demo summary'));
    else one('.checkout-summary').removeAttribute('aria-label');
    one('.checkout-summary__note').textContent = completed
      ? text('Diese Zusammenfassung gehört zur Design-Simulation. Es wurde nichts bestellt oder bezahlt.', 'This summary belongs to the design simulation. Nothing was ordered or paid for.')
      : text('Reine Design-Simulation. Zustellung mit 0,00 € illustriert den Ablauf und ist kein Versandangebot.', 'A design simulation. The €0.00 delivery charge illustrates the flow and is not a shipping offer.');
    if (focus) {
      const heading = one(`[data-checkout-panel="${state.step}"] h2`);
      heading?.focus({ preventScroll: true });
      const flow = one('.checkout-flow');
      if (flow && view?.scrollTo) {
        const headerHeight = doc?.querySelector('.header')?.getBoundingClientRect().height || 80;
        view.scrollTo({ top: Math.max(0, flow.getBoundingClientRect().top + view.scrollY - headerHeight - 20),
          behavior: view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }
  }

  function syncCart({ announceChange = true } = {}) {
    if (destroyed) return;
    const next = reduceCheckout(state, { type: 'cart', cart: readCart() });
    if (next === state) return;
    if (state.submitting && !next.submitting) {
      submissionEpoch++;
      if (completionTimer !== null) clearTimeout(completionTimer);
      completionTimer = null;
    }
    const stepChanged = next.step !== state.step;
    if (state.receipt && !next.receipt) discardReceipt();
    state = next;
    render({ focus: stepChanged });
    if (!state.receipt && announceChange) announce(text('Deine Auswahl wurde aktualisiert. Prüfe sie vor dem Demo-Abschluss erneut.', 'Your selection has changed. Review it again before completing the demo.'));
  }

  function changeCart(nextCart, { key, focusSelector } = {}) {
    if (state.submitting || state.receipt) return;
    const previous = state;
    state = reduceCheckout(state, { type: 'cart', cart: nextCart });
    try { onCartChange(sanitizeCart(nextCart)); } catch {
      state = previous; syncCart({ announceChange: false }); render();
      announce(text('Die Auswahl konnte nicht aktualisiert werden. Bitte versuche es erneut.', 'The selection could not be updated. Please try again.'));
      return;
    }
    syncCart({ announceChange: false });
    render();
    const item = key && one(`[data-checkout-key="${key}"]`);
    const focus = item?.querySelector(`${focusSelector}:not(:disabled)`) || item?.querySelector('[data-checkout-number]')
      || one('[data-checkout-remove]') || one('[data-checkout-empty] a');
    focus?.focus({ preventScroll: true });
    announce(text(`Auswahl aktualisiert. Gesamtsumme ${price(checkoutTotals(state.cart).total)}.`, `Selection updated. Total ${price(checkoutTotals(state.cart).total)}.`));
  }

  function reference() {
    const bytes = new Uint8Array(4);
    if (view?.crypto?.getRandomValues) view.crypto.getRandomValues(bytes);
    else {
      const n = Date.now() % 0xffffffff;
      for (let i = 0; i < bytes.length; i++) bytes[i] = n >>> i * 8 & 255;
    }
    return `DEMO-${[...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  }

  function submitDemo() {
    if (destroyed || state.submitting || state.receipt) return;
    const current = readCart();
    if (checkoutCartFingerprint(current) !== checkoutCartFingerprint(state.cart)) { syncCart(); return; }
    const pending = reduceCheckout(state, { type: 'submit' });
    if (pending === state) return;
    state = pending;
    const epoch = ++submissionEpoch;
    render();
    announce(text('Die Demo wird abgeschlossen. Es erfolgt keine Zahlung.', 'Completing the demo. No payment will be made.'));
    completionTimer = setTimeout(() => {
      completionTimer = null;
      if (destroyed || !state.submitting || epoch !== submissionEpoch) return;
      if (checkoutCartFingerprint(readCart()) !== checkoutCartFingerprint(state.cart)) { syncCart(); return; }
      state = reduceCheckout(state, { type: 'complete', reference: reference(), createdAt: new Date().toISOString() });
      const receipt = state.receipt;
      retainReceipt(receipt);
      render({ focus: true });
      announce(text('Demo abgeschlossen. Keine Bestellung und keine Zahlung. Deine Auswahl wurde für die Simulation geleert.', 'Demo complete. No order and no payment. Your bag has been cleared for this simulation.'));
      // Completion is recorded before the shared bag callback, so a synchronous
      // save()->syncCart() or repeated click cannot submit twice or lose receipt.
      try {
        Promise.resolve(onComplete(receipt)).catch(() => {
          if (!destroyed) announce(text('Demo abgeschlossen. Deine Tasche konnte nicht geleert werden.', 'Demo complete. Your bag could not be cleared.'));
        });
      } catch {
        announce(text('Demo abgeschlossen. Deine Tasche konnte nicht geleert werden.', 'Demo complete. Your bag could not be cleared.'));
      }
    }, Math.max(0, Math.min(1200, Number(completionDelay) || 0)));
  }

  function onClick(event) {
    const target = event.target.closest('button');
    if (!target || !root.contains(target) || target.disabled) return;
    if (target.hasAttribute('data-checkout-submit')) { submitDemo(); return; }
    if (target.hasAttribute('data-checkout-next') || target.hasAttribute('data-checkout-step')) {
      const next = reduceCheckout(state, target.hasAttribute('data-checkout-next') ? { type: 'next' } : { type: 'step', step: target.dataset.checkoutStep });
      if (next !== state) { state = next; render({ focus: true }); announce(text(`Schritt ${CHECKOUT_STEPS.indexOf(state.step) + 1} von 4.`, `Step ${CHECKOUT_STEPS.indexOf(state.step) + 1} of 4.`)); }
      return;
    }
    if (target.hasAttribute('data-checkout-remove') || target.hasAttribute('data-checkout-quantity')) {
      const item = target.closest('[data-checkout-key]');
      const key = item?.dataset.checkoutKey;
      if (!key) return;
      if (target.hasAttribute('data-checkout-remove')) changeCart(removeCheckoutItem(state.cart, key), { key, focusSelector: '[data-checkout-remove]' });
      else {
        const row = state.cart.find(value => productKey(value.scent, value.format) === key);
        if (row) changeCart(updateCheckoutQuantity(state.cart, key, row.quantity + Number(target.dataset.checkoutQuantity)),
          { key, focusSelector: `[data-checkout-quantity="${target.dataset.checkoutQuantity}"]` });
      }
    }
  }

  function onChange(event) {
    const target = event.target;
    if (state.submitting || state.receipt) return;
    if (target.hasAttribute('data-checkout-number')) {
      const key = target.closest('[data-checkout-key]')?.dataset.checkoutKey;
      if (key) changeCart(updateCheckoutQuantity(state.cart, key, target.value), { key, focusSelector: '[data-checkout-number]' });
    } else if (target.name === 'demo-delivery' || target.name === 'demo-payment') {
      state = reduceCheckout(state, { type: target.name === 'demo-delivery' ? 'delivery' : 'payment', value: target.value });
      // Updating selection preserves radio focus after rendering.
      render(); target.focus({ preventScroll: true });
    } else if (target.hasAttribute('data-checkout-accept')) {
      state = reduceCheckout(state, { type: 'accept', value: target.checked }); render();
      one('[data-checkout-accept]').focus({ preventScroll: true });
    }
  }

  function cancelPending() {
    submissionEpoch++;
    if (completionTimer !== null) { clearTimeout(completionTimer); completionTimer = null; }
    if (state.submitting) { state = reduceCheckout(state, { type: 'cancel' }); render(); }
  }

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  view?.addEventListener('pagehide', cancelPending);
  render();
  return {
    syncCart,
    // A read-only diagnostic snapshot is useful for integration and does not
    // expose customer data; the state contains only catalog choices and IDs.
    getState: () => state,
    destroy() {
      cancelPending(); destroyed = true;
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      view?.removeEventListener('pagehide', cancelPending);
    }
  };
}
