// Finished, versioned crawler images share the selected photographic assets.
// Motion stages retain their independent source-derived loading posters.
import {productPhotoAsset} from '../assets/product-photos.js';
export const SHARE_CARD_VERSION = '20261015-stills';
export const SHARE_CARD_SIZE = Object.freeze({ width: 1200, height: 630 });
const scents = ['aloe', 'argan', 'bamboo'];
const names = { aloe: 'Aloe', argan: 'Argan', bamboo: 'Bamboo' };
const copy = {
  de: {
    home: ['Bamboo Shampoo — 250 ml. Immer wieder.', 'Drei Düfte. Eine Bambushülle, die bleibt. Entdecke dein Starter-Set und das Refill.'],
    refill: ['Bamboo Refill — Die Hülle bleibt.', 'Neuer Duft, gleiche Bambushülle. Entdecke das 250-ml-Refill in Aloe, Argan und Bamboo.'],
    product: name => [`${name} — Dein Bamboo Shampoo.`, `250 ml ${name}. Wähle dein Starter-Set oder das passende Refill.`],
    alt: word => `${word} in großer Schrift hinter dem Bamboo-Shampoo-Produkt auf farbigem Hintergrund`,
    refillAlt: 'REFILL in großer Schrift hinter dem transparenten, gefüllten PET-Einsatz auf farbigem Hintergrund',
  },
  en: {
    home: ['Bamboo Shampoo — 250 ml. On repeat.', 'Three scents. One bamboo shell to keep. Discover your starter set and its refill.'],
    refill: ['Bamboo Refill — Keep the shell.', 'A fresh scent, the same bamboo shell. Explore the 250 ml refill in Aloe, Argan and Bamboo.'],
    product: name => [`${name} — Your Bamboo Shampoo.`, `250 ml ${name}. Choose your starter set or its matching refill.`],
    alt: word => `Oversized ${word} lettering behind the Bamboo Shampoo product on a colourful background`,
    refillAlt: 'Oversized REFILL lettering behind the transparent, filled PET insert on a colourful background',
  },
};

export const shareCardSpecs = Object.freeze(['de', 'en'].flatMap(lang =>
  ['home', ...scents, 'refill'].map(id => Object.freeze({
    id, lang, file: `share-${id}-${lang}-${SHARE_CARD_VERSION}.jpg`,
    word: id === 'home' ? 'BAMBOO' : id.toUpperCase(),
    world: scents.includes(id) ? id : 'aloe',
    product: productPhotoAsset(id==='refill'?'refill':'product',scents.includes(id)?id:'aloe'),
  }))));

export function shareCardFor(lang, route = '') {
  const locale = lang === 'en' ? 'en' : 'de';
  const scent = route.match(/^products\/(aloe|argan|bamboo)\//)?.[1];
  const id = route === 'refill/' ? 'refill' : scent || 'home';
  const spec = shareCardSpecs.find(card => card.lang === locale && card.id === id);
  const t = copy[locale];
  const [title, description] = scent ? t.product(names[scent]) : t[id];
  return { ...spec, ...SHARE_CARD_SIZE, type: 'image/jpeg', title, description,
    alt: id === 'refill' ? t.refillAlt : t.alt(spec.word) };
}
