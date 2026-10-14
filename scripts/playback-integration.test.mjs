import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PLAYBACK_PROFILES, playbackAt, playbackTimeForProgress } from '../assets/playback.js';
import { campaignLayout } from '../assets/campaign-backdrop.js';
import { createBody, shellRadiusAt } from '../assets/assembly/body.js';
import { createRitualCap, siliconeRoofField } from '../assets/assembly/ritual-cap.js';
import { createPeelSeal } from '../assets/assembly/ritual-effects.js';
import { computeRitualState, computeCycleState, TILT_AXIS } from '../assets/assembly/ritual-timeline.js';
import { computeJourneyPose, createJourneySpace, createJourneyCollarFlex, JOURNEY_PHASES } from '../assets/journey-pose.js';
import { createRitualSpace } from '../assets/assembly/ritual-space.js';

const near = (a, b, tolerance = 1e-5) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const homeRegion = { minX: .06, maxX: .94, minY: .05, maxY: .95, layout: 'external' };
const [body, cap] = await Promise.all([createBody({ THREE }), createRitualCap({ THREE })]);
const oldSeal = createPeelSeal({ THREE }), newSeal = createPeelSeal({ THREE });
const scene = new THREE.Scene(), tiltRig = new THREE.Group(), yawRig = new THREE.Group(), product = new THREE.Group();
const oldRefill = new THREE.Group(), newRefill = new THREE.Group();
product.position.y = -85; scene.add(tiltRig); tiltRig.add(yawRig); yawRig.add(product);
oldRefill.add(body.components.inlay, oldSeal.group);
newRefill.add(body.components.inlay.clone(true), newSeal.group);
product.add(body.components.shell, cap.group, oldRefill, newRefill);
const collar = cap.group.children.find(group => group.name === 'Cap')?.children.find(mesh => mesh.name.startsWith('cap-collar'))
  || cap.group.getObjectByName('cap-collar-OD59-seat-OD58-wall0.5');
const flex = createJourneyCollarFlex({ cap, shellRadiusAt });
const journeySpace = createJourneySpace({ THREE }), ritualSpace = createRitualSpace({ THREE });
const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
const tiltAxis = new THREE.Vector3(...TILT_AXIS), rollAxis = new THREE.Vector3(0, 0, 1), point = new THREE.Vector3();
const dimensions = cap.metrics.dimensions;

function apply(name, seconds, manualYaw = .73, zoom = 1, width = 390, height = 844) {
  const clock = playbackAt(name, seconds), home = name === 'home-cycle';
  const pose = computeJourneyPose(clock.q), state = home ? pose.state : computeCycleState(clock.q);
  tiltRig.quaternion.setFromAxisAngle(tiltAxis, state.tilt);
  if (home) tiltRig.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(rollAxis, pose.roll));
  yawRig.rotation.y = (clock.automaticYaw ?? state.yaw) + manualYaw;
  cap.update(state.cap); flex.update(state.cap.position[1]);
  for (const [group, part] of [[oldRefill, state.oldRefill], [newRefill, state.newRefill]]) {
    group.position.fromArray(part.position); group.rotation.set(...part.rotation); group.visible = part.visible;
  }
  oldSeal.update({ ...state.seal, externalExit: true });
  newSeal.update(state.newSeal); newSeal.group.visible = state.newSeal.visible;
  camera.aspect = width / height; camera.updateProjectionMatrix(); scene.updateMatrixWorld(true);
  const framing = home ? journeySpace.fitCamera({ pose, camera, tiltRig, zoom, width, height, region: homeRegion })
    : ritualSpace.fitCamera({ state, camera, product, tiltRig, zoom, region: campaignLayout(width, height) });
  const spatial = home ? journeySpace.placeParts({ pose, camera, product, cap, oldRefill, newRefill, oldSeal, width })
    : ritualSpace.placeParts({ state, camera, product, cap, oldRefill, newRefill, oldSeal, width });
  scene.updateMatrixWorld(true);
  return { clock, pose, state, framing, spatial };
}

