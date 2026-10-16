# bamboo-shampoo design preview

German: https://rabenreiter1.github.io/bamboo-shampoo-demo/de/
English: https://rabenreiter1.github.io/bamboo-shampoo-demo/en/
Fullscreen 3D product ritual: https://rabenreiter1.github.io/bamboo-shampoo-demo/assembly/

## Current studio images and design comparison

The default routes retain the sage/ivory presentation and automatic explanation. `/classic/de/` and `/classic/en/` restore the graphic composition and typography from `a5071f1`, with the current corrected components, pastel caps and shared commerce code. The classic home explanation follows native scrolling in both directions. No retired detail dialogs or duplicate format selectors are restored.

Double activate the copyright line in the footer within 450 ms to reveal **Aktuelles Design / Früheres Design** (English equivalents on English pages). Enter or Space opens the inline choices; Escape closes them. The hit area is at least 44 px. The matching route, language, fragrance, queried format and session bag survive a switch; the new presentation starts at the top. The mobile purchase dock hides when the footer enters view so it cannot cover these links. Explicit classic URLs do not change the default entry route. Journey bookmarks are separated by presentation.

Static packaging assets use Blender 4.5.9 LTS Cycles, with responsive WebP output. `scripts/current-studio-stills-manifest.json` records the fresh operative-factory GLB, exact source POSITION/UV/index buffers and transforms, Blender before/after geometry checks, original engraving hash, recipe snapshots and individual PNG/WebP hashes. Material-only changes provide moulded silicone, clear PET and separate absorbing liquid, with soft studio lighting. No geometry modifier or generative product-image edit is used. Static images have no switch to a realtime viewer. The animation loading images remain actual matching WebGL frames, not Cycles stills substituted into motion stages.

Reproduce the private source export and image pipeline locally (Blender is obtained separately from its official distribution):

```sh
npm ci
node scripts/cycles-serve.mjs
# Open the printed localhost URL; export and download the verified source JSON.
node scripts/cycles-job.mjs <blender-executable> <downloaded-source.json> qa/cycles-output
node scripts/cycles-encode.mjs qa/cycles-output
node scripts/build.mjs
node --test --test-concurrency=1 scripts/*.test.mjs
node scripts/check.mjs
```

The export harness is local only; the Pages build does not publish it, raw source bundles, Blender or private technical drawings. The serialized GLB check explicitly reports GLTFExporter's normal-vector normalization; positions, UVs, indices and transforms remain byte-identical. Optical coefficients are visual material choices, not measured lab values. The unchanged procedural liquid has a 0.204364 mm contact gap between its side and concave free-surface perimeter. The single-object Cycles optical approximation retains and documents that gap rather than adding geometry. Packaging images retain a neutral studio backdrop through transmitting surfaces to avoid noisy glass-alpha coverage; their exterior background remains transparent.

This revision passes 282 automated tests and the 59-page checker (44 localized content pages, 12 preserved redirects, entry, 404 and the fullscreen approval page). The archived assembly GLB validates with zero errors and warnings. The 17 Cycles WebPs are 28–58 KB at small sizes and 34–152 KB at full sizes, within their 120/240 KB limits. Codex in-app Chromium checks covered the footer double activation and keyboard navigation, variant/language/Argan-refill preservation, the shared bag and a complete €4.50 classic demo checkout. Layout measurements across phone, tablet, landscape and ultrawide sizes found no document overflow on the inspected home, collection, refill, story and checkout routes. Native card snapping aligned the next card within one CSS pixel. Isolated local reduced-motion and forced-WebGL-failure fixtures exposed all eight written steps in both designs. A private ten-second model-module delay retained the matched Aloe poster, the 844 px hero height and scroll position0 when the viewer became ready. These are desktop-browser checks; physical iPhone/Safari, native multi-touch and field performance remain unverified.

A bilingual storefront preview built around the approved 3D product. The homepage opens with “Shampoo zum Nachfüllen.” and a short automatic construction study, followed by three fragrance cards and the complete automatic product explanation. Ivory, sage and dark green frame pastel-green Aloe, rose Argan and pastel-blue Bamboo caps. Aloe has pale aqua liquid, Argan warm amber and Bamboo soft green; bulk, surface, stream, droplets and refill posters share each scent's palette. The standalone approval animation retains its grapefruit-coral appearance and scroll controls. The collection, product configuration, editorial story, FAQ, bag and simulated checkout have dedicated routes and responsive layouts. It accepts no orders, payments or customer contact details.

