// Time owns autoplay; the approved assembly still owns every component pose.
// No page scrolling, manual inspection yaw or viewer suspension is driven here.
export const PLAYBACK_VERSION = 1;

const unit = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const minimumJerk = value => { const p = unit(value); return p * p * p * (p * (p * 6 - 15) + 10); };
const freezeProfile = (duration, checkpoints, chapters, independentYaw = false) => Object.freeze({
  duration, checkpoints: Object.freeze(checkpoints.map(point => Object.freeze(point))),
  chapters: Object.freeze(chapters.map(point => Object.freeze(point))), independentYaw,
});

export const PLAYBACK_PROFILES = Object.freeze({
  'hero-intro': freezeProfile(16,
    [[0, 0], [2, 0], [4, .30], [6, .44], [9, .64], [12, .78], [14, 1], [16, 1]],
    [[0, 0], [.30, .52], [.78, 1]]),
  'home-cycle': freezeProfile(32,
    [[0, 0], [2, 0], [5, .15], [9, .27], [12, .35], [20, .72], [24, .83], [29, .96], [30, 1], [32, 1]],
    [[0, .10], [.15, .20], [.35, .54], [.72, .875]]),
  'refill-teaser': freezeProfile(14,
    [[0, .72], [1, .72], [3, .765], [5, .83], [10, .90], [12, 1], [14, 1]],
    [[.72, .765], [.83, .83], [.90, .90], [.96, .96]], true),
});

function profileOf(name) {
  if (!Object.hasOwn(PLAYBACK_PROFILES, name)) throw new TypeError(`Unknown playback profile: ${name}`);
  return PLAYBACK_PROFILES[name];
}

function loopTime(value, duration) {
  const time = Number.isFinite(value) ? value : 0;
  return ((time % duration) + duration) % duration;
}

/** Reconstruct a reversible assembly pose from seconds within an endless loop. */
export function playbackAt(name, seconds) {
  const profile = profileOf(name), elapsed = loopTime(seconds, profile.duration);
  const points = profile.checkpoints;
  const index = Math.min(points.length - 2, Math.max(0, points.findLastIndex(point => elapsed >= point[0])));
  const [start, from] = points[index], [end, to] = points[index + 1];
  const q = from + (to - from) * minimumJerk((elapsed - start) / (end - start));
  const first = points[0][1], last = points.at(-1)[1];
  return { profile: name, duration: profile.duration, elapsed, q,
    progress: unit((q - first) / (last - first)),
    // Undefined keeps the source choreography's continuous 720-degree yaw.
    automaticYaw: profile.independentYaw ? Math.PI * 2 * elapsed / profile.duration : undefined,
  };
}

/** Seeking selects the earliest time at the requested pose, including holds. */
export function playbackTimeForProgress(name, value) {
  const points = profileOf(name).checkpoints;
  const q = Math.max(points[0][1], Math.min(points.at(-1)[1], Number.isFinite(value) ? value : points[0][1]));
  if (q === points[0][1]) return points[0][0];
  const next = points.findIndex(point => point[1] >= q);
  const [end, to] = points[next], [start, from] = points[next - 1];
  if (q === to) return end;
  const target = (q - from) / (to - from);
  let low = 0, high = 1;
  for (let i = 0; i < 44; i++) {
    const middle = (low + high) / 2;
    if (minimumJerk(middle) < target) low = middle; else high = middle;
  }
  return start + (end - start) * (low + high) / 2;
}

/** Old page pixels and incompatible timing revisions cannot restore a pose. */
export function normalizePlaybackSnapshot(value, name) {
  const profile = profileOf(name);
  if (!value || value.version !== PLAYBACK_VERSION || value.profile !== name
    || !Number.isFinite(value.elapsed) || value.elapsed < 0 || typeof value.paused !== 'boolean'
    || (value.yaw !== undefined && !Number.isFinite(value.yaw))) return null;
  return { version: PLAYBACK_VERSION, profile: name, elapsed: loopTime(value.elapsed, profile.duration),
    paused: value.paused, yaw: value.yaw ?? 0 };
}

/**
 * A visibility-gated clock with one optional scheduler. Pausing commits elapsed
 * time before cancelling its frame; resuming establishes a fresh time origin.
 * All times are milliseconds at the clock boundary and seconds in snapshots.
 */
