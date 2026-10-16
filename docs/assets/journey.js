// Native scrolling owns the story. Product and detail links remain ordinary
// navigation; only the basket and mobile menu temporarily lock the page.
export const JOURNEY_CHAPTERS = ['discover', 'collection', 'ritual', 'questions'];
const scents = ['aloe', 'argan', 'bamboo'];
const CHOICE_KEY = 'bamboo-journey-choice-v1';
const RETURN_KEY = 'bamboo-journey-return-v1';
export const BOOKMARK_LAYOUT = 'sage-autoplay-guide-v2';
export function normalizeChoice(value, fallback = { scent: 'aloe', format: 'shampoo' }) {
  return { scent: scents.includes(value?.scent) ? value.scent : fallback.scent,
    format: ['shampoo', 'refill'].includes(value?.format) ? value.format : fallback.format };
}
export function chapterPosition({ top, height }, scroll, viewport, header) {
  const travel = Math.max(1, height - Math.max(1, viewport - header));
  return Math.max(0, Math.min(1, (scroll + header - top) / travel));
}
export function positionFromBookmark(bookmark, rect, viewport, header, width) {
  if (bookmark?.viewportHeight === viewport && bookmark?.viewportWidth === width && Number.isFinite(bookmark?.scroll)) return Math.max(0, bookmark.scroll);
  if (!rect || !Number.isFinite(bookmark?.progress)) return Math.max(0, Number(bookmark?.scroll) || 0);
  return Math.max(0, rect.top - header + Math.max(0, Math.min(1, bookmark.progress)) * Math.max(1, rect.height - (viewport - header)));
}
export function validBookmark(value) {
  return value && JOURNEY_CHAPTERS.includes(value.chapter) && Number.isFinite(value.progress)
    && value.progress >= 0 && value.progress <= 1 && Number.isFinite(value.scroll) && value.scroll >= 0;
}
export function normalizeBookmark(value, layout = BOOKMARK_LAYOUT) {
  if (!value) return null;
  const migrated = value.chapter === 'materials';
  const point = { ...value, chapter: migrated ? 'ritual' : value.chapter };
  if (!validBookmark(point)) return null;
  // Earlier releases put the guide before the collection. A saved pixel offset
  // from that layout cannot represent the same chapter after the reorder.
  if (migrated || point.layout !== layout) {
    delete point.viewportHeight; delete point.viewportWidth;
  }
  if(point.chapter==='ritual'&&point.layout==='collection-before-ritual-v1'){
    point.legacyAnimationProgress=point.progress;
    point.progress=0;
  }
  if (migrated) point.progress = 0;
  point.layout = layout;
  return point;
}

