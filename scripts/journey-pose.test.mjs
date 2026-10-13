import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { computeJourneyPose, createJourneySpace, createJourneyCollarFlex, collarExpansionForLift, JOURNEY_PHASES, JOURNEY_CLEARANCES } from '../assets/journey-pose.js';
import { computeCycleState, TILT_AXIS, TAU } from '../assets/assembly/ritual-timeline.js';
import { createBody, shellRadiusAt } from '../assets/assembly/body.js';
import { createRitualCap, siliconeRoofField } from '../assets/assembly/ritual-cap.js';
import { createPeelSeal } from '../assets/assembly/ritual-effects.js';

const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('chapters form one uninterrupted, bounded scroll story with an early three-part reveal', () => {
  assert.deepEqual(JOURNEY_PHASES.map(chapter => chapter.id), ['meet','shell','insert','cap','together','unseal','dose','refill','ready']);
  near(JOURNEY_PHASES[0].start, 0); near(JOURNEY_PHASES.at(-1).end, 1);
  for (let i = 0; i < JOURNEY_PHASES.length; i++) {
    const chapter = JOURNEY_PHASES[i];
    assert.ok(chapter.end > chapter.start);
    if (i) near(chapter.start, JOURNEY_PHASES[i - 1].end);
    const midpoint = computeJourneyPose((chapter.start + chapter.end) / 2);
    assert.equal(midpoint.phase, chapter.id); near(midpoint.phaseProgress, .5);
  }
  for (const value of [undefined, NaN, Infinity, -100]) near(computeJourneyPose(value).q, 0);
  near(computeJourneyPose(100).q, 1);
});

test('the subsequent opening/refill operations are the approved cycle, with one continuous 720-degree yaw', () => {
  for (let i = 0; i <= 520; i++) {
    const q = .48 + .52 * i / 520, pose = computeJourneyPose(q);
    const approved = computeCycleState(pose.ritualProgress);
    const state = { ...pose.state, yaw: approved.yaw };
    assert.deepEqual(state, approved);
    near(pose.state.yaw, 2 * TAU * q);
  }
  near(computeJourneyPose(1).state.yaw - computeJourneyPose(0).state.yaw, 2 * TAU);
  const beginning = computeJourneyPose(0), ending = computeJourneyPose(1);
  for (const key of ['cap','oldRefill','newRefill','seal','newSeal','liquid']) assert.deepEqual(ending.state[key], beginning.state[key]);
  near(ending.roll, beginning.roll);
});

test('axial clearance precedes every lateral move, and PET is seated before the cap returns', () => {
  const d = JOURNEY_CLEARANCES;
  let previous = computeJourneyPose(0);
  for (let i = 1; i <= 2400; i++) {
    const pose = computeJourneyPose(.48 * i / 2400), a = pose.anatomy;
    if (a.capPark !== previous.anatomy.capPark) near(a.capLift, 1);
    if (a.insertPark !== previous.anatomy.insertPark) near(a.insertLift, 1);
    if (a.insertLift !== previous.anatomy.insertLift && a.insertPark > 1e-8) near(a.insertPark, 1);
    if (pose.q > .463 && a.capPark < previous.anatomy.capPark) near(a.insertLift, 0);
    if (pose.q > .470 && a.capLift < previous.anatomy.capLift) {
      near(a.capPark, 0); near(a.insertLift, 0); near(a.insertPark, 0);
    }
    for (const value of Object.values(a)) assert.ok(value >= -1e-10 && value <= 1 + 1e-10);
    assert.equal(pose.state.seal.peel, 0); assert.equal(pose.state.cap.swivel, 0); assert.equal(pose.state.cap.press, 0);
    previous = pose;
  }
  assert.ok(5 + d.insertAxialLift > 170);
  assert.ok(149.9 + d.capAxialLift > 170.5);
  assert.ok(d.capScreenLeft > 40 + 29);
  assert.ok(d.insertScreenRight > 29 + 29);
});

