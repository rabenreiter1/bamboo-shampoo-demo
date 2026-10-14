import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYBACK_PROFILES, PLAYBACK_VERSION, playbackAt, playbackTimeForProgress,
  normalizePlaybackSnapshot, createPlaybackClock, initializePlayback } from '../assets/playback.js';
import { computeJourneyPose, JOURNEY_PHASES } from '../assets/journey-pose.js';

const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const saved = (overrides = {}) => ({ version: PLAYBACK_VERSION, profile: 'home-cycle', elapsed: 8.5, paused: true, yaw: 1.25, ...overrides });

function timingFixture(profile = 'home-cycle') {
  let time = 0, nextFrame = 0;
  const pending = new Map(), reports = [], cancelled = [];
  const scheduling = { now: () => time,
    requestFrame: callback => { const id = nextFrame++; pending.set(id, callback); return id; },
    cancelFrame: id => { pending.delete(id); cancelled.push(id); } };
  const clock = createPlaybackClock({ profile, ...scheduling, onFrame: state => reports.push(state) });
  const advance = ms => {
    time += ms; const frames = [...pending.values()]; pending.clear(); frames.forEach(callback => callback(time));
  };
  const start = () => { clock.setVisible(true); clock.setReady(true); };
  return { clock, pending, reports, cancelled, advance, start, scheduling,
    now: () => time, setTime: value => { time = value; } };
}

test('profiles reach the agreed poses and retain beginning and ending holds', () => {
  for (const [name, profile] of Object.entries(PLAYBACK_PROFILES)) {
    assert.ok(Object.isFrozen(profile)); assert.ok(Object.isFrozen(profile.checkpoints));
    for (const [seconds, q] of profile.checkpoints.slice(0, -1)) near(playbackAt(name, seconds).q, q);
    near(playbackAt(name, profile.duration - .25).q, 1);
    near(playbackAt(name, .5).q, profile.checkpoints[0][1]);
    near(playbackAt(name, profile.duration).q, profile.checkpoints[0][1]);
  }
  assert.equal(PLAYBACK_PROFILES['home-cycle'].duration, 32);
  assert.equal(PLAYBACK_PROFILES['refill-teaser'].duration, 14);
});

test('minimum-jerk timing is monotonic with zero approach and departure speed', () => {
  for (const [name, profile] of Object.entries(PLAYBACK_PROFILES)) {
    for (let i = 0; i < profile.checkpoints.length - 1; i++) {
      const [start, from] = profile.checkpoints[i], [end, to] = profile.checkpoints[i + 1];
      near(playbackAt(name, (start + end) / 2).q, (from + to) / 2);
      const epsilon = (end - start) * .0001;
      assert.ok(Math.abs(playbackAt(name, start + epsilon).q - from) / epsilon < .00001);
      if (end < profile.duration) assert.ok(Math.abs(to - playbackAt(name, end - epsilon).q) / epsilon < .00001);
      let previous = from;
      for (let j = 1; j < 20; j++) {
        const q = playbackAt(name, start + (end - start) * j / 20).q;
        assert.ok(q >= previous && q <= to); previous = q;
      }
    }
  }
});

test('time reconstruction loops in either direction without changing pose', () => {
  for (const [name, profile] of Object.entries(PLAYBACK_PROFILES)) {
    const expected = playbackAt(name, 4.125);
    for (const cycles of [-4, -1, 0, 1, 8]) {
      const actual = playbackAt(name, 4.125 + profile.duration * cycles);
      near(actual.q, expected.q); near(actual.elapsed, expected.elapsed);
      if (expected.automaticYaw !== undefined) near(actual.automaticYaw, expected.automaticYaw);
    }
    for (const invalid of [undefined, NaN, Infinity]) near(playbackAt(name, invalid).elapsed, 0);
  }
  assert.throws(() => playbackAt('unknown', 0), TypeError);
});

test('chapter and range seeking reconstruct the intended pose rather than a linear time estimate', () => {
  for (const [name, values] of Object.entries({ 'home-cycle': [0, .10, .20, .54, .875, .96, 1],
    'refill-teaser': [.72, .765, .83, .90, .96, 1] })) {
    for (const q of values) near(playbackAt(name, playbackTimeForProgress(name, q)).q, q, 1e-11);
  }
  near(playbackTimeForProgress('home-cycle', 1), 30);
  near(playbackTimeForProgress('refill-teaser', 1), 12);
  near(playbackTimeForProgress('refill-teaser', -10), 0);
  near(playbackAt('refill-teaser', playbackTimeForProgress('refill-teaser', 50)).q, 1);
});

