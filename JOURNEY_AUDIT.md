# Whole-shop journey audit

Audit date: 13 October 2026. Baseline: `91c8db6` (`main`), before journey implementation changes. Follow-up: independently reviewed the new journey controller and its application integration, and added 21 passing contract/behavior tests. The parent agent owns live browser validation. The baseline findings are preserved below; the implementation closure at the end records what has changed and which claims remain unverified.

## Assessment

The storefront provides a polished multipage shopping experience with real interaction: fragrance-world buttons, format selection, gallery views, quantities, bag editing, native accordions, and reversible scroll-driven product demonstrations. The main page scroll remains native, and the shop viewer deliberately permits vertical panning and browser pinch zoom.

The follow-up implementation now provides a native-scroll journey with product, material, refill, FAQ, and inspection detours. A detour keeps the underlying document alive, locks its position, pauses covered viewers, and returns through the close control, Escape, or browser Back. Exact same-viewport return, chapter-relative return after resizing, selection continuity, Forward reopening, and a deliberate cross-page resume are covered by focused controller tests. The parent reports matching live-browser observations on the principal paths.

Reduced-motion/no-script presentation and short mobile layouts were also repaired. This evidence supports the requested journey structure. It does not establish smoothness on every physical phone, a full screen-reader audit, or identical state preservation for every possible native route outside the journey.

This is a structural/interaction audit, not a request to replace the approved model, cap, engraving, fluid, visual language, or GitHub.io hosting.

## What the current architecture already does well

- The shared component factories and deterministic cycle support forwards/backwards scrubbing; shop motion uses one scroll-derived target rather than a wheel hijack. `assets/app.js:189–201`, `assets/shop-scene.js:273–300,335–339`.
- Shop canvases reserve native vertical pan and browser pinch zoom. Horizontal rotation locks only after a directional threshold and decays after release; reduced motion disables coasting. `assets/shop-scene.js:373–419,513`.
- Viewers load near the viewport, warm shaders asynchronously behind an approved image, suspend rendering when idle/offscreen/hidden, cap pixel ratio, and dispose GPU resources on exit. Lifecycle epoch/token guards prevent stale asynchronous mounts after history traversal. `assets/app.js:73–120,212–213`; `assets/shop-scene.js:174–187,302–331,448–495,550–551,579–613`.
- Native `dialog` and `details` provide a sound foundation for focus/modal behavior and optional information. Main purchasing controls and the mobile dock share the same form and prices. `scripts/shop-build.mjs:40`, `scripts/shop-pages.mjs:109–110,210–220`.
- Cart data is sanitized and uses integer-cent prices. Format selection is carried through fragrance and language links. Those are useful foundations, but they do not represent a complete journey snapshot.
- The preview states that ordering/payment is inactive. This audit does not imply live checkout or payment capability.

## Baseline prioritized findings

Severity: P1 = central requested journey cannot be promised; P2 = material continuity, mobile, accessibility, or resilience defect; P3 = focused quality improvement or risk requiring measurement. Evidence is source-backed unless explicitly marked for browser confirmation.

### J1 — P1: No detour/resume contract

**Evidence.** Homepage product links, editorial refill links, collection cards, breadcrumbs, FAQ links, and fullscreen links are normal route navigation. The only application storage is the bag key; there is no `history.state`, `popstate`, journey checkpoint, return URL/token, or restore controller. See `scripts/shop-pages.mjs:94–104,132–142,158,169,216,238,243,252,267,287`; `scripts/shop-build.mjs:32,36,40`; `assets/app.js:7–8,27,212–213`.

**Result.** A visitor can explore these pages, but returning via the site navigation usually enters a destination route afresh. The implementation has no “continue where I left off” action. Native Back is the only general return mechanism, and it does not cover explicit home navigation, fresh reloads, every cache policy, or application state.