export function createPlaybackClock({ profile = 'home-cycle', now = () => performance.now(),
  requestFrame = callback => requestAnimationFrame(callback), cancelFrame = id => cancelAnimationFrame(id),
  onFrame = () => {} } = {}) {
  const spec = profileOf(profile);
  let elapsed = 0, yaw = 0, paused = false, ready = false, visible = false, documentVisible = true;
  let blocked = false, suspended = false, unavailable = false, destroyed = false;
  let frame = null, origin = null, generation = 0;
  const running = () => !destroyed && !unavailable && ready && visible && documentVisible && !blocked && !suspended && !paused;
  function settle(timestamp) {
    if (origin !== null && running()) elapsed = loopTime(elapsed + Math.max(0, timestamp - origin) / 1000, spec.duration);
    origin = running() ? timestamp : null;
  }
  function getState() {
    return { ...playbackAt(profile, elapsed), yaw, paused, ready, visible, documentVisible, blocked, suspended,
      fallback: unavailable, running: running(),
      state: destroyed ? 'destroyed' : unavailable ? 'fallback' : !ready ? 'loading' : paused ? 'paused' : running() ? 'playing' : 'suspended' };
  }
  function cancel() { generation++; if (frame !== null) cancelFrame(frame); frame = null; }
  function schedule() {
    if (!running() || frame !== null) return;
    const ticket = ++generation;
    frame = requestFrame(timestamp => {
      if (ticket !== generation) return;
      frame = null;
      if (destroyed || !running()) { origin = null; return; }
      settle(Number.isFinite(timestamp) ? timestamp : now());
      onFrame(getState());
      schedule();
    });
  }
  function change(mutate) {
    if (destroyed) return getState();
    const timestamp = now(); settle(timestamp); mutate(); origin = running() ? timestamp : null;
    if (!running()) cancel();
    const state = getState(); onFrame(state); schedule(); return state;
  }
  function restore(value) {
    const valid = normalizePlaybackSnapshot(value, profile);
    if (!valid || destroyed) return false;
    change(() => { elapsed = valid.elapsed; paused = valid.paused; yaw = valid.yaw; });
    return true;
  }
  return {
    getState,
    getSnapshot({ yaw: manualYaw = yaw } = {}) {
      if (!destroyed) settle(now());
      return { version: PLAYBACK_VERSION, profile, elapsed, paused, yaw: Number.isFinite(manualYaw) ? manualYaw : yaw };
    },
    restore,
    setReady(value) { return change(() => { ready = !!value; }); },
    setVisible(value) { return change(() => { visible = !!value; }); },
    setDocumentVisible(value) { return change(() => { documentVisible = !!value; }); },
    setBlocked(value) { return change(() => { blocked = !!value; }); },
    pause() { return change(() => { paused = true; }); },
    play() { return change(() => { paused = false; }); },
    seek(q) { return change(() => { elapsed = playbackTimeForProgress(profile, q); paused = true; }); },
    suspend() { return change(() => { suspended = true; }); },
    resume() { return change(() => { suspended = false; }); },
    fallback(value = true) { return change(() => { unavailable = !!value; }); },
    destroy() { if (destroyed) return; settle(now()); destroyed = true; origin = null; cancel(); },
  };
}

const words = {
  de: { play: 'Animation abspielen', pause: 'Animation pausieren', playShort: 'Abspielen', pauseShort: 'Pause', loading: 'Die Animation lädt.',
    playing: 'Automatische Wiedergabe', paused: 'Animation pausiert', suspended: 'Wiedergabe wartet', fallback: 'Alle Schritte im Überblick.' },
  en: { play: 'Play animation', pause: 'Pause animation', playShort: 'Play', pauseShort: 'Pause', loading: 'Loading the animation.',
    playing: 'Automatic playback', paused: 'Animation paused', suspended: 'Playback waiting', fallback: 'All steps at a glance.' },
};

function visibleFraction(element, win, doc) {
  const rect = element?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return 0;
  const width = win.innerWidth || doc.documentElement.clientWidth;
  const height = win.innerHeight || doc.documentElement.clientHeight;
  return Math.max(0, Math.min(rect.right, width) - Math.max(0, rect.left))
    * Math.max(0, Math.min(rect.bottom, height) - Math.max(0, rect.top)) / (rect.width * rect.height);
}

/**
 * Enhance one independently controlled section. `render` receives actual scene
 * state, so explanatory type never runs ahead of the rendered product. Explicit
 * pause only stops this clock; the viewer remains free to coast and be inspected.
 */