test('home preserves the approved 720-degree turn and closes on the exact factory-sealed pose', () => {
  const first = playbackAt('home-cycle', 0), last = playbackAt('home-cycle', 31);
  assert.equal(first.automaticYaw, undefined); assert.equal(last.automaticYaw, undefined);
  const beginning = computeJourneyPose(first.q), ending = computeJourneyPose(last.q);
  near(ending.state.yaw - beginning.state.yaw, Math.PI * 4);
  for (const component of ['cap', 'oldRefill', 'newRefill', 'seal', 'newSeal', 'liquid']) {
    assert.deepEqual(ending.state[component], beginning.state[component]);
  }
  near(ending.roll, beginning.roll);
});

test('refill teaser yaw is a separate complete rotation with a matching loop orientation', () => {
  const start = playbackAt('refill-teaser', 0), middle = playbackAt('refill-teaser', 7);
  const end = playbackAt('refill-teaser', 14 - 1e-8), next = playbackAt('refill-teaser', 14);
  near(start.automaticYaw, 0); near(middle.automaticYaw, Math.PI);
  near(Math.cos(end.automaticYaw), Math.cos(next.automaticYaw));
  near(Math.sin(end.automaticYaw), Math.sin(next.automaticYaw));
  assert.equal(start.q, .72); assert.equal(next.q, .72);
});

test('both timing profiles preserve axial and refill clearance throughout every moving pose', () => {
  for (const [name, profile] of Object.entries(PLAYBACK_PROFILES)) {
    let previous = computeJourneyPose(playbackAt(name, 0).q).state;
    for (let i = 1; i < 1400; i++) {
      const pose = computeJourneyPose(playbackAt(name, profile.duration * i / 1400).q), state = pose.state;
      if (state.cap.park > 1e-8) near(state.cap.position[1], 44);
      if (state.oldRefill.depart > previous.oldRefill.depart) near(state.oldRefill.position[1], 174);
      if (state.newRefill.visible && state.newRefill.position[1] > 0) near(state.cap.park, 1);
      if (pose.q > .90 && state.cap.park < previous.cap.park) near(state.newRefill.position[1], 0);
      previous = state;
    }
  }
});

test('snapshots validate revision, profile, types and finite values while normalizing full loops', () => {
  assert.deepEqual(normalizePlaybackSnapshot(saved({ elapsed: 72.5 }), 'home-cycle'), saved());
  for (const value of [null, {}, saved({ version: 0 }), saved({ version: '1' }), saved({ profile: 'refill-teaser' }),
    saved({ elapsed: -1 }), saved({ elapsed: NaN }), saved({ elapsed: Infinity }), saved({ elapsed: '8.5' }),
    saved({ paused: 1 }), saved({ yaw: NaN }), saved({ yaw: '1.25' })]) {
    assert.equal(normalizePlaybackSnapshot(value, 'home-cycle'), null);
  }
  assert.equal(normalizePlaybackSnapshot(saved({ yaw: undefined }), 'home-cycle').yaw, 0);
});

test('the clock spends no frames or elapsed time before both readiness and visibility', () => {
  const f = timingFixture(); f.clock.setVisible(true); f.advance(9000);
  assert.equal(f.pending.size, 0); near(f.clock.getState().elapsed, 0);
  f.clock.setReady(true); assert.equal(f.pending.size, 1); f.advance(4000);
  near(f.clock.getState().elapsed, 4); near(f.clock.getState().q, playbackAt('home-cycle', 4).q);
  f.clock.destroy();
});

test('a scheduled clock loops endlessly and schedules only one next frame', () => {
  const f = timingFixture(); f.start();
  for (let i = 0; i < 10; i++) { f.clock.setVisible(true); f.clock.setReady(true); f.clock.resume(); }
  assert.equal(f.pending.size, 1);
  f.advance(32_000); near(f.clock.getState().elapsed, 0); near(f.clock.getState().q, 0);
  f.advance(68_000); near(f.clock.getState().elapsed, 4); assert.equal(f.pending.size, 1);
  f.clock.destroy(); assert.equal(f.pending.size, 0);
});

