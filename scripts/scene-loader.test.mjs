import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneLoader } from '../assets/scene-loader.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture(settings = {}) {
  const timers = new Map(), documentEvents = new Map(), windowEvents = new Map();
  let nextTimer = 0, observer;
  const win = { innerWidth: 390, innerHeight: 844,
    addEventListener: (name, callback) => windowEvents.set(name, callback),
    removeEventListener: name => windowEvents.delete(name) };
  const doc = { hidden: false, documentElement: {},
    addEventListener: (name, callback) => documentEvents.set(name, callback),
    removeEventListener: name => documentEvents.delete(name) };
  class Observer {
    constructor(callback, options) { Object.assign(this, { callback, options, targets: new Set(), disconnected: false }); observer = this; }
    observe(element) { this.targets.add(element); }
    unobserve(element) { this.targets.delete(element); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
    emit(element, isIntersecting) { this.callback([{ target: element, isIntersecting }]); }
  }
  const environment = { window: win, document: doc, navigator: { connection: { saveData: settings.saveData === true } },
    ...(settings.observer === false ? {} : { IntersectionObserver: Observer }),
    setTimeout: callback => { const id = nextTimer++; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id) };
  const element = (top, height = 400) => {
    const rect = { top, bottom: top + height, left: 0, right: 390, width: 390, height };
    return { rect, getBoundingClientRect: () => rect };
  };
  const tick = async () => { const tasks = [...timers.values()]; timers.clear(); tasks.forEach(callback => callback()); await settle(); };
  return { environment, win, doc, documentEvents, windowEvents, element, tick, observer: () => observer, timers };
}

test('the visible product warms first, and the next GPU mount waits for complete readiness', async () => {
  const f = fixture(), calls = [], pending = [];
  const loader = createSceneLoader({ environment: f.environment, mount: element => {
    calls.push(element); const task = deferred(); pending.push(task); return task.promise;
  } });
  const near = f.element(1000), hero = f.element(80), far = f.element(3500);
  loader.observe(near); loader.observe(far); loader.observe(hero);
  await f.tick(); assert.deepEqual(calls, [hero]);
  await f.tick(); assert.deepEqual(calls, [hero], 'queued work cannot overlap a shader warmup');
  pending[0].resolve({}); await settle(); await f.tick(); assert.deepEqual(calls, [hero, near]);
  pending[1].resolve({}); await settle(); await f.tick();
  assert.equal(loader.getState(far).status, 'idle');
  assert.equal(loader.getState(hero).status, 'mounted'); loader.destroy();
});

test('direct product interaction promotes its viewer without a duplicate mount', async () => {
  const f = fixture(), calls = [], task = deferred();
  const loader = createSceneLoader({ environment: f.environment, mount: element => {
    calls.push(element); return calls.length === 1 ? task.promise : Promise.resolve({});
  } });
  const hero = f.element(0), next = f.element(950), chosen = f.element(5000);
  loader.observe(hero); loader.observe(next); loader.observe(chosen); await f.tick();
  loader.request(chosen); loader.request(chosen); task.resolve({}); await settle(); await f.tick();
  assert.deepEqual(calls, [hero, chosen]); await f.tick(); assert.deepEqual(calls, [hero, chosen, next]);
  loader.request(chosen); await f.tick(); assert.equal(calls.filter(element => element === chosen).length, 1); loader.destroy();
});

test('a queued view that moves out of range does not spend GPU work', async () => {
  const f = fixture(), calls = [];
  const loader = createSceneLoader({ environment: f.environment, mount: element => { calls.push(element); return Promise.resolve({}); } });
  const element = f.element(1000); loader.observe(element);
  Object.assign(element.rect, { top: 3000, bottom: 3400 }); f.observer().emit(element, false); await f.tick();
  assert.equal(calls.length, 0); assert.equal(loader.getState(element).status, 'idle');
  Object.assign(element.rect, { top: 600, bottom: 1000 }); f.observer().emit(element, true); await f.tick();
  assert.deepEqual(calls, [element]); loader.destroy();
});

test('save-data avoids anticipatory loading while preserving interaction and visible 3D', async () => {
  const f = fixture({ saveData: true }), calls = [];
  const loader = createSceneLoader({ environment: f.environment, mount: element => { calls.push(element); return Promise.resolve({}); } });
  const visible = f.element(40), approaching = f.element(900);
  loader.observe(approaching); loader.observe(visible); await f.tick(); await f.tick();
  assert.deepEqual(calls, [visible]); assert.equal(f.observer().options.rootMargin, '0px');
  loader.request(approaching); await f.tick(); assert.deepEqual(calls, [visible, approaching]); loader.destroy();
});

test('a hidden page queues work until visibility returns', async () => {
  const f = fixture(), calls = []; f.doc.hidden = true;
  const loader = createSceneLoader({ environment: f.environment, mount: element => { calls.push(element); return Promise.resolve({}); } });
  const element = f.element(0); loader.observe(element); await f.tick(); assert.equal(calls.length, 0);
  f.doc.hidden = false; f.documentEvents.get('visibilitychange')(); await f.tick(); assert.deepEqual(calls, [element]); loader.destroy();
});