**Fix direction.** Define one native-scroll journey with stable chapter IDs and make product/details/3D exploration resumable detours. Preserve ordinary URLs and direct-page fallbacks. Use a modal/sheet for eligible in-journey detours so the originating DOM and scroll position survive; add an explicit return action and history traversal support. For actual route changes, save a bounded, versioned origin checkpoint and restore it only for a deliberate return.

### J2 — P2: Reduced-motion mobile ritual keeps its long fixed height

**Evidence.** `.ritual-static { height:auto }` is declared at `assets/style.css:371`. Later mobile declarations at `700–701` set `.ritual-scroll` to `420svh` and the product variant to `350svh`. Each section retains both classes. Equal class specificity means the later mobile height wins, although the static inner presentation is no longer sticky. The media-query reduced-motion block at `900–905` does not correct the section height.

**Result.** Written steps can be followed by substantial empty space or retained scroll distance on mobile reduced-motion and WebGL-error fallback. That contradicts the stated short written alternative.

**Fix direction.** Make the static section height override the responsive animation heights, e.g. an explicit responsive `.ritual-scroll.ritual-static { height:auto }` after those declarations. Verify reduced motion and forced WebGL failure on home, PDP, and refill; measure the section's actual content height rather than checking only class presence.

### J3 — P2: Short mobile viewports cannot contain the sticky ritual

**Evidence.** The phone ritual has `min-height:580px` at `assets/style.css:702`, while its intended height is `100svh - 68px`. A landscape phone viewport such as 667×375 has roughly 307px available below the header. The short-height correction at `887–897` applies only from width 761px upward.

**Result.** On those phone sizes, the sticky stage is substantially taller than the visible viewport. The copy, progress, and fullscreen link can remain below the viewport during the sticky sequence. This is a provable size conflict; exact visual behavior still needs browser confirmation.

**Fix direction.** Provide a short-mobile composition or a compact written presentation. Remove the impossible minimum; fit stage and controls to the available viewport. Avoid solving it by cropping instructional/purchase/return controls.

### J4 — P2: Mutable shopping state is incompletely carried through navigation

**Evidence.** The PDP updates scent/language links with only `format` at `assets/app.js:159–160`. Quantity is initialized to 1 in `scripts/shop-pages.mjs:218`; gallery state and hero world are local DOM state. Current-URL query parameters are read for format at `app.js:163`, but format changes do not replace/update the current URL. Hero world buttons update copy/link/scene at `125–137`, without durable state. Collection filters at `169–173` likewise have no persistent selection.

**Result.** Example: select refill, quantity 3, and cap inspection; choose another scent or language. Refill is carried, while quantity and inspection are reset on the new page. A normal refresh can return to the URL's previous format rather than the currently selected one. A fresh homepage language navigation starts with Bamboo even after another world was chosen. Some browser Back restores can retain DOM/form state; that is not the application's own guarantee.

**Fix direction.** Define the state that should survive: scent, format, quantity, gallery view, selected world, active collection filter, and horizontal collection position. Keep shareable product state in a small URL contract; keep transient return/inspection state in history/in-memory/session checkpoints. Reconcile controls, URL, price, poster, viewer, language link, and bag from that same state.

### J5 — P2: Browser return discards manual 3D inspection state

**Evidence.** `pagehide` destroys all shop viewers and clears the map at `assets/app.js:212`. `pageshow` remounts them at `213`; mount options at `98–102` do not restore inspection values. Viewer manual yaw defaults from `options.yaw` at `assets/shop-scene.js:74`, and the campaign reveal restarts at 0 at `68` and advances over 1.25 seconds at `280–283`.

**Result.** Even when the browser restores the DOM and native scroll position, a product that the visitor rotated will return to the default orientation. A campaign can repeat its arrival animation. The ritual's scroll-derived target can be reconstructed, but yaw and reveal state are separate.

**Fix direction.** Capture a small viewer snapshot before disposal and restore it before the first visible frame. In-place detours should retain the originating viewer, pause it, and cancel momentum while covered. Avoid retaining all GPU contexts indefinitely merely to retain state.