test('offscreen, hidden-tab, blocked and lifecycle gaps freeze time without catch-up', () => {
  for (const gate of ['setVisible', 'setDocumentVisible', 'setBlocked', 'suspend']) {
    const f = timingFixture(); f.start(); f.advance(4500);
    if (gate === 'suspend') f.clock.suspend(); else f.clock[gate](gate === 'setBlocked');
    assert.equal(f.pending.size, 0); f.advance(90_000); near(f.clock.getState().elapsed, 4.5);
    if (gate === 'suspend') f.clock.resume(); else f.clock[gate](gate !== 'setBlocked');
    f.advance(500); near(f.clock.getState().elapsed, 5); f.clock.destroy();
  }
});

test('combined temporary gates cannot prematurely resume or erase explicit pause', () => {
  const f = timingFixture(); f.start(); f.advance(3000); f.clock.pause();
  f.clock.setVisible(false); f.clock.setBlocked(true); f.clock.setDocumentVisible(false); f.advance(6000);
  f.clock.setVisible(true); f.clock.setDocumentVisible(true); f.clock.setBlocked(false);
  assert.equal(f.clock.getState().state, 'paused'); assert.equal(f.pending.size, 0);
  f.clock.play(); f.clock.setBlocked(true); f.advance(5000); assert.equal(f.pending.size, 0);
  f.clock.setBlocked(false); f.advance(500); near(f.clock.getState().elapsed, 3.5); f.clock.destroy();
});

test('pausing commits time since the last frame and can cancel frame identifier zero', () => {
  const f = timingFixture(); f.start(); assert.ok(f.pending.has(0));
  f.setTime(1250); f.clock.pause(); near(f.clock.getSnapshot().elapsed, 1.25);
  assert.deepEqual(f.cancelled, [0]); assert.equal(f.pending.size, 0); f.clock.destroy();
});

test('seeking persistently pauses and preserves manual inspection yaw', () => {
  const f = timingFixture(); f.clock.restore(saved({ elapsed: 2, paused: false })); f.start(); f.advance(600);
  f.clock.seek(.54); near(f.clock.getState().q, .54); assert.equal(f.clock.getState().paused, true);
  assert.equal(f.clock.getSnapshot().yaw, 1.25); f.advance(3000); near(f.clock.getState().q, .54);
  f.clock.play(); f.advance(500); assert.ok(f.clock.getState().q > .54); f.clock.destroy();
});

test('restoration retains elapsed and paused state without restoring old temporary gates', () => {
  const f = timingFixture(); f.start(); f.advance(6000); f.clock.setBlocked(true);
  assert.equal(f.clock.restore(saved({ elapsed: 18, paused: false })), true);
  assert.equal(f.clock.getState().blocked, true); assert.equal(f.pending.size, 0);
  f.clock.setBlocked(false); f.advance(500); near(f.clock.getSnapshot().elapsed, 18.5);
  const before = f.clock.getSnapshot(); assert.equal(f.clock.restore(saved({ profile: 'refill-teaser' })), false);
  assert.deepEqual(f.clock.getSnapshot(), before); f.clock.destroy();
});

test('fallback and destruction stop time even when a cancelled frame is delivered late', () => {
  const f = timingFixture(); f.start(); const late = [...f.pending.values()][0];
  f.clock.fallback(); f.advance(7000); late(f.now()); near(f.clock.getState().elapsed, 0);
  assert.equal(f.pending.size, 0); f.clock.fallback(false); f.advance(1000); near(f.clock.getState().elapsed, 1);
  const next = [...f.pending.values()][0]; f.clock.destroy(); const count = f.reports.length;
  next(f.now() + 7000); assert.equal(f.reports.length, count); assert.equal(f.pending.size, 0);
});

test('a stale cancelled callback cannot clear a newer frame or create a second clock after resuming', () => {
  const f = timingFixture(); f.start(); const stale = [...f.pending.values()][0];
  f.clock.setVisible(false); f.advance(5000); f.clock.setVisible(true);
  const current = [...f.pending.keys()][0], count = f.reports.length;
  stale(f.now()); assert.equal(f.reports.length, count); assert.deepEqual([...f.pending.keys()], [current]);
  f.advance(1000); near(f.clock.getState().elapsed, 1); assert.equal(f.pending.size, 1); f.clock.destroy();
});