The sage/autoplay revision passes 247 automated tests and the 31-page build checker. Chrome viewport checks cover 320×568, 390×844, 430×932, 768×1024, 844×390, 1440×900, 1920×1080 and 3440×1440: no document overflow in the inspected layouts, all eight captions fit their stable space, and chapter touch targets exceed 44px. Browser checks include snapped fragrance cards with a visible next-card preview, menu suspension without elapsed-time catch-up, manual inspection pause, restored paused playback, a deliberately delayed asset cold start, readable renderer-failure fallbacks, and a complete €17 mixed Starter-Set/Refill demo checkout including refresh-safe confirmation. These are desktop Chrome viewport and local fixture checks, not physical iPhone/Safari or hardware frame-rate certification.

All 24 new 1280×1600 product posters were rendered from the current source factories with the accepted cap contours and byte-identical original engraving. Capture validation checks the exact model dimensions, palette, source-file hashes, alpha pixels and matched first-frame cameras before encoding. Ten new localized 1200×630 share images use the same finished variants. The private capture studio and its source/projection metadata remain excluded from publication. Cormorant Garamond Regular is active for editorial headings; BAMBOO/REFILL and the wordmark retain their graphic weight.

Design and implementation evidence: [SHOP_REFERENCE_RESEARCH.md](SHOP_REFERENCE_RESEARCH.md) and [AI_DESIGN_PLAYBOOK.md](AI_DESIGN_PLAYBOOK.md). Reference observations, creator claims and implementation inferences are distinguished; no reference is claimed to be an AI-only build without evidence.

The journey follow-up reviews all ten supplied references in [JOURNEY_REFERENCE_RESEARCH.md](JOURNEY_REFERENCE_RESEARCH.md), records baseline defects and their closure in [JOURNEY_AUDIT.md](JOURNEY_AUDIT.md), and separates measured CPU work from unverified phone/GPU performance in [JOURNEY_PERFORMANCE.md](JOURNEY_PERFORMANCE.md).


## Photographic surface revision — 2026-10-15

All nine stills receive controlled photographic material/lighting edits of the approved source-derived reference images: three starter sets, three filled refills, the empty sleeve, the complete cap and a sealed-refill detail. The actual 250 ml drawing, traced current cap reference and original engraving constrain the edits. Real prototype bamboo supplies material appearance only. One master supplies the two cap-colour variants; the refill master supplies the other two liquid colours. Fine vascular pores, laser-burn fibre texture, satin molded silicone, refractive PET, a liquid meniscus and restrained studio reflections replace the flat render appearance. These remain AI-assisted photographic visualizations, not camera-captured product photographs; generative retouching does not establish pixel-identical geometry or typography.

Product cards, product/story images, basket, demo checkout and ten newly versioned social images share the photographic assets. Static galleries contain only their image: no still/3D switch, hidden renderer or drag instruction. The one priced Starter-Set/Refill selector remains; direct refill URLs receive the correct still before first paint. Actual animation stages, their source geometry, materials, poses and matched loading frames remain unchanged.

Finished assets retain compatible photo-* filenames, with 640×800 and 1280×1600 transparent packshots. scripts/photographic-stills-manifest.json records the selected retouches and encoded outputs; exact production prompts and selected PNGs are retained privately under qa/ultra-photography/. Built-in ImageGen was used, without API/CLI fallback. The untouched scripts/still-capture-manifest.json remains the baseline reference-capture record, including the actual drawing/engraving/cap-reference hashes, source mesh fingerprints, cameras and undimensioned construction limits. Tests distinguish final photographic-asset integrity from unchanged reference mesh integrity. Original drawings, material photographs, capture tooling and private prompts are excluded from the public Pages asset allowlist.

## Graphic opening and a dedicated product story

The homepage follows discover, collection, ritual and questions. The complete product stands in front of oversized BAMBOO lettering; lettering, product and the fragrance backdrop share one opaque visual canvas to avoid transparent WebGL composition seams. Scent selection comes next. The how-it-works section begins with the closed retail product, then shows cap removal, peeling, recapping, dispensing, empty PET removal and a fresh sealed refill. Eight short captions follow the displayed pose forwards and backwards. There is no preliminary anatomical reveal or explanatory popup.

