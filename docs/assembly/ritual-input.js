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
    progress: clampProgress(progress),
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
      progress: clampProgress(finite(event.progress, state.progress)),
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
      progress: clampProgress(finite(event.progress, state.progress)),
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
  return {...state, pointers, mode, progress: clampProgress(state.origin.progress - dy / scrollRange)};
}

export function zoomFromWheel(zoom, deltaY, deltaMode = 0, viewportHeight = 800) {
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(1, finite(viewportHeight, 800)) : 1;
  const pixels = finite(deltaY, 0) * unit;
  return clampZoom(clampZoom(zoom) * Math.exp(-pixels * INSPECTION_LIMITS.wheelZoomRate));
}

/**
 * Root owns native window scrolling and resize progress preservation. Its
 * setProgress callback writes progress back to real scroll. Call resize()
 * after root preserves progress to rebase an active gesture.
 */
export function createInspectionInput({canvas, getProgress, setProgress, getYaw, setYaw, getZoom, setZoom, onChange = () => {}}) {
  if (!canvas?.addEventListener) throw new TypeError('A canvas is required for inspection input.');
  const view = canvas.ownerDocument?.defaultView;
  if (!view) throw new TypeError('The inspection canvas must belong to a browser document.');
  const read = () => ({progress: clampProgress(getProgress()), yaw: finite(getYaw(), 0), zoom: clampZoom(getZoom())});
  let state = createGestureState(read());
  let disposed = false;

  const getScrollRange = () => {
    const scrolling = canvas.ownerDocument.scrollingElement || canvas.ownerDocument.documentElement;
    return Math.max(1, scrolling.scrollHeight - view.innerHeight);
  };
  const getState = () => ({...read(), mode: state.mode, pointerCount: state.pointers.length, pointerIds: state.pointers.map(pointer => pointer.id)});

  function commit(next) {
    const previous = state;
    state = next;
    if (next.progress !== previous.progress) setProgress(next.progress);
    if (next.yaw !== previous.yaw) setYaw(next.yaw);
    if (next.zoom !== previous.zoom) setZoom(next.zoom);
    if (next !== previous) onChange(getState());
  }

  const pointerEvent = (event, type = event.type) => ({
    type, pointerId: event.pointerId, pointerType: event.pointerType,
    x: event.clientX, y: event.clientY, ...read(), scrollRange: getScrollRange(),
  });

  function down(event) {
    if (disposed || (event.pointerType !== 'touch' && event.button !== 0)) return;
    event.preventDefault();
    commit(reduceInspectionGesture(state, pointerEvent(event)));
    try { canvas.setPointerCapture(event.pointerId); } catch { /* A browser may cancel before capture. */ }
  }
  function move(event) {
    if (disposed || !state.pointers.some(pointer => pointer.id === event.pointerId)) return;
    event.preventDefault();
    commit(reduceInspectionGesture(state, pointerEvent(event)));
  }
  function end(event, type = event.type) {
    if (disposed || !state.pointers.some(pointer => pointer.id === event.pointerId)) return;
    commit(reduceInspectionGesture(state, pointerEvent(event, type)));
    try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* Capture may already have been released. */ }
  }
  function wheel(event) {
    if (disposed || !event.ctrlKey) return; // Ordinary wheel scrolling stays native.
    event.preventDefault();
    const values = read();
    state = {...state, ...values};
    commit(reduceInspectionGesture(state, {type: 'zoom', zoom: zoomFromWheel(values.zoom, event.deltaY, event.deltaMode, view.innerHeight)}));
  }
  function cancelAll() {
    const pointerIds = state.pointers.map(pointer => pointer.id);
    commit(reduceInspectionGesture(state, {type: 'reset'}));
    for (const id of pointerIds) {
      try { if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); } catch { /* A lost pointer needs no capture. */ }
    }
  }

  const lostCapture = event => end(event, 'pointercancel');
  const passiveFalse = {passive: false};
  canvas.addEventListener('pointerdown', down, passiveFalse);
  canvas.addEventListener('pointermove', move, passiveFalse);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', lostCapture);
  canvas.addEventListener('wheel', wheel, passiveFalse);
  view.addEventListener('blur', cancelAll);

  return {
    getState,
    resize() { if (!disposed) commit(reduceInspectionGesture(state, {type: 'rebase', ...read()})); },
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
    },
  };
}
