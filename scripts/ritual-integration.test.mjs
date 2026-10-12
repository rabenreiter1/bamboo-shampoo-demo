import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { CAP_SOURCE } from '../assets/assembly/cap-data.js';
import { createBody } from '../assets/assembly/body.js';
import { createRitualCap } from '../assets/assembly/ritual-cap.js';
import { createPeelSeal, createGel } from '../assets/assembly/ritual-effects.js';
import { computeRitualState, TILT_AXIS } from '../assets/assembly/ritual-timeline.js';

const [body, cap] = await Promise.all([createBody({ THREE }), createRitualCap({ THREE })]);
const oldSeal = createPeelSeal({ THREE }), newSeal = createPeelSeal({ THREE }), gel = createGel({ THREE });
const scene = new THREE.Scene(), tiltRig = new THREE.Group(), yawRig = new THREE.Group(), product = new THREE.Group();
const oldRefill = new THREE.Group(), newRefill = new THREE.Group();
product.position.y = -85;
tiltRig.add(yawRig); yawRig.add(product); scene.add(tiltRig);
oldRefill.add(body.components.inlay, oldSeal.group, gel.oldFillGroup);
newRefill.add(body.components.inlay.clone(true), newSeal.group, gel.newFillGroup);
product.add(body.components.shell, cap.group, oldRefill, newRefill);
scene.add(gel.streamGroup);
const axis = new THREE.Vector3(...TILT_AXIS);
const near = (actual, expected, tolerance = 0.0001) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);

function apply(progress, manualYaw = 0, withGel = true) {
  const state = computeRitualState(progress);
  tiltRig.quaternion.setFromAxisAngle(axis, state.tilt);
  yawRig.rotation.y = state.yaw + manualYaw;
  cap.group.position.fromArray(state.cap.position);
  cap.update(state.cap);
  for (const [group, pose] of [[oldRefill, state.oldRefill], [newRefill, state.newRefill]]) {
    group.position.fromArray(pose.position); group.rotation.set(...pose.rotation); group.visible = pose.visible;
  }
  oldSeal.update(state.seal); oldSeal.group.visible = state.seal.visible;
  newSeal.update(state.newSeal); newSeal.group.visible = state.newSeal.visible;
  scene.updateMatrixWorld(true);
  const outlet = cap.outlet.getWorldPosition(new THREE.Vector3());
  const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(cap.outlet.getWorldQuaternion(new THREE.Quaternion()));
  if (withGel) gel.update({ progress, ...state.liquid, outletWorld: outlet, outletDirection: direction });
  // WebGLRenderer performs this final world-matrix update immediately before
  // drawing; reproduce that pass after the fill surface/scales are assigned.
  scene.updateMatrixWorld(true);
  return { state, outlet, direction };
}

function projectedVertices(mesh, matrix = new THREE.Matrix4()) {
  const attribute = mesh.geometry.getAttribute('position'), result = new Float64Array(attribute.count * 3);
  const point = new THREE.Vector3();
  for (let i = 0; i < attribute.count; i++) {
    point.fromBufferAttribute(attribute, i).applyMatrix4(matrix);
    result[i * 3] = point.x; result[i * 3 + 1] = point.y; result[i * 3 + 2] = point.z;
  }
  return result;
}

function visibleGeometry() {
  const meshes = [];
  scene.traverseVisible(object => {
    if (object.geometry) meshes.push({ name: object.name, vertices: projectedVertices(object, object.matrixWorld) });
  });
  return meshes.sort((a, b) => a.name.localeCompare(b.name));
}

