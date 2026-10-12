import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGestureState,
  reduceInspectionGesture as reduce,
  createInspectionInput,
  zoomFromWheel,
  clampProgress,
  clampZoom,
} from '../assets/assembly/ritual-input.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const pointer = (type, id, x, y, extra = {}) => ({type, pointerId: id, x, y, scrollRange: 9000, ...extra});

test('gesture locks after 8px; vertical movement advances and reverses without changing inspection', () => {
  let state = createGestureState({progress: 0.5, yaw: 1.3, zoom: 1.7});
  state = reduce(state, pointer('pointerdown', 1, 100, 100));
  state = reduce(state, pointer('pointermove', 1, 103, 104));
  assert.equal(state.mode, 'pending');
  close(state.progress, 0.5);
  state = reduce(state, pointer('pointermove', 1, 105, 90));
  assert.equal(state.mode, 'vertical');
  close(state.progress, 0.5 + 10 / 9000);
  state = reduce(state, pointer('pointermove', 1, 160, 120));
  assert.equal(state.mode, 'vertical');
  close(state.progress, 0.5 - 20 / 9000);
  close(state.yaw, 1.3);
  close(state.zoom, 1.7);
});

test('horizontal dragging adds axial yaw only and persists after release', () => {
  let state = createGestureState({progress: 0.3, yaw: 2, zoom: 0.9});
  state = reduce(state, pointer('pointerdown', 1, 100, 100));
  state = reduce(state, pointer('pointermove', 1, 140, 102));
  assert.equal(state.mode, 'horizontal');
  close(state.yaw, 2.48);
  state = reduce(state, pointer('pointermove', 1, 80, 400));
  close(state.yaw, 1.76);
  close(state.progress, 0.3);
  state = reduce(state, pointer('pointerup', 1, 80, 400));
  assert.equal(state.mode, 'idle');
  close(state.yaw, 1.76);
  close(state.zoom, 0.9);
});

test('pinching freezes progress and yaw, including two-finger translation', () => {
  let state = createGestureState({progress: 0.5, yaw: 2, zoom: 1});
  state = reduce(state, pointer('pointerdown', 1, 100, 100));
  state = reduce(state, pointer('pointerdown', 2, 200, 100));
  assert.equal(state.mode, 'pinch');
  state = reduce(state, pointer('pointermove', 1, 50, 90));
  state = reduce(state, pointer('pointermove', 2, 250, 90));
  close(state.zoom, 2);
  close(state.progress, 0.5);
  close(state.yaw, 2);
  state = reduce(state, pointer('pointermove', 1, 75, 150));
  state = reduce(state, pointer('pointermove', 2, 275, 150));
  close(state.zoom, 2);
  close(state.progress, 0.5);
  close(state.yaw, 2);
});

test('two-to-one finger transition starts at survivor coordinates without jumping', () => {
  let state = createGestureState({progress: 0.4});
  state = reduce(state, pointer('pointerdown', 1, 100, 100));
  state = reduce(state, pointer('pointermove', 1, 100, 20));
  const progress = state.progress;
  state = reduce(state, pointer('pointerdown', 2, 200, 20));
  state = reduce(state, pointer('pointermove', 2, 300, 20));
  close(state.zoom, 2);
  state = reduce(state, pointer('pointerup', 1, 100, 20));
  assert.equal(state.mode, 'pending');
  state = reduce(state, pointer('pointermove', 2, 300, 16));
  close(state.progress, progress);
  state = reduce(state, pointer('pointermove', 2, 300, 10));
  close(state.progress, progress + 10 / 9000);
  close(state.zoom, 2);
});

test('third-finger replacement rebases pinch when an original finger leaves', () => {
  let state = createGestureState({progress: 0.7, yaw: -0.6});
  state = reduce(state, pointer('pointerdown', 1, 0, 0));
  state = reduce(state, pointer('pointerdown', 2, 100, 0));
  state = reduce(state, pointer('pointermove', 2, 150, 0));
  state = reduce(state, pointer('pointerdown', 3, 300, 0));
  state = reduce(state, pointer('pointercancel', 1, 0, 0));
  close(state.zoom, 1.5);
  state = reduce(state, pointer('pointermove', 3, 350, 0));
  close(state.zoom, 2);
  close(state.progress, 0.7);
  close(state.yaw, -0.6);
});

