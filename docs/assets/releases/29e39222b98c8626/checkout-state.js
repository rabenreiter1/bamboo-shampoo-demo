import { sanitizeCart, cartTotal, productKey } from './catalog.js';

export const CHECKOUT_STEPS = Object.freeze(['selection', 'delivery', 'payment', 'review']);
export const DEMO_DELIVERY = Object.freeze(['standard', 'pickup']);
export const DEMO_PAYMENT = Object.freeze(['card', 'wallet']);

// All money stays in integer cents. The zero delivery charge is an illustration,
// not a shipping policy. There are no customer details or payment credentials.
export function checkoutTotals(input) {
  const cart = sanitizeCart(input);
  const subtotal = cartTotal(cart);
  return { count: cart.reduce((sum, item) => sum + item.quantity, 0), subtotal, shipping: 0, total: subtotal };
}

export function checkoutCartFingerprint(input) {
  return JSON.stringify(sanitizeCart(input).sort((a, b) => productKey(a.scent, a.format).localeCompare(productKey(b.scent, b.format))));
}

export function updateCheckoutQuantity(input, key, value) {
  const cart = sanitizeCart(input);
  const row = cart.find(item => productKey(item.scent, item.format) === key);
  if (!row || typeof value === 'string' && !value.trim() || !Number.isFinite(Number(value))) return cart;
  row.quantity = Math.min(20, Math.max(1, Math.floor(Number(value))));
  return cart;
}

export function removeCheckoutItem(input, key) {
  return sanitizeCart(input).filter(item => productKey(item.scent, item.format) !== key);
}

export function createCheckoutState(cart = []) {
  return { cart: sanitizeCart(cart), step: 'selection', furthest: 0, delivery: 'standard', payment: 'card', accepted: false, submitting: false, receipt: null };
}

function receiptSnapshot(state, reference, createdAt) {
  const items = sanitizeCart(state.cart);
  const totals = checkoutTotals(items);
  const safeReference = String(reference || 'DEMO-BAMBOO').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 28);
  return Object.freeze({
    simulation: true,
    reference: safeReference.startsWith('DEMO-') ? safeReference : `DEMO-${safeReference || 'BAMBOO'}`,
    createdAt: typeof createdAt === 'string' && Number.isFinite(Date.parse(createdAt)) ? new Date(createdAt).toISOString() : null,
    items: Object.freeze(items.map(item => Object.freeze({ ...item }))),
    subtotal: totals.subtotal, shipping: totals.shipping, total: totals.total,
    delivery: state.delivery, payment: state.payment
  });
}

// Restored receipts accept a fixed catalog-only shape. Prices are recomputed;
// unknown properties (including customer information) are never retained.
export function normalizeDemoReceipt(input) {
  if (!input || input.simulation !== true || !/^DEMO-[A-Z0-9-]{1,23}$/.test(input.reference || '')
    || !DEMO_DELIVERY.includes(input.delivery) || !DEMO_PAYMENT.includes(input.payment)) return null;
  const items = sanitizeCart(input.items);
  if (!items.length) return null;
  return receiptSnapshot({ cart: items, delivery: input.delivery, payment: input.payment }, input.reference, input.createdAt);
}

export function restoreCheckoutState(cart, storedReceipt) {
  const state = createCheckoutState(cart);
  const receipt = normalizeDemoReceipt(storedReceipt);
  return !state.cart.length && receipt ? { ...state, step: 'complete', furthest: 3, receipt } : state;
}

/** Pure transitions guard both the UI and completion callback. */
export function reduceCheckout(state, event) {
  if (!state || !event) return state;
  if (event.type === 'reset') return createCheckoutState(event.cart);

  if (event.type === 'cart') {
    const cart = sanitizeCart(event.cart);
    if (checkoutCartFingerprint(cart) === checkoutCartFingerprint(state.cart)) return state;
    if (state.receipt) return cart.length ? createCheckoutState(cart) : { ...state, cart };
    return { ...state, cart, accepted: false, submitting: false,
      ...(!cart.length ? { step: 'selection', furthest: 0 } : {}) };
  }

  // Confirmation is final for this run, and a pending completion cannot be
  // edited. An external cart change cancels the pending completion above.
  if (state.receipt) return state;
  if (state.submitting && !['complete', 'cancel'].includes(event.type)) return state;

  switch (event.type) {
    case 'next': {
      const index = CHECKOUT_STEPS.indexOf(state.step);
      if (!state.cart.length || index < 0 || index >= CHECKOUT_STEPS.length - 1) return state;
      return { ...state, step: CHECKOUT_STEPS[index + 1], furthest: Math.max(state.furthest, index + 1), accepted: false };
    }
    case 'step': {
      const index = CHECKOUT_STEPS.indexOf(event.step);
      if (index < 0 || index > state.furthest || index && !state.cart.length) return state;
      return { ...state, step: event.step, accepted: false };
    }
    case 'delivery':
      return DEMO_DELIVERY.includes(event.value) ? { ...state, delivery: event.value, accepted: false } : state;
    case 'payment':
      return DEMO_PAYMENT.includes(event.value) ? { ...state, payment: event.value, accepted: false } : state;
    case 'accept':
      return state.step === 'review' ? { ...state, accepted: event.value === true } : state;
    case 'submit':
      return state.step === 'review' && state.cart.length && state.accepted ? { ...state, submitting: true } : state;
    case 'complete':
      return state.submitting ? { ...state, step: 'complete', accepted: false, submitting: false,
        receipt: receiptSnapshot(state, event.reference, event.createdAt) } : state;
    case 'cancel':
      return { ...state, submitting: false, accepted: false };
    default:
      return state;
  }
}