### J6 — P2: Fullscreen inspection is disconnected from its origin and has no explicit return

**Evidence.** All launch links point to the same bare `/assembly/` route. The fullscreen scene starts `cyclePosition=0, manualYaw=0, zoom=1` at `assets/assembly/scene.js:20`. Its HTML contains the animation and hidden instructions/status, but no return action; the input key handler has no Escape/return handling. Context restore calls `location.reload()` at `scene.js:126`.

**Result.** Entering fullscreen mid-demonstration restarts the closed product instead of continuing the current pose. Returning depends on browser navigation. A WebGL recovery reload also loses the inspection position. This falls within J1's structural gap, with concrete additional state transfer work.

**Fix direction.** Keep direct standalone inspection available. When launched as a journey detour, seed finite cycle position/yaw/zoom from the origin and provide a scoped close/return affordance outside the animation. A fullscreen dialog can host the existing standalone scene with a narrow same-origin state bridge, or a reusable inspection controller can mount it directly. Preserve the approved scene's geometry and choreography. Treat embedded inspection as an intentional architecture change: the current static shop test at `scripts/shop.test.mjs:176` explicitly expects zero iframes and would need revision if this approach is chosen.

### J7 — P3: Static/interactive semantics and instructions need a focused accessibility pass

**Evidence.** Shop scene containers have `role="img"` and contain a separately focusable canvas also given `role="img"`. Gallery changes append keyboard-rotation instructions, while hero/ritual initial labels mostly describe the image. Fullscreen has two focusable image targets (`#viewport` and its canvas), removes focus outlines in CSS, and has keyboard timeline controls but no keyboard product rotation/zoom controls. See `scripts/shop-pages.mjs:89,134`; `assets/app.js:139–143`; `assets/shop-scene.js:414–419,510–513`; `assets/assembly/index.html:17`, `assets/assembly/style.css:60–75`, `assets/assembly/ritual-input.js:249–260`.

**Result.** Visual mouse/touch use does not establish an intuitive keyboard or screen-reader inspection journey. The role nesting and duplicate focus stops require an actual accessibility-tree check rather than assuming their behavior.

**Fix direction.** Expose one clearly named interactive inspection target with concise instructions; use a static image role only for the poster. Provide a visible focus indication and explicit close/return action. Confirm keyboard rotation/zoom if those features remain part of fullscreen's user-facing promise. Keep authored step text accessible independently of the canvas.

### J8 — P3: No-JavaScript lifecycle explanation hides four steps

**Evidence.** Ritual markup starts with four `aria-hidden="true"` steps and CSS makes inactive steps transparent/absolute. Static mode is added only by the JavaScript controller. `scripts/shop-pages.mjs:137`; `assets/style.css:361–378`; `assets/app.js:77–81,120`.

**Result.** WebGL failure with working JavaScript has a written fallback, but a script failure/no-JavaScript visit does not get all five ritual steps. The static HTML image and product prices remain useful.

**Fix direction.** Make the written sequence the default or supply a small no-script style/presentation that exposes it. Enable the animated presentation as enhancement, with no requirement to scroll a long blank region.

### J9 — P3: Fullscreen cold start/recovery and actual mobile smoothness need measurement

**Evidence.** Shop shaders use asynchronous warmup; fullscreen boot has no corresponding `compileAsync` warmup and its first render compiles/draws the scene. Fullscreen recovery reloads the page. Existing automated checks cover geometry, timeline/input reducers, cart logic, and generated HTML; they do not exercise actual browser detour return, mobile layout, gesture contention, or field performance.

**Result.** Passing component checks cannot establish cold-start responsiveness, smoothness on a phone GPU, or journey continuity. This is an unverified risk, not an asserted measured performance failure.

