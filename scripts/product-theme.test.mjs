import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BRAND_THEME, PRODUCT_THEMES, themeCss } from '../assets/product-theme.js?v=shop-20261015-intro1';
import { CAMPAIGN_WORLDS, paintCampaignWorld } from '../assets/campaign-backdrop.js';
import { createRitualCap } from '../assets/assembly/ritual-cap.js';

const meshNames = {
  cap: 'cap-collar-OD59-seat-OD58-wall0.5',
  button: 'teardrop-button-traced-original',
  ring: 'ring-and-two-discs-traced-original',
  capDetail: 'PRESS-TO-DOSE-traced-original',
  buttonDetail: 'original-J-sprig-logo-traced-original',
};
const material = (cap, key) => cap.group.getObjectByName(meshNames[key]).material;
const colors = cap => Object.fromEntries(Object.keys(meshNames).map(key => [key, `#${material(cap, key).color.getHexString()}`]));
const lowerColors = values => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.toLowerCase()]));

test('the three finishes use the accepted pastel colours and immutable shared worlds', () => {
  assert.equal(BRAND_THEME.ivory, '#F8F6EF');
  assert.equal(BRAND_THEME.sage, '#E6EEE0');
  assert.equal(BRAND_THEME.ink, '#253B30');
  assert.deepEqual(Object.keys(PRODUCT_THEMES), ['aloe', 'argan', 'bamboo']);
  assert.deepEqual(Object.values(PRODUCT_THEMES).map(theme => theme.cap), ['#BAD1B0', '#E7B6AE', '#B6CBDE']);
  assert.equal(PRODUCT_THEMES.aloe.world.base, BRAND_THEME.sage);
  for (const [scent, theme] of Object.entries(PRODUCT_THEMES)) {
    assert.equal(CAMPAIGN_WORLDS[scent], theme.world, 'canvas reads the exact shared world, not a second colour catalogue');
    assert.equal(theme.world.accent, theme.cap);
    assert.equal(theme.world.ink, BRAND_THEME.ink);
    for (const key of ['cap', 'button', 'ring']) assert.equal(theme.capColors[key], theme.cap);
    const base = new THREE.Color(theme.cap), detail = new THREE.Color(theme.capColors.capDetail);
    const baseHsl = base.getHSL({}), detailHsl = detail.getHSL({});
    assert.ok(Math.abs(baseHsl.h - detailHsl.h) < .012, 'relief stays in the same colour family');
    assert.ok(baseHsl.l - detailHsl.l > 0 && baseHsl.l - detailHsl.l < .09, 'relief has only a subtle tone difference');
    assert.equal(theme.capColors.buttonDetail, theme.capColors.capDetail);
    for (const object of [theme, theme.capColors, theme.world]) assert.ok(Object.isFrozen(object));
  }
  assert.ok(Object.isFrozen(BRAND_THEME) && Object.isFrozen(PRODUCT_THEMES) && Object.isFrozen(CAMPAIGN_WORLDS));
});

test('generated CSS and painted canvas use the same scent palette', () => {
  const css = themeCss();
  for (const [variable, value] of [['paper', BRAND_THEME.ivory], ['ink', BRAND_THEME.ink], ['sage', BRAND_THEME.sage]]) {
    assert.ok(css.includes(`--${variable}:${value};`));
  }
  assert.ok(css.includes(`--lavender:${BRAND_THEME.sage};`), 'legacy surfaces get the new sage alias');
  for (const [scent, theme] of Object.entries(PRODUCT_THEMES)) {
    const declarations = css.match(new RegExp(`\\.scent-${scent}\\{([^}]+)\\}`))[1];
    for (const [variable, value] of [['world-bg', theme.world.base], ['world-light', theme.world.light], ['world-accent', theme.cap], ['cap-color', theme.cap]]) {
      assert.ok(declarations.includes(`--${variable}:${value};`));
    }
    const fills = [], stops = [], words = [];
    const gradient = () => ({ addColorStop(at, color) { stops.push([at, color]); } });
    const context = {
      setTransform() {}, createRadialGradient: gradient, createLinearGradient: gradient,
      fillRect() { fills.push(this.fillStyle); }, fillText(word) { words.push({ word, color: this.fillStyle }); },
    };
    paintCampaignWorld(context, { width: 1200, height: 630, world: scent });
    assert.equal(fills[0], theme.world.base);
    assert.ok(stops.some(([at, color]) => at === 0 && color === theme.world.light));
    assert.ok(stops.some(([at, color]) => at === 1 && color === theme.world.accent));
    assert.deepEqual(words, [{ word: 'BAMBOO', color: BRAND_THEME.ink }]);
    assert.equal(context.globalAlpha, 1, 'the next product draw remains untinted');
  }
});

test('pastel finishes own their materials and recolouring preserves geometry and operating state', async () => {
  const standalone = await createRitualCap({ THREE });
  const shop = await createRitualCap({ THREE, colors: PRODUCT_THEMES.aloe.capColors });
  try {
    const emerald = { cap: '#156b43', button: '#25805a', ring: '#0c4c33', capDetail: '#0b4e33', buttonDetail: '#165b40' };
    assert.deepEqual(colors(standalone), emerald, 'standalone assembly keeps the approved emerald default');
    assert.deepEqual(colors(shop), lowerColors(PRODUCT_THEMES.aloe.capColors));
    assert.deepEqual(shop.metrics, standalone.metrics);
    for (const [key, name] of Object.entries(meshNames)) {
      assert.notEqual(material(shop, key), material(standalone, key));
      const shopMesh = shop.group.getObjectByName(name), referenceMesh = standalone.group.getObjectByName(name);
      assert.deepEqual(shopMesh.geometry.getAttribute('position').array, referenceMesh.geometry.getAttribute('position').array);
      assert.deepEqual(shopMesh.geometry.getAttribute('normal').array, referenceMesh.geometry.getAttribute('normal').array);
      assert.equal(material(shop, key).roughness, material(standalone, key).roughness);
    }
    shop.update({ lift: 1, swivel: 1.9, press: .7 });
    const operation = structuredClone(shop.group.userData.operation);
    const roof = shop.group.getObjectByName('cap-roof-with-open-dosing-aperture').geometry;
    const positions = Float32Array.from(roof.getAttribute('position').array);
    const materialIds = Object.fromEntries(Object.keys(meshNames).map(key => [key, material(shop, key).uuid]));
    shop.setColors(PRODUCT_THEMES.argan.capColors);
    assert.deepEqual(colors(shop), lowerColors(PRODUCT_THEMES.argan.capColors));
    assert.deepEqual(colors(standalone), emerald, 'changing one fragrance cannot recolour another viewer');
    assert.deepEqual(shop.group.userData.operation, operation);
    assert.deepEqual(roof.getAttribute('position').array, positions, 'colour changes cannot reset flex or any vertex');
    assert.deepEqual(Object.fromEntries(Object.keys(meshNames).map(key => [key, material(shop, key).uuid])), materialIds, 'switching fragrance reuses GPU materials');
    standalone.setColors(PRODUCT_THEMES.bamboo.capColors);
    assert.deepEqual(colors(standalone), lowerColors(PRODUCT_THEMES.bamboo.capColors));
    assert.deepEqual(colors(shop), lowerColors(PRODUCT_THEMES.argan.capColors));
  } finally {
    standalone.dispose();
    shop.dispose();
  }
});
