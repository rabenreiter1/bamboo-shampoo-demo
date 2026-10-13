import test from 'node:test';
import assert from 'node:assert/strict';
import { captionMotion, journeyScrollProgress, initializeProductJourney } from '../assets/journey-caption.js';
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

test('orientation preserves a late pinned pose when new CSS puts old scroll pixels beyond the track', () => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  const geometry = { width: 375, stage: 780, track: 8440, top: 844, header: 64 };
  const events = new Map(), classes = new Set();
  const mockWindow = {
    scrollY: geometry.top - geometry.header + .77 * (geometry.track - geometry.stage),
    addEventListener(name, listener) { events.set(name, listener); },
    removeEventListener() {},
    scrollTo({ top }) { this.scrollY = top; },
  };
  const stage = { getBoundingClientRect: () => ({ width: geometry.width, height: geometry.stage }) };
  const section = {
    dataset: {}, style: { setProperty() {} },
    classList: { add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); }, contains: name => classes.has(name) },
    querySelector: selector => selector === '[data-shop-scene="journey"]' || selector === '.product-journey__sticky' ? stage : null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: geometry.top - mockWindow.scrollY, height: geometry.track, bottom: geometry.top - mockWindow.scrollY + geometry.track }),
  };
  globalThis.window = mockWindow;
  globalThis.document = {
    documentElement: { get clientWidth() { return geometry.width; }, lang: 'de' },
    querySelector: selector => selector === '.header' ? { get offsetHeight() { return geometry.header; } } : null,
  };
  try {
    const controller = initializeProductJourney(section);
    controller.enhance({ q: .77, phase: 'dose' });
    assert.ok(Math.abs(controller.getProgress() - .77) < 1e-9);
    Object.assign(geometry, { width: 829, stage: 316, track: 3900, top: 390, header: 74 });
    assert.ok(section.getBoundingClientRect().bottom < 0, 'the old pixels are now beyond the resized tutorial');
    events.get('resize')();
    assert.ok(Math.abs(controller.getProgress() - .77) < 1e-9, 'preserve the inspected physical pose');
    mockWindow.scrollY = geometry.top + geometry.track + 200;
    controller.getProgress();
    const outside = mockWindow.scrollY;
    Object.assign(geometry, { width: 375, stage: 780, track: 8440, top: 844, header: 64 });
    events.get('resize')();
    assert.equal(mockWindow.scrollY, outside, 'do not force a visitor outside the tutorial back into its old pose');
    controller.suspend();
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
});
