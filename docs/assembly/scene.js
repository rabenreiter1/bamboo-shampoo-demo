import * as THREE from './vendor/three.module.js';
import { createStudioEnvironment } from './studio-environment.js?v=ritual-20261013-1';
import { createBody } from './body.js?v=ritual-20261013-1';
import { createRitualCap } from './ritual-cap.js?v=ritual-20261013-1';
import { createPeelSeal, createGel, configurePetReflectionSkin } from './ritual-effects.js?v=ritual-20261013-3';
import { createInspectionInput } from './ritual-input.js?v=ritual-20261012-4';
import { computeCycleState, clamp, TILT_AXIS } from './ritual-timeline.js?v=ritual-20261012-4';
import { createRitualSpace } from './ritual-space.js?v=ritual-20261012-4';

const viewport = document.getElementById('viewport');
const telemetry = document.getElementById('assembly-state');
const statusText = document.getElementById('render-status');
const tiltAxis = new THREE.Vector3(...TILT_AXIS);
const outletWorld = new THREE.Vector3(), outletDirection = new THREE.Vector3();
const outletQuaternion = new THREE.Quaternion();
const space = createRitualSpace({ THREE });
let renderer, camera, scene, tiltRig, yawRig, product, floor;
let body, cap, oldSeal, newSeal, gel, oldRefill, newRefill, input;
let environment, resizeObserver, lastTelemetry = -1000;
let cyclePosition = 0, manualYaw = 0, zoom = 1, ready = false;
let error = null, frameRequest = 0, framing = null, spatial = null;
let renderDuration = 0, renderFrames = 0;
const metrics = {};

function scheduleRender() {
  if (!frameRequest) frameRequest = requestAnimationFrame(render);
}

function setProgress(value) {
  setCyclePosition(clamp(Number.isFinite(value) ? value : 0));
}

function setCyclePosition(value) {
  cyclePosition = Number.isFinite(value) ? value : 0;
  input?.seek(cyclePosition);
  scheduleRender();
}

function resize() {
  if (!renderer) return;
  const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 760 ? 1.3 : 1.8));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  input?.resize?.();
  scheduleRender();
}

function applyState(state) {
  tiltRig.quaternion.setFromAxisAngle(tiltAxis, state.tilt);
  yawRig.rotation.y = state.yaw + manualYaw;
  cap.update(state.cap);
  for (const [group, pose] of [[oldRefill, state.oldRefill], [newRefill, state.newRefill]]) {
    group.position.fromArray(pose.position);
    group.rotation.set(...pose.rotation);
    group.visible = pose.visible;
  }
  oldSeal.update({ ...state.seal, externalExit: true });
  newSeal.update(state.newSeal); newSeal.group.visible = state.newSeal.visible;
  tiltRig.updateWorldMatrix(true, true);
  framing = space.fitCamera({ state, camera, product, tiltRig, zoom });
  spatial = space.placeParts({ state, camera, product, cap, oldRefill, newRefill, oldSeal, width: viewport.clientWidth });
  product.updateWorldMatrix(true, true);
  cap.outlet.getWorldPosition(outletWorld);
  cap.outlet.getWorldQuaternion(outletQuaternion);
  outletDirection.set(0, 1, 0).applyQuaternion(outletQuaternion);
  gel.update({ progress: state.progress, ...state.liquid, outletWorld, outletDirection });
  floor.material.opacity = .13 * (1 - state.framing.pouring);
  floor.visible = floor.material.opacity > .001;
}

function writeTelemetry(state, force = false) {
  const now = performance.now();
  if (!force && now - lastTelemetry < 150) return;
  lastTelemetry = now;
  const renderInfo = renderer?.info.render;
  Object.assign(viewport.dataset, {
    status: error ? 'error' : ready ? 'ready' : 'loading',
    progress: state.progress.toFixed(6), phase: state.phase,
    cyclePosition: cyclePosition.toFixed(8), cycleIndex: String(state.cycleIndex),
    yaw: (state.yaw + manualYaw).toFixed(6), zoom: zoom.toFixed(6),
    drawCalls: String(renderInfo?.calls || 0), triangles: String(renderInfo?.triangles || 0),
  });
  telemetry.textContent = JSON.stringify({
    ...state, ready, error, inspection: { manualYaw, zoom, actualYaw: state.yaw + manualYaw },
    outlet: outletWorld.toArray(), outletDirection: outletDirection.toArray(),
    sealVisible: oldSeal?.group.visible ?? false, newSealVisible: newSeal?.group.visible ?? false,
    streamVisible: gel?.streamGroup.visible ?? false, framing, spatial, metrics,
    capOperation: cap?.group.userData.operation || null,
    render: { calls: renderInfo?.calls || 0, triangles: renderInfo?.triangles || 0,
      cpuMilliseconds: renderDuration, frames: renderFrames },
    input: input?.getState?.() || null,
  });
}