**Fix direction.** Measure cold and warm inspection entry, scroll/drag response, dropped frames, long tasks, shader-ready time, repeated detours, and resource release on representative hardware. Reuse shop warmup/recovery strategy where evidence shows a problem. Avoid claiming field Web Vitals or physical-device coverage from desktop emulation.

## Practical implementation shape

1. **Retain native scrolling and current static routes.** Give main journey chapters stable IDs shared across locales. Calculate product pose from actual chapter scroll position; never auto-advance, snap, or redirect the page to drive the experience.
2. **Add a small journey controller.** Own the active chapter, local chapter offset/progress, world/scent, product options, inspection snapshot, and origin focus target. A checkpoint should be versioned and finite, with known route/chapter/enum values. Preserve exact scroll pixels for a same-viewport return; use chapter/progress semantics after resize or locale layout changes.
3. **Use existing dialogs for eligible optional detours.** Keep the underlying journey DOM alive and its scroll location fixed. Pause covered viewers and cancel momentum. Close, Escape, browser Back, and a return action should resolve to the same origin. Direct URLs, modified clicks, new tabs, legal links, and non-journey entries should retain normal route behavior.
4. **Extract scoped controllers before injecting detour HTML.** Today `scenes` is a one-time document-wide array and forms/gallery listeners initialize only once. Introduce reusable mount/unmount helpers for a specified root; keep delegated cart actions, and register/dispose nested viewers and observers explicitly. Simply appending fetched PDP HTML would leave its forms and gallery uninitialized.
5. **Carry selection and restore once.** Use the current product URL for shareable scent/format/quantity state where useful. Store an origin checkpoint for deliberate cross-page returns. Restore without a smooth scroll animation and return focus with `preventScroll`. Do not repeatedly fight normal user scrolling. A missing/stale checkpoint should degrade to a clear normal route rather than inventing a prior position.
6. **Repair fallback/short-height behavior first.** Reduced motion, WebGL failure, short mobile height, and keyboard should get the same product information and available choices. These repairs are independent of the detour controller.

This can be implemented with the current static build, ES modules, native dialogs/history, and approved viewer factories. A framework rewrite is not required.

## Implementation acceptance matrix

“Pending” means the current implementation has not established the result; it does not imply the parent has performed no earlier tests.

