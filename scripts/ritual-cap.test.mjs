import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAP_SOURCE } from '../assets/assembly/cap-data.js';
import { createRitualCap, siliconeRoofField } from '../assets/assembly/ritual-cap.js';
import { shellRadiusAt } from '../assets/assembly/body.js';

const cap = await createRitualCap({ THREE });
const near = (actual, expected, tolerance = 0.0001) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);
const bounds = name => new THREE.Box3().setFromObject(cap.group.getObjectByName(name), true);

test('operative collar keeps confirmed dimensions and clears the sealed refill', () => {
  const collar = cap.group.getObjectByName('cap-collar-OD59-seat-OD58-wall0.5');
  const attribute = collar.geometry.getAttribute('position');
  const levels = new Map();
  for (let i = 0; i < attribute.count; i++) {
    const y = attribute.getY(i), radius = Math.hypot(attribute.getX(i), attribute.getZ(i));
    const level = levels.get(y) || { min: Infinity, max: -Infinity };
    level.min = Math.min(level.min, radius); level.max = Math.max(level.max, radius);
    levels.set(y, level);
  }
  const ordered = [...levels].sort((a, b) => a[0] - b[0]);
  for (const [, r] of ordered) near(r.max - r.min, 0.5, 0.00003);
  const lower = ordered.find(([y]) => Math.abs(y - 149.9) < 0.0001)[1];
  const upper = ordered.at(-1)[1];
  near(lower.max * 2, 58); near(lower.min * 2, 57);
  near(upper.max * 2, 59); near(upper.min * 2, 58);
  for (let y = cap.metrics.lowerSeatBottom; y <= 170; y += 0.02) {
    let i = 1; while (i < ordered.length - 1 && ordered[i][0] < y) i++;
    const [ay, a] = ordered[i - 1], [by, b] = ordered[i], mix = (y - ay) / (by - ay);
    const bore = a.min + (b.min - a.min) * mix;
    assert.ok(bore - shellRadiusAt(y) > -0.00002, `Collar overlaps bamboo at Y${y}`);
  }
  near(cap.metrics.roofUnderside - cap.metrics.flangeTop, 0.25);
  // Two 0.08 mm layers at the folded tab fit beneath the roof.
  assert.ok(cap.metrics.roofUnderside > cap.metrics.flangeTop + 0.16);
});

test('closed cap retains the original button, ring and artwork footprints', () => {
  cap.update({ lift: 0, swivel: 0, press: 0 });
  const specifications = [
    ['teardrop-button-traced-original', CAP_SOURCE.button],
    ['ring-and-two-discs-traced-original', CAP_SOURCE.ring],
    ['PRESS-TO-DOSE-traced-original', CAP_SOURCE.letters],
    ['original-J-sprig-logo-traced-original', CAP_SOURCE.logo],
    ['button-circular-inset-outline-traced-original', CAP_SOURCE.buttonInset],
  ];
  for (const [name, contours] of specifications) {
    const attribute = cap.group.getObjectByName(name).geometry.getAttribute('position');
    const actual = new Set();
    for (let i = 0; i < attribute.count; i++) actual.add(`${attribute.getX(i).toFixed(3)},${attribute.getZ(i).toFixed(3)}`);
    // Extrusion preserves every original traced contour vertex in projection.
    for (const [x, z] of contours.flatMap(c => c.points)) assert.ok(actual.has(`${x.toFixed(3)},${z.toFixed(3)}`), `Original vertex missing from ${name}: ${x},${z}`);
  }
});

test('stopper is disengaged before the circular ring can turn', () => {
  for (const lift of [0, 0.2, 0.59, cap.metrics.minimumSwivelLift]) {
    const state = cap.update({ lift, swivel: Math.PI * 0.61 });
    near(state.swivel, 0);
  }
  for (let lift = 0.61; lift <= 1.001; lift += 0.01) {
    const state = cap.update({ lift, swivel: 1.9 });
    assert.ok(state.nippleBottomY > cap.metrics.roofTop + 0.2);
  }
  const open = cap.update({ lift: 1, swivel: 1.9 });
  near(open.swivel, 1.9);
  assert.equal(open.nippleEngaged, false);
  const plug = cap.group.getObjectByName('shallow-nipple-plug-provisional-D5.8');
  const plugCenter = new THREE.Vector3(0, (cap.metrics.plugBottom + cap.metrics.ringBottom) / 2, cap.metrics.outletZ);
  plug.localToWorld(plugCenter);
  assert.ok(Math.hypot(plugCenter.x - cap.outlet.position.x, plugCenter.z - cap.outlet.position.z) > cap.metrics.outletDiameter);
});

