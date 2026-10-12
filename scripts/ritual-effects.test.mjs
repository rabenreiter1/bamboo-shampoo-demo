import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createPeelSeal, createGel, samplePeelPoint, samplePeelState, sampleFoldedTab,
  sampleFill, sampleGelStream, sampleGelDrop } from '../assets/assembly/ritual-effects.js';

const near = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const finite = object => { for (const value of Object.values(object)) if (typeof value === 'number') assert.ok(Number.isFinite(value)); };

test('retail foil fits below the cap and folded tab stays inside its bore', () => {
  const seal = createPeelSeal({ THREE });
  const box = new THREE.Box3().setFromObject(seal.group, true);
  near(box.min.y, 170.3, 2e-5);
  assert.ok(box.max.y < 170.55, `Retail foil extends to Y${box.max.y}`);
  near(box.max.x - box.min.x, 58);
  near(box.max.z - box.min.z, 58);
  for (let l = 0; l <= 8.8; l += .05) for (const z of [-3.8, 0, 3.8]) {
    const folded = sampleFoldedTab(l, z, 0); finite(folded);
    assert.ok(Math.hypot(folded.x, folded.z) < 29.5);
  }
  seal.dispose();
});

test('peeling retains a truly flat bonded region and a smooth circular bend', () => {
  let lastArea = Infinity;
  for (let i = 0; i <= 100; i++) {
    const peel = i / 100, state = samplePeelState(peel);
    assert.ok(state.bondedArea <= lastArea + 1e-7); lastArea = state.bondedArea;
    for (let x = -29; x <= 29; x += .5) {
      const point = samplePeelPoint(x, 2, peel); finite(point);
      near(Math.hypot(point.nx, point.ny, point.nz), 1);
      if (x <= state.front) { near(point.x, x); near(point.y, 170.34); assert.equal(point.bonded, true); }
      else { assert.equal(point.bonded, false); assert.ok(point.y >= 170.34); }
    }
    if (state.front >= -29 && state.front <= 29) {
      const before = samplePeelPoint(state.front - 1e-6, 0, peel);
      const after = samplePeelPoint(state.front + 1e-6, 0, peel);
      assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 3e-6, 'Crack at peel front');
      near(after.nx, before.nx, 1e-6); near(after.ny, before.ny, 1e-6);
    }
  }
  near(samplePeelState(0).bondedFraction, 1);
  near(samplePeelState(1).bondedFraction, 0);
  assert.ok(samplePeelPoint(29, 0, .7).y > 195, 'Released tail does not lift visibly');
});

test('membrane deformation is finite and reproduces exactly after reverse scrubbing', () => {
  const seal = createPeelSeal({ THREE });
  const capture = () => {
    const result = [];
    seal.group.traverse(object => { if (object.geometry) result.push([...object.geometry.attributes.position.array], [...object.geometry.attributes.normal.array]); });
    return { vertices: result, position: seal.group.position.toArray(), visible: seal.group.visible };
  };
  seal.update({ unfold: 1, peel: .53, exit: 0 });
  const reference = capture();
  for (let i = 0; i <= 40; i++) seal.update({ unfold: i / 40, peel: i / 40, exit: i / 40 });
  seal.update({ unfold: 1, peel: .53, exit: 0 });
  assert.deepEqual(capture(), reference);
  for (const array of reference.vertices) for (const number of array) assert.ok(Number.isFinite(number));
  seal.update({ unfold: 1, peel: 1, exit: 1 }); assert.equal(seal.group.visible, false);
  seal.update(); assert.equal(seal.group.visible, true);
  seal.dispose();
});

test('deformed foil updates camera bounds and its skins have outward normals', () => {
  const seal = createPeelSeal({ THREE });
  const flatBox = new THREE.Box3().setFromObject(seal.group);
  seal.update({ unfold: 1, peel: .64 });
  const currentBox = new THREE.Box3().setFromObject(seal.group);
  assert.ok(currentBox.max.y > flatBox.max.y + 25, 'Camera bounds remained at the retail foil height');
  const preciseBox = new THREE.Box3().setFromObject(seal.group, true);
  near(currentBox.min.x, preciseBox.min.x); near(currentBox.max.x, preciseBox.max.x);
  near(currentBox.min.y, preciseBox.min.y); near(currentBox.max.y, preciseBox.max.y);
  const disk = seal.group.getObjectByName('Continuous_peeling_foil_disk').geometry;
  const p = disk.attributes.position, n = disk.attributes.normal, index = disk.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const geometric = new THREE.Vector3(), average = new THREE.Vector3(), temporary = new THREE.Vector3();
  for (const skin of disk.groups.slice(0, 2)) for (let i = skin.start; i < skin.start + skin.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    a.fromBufferAttribute(p, ids[0]); b.fromBufferAttribute(p, ids[1]); c.fromBufferAttribute(p, ids[2]);
    geometric.crossVectors(b.sub(a), c.sub(a));
    if (geometric.lengthSq() < 1e-10) continue;
    geometric.normalize(); average.set(0, 0, 0);
    for (const id of ids) average.add(temporary.fromBufferAttribute(n, id));
    average.normalize();
    assert.ok(geometric.dot(average) > .9, 'A foil skin has inverted face winding or normals');
  }
  seal.dispose();
});

