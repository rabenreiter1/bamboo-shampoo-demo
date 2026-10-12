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

test('pinch and gesture bounds are finite and respect zoom/progress limits', () => {
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
  assert.equal(state.progress, 1);
  state = reduce(state, pointer('pointermove', 1, 0, 100000));
  assert.equal(state.progress, 0);
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

function browserHarness() {
  const listeners = new Map();
  const viewListeners = new Map();
  const captures = new Set();
  const view = {innerHeight: 800, addEventListener: (name, fn) => viewListeners.set(name, fn), removeEventListener: name => viewListeners.delete(name)};
  const canvas = {
    ownerDocument: {defaultView: view, scrollingElement: {scrollHeight: 8000}},
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    setPointerCapture: id => captures.add(id),
    hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id),
  };
  const values = {progress: 0.4, yaw: 1, zoom: 1};
  const writes = [];
  const input = createInspectionInput({
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
  return {input, values, writes, send, listeners, viewListeners, captures};
}

test('browser adapter leaves wheel native, uses ctrl-wheel for zoom, and disposes captures/listeners', () => {
  const h = browserHarness();
  assert.equal(h.send('wheel', {ctrlKey: false, deltaY: 200}).prevented, false);
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

test('browser adapter uses native scroll before new drag; blur cancellation leaves progress stable', () => {
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
