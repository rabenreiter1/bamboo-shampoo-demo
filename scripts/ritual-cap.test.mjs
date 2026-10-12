import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAP_SOURCE } from '../assets/assembly/cap-data.js';
import { createRitualCap } from '../assets/assembly/ritual-cap.js';
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

test('captive circle and teardrop face clear each other through the press and swivel', () => {
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
    assert.ok(top.min.y >= cap.metrics.ringTop + 0.099);
  }
});

test('repeating and reversing operative cap poses returns identical geometry', () => {
  const ring = cap.group.getObjectByName('ring-and-two-discs-traced-original');
  const positions = ring.geometry.getAttribute('position');
  cap.update();
  const initial = Float32Array.from(positions.array);
  const poses = Array.from({ length: 101 }, (_, i) => ({ lift: i / 100, swivel: i / 100 * 1.9, press: Math.sin(i / 100 * Math.PI) ** 2 }));
  const forward = poses.map(pose => {
    const state = cap.update(pose);
    return { state, positions: Float32Array.from(positions.array), buttonY: cap.components.button.position.y };
  });
  for (let i = poses.length - 1; i >= 0; i--) {
    assert.deepEqual(cap.update(poses[i]), forward[i].state);
    assert.deepEqual(positions.array, forward[i].positions);
    near(cap.components.button.position.y, forward[i].buttonY);
  }
  cap.update();
  assert.deepEqual(positions.array, initial);
  near(cap.components.ring.rotation.y, 0);
  near(cap.components.button.position.y, 0);
});

test.after(() => cap.dispose());