`assets/playback.js` maps a 32-second homepage loop and a 14-second refill teaser onto the approved use/refill poses. The homepage retains its 720-degree rotation; the refill teaser has its own complete 360-degree turn. Both clocks wait for the first completed frame and at least half of their stage to be visible. Hidden tabs, offscreen stages, menu and bag suspend time without catch-up. Pause, seeking, chapters and inertial manual rotation remain available; inspection and seeking pause automatic playback. Captions sit beside the model on desktop and below it on phones, in a fixed area that does not shift on each text change. The detailed refill sequence and standalone animation retain their native scroll controls.

`assets/journey.js` owns local scent choice, chapter bookmarks, normal route navigation and return links. Informational details and inspection modals have been retired everywhere, including legacy popup history cleanup. Basket and menu retain their native dialog locking and focus behavior. Product pages have exactly one priced Starter-Set/Refill radio group directly below the model, explicitly associated with the purchase form; model, price, links, quantity and basket share the same selection. Existing cart keys and product URLs remain compatible. Old scrolling-guide bookmarks migrate to the corresponding animation pose without restoring obsolete page pixels.

## Product briefing

250 ml shampoo with bamboo shell and cap: EUR 12.50. 250 ml refill: EUR 4.50. Fragrances: Aloe, Argan, Bamboo. The refill is a thin transparent PET insert sealed with peel-off film; the bamboo shell and silicone cap are reused. Product renders use the approved geometry and unchanged original engraving. The original engraving remains on every fragrance render, as explicitly requested; it is not rewritten as fragrance-specific artwork. See the model plans for measured dimensions and illustrative details.

## Run and maintain

Node 20 or newer. Install the development dependencies for geometry tests and glTF validation.

```sh
npm ci
npm run build
npm test
npm run dev
```

The server runs on port 4173. GitHub Pages publishes the committed `docs/` directory from `main`. Change copy and templates in `scripts/shop-pages.mjs`, shared layout and metadata in `scripts/shop-build.mjs`, styles in `assets/style.css` and the final responsive layer `assets/polish.css`, interactions in `assets/app.js`, and product logic in `assets/catalog.js`. `scripts/build.mjs` is the full build entry. Rebuild before publishing changes.

## Shop model integration

`assets/shop-scene.js` mounts element-sized viewers using the same component factories, source artwork and choreography as the fullscreen animation. Product galleries offer only Starter-Set and Refill: the complete filled product or its sealed replacement insert. The cap is explained as a reusable component, not offered separately. `assets/product-theme.js` supplies generated CSS, painted backgrounds and independently owned cap materials. Native page scrolling, horizontal inspection with inertial spin and browser pinch zoom remain available through the shop.

Viewers render only when visible and moving. Shader programs warm asynchronously with a matching source-derived poster visible; the homepage shows its opening caption during loading. A restored open or manually rotated pose does not display a contradictory closed poster while warming. Failed WebGL loading retains the image and exposes the written chapters. Reduced-motion and no-script users receive all eight homepage explanations; the detailed refill section retains its five written steps. Page-exit and context-recovery paths dispose or rebuild GPU resources, while preserving elapsed time, explicit pause and manual yaw.

The full build writes 22 localized content pages, six legacy fragrance redirects, the entry page, 404 and fullscreen animation. Product URLs are `/de/products/aloe/`, `/de/products/argan/` and `/de/products/bamboo/`, with matching English routes. `?format=refill` opens the refill configuration and stays selected through fragrance and language changes. Bag prices use integer cents. The four-stage simulated checkout collects no customer data, makes no orders or payments, and retains only product/demo receipt details in sessionStorage for refresh recovery.

## 3D product approval page

`assets/assembly/` contains source-derived tube and cap geometry, the unchanged original engraving SVG, and a fullscreen, endlessly reversible use/refill cycle. Scroll opens the cap, progressively peels the film, opens the outlet, tilts and dispenses grapefruit-coral shampoo with one silicone-roof pressure dose, then replaces the empty insert and closes over a fresh intact seal. Automatic axial rotation totals720° per cycle. Scroll and drag release coast smoothly; horizontal drag adds axial spin, and pinch or Ctrl-wheel zooms. Separate camera-aligned lanes prevent component collisions and carry discarded parts outside the frame. No visible controls or autoplay are present.