test('resize rebase keeps progress and inspection while adopting the new scroll range', () => {
  let state = createGestureState({progress: 0.4, yaw: 3, zoom: 2});
  state = reduce(state, pointer('pointerdown', 1, 100, 100));
  state = reduce(state, pointer('pointermove', 1, 100, 80));
  const beforeResize = state.progress;
  state = reduce(state, {type: 'rebase', progress: beforeResize, yaw: 3, zoom: 2});
  state = reduce(state, pointer('pointermove', 1, 100, 80, {scrollRange: 4000}));
  close(state.progress, beforeResize);
  state = reduce(state, pointer('pointermove', 1, 100, 60, {scrollRange: 4000}));
  close(state.progress, beforeResize + 20 / 4000);
  close(state.yaw, 3);
  close(state.zoom, 2);
});

test('cancellation removes stale baselines and preserves inspection', () => {
  let state = createGestureState({progress: 0.6, yaw: 1, zoom: 2.2});
  state = reduce(state, pointer('pointerdown', 1, 0, 0));
  state = reduce(state, pointer('pointermove', 1, 20, 0));
  state = reduce(state, pointer('pointercancel', 1, 20, 0));
  assert.equal(state.mode, 'idle');
  assert.equal(state.pointers.length, 0);
  close(state.yaw, 1.24);
  const snapshot = structuredClone(state);
  assert.deepEqual(reduce(state, pointer('pointermove', 1, 500, 100)), snapshot);
  state = reduce(state, pointer('pointerdown', 2, 200, 100));
  state = reduce(state, {type: 'reset'});
  assert.equal(state.pointers.length, 0);
  close(state.progress, 0.6);
  close(state.yaw, 1.24);
  close(state.zoom, 2.2);
});

test('zoom is bounded while virtual cycle position remains unbounded', () => {
  close(zoomFromWheel(1, -100), Math.exp(0.2));
  close(zoomFromWheel(1, 100), Math.exp(-0.2));
  close(zoomFromWheel(1, 1, 1), Math.exp(-0.032));
  assert.equal(zoomFromWheel(1, -10000), 3);
  assert.equal(zoomFromWheel(1, 10000), 0.6);
  assert.equal(clampProgress(-1), 0);
  assert.equal(clampProgress(2), 1);
  assert.equal(clampZoom(NaN), 1);
  let state = createGestureState();
  state = reduce(state, pointer('pointerdown', 1, 0, 0));
  state = reduce(state, pointer('pointermove', 1, 0, -100000));
  close(state.progress, 100000 / 9000);
  state = reduce(state, pointer('pointermove', 1, 0, 100000));
  close(state.progress, -100000 / 9000);
});

test('gesture reducer is immutable and deterministic when replayed', () => {
  const events = [
    pointer('pointerdown', 1, 100, 100),
    pointer('pointermove', 1, 110, 102),
    pointer('pointerdown', 2, 150, 100),
    pointer('pointermove', 2, 160, 110),
    pointer('pointercancel', 1, 110, 102),
    pointer('pointermove', 2, 160, 90),
    pointer('pointerup', 2, 160, 90),
  ];
  const initial = createGestureState({progress: 0.2, yaw: 1.1});
  const snapshot = structuredClone(initial);
  const replay = () => events.reduce(reduce, initial);
  assert.deepEqual(replay(), replay());
  assert.deepEqual(initial, snapshot);
});

