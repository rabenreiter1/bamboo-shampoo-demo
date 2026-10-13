import { JOURNEY_PHASES } from './journey-pose.js?v=shop-20261013-reveal3';

const unit = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = value => { const p = unit(value); return p * p * p * (p * (p * 6 - 15) + 10); };

// The type and drawn leaders follow the displayed model progress. There is no
// timer, independent autoplay or CSS easing tail after the model has settled.
export function captionMotion(q, phase) {
  const p = unit(q), overlap = Math.min(.006, (phase.end - phase.start) * .12);
  const enter = phase.id === 'meet' ? 1 : smooth((p - phase.start + overlap) / (overlap * 2.5));
  const exit = phase.id === 'ready' ? 0 : smooth((p - phase.end + overlap) / (overlap * 2));
  return { enter, exit, opacity: unit(enter - exit) };
}

export function journeyScrollProgress(top, trackHeight, stageHeight, headerHeight) {
  const travel = Math.max(1, trackHeight - stageHeight);
  return unit((headerHeight - top) / travel);
}

export function initializeProductJourney(section) {
  const stage = section.querySelector('[data-shop-scene="journey"]');
  const sticky = section.querySelector('.product-journey__sticky');
  const captions = new Map([...section.querySelectorAll('[data-journey-caption]')].map(el => [el.dataset.journeyCaption, el]));
  const leaders = section.querySelector('[data-journey-leaders]');
  const current = section.querySelector('[data-journey-current]');
  const markers = [...section.querySelectorAll('[data-journey-at]')];
  const labels = new Map();
  let enhanced = false, lastPhase = '', lastState = null, dimensions = null;
  let referenceWidth = 0, referenceStageHeight = 0;
  const header = () => document.querySelector('.header')?.offsetHeight || 64;
  const detailLabels = [...section.querySelectorAll('[data-component-label]')];

  function measure() {
    if (!stage || !sticky || !enhanced) return;
    const rect = stage.getBoundingClientRect(), stickyRect = sticky.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const sectionRect = section.getBoundingClientRect();
    const keepPose = referenceStageHeight && referenceWidth !== width && lastState
      && sectionRect.top <= header() + 1 && sectionRect.bottom >= header() + stickyRect.height - 1
      && !document.querySelector('dialog[open]');
    // iPhone browser chrome can resize the visible stage while svh keeps the
    // story track stable. Keep its measured scroll duration until width changes.
    if (!referenceStageHeight || referenceWidth !== width) {
      referenceWidth = width; referenceStageHeight = stickyRect.height;
    }
    dimensions = { width: rect.width, height: rect.height };
    const svgRect = leaders?.getBoundingClientRect() || rect;
    labels.clear();
    for (const label of detailLabels) {
      const r = label.getBoundingClientRect();
      labels.set(label.dataset.componentLabel, { x: r.left + r.width / 2 - svgRect.left, y: r.top + r.height / 2 - svgRect.top });
    }
    const travel = Math.max(1, sectionRect.height - referenceStageHeight);
    for (const marker of markers) {
      const at = unit(Number(marker.dataset.journeyAt)), until = unit(Number(marker.dataset.journeyUntil));
      marker.style.top = `${at * travel}px`;
      marker.style.height = `${Math.max(1, (until - at) * travel) + referenceStageHeight}px`;
    }
    if (keepPose) window.scrollTo({ top: Math.max(0, sectionRect.top + window.scrollY - header() + unit(lastState.q) * travel), behavior: 'instant' });
    if (lastState) drawLeaders(lastState);
  }

  function drawLeaders(value) {
    if (!dimensions || !leaders) return;
    for (const id of ['shell', 'insert', 'cap']) {
      const path = leaders.querySelector(`[data-journey-leader="${id}"]`);
      const dot = leaders.querySelector(`[data-journey-leader-dot="${id}"]`);
      const anchor = value.anchors?.[id], label = labels.get(id);
      const phase = JOURNEY_PHASES.find(part => part.id === id);
      const motion = captionMotion(value.q, phase);
      const visible = enhanced && anchor?.visible && label && motion.opacity > .002;
      path?.classList.toggle('is-active', !!visible); dot?.classList.toggle('is-active', !!visible);
      if (!visible || !path || !dot) {
        if (path) path.style.opacity = '0';
        if (dot) dot.style.opacity = '0';
        continue;
      }
      const x = anchor.x * dimensions.width, y = anchor.y * dimensions.height;
      const bend = { x: label.x + (x >= label.x ? 22 : -22), y: label.y };
      path.setAttribute('d', `M ${label.x.toFixed(2)} ${label.y.toFixed(2)} L ${bend.x.toFixed(2)} ${bend.y.toFixed(2)} L ${x.toFixed(2)} ${y.toFixed(2)}`);
      path.style.setProperty('--leader-progress', String(motion.enter * (1 - motion.exit)));
      path.style.opacity = String(motion.opacity);
      dot.setAttribute('cx', x.toFixed(2)); dot.setAttribute('cy', y.toFixed(2)); dot.style.opacity = String(motion.opacity);
    }
  }

  function render(value) {
    if (!enhanced || !value) return;
    lastState = value;
    section.dataset.journeyPhase = value.phase;
    section.style.setProperty('--journey-progress', String(unit(value.q)));
    for (const phase of JOURNEY_PHASES) {
      const caption = captions.get(phase.id); if (!caption) continue;
      const motion = captionMotion(value.q, phase), active = value.phase === phase.id;
      caption.style.setProperty('--caption-in', String(motion.enter));
      caption.style.setProperty('--caption-out', String(motion.exit));
      caption.classList.toggle('is-visible', motion.opacity > .002);
      if (active !== caption.classList.contains('is-active')) {
        caption.classList.toggle('is-active', active); caption.inert = !active;
        caption.setAttribute('aria-hidden', String(!active));
      }
    }
    if (lastPhase !== value.phase) {
      lastPhase = value.phase;
      const activeCaption = captions.get(value.phase);
      if (current) current.textContent = activeCaption?.dataset.chapterLabel ||
        (value.q < .13 ? (document.documentElement.lang === 'de' ? 'Entdecken' : 'Discover') : value.q < .48 ? (document.documentElement.lang === 'de' ? 'Aufbau' : 'Inside') : (document.documentElement.lang === 'de' ? 'Ritual' : 'Ritual'));
      measure();
    }
    drawLeaders(value);
  }

  const observer = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
  // Measure before the app's resize RAF can request a pose from newly resized
  // page geometry. This keeps a phone rotation from advancing the chapter.
  window.addEventListener('resize', measure, { passive: true });
  observer?.observe(section); if (stage) observer?.observe(stage);
  for (const details of section.querySelectorAll('details[data-component]')) details.addEventListener('toggle', measure);
  document.fonts?.ready.then(measure);

  function enhance(value) {
    if (!enhanced) {
      const before = section.getBoundingClientRect();
      const wasBeyond = section.classList.contains('is-loading') && before.bottom <= header();
      enhanced = true; section.classList.add('is-enhanced');
      section.classList.remove('is-loading');
      for (const caption of captions.values()) {
        caption.inert = true; caption.setAttribute('aria-hidden', 'true');
        caption.classList.remove('is-active', 'is-visible');
      }
      referenceStageHeight = 0; lastPhase = ''; measure();
      if (wasBeyond) window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().height - before.height, behavior: 'instant' });
    }
    if (value) render(value);
  }
  function fallback() {
    enhanced = false; section.classList.remove('is-enhanced', 'is-loading');
    lastState = null; lastPhase = ''; dimensions = null; referenceStageHeight = 0;
    for (const marker of markers) { marker.style.removeProperty('top'); marker.style.removeProperty('height'); }
    for (const caption of captions.values()) {
      caption.inert = false; caption.removeAttribute('aria-hidden'); caption.classList.remove('is-active', 'is-visible');
      caption.style.removeProperty('--caption-in'); caption.style.removeProperty('--caption-out');
    }
    leaders?.querySelectorAll('.is-active').forEach(el => el.classList.remove('is-active'));
  }
  function prepare() {
    if (enhanced) return;
    section.classList.add('is-enhanced', 'is-loading');
    for (const [id, caption] of captions) {
      const active = id === 'meet';
      caption.inert = !active; caption.setAttribute('aria-hidden', String(!active));
      caption.classList.toggle('is-active', active); caption.classList.toggle('is-visible', active);
    }
  }
  return { prepare, enhance, fallback, render, measure,
    get enhanced() { return enhanced; },
    getProgress() {
      const rect = section.getBoundingClientRect();
      return journeyScrollProgress(rect.top, rect.height, referenceStageHeight || sticky?.getBoundingClientRect().height || innerHeight, header());
    },
    suspend() { observer?.disconnect(); window.removeEventListener('resize', measure); },
    resume() { window.addEventListener('resize', measure, { passive: true }); observer?.observe(section); if (stage) observer?.observe(stage); measure(); },
  };
}
