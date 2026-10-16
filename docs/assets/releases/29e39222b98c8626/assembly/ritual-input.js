/**
 * Inspection is independent of the authored, reversible product timeline.
 * This reducer holds gesture baselines and inspection values; it never advances
 * the animation with time or changes a product component.
 */
export const INSPECTION_LIMITS = Object.freeze({
  minZoom: 0.6,
  maxZoom: 3,
  axisLockDistance: 8,
  yawPerPixel: 0.012,
  wheelZoomRate: 0.002,
  wheelTau: 0.18,
  scrollTau: 0.22,
  spinTau: 0.30,
  velocityTau: 0.06,
  cycleViewportHeights: 9,
});

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const clampProgress = value => clamp(finite(value, 0), 0, 1);
export const clampZoom = value => clamp(finite(value, 1), INSPECTION_LIMITS.minZoom, INSPECTION_LIMITS.maxZoom);

const pointerDistance = pointers => Math.hypot(pointers[1].x - pointers[0].x, pointers[1].y - pointers[0].y);
const pointerFromEvent = event => ({
  id: event.pointerId,
  x: finite(event.x, 0),
  y: finite(event.y, 0),
  pointerType: event.pointerType || 'touch',
});

export function createGestureState({progress = 0, yaw = 0, zoom = 1} = {}) {
  return {
    progress: finite(progress, 0),
    yaw: finite(yaw, 0),
    zoom: clampZoom(zoom),
    pointers: [],
    mode: 'idle',
    origin: null,
    pinch: null,
  };
}

function rebase(state, keepAxis = false) {
  if (state.pointers.length >= 2) {
    return {
      ...state,
      mode: 'pinch',
      origin: null,
      pinch: {distance: Math.max(1, pointerDistance(state.pointers)), zoom: state.zoom},
    };
  }
  if (state.pointers.length === 1) {
    const pointer = state.pointers[0];
    return {
      ...state,
      mode: keepAxis && ['vertical', 'horizontal'].includes(state.mode) ? state.mode : 'pending',
      origin: {x: pointer.x, y: pointer.y, progress: state.progress, yaw: state.yaw, zoom: state.zoom},
      pinch: null,
    };
  }
  return {...state, mode: 'idle', origin: null, pinch: null};
}

/**
 * Coordinates are CSS pixels. A drag up advances the timeline, like native
 * touch scrolling. Pinching freezes progress and yaw. Joining or leaving
 * fingers starts from current coordinates, so no stale origin survives.
 */
export function reduceInspectionGesture(state, event) {
  if (event.type === 'reset') return createGestureState(state);

  if (event.type === 'rebase') {
    return rebase({
      ...state,
      progress: finite(event.progress, state.progress),
      yaw: finite(event.yaw, state.yaw),
      zoom: clampZoom(finite(event.zoom, state.zoom)),
    }, true);
  }

  if (event.type === 'zoom') return rebase({...state, zoom: clampZoom(event.zoom)}, true);

  if (event.type === 'pointerdown') {
    if (state.pointers.some(pointer => pointer.id === event.pointerId)) return state;
    // Pick up native wheel/keyboard scrolling before the first finger. During
    // an active gesture its own values are authoritative.
    const values = state.pointers.length ? state : {
      ...state,
      progress: finite(event.progress, state.progress),
      yaw: finite(event.yaw, state.yaw),
      zoom: clampZoom(finite(event.zoom, state.zoom)),
    };
    return rebase({...values, pointers: [...state.pointers, pointerFromEvent(event)]});
  }

  const index = state.pointers.findIndex(pointer => pointer.id === event.pointerId);
  if (index < 0) return state;

  if (event.type === 'pointerup' || event.type === 'pointercancel') {
    return rebase({...state, pointers: state.pointers.filter(pointer => pointer.id !== event.pointerId)});
  }
  if (event.type !== 'pointermove') return state;

  const pointers = state.pointers.map((pointer, i) => i === index ? pointerFromEvent(event) : pointer);
  if (state.mode === 'pinch') {
    // Three or more fingers retain the first two as the pinch pair. Every join
    // or leave rebases that pair, including when an original finger leaves.
    const distance = Math.max(1, pointerDistance(pointers));
    return {...state, pointers, zoom: clampZoom(state.pinch.zoom * distance / state.pinch.distance)};
  }

  const pointer = pointers[0];
  const dx = pointer.x - state.origin.x;
  const dy = pointer.y - state.origin.y;
  let mode = state.mode;
  if (mode === 'pending') {
    if (Math.hypot(dx, dy) < INSPECTION_LIMITS.axisLockDistance) return {...state, pointers};
    mode = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
  }
  if (mode === 'horizontal') return {...state, pointers, mode, yaw: state.origin.yaw + dx * INSPECTION_LIMITS.yawPerPixel};
  const scrollRange = Math.max(1, finite(event.scrollRange, 1));
  return {...state, pointers, mode, progress: state.origin.progress - dy / scrollRange};
}