test('page restoration waits for and disposes a stale pending viewer before replacing it', async () => {
  const f = fixture(), calls = [], first = deferred(); let staleDisposed = 0;
  const loader = createSceneLoader({ environment: f.environment, mount: element => {
    calls.push(element); return calls.length === 1 ? first.promise : Promise.resolve({});
  } });
  const element = f.element(0); loader.observe(element); await f.tick(); loader.suspend(); loader.resume({ reset: true });
  await f.tick(); assert.equal(calls.length, 1, 'the old context is still loading');
  first.resolve({ destroy: () => staleDisposed++ }); await settle(); await f.tick();
  assert.equal(staleDisposed, 1); assert.equal(calls.length, 2); assert.equal(loader.getState(element).status, 'mounted'); loader.destroy();
});

test('a failed viewer does not block another, and is only retried explicitly', async () => {
  const f = fixture(), failed = f.element(0), good = f.element(600), reports = []; let failures = 0;
  const loader = createSceneLoader({ environment: f.environment, onError: (error, element) => reports.push([error.message, element]),
    mount: element => element === failed && failures++ === 0 ? Promise.reject(new Error('No graphics context')) : Promise.resolve({}) });
  loader.observe(failed); loader.observe(good); await f.tick(); await f.tick();
  assert.equal(loader.getState(failed).status, 'error'); assert.equal(loader.getState(good).status, 'mounted');
  f.observer().emit(failed, true); await f.tick(); assert.equal(failures, 1);
  assert.deepEqual(reports, [['No graphics context', failed]]);
  loader.retry(failed); await f.tick(); assert.equal(failures, 2); assert.equal(loader.getState(failed).status, 'mounted'); loader.destroy();
});

test('intentional image fallback can be retried after a motion-preference change', async () => {
  const f = fixture(), element = f.element(0); let reduced = true, calls = 0;
  const loader = createSceneLoader({ environment: f.environment, mount: () => { calls++; return reduced ? undefined : {}; } });
  loader.observe(element); await f.tick(); assert.equal(loader.getState(element).status, 'deferred');
  f.observer().emit(element, true); await f.tick(); assert.equal(calls, 1);
  reduced = false; loader.retry(element); await f.tick(); assert.equal(calls, 2);
  assert.equal(loader.getState(element).status, 'mounted'); loader.destroy();
});

test('a page-reported model error remains retryable even when the page consumes the rejection', async () => {
  const f = fixture(), element = f.element(0); element.dataset = { sceneStatus: 'error', sceneError: 'Context unavailable' };
  let fail = true;
  const loader = createSceneLoader({ environment: f.environment, mount: () => fail ? undefined : {} });
  loader.observe(element); await f.tick(); assert.equal(loader.getState(element).status, 'error');
  assert.equal(loader.getState(element).error, 'Context unavailable');
  fail = false; element.dataset.sceneStatus = 'loading'; loader.retry(element); await f.tick();
  assert.equal(loader.getState(element).status, 'mounted'); loader.destroy();
});

test('preference changes can discard an entry and retry without duplicating live contexts', async () => {
  const f = fixture(), element = f.element(0); let calls = 0;
  const loader = createSceneLoader({ environment: f.environment, mount: () => { calls++; return {}; } });
  loader.observe(element); await f.tick(); assert.equal(calls, 1);
  loader.request(element); await f.tick(); assert.equal(calls, 1, 'ordinary requests never duplicate a ready context');
  loader.retry(element); await f.tick(); assert.equal(calls, 1, 'retry is also restricted for an existing live view');
  loader.unobserve(element); loader.retry(element); await f.tick();
  assert.equal(calls, 2); assert.equal(loader.getState(element).status, 'mounted'); loader.destroy();
});

test('geometry refresh supports scrolling when IntersectionObserver is unavailable', async () => {
  const f = fixture({ observer: false }), calls = [];
  const loader = createSceneLoader({ environment: f.environment, mount: element => { calls.push(element); return Promise.resolve({}); } });
  const element = f.element(4000); loader.observe(element); await f.tick(); assert.equal(calls.length, 0);
  Object.assign(element.rect, { top: 900, bottom: 1300 }); f.windowEvents.get('scroll')(); await f.tick();
  assert.deepEqual(calls, [element]); loader.destroy(); assert.equal(f.windowEvents.size, 0);
});

test('removing or destroying a queued loader cleans up wake-ups and late results', async () => {
  const f = fixture(), pending = deferred(); let disposed = 0;
  const loader = createSceneLoader({ environment: f.environment, mount: () => pending.promise });
  const element = f.element(0), unused = f.element(900); loader.observe(element); loader.observe(unused); loader.unobserve(unused); await f.tick();
  assert.equal(loader.getState(unused), null); loader.destroy();
  pending.resolve({ destroy: () => disposed++ }); await settle(); await f.tick();
  assert.equal(disposed, 1); assert.equal(f.documentEvents.size, 0); assert.equal(f.windowEvents.size, 0);
  assert.equal(f.observer().disconnected, true); assert.equal(loader.request(element), false);
});
