import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { createBody } from './body.js';
import { createRitualCap } from './ritual-cap.js';
import { createPeelSeal, createGel } from './ritual-effects.js';
import { createInspectionInput } from './ritual-input.js';
import { computeRitualState, clamp, easeRange, TILT_AXIS } from './ritual-timeline.js';

const viewport = document.getElementById('viewport');
const telemetry = document.getElementById('assembly-state');
const statusText = document.getElementById('render-status');
const tiltAxis = new THREE.Vector3(...TILT_AXIS);
const outletWorld = new THREE.Vector3(), outletDirection = new THREE.Vector3();
const outletQuaternion = new THREE.Quaternion();
const cameraDirection = new THREE.Vector3(.19, .44, 1).normalize();
const cameraRight = new THREE.Vector3(0, 1, 0).cross(cameraDirection).normalize();
const cameraUp = cameraDirection.clone().cross(cameraRight).normalize();
let renderer, camera, scene, tiltRig, yawRig, product, floor;
let body, cap, oldSeal, newSeal, gel, oldRefill, newRefill, input;
let environment, resizeObserver, lastTelemetry = -1000;
let progress = 0, manualYaw = 0, zoom = 1, ready = false, mappedScrollRange = 0;
let error = null, frameRequest = 0, framing = null;
const metrics = {};
const scrollRange = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);

function scheduleRender() {
  if (!frameRequest) frameRequest = requestAnimationFrame(render);
}

function setProgress(value) {
  progress = clamp(value);
  window.scrollTo({ top: progress * scrollRange(), behavior: 'instant' });
  scheduleRender();
}

function onScroll() {
  const actualRange = scrollRange();
  // Some browsers dispatch scroll before resize, after clamping the old
  // pixel offset to the new viewport. Keep the old normalized stage until
  // it has been mapped onto the new range, rather than reading that offset.
  if (mappedScrollRange && Math.abs(actualRange - mappedScrollRange) > .5) {
    resize(); return;
  }
  progress = clamp(scrollY / actualRange);
  scheduleRender();
}

function resize() {
  if (!renderer) return;
  const retainedProgress = progress;
  const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 760 ? 1.3 : 1.8));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  // Retain the ritual stage through orientation/viewport changes.
  mappedScrollRange = scrollRange();
  window.scrollTo({ top: retainedProgress * mappedScrollRange, behavior: 'instant' });
  progress = retainedProgress;
  input?.resize?.();
  scheduleRender();
}

function fitCamera(state) {
  // Transform actual box corners before projecting into the camera plane.
  // A world-aligned bounding box grows unnecessarily during the pouring tilt.
  const points = [];
  function includeBox(min, max, matrix, blend = null, weight = 1) {
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      const point = new THREE.Vector3(x, y, z);
      if (matrix) point.applyMatrix4(matrix);
      if (blend) point.lerp(blend, 1 - weight);
      points.push(point);
    }
  }
  includeBox([-29.5, 0, -29.5], [29.5, 173.4, 29.5], product.matrixWorld);
  includeBox([-29.5, 149.9, -29.5], [29.5, 175, 39.7], cap.group.matrixWorld);
  if (state.framing.foil) {
    const sheetBox = new THREE.Box3().setFromObject(oldSeal.group);
    const base = new THREE.Vector3(0, 170.34, 0).applyMatrix4(product.matrixWorld);
    if (!sheetBox.isEmpty()) includeBox(sheetBox.min.toArray(), sheetBox.max.toArray(), null, base, 1 - state.seal.exit);
  }
  const pourFrame = easeRange(state.progress, .445, .49) * (1 - easeRange(state.progress, .67, .72));
  if (pourFrame > 0) {
    points.push(outletWorld.clone());
    points.push(outletWorld.clone().add(new THREE.Vector3(4, -136 * pourFrame, 4)));
  }
  // Anticipate the vertical exchange continuously; departing objects leave
  // this authored inspection area instead of pulling the camera after them.
  const exchange = easeRange(state.progress, .735, .785) * (1 - easeRange(state.progress, .90, .96));
  if (exchange > 0) includeBox([-29, 170, -29], [90 * exchange + 29, 170.6 + 178 * exchange, 29], product.matrixWorld);
  const bounds = new THREE.Box3().setFromPoints(points);
  const projected = { right: [Infinity, -Infinity], up: [Infinity, -Infinity], depth: [Infinity, -Infinity] };
  for (const point of points) for (const [axis, direction] of [['right', cameraRight], ['up', cameraUp], ['depth', cameraDirection]]) {
    const coordinate = point.dot(direction);
    projected[axis][0] = Math.min(projected[axis][0], coordinate);
    projected[axis][1] = Math.max(projected[axis][1], coordinate);
  }
  const center = new THREE.Vector3()
    .addScaledVector(cameraRight, (projected.right[0] + projected.right[1]) / 2)
    .addScaledVector(cameraUp, (projected.up[0] + projected.up[1]) / 2)
    .addScaledVector(cameraDirection, (projected.depth[0] + projected.depth[1]) / 2);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
  let distance = 0;
  for (const point of points) {
    const corner = point.clone().sub(center);
    distance = Math.max(distance, corner.dot(cameraDirection) + Math.abs(corner.dot(cameraUp)) / tanV, corner.dot(cameraDirection) + Math.abs(corner.dot(cameraRight)) / tanH);
  }
  const fittedDistance = Math.max(250, distance * 1.12);
  camera.up.set(0, 1, 0);
  camera.position.copy(center).addScaledVector(cameraDirection, fittedDistance / zoom);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  framing = { min: bounds.min.toArray(), max: bounds.max.toArray(), center: center.toArray(), distance: fittedDistance, zoom, cameraPosition: camera.position.toArray() };
}