test('factory film, folded tab, flange, roof, stem and stopper have real geometric clearance', () => {
  apply(0);
  const flange = body.components.inlay.getObjectByName('PET_sealing_flange_D58_radial5_5');
  const flangeTop = new THREE.Box3().setFromObject(flange, true).max.y + 85;
  const plug = cap.group.getObjectByName('shallow-nipple-plug-provisional-D5.8');
  const plugAttribute = plug.geometry.getAttribute('position');
  let plugBottom = Infinity;
  for (let i = 0; i < plugAttribute.count; i++) plugBottom = Math.min(plugBottom, plugAttribute.getY(i));
  let flatTop = -Infinity, foldedTop = -Infinity;
  oldSeal.group.traverse(mesh => {
    const attribute = mesh.geometry?.getAttribute('position');
    if (!attribute) return;
    for (let i = 0; i < attribute.count; i++) {
      const x = attribute.getX(i), y = attribute.getY(i), z = attribute.getZ(i), r = Math.hypot(x, z);
      assert.ok(y >= flangeTop - 0.00003, 'Closed film enters the supporting flange');
      assert.ok(y < cap.metrics.roofUnderside - 0.06, 'Closed film hits cap roof');
      assert.ok(r <= cap.metrics.upperBoreDiameter / 2 + 0.00001, 'Retail tab protrudes through the cap collar');
      if (Math.hypot(x, z - cap.metrics.outletZ) <= cap.metrics.plugDiameter / 2) assert.ok(y < plugBottom - 0.039, 'Closed foil hits the nipple plug');
      if (r <= cap.metrics.stemRadius) assert.ok(y < cap.metrics.roofUnderside - 0.16, 'Closed film hits the actuator stem');
      if (mesh.name === 'Continuous_peeling_foil_disk') flatTop = Math.max(flatTop, y);
      if (mesh.name === 'Folded_pull_tab') {
        foldedTop = Math.max(foldedTop, y);
        assert.ok(x > 19, 'Folded tab unexpectedly overlaps the central mechanism');
        assert.ok(Math.abs(z) < 3.81, 'Folded tab unexpectedly overlaps the dosing plug');
      }
    }
  });
  near(flatTop, 170.38, 0.00003); near(foldedTop, 170.48, 0.00003);
  assert.ok(flatTop < plugBottom);
});

test('the full assembled model retains the supplied original artwork sources', () => {
  const engraving = fs.readFileSync(new URL('../assets/assembly/original-engraving.svg', import.meta.url));
  const capReference = fs.readFileSync(new URL('../assets/assembly/cap-reference.jpg', import.meta.url));
  const hash = data => createHash('sha256').update(data).digest('hex');
  assert.equal(hash(engraving), '67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa');
  assert.equal(hash(engraving), body.metrics.surfaceMap.originalAssetSha256);
  assert.equal(hash(capReference), CAP_SOURCE.source.sha256);
  assert.equal(cap.metrics.source.sha256, CAP_SOURCE.source.sha256);
  assert.equal(body.metrics.surfaceMap.clippingOrGlyphReplacement, false);
  assert.equal(body.metrics.confirmed.nominalFillMilliliters, 250);
  near(Math.PI * gel.metrics.liquidRadius ** 2 * gel.metrics.fullFillHeight / 1000, 250);
});

test('cap and PET move sideways only after their actual geometry clears the bamboo', () => {
  const inlayMesh = body.components.inlay.getObjectByName('PET_hollow_body_D47_H165');
  const localInlay = inlayMesh.geometry.getAttribute('position');
  const collar = cap.group.getObjectByName('cap-collar-OD59-seat-OD58-wall0.5');
  const localCollar = collar.geometry.getAttribute('position');
  let firstOldLateral = false;
  for (let step = 0; step <= 2000; step++) {
    const progress = step / 2000, state = computeRitualState(progress);
    const oldMatrix = new THREE.Matrix4().compose(new THREE.Vector3(...state.oldRefill.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...state.oldRefill.rotation)), new THREE.Vector3(1, 1, 1));
    const point = new THREE.Vector3();
    if (!firstOldLateral && Math.hypot(state.oldRefill.position[0], state.oldRefill.position[2]) > 0.00001) {
      let lowest = Infinity;
      for (let i = 0; i < localInlay.count; i++) lowest = Math.min(lowest, point.fromBufferAttribute(localInlay, i).applyMatrix4(oldMatrix).y);
      assert.ok(lowest > body.metrics.dimensions.shellHeight + 8, 'Old PET starts its disposal arc while still inside bamboo');
      firstOldLateral = true;
    }
    if (state.newRefill.visible && state.newRefill.position[1] + 5 < 170) {
      near(Math.hypot(state.newRefill.position[0], state.newRefill.position[2]), 0);
      assert.deepEqual(state.newRefill.rotation, [0, 0, 0]);
    }
    if (Math.abs(state.cap.position[0]) > 0.00001) {
      let lowest = Infinity;
      for (let i = 0; i < localCollar.count; i++) lowest = Math.min(lowest, localCollar.getY(i) + state.cap.position[1]);
      assert.ok(lowest > body.metrics.dimensions.shellHeight + 23, 'Cap slides through the bamboo before clearing its collar');
    }
  }
  assert.equal(firstOldLateral, true);
});

