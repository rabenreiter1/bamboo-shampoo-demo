import {formatPrice, prices} from './catalog.js';
import {productPhotoAsset} from './product-photos.js?v=modern-20261016-1';

export function cartAddition(current, requested = 1) {
  const before = Math.min(20, Math.max(0, Math.floor(Number(current) || 0)));
  const amount = Math.min(20, Math.max(1, Math.floor(Number(requested) || 1)));
  const quantity = Math.min(20, before + amount);
  return {quantity, added: quantity - before, limited: quantity - before < amount};
}

/** Keep the related collection a continuation of the selected purchase format. */
export function syncRelatedFormat(scope, {format, lang, base, version = '', names, label}) {
  const mode = format === 'refill' ? 'refill' : 'product';
  const suffix = version ? `?v=${version}` : '';
  for (const card of scope.querySelectorAll('.related-products .product-card')) {
    const scent = card.dataset.fragrance;
    card.dataset.format = format;
    for (const link of card.querySelectorAll('a[href]')) {
      const url = new URL(link.href);
      if (format === 'refill') url.searchParams.set('format', 'refill');
      else url.searchParams.delete('format');
      link.href = url.href;
    }
    const art = card.querySelector('.product-card__art');
    art?.setAttribute('aria-label', `${names[scent]} ${label}, 250 ml — ${lang === 'de' ? 'ansehen' : 'view'}`);
    const meta = card.querySelector('.product-card__meta span');
    if (meta) meta.textContent = label.toUpperCase();
    const formatName = card.querySelector('.product-card__info h3 span');
    if (formatName) formatName.textContent = label;
    const price = card.querySelector('.product-card__price');
    if (price) price.textContent = formatPrice(prices[format], lang);
    const image = card.querySelector('.product-card__art img');
    if (image) {
      image.src = `${base}/assets/${productPhotoAsset(mode, scent)}${suffix}`;
      image.srcset = `${base}/assets/${productPhotoAsset(mode, scent, true)}${suffix} 640w, ${image.src} 1280w`;
      image.alt = `${names[scent]} ${label} · 250 ml`;
    }
    const add = card.querySelector('[data-quick-add]');
    if (add) {
      add.dataset.format = format; add.dataset.quickFormat = format;
      add.setAttribute('aria-label', `${names[scent]} ${label} ${lang === 'de' ? 'in die Tasche' : 'add to bag'}`);
    }
  }
}

/** Retrying a failed optional checkout module must never create two controllers. */
export function createCheckoutLoader({load, initialize, onState = () => {}}) {
  let pending, controller, attempt = 0;
  function start() {
    if (controller) return Promise.resolve(controller);
    if (pending) return pending;
    onState('loading');
    pending = Promise.resolve().then(() => load(++attempt)).then(module => {
      controller = initialize(module);
      if (!controller) throw new Error('Checkout initialization failed');
      onState('ready');
      return controller;
    }).catch(() => { onState('error'); return null; }).finally(() => { pending = null; });
    return pending;
  }
  return {start};
}