| Scenario | Required acceptance | Baseline assessment | Verification |
| --- | --- | --- | --- |
| Main journey, normal scroll | Page follows native input; product target progresses/reverses from chapter location; stopping settles without autonomous continuation | Native behavior exists in source | Live wheel/trackpad/touch, slow and rapid reversal |
| Product detour from hero/collection | Return restores origin route/chapter/scroll, world, choices, and focus; no model restart | Missing contract (J1/J4/J5) | Repeat from top, collection, and mid-ritual |
| Refill/details/FAQ detour | Close/Escape/Back return to the same origin; accordions do not cause a forced chapter jump | Route navigation exists; return contract missing | Open multiple detours successively |
| Fullscreen detour mid-ritual | Begins at current pose; preserves inspection; explicit return to origin | Starts at 0; no return (J6) | Enter at peel, pour, and refill phases |
| Same-size return | Scroll differs by at most 2 CSS px; originating control focused without scrolling; selected state unchanged | Not guaranteed | Compare snapshots before/after five returns |
| Browser Back/Forward | Each history entry has coherent main/detour state; no stale dialog, double mount, or orphan canvas | Epoch-safe mounting exists; journey missing | Test with BFCache and a normal reload path |
| Refresh/direct URL | Shareable product state matches controls/price/view; origin is restored only with a valid deliberate return | Format query supported; other state omitted | Fresh tab, reload, copied URL |
| Fragrance/language changes | Defined quantity/format/world/inspection policy is applied consistently; no silent selection reset | Only format is carried on PDP | Set quantity 3 and cap view, then change each |
| Native touch on shop canvas | Vertical pan scrolls the page; horizontal pan rotates; diagonal movement behaves predictably; release decays | Supported by source | Real touch plus cancellation/rapid reversal |
| Pinch behavior | Shop keeps browser zoom; opt-in fullscreen zooms the product; no accidental page/animation jump | Separate behaviors implemented | Two-finger join/leave and orientation change |
| Mobile portrait | Identity, prices, options, bag, and return controls readable/reachable without horizontal page overflow | Earlier visuals reviewed | 320/375/390/430 widths, large text |
| Mobile landscape/short height | Ritual controls remain visible or compact written alternative appears | Size conflict (J3) | 667×375 and 740×360; browser chrome changes |
| Reduced motion | Written lifecycle has content-driven height, all steps visible, no coasting/parallax/long empty scroll | Mobile height bug (J2) | Home/PDP/refill; toggle mid-page |
| WebGL failure/loss | Poster and written explanation remain; options/cart/return work; state survives recovery where promised | Shop fallback exists; height/reload gaps | Force creation failure and context loss |
| Keyboard/screen reader | One named inspection target; visible focus; rotate/zoom/return features discoverable; modal focus restores | Needs focused verification (J7) | Keyboard-only and actual accessibility tree |
| Covered/hidden viewers | Background inspection stops; hidden/idle viewers avoid continuous RAF; resumed state is unchanged | Offscreen/hidden pause exists; modal suspension not explicit | Frame counter plus repeated detours |
| Resource lifecycle | Repeated detours create no growing canvas/context/listener count; stale asynchronous completion cannot overwrite a new entry | Shop epoch guard is sound | Cold-close during import/warmup, repeat 10 times |
| Storage unavailable | Current in-place journey/cart can still function; unavailable durable restore is clearly bounded | Memory cart only within one document | Block storage, use detours/return |
| Cold/warm performance | UI remains responsive while model loads; subsequent detours are smooth at displayed mobile resolution | Not established by source/unit tests | Actual device trace and interaction observations |
| Model/product invariants | Approved geometry/artwork/choreography, 250 ml, €12.50/€4.50, and three scents remain intact | Existing invariant checks support this | Run existing checks plus rendered regression |

## Release recommendation

The principal source-backed continuity and mobile-layout defects have been addressed, with the follow-up evidence below. Keep the approved rendering and visual system. Physical-device performance and assistive-technology verification remain follow-up quality checks, so describe the supported journey and tested viewport behavior precisely instead of claiming universal smoothness.

## Implementation closure — 13 October 2026

**Scope of this follow-up.** Independent read-only review of the refreshed `assets/journey.js`, `assets/app.js`, and relevant viewer/template/style integration. The reviewer edited only this audit and `scripts/journey.test.mjs`. No rendering geometry, product artwork, production application code, or hosting configuration was changed by this reviewer.

**Automated evidence.** `node --test scripts/journey.test.mjs`: **21 passed, 0 failed**. Seven tests exercise exported position, choice, and persisted-data contracts. Fourteen execute the complete production controller against a small standard-DOM surface with separately queued history traversal, native close events, and animation frames. This is behavioral state verification rather than a browser/GPU simulation. No test dependency was installed.

The tests cover:

- Exact raw scroll restoration in an unchanged viewport, including a short hero whose normalized chapter progress is already clamped to 1.
- Chapter-relative restoration after width/orientation changes, legacy bookmarks, and missing geometry; bounded progress and rejected invalid persisted data.
- Partial scent/format updates; preservation of the other valid option; unknown catalog entries.
- Asynchronous Back, Forward reopening, detail-to-detail switching with one detour entry, Escape, and repeated close while Back is pending.
- A nested bag retaining the scroll/viewer lock until the final modal closes.
- Ordinary scent selection versus Ctrl/Cmd/Shift/Alt/new-tab anchor behavior; explicit native-route links.
- Cold initialization with stale detour history, then opening and closing once.
- Storage-unavailable in-place use, an ordinary fresh visit without forced restoration, deliberate resume after font readiness, and rejection of an invalid resume bookmark.

