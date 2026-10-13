# Product journey performance audit

Read-only audit, 13 October 2026. No model, scene, input, or rendering implementation was changed for this audit.

## Evidence and limits

Measured the actual component factories, scroll timeline, cap deformation, peel membranes, fluid, camera fitting, part placement, and world matrices in Node 22.18.0 / Three r186 on an AMD Ryzen 7 4700U with Radeon Graphics, Windows x64. The measurement was captured at 08:50 UTC. The machine was also being used for shop development; these are warmed CPU samples, not isolated hardware benchmarks.

The harness reproduced the shop ritual hierarchy and `applyState` operations at a 390 × 844 camera aspect. Each case received 40–1,000 warm-up calls and 240–3,000 recorded calls. The complete cycle used 600 recorded positions. **No WebGL render, shader-link timing, DOM layout, browser SVG decoding, canvas texture generation, phone hardware, or GPU timer was measured. These figures do not establish browser FPS.** Factory measurements are single cold samples; Node skips the browser's bamboo-map generation.

## Actual geometry

| Component | Vertices | Triangles | Unique GPU buffer data |
| --- | ---: | ---: | ---: |
| Bamboo shell | 29,146 | 56,640 | 1.72 MB |
| One PET insert | 2,123 | 3,456 | 0.09 MB |
| Complete silicone cap | 328,911 | 112,962 | 7.94 MB |
| One peel membrane | 10,644 | 20,256 | 0.46 MB |
| One complete liquid fill | 2,894 | 5,184 | 0.12 MB |
| Stream and five shared-geometry droplets | 3,220 | 5,616 | 0.07 MB |
| Retained scene, including both inserts and seals | 392,599 | 233,010 | 10.99 MB |

Vertex totals count mesh instances; buffer totals count each geometry once. The retained scene has 37 meshes, 45 material groups, and 18 materials. These are not GPU draw-call totals: shadows and Three's opaque transmission prepass add passes, while frustum/face culling removes work. Before GPU culling, the sealed pose contains 198,498 triangles/27 material groups; pouring contains 181,698/24.

## CPU results

| Operation | Samples | Median | 95th percentile |
| --- | ---: | ---: | ---: |
| Full cycle pose, effects, framing, placement, matrices | 600 | 0.316 ms | 3.160 ms |
| Sealed product axial dragging | 300 | 0.141 ms | 0.336 ms |
| Held pouring pose | 1,000 | 0.115 ms | 0.361 ms |
| Changing cap pressure deformation only | 300 | 2.982 ms | 4.943 ms |
| Changing pouring fluid only | 300 | 1.300 ms | 1.941 ms |
| First seal peel only | 240 | 0.748 ms | 1.983 ms |
| Fully peeled seal moving offscreen | 240 | 1.007 ms | 3.216 ms |
| Held fluid update | 3,000 | 0.003 ms | 0.003 ms |
| Live scent recolour | 1,000 | 0.008 ms | 0.017 ms |

Single Node factory samples: body geometry 149 ms, cap 542 ms, one membrane 22 ms, liquid 72 ms. Individual maximums occasionally reached 10–17 ms; garbage collection, competing work, and warm-up make these unsuitable as steady frame-budget estimates.

## Low-risk improvements, in priority order