const [body, cap] = await Promise.all([createBody({ THREE }), createRitualCap({ THREE })]);
const oldSeal = createPeelSeal({ THREE }), newSeal = createPeelSeal({ THREE });
const scene = new THREE.Scene(), tiltRig = new THREE.Group(), yawRig = new THREE.Group(), product = new THREE.Group();
const oldRefill = new THREE.Group(), newRefill = new THREE.Group();
product.position.y = -85; scene.add(tiltRig); tiltRig.add(yawRig); yawRig.add(product);
oldRefill.add(body.components.inlay, oldSeal.group);
newRefill.add(body.components.inlay.clone(true), newSeal.group);
product.add(body.components.shell, cap.group, oldRefill, newRefill);
const space = createJourneySpace({ THREE }), camera = new THREE.PerspectiveCamera(30, 1, .5, 5000);
const flex = createJourneyCollarFlex({ cap, shellRadiusAt });
const collar = cap.components.cap.children.find(part => part.name.startsWith('cap-collar'));
const originalCollarPositions = Float32Array.from(collar.geometry.attributes.position.array);
const originalCollarNormals = Float32Array.from(collar.geometry.attributes.normal.array);
const tiltAxis = new THREE.Vector3(...TILT_AXIS), rollAxis = new THREE.Vector3(0, 0, 1), point = new THREE.Vector3();
const d = cap.metrics.dimensions;
function apply(q, yaw = 0, zoom = 1, width = 1440, height = 900, layout = {}) {
  const pose = computeJourneyPose(q), state = pose.state;
  tiltRig.quaternion.setFromAxisAngle(tiltAxis, state.tilt);
  tiltRig.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(rollAxis, pose.roll));
  yawRig.rotation.y = state.yaw + yaw; cap.update(state.cap); flex.update(state.cap.position[1]);
  for (const [group, part] of [[oldRefill, state.oldRefill], [newRefill, state.newRefill]]) {
    group.position.fromArray(part.position); group.rotation.set(...part.rotation); group.visible = part.visible;
  }
  oldSeal.update({ ...state.seal, externalExit: true }); newSeal.update(state.newSeal); newSeal.group.visible = state.newSeal.visible;
  camera.aspect = width / height; camera.updateProjectionMatrix(); scene.updateMatrixWorld(true);
  const framing = space.fitCamera({ pose, camera, tiltRig, zoom, width, height, ...layout });
  const spatial = space.placeParts({ pose, camera, product, cap, oldRefill, newRefill, oldSeal, width });
  scene.updateMatrixWorld(true);
  const anchors = space.anchors({ pose, camera, product, cap, oldRefill, newRefill, oldSeal, newSeal });
  return { pose, framing, spatial, anchors };
}

test('scrollbar width and header height cannot select a different camera layout from the CSS viewport', () => {
  for (const [width, height, layoutWidth, layoutHeight, expected] of [
    [753, 952, 768, 1024, 'beside'],
    [1009, 1294, 1024, 1366, 'beside'],
    [685, 528, 700, 600, 'below'],
    [829, 318, 844, 390, 'beside'],
    [525, 256, 540, 320, 'beside'],
    [305, 676, 320, 740, 'below'],
    [505, 780, 520, 844, 'below'],
    [585, 936, 600, 1000, 'below'],
  ]) {
    const { framing } = apply(.33, 0, 1, width, height, { layoutWidth, layoutHeight });
    assert.equal(framing.region.layout, expected, `${layoutWidth}×${layoutHeight} CSS viewport`);
    if (expected === 'below') assert.ok(framing.region.maxY <= (height - (layoutWidth >= 520 && layoutWidth <= 760 ? 320 : 270) - 70 - 16) / height + 1e-8);
  }
});
function insideBamboo(p) {
  const r = Math.hypot(p.x, p.z), tolerance = .025;
  return p.y > tolerance && p.y < 170 - tolerance && r < shellRadiusAt(p.y) - tolerance && (p.y < 5 - tolerance || r > 24 + tolerance);
}
function insidePET(p) {
  const r = Math.hypot(p.x, p.z), t = .025;
  return (p.y > 5+t && p.y < 170-t && r > 23.2+t && r < 23.5-t)
    || (p.y > 5+t && p.y < 5.3-t && r < 23.5-t)
    || (p.y > 170+t && p.y < 170.3-t && r > 23.5+t && r < 29-t);
}
function insideCap(p, press = 0) {
  const r = Math.hypot(p.x, p.z), t = .025;
  const roofY = d.roofUnderside + siliconeRoofField(p.x, p.z, d.buttonStroke * press).displacement;
  const outlet = Math.hypot(p.x, p.z-d.outletZ) <= d.outletDiameter / 2;
  const roof = !outlet && r < 29.5-t && p.y > roofY+t && p.y < roofY+d.roofThickness-t;
  const expansion = flex.expansion * Math.min(1, Math.max(0, (151-p.y)/.4));
  const outer = (p.y <= d.lowerSeatTop ? 29 : p.y < 151 ? 29+.5*(p.y-d.lowerSeatTop)/(151-d.lowerSeatTop) : 29.5) + expansion;
  return roof || (p.y > d.lowerSeatBottom+t && p.y < d.roofUnderside-t && r < outer-t && r > outer-.5+t);
}
const petSamples = [];
for (let y = 5; y <= 170; y += 5) for (let i = 0; i < 32; i++) petSamples.push(new THREE.Vector3(23.5*Math.cos(i*TAU/32),y,23.5*Math.sin(i*TAU/32)));
for (const y of [5,5.3,170,170.3]) for (let r = 0; r <= 29; r += .5) {
  if ((y >= 170 && r < 23.5) || (y < 170 && r > 23.5)) continue;
  for (let i = 0; i < 24; i++) petSamples.push(new THREE.Vector3(r*Math.cos(i*TAU/24),y,r*Math.sin(i*TAU/24)));
}

