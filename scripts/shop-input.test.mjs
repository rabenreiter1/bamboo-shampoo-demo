import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/shop-scene.js', import.meta.url), 'utf8');
function productionFunction(start, next) {
  const offset = source.indexOf(`  function ${start}`);
  const end = source.indexOf(next, offset);
  assert.ok(offset >= 0 && end > offset, `Missing production handler ${start}`);
  return source.slice(offset, end);
}

// Run the actual production input/cancellation handlers against an event and
// pointer-capture surface. This checks state ownership; it does not emulate GPU
// rendering, native browser gesture arbitration, or physical-device timing.
function harness({ inspection = true, synchronousLostCapture = false } = {}) {
  const listeners = new Map(), captures = new Set(), raf = new Map();
  let nextFrame = 1, clock = 100;
  const rectangle = { width: 320, height: 240, left: 0, top: 0, right: 320, bottom: 240 };
  const canvas = {
    style: { cursor: 'grab' },
    setPointerCapture(id) { captures.add(id); },
    releasePointerCapture(id) {
      if (!captures.delete(id)) return;
      if (synchronousLostCapture) emit('lostpointercapture', id);
    },
  };
  const container = { getBoundingClientRect: () => rectangle, dispatchEvent() {} };
  const context = vm.createContext({
    options: { inspection }, renderer: { domElement: canvas }, camera: {}, container,
    document: { hidden: false, documentElement: { clientWidth: 800, clientHeight: 600 } },
    window: { innerWidth: 800, innerHeight: 600 },
    clamp: (value, lo, hi) => Math.min(hi, Math.max(lo, value)),
    finite: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    listen(target, type, handler) { listeners.set(type, handler); },
    requestAnimationFrame(callback) { const id = nextFrame++; raf.set(id, callback); return id; },
    cancelAnimationFrame(id) { raf.delete(id); },
    syncSize() {}, report() {}, render() {}, CustomEvent: class {},
  });
  vm.runInContext(`
    let pointer = null, yawVelocity = 0, manualYaw = 0, zoom = 1;
    const fingers = new Map(); let pinch = null;
    let disposed = false, ready = true, paused = false, error = null, rendered = true, warming = false, mode = 'ritual';
    let width = 320, height = 240, inView = true, frame = 0, lastTick = 0, previousMovingTimestamp = 0;
    let renderPending = false, reducedMotion = false, staticCameraDirty = false;
    ${productionFunction('withinViewport(rect)', '  function visibleNow()')}
    ${productionFunction('visibleNow()', '  const active =')}
    const active = () => !disposed && !paused && ready && !document.hidden && visibleNow() && width > 0 && height > 0;
    ${productionFunction('stopMomentum()', '  function cancelFrame()')}
    ${productionFunction('cancelFrame()', '  function requestRender()')}
    ${productionFunction('requestRender()', '  function fitStaticCamera()')}
    ${productionFunction('viewportChanged()', '  function setProgress(')}
    ${productionFunction('setZoom(value)', '  function setPaused(')}
    ${productionFunction('setPaused(value)', '  // Commerce scenes')}
    ${productionFunction('installInput(canvas)', '  function fail(')}
    ${productionFunction('fail(failure)', '  function makeEnvironment()')}
    installInput(renderer.domElement);
    globalThis.pause = value => setPaused(value);
    globalThis.cancel = () => { stopMomentum(); cancelFrame(); };
    globalThis.viewportChanged = viewportChanged;
    globalThis.fail = fail;
    globalThis.snapshot = () => JSON.stringify({ pointer, yawVelocity, manualYaw, zoom,
      fingers: [...fingers.keys()], pinch, paused, ready, frame, renderPending });
  `, context);
  function emit(type, id = 1, x = 0, y = 0, settings = {}) {
    clock += 16;
    const event = { type, pointerId: id, button: 0, isPrimary: id === 1,
      clientX: x, clientY: y, timeStamp: clock, preventDefault() { this.prevented = true; }, ...settings };
    listeners.get(type)?.(event);
    return event;
  }
  return { emit, captures, raf, rectangle, context, state: () => JSON.parse(context.snapshot()) };
}

test('first inspector finger survives cancellation setup and a horizontal release keeps inertia', () => {
  const h = harness({ synchronousLostCapture: true });
  h.emit('pointerdown', 1);
  assert.deepEqual(h.state().fingers, [1]); assert.equal(h.state().pointer.id, 1);
  assert.deepEqual([...h.captures], [1]);
  h.emit('pointermove', 1, 40);
  assert.ok(Math.abs(h.state().manualYaw - .4) < 1e-8);
  h.emit('pointerup', 1, 40);
  assert.deepEqual(h.state().fingers, []); assert.equal(h.state().pointer, null);
  assert.equal(h.captures.size, 0); assert.ok(h.state().yawVelocity > 0);
  const velocity = h.state().yawVelocity;
  h.emit('lostpointercapture', 1);
  assert.equal(h.state().yawVelocity, velocity);
});

