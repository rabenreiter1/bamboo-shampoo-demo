# bamboo-shampoo design preview

German: https://rabenreiter1.github.io/bamboo-shampoo-demo/de/
English: https://rabenreiter1.github.io/bamboo-shampoo-demo/en/
Fullscreen 3D product ritual: https://rabenreiter1.github.io/bamboo-shampoo-demo/assembly/

A bilingual storefront preview built around the approved 3D product. The campaign direction uses a full-viewport product scene, condensed typography and lavender/ice-blue fragrance worlds. Aloe has pale aqua liquid, Argan warm amber and Bamboo soft green; bulk, surface, stream, droplets and refill posters share each scent's palette. The standalone approval animation retains its grapefruit-coral appearance. The homepage, each fragrance page and the refill page contain a reversible, native-scroll use/refill story. The collection, product configuration, editorial story, FAQ, bag and selection review have dedicated routes and responsive layouts. It accepts no orders, payments or customer contact details.

Design and implementation evidence: [SHOP_REFERENCE_RESEARCH.md](SHOP_REFERENCE_RESEARCH.md) and [AI_DESIGN_PLAYBOOK.md](AI_DESIGN_PLAYBOOK.md). Reference observations, creator claims and implementation inferences are distinguished; no reference is claimed to be an AI-only build without evidence.

The journey follow-up reviews all ten supplied references in [JOURNEY_REFERENCE_RESEARCH.md](JOURNEY_REFERENCE_RESEARCH.md), records baseline defects and their closure in [JOURNEY_AUDIT.md](JOURNEY_AUDIT.md), and separates measured CPU work from unverified phone/GPU performance in [JOURNEY_PERFORMANCE.md](JOURNEY_PERFORMANCE.md).

## Continuous journey and optional details

The homepage follows five named chapters: discover, materials, ritual, collection and questions. Native scrolling advances and reverses the product story. Product, material, refill, FAQ and 3D inspection details open in a separate scrollable dialog, pause covered models, and retain the underlying page. Close, Escape and browser Back restore the origin and its focus; Forward reopens the detail. Inspection starts at the visible ritual pose and provides rotation, zoom, reset and a scrubber. Direct pages, modified clicks and the original fullscreen approval animation remain reachable.

`assets/journey.js` owns local scent/format choice, chapter bookmarks and dialog/history continuity. Same-viewport returns use the exact scroll offset; resized returns use chapter progress. A deliberate return from a dedicated page resumes the saved chapter. Cold visits do not force an old checkpoint. Pagehide snapshots preserve viewer pose, rotation and zoom for BFCache remounting. Nested bag dialogs keep the background paused until the final modal closes. Session storage is optional; in-place use still works when storage is blocked.

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

The server runs on port 4173. GitHub Pages publishes the committed `docs/` directory from `main`. Change copy and templates in `scripts/shop-pages.mjs`, shared layout and metadata in `scripts/shop-build.mjs`, styles in `assets/style.css`, interactions in `assets/app.js`, and product logic in `assets/catalog.js`. `scripts/build.mjs` is the full build entry. Rebuild before publishing changes.

## Shop model integration

`assets/shop-scene.js` mounts element-sized viewers using the same component factories, source artwork and choreography as the fullscreen animation. Product galleries switch between the complete product, sealed refill and complete cap without creating another WebGL context. Home, product and refill stories use normal page scrolling, ease into the requested pose and allow horizontal inspection with inertial spin. Vertical scrolling and browser pinch zoom remain native.

Viewers render only when visible and moving. Shader programs warm asynchronously with the still image visible, and failed WebGL loading retains the image. Reduced-motion users receive the five written lifecycle steps without a long animated scroll section. Page-exit and context-recovery paths dispose or rebuild GPU resources.

The full build writes 22 localized content pages, six legacy fragrance redirects, the entry page, 404 and fullscreen animation. Product URLs are `/de/products/aloe/`, `/de/products/argan/` and `/de/products/bamboo/`, with matching English routes. `?format=refill` opens the refill configuration and stays selected through fragrance and language changes. Bag prices use integer cents and the review page collects no customer data.

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