Liquid uses physical transmission, path-length absorption, a concave meniscus, deformed surface normals, capillary strand necking and volume-preserving drop stretch. A specular-only Fresnel skin separates clear PET reflections from the deeper coral contents. Geometry is reconstructed analytically from the scroll pose so reverse motion remains identical. This is an authored viscous fluid surface, not a computational fluid dynamics simulation.

```sh
npm run build:assembly
npm run test:ritual
npm run test:assembly
npm run validate:assembly
```

The selective assembly build leaves existing shop files untouched. The complete build also includes the assembly page. The shop shares the approved model and fluid factories while retaining native page scroll. See [RITUAL_PLAN.md](RITUAL_PLAN.md) for choreography, dimensions, visual assumptions, prompt research and checks. [ASSEMBLY_PLAN.md](ASSEMBLY_PLAN.md) records the earlier exploded study. Its six-component, 14-second animated GLB remains an archived asset in metres; it does not encode the procedural foil/liquid cycle.

## SEO and hosting

Route-specific localized titles and descriptions, canonical URLs, reciprocal hreflang, social cards, breadcrumbs, collection metadata and a sitemap are included. The session-only demo checkout is excluded from the sitemap. The preview deliberately uses `noindex` until approved for a real launch. No custom domain or DNS is configured. GitHub Pages hosts the design preview; a commerce backend is needed for real orders.

Fonts and images are self-hosted. No analytics, third-party embeds or marketing cookies. The demo bag, local scent/format choice, product-only demo receipt and journey return bookmark use sessionStorage. Reduced-motion preferences disable animation and parallax; parallax is also disabled on small screens. Written fallbacks have content-driven height.

The legal notice preserves the operator-provided source fragment verbatim. Regression checks lock both its hash and the hash of the original engraving.

The 2026-10-13 redesign passed 82 regression tests and the 31-page link, asset, language, indexing and domain checks. Browser review covered the desktop campaign and product layout, 390px and 320px mobile layouts, scent and format selection, gallery rotation, quantities, mixed bag totals, language persistence, collection filtering and the mobile purchase dock. Refill and pour render exports were independently reviewed after the final PET/gel optics pass.

The subsequent journey audit passed 112 regression tests. The early-reveal release passed 131, including actual component-clearance sweeps, responsive camera regions, reverse caption behavior, continuous native routes, delayed resume and six production gesture-handler tests, plus the 31-page checker. Chrome review covered 1440×900 desktop, 768×1024 tablet, 390×844 and 320×740 portrait, and 844×390 landscape, including inline explanations, scent changes, reload, native product navigation and the refill bag total. Interactive shop scenes use group containers so their focusable canvases remain exposed, with keyboard descriptions and visible focus. Physical-phone frame rate, Safari rendering, native multi-touch arbitration, a full screen-reader pass and field conversion outcomes remain unverified; desktop viewport emulation is not evidence of those results.

The graphic-hero and dedicated-studio revision passed 132 regression tests and the 31-page checker. Chrome review covered the restored opening at 1440×900 and 390×844, the compact 320×740 caption, phone peeling and pouring, and a late-sequence rotation to 844×390. An integration test protects the inspected pose when resized CSS would otherwise put the old scroll pixels past the tutorial. The tutorial has one scroll surface; captions contain no nested scrolling area.

## Asset provenance

The product images are transparent render exports of the approved 3D model, captured locally with the same component factories used by the interactive viewer. WebP files serve the storefront. Dedicated campaign JPEGs now serve social previews:

- `assets/shop-product.webp`: closed product with bamboo shell, original engraving and complete silicone cap.
- `assets/shop-refill.webp`: sealed transparent PET insert with support flange, grapefruit-coral shampoo and visible headspace.
- `assets/shop-refill-aloe.webp`, `assets/shop-refill-argan.webp`, `assets/shop-refill-bamboo.webp`: scent-specific exports of that same approved sealed PET model and liquid factory.
- `assets/shop-cap.webp`: complete silicone cap viewed from above.
- `assets/bamboo-water.webp`: ImageGen campaign photograph, lavender lagoon with three bamboo stalks, 2026-10-13; no product geometry, text or ingredients claims. Source `exec-8a27daaa-11b5-4dd4-a7fa-eea5e13eef37.png` in the local generated-image archive.
- `assets/gel-macro.webp`: ImageGen campaign macro photograph of a translucent grapefruit-coral gel ribbon, 2026-10-13; a visual mood asset rather than a formula photograph. Source `exec-95e79056-bcdd-4f16-9edd-87e0ed20c395.png` in the local generated-image archive.
- `assets/forest.webp`: retained earlier editorial asset; no longer used as the main campaign direction.