class Surface {
  constructor() { this.events = new Map(); }
  addEventListener(type, callback) {
    if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.events.get(type)?.delete(callback); }
  emit(type, details = {}) {
    const event = { type, target: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...details };
    for (const callback of [...(this.events.get(type) || [])]) callback(event); return event;
  }
}
class Element extends Surface {
  constructor(dataset = {}, text = '') {
    super(); this.dataset = dataset; this.textContent = text; this.attributes = new Map(); this.selectors = new Map();
    this.disabled = false; this.hidden = false; this.inert = false;
    const classes = new Set(), styles = new Map();
    this.classList = { add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name),
      toggle(name, enabled) { const next = enabled ?? !classes.has(name); if (next) classes.add(name); else classes.delete(name); return next; } };
    this.style = { setProperty: (name, value) => styles.set(name, value), removeProperty: name => styles.delete(name), getPropertyValue: name => styles.get(name) || '' };
  }
  querySelector(selector) { return this.selectors.get(selector)?.[0] || null; }
  querySelectorAll(selector) { return this.selectors.get(selector) || []; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
}

function domFixture({ profile = 'home-cycle', reduced = false, snapshot, observer = true } = {}) {
  const timing = timingFixture(profile); timing.clock.destroy();
  const win = new Surface(), doc = new Surface(), media = new Surface(), memory = new Map();
  Object.assign(win, { innerWidth: 390, innerHeight: 844, performance: { now: timing.now },
    requestAnimationFrame: timing.scheduling.requestFrame, cancelAnimationFrame: timing.scheduling.cancelFrame, matchMedia: () => media });
  Object.assign(doc, { hidden: false, defaultView: win, documentElement: { clientWidth: 390, clientHeight: 844 } });
  media.matches = reduced;
  const stage = new Element(), section = new Element({ playbackProfile: profile }); section.ownerDocument = doc;
  stage.rect = { top: 80, bottom: 680, left: 0, right: 390, width: 390, height: 600 };
  stage.getBoundingClientRect = () => stage.rect;
  const toggle = new Element(), label = new Element(), seek = new Element(), status = new Element(), controls = new Element();
  const chapters = PLAYBACK_PROFILES[profile].chapters.map((point, i) => new Element({ playbackAt: String(point[1]) }, ['Öffnen', 'Entsiegeln', 'Dosieren', 'Refill'][i]));
  const captions = JOURNEY_PHASES.map(phase => new Element({ journeyCaption: phase.id, phaseStart: String(phase.start), phaseEnd: String(phase.end) }));
  toggle.selectors.set('[data-playback-toggle-label]', [label]);
  for (const [selector, nodes] of [ ['[data-shop-scene]', [stage]], ['[data-playback-toggle]', [toggle]],
    ['[data-playback-seek]', [seek]], ['[data-playback-status]', [status]], ['[data-playback-controls]', [controls]],
    ['[data-playback-at]', chapters], ['[data-journey-caption]', captions] ]) section.selectors.set(selector, nodes);
  const key = `bamboo-playback-v${PLAYBACK_VERSION}:${profile}`;
  if (snapshot) memory.set(key, JSON.stringify(snapshot));
  win.sessionStorage = { getItem: name => memory.get(name), setItem: (name, value) => memory.set(name, value) };
  let io;
  if (observer) win.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.options = options; this.connected = false; io = this; }
    observe() { this.connected = true; }
    disconnect() { this.connected = false; }
    emit(ratio) { this.callback([{ target: stage, isIntersecting: ratio > 0, intersectionRatio: ratio }]); }
  };
  const api = initializePlayback(section, { lang: 'de' });
  const poses = [], yaws = [], viewerPauses = [];
  const model = { status: 'ready', ready: true, rendered: true, q: PLAYBACK_PROFILES[profile].checkpoints[0][1], manualYaw: 0 };
  const view = { ready: Promise.resolve(), getState: () => ({ ...model }),
    setProgress: (q, settings) => poses.push({ q, ...settings }), setYaw: yaw => { model.manualYaw = yaw; yaws.push(yaw); },
    setPaused: value => viewerPauses.push(value) };
  const paint = (q = poses.at(-1)?.q ?? model.q) => {
    model.q = q; const pose = computeJourneyPose(q); model.phase = pose.phase; api.render({ ...model });
  };
  return { ...timing, clock: undefined, api, section, stage, toggle, label, seek, status, controls, chapters, captions,
    win, doc, media, memory, key, view, model, poses, yaws, viewerPauses, paint, observer: () => io };
}