test('captive circle and integral teardrop clear each other through press and swivel', () => {
  assert.ok(cap.metrics.clearances.circularBearingRadial > 0.18);
  assert.ok(cap.metrics.clearances.buttonAtFullPressAboveRing >= 0.099);
  const bearing = cap.group.getObjectByName('hidden-circular-captive-bearing');
  const ring = cap.group.getObjectByName('ring-and-two-discs-traced-original');
  const restBearing = Float32Array.from(bearing.geometry.getAttribute('position').array);
  const position = ring.geometry.getAttribute('position');
  const closedPosition = Float32Array.from(position.array);
  for (let i = 0; i <= 24; i++) {
    cap.update({ lift: 1, swivel: i * Math.PI / 12, press: i / 24 });
    assert.deepEqual(bearing.geometry.getAttribute('position').array, restBearing);
    for (let vertex = 0; vertex < position.count; vertex++) {
      const z = closedPosition[vertex * 3 + 2];
      if (z <= 10.05) near(position.getY(vertex), closedPosition[vertex * 3 + 1], 0.00001);
    }
    const top = bounds('teardrop-button-traced-original');
    assert.ok(top.min.y >= cap.metrics.ringTop + cap.components.ring.position.y + 0.649);
  }
});

test('silicone center is integral and broad roof flexes while flange support stays fixed', () => {
  assert.equal(cap.components.button.parent, cap.components.cap);
  const roof = cap.group.getObjectByName('cap-roof-with-open-dosing-aperture');
  cap.update(); cap.group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 180, 0), new THREE.Vector3(0, -1, 0));
  assert.ok(ray.intersectObject(roof).length, 'Roof has an unintended central through-hole');
  const p = roof.geometry.getAttribute('position');
  const rest = Float32Array.from(p.array);
  cap.update({ lift: 1, swivel: 1.9, press: 1 });
  near(cap.components.button.position.length(), 0);
  let centerCount = 0, transitionCount = 0, supportedCount = 0;
  for (let i = 0; i < p.count; i++) {
    const at = i * 3, radius = Math.hypot(rest[at], rest[at+2]);
    const field = siliconeRoofField(rest[at], rest[at+2], 1.2);
    near(p.getY(i), rest[at+1] + field.displacement, 0.00002);
    if (radius <= 11) { centerCount++; near(field.displacement, -1.2); }
    else if (radius < 23.5) { transitionCount++; assert.ok(field.displacement < 0 && field.displacement > -1.2); }
    else { supportedCount++; near(field.displacement, 0); }
  }
  assert.ok(centerCount && transitionCount > 100 && supportedCount);
  near(siliconeRoofField(0,19,1.2).displacement, -0.30107676672);
  near(siliconeRoofField(23.5,0,1.2).displacement, 0);
  const denied = cap.update({ lift: 0.4, swivel: 1.9, press: 1 });
  near(denied.press, 0); assert.deepEqual(p.array, rest);
});

test('deformed outlet and relief artwork follow the same roof field and normal', () => {
  cap.update();
  const artwork = cap.group.getObjectByName('PRESS-TO-DOSE-traced-original').geometry.getAttribute('position');
  const rest = Float32Array.from(artwork.array);
  cap.update({ lift: 1, swivel: 1.9, press: 1 });
  for (let i = 0; i < artwork.count; i++) {
    const at = i * 3;
    near(artwork.getY(i), rest[at+1] + siliconeRoofField(rest[at], rest[at+2],1.2).displacement, 0.00002);
  }
  const field = siliconeRoofField(0,19,1.2);
  near(cap.outlet.position.y, cap.metrics.roofTop + 0.004 + field.displacement);
  const actual = new THREE.Vector3(0,1,0).applyQuaternion(cap.outlet.quaternion);
  const expected = new THREE.Vector3(-field.dx,1,-field.dz).normalize();
  near(actual.distanceTo(expected),0);
  assert.ok(actual.z < -0.15, 'Outlet normal fails to follow the flexed silicone surface');
});