test('real PET and complete cap surfaces do not intersect bamboo or each other throughout the new reveal', () => {
  for (let i = 0; i <= 400; i++) {
    const q = .48*i/400; apply(q, .73, 1, 390, 844);
    const invProduct = product.matrixWorld.clone().invert(), invCap = cap.group.matrixWorld.clone().invert();
    const collarPositions = collar.geometry.attributes.position;
    for (let j = 0; j < collarPositions.count; j++) {
      point.fromBufferAttribute(collarPositions,j).applyMatrix4(collar.matrixWorld).applyMatrix4(invProduct);
      assert.ok(!insideBamboo(point), `Silicone collar enters bamboo at q=${q}`);
    }
    for (const sample of petSamples) {
      point.copy(sample).applyMatrix4(oldRefill.matrixWorld);
      assert.ok(!insideBamboo(point.clone().applyMatrix4(invProduct)), `PET enters bamboo at q=${q}`);
      assert.ok(!insideCap(point.clone().applyMatrix4(invCap)), `PET enters cap at q=${q}`);
    }
    const petBox = new THREE.Box3(new THREE.Vector3(-29,5,-29),new THREE.Vector3(29,170.3,29)).applyMatrix4(oldRefill.matrixWorld);
    if (petBox.intersectsBox(new THREE.Box3().setFromObject(cap.group))) {
      const invPET = oldRefill.matrixWorld.clone().invert();
      cap.group.traverse(mesh => {
        const positions = mesh.geometry?.attributes.position;
        if (!positions) return;
        for (let j = 0; j < positions.count; j += 8) {
          point.fromBufferAttribute(positions,j).applyMatrix4(mesh.matrixWorld).applyMatrix4(invPET);
          assert.ok(!insidePET(point), `Cap enters thin PET surface at q=${q}`);
        }
      });
    }
  }
});

test('the silicone collar stretches only enough for actual lips and resets to exact source geometry', () => {
  let maximum = 0;
  for (let i = 0; i <= 4400; i++) {
    const lift = i / 100;
    const expansion = collarExpansionForLift(lift, shellRadiusAt);
    assert.ok(expansion >= 0 && expansion <= .54);
    if (lift > 21) near(expansion, 0);
    maximum = Math.max(maximum, expansion);
  }
  assert.ok(maximum > .50 && maximum <= .54);
  flex.update(20); assert.ok(flex.expansion > 0);
  flex.update(0);
  assert.deepEqual(collar.geometry.attributes.position.array, originalCollarPositions);
  assert.deepEqual(collar.geometry.attributes.normal.array, originalCollarNormals);
  flex.update(44); near(flex.expansion, 0);
});

test('the separated three parts remain inside the product region for mobile, short landscape and desktop', () => {
  for (const [width,height] of [[320,700],[390,844],[700,390],[768,1024],[1024,1366],[844,390],[1440,900]]) {
    for (const q of [0,.17,.205,.245,.26,.28,.315,.35,.40,.425,.445,.475,.48,.58,.75,.9,.94,.98,1]) {
      const { framing, anchors } = apply(q, .42, 1, width, height), r = framing.region;
      const groups = [product.children[0], cap.group];
      if (q < .48) groups.push(oldRefill);
      for (const group of groups) group.traverse(mesh => {
        const positions = mesh.geometry?.attributes.position;
        if (!positions) return;
        for (let i = 0; i < positions.count; i += 101) {
          point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).project(camera);
          const x = (point.x+1)/2, y = (1-point.y)/2;
          assert.ok(x >= r.minX-.002 && x <= r.maxX+.002 && y >= r.minY-.002 && y <= r.maxY+.002,
            `${group.name} crosses caption region q=${q}, ${width}×${height}, x=${x},y=${y}`);
        }
      });
      for (const anchor of Object.values(anchors)) {
        assert.ok(anchor.x >= 0 && anchor.x <= 1 && anchor.y >= 0 && anchor.y <= 1);
      }
      assert.equal(framing.region.layout, width > 760 || width > 600 && height < 560 ? 'beside' : 'below');
    }
  }
});