test('external foil departure preserves scene-owned pose and visibility through reverse scrubbing', () => {
  const seal = createPeelSeal({ THREE });
  seal.group.position.set(300, 440, -70); seal.group.rotation.set(.2, 1.1, -.3);
  seal.group.visible = true;
  const quaternion = seal.group.quaternion.toArray();
  for (const exit of [0, .25, 1, .3, 0]) {
    seal.update({ unfold: 1, peel: 1, exit, externalExit: true });
    assert.equal(seal.group.visible, true, 'Effect hid a foil still controlled by the scene');
    assert.deepEqual(seal.group.position.toArray(), [300, 440, -70]);
    assert.deepEqual(seal.group.quaternion.toArray(), quaternion);
  }
  seal.group.visible = false;
  seal.update({ unfold: 1, peel: 1, exit: 0, externalExit: true });
  assert.equal(seal.group.visible, false, 'Repeated effect updates overrode scene visibility');
  seal.reset();
  for (const coordinate of seal.group.position.toArray()) near(coordinate, 0);
  assert.deepEqual(seal.group.quaternion.toArray(), [0, 0, 0, 1]);
  assert.equal(seal.group.visible, true);
  near(seal.getLocalBounds().max.y, 170.48, 2e-5);
  seal.dispose();
});

test('local foil bounds remain precise independently of departing world transforms', () => {
  const seal = createPeelSeal({ THREE });
  seal.update({ unfold: 1, peel: .82, externalExit: true });
  const local = seal.getLocalBounds();
  seal.group.position.set(590, 750, -110); seal.group.rotation.y = 2;
  const departingLocal = seal.getLocalBounds();
  assert.deepEqual([departingLocal.min.toArray(), departingLocal.max.toArray()],
    [local.min.toArray(), local.max.toArray()]);
  for (const mesh of seal.group.children) {
    const position = mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      assert.ok(local.containsPoint(new THREE.Vector3().fromBufferAttribute(position, i)), 'A foil vertex escaped its departure envelope');
    }
  }
  seal.dispose();
});

test('nominal gel cylinder contains exactly 250 ml and proportional drain volume', () => {
  for (const fraction of [0, .12, .5, .88, 1]) {
    const fill = sampleFill(fraction);
    near(Math.PI * 23.2 ** 2 * fill.height / 1000, 250 * fraction);
    near(fill.volumeMilliliters, 250 * fraction); near(fill.surfaceY, 5.3 + fill.height);
  }
  assert.ok(sampleFill(1).surfaceY < 170, '250 ml fill lacks headspace');
});

test('full transmissive fill uses physical-height geometry and unit model scale', () => {
  const gel = createGel({ THREE });
  const body = gel.oldFillGroup.getObjectByName('Measured_250ml_gel_volume');
  assert.deepEqual(body.scale.toArray(), [1, 1, 1]);
  for (const fraction of [1, .88, .55, .12]) {
    gel.update({ fillOld: fraction });
    const bounds = new THREE.Box3().setFromObject(body, true);
    near(body.scale.y, fraction); near(bounds.min.y, 5.3, 2e-5);
    near(bounds.max.y - bounds.min.y, sampleFill(fraction).height, 2e-5);
  }
  gel.dispose();
});

