import test from 'node:test';
import assert from 'node:assert/strict';
import {awaitSceneReady, compileSceneShaders} from '../assets/scene-readiness.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};
function fixture() {
  let time = 0, nextId = 0;
  const timers = new Map(), listeners = new Set();
  const doc = {hidden: false, addEventListener: (name, callback) => listeners.add(callback), removeEventListener: (name, callback) => listeners.delete(callback)};
  const environment = {document: doc, performance: {now: () => time},
    setTimeout: (callback, delay) => { const id = nextId++; timers.set(id, {callback, due: time + delay}); return id; },
    clearTimeout: id => timers.delete(id)};
  const advance = async amount => {
    const end = time + amount;
    while (true) {
      const next = [...timers].filter(([, task]) => task.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      time = next[1].due; timers.delete(next[0]); next[1].callback(); await Promise.resolve();
    }
    time = end; await Promise.resolve();
  };
  const hide = hidden => { doc.hidden = hidden; for (const listener of [...listeners]) listener(); };
  return {environment, doc, timers, listeners, advance, hide};
}

test('a scene that never becomes ready expires after its foreground preparation budget', async () => {
  const f = fixture(), task = deferred();
  const checked = awaitSceneReady(task.promise, {environment: f.environment, timeoutMs: 1000});
  const rejected = assert.rejects(checked, error => error.name === 'SceneReadinessTimeoutError' && error.code === 'SCENE_READY_TIMEOUT' && error.timeoutMs === 1000);
  await f.advance(999); assert.equal(f.timers.size, 1);
  await f.advance(1); await rejected;
  assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
});

test('a completed scene returns its value and clears every readiness observer', async () => {
  const f = fixture(), task = deferred(), view = {ready: true};
  const checked = awaitSceneReady(task.promise, {environment: f.environment});
  assert.equal(f.timers.size, 1); assert.equal(f.listeners.size, 1);
  task.resolve(view); assert.equal(await checked, view);
  assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
  await f.advance(60000); assert.equal(f.timers.size, 0);
});

test('a genuine scene failure is preserved and does not leave a later timeout', async () => {
  const f = fixture(), task = deferred(), failure = new Error('Original SVG could not decode');
  const checked = awaitSceneReady(task.promise, {environment: f.environment});
  task.reject(failure); await assert.rejects(checked, error => error === failure);
  assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
});

test('hidden tabs and an explicit inspection pause preserve the remaining foreground time', async () => {
  const f = fixture(), task = deferred(); let paused = false;
  const checked = awaitSceneReady(task.promise, {environment: f.environment, timeoutMs: 1000, isPaused: () => paused});
  const rejected = assert.rejects(checked, {code: 'SCENE_READY_TIMEOUT'});
  await f.advance(250); f.hide(true); await f.advance(30000);
  assert.equal(f.timers.size, 1, 'hidden time does not expire the original budget');
  paused = true; f.hide(false); await f.advance(10000);
  paused = false; await f.advance(250); // Poll observes the owner resuming.
  await f.advance(749); assert.equal(f.timers.size, 1);
  await f.advance(1); await rejected;
  assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
});

test('aborting preparation cleans up and ignores both late success and late rejection', async () => {
  for (const rejectLate of [false, true]) {
    const f = fixture(), task = deferred(), controller = new AbortController(), reason = new Error('Page was suspended');
    const checked = awaitSceneReady(task.promise, {environment: f.environment, signal: controller.signal});
    controller.abort(reason); await assert.rejects(checked, error => error === reason);
    assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
    if (rejectLate) task.reject(new Error('Obsolete shader failure')); else task.resolve({obsolete: true});
    await f.advance(60000); assert.equal(f.timers.size, 0);
  }
});

test('an already-aborted view never schedules work and its rejected result remains handled', async () => {
  const f = fixture(), controller = new AbortController(); controller.abort();
  await assert.rejects(awaitSceneReady(Promise.reject(new Error('Late GPU error')), {environment: f.environment, signal: controller.signal}), {name: 'AbortError'});
  assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
});

test('mobile shader preparation uses the synchronous path without starting a parallel GPU poll', async () => {
  const f = fixture(), scene = {}, camera = {}, calls = [];
  const renderer = {compile: (...args) => calls.push(['compile', ...args]), compileAsync: () => { throw new Error('Parallel compilation must not start'); }};
  assert.equal(await compileSceneShaders(renderer, scene, camera, {parallel: false, environment: f.environment}), 'synchronous');
  assert.deepEqual(calls, [['compile', scene, camera]]);
  assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
});

test('desktop shader preparation settles through its completed parallel program set', async () => {
  const f = fixture(), task = deferred(), scene = {}, camera = {}, calls = [];
  const renderer = {compile: () => calls.push('unexpected sync'), compileAsync: (...args) => { calls.push(args); return task.promise; }};
  const checked = compileSceneShaders(renderer, scene, camera, {environment: f.environment});
  await Promise.resolve(); assert.deepEqual(calls, [[scene, camera]]);
  task.resolve(scene); assert.equal(await checked, 'parallel');
  assert.deepEqual(calls, [[scene, camera]]); assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
});

test('a stuck parallel driver recovers once after 6000 foreground milliseconds and ignores its late result', async () => {
  const f = fixture(), task = deferred(), scene = {}, camera = {}, calls = [];
  const renderer = {compile: (...args) => calls.push(['sync', ...args]), compileAsync: (...args) => { calls.push(['async', ...args]); return task.promise; }};
  const checked = compileSceneShaders(renderer, scene, camera, {environment: f.environment});
  await Promise.resolve(); await f.advance(1500); f.hide(true); await f.advance(30000);
  assert.deepEqual(calls, [['async', scene, camera]], 'background time does not trigger GPU recovery');
  f.hide(false); await f.advance(4499); assert.equal(calls.length, 1);
  await f.advance(1); assert.equal(await checked, 'synchronous-recovery');
  assert.deepEqual(calls, [['async', scene, camera], ['sync', scene, camera]]);
  assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
  task.resolve(scene); await f.advance(10000); assert.equal(calls.length, 2);
});

test('aborting a pending shader warmup never invokes synchronous recovery', async () => {
  const f = fixture(), task = deferred(), controller = new AbortController(), reason = new Error('The renderer was disposed'); let asynchronous = 0, synchronous = 0;
  const renderer = {compile: () => synchronous++, compileAsync: () => { asynchronous++; return task.promise; }};
  const checked = compileSceneShaders(renderer, {}, {}, {environment: f.environment, signal: controller.signal});
  await Promise.resolve(); await f.advance(1000); controller.abort(reason);
  await assert.rejects(checked, error => error === reason);
  assert.equal(asynchronous, 1); assert.equal(synchronous, 0); assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
  task.reject(new Error('Obsolete shader response')); await f.advance(10000); assert.equal(synchronous, 0);
});

test('a cancelled shader mount does not start queued or synchronous GPU work', async () => {
  for (const parallel of [false, true]) for (const alreadyAborted of [false, true]) {
    const f = fixture(), controller = new AbortController(); let gpuCalls = 0;
    const renderer = {compile: () => gpuCalls++, compileAsync: () => { gpuCalls++; return Promise.resolve(); }};
    if (alreadyAborted) controller.abort();
    if (!parallel && !alreadyAborted) continue; // Synchronous work starts before a later abort can occur.
    const checked = compileSceneShaders(renderer, {}, {}, {parallel, environment: f.environment, signal: controller.signal});
    if (!alreadyAborted) controller.abort();
    await assert.rejects(checked, {name: 'AbortError'});
    assert.equal(gpuCalls, 0); assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
  }
});

test('actual shader compilation errors propagate without hiding the failed program behind recovery', async () => {
  for (const parallel of [false, true]) {
    const f = fixture(), failure = new Error('Shader link failed'); let syncCalls = 0;
    const renderer = {compile: () => { syncCalls++; throw failure; }, compileAsync: () => Promise.reject(failure)};
    await assert.rejects(compileSceneShaders(renderer, {}, {}, {parallel, environment: f.environment}), error => error === failure);
    assert.equal(syncCalls, parallel ? 0 : 1); assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
  }
});