Earlier generated packaging concepts and rejected engraving variants are not included in the new shop build. The build uses an explicit asset allowlist. The assembly review publishes only the authorised cap reference and original engraving, not private technical drawings, legacy CAD, backup files or local QA captures. No stock footage, analytics or external embeds are used.

Barlow Condensed Bold 700, Cormorant Garamond Regular 400 and Manrope are self-hosted under their included Open Font Licenses in `assets/`. Barlow keeps the large BAMBOO/REFILL lettering; Cormorant provides editorial headings; Manrope provides navigation, prices and body copy. The favicon and interface graphics are original SVG/CSS.

The revised selection/use release passes 140 regression tests and the 31-page checker. New 1536 × 1920 upright card and empty-shell images were captured from the unchanged approved factories and encoded as transparent WebP assets (approximately 90–100 kB each). GPU backdrop textures are reallocated on viewport changes. The original engraving, legal fragment and standalone assembly remain unchanged. Actual iPhone Safari rendering and hardware frame rates still require physical-device verification.

## Jury polish

The story’s empty bamboo tube is now an actual shell-only viewer with drag/coast and keyboard rotation. GPU construction is serialized near the viewport; first product renders omit hidden operative film/fluid resources until refill inspection needs them. Oversized render targets have a 3-million-pixel ceiling. First useful product posters are prioritized; native route navigation retains history and bookmarks, with bounded intent prefetch and progressive CSS page transitions. The four-step demo checkout supports review, editing, duplicate/stale submission guards and refresh-safe product-only receipts. No customer or actual payment fields are collected. Phone, tablet, landscape and ultrawide layouts share a final fluid responsive stylesheet.

Loading now reserves the final scroll-track height, so a cold return can restore its saved pose without a later GPU-induced page jump. Catalogue filters remain in the URL across Back, bookmarks and the language switch; filtered grids expand across ultrawide screens. Cross-document transition opt-in is available synchronously in the document head.

This release passes 184 automated tests and the 31-page checker. Chrome viewport review covered 320 × 568, 390 × 844, 768 × 1024, 844 × 390, 1024 × 768, 1440 × 900, 1920 × 1080, 2560 × 1440 and 3440 × 1440, with no horizontal document overflow in the inspected layouts. Browser verification included shell rotation, lazy refill inspection, a complete mixed-product demo checkout, quantities, review edits, empty state, refresh-safe confirmation, a fresh basket after completion, native Back with a saved filter, and journey returns at 38% and 80%, including a changed viewport and a bookmark beyond the animation. Physical iPhone/Safari behavior, native pinch gestures, field performance and a full screen-reader pass remain unverified.

## Seamless first paint and card snapping

The supplied 5.93-second iPhone recording exposed a different poster camera and a cached liquid-visibility error during format switching. Product and refill previews now come from the live camera and material factories, with shared CPU framing and the same 2D world/type painter as the GPU backdrop. Prepaint code restores the validated local choice, queried format and optional return link before the large interactive module loads. Two opaque-product posters use a correctly premultiplied transparent export so their contact shadows match the live renderer. Original engraving and manufacturing geometry remain unchanged.

The liquid effect restores group visibility before its geometry-cache check, retaining the full 250 ml fill after repeated Shampoo/Refill changes. Mobile home, refill and related-product tracks use mandatory native snapping, with trailing space that aligns the final card at the same leading edge. Regression coverage includes the real THREE camera projection, prepaint query/bookmark initialization, denied storage, and repeated liquid hide/restore. Controlled browser checks compared the still and live product poses and exercised repeated format switching and native partial-scroll snapping; physical Safari behavior still requires device verification.

The final release passes 192 tests and the 31-page checker. Preview-world bitmaps are cached by viewport, fragrance, lettering and font readiness; scroll pose updates do not repaint the hidden backdrop. Mobile native snap checks aligned the second and final cards within one CSS pixel. Tablet and large-desktop inspection at 768 × 1024 and 2560 × 1440 retained the selected refill and showed no horizontal document overflow.

