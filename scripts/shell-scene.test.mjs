import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBody } from '../assets/assembly/body.js';
import { createShopShell, shopScenePixelRatio } from '../assets/shop-scene.js';

test('the inspectable shell contains exactly the approved bamboo meshes and no cap, PET or seal', async () => {
  const body = await createBody({ THREE }), shell = createShopShell(body);
  const actual = [], materials = new Set();
  shell.traverse(object => { if (object.isMesh) { actual.push(object.name); materials.add(object.material); } });
  const source = []; body.components.shell.traverse(object => { if (object.isMesh) source.push(object.name); });
  assert.deepEqual(actual, source); assert.ok(actual.length > 0);
  assert.equal(shell.parent, null); assert.equal(body.components.shell.parent, null);
  for (const material of materials) assert.ok([body.materials.wood, body.materials.innerWood, body.materials.endGrain].includes(material));
  assert.ok(!materials.has(body.materials.clearPET)); assert.ok(!materials.has(body.materials.foil));
  const originalBounds = new THREE.Box3().setFromObject(body.components.shell);
  const viewBounds = new THREE.Box3().setFromObject(shell);
  assert.deepEqual(viewBounds.min.toArray(), originalBounds.min.toArray());
  assert.deepEqual(viewBounds.max.toArray(), originalBounds.max.toArray());
  assert.equal(viewBounds.max.y - viewBounds.min.y, 170);
  body.dispose();
});

test('independent shell inspection leaves the original assembly transforms and shared resources intact', async () => {
  const body = await createBody({ THREE }), a = createShopShell(body), b = createShopShell(body);
  a.rotation.y = Math.PI / 2; a.position.y = -85;
  assert.equal(b.rotation.y, 0); assert.equal(body.components.shell.rotation.y, 0);
  assert.equal(b.position.y, 0); assert.equal(body.components.shell.position.y, 0);
  assert.notEqual(a, b); assert.notEqual(a.children[0], b.children[0]);
  assert.equal(a.children[0].geometry, b.children[0].geometry);
  assert.equal(a.children[0].material, body.components.shell.children[0].material);
  assert.throws(() => createShopShell({ components: { inlay: body.components.inlay } }), TypeError);
  body.dispose();
});

test('large and high-DPI displays stay within the pixel budget while phone detail is retained', () => {
  assert.equal(shopScenePixelRatio(390, 680, 3, true), 1.3);
  assert.equal(shopScenePixelRatio(800, 680, 2, true), 1.3);
  assert.equal(shopScenePixelRatio(1280, 720, 2, false), 1.65);
  for (const [width, height] of [[1440,900],[1920,1080],[3440,1440],[3840,2160],[7680,4320]]) {
    const ratio = shopScenePixelRatio(width, height, 3, false);
    assert.ok(width * height * ratio ** 2 <= 3_000_000 + 1e-6);
    assert.ok(ratio > 0 && ratio <= 1.65);
  }
  assert.equal(shopScenePixelRatio(1280, 720, 1, false), 1);
  assert.equal(shopScenePixelRatio(390, 680, NaN, true), 1);
});