function browserHarness({reduced = false} = {}) {
  let clock = 0;
  let changes = 0;
  const listeners = new Map();
  const viewListeners = new Map();
  const documentListeners = new Map();
  const captures = new Set();
  const mediaListeners = new Map();
  const reducedMotion = {matches: reduced,
    addEventListener: (name, fn) => mediaListeners.set(name, fn),
    removeEventListener: name => mediaListeners.delete(name)};
  const view = {innerHeight: 800, matchMedia: () => reducedMotion,
    addEventListener: (name, fn) => viewListeners.set(name, fn), removeEventListener: name => viewListeners.delete(name)};
  const ownerDocument = {defaultView: view, hidden: false,
    addEventListener: (name, fn) => documentListeners.set(name, fn),
    removeEventListener: name => documentListeners.delete(name)};
  const canvas = {
    ownerDocument,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    setPointerCapture: id => captures.add(id),
    hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id),
  };
  const values = {progress: 0.4, yaw: 1, zoom: 1};
  const writes = [];
  const input = createInspectionInput({
    now: () => clock,
    onChange: () => {changes++;},
    canvas,
    getProgress: () => values.progress, setProgress: value => {values.progress = value; writes.push('progress');},
    getYaw: () => values.yaw, setYaw: value => {values.yaw = value; writes.push('yaw');},
    getZoom: () => values.zoom, setZoom: value => {values.zoom = value; writes.push('zoom');},
  });
  const send = (name, extra = {}) => {
    const event = {type: name, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100, button: 0, prevented: false, preventDefault() {this.prevented = true;}, ...extra};
    listeners.get(name)?.(event);
    return event;
  };
  return {input, values, writes, send, listeners, viewListeners, captures, ownerDocument, documentListeners,
    reducedMotion, mediaListeners, get changes() {return changes;},
    advance(ms) { clock += ms; return input.tick(clock); }, time(ms) { clock += ms; }};
}

test('browser adapter smooths virtual wheel, uses ctrl-wheel for zoom, and disposes captures/listeners', () => {
  const h = browserHarness();
  assert.equal(h.send('wheel', {ctrlKey: false, deltaY: 200}).prevented, true);
  assert.equal(h.writes.length, 0);
  assert.equal(h.send('wheel', {ctrlKey: true, deltaY: -100, deltaMode: 0}).prevented, true);
  assert.deepEqual(h.writes, ['zoom']);
  close(h.values.progress, 0.4);
  close(h.values.yaw, 1);
  h.send('pointerdown');
  assert.equal(h.captures.size, 1);
  h.input.dispose();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.viewListeners.size, 0);
  assert.equal(h.captures.size, 0);
});

test('browser adapter adopts current cycle position before new drag; blur cancellation leaves progress stable', () => {
  const h = browserHarness();
  h.values.progress = 0.8;
  h.send('pointerdown');
  h.send('pointermove', {clientY: 80});
  close(h.values.progress, 0.8 + 20 / 7200);
  const progress = h.values.progress;
  h.viewListeners.get('blur')();
  assert.equal(h.input.getState().pointerCount, 0);
  h.send('pointermove', {clientY: -100});
  close(h.values.progress, progress);
  h.input.dispose();
});

test('wheel target settles to exactly the delivered delta without a synthetic release fling', () => {
  const h = browserHarness();
  h.send('wheel', {deltaY: 7200, deltaMode: 0});
  assert.equal(h.input.getState().isMoving, true);
  for (let i = 0; i < 300; i++) h.advance(1000 / 60);
  close(h.values.progress, 1.4);
  assert.equal(h.input.getState().isMoving, false);
  assert.equal(h.input.getState().scrollVelocity, 0);
  h.send('wheel', {deltaY: -21600});
  for (let i = 0; i < 300; i++) h.advance(1000 / 60);
  close(h.values.progress, -1.6);
  h.input.dispose();
});

test('wheel reversal abandons outstanding forward travel promptly', () => {
  const h = browserHarness();
  h.send('wheel', {deltaY: 7200}); h.advance(20);
  const before = h.values.progress;
  h.send('wheel', {deltaY: -400}); h.advance(20);
  assert.ok(h.values.progress < before);
  h.input.dispose();
});

function releasedDrag(fps, horizontal = false) {
  const h = browserHarness();
  h.send('pointerdown'); h.time(20);
  h.send('pointermove', horizontal ? {clientX: 140} : {clientY: 60});
  h.time(20);
  h.send('pointermove', horizontal ? {clientX: 180} : {clientY: 20});
  h.send('pointerup');
  const release = {...h.values};
  for (let i = 0; i < fps; i++) h.advance(1000 / fps);
  const result = {...h.values};
  h.input.dispose();
  return {release, result};
}

test('scroll and axial spin release coast identically at 30, 60 and 120 Hz', () => {
  for (const horizontal of [false, true]) {
    const reference = releasedDrag(30, horizontal);
    assert.ok(horizontal ? reference.result.yaw > reference.release.yaw : reference.result.progress > reference.release.progress);
    for (const fps of [60, 120]) {
      const sample = releasedDrag(fps, horizontal);
      close(sample.result.progress, reference.result.progress);
      close(sample.result.yaw, reference.result.yaw);
    }
  }
});