function insideBamboo(p) {
  const r = Math.hypot(p.x, p.z), t = .025;
  return p.y > t && p.y < 170 - t && r < shellRadiusAt(p.y) - t && (p.y < 5 - t || r > 24 + t);
}
function insideCap(p, press) {
  const d = dimensions, r = Math.hypot(p.x, p.z), t = .025;
  const roofY = d.roofUnderside + siliconeRoofField(p.x, p.z, d.buttonStroke * press).displacement;
  const outlet = Math.hypot(p.x, p.z - d.outletZ) <= d.outletDiameter / 2;
  const roof = !outlet && r < 29.5 - t && p.y > roofY + t && p.y < roofY + d.roofThickness - t;
  const expansion = flex.expansion * Math.min(1, Math.max(0, (151 - p.y) / .4));
  const outer = (p.y <= d.lowerSeatTop ? 29 : p.y < 151
    ? 29 + .5 * (p.y - d.lowerSeatTop) / (151 - d.lowerSeatTop) : 29.5) + expansion;
  return roof || (p.y > d.lowerSeatBottom + t && p.y < d.roofUnderside - t && r < outer - t && r > outer - .5 + t);
}
function insidePET(p) {
  const r = Math.hypot(p.x, p.z), t = .025;
  return (p.y > 5 + t && p.y < 170 - t && r > 23.2 + t && r < 23.5 - t)
    || (p.y > 5 + t && p.y < 5.3 - t && r < 23.5 - t)
    || (p.y > 170 + t && p.y < 170.3 - t && r > 23.5 + t && r < 29 - t);
}
function eachSurface(group, visit, maximumPerMesh = 56) {
  group.traverseVisible(mesh => {
    const positions = mesh.geometry?.attributes.position; if (!positions) return;
    const step = Math.max(1, Math.floor(positions.count / maximumPerMesh));
    for (let i = 0; i < positions.count; i += step) visit(point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld), mesh);
  });
}
function captureExterior(name, seconds) {
  const { framing } = apply(name, seconds);
  const vertices = [];
  for (const group of [body.components.shell, cap.group]) eachSurface(group, p => vertices.push(...p.toArray()));
  return { vertices, camera: camera.position.toArray(), distance: framing.distance };
}

test('automatic profile q and caption phases stay consistent with the approved source choreography', () => {
  for (const [name, profile] of Object.entries(PLAYBACK_PROFILES)) {
    let previous = profile.checkpoints[0][1];
    for (let i = 0; i < profile.duration * 30; i++) {
      const clock = playbackAt(name, i / 30), pose = computeJourneyPose(clock.q);
      assert.ok(clock.q >= previous && clock.q <= 1); previous = clock.q;
      const phase = JOURNEY_PHASES.findLast(item => clock.q >= item.start);
      assert.equal(pose.phase, phase.id); near(pose.ritualProgress, clock.q);
      if (clock.q < 1) assert.deepEqual(pose.state, { ...computeRitualState(clock.q), cyclePosition: clock.q, cycleIndex: 0 });
      else {
        assert.equal(pose.phase, 'ready'); assert.equal(pose.state.sealed, true);
        near(pose.state.yaw, Math.PI * 4); near(pose.state.cap.position[1], 0);
      }
    }
  }
});

