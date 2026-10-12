import * as THREE from '../assembly/vendor/three.module.js';
import { RoomEnvironment } from '../assembly/vendor/RoomEnvironment.js';
import { createBody } from '../assembly/body.js';
import { createRitualCap } from '../assembly/ritual-cap.js?v=ritual-20261012-4';
import { createPeelSeal, createGel } from '../assembly/ritual-effects.js?v=ritual-20261012-4';
import { computeCycleState, TILT_AXIS, clamp } from '../assembly/ritual-timeline.js?v=ritual-20261012-4';
import { createRitualSpace } from '../assembly/ritual-space.js?v=ritual-20261012-4';

// The shop shares the approved component factories and original source artwork.
// Body geometry/materials never deform, so concurrent viewers can share them.
// Operative caps, peel membranes, fluid buffers and GPU environments are owned
// by their viewer; no assembly-viewer code or manufacturing dimensions change.
let sharedBody;
async function acquireBody() {
  if (!sharedBody) {
    const entry = { references: 0, value: null, promise: null };
    entry.promise = createBody({ THREE, engravingUrl: new URL('../assembly/original-engraving.svg', import.meta.url).href })
      .then(body => {
        Object.assign(body.materials.clearPET, {
          transmission: 0, transparent: true, opacity: .22, depthWrite: false, roughness: .06,
        });
        body.materials.clearPET.needsUpdate = true;
        entry.value = body;
        return body;
      });
    sharedBody = entry;
  }
  const entry = sharedBody;
  entry.references++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    entry.references--;
    if (!entry.references) {
      entry.value?.dispose();
      if (sharedBody === entry) sharedBody = null;
    }
  };
  try { return { body: await entry.promise, release }; }
  catch (error) { release(); throw error; }
}

const MODES = new Set(['product', 'refill', 'cap', 'ritual']);
const STATIC_MODES = new Set(['product', 'refill', 'cap']);
const ALT = {
  product: 'Bamboo Shampoo, 250 ml. Bamboo case with the original engraving and emerald silicone cap. Drag left or right to rotate; arrow keys also rotate.',
  refill: 'A sealed 250 ml refill: a transparent PET insert, amber shampoo, visible headspace and a peelable film on its supporting flange. Drag left or right to rotate; arrow keys also rotate.',
  cap: 'The complete emerald silicone cap, with its integral teardrop feature and circular captive closure bearing. Drag left or right to rotate; arrow keys also rotate.',
  ritual: 'Bamboo Shampoo opening, pouring and refill sequence. Page scrolling moves the sequence forwards or backwards. Drag horizontally to inspect the product.',
};
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/**
 * A transparent, element-sized shop viewer. It never listens for wheel events
 * or intercepts vertical touch scrolling. The page supplies ritual progress.
 *
 * const view = mountShopScene(element, { mode: 'product', onState });
 * await view.ready;
 * view.setMode('refill');  // same context, original approved components
 * view.setProgress(.55); // ritual: reversible, softly catches page scroll
 * view.destroy();
 */
