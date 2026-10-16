/** Bound scene preparation without spending the customer's time in a hidden tab.
 * The scene owner remains responsible for disposing a timed-out or aborted view.
 * Listening to both promise outcomes also makes late GPU results harmless.
 */
export function awaitSceneReady(promise, {
  timeoutMs = 20000,
  environment = globalThis,
  document: doc = environment.document,
  isPaused = () => false,
  signal,
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('Scene preparation timeout must be positive and finite.');
  const schedule = environment.setTimeout?.bind(environment) || globalThis.setTimeout;
  const cancel = environment.clearTimeout?.bind(environment) || globalThis.clearTimeout;
  const now = environment.performance?.now?.bind(environment.performance) || Date.now;
  const pausedNow = () => !!doc?.hidden || !!isPaused();
  return new Promise((resolve, reject) => {
    let remaining = timeoutMs, previous = now(), paused = pausedNow(), timer = null, settled = false;
    const cleanup = () => {
      if (timer !== null) cancel(timer);
      timer = null;
      doc?.removeEventListener?.('visibilitychange', check);
      signal?.removeEventListener('abort', abort);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true; cleanup(); callback(value);
    };
    function check() {
      if (settled) return;
      if (timer !== null) cancel(timer);
      timer = null;
      const current = now();
      if (!paused) remaining -= Math.max(0, current - previous);
      previous = current; paused = pausedNow();
      if (remaining <= 0) {
        const error = new Error('The interactive product could not be prepared in time.');
        error.name = 'SceneReadinessTimeoutError'; error.code = 'SCENE_READY_TIMEOUT'; error.timeoutMs = timeoutMs;
        finish(reject, error); return;
      }
      // Visibility events are immediate. A bounded poll also observes menu or
      // page-lifecycle pauses supplied by the scene owner without extra wiring.
      timer = schedule(check, paused ? 250 : Math.min(remaining, 250));
    }
    function abort() {
      const reason = signal?.reason;
      const error = reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'Scene preparation was cancelled.');
      if (!(reason instanceof Error)) error.name = 'AbortError';
      finish(reject, error);
    }
    // Attach before an already-aborted signal is handled so a later rejection
    // from the abandoned scene never becomes an unhandled promise rejection.
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
    if (signal?.aborted) { abort(); return; }
    doc?.addEventListener?.('visibilitychange', check);
    signal?.addEventListener('abort', abort, { once: true });
    check();
  });
}
/** Small/mobile stages avoid an unbounded parallel-driver polling path. */
export async function compileSceneShaders(renderer,scene,camera,{parallel=true,...settings}={}){
 const checkAbort=()=>{if(settings.signal?.aborted)throw settings.signal.reason||new DOMException('Aborted','AbortError');};
 checkAbort();
 if(!parallel||typeof renderer.compileAsync!=='function'){
  renderer.compile(scene,camera);return 'synchronous';
 }
 try{
  await awaitSceneReady(Promise.resolve().then(()=>{checkAbort();return renderer.compileAsync(scene,camera);}),{...settings,timeoutMs:6000});
  return 'parallel';
 }catch(error){
  if(error.code!=='SCENE_READY_TIMEOUT')throw error;
  checkAbort();
  renderer.compile(scene,camera);return 'synchronous-recovery';
 }
}