test('DOM playback waits for the attached viewer first frame rather than initial warmup reports', async () => {
  const f = domFixture(); f.model.ready = false; f.model.rendered = false;
  f.api.prepare(); f.api.render({ ready: true, rendered: true, q: 0 });
  assert.equal(f.pending.size, 0); f.api.attach(f.view); await Promise.resolve();
  assert.equal(f.pending.size, 0); f.advance(9000); near(f.api.getSnapshot().elapsed, 0);
  f.model.ready = true; f.model.rendered = true; f.paint(); assert.equal(f.pending.size, 1);
  assert.equal(f.section.dataset.playbackState, 'playing'); assert.equal(f.toggle.disabled, false);
  f.advance(1000); near(f.api.getSnapshot().elapsed, 1); f.api.destroy();
});

test('DOM visibility requires half the actual stage and temporary pauses never catch up', () => {
  const f = domFixture(); f.api.attach(f.view); f.advance(4000);
  f.observer().emit(.4999); assert.equal(f.pending.size, 0); f.advance(9000); near(f.api.getSnapshot().elapsed, 4);
  f.observer().emit(.5); f.advance(500); near(f.api.getSnapshot().elapsed, 4.5);
  f.doc.hidden = true; f.doc.emit('visibilitychange'); f.advance(9000); near(f.api.getSnapshot().elapsed, 4.5);
  f.doc.hidden = false; f.doc.emit('visibilitychange'); f.advance(500); near(f.api.getSnapshot().elapsed, 5);
  f.api.setBlocked(true); f.advance(3000); near(f.api.getSnapshot().elapsed, 5);
  f.api.setBlocked(false); assert.equal(f.pending.size, 1); f.api.destroy();
});

test('geometry fallback for browsers without intersection observers preserves native page scrolling', () => {
  const f = domFixture({ observer: false }); f.api.attach(f.view); f.advance(3000);
  Object.assign(f.stage.rect, { top: 550, bottom: 1150 }); const scroll = f.win.emit('scroll');
  assert.equal(scroll.defaultPrevented, false); assert.equal(f.pending.size, 0);
  f.advance(5000); near(f.api.getSnapshot().elapsed, 3);
  Object.assign(f.stage.rect, { top: 544, bottom: 1144 }); f.win.emit('scroll'); assert.equal(f.pending.size, 1);
  f.api.destroy();
});

test('horizontal inspection pauses autoplay but leaves spin momentum under viewer control', () => {
  const f = domFixture(); f.api.attach(f.view); f.advance(3500);
  f.stage.emit('pointerdown', { pointerId: 1, clientX: 120, clientY: 200 });
  const move = f.stage.emit('pointermove', { pointerId: 1, clientX: 146, clientY: 202 });
  assert.equal(move.defaultPrevented, false); assert.equal(f.api.getSnapshot().paused, true);
  assert.deepEqual(f.viewerPauses, []); f.advance(5000); near(f.api.getSnapshot().elapsed, 3.5);
  f.observer().emit(0); f.observer().emit(1); assert.equal(f.pending.size, 0);
  f.toggle.emit('click'); assert.equal(f.api.getSnapshot().paused, false); assert.equal(f.pending.size, 1);
  f.stage.emit('scene-inspection'); assert.equal(f.api.getSnapshot().paused, true); f.api.destroy();
});

test('vertical touch keeps the page native and does not stop autoplay', () => {
  const f = domFixture(); f.api.attach(f.view);
  f.stage.emit('pointerdown', { pointerId: 1, clientX: 120, clientY: 200 });
  const move = f.stage.emit('pointermove', { pointerId: 1, clientX: 122, clientY: 224 });
  assert.equal(move.defaultPrevented, false); assert.equal(f.api.getSnapshot().paused, false);
  // Once native vertical intention wins, a diagonal tail cannot steal the gesture.
  f.stage.emit('pointermove', { pointerId: 1, clientX: 170, clientY: 230 });
  assert.equal(f.api.getSnapshot().paused, false); f.api.destroy();
});