test('paused release, cancellation, pinch and immediate seek cancel momentum', () => {
  const h = browserHarness();
  h.send('pointerdown'); h.time(20); h.send('pointermove', {clientX: 160});
  h.time(100); h.send('pointerup');
  assert.equal(h.input.getState().isMoving, false);
  h.send('wheel', {deltaY: 1000});
  h.input.seek(-3.75);
  assert.equal(h.input.getState().isMoving, false);
  close(h.values.progress, -3.75);
  h.send('wheel', {deltaY: 1000});
  h.send('pointerdown');
  h.send('pointerdown', {pointerId: 2, clientX: 200});
  assert.equal(h.input.getState().isMoving, false);
  assert.equal(h.input.getState().mode, 'pinch');
  h.send('pointercancel');
  assert.equal(h.input.getState().scrollVelocity, 0);
  h.input.dispose();
});

test('wheel line/page modes normalize and keyboard has no finite endpoint', () => {
  const h = browserHarness();
  h.input.seek(-2);
  h.send('wheel', {deltaY: 2, deltaMode: 1});
  close(h.input.getState().targetCyclePosition, -2 + 32 / 7200);
  h.input.seek(3);
  h.send('wheel', {deltaY: 2, deltaMode: 2});
  close(h.input.getState().targetCyclePosition, 3 + 1600 / 7200);
  h.input.cancelMomentum();
  h.viewListeners.get('keydown')({key: 'ArrowUp', preventDefault() {}});
  close(h.input.getState().targetCyclePosition, 3 - 80 / 7200);
  h.input.dispose();
});

test('backgrounding discards the coasting tail instead of fast-forwarding on return', () => {
  const h = browserHarness();
  h.send('wheel', {deltaY: 3000}); h.advance(20);
  const before = h.values.progress;
  h.ownerDocument.hidden = true;
  h.documentListeners.get('visibilitychange')();
  h.advance(60000);
  close(h.values.progress, before);
  assert.equal(h.input.getState().isMoving, false);
  h.ownerDocument.hidden = false;
  h.documentListeners.get('visibilitychange')();
  h.send('wheel', {deltaY: 100}); h.advance(20);
  assert.ok(h.values.progress > before);
  h.input.dispose();
  assert.equal(h.documentListeners.size, 0);
});

test('root-owned RAF ticks never issue recursive render notifications', () => {
  const h = browserHarness();
  h.send('wheel', {deltaY: 1000});
  const startChanges = h.changes;
  for (let i = 0; i < 300; i++) h.advance(1000 / 60);
  assert.equal(h.changes, startChanges);
  assert.equal(h.input.getState().isMoving, false);
  h.input.dispose();
});

test('fast reversed drag releases in its latest direction', () => {
  for (const horizontal of [false, true]) {
    const h = browserHarness();
    h.send('pointerdown'); h.time(20);
    h.send('pointermove', horizontal ? {clientX: 180} : {clientY: 20});
    h.time(20);
    h.send('pointermove', horizontal ? {clientX: 170} : {clientY: 30});
    h.send('pointerup');
    assert.ok(horizontal ? h.input.getState().yawVelocity < 0 : h.input.getState().scrollVelocity < 0);
    const before = {...h.values}; h.advance(20);
    assert.ok(horizontal ? h.values.yaw < before.yaw : h.values.progress < before.progress);
    h.input.dispose();
  }
});

test('reduced motion disables wheel smoothing and release coast; toggling cancels existing inertia', () => {
  const h = browserHarness({reduced: true});
  h.send('wheel', {deltaY: 7200});
  close(h.values.progress, 1.4);
  assert.equal(h.input.getState().isMoving, false);
  h.send('pointerdown'); h.time(20); h.send('pointermove', {clientX: 180}); h.send('pointerup');
  assert.equal(h.input.getState().isMoving, false);
  h.reducedMotion.matches = false;
  h.send('wheel', {deltaY: 1000});
  assert.equal(h.input.getState().isMoving, true);
  h.reducedMotion.matches = true;
  h.mediaListeners.get('change')();
  assert.equal(h.input.getState().isMoving, false);
  h.input.dispose();
  assert.equal(h.mediaListeners.size, 0);
});