**Browser evidence reported by the parent.** These are actual parent-run observations, not actions performed by this reviewer: product return to **y=312 with originating focus**; inspection entered at visible **q=.530602**, with the main viewer frozen while its own slider, zoom to **1.2**, and ArrowRight remained usable; Back returned to **y=3366** and removed modal canvases; Forward reopened; a dedicated refill PDP and its explicit return resumed at **y=229.333 with Aloe**. Reported mobile measurements include portrait **390×844** with a **439 px** stage and reachable controls, short landscape **844×390** with actions at **y=356**, and a **320 px** product sheet with no internal horizontal overflow. Reduced-motion/no-script fixtures exposed all five steps with content-driven height rather than the long animation scroll section. The parent also observed inline add feedback and a “View my bag” action inside the top-layer product dialog.

| Baseline item | Follow-up outcome | Evidence and remaining boundary |
| --- | --- | --- |
| J1 — detour/resume contract | Resolved for the authored journey paths | Native dialog/history controller retains the underlying document; 21 tests include return, traversal, selection and explicit resume. Parent verified principal product/inspection/cross-page paths. |
| J2 — reduced-motion section height | Resolved for authored fixtures | Final static/no-motion CSS overrides animation heights; parent measured all five written steps without the retained long scroll region. |
| J3 — short mobile ritual | Resolved at the reported viewports | Responsive row sizing and landscape layout corrected; parent verified portrait, short landscape, desktop, and the 320 px product sheet. Arbitrary browser chrome/text-size combinations are not exhaustively covered. |
| J4 — selection continuity | Resolved for scent/format and retained in-place DOM state | Global valid choice and shareable PDP format synchronize controls, prices, thumbnails, and destinations. Ordinary native dedicated-page navigation can create its own quantity/gallery/inspection view; no universal cross-route snapshot is claimed. |
| J5 — pagehide/return viewer restart | Resolved in the reviewed implementation | Pagehide snapshots progress, manual yaw, zoom, and pose; BFCache pageshow remounts active views with epoch/token guards. Parent verified an open-dialog remount. Real cache eviction still differs from BFCache restoration. |
| J6 — close inspection from current ritual | Resolved through the in-place inspector | Inspector captures visible main-cycle pose, has independent zoom/rotation/scrub state, and disposes its views on return. Parent verified q=.530602 entry and unchanged main return. A direct visit to the standalone animation remains a separate entry. |
| J7 — accessibility semantics | Corrected in source; partially verified | Native dialogs, real form/zoom/close controls, focus return and keyboard rotation exist; parent inspected selected accessibility output. Shop scene containers now use `role=group` so a focusable child canvas is not swallowed by an atomic image role. Initial canvases include localized keyboard descriptions and visible focus. Full screen-reader discoverability still needs a real assistive-technology pass. The standalone approval scene is unchanged. |
| J8 — no-script written lifecycle | Resolved in authored markup/CSS | All five steps are present without initial hidden attributes; baseline styles expose them before enhancement. Parent checked no-script and reduced-motion fixtures. |
| J9 — mobile performance/recovery claims | Remains unmeasured on physical devices | Idle/offscreen/covered pausing, async warmup, disposal and stale-completion guards are source-backed. No physical-device trace or field Web Vitals measurement was supplied to this reviewer. |

### Follow-up defects discovered and repaired

1. **Cold reload retained an obsolete detail history state.** A later close could navigate back into another detail state and reopen it. Cold initialization now clears that obsolete state/hash and can restore a valid saved journey checkpoint. The reload/open/one-close behavioral test passes. BFCache restoration retains its live controller instead of cold-initializing it.
2. **Modified product-sheet scent links were intercepted too early.** Ctrl/Cmd/Shift/Alt and new-tab anchors now retain native behavior before the inline scent branch. All modifier/new-tab cases pass the controller tests.
3. **An asynchronous viewer mount could start beneath a nested bag without being paused.** Fresh source confirms initial pause now compares the scene's dialog with `getTopDialog()`, and modal notifications also update existing viewers when the top dialog changes while the overall lock remains true. This fix is source-reviewed; the controller harness does not emulate shader loading or GPU activity.

