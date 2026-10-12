import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBody, shellRadiusAt } from '../assets/assembly/body.js';
import { createRitualCap, siliconeRoofField } from '../assets/assembly/ritual-cap.js';
import { createPeelSeal, createGel } from '../assets/assembly/ritual-effects.js';
import { createRitualSpace } from '../assets/assembly/ritual-space.js';
import { computeRitualState, TILT_AXIS } from '../assets/assembly/ritual-timeline.js';

const [body, cap] = await Promise.all([createBody({ THREE }), createRitualCap({ THREE })]);
const oldSeal = createPeelSeal({ THREE }), newSeal = createPeelSeal({ THREE }), gel = createGel({ THREE });
const scene = new THREE.Scene(), tiltRig = new THREE.Group(), yawRig = new THREE.Group(), product = new THREE.Group();
const oldRefill = new THREE.Group(), newRefill = new THREE.Group();
product.position.y = -85; scene.add(tiltRig); tiltRig.add(yawRig); yawRig.add(product);
oldRefill.add(body.components.inlay, oldSeal.group, gel.oldFillGroup);
newRefill.add(body.components.inlay.clone(true), newSeal.group, gel.newFillGroup);
product.add(body.components.shell, cap.group, oldRefill, newRefill);
const space = createRitualSpace({ THREE });
const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
const axis = new THREE.Vector3(...TILT_AXIS), inverse = new THREE.Matrix4(), point = new THREE.Vector3();
const d = cap.metrics.dimensions;
const near = (a, b, tolerance = 1e-5) => assert.ok(Math.abs(a-b) < tolerance, `${a} != ${b}`);

function apply(p, yaw = 0, zoom = 1, width = 1440, height = 900) {
  const state = computeRitualState(p);
  tiltRig.quaternion.setFromAxisAngle(axis, state.tilt); yawRig.rotation.y = state.yaw + yaw;
  cap.group.position.fromArray(state.cap.position); cap.update(state.cap);
  for (const [group, pose] of [[oldRefill, state.oldRefill], [newRefill, state.newRefill]]) {
    group.position.fromArray(pose.position); group.rotation.set(...pose.rotation); group.visible = pose.visible;
  }
  oldSeal.update({ ...state.seal, externalExit: true });
  newSeal.update(state.newSeal); newSeal.group.visible = state.newSeal.visible;
  camera.aspect = width / height; camera.updateProjectionMatrix(); scene.updateMatrixWorld(true);
  space.fitCamera({ state, camera, product, tiltRig, zoom });
  const observations = space.placeParts({ state, camera, product, cap, oldRefill, newRefill, oldSeal, width });
  scene.updateMatrixWorld(true);
  return { state, observations };
}

// Dense samples of the actual thin PET surfaces, including its floor and flange.
const petPoints = [];
for (let y = 5; y <= 170; y += 5) for (let j = 0; j < 48; j++) {
  const angle = j * Math.PI / 24;
  petPoints.push(new THREE.Vector3(23.5*Math.cos(angle), y, 23.5*Math.sin(angle)));
}
for (const y of [5, 5.3, 170, 170.3]) for (let radius = 0; radius <= 29; radius += .5) {
  if (y >= 170 && radius < 23.5) continue;
  if (y < 170 && radius > 23.5) continue;
  for (let j = 0; j < 48; j++) petPoints.push(new THREE.Vector3(radius*Math.cos(j*Math.PI/24), y, radius*Math.sin(j*Math.PI/24)));
}

function insidePET(p, tolerance = .025) {
  const r = Math.hypot(p.x,p.z);
  return (p.y > 5+tolerance && p.y < 170-tolerance && r > 23.2+tolerance && r < 23.5-tolerance)
    || (p.y > 5+tolerance && p.y < 5.3-tolerance && r < 23.5-tolerance)
    || (p.y > 170+tolerance && p.y < 170.3-tolerance && r > 23.5+tolerance && r < 29-tolerance);
}
function insideBamboo(p) {
  const r = Math.hypot(p.x,p.z), tolerance = .025;
  return p.y > tolerance && p.y < 170-tolerance && r < shellRadiusAt(p.y)-tolerance
    && (p.y < 5-tolerance || r > 24+tolerance);
}
function insideCap(p, press) {
  const r = Math.hypot(p.x,p.z), tolerance = .025;
  const roofY = d.roofUnderside + siliconeRoofField(p.x,p.z,d.buttonStroke*press).displacement;
  const outlet = Math.hypot(p.x,p.z-d.outletZ) <= d.outletDiameter/2;
  const roof = !outlet && r < 29.5-tolerance && p.y > roofY+tolerance && p.y < roofY+d.roofThickness-tolerance;
  const collarOuter = p.y <= d.lowerSeatTop ? 29 : p.y < 151
    ? 29 + .5 * (p.y-d.lowerSeatTop)/(151-d.lowerSeatTop) : 29.5;
  const collar = p.y > d.lowerSeatBottom+tolerance && p.y < d.roofUnderside-tolerance
    && r < collarOuter-tolerance && r > collarOuter-.5+tolerance;
  return roof || collar;
}
function actualSurface(mesh, visitor, step = 1) {
  if (!mesh.geometry) return;
  const a = mesh.geometry.attributes.position;
  for (let i = 0; i < a.count; i += step) visitor(point.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld));
}