export function zoomFromWheel(zoom, deltaY, deltaMode = 0, viewportHeight = 800) {
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(1, finite(viewportHeight, 800)) : 1;
  const pixels = finite(deltaY, 0) * unit;
  return clampZoom(clampZoom(zoom) * Math.exp(-pixels * INSPECTION_LIMITS.wheelZoomRate));
}

/**
 * Virtual infinite transport. Root owns the single RAF animator and calls tick
 * with its timestamp. Progress callbacks carry unbounded cycle coordinates;
 * wheel tails are target smoothing, while only pointer release adds velocity.
 */
export function createInspectionInput({canvas, getProgress, setProgress, getCyclePosition = getProgress, setCyclePosition = setProgress, getYaw, setYaw, getZoom, setZoom, onChange = () => {}, now = () => performance.now()}) {
  if (!canvas?.addEventListener) throw new TypeError('A canvas is required for inspection input.');
  const view = canvas.ownerDocument?.defaultView;
  if (!view) throw new TypeError('The inspection canvas must belong to a browser document.');
  const read = () => ({progress: finite(getCyclePosition(), 0), yaw: finite(getYaw(), 0), zoom: clampZoom(getZoom())});
  let state = createGestureState(read());
  let disposed = false;
  let target = state.progress, wheelActive = false, wheelDirection = 0;
  let scrollVelocity = 0, yawVelocity = 0, sampleScrollVelocity = 0, sampleYawVelocity = 0;
  let lastSample = now(), lastMotion = -Infinity, lastTick = null;
  const reducedMotion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const isMoving = () => wheelActive || Math.abs(scrollVelocity) > 1e-5 || Math.abs(yawVelocity) > 1e-4;

  const getScrollRange = () => {
    return Math.max(1, view.innerHeight * INSPECTION_LIMITS.cycleViewportHeights);
  };
  const getState = () => ({...read(), cyclePosition: read().progress, targetCyclePosition: target,
    scrollVelocity, yawVelocity, isMoving: isMoving(), mode: state.mode,
    pointerCount: state.pointers.length, pointerIds: state.pointers.map(pointer => pointer.id)});

  function cancelMomentum() {
    scrollVelocity = yawVelocity = sampleScrollVelocity = sampleYawVelocity = 0;
    target = read().progress; wheelActive = false; wheelDirection = 0; lastTick = null;
    lastSample = now(); lastMotion = -Infinity;
  }

  function commit(next, notify = true) {
    const previous = state;
    state = next;
    if (next.progress !== previous.progress) setCyclePosition(next.progress);
    if (next.yaw !== previous.yaw) setYaw(next.yaw);
    if (next.zoom !== previous.zoom) setZoom(next.zoom);
    if (notify && next !== previous) onChange(getState());
  }

  const pointerEvent = (event, type = event.type) => ({
    type, pointerId: event.pointerId, pointerType: event.pointerType,
    x: event.clientX, y: event.clientY, ...read(), scrollRange: getScrollRange(),
  });

  function down(event) {
    if (disposed || (event.pointerType !== 'touch' && event.button !== 0)) return;
    event.preventDefault();
    cancelMomentum();
    commit(reduceInspectionGesture(state, pointerEvent(event)));
    try { canvas.setPointerCapture(event.pointerId); } catch { /* A browser may cancel before capture. */ }
  }
  function move(event) {
    if (disposed || !state.pointers.some(pointer => pointer.id === event.pointerId)) return;
    event.preventDefault();
    const previous = state;
    const next = reduceInspectionGesture(state, pointerEvent(event));
    const time = now(), dt = Math.max(.001, (time - lastSample) / 1000);
    const weight = 1 - Math.exp(-dt / INSPECTION_LIMITS.velocityTau);
    const dq = next.progress - previous.progress, dyaw = next.yaw - previous.yaw;
    if (next.mode === 'pinch') cancelMomentum();
    else {
      // A reversed flick belongs to its latest direction, rather than the
      // previous stroke's filtered velocity. Position still follows the finger.
      if (dq && Math.sign(dq) !== Math.sign(sampleScrollVelocity)) sampleScrollVelocity = 0;
      if (dyaw && Math.sign(dyaw) !== Math.sign(sampleYawVelocity)) sampleYawVelocity = 0;
      sampleScrollVelocity += (dq / dt - sampleScrollVelocity) * weight;
      sampleYawVelocity += (dyaw / dt - sampleYawVelocity) * weight;
      if (dq || dyaw) lastMotion = time;
    }
    lastSample = time;
    commit(next);
  }
  function end(event, type = event.type) {
    if (disposed || !state.pointers.some(pointer => pointer.id === event.pointerId)) return;
    const previousMode = state.mode;
    commit(reduceInspectionGesture(state, pointerEvent(event, type)));
    if (type === 'pointerup' && !state.pointers.length && !reducedMotion?.matches && now() - lastMotion <= 80) {
      scrollVelocity = previousMode === 'vertical' ? Math.max(-2, Math.min(2, sampleScrollVelocity)) : 0;
      yawVelocity = previousMode === 'horizontal' ? Math.max(-16, Math.min(16, sampleYawVelocity)) : 0;
      lastTick = now();
      if (isMoving()) onChange(getState());
    } else cancelMomentum();
    try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* Capture may already have been released. */ }
  }
  function wheel(event) {
    if (disposed) return;
    event.preventDefault();
    const values = read();
    state = {...state, ...values};
    if (event.ctrlKey) {
      cancelMomentum();
      commit(reduceInspectionGesture(state, {type: 'zoom', zoom: zoomFromWheel(values.zoom, event.deltaY, event.deltaMode, view.innerHeight)}));
      return;
    }
    if (state.pointers.length) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.innerHeight : 1;
    const delta = finite(event.deltaY, 0) * unit / getScrollRange();
    if (!delta) return;
    if (!wheelActive || Math.sign(delta) !== wheelDirection) target = values.progress;
    scrollVelocity = yawVelocity = 0;
    target += delta; wheelDirection = Math.sign(delta);
    if (reducedMotion?.matches) { commit({...state, progress: target}); wheelActive = false; }
    else { wheelActive = true; lastTick ??= now(); onChange(getState()); }
  }
  function key(event) {
    if (disposed || event.ctrlKey || event.metaKey || event.altKey || state.pointers.length) return;
    const steps = {ArrowDown: 80, ArrowUp: -80, PageDown: view.innerHeight * .85, PageUp: -view.innerHeight * .85, ' ': view.innerHeight * (event.shiftKey ? -.85 : .85)};
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); seek(Math.floor(read().progress) + (event.key === 'End' ? .999999 : 0)); return;
    }
    if (!(event.key in steps)) return;
    wheel({deltaY: steps[event.key], deltaMode: 0, preventDefault: () => event.preventDefault()});
  }
  function tick(timestamp) {
    if (disposed || !isMoving()) { lastTick = null; return false; }
    const dt = Math.max(0, Math.min(.05, (timestamp - (lastTick ?? timestamp)) / 1000));
    lastTick = timestamp;
    state = {...state, ...read()};
    let next = {...state};
    if (wheelActive) {
      next.progress += (target - next.progress) * (1 - Math.exp(-dt / INSPECTION_LIMITS.wheelTau));
      if (Math.abs(target - next.progress) < 1e-7) { next.progress = target; wheelActive = false; }
    } else if (scrollVelocity) {
      const decay = Math.exp(-dt / INSPECTION_LIMITS.scrollTau);
      next.progress += scrollVelocity * INSPECTION_LIMITS.scrollTau * (1 - decay);
      scrollVelocity *= decay;
      if (Math.abs(scrollVelocity) < 1e-5) scrollVelocity = 0;
    }
    if (yawVelocity) {
      const decay = Math.exp(-dt / INSPECTION_LIMITS.spinTau);
      next.yaw += yawVelocity * INSPECTION_LIMITS.spinTau * (1 - decay);
      yawVelocity *= decay;
      if (Math.abs(yawVelocity) < 1e-4) yawVelocity = 0;
    }
    commit(next, false);
    return isMoving();
  }
  function seek(q) { cancelMomentum(); state = {...state, ...read()}; commit(rebase({...state, progress: finite(q, 0)}, true)); target = state.progress; }
  function cancelAll() {
    cancelMomentum();
    const pointerIds = state.pointers.map(pointer => pointer.id);
    commit(reduceInspectionGesture(state, {type: 'reset'}));
    for (const id of pointerIds) {
      try { if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); } catch { /* A lost pointer needs no capture. */ }
    }
  }

  const lostCapture = event => end(event, 'pointercancel');
  const visibility = () => { if (canvas.ownerDocument.hidden) cancelAll(); };
  const passiveFalse = {passive: false};
  canvas.addEventListener('pointerdown', down, passiveFalse);
  canvas.addEventListener('pointermove', move, passiveFalse);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', lostCapture);
  canvas.addEventListener('wheel', wheel, passiveFalse);
  view.addEventListener('blur', cancelAll);
  view.addEventListener('keydown', key);
  canvas.ownerDocument.addEventListener?.('visibilitychange', visibility);
  reducedMotion?.addEventListener?.('change', cancelMomentum);

  return {
    getState, tick, cancelMomentum, seek,
    resize() { if (!disposed) { cancelMomentum(); commit(reduceInspectionGesture(state, {type: 'rebase', ...read()})); } },
    dispose() {
      if (disposed) return;
      cancelAll();
      disposed = true;
      canvas.removeEventListener('pointerdown', down, passiveFalse);
      canvas.removeEventListener('pointermove', move, passiveFalse);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
      canvas.removeEventListener('lostpointercapture', lostCapture);
      canvas.removeEventListener('wheel', wheel, passiveFalse);
      view.removeEventListener('blur', cancelAll);
      view.removeEventListener('keydown', key);
      canvas.ownerDocument.removeEventListener?.('visibilitychange', visibility);
      reducedMotion?.removeEventListener?.('change', cancelMomentum);
    },
  };
}