export function initializePlayback(section, { lang = 'de', storage, now, requestFrame, cancelFrame } = {}) {
  if (!section?.querySelector) throw new TypeError('Playback needs a section element.');
  const profile = section.dataset.playbackProfile, spec = profileOf(profile);
  const doc = section.ownerDocument || document, win = doc.defaultView || window;
  const stage = section.querySelector('[data-shop-scene]');
  if (!stage) throw new TypeError('Playback needs its own 3D stage.');
  const copy = words[lang === 'de' ? 'de' : 'en'];
  const toggle = section.querySelector('[data-playback-toggle]'), seek = section.querySelector('[data-playback-seek]');
  const status = section.querySelector('[data-playback-status]');
  const controls = section.querySelector('[data-playback-controls]');
  const chapters = [...section.querySelectorAll('[data-playback-at]')];
  const captions = [...section.querySelectorAll('[data-journey-caption]')];
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: false };
  const storageKey = `bamboo-playback-v${PLAYBACK_VERSION}:${section.dataset.playbackId || profile}`;
  let view = null, enhanced = false, destroyed = false, lastDisplayed = null, restoringYaw = null, attachGeneration = 0;
  let lastStored = -Infinity, lastStatus = '', lastCaption = '';
  const pointers = new Map(), cleanups = [];
  try { if (storage === undefined) storage = win.sessionStorage; } catch { storage = null; }
  const clockNow = now || (() => win.performance.now());
  let clock;

  function listen(target, type, callback, settings) {
    target?.addEventListener?.(type, callback, settings);
    cleanups.push(() => target?.removeEventListener?.(type, callback, settings));
  }
  function readSaved() {
    try {
      if (typeof storage?.read === 'function') return storage.read(storageKey);
      const value = storage?.getItem?.(storageKey); return value ? JSON.parse(value) : null;
    } catch { return null; }
  }
  function getSnapshot() {
    const manualYaw = view?.getState?.().manualYaw;
    return clock.getSnapshot({ yaw: Number.isFinite(manualYaw) ? manualYaw : restoringYaw ?? clock.getState().yaw });
  }
  function persist(force = false) {
    if (!storage || destroyed || !clock) return;
    const timestamp = clockNow();
    if (!force && timestamp - lastStored < 1000) return;
    lastStored = timestamp;
    try {
      const snapshot = getSnapshot();
      if (typeof storage.write === 'function') storage.write(storageKey, snapshot);
      else storage.setItem?.(storageKey, JSON.stringify(snapshot));
    } catch { /* Storage is optional; inspection and commerce stay available. */ }
  }
  function showAllCaptions() {
    for (const caption of captions) {
      caption.inert = false; caption.removeAttribute('aria-hidden');
      caption.classList.remove('is-active', 'is-visible');
      caption.style.removeProperty('--caption-in'); caption.style.removeProperty('--caption-out');
    }
    lastCaption = '';
  }
  function renderCaptions(q, phase) {
    if (!enhanced || !captions.length || clock.getState().fallback) return;
    const active = captions.findLast(caption => q >= Number(caption.dataset.phaseStart)) || captions[0];
    const activeId = captions.some(caption => caption.dataset.journeyCaption === phase) ? phase : active.dataset.journeyCaption;
    for (const [index, caption] of captions.entries()) {
      const start = Number(caption.dataset.phaseStart), end = Number(caption.dataset.phaseEnd);
      const overlap = Math.min(.006, Math.max(.001, end - start) * .12);
      const enter = index === 0 ? 1 : minimumJerk((q - start + overlap) / (overlap * 2.5));
      const exit = index === captions.length - 1 ? 0 : minimumJerk((q - end + overlap) / (overlap * 2));
      caption.style.setProperty('--caption-in', String(enter)); caption.style.setProperty('--caption-out', String(exit));
      caption.classList.toggle('is-visible', unit(enter - exit) > .002);
      const selected = caption.dataset.journeyCaption === activeId;
      caption.classList.toggle('is-active', selected); caption.inert = !selected;
      caption.setAttribute('aria-hidden', String(!selected));
    }
    if (lastCaption !== activeId) { section.dataset.journeyPhase = activeId; lastCaption = activeId; }
  }
  function renderControls(state) {
    section.dataset.playbackState = state.state;
    section.dataset.playbackPaused = String(state.paused);
    section.dataset.playbackElapsed = state.elapsed.toFixed(4);
    section.dataset.playbackProgress = state.q.toFixed(6);
    section.style.setProperty('--playback-progress', String(state.progress));
    section.style.setProperty('--journey-progress', String(state.q));
    const disabled = !state.ready || state.fallback;
    if (controls) controls.hidden = state.fallback;
    if (toggle) {
      const label = state.paused ? copy.play : copy.pause;
      toggle.disabled = disabled; toggle.setAttribute('aria-label', label);
      toggle.dataset.playbackAction = state.paused ? 'play' : 'pause';
      toggle.classList.toggle('is-paused', state.paused);
      const text = toggle.querySelector('[data-playback-toggle-label]');
      if (text) text.textContent = state.paused ? copy.playShort : copy.pauseShort;
    }
    if (seek) {
      seek.disabled = disabled; seek.min = String(spec.checkpoints[0][1]); seek.max = '1'; seek.step = '.0001';
      seek.value = String(lastDisplayed?.q ?? state.q);
    }
    const q = lastDisplayed?.q ?? state.q;
    const current = Math.max(0, spec.chapters.findLastIndex(point => q >= point[0]));
    for (const [index, chapter] of chapters.entries()) {
      chapter.disabled = disabled;
      if (index === current) chapter.setAttribute('aria-current', 'step'); else chapter.removeAttribute('aria-current');
    }
    if (seek) seek.setAttribute('aria-valuetext', chapters[current]?.textContent.trim() || `${Math.round(state.progress * 100)}%`);
    if (status && lastStatus !== state.state) {
      status.setAttribute('aria-live', 'off'); status.textContent = copy[state.state] || copy.paused; lastStatus = state.state;
    }
  }
  function requestPose(state) {
    renderControls(state);
    if (view && state.ready && !state.fallback) view.setProgress(state.q, { immediate: true, automaticYaw: state.automaticYaw });
    if (state.running) persist();
  }
  clock = createPlaybackClock({ profile, now: clockNow,
    requestFrame: requestFrame || (callback => win.requestAnimationFrame(callback)),
    cancelFrame: cancelFrame || (id => win.cancelAnimationFrame(id)), onFrame: requestPose });

  function measureVisibility() {
    if (!destroyed) clock.setVisible(visibleFraction(stage, win, doc) >= .5);
  }
  const Observer = win.IntersectionObserver;
  const observer = Observer ? new Observer(entries => {
    const entry = entries.find(item => item.target === stage);
    if (entry && !destroyed) clock.setVisible(entry.isIntersecting && entry.intersectionRatio >= .5);
  }, { threshold: [0, .5, 1] }) : null;
  function prepare() {
    if (destroyed) return;
    if (media.matches) { fallback(); return; }
    enhanced = true; section.classList.add('is-enhanced'); section.classList.toggle('is-loading', !clock.getState().ready);
    renderCaptions(clock.getState().q); renderControls(clock.getState()); measureVisibility();
  }
  function render(value) {
    if (destroyed || !value) return;
    if (value.status === 'error') { fallback(); return; }
    if (view && clock.getState().fallback && value.ready && value.rendered && !media.matches) {
      // A restored GPU context warms and draws the same viewer; attach() is not
      // called again. Only its genuine first recovered frame can leave error
      // fallback, retaining elapsed time and the customer's explicit pause.
      const attached = view.getState?.();
      if (attached?.ready && attached.rendered && !attached.error) {
        clock.fallback(false); prepare();
      }
    }
    const q = [value.q, value.journey?.q, value.cyclePosition, value.progress].find(Number.isFinite);
    if (q !== undefined) {
      lastDisplayed = { q: unit(q), phase: value.phase || value.journey?.phase };
      renderCaptions(lastDisplayed.q, lastDisplayed.phase);
      renderControls(clock.getState());
    }
    // Callback reports from an initial warmup cannot start time before attach.
    if (view && (value.ready === false || value.rendered === false)) {
      if (clock.getState().ready) clock.setReady(false);
      if (enhanced) section.classList.add('is-loading');
    } else if (view && value.ready && value.rendered && !media.matches && !clock.getState().fallback) {
      section.classList.remove('is-loading');
      if (!clock.getState().ready) clock.setReady(true);
    }
  }
  function attach(nextView) {
    if (destroyed || !nextView) return;
    const generation = ++attachGeneration;
    // Replacing a viewer never inherits its predecessor's rendered readiness.
    clock.setReady(false); view = nextView;
    if (media.matches) { fallback(); return; }
    if (clock.getState().fallback) clock.fallback(false);
    prepare();
    if (restoringYaw !== null) { view.setYaw?.(restoringYaw); restoringYaw = null; }
    const state = clock.getState();
    view.setProgress(state.q, { immediate: true, automaticYaw: state.automaticYaw });
    render(view.getState?.());
    // ready is rejectable on real viewers; stale promises never wake replacements.
    Promise.resolve(nextView.ready).then(() => {
      if (!destroyed && generation === attachGeneration && view === nextView) render(nextView.getState?.());
    }).catch(() => { if (!destroyed && generation === attachGeneration) fallback(); });
  }
  function restore(value) {
    const valid = normalizePlaybackSnapshot(value, profile); if (!valid || destroyed) return false;
    restoringYaw = valid.yaw; lastDisplayed = null;
    const result = clock.restore(valid);
    if (view) { view.setYaw?.(valid.yaw); restoringYaw = null; }
    renderCaptions(clock.getState().q); return result;
  }
  function pauseForInspection() { if (!destroyed && !clock.getState().fallback) { clock.pause(); persist(true); } }
  function fallback() {
    if (destroyed) return;
    enhanced = false; section.classList.remove('is-enhanced', 'is-loading');
    clock.fallback(); showAllCaptions(); renderControls(clock.getState());
  }
  function suspend() {
    if (destroyed) return;
    persist(true); restoringYaw = getSnapshot().yaw;
    clock.suspend(); clock.setReady(false); view = null; attachGeneration++; observer?.disconnect(); pointers.clear();
  }
  function resume() {
    if (destroyed) return;
    clock.resume(); observer?.observe(stage); measureVisibility();
  }
  listen(toggle, 'click', () => {
    if (toggle.disabled || destroyed) return;
    if (clock.getState().paused) clock.play(); else clock.pause(); persist(true);
  });
  listen(seek, 'input', () => { if (!seek.disabled) { lastDisplayed = null; clock.seek(Number(seek.value)); persist(true); } });
  for (const chapter of chapters) listen(chapter, 'click', () => {
    if (!chapter.disabled) { lastDisplayed = null; clock.seek(Number(chapter.dataset.playbackAt)); persist(true); }
  });
  listen(stage, 'scene-inspection', pauseForInspection);
  listen(stage, 'pointerdown', event => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, axis: null });
  }, { passive: true });
  listen(stage, 'pointermove', event => {
    const pointer = pointers.get(event.pointerId); if (!pointer || pointer.axis) return;
    const x = event.clientX - pointer.x, y = event.clientY - pointer.y;
    if (Math.hypot(x, y) < 6) return;
    pointer.axis = Math.abs(x) > Math.abs(y) * 1.12 ? 'horizontal' : 'vertical';
    if (pointer.axis === 'horizontal') pauseForInspection();
  }, { passive: true });
  const release = event => pointers.delete(event.pointerId);
  listen(stage, 'pointerup', release, { passive: true }); listen(stage, 'pointercancel', release, { passive: true });
  listen(stage, 'lostpointercapture', release, { passive: true });
  listen(win, 'scroll', measureVisibility, { passive: true }); listen(win, 'resize', measureVisibility, { passive: true });
  listen(doc, 'visibilitychange', () => { clock.setDocumentVisible(!doc.hidden); persist(true); });
  listen(win, 'pagehide', suspend); listen(win, 'pageshow', resume);
  listen(doc, 'click', event => { if (event.target?.closest?.('a[href]')) persist(true); });
  listen(media, 'change', event => { if (event.matches) fallback(); });
  observer?.observe(stage);
  clock.setDocumentVisible(!doc.hidden); measureVisibility();
  const saved = readSaved(); if (saved) restore(saved);
  if (media.matches) fallback();

  return { prepare, attach, render, getProgress: () => clock.getState().q, getSnapshot, restore,
    setBlocked(value) { clock.setBlocked(value); }, suspend, resume, fallback,
    get enhanced() { return enhanced; },
    destroy() {
      if (destroyed) return;
      persist(true); destroyed = true; attachGeneration++; clock.destroy(); observer?.disconnect(); pointers.clear(); view = null;
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
  };
}
