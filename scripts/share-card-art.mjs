import { CAMPAIGN_WORLDS, paintCampaignWorld } from '../assets/campaign-backdrop.js';
import { PRODUCT_THEMES } from '../assets/product-theme.js';
import { SHARE_CARD_SIZE, shareCardSpecs } from './share-cards.mjs';

// Reusable canvas artwork for the share-card studio. Font files and product
// images come from the existing shop; no product geometry or engraving is edited.
function trackedText(ctx, text, x, y, tracking = 3) {
  ctx.textAlign = 'left';
  for (const character of text) {
    ctx.fillText(character, x, y);
    x += ctx.measureText(character).width + tracking;
  }
}

export async function loadShareCardAssets(assetBase = '/assets/') {
  const display = new FontFace('Campaign', `url(${assetBase}display.woff2)`, { weight: '700' });
  const sans = new FontFace('ShareSans', `url(${assetBase}sans.woff2)`, { weight: '100 900' });
  for (const font of await Promise.all([display.load(), sans.load()])) document.fonts.add(font);
  const files = [...new Set(shareCardSpecs.map(card => card.product))];
  const images = new Map(await Promise.all(files.map(async file => {
    const img = new Image(); img.src = assetBase + file; await img.decode();
    // The live-camera poster clips the far end of its contact shadow at the
    // viewport edge. Fade only that empty right margin for a free-standing card.
    // The complete product ends before 83% of this approved source image.
    const layer = document.createElement('canvas');
    layer.width = img.naturalWidth; layer.height = img.naturalHeight;
    const ctx = layer.getContext('2d'); ctx.drawImage(img, 0, 0);
    const feather = ctx.createLinearGradient(layer.width * .83, 0, layer.width, 0);
    feather.addColorStop(0, '#000'); feather.addColorStop(1, '#0000');
    ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = feather;
    ctx.fillRect(0, 0, layer.width, layer.height);
    return [file, layer];
  })));
  return images;
}

export function drawShareCard(canvas, spec, images) {
  const { width, height } = SHARE_CARD_SIZE;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const palette = CAMPAIGN_WORLDS[spec.world];
  paintCampaignWorld(ctx, { width, height, world: spec.world, word: spec.word });

  // The actual hero composition, adapted to a landscape messaging preview.
  // Keep the complete cap and tube inside the frame, with legible type at 320px.
  if (spec.id === 'refill') ctx.drawImage(images.get(spec.product), 366, 42, 456, 570);
  else ctx.drawImage(images.get(spec.product), 352, -4, 504, 630);
  ctx.fillStyle = palette.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = '800 43px ShareSans, sans-serif';
  ctx.fillText('bamboo.', 40, 62);
  ctx.font = '700 12px ShareSans, sans-serif';
  trackedText(ctx, 'SHAMPOO', 42, 84, 3.8);

  ctx.font = '700 17px ShareSans, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(spec.id === 'refill' ? 'KEEP. REFILL. REPEAT.' : 'SHAMPOO, REDESIGNED.', width - 40, 55);

  const tagline = spec.id === 'refill'
    ? (spec.lang === 'de' ? ['Die Hülle', 'bleibt.'] : ['Keep', 'the shell.'])
    : (spec.lang === 'de' ? ['250 ml.', 'Immer wieder.'] : ['250 ml.', 'On repeat.']);
  ctx.textAlign = 'left'; ctx.font = '700 34px ShareSans, sans-serif';
  ctx.fillText(tagline[0], 40, 550); ctx.fillText(tagline[1], 40, 589);
  ctx.font = '600 17px ShareSans, sans-serif';
  const labels = spec.id === 'refill' || spec.id === 'home'
    ? ['Aloe', 'Argan', 'Bamboo'] : [spec.word[0] + spec.word.slice(1).toLowerCase()];
  const colors = ['aloe', 'argan', 'bamboo'].map(id => PRODUCT_THEMES[id].cap);
  const measured = labels.map(label => ctx.measureText(label).width);
  const total = measured.reduce((a, b) => a + b, 0) + labels.length * 22 + (labels.length - 1) * 23;
  let x = width - 40 - total;
  for (let i = 0; i < labels.length; i++) {
    ctx.beginPath(); ctx.arc(x + 5, 580, 5, 0, Math.PI * 2);
    ctx.fillStyle = colors[spec.id === 'argan' ? 1 : spec.id === 'bamboo' ? 2 : i]; ctx.fill();
    ctx.fillStyle = palette.ink; ctx.fillText(labels[i], x + 20, 586);
    x += measured[i] + 45;
  }
  return canvas;
}