test('amber absorption belongs to the measured liquid volume and disappears with its contents', () => {
  const gel = createGel({ THREE });
  const body = gel.oldFillGroup.getObjectByName('Measured_250ml_gel_volume');
  const surface = gel.oldFillGroup.getObjectByName('Level_gel_free_surface');
  const material = body.material;
  assert.equal(surface.material, material, 'The free surface must be the same colored gel as its bulk');
  assert.equal(material.opacity, 1); assert.ok(material.transmission > .8);
  // Beer-Lambert attenuation should yield a perceptibly warm bulk, rather
  // than applying an opaque tint to the PET wall. Three stores linear RGB.
  const transmitted = ['r', 'g', 'b'].map(channel => Math.pow(material.attenuationColor[channel], material.thickness / material.attenuationDistance));
  assert.ok(transmitted[0] > transmitted[1] && transmitted[1] > transmitted[2]);
  assert.ok(transmitted[0] - transmitted[2] > .5, 'The bulk remains too pale to read separately from bamboo');
  const stream = gel.streamGroup.getObjectByName('World_gravity_viscous_shampoo_stream');
  assert.ok(stream.material.attenuationColor.equals(material.attenuationColor), 'Stream hue differs from the refill contents');
  const strandTransmission = ['r', 'g', 'b'].map(channel => Math.pow(stream.material.attenuationColor[channel], stream.material.thickness / stream.material.attenuationDistance));
  assert.ok(strandTransmission[0] - strandTransmission[2] > .5, 'The thin strand becomes almost colorless in studio light');
  gel.update({ fillOld: 0, fillNew: 1 });
  assert.equal(gel.oldFillGroup.visible, false); assert.equal(gel.newFillGroup.visible, true);
  assert.equal(gel.oldFillGroup.userData.fillMilliliters, 0);
  const bounds = new THREE.Box3().setFromObject(gel.newFillGroup, true);
  assert.ok(bounds.max.y < 170 - 10, 'A clear air space must separate gel from the sealed flange');
  gel.dispose();
});

test('gel exits its world outlet, follows gravity and expands during the one pressure gush', () => {
  const base = { progress: .55, flow: 1, gush: 0, outletWorld: [17, 121, -25], outletDirection: [.6, -.8, 0] };
  const beginning = sampleGelStream(0, base);
  near(beginning.x, 17); near(beginning.y, 121); near(beginning.z, -25);
  const steady = sampleGelStream(.4, base), gush = sampleGelStream(.4, { ...base, gush: 1 });
  near(gush.radius ** 2 / steady.radius ** 2, 3.2);
  assert.ok(gush.y < steady.y, 'Pressure should extend the stream');
  const end = sampleGelStream(1, base); assert.ok(end.y < beginning.y - 100);
  const yawed = sampleGelStream(1, { ...base, outletDirection: [0, -.8, .6] });
  near(yawed.y, end.y); assert.ok(yawed.y < base.outletWorld[1]);
  for (let i = 0; i <= 1000; i++) {
    const state = { ...base, progress: i / 1000, flow: i / 1000, gush: (i % 17) / 16 };
    finite(sampleGelStream((i % 101) / 100, state));
    for (let drop = 0; drop < 5; drop++) finite(sampleGelDrop(drop, state));
  }
});

test('final droplets remain after the continuous flow stops, then vanish before refill', () => {
  const tail = Array.from({ length: 5 }, (_, index) => sampleGelDrop(index, { progress: .664, flow: 0 }));
  assert.ok(tail.some(drop => drop.visible));
  for (const progress of [0, .4, .67, .75, 1]) for (let index = 0; index < 5; index++) {
    assert.equal(sampleGelDrop(index, { progress, flow: 0 }).visible, false);
  }
});

test('world gel meshes are history independent and hold still without scroll', () => {
  const gel = createGel({ THREE });
  const state = { progress: .57, flow: 1, gush: .7, fillOld: .68, fillNew: 1,
    outletWorld: new THREE.Vector3(1, 51, 3), outletDirection: new THREE.Vector3(.6, -.8, 0) };
  const capture = () => {
    const objects = [];
    for (const group of [gel.streamGroup, gel.oldFillGroup, gel.newFillGroup]) group.traverse(object => {
      objects.push({ name: object.name, visible: object.visible, position: object.position.toArray(), scale: object.scale.toArray(),
        vertices: object.geometry ? createHash('sha256').update(Buffer.from(object.geometry.attributes.position.array.buffer)).digest('hex') : null });
    });
    return objects;
  };
  gel.update(state); const reference = capture(); gel.update(state); assert.deepEqual(capture(), reference);
  gel.update({ progress: .665, flow: 0, fillOld: 0, fillNew: .5, outletWorld: [10, 100, 20] });
  gel.update(state); assert.deepEqual(capture(), reference);
  gel.update({ progress: 1, flow: 0, fillOld: 1, fillNew: 1 });
  assert.equal(gel.streamGroup.visible, false);
  near(gel.oldFillGroup.userData.fillMilliliters, 250);
  const endpoint = capture(); gel.update(state); gel.update({ progress: 1, flow: 0, fillOld: 1, fillNew: 1 });
  assert.deepEqual(capture(), endpoint);
  gel.dispose();
});
