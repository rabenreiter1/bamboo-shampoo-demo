// Native page scrolling owns the journey. Details borrow that position and
// return it; neither a timer nor a second smooth-scroll engine moves the page.
export const JOURNEY_CHAPTERS = ['discover', 'materials', 'ritual', 'collection', 'questions'];
const scents = ['aloe', 'argan', 'bamboo'];
const panels = ['product', 'materials', 'refill', 'faq', 'inspect'];
const CHOICE_KEY = 'bamboo-journey-choice-v1';
const RETURN_KEY = 'bamboo-journey-return-v1';
export function normalizeChoice(value, fallback = { scent: 'bamboo', format: 'shampoo' }) {
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

export function initializeJourney({ ui, reduced, onChoice, onDetail, onDetailClose, onModal, onZoom, onReady }) {
  const de = ui.lang === 'de', base = ui.base;
  const main = document.querySelector('main[data-journey]');
  const continuous = main?.querySelector('[data-product-journey]');
  const dialog = document.querySelector('#journey-dialog');
  const chapters = main ? [...main.querySelectorAll('[data-journey-chapter]')] : [];
  const allDialogs = [...document.querySelectorAll('dialog')];
  const detailPanels = dialog ? [...dialog.querySelectorAll('[data-detour-panel]')] : [];
  const staleDetail = history.state?.bambooDetail;
  if (staleDetail) {
    const state = { ...history.state }; delete state.bambooDetail;
    history.replaceState(state, '', `${location.pathname}${location.search}${location.hash.startsWith('#detail-') ? '' : location.hash}`);
  }
  const titles = de ? { product: 'Dein Bamboo.', materials: 'Drei Teile. Ein Ritual.', refill: 'Die Hülle bleibt.', faq: 'Gut zu wissen.', inspect: 'Ein genauerer Blick.' }
    : { product: 'Your Bamboo.', materials: 'Three parts. One ritual.', refill: 'The shell stays.', faq: 'Good to know.', inspect: 'A closer look.' };
  let choice, returnPoint = null, focusReturn = null, modalLocked = false, lockedScroll = 0, modalOrder = [];
  let restoreStyles = null, closingHistory = false, entry = null, chapterFrame = 0, afterModal = null;
  const storage = {
    read(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } },
    write(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Optional, local-only memory. */ } },
  };
  const pageScent = document.querySelector('main.pdp-page [data-product-form]')?.dataset.id;
  choice = normalizeChoice(pageScent ? { scent: pageScent, format: new URLSearchParams(location.search).get('format') } : storage.read(CHOICE_KEY));
  const headerHeight = () => (document.querySelector('.header')?.offsetHeight || 68) + (main && !continuous ? document.querySelector('[data-journey-nav]')?.offsetHeight || 0 : 0);
  const absoluteRect = element => { const r = element.getBoundingClientRect(); return { top: r.top + (modalLocked ? lockedScroll : window.scrollY), height: r.height }; };
  function bookmark() {
    if (!chapters.length) return null;
    const y = modalLocked ? lockedScroll : window.scrollY;
    const line = y + headerHeight() + 50;
    if (continuous?.classList.contains('is-loading') && line >= absoluteRect(continuous).top && line < absoluteRect(continuous).top + absoluteRect(continuous).height) {
      return { chapter: 'materials', progress: 0, scroll: y, lang: ui.lang, viewportHeight: innerHeight, viewportWidth: innerWidth };
    }
    const chapter = [...chapters].reverse().find(el => absoluteRect(el).top <= line) || chapters[0];
    const rect = absoluteRect(chapter);
    return { chapter: chapter.dataset.journeyChapter, progress: chapterPosition(rect, y, innerHeight, headerHeight()), scroll: y, lang: ui.lang,
      viewportHeight: innerHeight, viewportWidth: innerWidth };
  }
  function saveReturn() {
    const point = bookmark(); if (point) storage.write(RETURN_KEY, point);
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
    document.querySelectorAll('a[data-detour="product"][data-detour-format="refill"]:not([data-detour-scent])').forEach(el => {
      el.href = `${base}/${ui.lang}/products/${choice.scent}/?format=refill`;
    });
    if (dialog) {
      dialog.querySelector('[data-detour-feedback]')?.setAttribute('hidden', '');
      dialog.classList.remove(...scents.map(id => `scent-${id}`)); dialog.classList.add(`scent-${choice.scent}`);
      detailPanels.forEach(panel => { panel.classList.remove(...scents.map(id => `scent-${id}`)); panel.classList.add(`scent-${choice.scent}`); });
      const product = dialog.querySelector('[data-detour-panel="product"]');
      if (product) {
        product.querySelectorAll('[data-detail-scent],[data-scent-name]').forEach(el => el.textContent = ui.names[choice.scent]);
        product.querySelectorAll('[data-detail-description],[data-detour-product-description]').forEach(el => el.textContent = ui.scentDescriptions[choice.scent]);
        product.querySelectorAll('[data-detour-product-words]').forEach(el => el.textContent = ui.scentWords[choice.scent]);
        product.querySelectorAll('[data-product-dock-label]').forEach(el => el.textContent = `${ui.names[choice.scent]} / 250 ml`);
        const form = product.querySelector('[data-product-form]');
        if (form) {
          form.dataset.id = choice.scent; form.elements.scent.value = choice.scent;
          form.querySelector(`[name="format"][value="${choice.format}"]`).checked = true;
          form.querySelectorAll('[data-scent-link]').forEach(el => {
            const id = el.href.split('/products/')[1]?.split('/')[0];
            el.classList.toggle('is-current', id === choice.scent);
            if (id === choice.scent) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
          });
          form.dispatchEvent(new Event('journey-product-update'));
        }
        product.querySelectorAll('[data-product-page-link]').forEach(el => el.href = `${base}/${ui.lang}/products/${choice.scent}/${choice.format === 'refill' ? '?format=refill' : ''}`);
        product.querySelectorAll('.product-gallery__word,[data-gallery-scent]').forEach(el => el.textContent = ui.names[choice.scent]);
      }
    }
    if (dialog?.open && history.state?.bambooDetail) history.replaceState({ ...history.state,
      bambooDetail: { ...history.state.bambooDetail, scent: choice.scent, format: choice.format } }, '', location.href);
    onChoice?.(choice);
  }
  function modalState() {
    modalOrder = modalOrder.filter(el => el.open);
    allDialogs.forEach(el => { if (el.open && !modalOrder.includes(el)) modalOrder.push(el); });
    const top = modalOrder.at(-1) || null;
    const open = allDialogs.some(el => el.open);
    if (open === modalLocked) { onModal?.(open, top); return; }
    if (open) {
      lockedScroll = window.scrollY;
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
      requestAnimationFrame(() => { focusReturn?.focus({ preventScroll: true }); focusReturn = null; updateChapters();
        const resume = afterModal; afterModal = null; resume?.(); });
    }
  }
  const modalObserver = new MutationObserver(modalState);
  allDialogs.forEach(el => modalObserver.observe(el, { attributes: true, attributeFilter: ['open'] }));
  function renderDetail(type, options = {}) {
    if (!dialog || !panels.includes(type)) return;
    const from = options.trigger;
    if (!dialog.open) { returnPoint = saveReturn(); focusReturn = from || document.activeElement; }
    if (options.scent || options.format) select({ scent: options.scent, format: options.format });
    onDetailClose?.();
    detailPanels.forEach(panel => { panel.hidden = panel.dataset.detourPanel !== type; panel.inert = panel.hidden; });
    dialog.dataset.detour = type;
    dialog.querySelector('[data-detour-title]').textContent = titles[type];
    dialog.querySelector('[data-detour-body]')?.scrollTo({ top: 0, behavior: 'instant' });
    if (!dialog.open) dialog.showModal();
    modalState();
    onDetail?.(type, options, choice);
    dialog.querySelector('[data-detour-close]')?.focus({ preventScroll: true });
  }
  function openDetail(type, options = {}) {
    if (!panels.includes(type)) return;
    if (!dialog.open) {
      const state = { ...(history.state || {}), bambooDetail: { type, scent: options.scent || choice.scent, format: options.format || choice.format } };
      entry = { url: location.href, state: history.state };
      history.pushState(state, '', `#detail-${type}`);
    } else {
      history.replaceState({ ...(history.state || {}), bambooDetail: { type, scent: options.scent || choice.scent, format: options.format || choice.format } }, '', `#detail-${type}`);
    }
    renderDetail(type, options);
  }
  function finishClose() {
    onDetailClose?.();
    detailPanels.forEach(el => { el.hidden = true; el.inert = true; });
    if (dialog?.open) dialog.close();
    modalState();
  }
  function closeDetail() {
    if (!dialog?.open || closingHistory) return;
    if (history.state?.bambooDetail && entry) {
      closingHistory = true; history.back();
    } else finishClose();
  }
  window.addEventListener('popstate', () => {
    closingHistory = false;
    if (history.state?.bambooDetail) renderDetail(history.state.bambooDetail.type, history.state.bambooDetail);
    else finishClose();
  });
  dialog?.addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDetail(); }
  });
  dialog?.addEventListener('close', () => { if (dialog.dataset.detour) { onDetailClose?.(); modalState(); } });
  function typeForLink(target) {
    if (target.hasAttribute('data-native-route') || target.closest('.lang-switch')) return null;
    if (target.dataset.detour) return target.dataset.detour;
    if (continuous) return null;
    if (!main || target.tagName !== 'A') return null;
    const url = new URL(target.href, location.href);
    if (url.origin !== location.origin) return null;
    if (url.pathname.startsWith(`${base}/${ui.lang}/products/`)) return 'product';
    return ({ [`${base}/${ui.lang}/story/`]: 'materials', [`${base}/${ui.lang}/refill/`]: 'refill',
      [`${base}/${ui.lang}/faq/`]: 'faq', [`${base}/assembly/`]: 'inspect' })[url.pathname] || null;
  }
  document.addEventListener('click', event => {
    const target = event.target.closest('a,button'); if (!target || event.defaultPrevented) return;
    if (target.hasAttribute('data-detour-close')) { event.preventDefault(); closeDetail(); return; }
    if (target.hasAttribute('data-inspect-zoom')) { onZoom?.(target.dataset.inspectZoom); return; }
    if (target.hasAttribute('data-world-scent')) { select({ scent: target.dataset.worldScent }); return; }
    if (target.tagName === 'A' && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || target.getAttribute('target') === '_blank')) return;
    if (target.closest('#journey-dialog') && target.hasAttribute('data-scent-link')) {
      event.preventDefault(); select({ scent: new URL(target.href).pathname.split('/products/')[1]?.split('/')[0] }); return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || target.getAttribute('target') === '_blank') return;
    const type = typeForLink(target);
    if (type) {
      event.preventDefault();
      const url = target.tagName === 'A' ? new URL(target.href, location.href) : null;
      const linkedScent = url?.pathname.split('/products/')[1]?.split('/')[0];
      const linkedFormat = url?.searchParams.get('format');
      openDetail(type, { trigger: target, scent: target.dataset.detourScent || linkedScent,
        format: target.dataset.detourFormat || (linkedScent ? linkedFormat || 'shampoo' : type === 'refill' ? 'refill' : undefined) }); return;
    }
    if (main && target.tagName === 'A') {
      const url = new URL(target.href, location.href);
      if (url.origin === location.origin && url.pathname === `${base}/${ui.lang}/shop/` && !target.hasAttribute('data-native-route')) {
        event.preventDefault();
        const jump = () => document.querySelector('#collection')?.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
        if (allDialogs.some(el => el.open)) {
          afterModal = jump;
          allDialogs.filter(el => el !== dialog && el.open).forEach(el => el.close());
          if (dialog?.open) closeDetail(); else modalState();
        } else jump();
        return;
      }
      if (url.origin === location.origin && url.pathname !== location.pathname) saveReturn();
    }
  });
  dialog?.querySelector('[data-product-form]')?.addEventListener('change', event => {
    if (event.target.name === 'format') select({ format: event.target.value });
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
  const saved = storage.read(RETURN_KEY);
  for (const link of document.querySelectorAll('[data-resume-journey]')) {
    link.hidden = !!main || !validBookmark(saved);
    if (validBookmark(saved)) link.href = `${base}/${ui.lang}/?resume=1#${saved.chapter}`;
  }
  select(choice, { persist: false }); updateChapters();
  const navigationType = typeof performance !== 'undefined' ? performance.getEntriesByType('navigation')[0]?.type : null;
  const shouldResume = main && (staleDetail || new URLSearchParams(location.search).get('resume') === '1'
    || continuous && ['reload', 'back_forward'].includes(navigationType)) && validBookmark(saved);
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
  return { open: openDetail, close: closeDetail, select, getChoice: () => ({ ...choice }), isLocked: () => modalLocked,
    getTopDialog: () => modalOrder.at(-1) || null, update: schedule, ready: readyJourney };
}