## Shared-link artwork

The entry, home, product and refill links now expose static Open Graph and large Twitter-card metadata with versioned, public JPEG URLs. Ten 1200 × 630 images cover German and English home, fragrance and refill previews. The artwork follows the live hero: the same Campaign and Manrope fonts, coloured world, oversized lettering and approved transparent product render. The refill preview uses the approved sealed insert. Only the clipped far end of the poster's contact shadow is feathered; original product geometry and engraving stay intact.

Metadata and filenames are defined in `scripts/share-cards.mjs`; the browser-canvas composition is in `scripts/share-card-art.mjs`. Optimized finished images are 43–64 kB each and are copied through the publish allowlist. Titles and descriptions are shorter for the campaign/product links; informational routes retain their own document copy. The bare entry URL also carries a complete preview before its locale redirect. The release passes 195 regression tests and the 31-page checker, including JPEG frame dimensions, public image paths, localized route selection and metadata available without JavaScript. Actual rendering inside WhatsApp is not part of the browser verification.

## Product stills: perspective correction

The first Cycles studio release used a low orthographic camera, unlike the interactive viewer. Equal-size tube ends and the drawing's shallow waist therefore appeared more pronounced, and the shadow catcher produced a visibly clipped floor strip on coloured cards. Product and empty-shell stills now use the viewer's 30-degree perspective field of view and its respective view directions. A broader key light and stronger fill soften the shading; opaque product cut-outs omit the floor catcher. The original profile, component geometry, dimensions, UVs and engraving remain unchanged.

The `20261015-perspective2` image and share-card URLs distinguish this correction from cached photographs. Product pages, both design variants, cards and cart thumbnails share those assets. The interactive animation and its matched loading posters retain their existing cameras and materials. Regression checks cover projected base-to-waist proportions and transparent image borders, in addition to the source-geometry and artwork checks. These are controlled product visualizations, not photographs of a manufactured production sample.

## Modern / Classic release structure (2026-10-16)

Modern is the bold purple presentation at `/de/` and `/en/`; Classic is the sage editorial presentation at `/design/classic/de/` and `/design/classic/en/`. Historical `/classic/{language}/...` links redirect to Modern while retaining the query and fragment. Internal renderer IDs remain `classic` for Modern and `current` for Classic for compatibility; use `assets/presentations.js` for public names, route bases and bookmark descriptors.

The copyright line opens an inline Modern / Classic selector on a double tap within 450 ms, or Enter / Space; Escape closes it. Both presentations share product data, prices, geometry, engraving, images and the simulated checkout. Format-specific purchase docks and related cards follow the selected Starter-Set or Refill.

Runtime modules, their operative assembly dependencies and animation loading posters are copied together into a content-addressed `assets/releases/<hash>/` folder. The source layout is preserved, and the import map resolves Three from that same release. JS and JSON line endings are normalized for reproducibility; SVG and binary assets remain byte-identical. The release verifier checks identity, file hashes and the operational import dependency closure.

The surface worker moves the existing material arithmetic and engraving mesh generation off the main thread, with a yielding fallback when workers are unavailable. `scripts/surface-runtime-parity.json` records an actual factory-export comparison: all 23 meshes and all five decoded RGBA textures match the reviewed source, as do exported material definitions and assignments. Random UUID aliases for unnamed materials are normalized while preserving material sharing. No dimensions, contours or engraving artwork change.

### Loading-frame release gate

Capture loading frames through `scripts/serve-motion-posters.mjs` and the embedded-browser page `/scripts/motion-poster-studio.html`. Use its **Capture 12 animation loading frames** action. Encode the downloaded bundle with `node scripts/encode-motion-posters.mjs <download.json>`, then run `node scripts/record-motion-release.mjs`. The capture validates current factories, exact artwork and camera metadata; final build validation inventories every generated motion stage rather than assuming a fixed page count. The standalone ritual has its own poster family instead of borrowing a product-gallery photograph.

Do not publish a build with missing or stale capture provenance. Browser visual acceptance and final generated-output tests remain required after capture; source tests alone are not a completed release. Physical iPhone/Safari results must only be reported when actually tested.
