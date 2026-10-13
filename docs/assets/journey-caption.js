import { JOURNEY_PHASES } from './journey-pose.js?v=shop-20261013-jury2';

const unit = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = value => { const p = unit(value); return p * p * p * (p * (p * 6 - 15) + 10); };

// The type follows the displayed model progress. There is no
// timer, independent autoplay or CSS easing tail after the model has settled.
export function captionMotion(q, phase) {
  const p = unit(q), overlap = Math.min(.006, (phase.end - phase.start) * .12);
  const enter = phase.id === JOURNEY_PHASES[0].id ? 1 : smooth((p - phase.start + overlap) / (overlap * 2.5));
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
  const current = section.querySelector('[data-journey-current]');
  const markers = [...section.querySelectorAll('[data-journey-at]')];
  let enhanced = false, lastPhase = '', lastState = null;
  let wasPinned = false;
  let referenceWidth = 0, referenceStageHeight = 0;
  const header = () => document.querySelector('.header')?.offsetHeight || 64;

  function measure() {
    if (!stage || !sticky || !enhanced) return;
    const stickyRect = sticky.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const sectionRect = section.getBoundingClientRect();
    const keepPose = referenceStageHeight && referenceWidth !== width && lastState && wasPinned
      && !document.querySelector('dialog[open]');
    // iPhone browser chrome can resize the visible stage while svh keeps the
    // story track stable. Keep its measured scroll duration until width changes.
    if (!referenceStageHeight || referenceWidth !== width) {
      referenceWidth = width; referenceStageHeight = stickyRect.height;
    }
    const travel = Math.max(1, sectionRect.height - referenceStageHeight);
    for (const marker of markers) {
      const at = unit(Number(marker.dataset.journeyAt)), until = unit(Number(marker.dataset.journeyUntil));
      marker.style.top = `${at * travel}px`;
      marker.style.height = `${Math.max(1, (until - at) * travel) + referenceStageHeight}px`;
    }
    if (keepPose) window.scrollTo({ top: Math.max(0, sectionRect.top + window.scrollY - header() + unit(lastState.q) * travel), behavior: 'instant' });
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
        (document.documentElement.lang === 'de' ? 'So funktioniert’s' : 'How it works');
      measure();
    }
  }

  const observer = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
  // Measure before the app's resize RAF can request a pose from newly resized
  // page geometry. This keeps a phone rotation from advancing the chapter.
  window.addEventListener('resize', measure, { passive: true });
  observer?.observe(section); if (stage) observer?.observe(stage);
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
    lastState = null; lastPhase = ''; referenceStageHeight = 0; wasPinned = false;
    for (const marker of markers) { marker.style.removeProperty('top'); marker.style.removeProperty('height'); }
    for (const caption of captions.values()) {
      caption.inert = false; caption.removeAttribute('aria-hidden'); caption.classList.remove('is-active', 'is-visible');
      caption.style.removeProperty('--caption-in'); caption.style.removeProperty('--caption-out');
    }
  }
  function prepare() {
    if (enhanced) return;
    section.classList.add('is-enhanced', 'is-loading');
    for (const [id, caption] of captions) {
      const active = id === JOURNEY_PHASES[0].id;
      caption.inert = !active; caption.setAttribute('aria-hidden', String(!active));
      caption.classList.toggle('is-active', active); caption.classList.toggle('is-visible', active);
    }
  }
  return { prepare, enhance, fallback, render, measure,
    get enhanced() { return enhanced; },
    getProgress() {
      const rect = section.getBoundingClientRect();
      const stageHeight = referenceStageHeight || sticky?.getBoundingClientRect().height || innerHeight;
      // Keep the pre-resize pin state. A shortened orientation can put the old
      // scroll pixels beyond the entire new track before resize is delivered.
      if (referenceWidth === document.documentElement.clientWidth) wasPinned = rect.top <= header() + 1 && rect.bottom >= header() + stageHeight - 1;
      return journeyScrollProgress(rect.top, rect.height, stageHeight, header());
    },
    suspend() { observer?.disconnect(); window.removeEventListener('resize', measure); },
    resume() { window.addEventListener('resize', measure, { passive: true }); observer?.observe(section); if (stage) observer?.observe(stage); measure(); },
  };
}