Route-specific localized titles and descriptions, canonical URLs, reciprocal hreflang, social cards, breadcrumbs, collection metadata and a sitemap are included. The session-only review page is excluded from the sitemap. The preview deliberately uses `noindex` until approved for a real launch. No custom domain or DNS is configured. GitHub Pages hosts the design preview; a commerce backend is needed for real orders.

Fonts and images are self-hosted. No analytics, third-party embeds or marketing cookies. The demo bag, local scent/format choice and journey return bookmark use sessionStorage. Reduced-motion preferences disable animation and parallax; parallax is also disabled on small screens. Reduced-motion and no-script layouts expose all five written steps at content-driven height.

The legal notice preserves the operator-provided source fragment verbatim. Regression checks lock both its hash and the hash of the original engraving.

The 2026-10-13 redesign passed 82 regression tests and the 31-page link, asset, language, indexing and domain checks. Browser review covered the desktop campaign and product layout, 390px and 320px mobile layouts, scent and format selection, gallery rotation, quantities, mixed bag totals, language persistence, collection filtering and the mobile purchase dock. Refill and pour render exports were independently reviewed after the final PET/gel optics pass.

The subsequent journey audit passed 112 regression tests, including 21 journey/history tests and six production gesture-handler tests, plus the 31-page checker. Chrome review covered exact scroll/focus return, current-pose inspection, Back/Forward, cold reload, nested bag suspension, BFCache restoration, add feedback, explicit cross-page return, and desktop/390 px/320 px/short-landscape layouts. Authored no-script and reduced-motion fixtures verified the complete written lifecycle. Interactive shop scenes use group containers so their focusable canvases remain exposed, with keyboard descriptions and visible focus. Physical-phone frame rate, native multi-touch arbitration, a full screen-reader pass and field conversion outcomes remain unverified; desktop viewport emulation is not evidence of those results.

## Asset provenance

The product images are transparent render exports of the approved 3D model, captured locally with the same component factories used by the interactive viewer. WebP files serve the storefront; JPEG versions serve social previews:

- `assets/shop-product.webp`: closed product with bamboo shell, original engraving and complete silicone cap.
- `assets/shop-refill.webp`: sealed transparent PET insert with support flange, grapefruit-coral shampoo and visible headspace.
- `assets/shop-refill-aloe.webp`, `assets/shop-refill-argan.webp`, `assets/shop-refill-bamboo.webp`: scent-specific exports of that same approved sealed PET model and liquid factory.
- `assets/shop-cap.webp`: complete silicone cap viewed from above.
- `assets/bamboo-water.webp`: ImageGen campaign photograph, lavender lagoon with three bamboo stalks, 2026-10-13; no product geometry, text or ingredients claims. Source `exec-8a27daaa-11b5-4dd4-a7fa-eea5e13eef37.png` in the local generated-image archive.
- `assets/gel-macro.webp`: ImageGen campaign macro photograph of a translucent grapefruit-coral gel ribbon, 2026-10-13; a visual mood asset rather than a formula photograph. Source `exec-95e79056-bcdd-4f16-9edd-87e0ed20c395.png` in the local generated-image archive.
- `assets/forest.webp`: retained earlier editorial asset; no longer used as the main campaign direction.

Earlier generated packaging concepts and rejected engraving variants are not included in the new shop build. The build uses an explicit asset allowlist. The assembly review publishes only the authorised cap reference and original engraving, not private technical drawings, legacy CAD, backup files or local QA captures. No stock footage, analytics or external embeds are used.

Barlow Condensed Bold 700 and Manrope are self-hosted under their included Open Font Licenses in `assets/`. Barlow's source is the official Google Fonts distribution. Retained earlier editorial fonts are also licensed under the included OFL. The favicon and interface graphics are original SVG/CSS.
