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
  for (const q of [.03, .1, .2, .31, .54, .77, .88, .98]) assert.deepEqual(frame(q), frame(q), 'pausing does not advance a separate type timer');
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
  for (const q of [0, .06, .15, .27, .35, .72, .83, .96, 1]) assert.ok(Math.abs(journeyScrollProgress(header - q * travel, track, stage, header) - q) < 1e-12);
  assert.equal(journeyScrollProgress(900, track, stage, header), 0);
  assert.equal(journeyScrollProgress(-20000, track, stage, header), 1);
  assert.equal(journeyScrollProgress(NaN, track, stage, header), 0);
});

test('the controller prepares the closed product caption and reverses its active reading state with the model', () => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  const classList = () => {
    const classes = new Set();
    return { add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); }, contains: name => classes.has(name),
      toggle(name, value) { const on = value ?? !classes.has(name); if (on) classes.add(name); else classes.delete(name); return on; } };
  };
  const captions = JOURNEY_PHASES.map(phase => ({ dataset: { journeyCaption: phase.id, chapterLabel: phase.id },
    classList: classList(), inert: false, attributes: new Map(), properties: new Map(),
    setAttribute(name,value) { this.attributes.set(name,value); }, removeAttribute(name) { this.attributes.delete(name); },
    style: { setProperty() {}, removeProperty() {} } }));
  const current = { textContent: '' }, stage = { getBoundingClientRect: () => ({ width:390,height:780 }) };
  const section = { dataset: {}, classList: classList(), style: { setProperty() {} },
    querySelector: selector => selector === '[data-shop-scene="journey"]' || selector === '.product-journey__sticky' ? stage : selector === '[data-journey-current]' ? current : null,
    querySelectorAll: selector => selector === '[data-journey-caption]' ? captions : [],
    getBoundingClientRect: () => ({ top:64,height:8440,bottom:8504 }) };
  globalThis.window = { scrollY:0, addEventListener() {}, removeEventListener() {}, scrollTo() {} };
  globalThis.document = { documentElement: { clientWidth:390,lang:'de' }, querySelector: selector => selector === '.header' ? { offsetHeight:64 } : null };
  try {
    const controller = initializeProductJourney(section); controller.prepare();
    assert.equal(captions[0].inert,false); assert.equal(captions[0].attributes.get('aria-hidden'),'false');
    assert.ok(captions[0].classList.contains('is-visible'));
    for (const q of [0,.11,.2,.31,.54,.77,.88,.98,.2,.03]) {
      const pose = computeJourneyPose(q); controller.enhance(pose);
      assert.equal(section.dataset.journeyPhase,pose.phase); assert.equal(current.textContent,pose.phase);
      for (const caption of captions) {
        const active = caption.dataset.journeyCaption === pose.phase;
        assert.equal(caption.inert,!active); assert.equal(caption.attributes.get('aria-hidden'),String(!active));
        assert.equal(caption.classList.contains('is-active'),active);
      }
    }
    controller.fallback();
    for (const caption of captions) { assert.equal(caption.inert,false); assert.equal(caption.attributes.has('aria-hidden'),false); }
    controller.suspend();
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
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
    controller.enhance({ q: .77, phase: 'remove' });
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


test('chapter markers have correct native-scroll targets before the first model frame and after resize', () => {
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  const geometry={width:390,stage:700,track:6700,top:1500,header:64};
  const classes=new Set(),events=new Map();
  const markers=[.07,.16,.36,.735].map((at,index)=>({dataset:{journeyAt:String(at),journeyUntil:String([.15,.27,.72,.96][index])},style:{removeProperty(name){delete this[name];}}}));
  const stage={getBoundingClientRect:()=>({height:geometry.stage})};
  const view={scrollY:0,addEventListener(name,fn){events.set(name,fn);},removeEventListener(name){events.delete(name);},scrollTo({top}){this.scrollY=top;}};
  const section={dataset:{},style:{setProperty(){}},classList:{add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));},contains:name=>classes.has(name)},
    getBoundingClientRect:()=>({top:geometry.top-view.scrollY,height:geometry.track,bottom:geometry.top-view.scrollY+geometry.track}),
    querySelector:selector=>selector==='[data-shop-scene="journey"]'||selector==='.product-journey__sticky'?stage:null,
    querySelectorAll:selector=>selector==='[data-journey-at]'?markers:[]};
  globalThis.window=view;globalThis.document={documentElement:{get clientWidth(){return geometry.width;}},querySelector:selector=>selector==='.header'?{get offsetHeight(){return geometry.header;}}:null};
  try {
    const controller=initializeProductJourney(section);controller.prepare();
    assert.equal(controller.enhanced,false,'No model frame is needed for prepared chapter targets');
    function verifyTargets(){
      const travel=geometry.track-geometry.stage;
      for(const marker of markers){
        const q=Number(marker.dataset.journeyAt),offset=parseFloat(marker.style.top);
        assert.equal(offset,q*travel);
        assert.equal(parseFloat(marker.style.height),(Number(marker.dataset.journeyUntil)-q)*travel+geometry.stage);
        // Native anchor alignment has the document header padding exactly once.
        view.scrollY=geometry.top+offset-geometry.header;
        assert.ok(Math.abs(controller.getProgress()-q)<1e-12,'Chapter lands at its authored pose before WebGL is ready');
      }
    }
    verifyTargets();view.scrollY=0;
    Object.assign(geometry,{width:844,stage:316,track:3900,header:74});events.get('resize')();verifyTargets();
    controller.enhance({q:.16,phase:'unseal'});verifyTargets();
    controller.fallback();
    for(const marker of markers){assert.equal(marker.style.top,undefined);assert.equal(marker.style.height,undefined);}
    controller.suspend();
  } finally {
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  }
});