test('sampled open ring, flex bridge and nipple clear the deformed roof through a full turn', () => {
  const ring = cap.group.getObjectByName('ring-and-two-discs-traced-original');
  const plug = cap.group.getObjectByName('shallow-nipple-plug-provisional-D5.8');
  const point = new THREE.Vector3();
  for (let pressIndex = 0; pressIndex <= 10; pressIndex++) {
    for (let angleIndex = 0; angleIndex <= 24; angleIndex++) {
      const press = pressIndex / 10;
      cap.update({ lift: 1, swivel: angleIndex * Math.PI / 12, press });
      cap.group.updateMatrixWorld(true);
      for (const object of [ring, plug]) {
        const positions = object.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
          const radius = Math.hypot(point.x,point.z);
          if (radius > 29.5 || radius < 7.55) continue;
          const roofTop = cap.metrics.roofTop + siliconeRoofField(point.x,point.z,1.2*press).displacement;
          assert.ok(point.y >= roofTop + 0.011 - 0.00003, `${object.name} collides with roof: press${press}, swivel${angleIndex}, r${radius}`);
        }
      }
      const bearing = cap.group.getObjectByName('hidden-circular-captive-bearing');
      const bearingBottom = new THREE.Box3().setFromObject(bearing,true).min.y;
      assert.ok(bearingBottom >= cap.metrics.roofTop - 1.2*press + 0.011);
    }
  }
});

test('repeating and reversing operative cap poses returns identical geometry', () => {
  const ring = cap.group.getObjectByName('ring-and-two-discs-traced-original');
  const positions = ring.geometry.getAttribute('position');
  const roof = cap.group.getObjectByName('cap-roof-with-open-dosing-aperture').geometry;
  cap.update();
  const initial = Float32Array.from(positions.array);
  const initialRoof = Float32Array.from(roof.getAttribute('position').array);
  const initialNormals = Float32Array.from(roof.getAttribute('normal').array);
  const poses = Array.from({ length: 101 }, (_, i) => ({ lift: Math.min(i / 20,1), swivel: i / 100 * 1.9, press: Math.sin(i / 100 * Math.PI) ** 2 }));
  const forward = poses.map(pose => {
    const state = cap.update(pose);
    return { state, positions: Float32Array.from(positions.array), roof: Float32Array.from(roof.getAttribute('position').array), normals: Float32Array.from(roof.getAttribute('normal').array), buttonY: cap.components.button.position.y };
  });
  for (let i = poses.length - 1; i >= 0; i--) {
    assert.deepEqual(cap.update(poses[i]), forward[i].state);
    assert.deepEqual(positions.array, forward[i].positions);
    assert.deepEqual(roof.getAttribute('position').array, forward[i].roof);
    assert.deepEqual(roof.getAttribute('normal').array, forward[i].normals);
    near(cap.components.button.position.y, forward[i].buttonY);
  }
  cap.update();
  assert.deepEqual(positions.array, initial);
  assert.deepEqual(roof.getAttribute('position').array, initialRoof);
  assert.deepEqual(roof.getAttribute('normal').array, initialNormals);
  near(cap.components.ring.rotation.y, 0);
  near(cap.components.button.position.y, 0);
});

test('cached conservative bounds enclose every actual deformed vertex after scene initialization', () => {
  // Viewer initialization computes all rest bounds once. That must not destroy
  // the separately cached range needed by subsequent pressure deformation.
  cap.group.traverse(object => {
    if (object.geometry) { object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere(); }
  });
  const point = new THREE.Vector3();
  for (const [lift, press] of [[1,.25],[1,1],[1,.6],[.5,0],[0,0]]) {
    cap.update({ lift, press, swivel:1.9 });
    cap.group.traverse(object => {
      if (!object.isMesh) return;
      const geometry = object.geometry, positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions,i);
        assert.ok(geometry.boundingBox.containsPoint(point), `${object.name} escapes cached box`);
        assert.ok(point.distanceTo(geometry.boundingSphere.center) <= geometry.boundingSphere.radius + .0001, `${object.name} escapes cached sphere`);
      }
    });
  }
});

test.after(() => cap.dispose());