1. **Index the cap without simplifying its shape.** An in-memory `mergeVertices(geometry, 1e-5)` audit reduced cap vertices from 328,911 to 98,526 (70% fewer) and buffers from 7.94 to 3.06 MB (61% less). Triangle order/count remained identical. Roof, lettering, logo, button and ring positions/normals were exactly preserved; only pedestal/plug seam roundoff changed, by less than 2 × 10⁻¹⁵. The roof alone falls from 182,304 to 31,920 vertices. This targets cap CPU deformation loops and uploads without changing manufacturing contours. Naive runtime merging cost about one extra second in this audit, so bake the indexed result or index during refinement rather than adding a postprocess at first interaction. CPU/GPU speed gains still require browser measurement.
2. **Separate peel geometry state from foil departure state.** A changed `exit` currently reruns the fully completed membrane deformation and bounding-box calculation even when `unfold` and `peel` are unchanged. Keep external transform/visibility behavior and cache the geometry by `unfold|peel` separately. This addresses the measured ~1 ms detached-foil work and preserves reverse scrolling.
3. **Move bamboo texture generation away from the first visible frame.** Current startup makes two 2048² pixel passes plus canvas drawing. Three 2048² RGBA maps and one 512² end-grain map have a nominal uncompressed mipmapped GPU footprint of approximately 65.3 MiB per WebGL context, before lighting targets, shadows, transmission MSAA, and driver overhead. CPU texture sharing does not share GPU allocation between contexts. Bake identical generated maps at build time, or generate them in a worker. A 1024² mobile texture profile would cut the three large-map memory/processing area by 75%, but fine engraving must be visually checked at the allowed zoom.
4. **Keep diagnostics out of frame-critical layout.** Shop reporting is already throttled to 160 ms. The page scroll callback still calls the full projected-bounds `getState()` and writes ritual classes/ARIA attributes every scroll frame. Prefer a cheap progress getter, update step classes only when the step changes, and batch layout reads before DOM writes. DOM cost was not measured, so this is a bounded scheduling recommendation, not a claimed bottleneck.

## GPU, idle, and mobile conclusions

The shop already lazy mounts near the viewport, caps coarse-pointer DPR at 1.3, uses 1024² shadows, renders only while progress/reveal/drag inertia changes, and cancels RAF when hidden or offscreen. At 390 × 844, DPR 1.3 gives roughly 0.56 million canvas pixels versus 2.96 million at DPR 3. Public canvases do not retain their drawing buffer. Scent changes reuse materials and shader programs. These are appropriate defaults.

`compileAsync` warms normal and linear/NoToneMapping variants before revealing the canvas, including hidden components. This helps shader linkage; it does not measure or eliminate first-draw texture/buffer uploads, shadow-depth program creation, or PMREM startup. PMREM is generated synchronously per context. Keep posters available until the first actual render succeeds.

A dedicated lower-detail mobile model is **not justified by the desktop CPU evidence alone**. Preserve the same geometry, timeline, absorption, and transmission first. If actual phone GPU/frame measurements miss the target, try transmission resolution 0.8 (36% fewer prepass pixels) and DPR 1.15 (22% fewer canvas pixels than 1.3) before reducing surface detail. The standalone fullscreen viewer currently uses 2048² shadows and a width-only DPR threshold; applying the shop's coarse-pointer/1024-shadow policy there is a reasonable candidate. Validate physical-device frame times, input latency, first paint, and memory after visiting both hero and journey; use GPU timer queries where supported, with disjoint results discarded.

Material caveat: r186's transmission pass replaces an alpha-zero clear colour with white/alpha 0.5. Therefore `setClearColor(world, 0)` alone does not supply the public world's colour to liquid refraction. White studio exports remain correct. Any correction should preserve the campaign's transparent layering instead of blindly making the whole canvas opaque.