test('a second finger retains both captures and pinch release rebases the surviving drag', () => {
  const h = harness();
  h.emit('pointerdown', 1, 0); h.emit('pointerdown', 2, 100);
  assert.deepEqual(h.state().fingers, [1, 2]); assert.equal(h.state().pointer, null);
  assert.deepEqual([...h.captures], [1, 2]);
  h.emit('pointermove', 2, 200);
  assert.equal(h.state().zoom, 2);
  h.emit('pointerup', 2, 200);
  assert.deepEqual(h.state().fingers, [1]); assert.equal(h.state().pinch, null);
  assert.equal(h.state().pointer.id, 1); assert.equal(h.state().pointer.lastX, 0);
  h.emit('lostpointercapture', 2);
  h.emit('pointermove', 1, 20);
  assert.ok(Math.abs(h.state().manualYaw - .2) < 1e-8);
  assert.equal(h.state().zoom, 2);
});

test('pause cancels all fingers and frames before capture loss, then accepts a fresh single drag', () => {
  const h = harness({ synchronousLostCapture: true });
  h.emit('pointerdown', 1, 0); h.emit('pointerdown', 2, 100); h.emit('pointermove', 2, 150);
  assert.equal(h.state().zoom, 1.5); assert.equal(h.raf.size, 1);
  h.context.pause(true);
  assert.deepEqual(h.state().fingers, []); assert.equal(h.state().pinch, null);
  assert.equal(h.state().pointer, null); assert.equal(h.state().yawVelocity, 0);
  assert.equal(h.captures.size, 0); assert.equal(h.raf.size, 0);
  h.context.pause(false); assert.equal(h.raf.size, 1);
  h.emit('pointerdown', 3, 100); h.emit('pointermove', 3, 130);
  assert.deepEqual(h.state().fingers, [3]); assert.equal(h.state().pointer.id, 3);
  assert.ok(Math.abs(h.state().manualYaw - .3) < 1e-8); assert.equal(h.state().zoom, 1.5);
});

test('late capture-loss events cannot change a newer pinch, including a three-finger handoff', () => {
  const h = harness();
  h.emit('pointerdown', 1, 0); h.emit('pointerdown', 2, 100); h.context.cancel();
  h.emit('pointerdown', 3, 0); h.emit('pointerdown', 4, 100); h.emit('pointermove', 4, 150);
  const active = h.state();
  h.emit('lostpointercapture', 1); h.emit('lostpointercapture', 2);
  assert.deepEqual(h.state().pinch, active.pinch); assert.deepEqual(h.state().fingers, [3, 4]);
  h.emit('pointerdown', 5, 250); h.emit('pointerup', 5, 250);
  assert.deepEqual(h.state().fingers, [3, 4]); assert.ok(h.state().pinch);
  h.emit('pointermove', 4, 200);
  assert.equal(h.state().zoom, 2); assert.equal(h.state().manualYaw, 0);
});

test('offscreen and context-failure cancellation clear gestures without leaving a background frame', () => {
  for (const path of ['offscreen', 'failure']) {
    const h = harness({ synchronousLostCapture: true });
    h.emit('pointerdown', 1, 0); h.emit('pointerdown', 2, 100); h.emit('pointermove', 2, 150);
    if (path === 'offscreen') { h.rectangle.left = -500; h.rectangle.right = -180; h.context.viewportChanged(); }
    else h.context.fail(new Error('Simulated context loss'));
    assert.deepEqual(h.state().fingers, []); assert.equal(h.state().pinch, null);
    assert.equal(h.state().pointer, null); assert.equal(h.captures.size, 0); assert.equal(h.raf.size, 0);
  }
  assert.match(source, /listen\(window, 'blur', \(\) => \{ stopMomentum\(\); cancelFrame\(\); \}\)/);
  assert.match(source, /if \(document\.hidden\) \{ stopMomentum\(\); cancelFrame\(\); \}/);
});

test('commerce input keeps native vertical scrolling and rejects a nonprimary second pointer', () => {
  const h = harness({ inspection: false });
  h.emit('pointerdown', 1, 0); h.emit('pointerdown', 2, 100);
  assert.equal(h.state().pointer.id, 1); assert.deepEqual(h.state().fingers, []);
  const vertical = h.emit('pointermove', 1, 2, 80);
  assert.equal(h.state().pointer.axis, 'vertical'); assert.equal(vertical.prevented, undefined);
  assert.equal(h.state().manualYaw, 0); assert.equal(h.captures.size, 0);
  h.emit('pointercancel', 1, 2, 80); assert.equal(h.state().pointer, null);
  h.emit('pointerdown', 1, 0); h.emit('pointermove', 1, 30);
  assert.ok(Math.abs(h.state().manualYaw - .3) < 1e-8); assert.equal(h.captures.size, 1);
});
