import test from 'node:test';
import assert from 'node:assert/strict';
import { captionMotion, journeyScrollProgress } from '../assets/journey-caption.js';
import { JOURNEY_PHASES, computeJourneyPose } from '../assets/journey-pose.js';

test('captions follow displayed poses identically forward, paused and reversed', () => {
  const samples = Array.from({ length: 1001 }, (_, i) => i / 1000);
  const frame = q => {
    const pose = computeJourneyPose(q);
    return { phase: pose.phase, captions: JOURNEY_PHASES.map(phase => captionMotion(pose.q, phase)) };
  };
  const forward = samples.map(frame);
  const reverse = [...samples].reverse().map(frame).reverse();
  assert.deepEqual(reverse, forward);
  for (const q of [.16, .24, .33, .54, .72, .91]) assert.deepEqual(frame(q), frame(q), 'pausing does not advance a separate type timer');
});

test('every caption stays bounded and the transitions keep a readable visible caption', () => {
  for (let i = 0; i <= 2000; i++) {
    const q = i / 2000;
    const motions = JOURNEY_PHASES.map(phase => captionMotion(q, phase));
    for (const motion of motions) for (const value of Object.values(motion)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    assert.ok(motions.reduce((sum, motion) => sum + motion.opacity, 0) >= .5, `readable transition at ${q}`);
    assert.ok(motions.filter(motion => motion.opacity > .002).length <= 2, 'only adjacent captions overlap');
  }
  assert.equal(captionMotion(0, JOURNEY_PHASES[0]).opacity, 1);
  assert.equal(captionMotion(1, JOURNEY_PHASES.at(-1)).opacity, 1);
});

test('native-scroll mapping uses the measured sticky stage, with bounded endpoints and equal reverse positions', () => {
  const track = 9284, stage = 780, header = 64, travel = track - stage;
  assert.equal(journeyScrollProgress(header, track, stage, header), 0);
  assert.equal(journeyScrollProgress(header - travel, track, stage, header), 1);
  for (const q of [0, .13, .3, .48, .662, .8544, 1]) assert.ok(Math.abs(journeyScrollProgress(header - q * travel, track, stage, header) - q) < 1e-12);
  assert.equal(journeyScrollProgress(900, track, stage, header), 0);
  assert.equal(journeyScrollProgress(-20000, track, stage, header), 1);
  assert.equal(journeyScrollProgress(NaN, track, stage, header), 0);
});
