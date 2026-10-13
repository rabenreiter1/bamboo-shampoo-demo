import * as THREE from '../assembly/vendor/three.module.js';
import { createStudioEnvironment } from '../assembly/studio-environment.js?v=ritual-20261013-1';
import { createBody, shellRadiusAt } from '../assembly/body.js?v=ritual-20261013-1';
import { createRitualCap } from '../assembly/ritual-cap.js?v=ritual-20261013-1';
import { createPeelSeal, createGel, configurePetReflectionSkin } from '../assembly/ritual-effects.js?v=ritual-20261013-journey';
import { computeCycleState, TILT_AXIS, clamp } from '../assembly/ritual-timeline.js?v=ritual-20261012-4';
import { createRitualSpace } from '../assembly/ritual-space.js?v=ritual-20261012-4';
import { computeJourneyPose, createJourneySpace, createJourneyCollarFlex } from './journey-pose.js?v=shop-20261013-studio2';

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
        configurePetReflectionSkin({ THREE, material: body.materials.clearPET });
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

const MODES = new Set(['product', 'refill', 'cap', 'ritual', 'journey']);
const STATIC_MODES = new Set(['product', 'refill', 'cap']);
const ALT = {
  product: 'Bamboo Shampoo, 250 ml. Bamboo case with the original engraving and emerald silicone cap. Drag left or right to rotate; arrow keys also rotate.',
  refill: 'A sealed 250 ml refill: a transparent PET insert, scent-coloured shampoo, visible headspace and a peelable film on its supporting flange. Drag left or right to rotate; arrow keys also rotate.',
  cap: 'The complete emerald silicone cap, with its integral teardrop feature and circular captive closure bearing. Drag left or right to rotate; arrow keys also rotate.',
  ritual: 'Bamboo Shampoo opening, pouring and refill sequence. Page scrolling moves the sequence forwards or backwards. Drag horizontally to inspect the product.',
  journey: 'Bamboo Shampoo: the complete filled product, its bamboo shell, sealed refill and complete cap, followed by opening, dispensing and refilling. Page scrolling controls every step. Drag horizontally to rotate.',
};
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/**
 * An element-sized shop viewer. The journey paints a coherent opaque world;
 * existing capture/default viewers retain transparent output. It never
 * intercepts vertical touch scrolling. The page supplies displayed progress.
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
  const opaque = options.opaque === true || initialMode === 'journey';
  const artDirection = ['campaign', 'detail'].includes(options.artDirection) ? options.artDirection : 'studio';
  const campaign = artDirection === 'campaign';
  const worlds = { aloe: '#ebe4ff', argan: '#f7d9ce', bamboo: '#ddeaf4' };
  let world = Object.hasOwn(worlds, options.scent) ? options.scent : 'bamboo';
  let backgroundColor = options.background || (initialMode === 'journey' || artDirection === 'campaign' ? worlds[world] : '#e7ebf2');
  let poseProgress = clamp(finite(options.poseProgress),0,1), targetPoseProgress = poseProgress,
    reveal = campaign ? clamp(finite(options.reveal),0,1) : 1;
  let mode = initialMode, disposed = false, ready = false, rendered = false, error = null, paused = options.paused === true;
  let renderer, scene, camera, bodyLease, body, cap, oldSeal, newSeal, gel, collarFlex;
  let tiltRig, yawRig, product, oldRefill, newRefill, floor, environment, key;
  let resizeObserver, intersectionObserver, frame = 0, lastTick = 0, lastReport = -1000;
  let width = 0, height = 0, inView = true, observedInView = null,
    progress = initialMode === 'journey' ? clamp(finite(options.progress), 0, 1) : finite(options.progress), targetProgress = progress;
  let manualYaw = finite(options.yaw), yawVelocity = 0, pointer = null, frames = 0, renderedMode = null;
  const fingers = new Map(); let pinch = null;
  let framing = null, spatial = null, state = computeCycleState(progress);
  let journeyPose = computeJourneyPose(progress), journeyState = {
    q: journeyPose.q, phase: journeyPose.phase, phaseProgress: journeyPose.phaseProgress,
    ritualProgress: journeyPose.ritualProgress, anchors: null,
  };
  let staticCameraDirty = true;
  let appliedPoseProgress = NaN, appliedReveal = NaN;
  let captionCopyHeight = 156, captionFooterHeight = 0;
  let warmupGeneration = 0, contextGeneration = 0, cancelWarmup = null, warmupPromise = null;
  let warming = false, shaderWarmupMilliseconds = 0;
  let renderPending = true;
  const framePeriods=[];let previousMovingTimestamp=0;
  let zoom = clamp(finite(options.zoom, 1), .6, 2.5);
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = media.matches;
  const cleanups = [];
  const space = createRitualSpace({ THREE });
  const journeySpace = createJourneySpace({ THREE });
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
  const active = () => !disposed && !paused && ready && !document.hidden && visibleNow() && width > 0 && height > 0;

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
      cyclePosition: progress, targetProgress, phase: mode === 'journey' ? journeyState.phase : mode === 'ritual' ? state.phase : `sealed-${mode}`,
      yaw: (mode === 'ritual' || mode === 'journey' ? state.yaw : progress * Math.PI * 4) + manualYaw,
      manualYaw, reducedMotion, frames, framing, spatial, artDirection, world, poseProgress,
      journey: mode === 'journey' ? journeyState : null, background: { color: backgroundColor, opaque },
      warming, shaderWarmupMilliseconds, paused, scent: gel?.scent || world,
      renderedMode, active: active(), inView, observedInView, renderPending, size: { width, height },
      performance:framePeriods.length?{samples:framePeriods.length,medianFramePeriodMs:[...framePeriods].sort((a,b)=>a-b)[Math.floor(framePeriods.length/2)],p95FramePeriodMs:[...framePeriods].sort((a,b)=>a-b)[Math.floor(framePeriods.length*.95)]}:null,
      visibility: {
        shell: product?.children[0]?.visible ?? false, cap: cap?.group.visible ?? false,
        oldRefill: oldRefill?.visible ?? false, newRefill: newRefill?.visible ?? false,
        oldSeal: oldSeal?.group.visible ?? false, oldFill: gel?.oldFillGroup.visible ?? false,
      },
      render: { calls: renderer?.info.render.calls || 0, triangles: renderer?.info.render.triangles || 0 },
      refillProjection,
      fillAppearance: fillMaterial ? { opacity: fillMaterial.opacity, transparent: fillMaterial.transparent,
        transmission: fillMaterial.transmission, visible: fillMaterial.visible, color: `#${fillMaterial.color.getHexString()}`, scent: gel.scent } : null,
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
        refillProjection: value.refillProjection, fillAppearance: value.fillAppearance, performance:value.performance }),
    });
    if (options.onState) {
      try { options.onState(value); }
      catch (failure) { console.warn('The shop viewer state callback failed.', failure); }
    }
  }

  function stopMomentum() {
    const captures = new Set(fingers.keys());
    if (pointer) captures.add(pointer.id);
    // Lost-capture events can fire while releasing. Clear every gesture first,
    // so pause, blur, hiding and context loss cannot revive a stale pinch.
    yawVelocity = 0;
    pointer = null; fingers.clear(); pinch = null;
    for (const id of captures) {
      try { renderer?.domElement.releasePointerCapture(id); } catch { /* A native cancellation may have released it already. */ }
    }
    if (renderer) renderer.domElement.style.cursor = options.interactive === false ? 'default' : 'grab';
  }

  function cancelFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastTick = 0; previousMovingTimestamp=0;
  }

  function requestRender() {
    renderPending = true;
    if (disposed || paused || !ready || document.hidden || !renderer || !camera) return;
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
      ? new THREE.Vector3(.13, .83, 1).normalize()
      : campaign ? new THREE.Vector3(.10, .28, 1).normalize() : space.directions.direction;
    const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    const [radius, bottom, top] = mode === 'cap' ? [40, 149.9, 173.4]
      : mode === 'refill' ? [29.1, 5, 170.5] : [40, 0, 173.4];
    const points = [];
    for (const y of [bottom, top]) for (let j = 0; j < 48; j++) {
      const angle = j * Math.PI / 24;
      points.push(new THREE.Vector3(radius * Math.cos(angle), y - 85, radius * Math.sin(angle))
        .applyMatrix4(tiltRig.matrixWorld));
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
    const journey = mode === 'journey', animated = ritual || journey;
    if (journey) { journeyPose = computeJourneyPose(progress); state = journeyPose.state; }
    else state = computeCycleState(ritual ? progress : 0);
    tiltRig.quaternion.setFromAxisAngle(tiltAxis, animated ? state.tilt : 0);
    tiltRig.position.y = 0;
    if (journey && journeyPose.roll) {
      tiltRig.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), journeyPose.roll));
    }
    if (!animated && campaign) {
      tiltRig.rotation.z = .22 - poseProgress * .13 + (1 - reveal) * .10;
      tiltRig.position.y = (1 - reveal) * -8;
      if (poseProgress !== appliedPoseProgress || reveal !== appliedReveal) staticCameraDirty = true;
      appliedPoseProgress = poseProgress; appliedReveal = reveal;
    }
    yawRig.rotation.y = (animated ? state.yaw : progress * Math.PI * 4)
      + manualYaw + (campaign && !animated ? -.10 + poseProgress * .45 + (1 - reveal) * -.16 : 0);
    product.visible = true;
    product.children[0].visible = mode === 'product' || animated;
    cap.group.visible = mode !== 'refill';
    cap.update(animated ? state.cap : { lift: 0, swivel: 0, press: 0 });
    if (journey) collarFlex.update(state.cap.position[1]);
    for (const [group, pose] of [[oldRefill, state.oldRefill], [newRefill, state.newRefill]]) {
      group.position.fromArray(pose.position); group.rotation.set(...pose.rotation);
      group.visible = animated ? pose.visible : group === oldRefill && mode !== 'cap';
    }
    oldSeal.update({ ...(animated ? state.seal : { unfold: 0, peel: 0, exit: 0 }), externalExit: true });
    newSeal.update(state.newSeal); newSeal.group.visible = animated && state.newSeal.visible;
    tiltRig.updateWorldMatrix(true, true);
    if (journey) {
      framing = journeySpace.fitCamera({ pose: journeyPose, camera, tiltRig, zoom, width, height,
        copyHeight: captionCopyHeight, footerHeight: captionFooterHeight, layoutWidth: innerWidth, layoutHeight: innerHeight });
      spatial = journeySpace.placeParts({ pose: journeyPose, camera, product, cap, oldRefill, newRefill, oldSeal, width });
    } else if (ritual) {
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
    gel.update({ progress: animated ? state.progress : 0,
      ...(animated ? state.liquid : { flow: 0, gush: 0, fillOld: 1, fillNew: 1 }), outletWorld, outletDirection });
    floor.position.y = campaign ? -101 : mode === 'refill' ? -80.4 : -85.4;
    floor.material.opacity = .105 * (1 - (animated ? state.framing.pouring : 0));
    floor.visible = mode !== 'cap' && floor.material.opacity > .001;
    if (journey) {
      journeyState = { q: journeyPose.q, phase: journeyPose.phase, phaseProgress: journeyPose.phaseProgress,
        ritualProgress: journeyPose.ritualProgress,
        anchors: journeySpace.anchors({ pose: journeyPose, camera, product, cap, oldRefill, newRefill, oldSeal, newSeal }) };
    }
  }

  function draw() {
    applyState();
    renderer.render(scene, camera);
    frames++; rendered = true; renderedMode = mode; renderPending = false; renderer.domElement.style.opacity = '1';
    if (mode === 'journey' && options.onJourneyFrame) {
      try { options.onJourneyFrame(journeyState); }
      catch (failure) { console.warn('The journey frame callback failed.', failure); }
    }
  }

  function render(timestamp) {
    frame = 0;
    if (!active()) { lastTick = 0; return; }
    syncSize(container.getBoundingClientRect());
    const dt = lastTick ? Math.min(.05, Math.max(0, (timestamp - lastTick) / 1000)) : 1 / 60;
    lastTick = timestamp;
    let moving = false;
    if (campaign) {
      const previousReveal = reveal;
      reveal = reducedMotion ? 1 : Math.min(1, reveal + dt / 1.25);
      if (reveal !== previousReveal) moving = true;
      if (reducedMotion || Math.abs(targetPoseProgress - poseProgress) < .0001) poseProgress = targetPoseProgress;
      else { poseProgress += (targetPoseProgress - poseProgress) * (1 - Math.exp(-dt / .18)); moving = true; }
    }
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
    if(moving){if(previousMovingTimestamp){const period=timestamp-previousMovingTimestamp;if(period>0){framePeriods.push(period);if(framePeriods.length>120)framePeriods.shift();}}previousMovingTimestamp=timestamp;}else previousMovingTimestamp=0;
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
    if (mode === 'journey') {
      const style = window.getComputedStyle(container.closest('.product-journey__sticky') || container);
      captionCopyHeight = parseFloat(style.getPropertyValue('--journey-copy-height')) || (innerWidth <= 760 ? 156 : 132);
      captionFooterHeight = parseFloat(style.getPropertyValue('--journey-footer-height')) || 0;
    }
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

  function setProgress(value, settings = {}) {
    if (disposed) return;
    targetProgress = mode === 'journey' ? clamp(finite(value), 0, 1) : finite(value);
    if (!active() || reducedMotion || settings.immediate) progress = targetProgress;
    requestRender();
  }

  function setYaw(value) {
    if (disposed) return;
    stopMomentum(); manualYaw = finite(value); requestRender();
  }

  function setZoom(value) {
    if (disposed) return;
    zoom = clamp(finite(value, 1), .6, 2.5); staticCameraDirty = true; requestRender();
  }

  function setPaused(value) {
    if (disposed || paused === !!value) return;
    paused = !!value; stopMomentum(); cancelFrame();
    if (!paused) requestRender();
    report(true);
  }

  // Commerce scenes keep a separate, bounded camera pose so their scroll
  // drift never opens the package or changes the approved ritual timeline.
  function setPoseProgress(value) {
    if (disposed || !campaign) return;
    targetPoseProgress = clamp(finite(value), 0, 1);
    if (!active() || reducedMotion) poseProgress = targetPoseProgress;
    requestRender();
  }

  function setWorld(value, background) {
    if (disposed || !Object.hasOwn(worlds, value)) return false;
    world = value;
    gel?.setScent(value);
    backgroundColor = background || worlds[world];
    renderer?.setClearColor(backgroundColor, opaque ? 1 : 0);
    if (scene && opaque) {
      if (!scene.background?.isColor) scene.background = new THREE.Color(backgroundColor);
      else scene.background.set(backgroundColor);
    }
    requestRender();
    return true;
  }

  function setMode(value) {
    if (disposed || !STATIC_MODES.has(value) || initialMode === 'ritual' || initialMode === 'journey') return false;
    if (mode === value) return true;
    mode = value; stopMomentum(); staticCameraDirty = true;
    if (renderer) renderer.domElement.setAttribute('aria-label', options.label || ALT[mode]);
    report(true); requestRender();
    return true;
  }

  function installInput(canvas) {
    if (options.interactive === false) return;
    const distance = () => { const [a,b]=[...fingers.values()]; return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0; };
    listen(canvas, 'pointerdown', event => {
      if (event.button !== 0 || !active()) return;
      if (options.inspection) {
        if (!fingers.size) stopMomentum();
        fingers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        try { canvas.setPointerCapture(event.pointerId); } catch { /* Already cancelled touch. */ }
        if (fingers.size > 1) { yawVelocity=0;pointer=null;pinch={distance:distance(),zoom}; return; }
      } else {
        if (!event.isPrimary) return;
        stopMomentum();
      }
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY,
        lastX: event.clientX, lastTime: event.timeStamp, movedAt: event.timeStamp, axis: null };
    });
    listen(canvas, 'pointermove', event => {
      if (options.inspection && fingers.has(event.pointerId)) {
        fingers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if (pinch && fingers.size > 1) { event.preventDefault(); setZoom(pinch.zoom*distance()/Math.max(1,pinch.distance)); return; }
      }
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
      if (options.inspection) {
        const tracked = fingers.delete(event.pointerId);
        if (!tracked && pointer?.id !== event.pointerId) return;
        if (pinch) {
          pinch=null; yawVelocity=0; pointer=null;
          if (fingers.size>1) pinch={distance:distance(),zoom};
          if (fingers.size===1) { const [id,point]=[...fingers.entries()][0]; pointer={id,x:point.x,y:point.y,lastX:point.x,lastTime:event.timeStamp,movedAt:0,axis:null}; }
          return;
        }
      }
      if (!pointer || pointer.id !== event.pointerId) return;
      const shouldCoast = event.type === 'pointerup' && pointer.axis === 'horizontal'
        && event.timeStamp - pointer.movedAt < 90 && !reducedMotion;
      const velocity = shouldCoast ? yawVelocity : 0;
      stopMomentum(); yawVelocity = velocity; requestRender();
    };
    listen(canvas, 'pointerup', release); listen(canvas, 'pointercancel', release);
    listen(canvas, 'lostpointercapture', release);
    listen(canvas, 'keydown', event => {
      if (options.inspection && ['+','=','-'].includes(event.key)) { event.preventDefault(); setZoom(zoom*(event.key==='-'?1/1.2:1.2)); return; }
      if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
      event.preventDefault(); stopMomentum();
      manualYaw = event.key === 'Home' ? 0 : manualYaw + (event.key === 'ArrowRight' ? .28 : -.28);
      requestRender();
    });
    if (options.inspection) listen(canvas,'wheel',event=>{
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();setZoom(zoom*Math.exp(-event.deltaY*.005));
    },{passive:false});
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
    const previous = environment;
    environment = createStudioEnvironment({ THREE, renderer });
    scene.environment = environment.texture; scene.environmentIntensity = .82;
    previous?.dispose();
  }

  function disposeResources() {
    oldSeal?.dispose(); newSeal?.dispose(); gel?.dispose(); cap?.dispose(); cap = null;
    bodyLease?.release(); bodyLease = null;
    environment?.dispose(); floor?.geometry.dispose(); floor?.material.dispose(); key?.shadow.dispose();
    renderer?.domElement.remove(); renderer?.dispose(); renderer?.forceContextLoss();
    oldSeal = newSeal = gel = body = collarFlex = null;
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
      // An alpha-capable context can still paint opaque pixels. Clear alpha 1
      // plus a matching scene background avoids Safari layer compositing and
      // Three r186's white/.5 transmission fallback. Keeping context alpha is
      // also MDN's recommendation for platforms that emulate alpha:false.
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: options.capture === true, powerPreference: 'high-performance' });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.setClearColor(backgroundColor, opaque ? 1 : 0);
      const canvas = renderer.domElement;
      canvas.className = 'shop-product-canvas'; canvas.tabIndex = options.interactive === false ? -1 : 0;
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', options.label || ALT[mode]);
      if (options.interactive !== false && options.instructions) canvas.setAttribute('aria-description', options.instructions);
      Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', opacity: '0',
        touchAction: options.inspection ? 'none' : 'pan-y pinch-zoom', userSelect: 'none', cursor: options.interactive === false ? 'default' : 'grab' });
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
      if (opaque) scene.background = new THREE.Color(backgroundColor);
      camera = new THREE.PerspectiveCamera(30, 1, .5, 5000);
      makeEnvironment();
      scene.add(new THREE.HemisphereLight('#f5f3ff', '#647385', .25));
      key = new THREE.DirectionalLight('#fff3e6', 2.7);
      key.position.set(-230, 370, 350); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -350, right: 350, top: 450, bottom: -250, near: 1, far: 1600 });
      key.shadow.camera.updateProjectionMatrix();
      key.shadow.bias = -.00016; key.shadow.normalBias = .28; key.shadow.radius = 4; scene.add(key);
      const fill = new THREE.DirectionalLight('#dfeaff', .35); fill.position.set(250, 160, 340); scene.add(fill);
      const rim = new THREE.DirectionalLight('#ffffff', 2.6); rim.position.set(130, 320, -210); scene.add(rim);
      floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.ShadowMaterial({ color: '#586145', opacity: .105 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -85.4; floor.receiveShadow = true; scene.add(floor);
      const built = await Promise.allSettled([acquireBody(), createRitualCap({ THREE })]);
      if (built[0].status === 'fulfilled') { bodyLease = built[0].value; body = bodyLease.body; }
      if (built[1].status === 'fulfilled') cap = built[1].value;
      if (disposed) { bodyLease?.release(); bodyLease = null; cap?.dispose(); cap = null; return; }
      for (const result of built) if (result.status === 'rejected') throw result.reason;
      if (initialMode === 'journey') collarFlex = createJourneyCollarFlex({ cap, shellRadiusAt });
      if (renderer.getContext().isContextLost()) throw new Error('The 3D context was interrupted while the product was loading.');
      oldSeal = createPeelSeal({ THREE }); newSeal = createPeelSeal({ THREE }); gel = createGel({ THREE, scent: world });
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

  const api = { ready: null, setProgress, setYaw, setZoom, setPaused, setMode, setWorld, setPoseProgress, resize, destroy, getState,
    getProgress: () => progress, getJourneyState: () => mode === 'journey' ? journeyState : null, getMetrics: () => metrics };
  report(true);
  api.ready = boot().then(() => api);
  // Consumers may use the status callback/fallback instead of awaiting ready.
  // Preserve a rejectable ready promise without an unhandled-rejection report.
  api.ready.catch(() => {});
  return api;
}