test('PET remains inside the real hollow bore and cannot enter the parked cap during exchange', () => {
  // Every 0.001 of cycle covers each axial and lateral handoff densely.
  for (let i = 0; i <= 1000; i++) {
    const p = i/1000;
    apply(p, .73, .6, 390, 844);
    const invProduct = inverse.copy(product.matrixWorld).invert().clone();
    const invCap = cap.group.matrixWorld.clone().invert();
    for (const group of [oldRefill,newRefill]) {
      if (!group.visible) continue;
      for (const sample of petPoints) {
        point.copy(sample).applyMatrix4(group.matrixWorld);
        assert.ok(!insideBamboo(point.clone().applyMatrix4(invProduct)), `PET enters bamboo at p=${p}`);
        assert.ok(!insideCap(point.clone().applyMatrix4(invCap), cap.group.userData.operation.press), `PET enters cap roof/collar at p=${p}`);
      }
      // Reciprocal actual cap vertices catch thin PET wall/floor contacts
      // missed by a coarse bounding-volume or origin-distance comparison.
      const invPET = group.matrixWorld.clone().invert();
      const capBox = new THREE.Box3().setFromObject(cap.group);
      const petBox = new THREE.Box3(new THREE.Vector3(-29,5,-29),new THREE.Vector3(29,170.3,29)).applyMatrix4(group.matrixWorld);
      if (capBox.intersectsBox(petBox)) cap.group.traverse(mesh => {
        if (!mesh.geometry) return;
        actualSurface(mesh, world => assert.ok(!insidePET(world.clone().applyMatrix4(invPET)), `Cap surface enters PET at p=${p}`), 8);
      });
    }
  }
});

test('screen lanes have no film/cap/PET collision for all inspection directions', () => {
  for (const [width,height] of [[390,844],[1440,900]]) for (const zoom of [.6,1,3])
  for (let yawIndex = 0; yawIndex < 12; yawIndex++) for (const p of [ .15,.18,.21,.24,.248,.255,.265,.765,.775,.79,.80,.815,.83,.84,.85,.86,.875,.89 ]) {
    apply(p,yawIndex*Math.PI/6,zoom,width,height);
    const invCap = cap.group.matrixWorld.clone().invert();
    const invProduct = product.matrixWorld.clone().invert();
    for (const group of [oldRefill,newRefill]) if (group.visible) for (const sample of petPoints) {
      point.copy(sample).applyMatrix4(group.matrixWorld);
      assert.ok(!insideCap(point.clone().applyMatrix4(invCap),0), `PET enters cap at p=${p}, yaw=${yawIndex}, zoom=${zoom}, width=${width}`);
      assert.ok(!insideBamboo(point.clone().applyMatrix4(invProduct)), `PET enters bamboo at p=${p}, yaw=${yawIndex}, zoom=${zoom}, width=${width}`);
    }
    if (oldRefill.visible && oldSeal.group.visible) oldSeal.group.traverse(mesh => actualSurface(mesh, world => {
      assert.ok(!insideCap(world.clone().applyMatrix4(invCap),0), `Film enters cap at p=${p}, yaw=${yawIndex}`);
    },3));
    assert.ok(!(oldRefill.visible && newRefill.visible), `Spent and new inserts share the arrival lane at p=${p}`);
  }
});

test('departure cutoffs and replacement arrival remain outside the actual camera frustum', () => {
  for (const [width,height] of [[390,844],[1440,900]]) for (const zoom of [.6,1,3]) for (let yawIndex=0; yawIndex<12; yawIndex++) {
    const yaw = yawIndex*Math.PI/6;
    for (const p of [.269999,.27,.825,.829999,.83,.830001]) {
      const {state,observations:o} = apply(p,yaw,zoom,width,height);
      if (state.seal.exit === 1) assert.equal(o.seal.inFrustum,false,`Film cutoff visible: ${p},${yaw},${zoom},${width}`);
      if (state.oldRefill.depart === 1) assert.equal(o.oldRefill.inFrustum,false,`PET cutoff visible: ${p},${yaw},${zoom},${width}`);
      if (state.newRefill.approach > .999999) assert.equal(o.newRefill.inFrustum,false,`New PET appears inside frame: ${p},${yaw},${zoom},${width}`);
    }
  }
});

test('camera and physical sealed product agree across the cycle seam and reverse poses', () => {
  function capture(p) {
    apply(p,.42,1,390,844);
    const box = new THREE.Box3().setFromObject(p >= .9 ? newRefill : oldRefill,true);
    return { camera: camera.position.toArray(), roof:cap.group.matrixWorld.elements.slice(), refill:[...box.min.toArray(),...box.max.toArray()] };
  }
  const beginning=capture(0), end=capture(1);
  for (const name of Object.keys(beginning)) beginning[name].forEach((value,index)=>near(value,end[name][index]));
  const reference=capture(.811);
  for (const p of [.99,.13,.86,.2,.825,.72,.8]) capture(p);
  assert.deepEqual(capture(.811),reference);
});