Primary implementation references: [Three WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html), [BufferGeometryUtils](https://threejs.org/docs/pages/module-BufferGeometryUtils.html), and the installed r186 `src/renderers/WebGLRenderer.js` / `src/extras/PMREMGenerator.js`.

## Final journey state audit

Reviewed the current `assets/shop-scene.js` and `assets/app.js` after the journey and detail-dialog integration. The initial performance audit above was read-only. The parent subsequently authorized one input-state correction, described below; the parent separately corrected BFCache restoration. No component geometry, artwork, timeline, liquid volume, material, or rendering-quality setting was changed by this state correction.

### Resolved blockers

- **Interrupted inspector pinch could retain stale fingers.** Previously the finger map and pinch anchor lived inside `installInput`, while shared cancellation cleared only the single drag pointer. During a pinch that pointer is null. Pausing, blurring, hiding, leaving the viewport, or losing the WebGL context could therefore leave captured fingers in the map if native cancellation was not delivered; the next single finger was incorrectly treated as another pinch. The production map/anchor now live at viewer scope. Cancellation clears every gesture before releasing captures, making synchronous or delayed `lostpointercapture` events harmless. The first pointer cancels old momentum before insertion; additional pointers retain the current gesture. Lifting a pinch finger rebases the remaining drag at its latest coordinates, without a rotation jump.
- **BFCache restoration could leave an open detail viewer destroyed.** The current application remounts visible scenes inside an open dialog as well as ordinary page scenes. Saved cycle position, yaw, zoom, and pose take priority over initial inspector data. Real detour removal clears its snapshot and any in-flight mount token. This fix was verified in the current source; native browser back/forward restoration remains part of browser QA, not a claim made by the Node harness.

`node --test scripts/shop-input.test.mjs` passed all six event simulations, and `node --check assets/shop-scene.js` passed. The tests execute the actual production handlers against a mock event, RAF, and pointer-capture surface. They cover first-finger dragging and release inertia; two-finger zoom and survivor rebasing; pause/resume with synchronous capture-loss reentrancy; stale capture loss and third-finger handoff; offscreen/context-failure cancellation; and preservation of native vertical page scrolling in ordinary commerce scenes. They do not emulate native gesture arbitration, a GPU, or phone timing. No additional concrete publication blocker was established by this source/state audit.

### Lifecycle and suspension

- Recurring model RAF requires a ready, visible, unpaused viewer with positive dimensions. Progress, reveal, pose smoothing, or rotation inertia schedules the next frame; a settled model stops. Fresh viewport rectangles are authoritative, with observer/scroll/focus signals waking the renderer when necessary.
- Pause, blur, hidden documents, offscreen departure, context failure, and destruction cancel pending RAF and clear gesture/momentum state. A modal pauses page viewers before scroll locking; its visible detail viewer remains independently interactive. The page scroll callback exits while a dialog is open.
- Application mount tokens and page epochs reject obsolete asynchronous mounts. Destroying a viewer during component construction releases a subsequently resolved body lease and cap. Destruction removes listeners, disconnects observers, cancels RAF/warmup completion, releases geometry/material ownership, and disposes the WebGL context. Cached body geometry/textures use a reference-counted lease; dynamic fluid, cap deformation, seal state, and transforms remain viewer-local.
- Context loss retains the latest requested state and leaves the poster visible. Restoration regenerates PMREM and warms shader variants before revealing the model; generation checks reject obsolete warmup completion. A paused viewer can still finish already-started shader linkage/PMREM setup: pausing stops recurring animation work, rather than cancelling all bounded startup GPU work.
- Sharing CPU geometry or textures does not share their GPU uploads across contexts. Detached detail contexts are destroyed, so sequential visits do not intentionally retain those contexts. Actual driver reclamation and total browser memory were not measured.

### Automation scheduling evidence

The parent observed moving RAF periods of approximately **1,016 ms** in the Chrome automation surface while the DOM remained visible. This is evidence of the observed automation callback scheduling, **not measured render execution time, GPU cost, physical-phone FPS, or a 60 FPS result**. The existing motion integrator caps its step at 50 ms; callback intervals that large consequently make smoothing advance slowly in automated captures. These observations cannot distinguish automation throttling from foreground-device rendering constraints. A foreground physical-device trace is required before changing simulation timing or asserting a frame-rate target has been met.

The diagnostics retain at most 120 moving frame periods. `getState()` currently sorts two copies of this list per snapshot and computes projected bounds; normal scene reports are throttled to 160 ms, while the page scroll path requests a complete state each scroll frame. A cached single-sort summary, cheap cycle-position getter, and change-guarded DOM phase updates would reduce avoidable work. These are future optimizations; no measured browser layout or GPU trace attributes the observed scheduling gap to them.

### Remaining optimization priorities

Preserve the existing coarse-pointer DPR cap, poster fallback, lazy mounting, settled-frame suspension, and per-viewer ownership. Index the cap, cache completed peel geometry, and bake/worker-generate bamboo maps as described above only with visual and reversibility checks. Measure foreground phone first-paint latency, active frame times, memory after detours, and resume/context-loss behavior before introducing a separate lower-quality mobile model.