test('actual silicone, PET and peeling film surfaces clear each other under both automatic rotations', () => {
  const qPoints = [0, .06, .085, .12, .17, .205, .24, .26, .269999, .270001, .33, .54,
    .72, .75, .765, .778, .80, .825, .829999, .83, .830001, .85, .875, .92, .96, 1];
  for (const name of Object.keys(PLAYBACK_PROFILES)) {
    const minQ = PLAYBACK_PROFILES[name].checkpoints[0][1];
    const times = qPoints.filter(q => q >= minQ).map(q => playbackTimeForProgress(name, q));
    for (const [width, height] of [[390, 844], [844, 390], [1440, 900]]) for (const zoom of [.6, 1])
    for (const manualYaw of [0, Math.PI * .7]) for (const seconds of times) {
      const { clock, state, spatial } = apply(name, seconds, manualYaw, zoom, width, height);
      const context = `${name}, q=${clock.q}, ${width}×${height}, zoom=${zoom}, manualYaw=${manualYaw}`;
      const invProduct = product.matrixWorld.clone().invert(), invCap = cap.group.matrixWorld.clone().invert();
      eachSurface(collar, world => assert.ok(!insideBamboo(world.clone().applyMatrix4(invProduct)), `Collar enters bamboo: ${context}`));
      for (const group of [oldRefill, newRefill]) if (group.visible) {
        // Only the PET meshes participate here; its bonded seal is tested separately.
        const inlay = group.children[0];
        eachSurface(inlay, world => {
          assert.ok(!insideBamboo(world.clone().applyMatrix4(invProduct)), `PET enters bamboo: ${context}`);
          assert.ok(!insideCap(world.clone().applyMatrix4(invCap), state.cap.press), `PET enters cap: ${context}`);
        });
        const petBounds = new THREE.Box3(new THREE.Vector3(-29, 5, -29), new THREE.Vector3(29, 170.3, 29)).applyMatrix4(group.matrixWorld);
        if (petBounds.intersectsBox(new THREE.Box3().setFromObject(cap.group))) {
          const invPET = group.matrixWorld.clone().invert();
          eachSurface(cap.group, world => assert.ok(!insidePET(world.clone().applyMatrix4(invPET)), `Cap enters thin PET: ${context}`));
        }
      }
      if (oldRefill.visible && oldSeal.group.visible) eachSurface(oldSeal.group, world => {
        assert.ok(!insideCap(world.clone().applyMatrix4(invCap), state.cap.press), `Peeling film enters cap: ${context}`);
      });
      assert.ok(!(oldRefill.visible && newRefill.visible), `Spent and fresh PET share the lane: ${context}`);
      // Only visible handoffs matter; dormant hidden parts may be inside the
      // much wider dispensing camera without ever becoming drawable.
      if (state.seal.exit === 1 && clock.q < .275) assert.equal(spatial.seal.inFrustum, false, `Film cutoff appears: ${context}`);
      if (state.oldRefill.depart === 1 && clock.q < .835) assert.equal(spatial.oldRefill.inFrustum, false, `Spent PET cutoff appears: ${context}`);
      if (state.newRefill.visible && state.newRefill.approach > .999999) assert.equal(spatial.newRefill.inFrustum, false, `Fresh PET appears in frame: ${context}`);
    }
  }
});

test('closed exterior, complete cap and camera match physically at both automatic loop seams', () => {
  for (const [name, profile] of Object.entries(PLAYBACK_PROFILES)) {
    const beginning = captureExterior(name, 0), ending = captureExterior(name, profile.duration - 1e-8);
    assert.equal(beginning.vertices.length, ending.vertices.length);
    beginning.vertices.forEach((value, i) => near(value, ending.vertices[i]));
    beginning.camera.forEach((value, i) => near(value, ending.camera[i])); near(beginning.distance, ending.distance);
    const next = captureExterior(name, profile.duration);
    beginning.vertices.forEach((value, i) => near(value, next.vertices[i]));
    // 720° or 360° are equivalent to zero physically, without resetting manual inspection.
    const clock = playbackAt(name, profile.duration - 1e-8), sourceYaw = clock.automaticYaw ?? computeJourneyPose(clock.q).state.yaw;
    near(Math.cos(sourceYaw), 1); near(Math.sin(sourceYaw), 0);
  }
});

test('seeking backwards reconstructs the same component geometry and camera after all other chapters', () => {
  for (const name of Object.keys(PLAYBACK_PROFILES)) {
    const profile = PLAYBACK_PROFILES[name], target = name === 'home-cycle' ? 7.25 : 4.25;
    const original = captureExterior(name, target);
    for (const seconds of [profile.duration - .1, 0, profile.duration * .70, profile.duration * .25, profile.duration * .92]) captureExterior(name, seconds);
    assert.deepEqual(captureExterior(name, target), original);
  }
});

test.after(() => { body.dispose(); cap.dispose(); oldSeal.dispose(); newSeal.dispose(); });
