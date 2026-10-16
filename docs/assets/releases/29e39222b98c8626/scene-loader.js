/**
 * A page-scoped queue for the shop's progressively enhanced 3D views.
 * Images and native navigation stay usable while their viewer is queued.
 * One mount callback (including its shader warmup) runs at a time; the page
 * owns the resulting viewer and its state snapshots/disposal.
 *
 * const loader = createSceneLoader({
 *   mount: async element => { const view = mountScene(element); await view.ready; return view; },
 * });
 * elements.forEach(element => loader.observe(element));
 * loader.request(element); // promote a product that the customer just chose
 * loader.suspend();        // pagehide; dispose/snapshot viewers in the page
 * loader.resume({ reset: true }); // pageshow; mount fresh contexts as needed
 */
export function createSceneLoader(options = {}) {
  if (typeof options.mount !== 'function') throw new TypeError('A scene loader needs a mount callback.');
  const environment = options.environment || globalThis;
  const win = environment.window || environment;
  const doc = environment.document || win.document;
  const connection = environment.navigator?.connection || win.navigator?.connection;
  const rootMargin = connection?.saveData ? '0px' : options.rootMargin || '280px 0px';
  const records = new Map();
  let order = 0, enabled = true, disposed = false, epoch = 0, activeJob = null, scheduled = null;
  const schedule = environment.setTimeout?.bind(environment) || globalThis.setTimeout;
  const cancelSchedule = environment.clearTimeout?.bind(environment) || globalThis.clearTimeout;
  const Observer = environment.IntersectionObserver || win.IntersectionObserver;

  function viewport() {
    return { width: win.innerWidth || doc?.documentElement?.clientWidth || 0,
      height: win.innerHeight || doc?.documentElement?.clientHeight || 0 };
  }

  function margins(size) {
    const parts = rootMargin.trim().split(/\s+/);
    const token = index => parts.length === 1 ? parts[0] : parts.length === 2 ? parts[index % 2] : parts[index] || parts[1];
    const px = (value, axis) => value?.endsWith('%') ? parseFloat(value) * axis / 100 : parseFloat(value) || 0;
    return { top: px(token(0), size.height), right: px(token(1), size.width),
      bottom: px(token(2), size.height), left: px(token(3), size.width) };
  }

  function proximity(element) {
    const rect = element.getBoundingClientRect(), size = viewport(), margin = margins(size);
    const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
      && rect.top < size.height && rect.left < size.width;
    const near = rect.width > 0 && rect.height > 0 && rect.bottom > -margin.top && rect.right > -margin.left
      && rect.top < size.height + margin.bottom && rect.left < size.width + margin.right;
    const distance = Math.max(0, rect.top - size.height, -rect.bottom);
    return { near, visible, distance };
  }

  function enqueue(record, forced = false) {
    if (!record || disposed || ['loading', 'mounted', 'error', 'deferred'].includes(record.status)) return false;
    record.forced ||= forced;
    if (!record.forced && !record.near) return false;
    record.status = 'queued';
    queueDrain();
    return true;
  }

  function queueDrain() {
    if (disposed || !enabled || doc?.hidden || scheduled !== null || activeJob) return;
    scheduled = schedule(() => { scheduled = null; drain(); }, 0);
  }

  function drain() {
    if (disposed || !enabled || doc?.hidden || activeJob) return;
    const queued = [...records.values()].filter(record => record.status === 'queued')
      .map(record => ({ record, ...proximity(record.element) }))
      .filter(item => item.record.forced || item.near)
      .sort((a, b) => Number(b.record.forced) - Number(a.record.forced)
        || Number(b.visible) - Number(a.visible) || a.distance - b.distance || a.record.order - b.record.order);
    const record = queued[0]?.record;
    if (!record) return;
    const job = { record, epoch, revision: record.revision };
    activeJob = job; record.status = 'loading'; record.error = null;
    const valid = () => !disposed && job.epoch === epoch && job.revision === record.revision
      && records.get(record.element) === record;
    Promise.resolve().then(() => options.mount(record.element)).then(view => {
      if (!valid()) { view?.destroy?.(); return; }
      // A reduced-motion route can intentionally retain its readable image,
      // and the page may have already reported a WebGL fallback. Neither is
      // a mounted context; explicit retry/preference changes can re-arm it.
      record.status = view ? 'mounted' : record.element.dataset?.sceneStatus === 'error' ? 'error' : 'deferred';
      record.error = record.status === 'error' ? record.element.dataset.sceneError || 'Model unavailable' : null;
      record.forced = false;
    }, error => {
      if (!valid()) return;
      record.status = 'error'; record.forced = false; record.error = String(error?.message || error);
      try { options.onError?.(error, record.element); } catch { /* A fallback reporter must not block another viewer. */ }
    }).finally(() => {
      if (activeJob === job) activeJob = null;
      queueDrain();
    });
  }

  const observer = Observer ? new Observer(entries => {
    for (const entry of entries) {
      const record = records.get(entry.target);
      if (!record) continue;
      record.near = entry.isIntersecting;
      if (record.near) enqueue(record);
      else if (record.status === 'queued' && !record.forced) record.status = 'idle';
    }
  }, { rootMargin, threshold: 0 }) : null;

  function refresh() {
    if (disposed) return;
    for (const record of records.values()) {
      record.near = proximity(record.element).near;
      if (record.near) enqueue(record);
      else if (record.status === 'queued' && !record.forced) record.status = 'idle';
    }
    queueDrain();
  }

  function observe(element, settings = {}) {
    if (disposed) return false;
    if (!element?.getBoundingClientRect) throw new TypeError('A scene loader observes measurable elements.');
    let record = records.get(element);
    if (!record) {
      record = { element, order: order++, revision: 0, status: 'idle', error: null, near: false, forced: false };
      records.set(element, record); observer?.observe(element);
    }
    record.near = proximity(element).near;
    return enqueue(record, settings.eager === true);
  }

  function request(element) {
    if (disposed) return false;
    if (!records.has(element)) observe(element);
    return enqueue(records.get(element), true);
  }

  function retry(element) {
    if (disposed) return false;
    if (!records.has(element)) observe(element);
    const record = records.get(element);
    if (['error', 'deferred'].includes(record.status)) { record.status = 'idle'; record.error = null; record.revision++; }
    return enqueue(record, true);
  }

  function unobserve(element) {
    const record = records.get(element);
    if (!record) return false;
    record.revision++; observer?.unobserve(element); records.delete(element);
    return true;
  }

  function suspend() {
    if (disposed || !enabled) return;
    enabled = false; epoch++;
    if (scheduled !== null) cancelSchedule(scheduled);
    scheduled = null;
    for (const record of records.values()) if (record.status === 'loading') { record.status = 'idle'; record.revision++; }
  }

  function resume(settings = {}) {
    if (disposed) return;
    enabled = true;
    if (settings.reset) for (const record of records.values()) {
      record.revision++; record.status = 'idle'; record.error = null; record.forced = false;
    }
    refresh();
  }

  const visibilityChange = () => { if (!doc?.hidden) refresh(); };
  doc?.addEventListener('visibilitychange', visibilityChange);
  // Observers are the ordinary wake-up path. Geometry refresh also handles
  // sticky stages, orientation changes and browsers without the API.
  win.addEventListener?.('resize', refresh, { passive: true });
  if (!observer) win.addEventListener?.('scroll', refresh, { passive: true });

  function destroy() {
    if (disposed) return;
    suspend(); disposed = true; observer?.disconnect(); records.clear();
    doc?.removeEventListener('visibilitychange', visibilityChange);
    win.removeEventListener?.('resize', refresh);
    if (!observer) win.removeEventListener?.('scroll', refresh);
  }

  function getState(element) {
    const record = records.get(element);
    return record ? { status: record.status, near: record.near, error: record.error,
      queued: record.status === 'queued', loading: record.status === 'loading', enabled: enabled && !disposed,
      rootMargin } : null;
  }

  return { observe, request, retry, unobserve, suspend, resume, refresh, destroy, getState };
}