test('chapters and range seek keep their pose until explicit Play and remain keyboard accessible controls', () => {
  const f = domFixture(); f.api.attach(f.view); f.chapters[2].emit('click');
  near(f.api.getProgress(), .54); assert.equal(f.api.getSnapshot().paused, true);
  assert.equal(f.toggle.getAttribute('aria-label'), 'Animation abspielen');
  f.paint(); assert.equal(f.chapters[2].getAttribute('aria-current'), 'step');
  f.seek.value = '.875'; f.seek.emit('input'); near(f.api.getProgress(), .875); f.paint();
  assert.equal(f.seek.getAttribute('aria-valuetext'), 'Refill');
  f.advance(9000); near(f.api.getProgress(), .875);
  f.toggle.emit('click'); assert.equal(f.toggle.getAttribute('aria-label'), 'Animation pausieren');
  f.advance(200); assert.ok(f.api.getProgress() > .875); assert.deepEqual(f.viewerPauses, []); f.api.destroy();
});

test('captions follow the displayed model and never expose multiple active paragraphs to assistive technology', () => {
  const f = domFixture(); f.api.attach(f.view); f.paint(0); f.advance(8000);
  assert.equal(f.section.dataset.journeyPhase, 'closed', 'clock cannot replace a caption before the actual frame');
  f.paint(); assert.equal(f.section.dataset.journeyPhase, 'unseal');
  assert.equal(f.captions.filter(caption => !caption.inert).length, 1);
  const caption = f.captions.find(item => item.dataset.journeyCaption === 'unseal');
  assert.equal(caption.getAttribute('aria-hidden'), 'false'); assert.equal(caption.classList.contains('is-active'), true);
  assert.equal(f.status.getAttribute('aria-live'), 'off'); f.api.destroy();
});

test('reload restores validated elapsed, explicit pause and manual yaw without duplicate animation frames', async () => {
  const f = domFixture({ snapshot: saved() }); near(f.api.getProgress(), playbackAt('home-cycle', 8.5).q);
  f.api.attach(f.view); await Promise.resolve(); near(f.yaws[0], 1.25);
  assert.equal(f.pending.size, 0); f.advance(8000); near(f.api.getSnapshot().elapsed, 8.5);
  f.toggle.emit('click'); f.api.resume(); f.api.resume(); assert.equal(f.pending.size, 1);
  f.advance(500); near(f.api.getSnapshot().elapsed, 9);
  f.model.manualYaw = 2.4; f.doc.emit('click', { target: { closest: () => ({}) } });
  near(JSON.parse(f.memory.get(f.key)).yaw, 2.4); f.api.destroy();
});

test('page restoration waits for a replacement rendered viewer and preserves paused state', async () => {
  const f = domFixture(); f.api.attach(f.view); f.advance(6500); f.model.manualYaw = -.7;
  f.win.emit('pagehide'); assert.equal(f.pending.size, 0);
  f.advance(90_000); f.win.emit('pageshow'); assert.equal(f.pending.size, 0);
  f.model.ready = false; f.model.rendered = false; f.api.attach(f.view); await Promise.resolve(); assert.equal(f.pending.size, 0);
  near(f.api.getSnapshot().elapsed, 6.5); near(f.yaws.at(-1), -.7);
  f.model.ready = true; f.model.rendered = true; f.paint(); assert.equal(f.pending.size, 1);
  f.advance(500); near(f.api.getSnapshot().elapsed, 7); f.api.destroy();
});

test('context warmup and viewer replacement suspend the clock until a fresh rendered frame', async () => {
  const f = domFixture(); f.api.attach(f.view); f.advance(6000);
  f.model.rendered = false; f.api.render({ ...f.model }); assert.equal(f.pending.size, 0);
  f.advance(7000); near(f.api.getSnapshot().elapsed, 6);
  f.model.rendered = true; f.paint(); f.advance(500); near(f.api.getSnapshot().elapsed, 6.5);
  let rejectOld;
  const old = { ...f.view, ready: new Promise((_resolve, reject) => { rejectOld = reject; }),
    getState: () => ({ ...f.model, ready: false, rendered: false }) };
  f.api.attach(old); assert.equal(f.pending.size, 0);
  f.model.ready = false; f.model.rendered = false; f.api.attach(f.view);
  rejectOld(new Error('Obsolete warmup')); await Promise.resolve(); await Promise.resolve();
  assert.notEqual(f.section.dataset.playbackState, 'fallback'); assert.equal(f.pending.size, 0);
  f.advance(6000); near(f.api.getSnapshot().elapsed, 6.5);
  f.model.ready = true; f.model.rendered = true; f.paint(); assert.equal(f.pending.size, 1); f.api.destroy();
});