test('approved film and refill lanes remain clear under the reserved journey camera for axial inspection', () => {
  for (const [width,height] of [[320,700],[390,844],[844,390],[1440,900]]) for (const zoom of [.6,1,2.5])
  for (let yawIndex = 0; yawIndex < 6; yawIndex++) for (const p of [.15,.18,.21,.24,.248,.265,.27,.765,.775,.79,.80,.825,.83,.84,.86,.875,.9,.96]) {
    const q = .48+.52*p, { pose, spatial } = apply(q,yawIndex*Math.PI/3,zoom,width,height);
    const invCap = cap.group.matrixWorld.clone().invert(), invProduct = product.matrixWorld.clone().invert();
    for (const group of [oldRefill,newRefill]) if (group.visible) for (let i=0; i<petSamples.length; i+=7) {
      point.copy(petSamples[i]).applyMatrix4(group.matrixWorld);
      assert.ok(!insideBamboo(point.clone().applyMatrix4(invProduct)), `PET enters bamboo at p=${p}, yaw=${yawIndex}, ${width}×${height}`);
      assert.ok(!insideCap(point.clone().applyMatrix4(invCap),pose.state.cap.press), `PET enters cap at p=${p}, yaw=${yawIndex}, ${width}×${height}`);
    }
    if (oldRefill.visible && oldSeal.group.visible) oldSeal.group.traverse(mesh => {
      const positions = mesh.geometry?.attributes.position;
      if (!positions) return;
      for (let i=0; i<positions.count; i+=11) {
        point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(invCap);
        assert.ok(!insideCap(point,pose.state.cap.press), `Film enters cap at p=${p}, yaw=${yawIndex}`);
      }
    });
    assert.ok(!(oldRefill.visible && newRefill.visible), 'Spent and fresh PET cannot share an arrival lane');
    if (pose.state.seal.exit === 1) assert.equal(spatial.seal.inFrustum,false,`Released film cutoff inside frame at p=${p}`);
    if (pose.state.oldRefill.depart === 1) assert.equal(spatial.oldRefill.inFrustum,false,`Spent PET cutoff inside frame at p=${p}`);
    if (pose.state.newRefill.approach > .999999) assert.equal(spatial.newRefill.inFrustum,false,`Fresh PET arrives inside frame at p=${p}`);
  }
});

test('camera and component anchors are identical after backwards scrubbing and retain a sealed seam', () => {
  const capture = q => {
    const { anchors, framing } = apply(q,.73,1,390,844);
    return { anchors, framing, shell: product.children[0].matrixWorld.toArray(), cap: cap.group.matrixWorld.toArray(), refill:oldRefill.matrixWorld.toArray() };
  };
  const reference = capture(.28);
  for (const q of [.98,.3,.68,.1,.45,.2,.42]) capture(q);
  assert.deepEqual(capture(.28), reference);
  const beginning = capture(0), ending = capture(1);
  for (const key of ['shell','cap','refill']) beginning[key].forEach((value,i) => near(value,ending[key][i]));
  beginning.framing.cameraPosition.forEach((value,i) => near(value,ending.framing.cameraPosition[i]));
});

test('the public journey paints the same explicit opaque world into clear and scene backgrounds', () => {
  const source = fs.readFileSync(new URL('../assets/shop-scene.js', import.meta.url),'utf8');
  assert.match(source, /const opaque = options\.opaque === true \|\| initialMode === 'journey'/);
  assert.match(source, /renderer\.setClearColor\(backgroundColor, opaque \? 1 : 0\)/);
  assert.match(source, /if \(opaque\) scene\.background = new THREE\.Color\(backgroundColor\)/);
  assert.match(source, /scene\.background\.set\(backgroundColor\)/);
  assert.match(source, /getProgress: \(\) => progress/);
  assert.match(source, /options\.onJourneyFrame\(journeyState\)/);
});

test.after(() => { oldSeal.dispose(); newSeal.dispose(); cap.dispose(); body.dispose(); });