export function mountShopScene(container, options = {}) {
  if (!container?.appendChild || !container?.getBoundingClientRect) throw new TypeError('A shop viewer needs a container element.');
  const initialMode = MODES.has(options.mode) ? options.mode : 'product';
  let mode = initialMode, disposed = false, ready = false, rendered = false, error = null;
  let renderer, scene, camera, bodyLease, body, cap, oldSeal, newSeal, gel;
  let tiltRig, yawRig, product, oldRefill, newRefill, floor, environment, key;
  let resizeObserver, intersectionObserver, frame = 0, lastTick = 0, lastReport = -1000;
  let width = 0, height = 0, inView = true, observedInView = null, progress = finite(options.progress), targetProgress = progress;
  let manualYaw = finite(options.yaw), yawVelocity = 0, pointer = null, frames = 0, renderedMode = null;
  let framing = null, spatial = null, state = computeCycleState(progress);
  let staticCameraDirty = true;
  let warmupGeneration = 0, contextGeneration = 0, cancelWarmup = null, warmupPromise = null;
  let warming = false, shaderWarmupMilliseconds = 0;
  let renderPending = true;
  const zoom = clamp(finite(options.zoom, 1), .6, 2);
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = media.matches;
  const cleanups = [];
  const space = createRitualSpace({ THREE });
  const tiltAxis = new THREE.Vector3(...TILT_AXIS);
  const outletWorld = new THREE.Vector3(), outletDirection = new THREE.Vector3();
  const outletQuaternion = new THREE.Quaternion();
  const fitVector = new THREE.Vector3();
  const metrics = {};
  function withinViewport(rect) {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0
      && rect.left < viewportWidth && rect.top < viewportHeight;
  }
  function visibleNow() {
    // A sticky stage may move into the viewport without the expected observer
    // transition, especially after a mobile layout/viewport change. Fresh
    // geometry is authoritative; the observer remains a cheap wake-up signal.
    inView = withinViewport(container.getBoundingClientRect());
    return inView;
  }
  const active = () => !disposed && ready && !document.hidden && visibleNow() && width > 0 && height > 0;

  function listen(target, type, handler, settings) {
    target.addEventListener(type, handler, settings);
    cleanups.push(() => target.removeEventListener(type, handler, settings));
  }

  function getState() {
    let refillProjection = null;
    if (ready && oldRefill && camera) {
      const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
      const p = new THREE.Vector3();
      for (const x of [-29, 29]) for (const y of [5, 170.5]) for (const z of [-29, 29]) {
        p.set(x, y, z).applyMatrix4(oldRefill.matrixWorld).project(camera);
        for (let j = 0; j < 3; j++) {
          const value = p.getComponent(j); minimum[j] = Math.min(minimum[j], value); maximum[j] = Math.max(maximum[j], value);
        }
      }
      refillProjection = { min: minimum, max: maximum, layerMask: oldRefill.layers.mask, cameraLayerMask: camera.layers.mask };
    }
    const fillMaterial = gel?.oldFillGroup.children[0]?.material;
    return {
      status: disposed ? 'disposed' : error ? 'error' : ready ? 'ready' : 'loading', ready, rendered, error, mode,
      progress: mode === 'ritual' ? state.progress : progress,
      cyclePosition: progress, targetProgress, phase: mode === 'ritual' ? state.phase : `sealed-${mode}`,
      yaw: (mode === 'ritual' ? state.yaw : progress * Math.PI * 4) + manualYaw,
      manualYaw, reducedMotion, frames, framing, spatial,
      warming, shaderWarmupMilliseconds,
      renderedMode, active: active(), inView, observedInView, renderPending, size: { width, height },
      visibility: {
        shell: product?.children[0]?.visible ?? false, cap: cap?.group.visible ?? false,
        oldRefill: oldRefill?.visible ?? false, newRefill: newRefill?.visible ?? false,
        oldSeal: oldSeal?.group.visible ?? false, oldFill: gel?.oldFillGroup.visible ?? false,
      },
      render: { calls: renderer?.info.render.calls || 0, triangles: renderer?.info.render.triangles || 0 },
      refillProjection,
      fillAppearance: fillMaterial ? { opacity: fillMaterial.opacity, transparent: fillMaterial.transparent,
        transmission: fillMaterial.transmission, visible: fillMaterial.visible, color: `#${fillMaterial.color.getHexString()}` } : null,
    };
  }

  function report(force = false) {
    const now = performance.now();
    if (!force && now - lastReport < 160) return;
    lastReport = now;
    const value = getState();
    Object.assign(container.dataset, {
      sceneStatus: value.status, sceneMode: mode, sceneRendered: String(rendered),
      progress: value.progress.toFixed(6), cyclePosition: progress.toFixed(6), phase: value.phase,
      yaw: value.yaw.toFixed(6), sceneFrames: String(frames),
      sceneRenderedMode: renderedMode || '',
      sceneWarming: String(warming), shaderWarmupMs: shaderWarmupMilliseconds.toFixed(1),
      sceneDiagnostics: JSON.stringify({ renderedMode, active: value.active, inView, observedInView, size: value.size,
        framing, visibility: value.visibility, render: value.render,
        refillProjection: value.refillProjection, fillAppearance: value.fillAppearance }),
    });
    if (options.onState) {
      try { options.onState(value); }
      catch (failure) { console.warn('The shop viewer state callback failed.', failure); }
    }
  }

  function stopMomentum() {
    yawVelocity = 0;
    if (pointer) {
      try { renderer?.domElement.releasePointerCapture(pointer.id); } catch { /* Capture may already be released by native scrolling. */ }
      pointer = null;
    }
    if (renderer) renderer.domElement.style.cursor = options.interactive === false ? 'default' : 'grab';
  }

  function cancelFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastTick = 0;
  }

  function requestRender() {
    renderPending = true;
    if (disposed || !ready || document.hidden || !renderer || !camera) return;
    const rect = container.getBoundingClientRect();
    inView = withinViewport(rect);
    if (!inView) { stopMomentum(); cancelFrame(); return; }
    syncSize(rect);
    if (width > 0 && height > 0 && !frame) frame = requestAnimationFrame(render);
  }

  function fitStaticCamera() {
    // Cylindrical envelopes make manual yaw stable: no camera breathing as
    // different engraving or cap corners rotate toward the viewer.
    const direction = mode === 'cap'
      ? new THREE.Vector3(.13, .83, 1).normalize() : space.directions.direction;
    const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    const [radius, bottom, top] = mode === 'cap' ? [40, 149.9, 173.4]
      : mode === 'refill' ? [29.1, 5, 170.5] : [40, 0, 173.4];
    const points = [];
    for (const y of [bottom, top]) for (let j = 0; j < 48; j++) {
      const angle = j * Math.PI / 24;
      points.push(new THREE.Vector3(radius * Math.cos(angle), y - 85, radius * Math.sin(angle)));
    }
    const limits = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
    const axes = [right, up, direction];
    for (const p of points) for (let j = 0; j < axes.length; j++) {
      const value = p.dot(axes[j]); limits[j][0] = Math.min(limits[j][0], value); limits[j][1] = Math.max(limits[j][1], value);
    }
    const center = new THREE.Vector3();
    for (let j = 0; j < axes.length; j++) center.addScaledVector(axes[j], (limits[j][0] + limits[j][1]) / 2);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
    let distance = 0;
    for (const p of points) {
      fitVector.copy(p).sub(center);
      distance = Math.max(distance, fitVector.dot(direction) + Math.abs(fitVector.dot(up)) / tanV,
        fitVector.dot(direction) + Math.abs(fitVector.dot(right)) / tanH);
    }
    distance = Math.max(100, distance * 1.12);
    camera.position.copy(center).addScaledVector(direction, distance / zoom);
    camera.up.set(0, 1, 0); camera.lookAt(center); camera.updateMatrixWorld();
    framing = { center: center.toArray(), distance, zoom, cameraPosition: camera.position.toArray() };
    staticCameraDirty = false;
  }

  function applyState() {
    const ritual = mode === 'ritual';
    state = computeCycleState(ritual ? progress : 0);
    tiltRig.quaternion.setFromAxisAngle(tiltAxis, ritual ? state.tilt : 0);
    yawRig.rotation.y = (ritual ? state.yaw : progress * Math.PI * 4) + manualYaw;
    product.visible = true;
    product.children[0].visible = mode === 'product' || ritual;
    cap.group.visible = mode !== 'refill';
    cap.update(ritual ? state.cap : { lift: 0, swivel: 0, press: 0 });
    for (const [group, pose] of [[oldRefill, state.oldRefill], [newRefill, state.newRefill]]) {
      group.position.fromArray(pose.position); group.rotation.set(...pose.rotation);
      group.visible = ritual ? pose.visible : group === oldRefill && mode !== 'cap';
    }
    oldSeal.update({ ...(ritual ? state.seal : { unfold: 0, peel: 0, exit: 0 }), externalExit: true });
    newSeal.update(state.newSeal); newSeal.group.visible = ritual && state.newSeal.visible;
    tiltRig.updateWorldMatrix(true, true);
    if (ritual) {
      framing = space.fitCamera({ state, camera, product, tiltRig, zoom });
      spatial = space.placeParts({ state, camera, product, cap, oldRefill, newRefill, oldSeal, width });
    } else {
      cap.group.position.set(0, 0, 0);
      oldSeal.group.position.set(0, 0, 0); oldSeal.group.visible = mode !== 'cap';
      if (staticCameraDirty) fitStaticCamera();
      spatial = null;
    }
    product.updateWorldMatrix(true, true);
    cap.outlet.getWorldPosition(outletWorld); cap.outlet.getWorldQuaternion(outletQuaternion);
    outletDirection.set(0, 1, 0).applyQuaternion(outletQuaternion);
    gel.update({ progress: ritual ? state.progress : 0,
      ...(ritual ? state.liquid : { flow: 0, gush: 0, fillOld: 1, fillNew: 1 }), outletWorld, outletDirection });
    floor.position.y = mode === 'refill' ? -80.4 : -85.4;
    floor.material.opacity = .105 * (1 - (ritual ? state.framing.pouring : 0));
    floor.visible = mode !== 'cap' && floor.material.opacity > .001;
  }

  function draw() {
    applyState();
    renderer.render(scene, camera);
    frames++; rendered = true; renderedMode = mode; renderPending = false; renderer.domElement.style.opacity = '1';
  }

  function render(timestamp) {
    frame = 0;
    if (!active()) { lastTick = 0; return; }
    syncSize(container.getBoundingClientRect());
    const dt = lastTick ? Math.min(.05, Math.max(0, (timestamp - lastTick) / 1000)) : 1 / 60;
    lastTick = timestamp;
    let moving = false;
    if (reducedMotion || Math.abs(targetProgress - progress) < .00001) progress = targetProgress;
    else {
      progress += (targetProgress - progress) * (1 - Math.exp(-dt / .14));
      moving = true;
    }
    if (!pointer && Math.abs(yawVelocity) > .014 && !reducedMotion) {
      const decay = Math.exp(-dt / .30);
      manualYaw += yawVelocity * .30 * (1 - decay);
      yawVelocity *= decay; moving = true;
    } else if (!pointer) yawVelocity = 0;
    try { draw(); report(!moving); }
    catch (failure) { fail(failure); return; }
    if (moving) requestRender(); else lastTick = 0;
  }

  function syncSize(rect) {
    if (!renderer || disposed) return;
    const nextWidth = Math.round(rect.width), nextHeight = Math.round(rect.height);
    if (nextWidth <= 0 || nextHeight <= 0) { width = nextWidth; height = nextHeight; cancelFrame(); return; }
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth; height = nextHeight;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse || width < 520 ? 1.3 : 1.65));
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    staticCameraDirty = true;
  }

  function resize() {
    if (!renderer || disposed) return;
    syncSize(container.getBoundingClientRect());
    requestRender();
  }

  function viewportChanged() {
    if (disposed) return;
    const wasVisible = inView, rect = container.getBoundingClientRect();
    inView = withinViewport(rect);
    if (!inView) { stopMomentum(); cancelFrame(); return; }
    // Native scrolling is also a wake-up path for a viewer first revealed
    // after its shader warmup. An already painted, idle viewer stays asleep.
    if (!wasVisible || !rendered) {
      progress = targetProgress; lastTick = 0; requestRender();
    } else if (renderPending || Math.round(rect.width) !== width || Math.round(rect.height) !== height) {
      requestRender();
    }
  }

  function setProgress(value) {
    if (disposed) return;
    targetProgress = finite(value);
    if (!active() || reducedMotion) progress = targetProgress;
    requestRender();
  }

  function setYaw(value) {
    if (disposed) return;
    stopMomentum(); manualYaw = finite(value); requestRender();
  }

  function setMode(value) {
    if (disposed || !STATIC_MODES.has(value) || initialMode === 'ritual') return false;
    if (mode === value) return true;
    mode = value; stopMomentum(); staticCameraDirty = true;
    if (renderer) renderer.domElement.setAttribute('aria-label', options.label || ALT[mode]);
    report(true); requestRender();
    return true;
  }

  function installInput(canvas) {
    if (options.interactive === false) return;
    listen(canvas, 'pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary || !active()) return;
      stopMomentum();
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY,
        lastX: event.clientX, lastTime: event.timeStamp, movedAt: event.timeStamp, axis: null };
    });
    listen(canvas, 'pointermove', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      if (!pointer.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        pointer.axis = Math.abs(dx) > Math.abs(dy) * 1.12 ? 'horizontal' : 'vertical';
        if (pointer.axis === 'horizontal') {
          try { canvas.setPointerCapture(event.pointerId); } catch { /* A native gesture can end before capture. */ }
          canvas.style.cursor = 'grabbing';
        }
      }
      if (pointer.axis !== 'horizontal') return;
      event.preventDefault();
      const dt = Math.max(.008, (event.timeStamp - pointer.lastTime) / 1000);
      const rotation = (event.clientX - pointer.lastX) * .010;
      const instantaneous = clamp(rotation / dt, -12, 12);
      if (instantaneous * yawVelocity < 0) yawVelocity = 0;
      const mix = 1 - Math.exp(-dt / .06);
      yawVelocity += (instantaneous - yawVelocity) * mix;
      manualYaw += rotation;
      pointer.lastX = event.clientX; pointer.lastTime = event.timeStamp;
      if (rotation) pointer.movedAt = event.timeStamp;
      requestRender();
    }, { passive: false });
    const release = event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const shouldCoast = event.type === 'pointerup' && pointer.axis === 'horizontal'
        && event.timeStamp - pointer.movedAt < 90 && !reducedMotion;
      const velocity = shouldCoast ? yawVelocity : 0;
      stopMomentum(); yawVelocity = velocity; requestRender();
    };
    listen(canvas, 'pointerup', release); listen(canvas, 'pointercancel', release);
    listen(canvas, 'lostpointercapture', release);
    listen(canvas, 'keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
      event.preventDefault(); stopMomentum();
      manualYaw = event.key === 'Home' ? 0 : manualYaw + (event.key === 'ArrowRight' ? .28 : -.28);
      requestRender();
    });
  }

  function fail(failure) {
    if (disposed) return;
    error = String(failure?.message || failure); ready = false; rendered = false; warming = false;
    stopMomentum(); cancelFrame();
    if (renderer) renderer.domElement.style.opacity = '0';
    report(true);
    container.dispatchEvent(new CustomEvent('shop-scene-error', { detail: { error, mode } }));
  }

  function makeEnvironment() {
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
    const previous = environment;
    environment = pmrem.fromScene(room, .025);
    scene.environment = environment.texture; scene.environmentIntensity = .58;
    room.dispose(); pmrem.dispose(); previous?.dispose();
  }

  function disposeResources() {
    oldSeal?.dispose(); newSeal?.dispose(); gel?.dispose(); cap?.dispose(); cap = null;
    bodyLease?.release(); bodyLease = null;
    environment?.dispose(); floor?.geometry.dispose(); floor?.material.dispose(); key?.shadow.dispose();
    renderer?.domElement.remove(); renderer?.dispose(); renderer?.forceContextLoss();
    oldSeal = newSeal = gel = body = null;
    environment = floor = key = renderer = scene = camera = null;
    product = tiltRig = yawRig = oldRefill = newRefill = null;
  }

  function warmShaders() {
    cancelWarmup?.();
    const generation = ++warmupGeneration, context = contextGeneration, currentRenderer = renderer;
    const started = performance.now();
    let abort;
    const cancelled = new Promise(resolve => { abort = () => resolve(false); });
    cancelWarmup = abort;
    const valid = () => !disposed && renderer === currentRenderer && generation === warmupGeneration
      && context === contextGeneration && !currentRenderer.getContext().isContextLost();
    ready = false; rendered = false; warming = true; cancelFrame();
    currentRenderer.domElement.style.opacity = '0'; report(true);
    const compile = () => Promise.race([
      currentRenderer.compileAsync(scene, camera).then(() => true), cancelled,
    ]);
    const task = (async () => {
      resize(); applyState(); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      // r186 compileAsync polls KHR_parallel_shader_compile without waiting for
      // shader linkage on the UI thread. It includes hidden component meshes,
      // so later cap/refill/stream visibility changes use warmed programs too.
      if (!await compile() || !valid()) return false;
      // Three's transmission prepass uses linear output and NoToneMapping.
      // Warm that variant as well, or first render would link another set.
      const target = new THREE.WebGLRenderTarget(1, 1);
      const toneMapping = currentRenderer.toneMapping;
      try {
        currentRenderer.setRenderTarget(target); currentRenderer.toneMapping = THREE.NoToneMapping;
        if (!await compile() || !valid()) return false;
      } finally {
        if (valid()) { currentRenderer.setRenderTarget(null); currentRenderer.toneMapping = toneMapping; }
        target.dispose();
      }
      if (!valid()) return false;
      // Mode/progress/size can change while linkage is pending. Reconstruct the
      // newest state only now; no loading RAF can reveal an obsolete pose.
      progress = targetProgress; staticCameraDirty = true;
      shaderWarmupMilliseconds = performance.now() - started;
      warming = false; error = null; ready = true; lastTick = 0;
      resize();
      cancelFrame();
      if (active()) draw();
      report(true);
      container.dispatchEvent(new CustomEvent('shop-scene-ready', { detail: { mode, metrics } }));
      return true;
    })();
    warmupPromise = task;
    task.catch(() => {});
    return task;
  }

  async function boot() {
    try {
      // Physical transmission writes straight RGB with transmission-derived
      // alpha. Let the browser composite that RGBA as straight alpha; assuming
      // premultiplied RGB can wash the amber refill to white on an ivory page.
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: options.capture === true, powerPreference: 'high-performance' });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
      // Ivory RGB is also the transmission buffer's empty background; alpha
      // stays zero so the surrounding shop section remains visible.
      renderer.setClearColor(options.background || '#f6f3eb', 0);
      const canvas = renderer.domElement;
      canvas.className = 'shop-product-canvas'; canvas.tabIndex = options.interactive === false ? -1 : 0;
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', options.label || ALT[mode]);
      Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', opacity: '0',
        touchAction: 'pan-y pinch-zoom', userSelect: 'none', cursor: options.interactive === false ? 'default' : 'grab' });
      container.appendChild(canvas);
      listen(canvas, 'webglcontextlost', event => {
        event.preventDefault(); contextGeneration++; warmupGeneration++; cancelWarmup?.(); warming = false;
        fail(new Error('The interactive model is unavailable. The product image remains available.'));
      });
      listen(canvas, 'webglcontextrestored', () => {
        if (disposed || !renderer || !scene) return;
        try {
          renderer.setRenderTarget(null); renderer.toneMapping = THREE.ACESFilmicToneMapping;
          // PMREM targets contain generated GPU pixels. Rebuild them after a
          // context restore; the source geometry/textures reupload normally.
          makeEnvironment();
          error = null;
          // The engraving may still be decoding. Restore its environment now,
          // then let boot finish constructing the component hierarchy.
          if (!product) { report(true); return; }
          staticCameraDirty = true; progress = targetProgress; lastTick = 0;
          warmShaders().catch(fail);
        } catch (failure) { fail(failure); }
      });
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(30, 1, .5, 5000);
      makeEnvironment();
      scene.add(new THREE.HemisphereLight('#fff9ed', '#ced4c9', .70));
      key = new THREE.DirectionalLight('#fff1de', 2.25);
      key.position.set(-230, 370, 350); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -350, right: 350, top: 450, bottom: -250, near: 1, far: 1600 });
      key.shadow.bias = -.00016; key.shadow.normalBias = .28; key.shadow.radius = 4; scene.add(key);
      const fill = new THREE.DirectionalLight('#f2fafb', .85); fill.position.set(250, 160, 340); scene.add(fill);
      const rim = new THREE.DirectionalLight('#ffffff', 1.8); rim.position.set(130, 320, -210); scene.add(rim);
      floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.ShadowMaterial({ color: '#586145', opacity: .105 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -85.4; floor.receiveShadow = true; scene.add(floor);
      const built = await Promise.allSettled([acquireBody(), createRitualCap({ THREE })]);
      if (built[0].status === 'fulfilled') { bodyLease = built[0].value; body = bodyLease.body; }
      if (built[1].status === 'fulfilled') cap = built[1].value;
      if (disposed) { bodyLease?.release(); bodyLease = null; cap?.dispose(); cap = null; return; }
      for (const result of built) if (result.status === 'rejected') throw result.reason;
      if (renderer.getContext().isContextLost()) throw new Error('The 3D context was interrupted while the product was loading.');
      oldSeal = createPeelSeal({ THREE }); newSeal = createPeelSeal({ THREE }); gel = createGel({ THREE });
      tiltRig = new THREE.Group(); tiltRig.name = 'shop-approved-product-tilt';
      yawRig = new THREE.Group(); yawRig.name = 'shop-longitudinal-inspection';
      product = new THREE.Group(); product.name = 'shop-retail-product'; product.position.y = -85;
      tiltRig.add(yawRig); yawRig.add(product); scene.add(tiltRig);
      oldRefill = new THREE.Group(); oldRefill.name = 'shop-original-sealed-inlay';
      newRefill = new THREE.Group(); newRefill.name = 'shop-replacement-sealed-inlay';
      oldRefill.add(body.components.inlay.clone(true), oldSeal.group, gel.oldFillGroup);
      newRefill.add(body.components.inlay.clone(true), newSeal.group, gel.newFillGroup);
      product.add(body.components.shell.clone(true), oldRefill, newRefill, cap.group); scene.add(gel.streamGroup);
      Object.assign(metrics, { body: body.metrics, cap: cap.metrics, seal: oldSeal.metrics, gel: gel.metrics,
        source: 'Approved assembly component factories; original engraving unchanged', units: 'mm' });
      error = null;
      installInput(canvas);
      resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
      if ('IntersectionObserver' in window) {
        intersectionObserver = new IntersectionObserver(entries => {
          const entry = entries.find(item => item.target === container);
          if (!entry) return;
          observedInView = entry.isIntersecting;
          viewportChanged();
        }, { threshold: 0 });
        intersectionObserver.observe(container);
      }
      listen(window, 'resize', resize, { passive: true });
      listen(window, 'scroll', viewportChanged, { passive: true });
      listen(window, 'blur', () => { stopMomentum(); cancelFrame(); });
      listen(window, 'focus', requestRender);
      listen(document, 'visibilitychange', () => {
        if (document.hidden) { stopMomentum(); cancelFrame(); }
        else { progress = targetProgress; lastTick = 0; requestRender(); }
      });
      const motionChange = event => {
        reducedMotion = event.matches; stopMomentum(); progress = targetProgress; requestRender();
      };
      listen(media, 'change', motionChange);
      resize();
      let pending = warmShaders();
      await pending;
      while (!disposed && pending !== warmupPromise) { pending = warmupPromise; await pending; }
      if (disposed) return;
      if (!ready) throw new Error(error || 'The shader warmup was interrupted.');
    } catch (failure) {
      cancelWarmup?.(); warming = false;
      fail(failure);
      for (const cleanup of cleanups.splice(0)) cleanup();
      resizeObserver?.disconnect(); intersectionObserver?.disconnect();
      disposeResources();
      throw failure;
    }
  }

  function destroy() {
    if (disposed) return;
    stopMomentum(); cancelFrame(); disposed = true; ready = false; rendered = false; warming = false;
    warmupGeneration++; cancelWarmup?.();
    resizeObserver?.disconnect(); intersectionObserver?.disconnect();
    for (const cleanup of cleanups.splice(0)) cleanup();
    disposeResources();
    container.dataset.sceneStatus = 'disposed'; container.dataset.sceneRendered = 'false';
  }

  const api = { ready: null, setProgress, setYaw, setMode, resize, destroy, getState, getMetrics: () => metrics };
  report(true);
  api.ready = boot().then(() => api);
  // Consumers may use the status callback/fallback instead of awaiting ready.
  // Preserve a rejectable ready promise without an unhandled-rejection report.
  api.ready.catch(() => {});
  return api;
}