function render(timestamp = performance.now()) {
  frameRequest = 0;
  const started = performance.now();
  const moving = input?.tick(timestamp) || false;
  const state = computeCycleState(cyclePosition);
  if (ready) { applyState(state); renderer.render(scene, camera); renderFrames++; }
  renderDuration = performance.now() - started;
  writeTelemetry(state, !moving);
  if (ready && moving) scheduleRender();
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
      event.preventDefault(); ready = false; error = 'WebGL context lost'; input?.cancelMomentum();
      if (statusText) statusText.textContent = 'The interactive view has stopped. A still image of the product is shown.';
      writeTelemetry(computeCycleState(cyclePosition), true);
    });
    canvas.addEventListener('webglcontextrestored', () => location.reload());
    scene = new THREE.Scene(); scene.background = new THREE.Color('#eeece5');
    camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    environment = createStudioEnvironment({ THREE, renderer });
    scene.environment = environment.texture; scene.environmentIntensity = .82;
    scene.add(new THREE.HemisphereLight('#fff9ed', '#ced4c9', .30));
    const key = new THREE.DirectionalLight('#fff1de', 2.25);
    key.position.set(-230, 370, 350); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -350, right: 350, top: 450, bottom: -250, near: 1, far: 1600 });
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.bias = -.00016; key.shadow.normalBias = .28; key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight('#f2fafb', .40); fill.position.set(250, 160, 340); scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffffff', 1.8); rim.position.set(130, 320, -210); scene.add(rim);
    floor = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600), new THREE.ShadowMaterial({ color: '#586145', opacity: .13 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -85.4; floor.receiveShadow = true; scene.add(floor);
    [body, cap] = await Promise.all([createBody({ THREE, engravingUrl: './original-engraving.svg' }), createRitualCap({ THREE })]);
    // Thin PET needs a transparent reflective skin here: two overlapping
    // refractive materials otherwise omit one another from Three's opaque
    // transmission buffer and make a full insert look empty.
    configurePetReflectionSkin({ THREE, material: body.materials.clearPET });
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
    Object.assign(metrics, { body: body.metrics, cap: cap.metrics, seal: oldSeal.metrics, gel: gel.metrics, units: 'mm', timeline: 'Endless reversible sealed use/refill cycle; continuous 720 degree authored yaw per cycle', petAppearance: 'Reflective transparent skin over grapefruit-coral refractive gel; thin-wall visual approximation avoids overlapping transmission buffers.' });
    scene.traverse(object => { if (object.geometry) { object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere(); } });
    input = createInspectionInput({
      canvas, getCyclePosition: () => cyclePosition,
      setCyclePosition: value => { cyclePosition = value; },
      getYaw: () => manualYaw, setYaw: value => { manualYaw = value; },
      getZoom: () => zoom, setZoom: value => { zoom = clamp(value, .6, 3); },
      onChange: scheduleRender,
    });
    ready = true;
    if (statusText) statusText.textContent = 'Interactive product ready. Scroll up or down to control the cycle.';
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(viewport);
    resize();
    document.dispatchEvent(new CustomEvent('assembly-ready', { detail: { metrics } }));
  } catch (failure) {
    error = String(failure?.message || failure);
    console.error('Product ritual could not start', failure);
    renderer?.domElement.remove();
    if (statusText) statusText.textContent = 'The interactive model needs WebGL in a current browser.';
    viewport.dataset.status = 'error'; writeTelemetry(computeCycleState(cyclePosition), true);
  }
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  input?.dispose(); resizeObserver?.disconnect();
  body?.dispose(); cap?.dispose(); oldSeal?.dispose(); newSeal?.dispose(); gel?.dispose();
  environment?.dispose(); floor?.geometry.dispose(); floor?.material.dispose(); renderer?.dispose();
}, { once: true });

// Hidden inspection surface. Inertia runs only in response to user input.
window.__ASSEMBLY__ = {
  setProgress, setCyclePosition,
  getState: () => ({ ...computeCycleState(cyclePosition), ready, error, manualYaw, zoom, spatial }),
  getMetrics: () => metrics,
  get scene() { return scene; }, get renderer() { return renderer; }, get camera() { return camera; },
  get productRoot() { return product; }, get components() { return { shell: body?.components.shell, oldRefill, newRefill, cap: cap?.group }; },
  timeline: computeCycleState, render: scheduleRender,
};
boot();