test('every flowing frame has a clear, unsealed outlet pointing down under axial inspection', () => {
  const ray = new THREE.Raycaster();
  const stopperPart = cap.components.ring;
  const down = new THREE.Vector3(0, -1, 0);
  let active = 0;
  for (let step = 0; step <= 1000; step++) {
    const progress = step / 1000, state = computeRitualState(progress);
    if (state.liquid.flow <= 0.00001) continue;
    for (const manualYaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const { outlet, direction } = apply(progress, manualYaw, false);
      assert.ok(direction.dot(down) > 0.4, 'Flow begins while the outlet is facing sideways or up');
      assert.equal(oldSeal.group.visible, false);
      near(cap.group.position.length(), 0);
      assert.ok(cap.group.userData.operation.lift > 0.99);
      assert.ok(cap.group.userData.operation.swivel > 1.9);
      ray.set(outlet.clone().addScaledVector(direction, 8), direction.clone().negate());
      ray.near = 0; ray.far = 8;
      assert.equal(ray.intersectObject(stopperPart, true).length, 0, 'The linked stopper still obstructs the dosing aperture');
      const localOutlet = cap.group.worldToLocal(outlet.clone());
      near(localOutlet.x, 0); near(localOutlet.y, cap.metrics.roofTop + 0.004); near(localOutlet.z, cap.metrics.outletZ);
      active++;
    }
  }
  assert.ok(active > 700);
});

test('the actual gel stream stays attached to the outlet, clears its mouth and falls in world gravity', () => {
  const stream = gel.streamGroup.getObjectByName('World_gravity_viscous_shampoo_stream');
  const vertices = stream.geometry.getAttribute('position');
  for (const progress of [.49, .552, .56, .59, .64, .65]) for (const manualYaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const { outlet } = apply(progress, manualYaw);
    assert.equal(gel.streamGroup.parent, scene, 'Flow inherits bottle rotation instead of remaining in world gravity');
    assert.deepEqual(gel.streamGroup.position.toArray(), [0, 0, 0]);
    assert.deepEqual(gel.streamGroup.rotation.toArray().slice(0, 3), [0, 0, 0]);
    const centroid = new THREE.Vector3();
    // Fourteen radial intervals plus their repeated seam vertex form each row.
    for (let j = 0; j < 14; j++) centroid.add(new THREE.Vector3().fromBufferAttribute(vertices, j));
    centroid.divideScalar(14);
    assert.ok(centroid.distanceTo(outlet) < 0.00002, 'Stream origin detaches from the world outlet under yaw/tilt');
    const inverse = cap.group.matrixWorld.clone().invert();
    for (let j = 0; j <= 14; j++) {
      const mouthPoint = new THREE.Vector3().fromBufferAttribute(vertices, j).applyMatrix4(inverse);
      assert.ok(Math.hypot(mouthPoint.x, mouthPoint.z - cap.metrics.outletZ) < cap.metrics.outletDiameter / 2, 'Gel intersects the solid roof around the dosing aperture');
    }
    const lastRow = vertices.count - 15;
    let tailY = 0;
    for (let j = 0; j < 14; j++) tailY += vertices.getY(lastRow + j);
    tailY /= 14;
    assert.ok(tailY < outlet.y - 30, 'Gel tail no longer follows downward world gravity');
    const point = new THREE.Vector3();
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(inverse);
      assert.ok(point.y > body.metrics.dimensions.shellHeight, 'World-gravity stream cuts back through the bamboo tube');
    }
    for (let i = 0; i < vertices.array.length; i++) assert.ok(Number.isFinite(vertices.array[i]));
  }
});

test('sealed endpoints have equivalent complete visible geometry, replacing the refill only', () => {
  apply(0); const initial = visibleGeometry();
  // Visit all distinct operations before checking the final state, catching
  // retained deformations or transforms from a previously scrubbed chapter.
  for (const progress of [.16, .21, .25, .38, .49, .56, .655, .775, .812, .868, .944]) apply(progress);
  apply(1); const final = visibleGeometry();
  assert.equal(initial.length, final.length);
  for (let i = 0; i < initial.length; i++) {
    assert.equal(initial[i].name, final[i].name);
    assert.equal(initial[i].vertices.length, final[i].vertices.length);
    for (let vertex = 0; vertex < initial[i].vertices.length; vertex++) near(initial[i].vertices[vertex], final[i].vertices[vertex], 0.00001);
  }
  assert.equal(newRefill.visible, true); assert.equal(oldRefill.visible, false);
  assert.equal(newSeal.group.visible, true); assert.equal(gel.streamGroup.visible, false);
  near(gel.newFillGroup.userData.fillMilliliters, 250);
  apply(0); const reversed = visibleGeometry();
  for (let i = 0; i < initial.length; i++) assert.deepEqual(reversed[i].vertices, initial[i].vertices);
});

test.after(() => { body.dispose(); cap.dispose(); oldSeal.dispose(); newSeal.dispose(); gel.dispose(); });