export function initializeJourney({ ui, reduced, onChoice, onModal, onReady, getPlaybackSnapshot }) {
  const base = ui.routeBase || ui.base;
  const returnKey=ui.bookmarkKey||(ui.design==='classic'?`${RETURN_KEY}:classic`:RETURN_KEY);
  const layout=ui.bookmarkLayout||(ui.design==='classic'?'classic-scroll-guide-v1':BOOKMARK_LAYOUT);
  const main = document.querySelector('main[data-journey]');
  const continuous = main?.querySelector('[data-product-journey]') || main?.querySelector('[data-playback-profile]');
  const chapters = main ? [...main.querySelectorAll('[data-journey-chapter]')] : [];
  const allDialogs = [...document.querySelectorAll('dialog')].filter(el => el.getAttribute('id') !== 'journey-dialog');
  function cleanLegacyHistory() {
    const detailState = history.state != null && Object.prototype.hasOwnProperty.call(history.state, 'bambooDetail');
    const detailHash = location.hash.startsWith('#detail-');
    const materialHash = location.hash === '#materials';
    if (!detailState && !detailHash && !materialHash) return false;
    let state = history.state;
    if (detailState) { state = { ...state }; delete state.bambooDetail; }
    const hash = detailHash ? '' : materialHash ? '#ritual' : location.hash;
    history.replaceState(state, '', `${location.pathname}${location.search}${hash}`);
    return !!(detailState || detailHash);
  }
  const staleDetail = cleanLegacyHistory();
  let choice, returnPoint = null, modalLocked = false, lockedScroll = 0, modalOrder = [];
  let restoreStyles = null, chapterFrame = 0, afterModal = null;
  const storage = {
    read(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } },
    write(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Optional, local-only memory. */ } },
  };
  const pageScent = document.querySelector('main.pdp-page [data-product-form]')?.dataset.id;
  choice = normalizeChoice(pageScent ? { scent: pageScent, format: new URLSearchParams(location.search).get('format') } : storage.read(CHOICE_KEY),{scent:ui.design==='classic'?'bamboo':'aloe',format:'shampoo'});
  const headerHeight = () => (document.querySelector('.header')?.offsetHeight || 68) + (main && !continuous ? document.querySelector('[data-journey-nav]')?.offsetHeight || 0 : 0);
  const absoluteRect = element => { const r = element.getBoundingClientRect(); return { top: r.top + (modalLocked ? lockedScroll : window.scrollY), height: r.height }; };
  function bookmark() {
    if (!chapters.length) return null;
    const y = modalLocked ? lockedScroll : window.scrollY;
    const line = y + headerHeight() + 50;
    const chapter = [...chapters].reverse().find(el => absoluteRect(el).top <= line) || chapters[0];
    const rect = absoluteRect(chapter);
    const playback=getPlaybackSnapshot?.(chapter);
    return { chapter: chapter.dataset.journeyChapter, progress: chapterPosition(rect, y, innerHeight, headerHeight()), scroll: y, lang: ui.lang,
      ...(playback?{playback}:{}),
      viewportHeight: innerHeight, viewportWidth: innerWidth, layout };
  }
  function saveReturn() {
    const point = bookmark(); if (point) storage.write(returnKey, point);
    return point;
  }
  function select(next, { persist = true } = {}) {
    choice = normalizeChoice(next, choice);
    if (persist) storage.write(CHOICE_KEY, choice);
    document.documentElement.dataset.selectedScent = choice.scent;
    for (const hero of document.querySelectorAll('[data-world]')) {
      hero.dataset.world = choice.scent;
      hero.classList.remove(...scents.map(id => `scent-${id}`)); hero.classList.add(`scent-${choice.scent}`);
      hero.querySelectorAll('[data-world-name]').forEach(el => el.textContent = ui.names[choice.scent]);
      hero.querySelectorAll('[data-world-description]').forEach(el => el.textContent = ui.scentDescriptions[choice.scent]);
      hero.querySelectorAll('[data-world-link]').forEach(el => { el.href = `${base}/${ui.lang}/products/${choice.scent}/${el.dataset.worldFormat === 'refill' ? '?format=refill' : ''}`; });
    }
    document.querySelectorAll('[data-world-scent]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.worldScent === choice.scent)));
    onChoice?.(choice);
  }
  function modalState() {
    modalOrder = modalOrder.filter(el => el.open);
    allDialogs.forEach(el => { if (el.open && !modalOrder.includes(el)) modalOrder.push(el); });
    const top = modalOrder.at(-1) || null;
    const open = allDialogs.some(el => el.open);
    if (open === modalLocked) { onModal?.(open, top); return; }
    if (open) {
      returnPoint = saveReturn(); lockedScroll = window.scrollY;
      restoreStyles = { position: document.body.style.position, top: document.body.style.top,
        width: document.body.style.width, overflow: document.body.style.overflow };
      onModal?.(true, top);
      Object.assign(document.body.style, { position: 'fixed', top: `${-lockedScroll}px`, width: '100%', overflow: 'hidden' });
      document.documentElement.classList.add('modal-locked'); modalLocked = true;
    } else {
      modalLocked = false;
      Object.assign(document.body.style, restoreStyles); document.documentElement.classList.remove('modal-locked');
      let y = lockedScroll;
      if (returnPoint?.chapter) {
        const section = document.querySelector(`[data-journey-chapter="${returnPoint.chapter}"]`);
        if (section) y = positionFromBookmark(returnPoint, absoluteRect(section), innerHeight, headerHeight(), innerWidth);
      }
      window.scrollTo({ top: y, behavior: 'instant' });
      onModal?.(false, null); returnPoint = null;
      // Native dialog close restores its own originating focus. Restore the
      // page once, after the final required dialog, without adding history.
      requestAnimationFrame(() => { updateChapters();
        const resume = afterModal; afterModal = null; resume?.(); });
    }
  }
  const modalObserver = new MutationObserver(modalState);
  allDialogs.forEach(el => modalObserver.observe(el, { attributes: true, attributeFilter: ['open'] }));
  window.addEventListener('popstate', () => { cleanLegacyHistory(); schedule(); });
  document.addEventListener('click', event => {
    const target = event.target.closest('a,button'); if (!target || event.defaultPrevented) return;
    if (target.hasAttribute('data-world-scent')) { select({ scent: target.dataset.worldScent }); return; }
    if (target.tagName !== 'A' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || target.getAttribute('target') === '_blank' || target.hasAttribute('download')) return;
    if (main) {
      const url = new URL(target.href, location.href);
      const collection = main.querySelector('#collection');
      if (collection && url.origin === location.origin && url.pathname === `${base}/${ui.lang}/shop/` && !target.hasAttribute('data-native-route')) {
        event.preventDefault();
        const jump = () => collection.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
        if (allDialogs.some(el => el.open)) {
          afterModal = jump;
          allDialogs.filter(el => el.open).forEach(el => el.close());
          modalState();
        } else jump();
        return;
      }
      if (url.origin === location.origin && url.pathname !== location.pathname) saveReturn();
    }
  });
  document.querySelector('main.pdp-page [data-product-form]')?.addEventListener('change', event => {
    if (event.target.name === 'format') select({ format: event.target.value });
  });
  function updateChapters() {
    chapterFrame = 0; if (!main || modalLocked) return;
    const point = bookmark(); if (!point) return;
    main.dataset.activeChapter = point.chapter;
    const index = JOURNEY_CHAPTERS.indexOf(point.chapter);
    document.querySelectorAll('[data-journey-link]').forEach(el => {
      if (el.getAttribute('href') === `#${point.chapter}`) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-journey-nav]').forEach(el => {
      el.classList.toggle('is-visible', window.scrollY > 90);
      el.style.setProperty('--journey-progress', String((index + point.progress) / JOURNEY_CHAPTERS.length));
    });
  }
  const schedule = () => { if (!chapterFrame) chapterFrame = requestAnimationFrame(updateChapters); };
  window.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pagehide', () => { if (main) saveReturn(); });
  const saved = normalizeBookmark(storage.read(returnKey),layout);
  for (const link of document.querySelectorAll('[data-resume-journey]')) {
    link.hidden = !!main || !saved;
    if (saved) link.href = `${base}/${ui.lang}/?resume=1#${saved.chapter}`;
  }
  select(choice, { persist: false }); updateChapters();
  const navigationType = typeof performance !== 'undefined' ? performance.getEntriesByType('navigation')[0]?.type : null;
  const shouldResume = main && (staleDetail || new URLSearchParams(location.search).get('resume') === '1'
    || continuous && ['reload', 'back_forward'].includes(navigationType)) && saved;
  let ready = false;
  function readyJourney() {
    if (ready) return; ready = true;
    if (!main) return;
    if (!shouldResume) {
      const id = location.hash.slice(1);
      if (continuous && JOURNEY_CHAPTERS.includes(id)) document.querySelector(`[data-journey-chapter="${id}"]`)?.scrollIntoView({ behavior: 'instant', block: 'start' });
      onReady?.(); schedule(); return;
    }
    const restore = () => {
      const section = document.querySelector(`[data-journey-chapter="${saved.chapter}"]`);
      if (section) window.scrollTo({ top: positionFromBookmark(saved, absoluteRect(section), innerHeight, headerHeight(), innerWidth), behavior: 'instant' });
      onReady?.();
      schedule();
    };
    document.fonts.ready.then(() => requestAnimationFrame(restore));
  }
  if (!continuous) readyJourney();
  return { select, getChoice: () => ({ ...choice }), isLocked: () => modalLocked,
    getTopDialog: () => modalOrder.at(-1) || null, update: schedule, ready: readyJourney };
}