test('reduced motion and WebGL failure expose all written steps and disable autoplay controls', () => {
  for (const reduced of [true, false]) {
    const f = domFixture({ reduced }); f.api.prepare();
    if (!reduced) { f.api.attach(f.view); f.api.render({ status: 'error' }); } else f.api.attach(f.view);
    assert.equal(f.section.dataset.playbackState, 'fallback'); assert.equal(f.pending.size, 0);
    assert.equal(f.controls.hidden, true); assert.equal(f.toggle.disabled, true); assert.equal(f.seek.disabled, true);
    assert.equal(f.status.textContent, 'Alle Schritte im Überblick.');
    for (const caption of f.captions) { assert.equal(caption.inert, false); assert.equal(caption.getAttribute('aria-hidden'), null); }
    assert.deepEqual(f.viewerPauses, []); f.api.destroy();
  }
});

test('a genuinely restored WebGL frame leaves error fallback with elapsed and explicit pause intact', () => {
  for (const paused of [false, true]) {
    const f = domFixture(); f.api.attach(f.view); f.advance(8500); f.paint();
    if (paused) f.toggle.emit('click');
    Object.assign(f.model, { status: 'error', error: 'Context lost', ready: false, rendered: false });
    f.api.render(f.view.getState()); assert.equal(f.section.dataset.playbackState, 'fallback');
    assert.equal(f.pending.size, 0); const elapsed = f.api.getSnapshot().elapsed;
    f.advance(90_000);
    // An obsolete callback cannot stand in for a recovered attached renderer.
    f.api.render({ status: 'ready', ready: true, rendered: true, q: .54 });
    assert.equal(f.section.dataset.playbackState, 'fallback'); assert.equal(f.pending.size, 0);
    Object.assign(f.model, { status: 'ready', error: null, ready: true, rendered: true });
    f.api.render(f.view.getState()); near(f.api.getSnapshot().elapsed, elapsed);
    assert.equal(f.api.getSnapshot().paused, paused); assert.equal(f.controls.hidden, false);
    assert.equal(f.toggle.disabled, false); assert.equal(f.section.classList.contains('is-enhanced'), true);
    assert.equal(f.captions.filter(caption => !caption.inert).length, 1);
    assert.equal(f.pending.size, paused ? 0 : 1);
    f.advance(500); near(f.api.getSnapshot().elapsed, elapsed + (paused ? 0 : .5)); f.api.destroy();
  }
});

test('recovered renderer reports cannot override the reduced-motion preference', () => {
  const f = domFixture(); f.api.attach(f.view); f.advance(6000);
  f.media.matches = true; f.media.emit('change', { matches: true });
  f.api.render(f.view.getState()); assert.equal(f.section.dataset.playbackState, 'fallback');
  assert.equal(f.controls.hidden, true); assert.equal(f.pending.size, 0);
  f.advance(7000); near(f.api.getSnapshot().elapsed, 6); f.api.destroy();
});

test('refill controller forwards independent yaw with the bounded assembly pose', () => {
  const f = domFixture({ profile: 'refill-teaser' }); f.api.attach(f.view); f.advance(7000);
  near(f.poses.at(-1).automaticYaw, Math.PI); near(f.poses.at(-1).q, playbackAt('refill-teaser', 7).q);
  near(Number(f.seek.min), .72); f.advance(7000); near(f.poses.at(-1).automaticYaw, 0); near(f.poses.at(-1).q, .72);
  f.api.destroy();
});

test('destroy removes every DOM listener and stale view readiness cannot restart a disposed player', async () => {
  const f = domFixture(); let resolve;
  f.model.ready = false; f.model.rendered = false; f.view.ready = new Promise(done => { resolve = done; });
  f.api.attach(f.view); f.api.destroy(); f.model.ready = true; f.model.rendered = true; resolve(); await Promise.resolve();
  assert.equal(f.pending.size, 0); assert.equal(f.observer().connected, false);
  for (const target of [f.section, f.stage, f.toggle, f.seek, f.win, f.doc, f.media, ...f.chapters]) {
    assert.equal([...target.events.values()].reduce((sum, handlers) => sum + handlers.size, 0), 0);
  }
});
