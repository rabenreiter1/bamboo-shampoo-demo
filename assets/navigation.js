// Routes stay ordinary links: browser history, modifiers and return bookmarks
// work without a client-side router. Only a deliberate link intent warms a page.
export function prefetchDestination(href, current, base) {
  try {
    const url = new URL(href, current), here = new URL(current);
    if (url.origin !== here.origin || !url.pathname.startsWith(`${base}/`)) return null;
    if (!/^\/(?:(?:design\/)?classic\/)?(?:de|en)\/(?:[a-z]+\/)*$/.test(url.pathname.slice(base.length))) return null;
    if (url.pathname === here.pathname && url.search === here.search) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

/** Mirror native dialog state without replacing its focus or Escape handling. */
export function initializeDialogDisclosures({document: doc = globalThis.document, window: win = globalThis.window} = {}) {
  const pairs = [];
  for (const opener of doc?.querySelectorAll?.('[aria-haspopup="dialog"][aria-controls]') || []) {
    const id = opener.getAttribute?.('aria-controls');
    const dialog = id && doc.getElementById?.(id);
    if (dialog?.tagName?.toLowerCase() === 'dialog') pairs.push({opener, dialog});
  }
  const sync = () => pairs.forEach(({opener, dialog}) => opener.setAttribute('aria-expanded', String(dialog.open)));
  const dialogs = [...new Set(pairs.map(({dialog}) => dialog))];
  const Observer = win?.MutationObserver || globalThis.MutationObserver;
  const observer = Observer ? new Observer(sync) : null;
  for (const dialog of dialogs) {
    observer?.observe(dialog, {attributes: true, attributeFilter: ['open']});
    dialog.addEventListener('close', sync);
    dialog.addEventListener('toggle', sync);
  }
  sync();
  return {sync, destroy() {
    observer?.disconnect();
    for (const dialog of dialogs) {
      dialog.removeEventListener('close', sync);
      dialog.removeEventListener('toggle', sync);
    }
  }};
}

export function initializeNavigation({ base, document: doc = document, window: win = window, limit = 4 } = {}) {
  const disclosures = initializeDialogDisclosures({document: doc, window: win});
  const warmed = new Set();
  let timer;
  const connection = win.navigator.connection;
  const canWarm = () => !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType);
  const targetLink = event => event.target.closest?.('a[href]');
  function warm(link) {
    if (!link || !canWarm() || link.hasAttribute('download') || link.target && link.target !== '_self') return;
    const href = prefetchDestination(link.href, win.location.href, base);
    if (!href || warmed.has(href) || warmed.size >= limit) return;
    const hint = doc.createElement('link');
    hint.rel = 'prefetch'; hint.as = 'document'; hint.href = href;
    doc.head.append(hint); warmed.add(href);
  }
  function onOver(event) {
    if (event.pointerType === 'touch') return;
    clearTimeout(timer);
    const link = targetLink(event);
    if (link) timer = setTimeout(() => warm(link), 140);
  }
  const onOut = () => clearTimeout(timer);
  const onFocus = event => warm(targetLink(event));
  function onClick(event) {
    const link = targetLink(event);
    if (!link || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    let url;
    try { url = new URL(link.href, win.location.href); } catch { return; }
    if (url.origin !== win.location.origin || url.pathname === win.location.pathname && url.search === win.location.search) return;
    // A restored page should reopen the journey rather than a stale drawer.
    for (const dialog of doc.querySelectorAll('dialog[open]')) dialog.close();
  }
  doc.addEventListener('pointerover', onOver, { passive: true });
  doc.addEventListener('pointerout', onOut, { passive: true });
  doc.addEventListener('focusin', onFocus);
  doc.addEventListener('click', onClick);
  win.addEventListener('pagehide', onOut);
  return { destroy() {
    clearTimeout(timer);
    doc.removeEventListener('pointerover', onOver); doc.removeEventListener('pointerout', onOut);
    doc.removeEventListener('focusin', onFocus); doc.removeEventListener('click', onClick);
    win.removeEventListener('pagehide', onOut);
  } };
}