function applyState(state) {
  tiltRig.quaternion.setFromAxisAngle(tiltAxis, state.tilt);
  yawRig.rotation.y = state.yaw + manualYaw;
  cap.group.position.fromArray(state.cap.position);
  cap.update(state.cap);
  for (const [group, pose] of [[oldRefill, state.oldRefill], [newRefill, state.newRefill]]) {
    group.position.fromArray(pose.position);
    group.rotation.set(...pose.rotation);
    group.visible = pose.visible;
  }
  oldSeal.update(state.seal); oldSeal.group.visible = state.seal.visible;
  newSeal.update(state.newSeal); newSeal.group.visible = state.newSeal.visible;
  tiltRig.updateWorldMatrix(true, true);
  cap.outlet.getWorldPosition(outletWorld);
  cap.outlet.getWorldQuaternion(outletQuaternion);
  outletDirection.set(0, 1, 0).applyQuaternion(outletQuaternion);
  gel.update({ progress: state.progress, ...state.liquid, outletWorld, outletDirection });
  floor.material.opacity = .13 * (1 - state.framing.pouring);
  floor.visible = floor.material.opacity > .001;
  fitCamera(state);
}

function writeTelemetry(state, force = false) {
  const now = performance.now();
  if (!force && now - lastTelemetry < 150) return;
  lastTelemetry = now;
  const renderInfo = renderer?.info.render;
  Object.assign(viewport.dataset, {
    status: error ? 'error' : ready ? 'ready' : 'loading',
    progress: state.progress.toFixed(6), phase: state.phase,
    yaw: (state.yaw + manualYaw).toFixed(6), zoom: zoom.toFixed(6),
    drawCalls: String(renderInfo?.calls || 0), triangles: String(renderInfo?.triangles || 0),
  });
  telemetry.textContent = JSON.stringify({
    ...state, ready, error, inspection: { manualYaw, zoom, actualYaw: state.yaw + manualYaw },
    outlet: outletWorld.toArray(), outletDirection: outletDirection.toArray(),
    sealVisible: oldSeal?.group.visible ?? false, newSealVisible: newSeal?.group.visible ?? false,
    streamVisible: gel?.streamGroup.visible ?? false, framing, metrics,
    render: { calls: renderInfo?.calls || 0, triangles: renderInfo?.triangles || 0 },
    input: input?.getState?.() || null,
  });
}

function render() {
  frameRequest = 0;
  const state = computeRitualState(progress);
  if (ready) { applyState(state); renderer.render(scene, camera); }
  writeTelemetry(state, true);
}

