import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRitualState as at, retailFingerprint, TAU, MAX_TILT, SWIVEL_ANGLE } from '../assets/assembly/ritual-timeline.js';

const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);
const numbers = (value) => typeof value === 'number' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(numbers) : [];

test('factory-sealed start and finish have identical physical product state', () => {
  assert.deepEqual(retailFingerprint(at(0)), retailFingerprint(at(1)));
  assert.equal(at(0).seal.visible, true);
  assert.equal(at(1).newSeal.visible, true);
  assert.equal(at(1).newSeal.peel, 0);
  assert.equal(at(1).oldRefill.visible, false);
  assert.equal(at(1).newRefill.fill, 1);
  near(at(1).yaw, TAU);
});

test('10,001 progress samples are finite, deterministic and reversible', () => {
  const forward = Array.from({ length: 10001 }, (_, i) => at(i / 10000));
  for (let i = 10000; i >= 0; i--) {
    assert.deepEqual(at(i / 10000), forward[i]);
    for (const n of numbers(forward[i])) assert.ok(Number.isFinite(n));
  }
  assert.deepEqual(at(-1), at(0)); assert.deepEqual(at(2), at(1));
  assert.deepEqual(at(NaN), at(0));
});

test('seal is accessible only after cap has lifted and parked; peel precedes return', () => {
  for (let p = .15; p < .27; p += .0002) {
    const s = at(p); near(s.cap.position[1], 44);
    assert.ok(s.cap.position[0] >= 75 - 1e-8);
  }
  assert.equal(at(.15).seal.unfold, 0);
  assert.equal(at(.167).seal.unfold, 1);
  assert.equal(at(.246).seal.peel, 1);
  assert.equal(at(.27).seal.visible, false);
  assert.deepEqual(at(.35).cap.position, [0, 0, 0]);
});

test('outlet disengages before swivelling; pouring starts downward with one pressure pulse', () => {
  for (let p = 0; p <= 1; p += .0001) {
    const s = at(p);
    if (s.cap.swivel > .0001) near(s.cap.lift, 1);
    if (s.liquid.flow > .0001) {
      assert.ok(s.tilt > Math.PI / 2, `Flow goes uphill at ${p}`);
      near(s.cap.swivel, SWIVEL_ANGLE);
      assert.equal(s.seal.visible, false);
      assert.deepEqual(s.cap.position, [0, 0, 0]);
    }
    if (s.cap.press > .00001) assert.ok(s.progress >= .54 && s.progress <= .585);
  }
  near(at(.50).tilt, MAX_TILT); near(at(.51).liquid.flow, 1);
  assert.equal(at(.56).cap.press, 1); assert.ok(at(.56).liquid.gush > .9);
  assert.equal(at(.595).cap.press, 0); assert.equal(at(.595).liquid.gush, 0);
  assert.equal(at(.595).liquid.flow, 1); assert.equal(at(.66).liquid.fillOld, 0);
  near(at(.50).yaw, at(.65).yaw);
});

test('old and replacement PET move axially until their bottom clears the bamboo rim', () => {
  for (let p = .72; p <= .96; p += .00005) {
    const s = at(p);
    for (const refill of [s.oldRefill, s.newRefill]) {
      if (!refill.visible) continue;
      const [x, y, z] = refill.position;
      if (refill.rotation[2] === 0 && y + 5 < 170 - .0001) {
        near(x, 0); near(z, 0);
      }
    }
    if (s.oldRefill.position[0] > .0001) assert.ok(p > .79);
    if (p > .765 && p < .9) assert.ok(s.cap.position[0] > 60);
    assert.equal(s.newSeal.peel, 0);
  }
  assert.deepEqual(at(.9).newRefill.position, [0, 0, 0]);
  assert.deepEqual(at(.96).cap.position, [0, 0, 0]);
});