The earlier exact-return defect was also corrected by the parent: a bookmark now includes viewport width/height and raw scroll pixels. Same-size returns use those pixels; changed-size returns use chapter progress. The focused short-hero and resize-in-detour tests pass.

### Acceptance interpretation

The implemented experience now meets the central requested structure: native scrolling advances/reverses the main story, optional authored detours borrow it, and returning resumes the same underlying path and position. The browser evidence establishes the listed concrete cases. The controller tests protect the return/history rules and their failure paths. Neither form of evidence alone proves physical-phone frame rate, native multi-touch arbitration, complete screen-reader behavior, or every locale/large-text layout combination.

## Early-reveal revision — 13 October 2026

The user's later mobile feedback supersedes the earlier homepage dialog direction. The current homepage has one persistent scene: closed product, early three-part reveal, reassembly, opening, dosing, refill and closure. Nine bilingual captions animate beside or below the actual drawn pose, with component leaders and three native inline disclosures. The separate material campaign, its three links and its detail popup have been removed from the homepage. Purchase links use native dedicated pages and retain an explicit return bookmark. Product galleries show only Shampoo and Refill; the cap remains a component explanation.

The new pose adapter leaves the approved assembly source geometry, engraving and ritual timeline unchanged. The cap lifts clear before moving sideways; the insert clears the shell before entering its own lane. A small shop-only silicone collar flex clears the upper bamboo lip and PET flange while seating or unseating. Reverse scroll uses the same deterministic poses. The whole homepage sequence accumulates 720 degrees of automatic axial rotation.

**Automated verification:** 131 tests passed, including dense real-geometry clearance sweeps, reverse and stationary captions, actual viewport versus canvas breakpoint cases, progress preservation, delayed resume, native routes and all existing gesture/cart checks. The generated-site checker verified 31 pages for assets, links, language, indexing, brand-copy restrictions and the GitHub.io domain. Original engraving and legal fragment hashes remain locked by regression checks.

**Chrome viewport observations:** desktop 1440×900, tablet 768×1024, portrait 390×844 and 320×740, landscape 844×390. The tablet check exposed a scrollbar-width mismatch between CSS and the camera; camera selection now uses viewport dimensions, with the canvas dimensions retained for its frustum. Width changes preserve the displayed progress. A 390 px cold reload retained q=.371825 and y=3162 exactly. Inline cap details did not advance the scroll pose or open a dialog. Native Argan product navigation and selecting two €4.50 refills produced a €9.00 bag; the test items were removed afterward.

**Mobile integration:** scenes draw the exact fragrance background opaquely inside an alpha-capable WebGL context, avoiding an independent white canvas surface. The homepage uses a single 64 px mobile header, no second navigation row, a compact purchase footer and camera space reserved for the caption. The smallest-width caption budget and short-landscape footer were tightened after browser review. Rendering waits behind the opening poster/caption; reduced motion and failed loading expose the written sequence without the long sticky track.

The live deployment check also exposed caption/footer crowding in a shallow 1280×585 laptop window. The compact side-by-side treatment now extends to desktop widths with heights up to 700 px; normal portrait/tablet camera breakpoints stay the same. Expanded details retain the component kicker and editorial line while releasing the large display line at these short heights.

**Limits:** these are Chrome responsive-viewport checks, not physical iPhone/Safari or GPU frame-rate measurements. Native hardware pinch behavior, assistive-technology coverage and field conversion outcomes remain unmeasured. The fluid is the existing authored analytic surface rather than a CFD simulation. The preview remains on GitHub Pages with no custom domain, orders or payment processing.