async function boot() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor('#eeece5', 1);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0; canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Bamboo Shampoo: scroll to open, pour and refill; drag horizontally to rotate and pinch to zoom.');
    viewport.prepend(canvas);
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); ready = false; error = 'WebGL context lost';
      if (statusText) statusText.textContent = 'The interactive view has stopped. A still image of the product is shown.';
      writeTelemetry(computeRitualState(progress), true);
    });
    canvas.addEventListener('webglcontextrestored', () => location.reload());
    scene = new THREE.Scene(); scene.background = new THREE.Color('#eeece5');
    camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room, .025);
    scene.environment = environment.texture; scene.environmentIntensity = .58;
    room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#fff9ed', '#ced4c9', .70));
    const key = new THREE.DirectionalLight('#fff1de', 2.25);
    key.position.set(-230, 370, 350); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -350, right: 350, top: 450, bottom: -250, near: 1, far: 1600 });
    key.shadow.bias = -.00016; key.shadow.normalBias = .28; key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight('#f2fafb', .85); fill.position.set(250, 160, 340); scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffffff', 1.8); rim.position.set(130, 320, -210); scene.add(rim);
    floor = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600), new THREE.ShadowMaterial({ color: '#586145', opacity: .13 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -85.4; floor.receiveShadow = true; scene.add(floor);
    [body, cap] = await Promise.all([createBody({ THREE, engravingUrl: './original-engraving.svg' }), createRitualCap({ THREE })]);
    // Thin PET needs a transparent reflective skin here: two overlapping
    // refractive materials otherwise omit one another from Three's opaque
    // transmission buffer and make a full insert look empty.
    Object.assign(body.materials.clearPET, { transmission: 0, transparent: true, opacity: .22, depthWrite: false, roughness: .06 });
    body.materials.clearPET.needsUpdate = true;
    oldSeal = createPeelSeal({ THREE }); newSeal = createPeelSeal({ THREE }); gel = createGel({ THREE });
    tiltRig = new THREE.Group(); tiltRig.name = 'authored-product-tilt';
    yawRig = new THREE.Group(); yawRig.name = 'longitudinal-axis-inspection';
    product = new THREE.Group(); product.name = 'complete-retail-product'; product.position.y = -85;
    tiltRig.add(yawRig); yawRig.add(product); scene.add(tiltRig);
    oldRefill = new THREE.Group(); oldRefill.name = 'old-refill-with-seal-and-fill';
    newRefill = new THREE.Group(); newRefill.name = 'new-factory-sealed-refill';
    oldRefill.add(body.components.inlay, oldSeal.group, gel.oldFillGroup);
    newRefill.add(body.components.inlay.clone(true), newSeal.group, gel.newFillGroup);
    product.add(body.components.shell, oldRefill, newRefill, cap.group); scene.add(gel.streamGroup);
    Object.assign(metrics, { body: body.metrics, cap: cap.metrics, seal: oldSeal.metrics, gel: gel.metrics, units: 'mm', timeline: 'factory-sealed use and refill cycle; deterministic normalized scroll', petAppearance: 'Reflective transparent skin over refractive gel; thin-wall visual approximation avoids overlapping transmission buffers.' });
    scene.traverse(object => { if (object.geometry) { object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere(); } });
    progress = clamp(scrollY / scrollRange());
    input = createInspectionInput({
      canvas, getProgress: () => progress, setProgress,
      getYaw: () => manualYaw, setYaw: value => { manualYaw = value; scheduleRender(); },
      getZoom: () => zoom, setZoom: value => { zoom = clamp(value, .6, 3); scheduleRender(); },
      onChange: scheduleRender,
    });
    ready = true;
    if (statusText) statusText.textContent = 'Interactive product ready. Scroll up or down to control the cycle.';
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(viewport);
    resize(); render();
    document.dispatchEvent(new CustomEvent('assembly-ready', { detail: { metrics } }));
  } catch (failure) {
    error = String(failure?.message || failure);
    console.error('Product ritual could not start', failure);
    renderer?.domElement.remove();
    if (statusText) statusText.textContent = 'The interactive model needs WebGL in a current browser.';
    viewport.dataset.status = 'error'; writeTelemetry(computeRitualState(progress), true);
  }
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', resize, { passive: true });
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  input?.dispose(); resizeObserver?.disconnect();
  body?.dispose(); cap?.dispose(); oldSeal?.dispose(); newSeal?.dispose(); gel?.dispose();
  environment?.dispose(); floor?.geometry.dispose(); floor?.material.dispose(); renderer?.dispose();
}, { once: true });

// Hidden development inspection surface; no transport UI or autoplay loop.
window.__ASSEMBLY__ = {
  setProgress,
  getState: () => ({ ...computeRitualState(progress), ready, error, manualYaw, zoom }),
  getMetrics: () => metrics,
  get scene() { return scene; }, get renderer() { return renderer; }, get camera() { return camera; },
  get productRoot() { return product; }, get components() { return { shell: body?.components.shell, oldRefill, newRefill, cap: cap?.group }; },
  timeline: computeRitualState, render: scheduleRender,
};
boot();
