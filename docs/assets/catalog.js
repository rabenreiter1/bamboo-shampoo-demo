export const fragrances = ['bamboo', 'aloe', 'argan'];
export const prices = { shampoo: 1250, refill: 450 };
export const formatPrice = (cents, lang = 'de') => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const productKey = (scent, format) => `${scent}:${format}`;
export function sanitizeCart(input) {
  if (!Array.isArray(input)) return [];
  const result = new Map();
  for (const row of input) {
    if (!row || !fragrances.includes(row.scent) || !Object.hasOwn(prices, row.format) || !Number.isInteger(row.quantity) || row.quantity < 1) continue;
    const key = productKey(row.scent, row.format);
    const existing = result.get(key);
    result.set(key, { scent: row.scent, format: row.format, quantity: Math.min(20, (existing?.quantity || 0) + row.quantity) });
  }
  return [...result.values()];
}
export function cartTotal(cart) { return sanitizeCart(cart).reduce((sum, row) => sum + prices[row.format] * row.quantity, 0); }
