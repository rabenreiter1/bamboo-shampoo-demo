# bamboo-shampoo design preview

German: https://rabenreiter1.github.io/bamboo-shampoo-demo/de/
English: https://rabenreiter1.github.io/bamboo-shampoo-demo/en/
Fullscreen 3D product ritual: https://rabenreiter1.github.io/bamboo-shampoo-demo/assembly/

A bilingual storefront preview built around the approved 3D product. The homepage opens with the complete product in front of oversized BAMBOO lettering and a fragrance-coloured atmosphere. A separate pale studio section explains the construction, use and refill cycle through one scroll-controlled scene and one short caption at a time. Aloe has pale aqua liquid, Argan warm amber and Bamboo soft green; bulk, surface, stream, droplets and refill posters share each scent's palette. The standalone approval animation retains its grapefruit-coral appearance. The collection, product configuration, editorial story, FAQ, bag and simulated checkout have dedicated routes and responsive layouts. It accepts no orders, payments or customer contact details.

Design and implementation evidence: [SHOP_REFERENCE_RESEARCH.md](SHOP_REFERENCE_RESEARCH.md) and [AI_DESIGN_PLAYBOOK.md](AI_DESIGN_PLAYBOOK.md). Reference observations, creator claims and implementation inferences are distinguished; no reference is claimed to be an AI-only build without evidence.

The journey follow-up reviews all ten supplied references in [JOURNEY_REFERENCE_RESEARCH.md](JOURNEY_REFERENCE_RESEARCH.md), records baseline defects and their closure in [JOURNEY_AUDIT.md](JOURNEY_AUDIT.md), and separates measured CPU work from unverified phone/GPU performance in [JOURNEY_PERFORMANCE.md](JOURNEY_PERFORMANCE.md).

## Graphic opening and a dedicated product story

The homepage follows discover, collection, ritual and questions. The complete product stands in front of oversized BAMBOO lettering; lettering, product and the fragrance backdrop share one opaque visual canvas to avoid transparent WebGL composition seams. Scent selection comes next. The how-it-works section begins with the closed retail product, then shows cap removal, peeling, recapping, dispensing, empty PET removal and a fresh sealed refill. Eight short captions follow the displayed pose forwards and backwards. There is no preliminary anatomical reveal or explanatory popup.

`assets/journey-caption.js` maps native page scroll to the displayed scene and captions. `assets/journey-pose.js` uses the approved use/refill choreography directly. Automatic axial rotation totals 720 degrees. The camera reserves space below the model for captions on desktop and portrait phones; short landscape places them alongside it. Width changes preserve the inspected progress; height-only browser-chrome changes do not redefine scroll duration.

`assets/journey.js` owns local scent choice, chapter bookmarks, normal route navigation and return links. Informational details and inspection modals have been retired everywhere, including legacy popup history cleanup. Basket and menu retain their native dialog locking and focus behavior. Product pages have exactly one priced Shampoo/Refill radio group directly below the model, explicitly associated with the purchase form; model, price, links, quantity and basket share the same selection.

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

`assets/shop-scene.js` mounts element-sized viewers using the same component factories, source artwork and choreography as the fullscreen animation. Product galleries offer only Shampoo and Refill: the complete filled product or its sealed replacement insert. The cap is explained as a reusable component, not offered separately. Home, product and refill stories use normal page scrolling, ease into the requested pose and allow horizontal inspection with inertial spin. Vertical scrolling and browser pinch zoom remain native.

Viewers render only when visible and moving. Shader programs warm asynchronously with the still image visible; the homepage shows its opening caption during loading. Failed WebGL loading retains the image and exposes the written chapters. Reduced-motion and no-script users receive all nine homepage explanations without the long animated scroll section; the other lifecycle sections retain their five written steps. Page-exit and context-recovery paths dispose or rebuild GPU resources.

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

The revised selection/use release passes 140 regression tests and the 31-page checker. New 1536 × 1920 upright card and empty-shell images were captured from the unchanged approved factories and encoded as transparent WebP assets (approximately 90–100 kB each). GPU backdrop textures are reallocated on viewport changes. The original engraving, legal fragment and standalone assembly remain unchanged. Actual iPhone Safari rendering and hardware frame rates still require physical-device verification.

## Jury polish

The story’s empty bamboo tube is now an actual shell-only viewer with drag/coast and keyboard rotation. GPU construction is serialized near the viewport; first product renders omit hidden operative film/fluid resources until refill inspection needs them. Oversized render targets have a 3-million-pixel ceiling. First useful product posters are prioritized; native route navigation retains history and bookmarks, with bounded intent prefetch and progressive CSS page transitions. The four-step demo checkout supports review, editing, duplicate/stale submission guards and refresh-safe product-only receipts. No customer or actual payment fields are collected. Phone, tablet, landscape and ultrawide layouts share a final fluid responsive stylesheet.

Loading now reserves the final scroll-track height, so a cold return can restore its saved pose without a later GPU-induced page jump. Catalogue filters remain in the URL across Back, bookmarks and the language switch; filtered grids expand across ultrawide screens. Cross-document transition opt-in is available synchronously in the document head.

This release passes 184 automated tests and the 31-page checker. Chrome viewport review covered 320 × 568, 390 × 844, 768 × 1024, 844 × 390, 1024 × 768, 1440 × 900, 1920 × 1080, 2560 × 1440 and 3440 × 1440, with no horizontal document overflow in the inspected layouts. Browser verification included shell rotation, lazy refill inspection, a complete mixed-product demo checkout, quantities, review edits, empty state, refresh-safe confirmation, a fresh basket after completion, native Back with a saved filter, and journey returns at 38% and 80%, including a changed viewport and a bookmark beyond the animation. Physical iPhone/Safari behavior, native pinch gestures, field performance and a full screen-reader pass remain unverified.

## Seamless first paint and card snapping

The supplied 5.93-second iPhone recording exposed a different poster camera and a cached liquid-visibility error during format switching. Product and refill previews now come from the live camera and material factories, with shared CPU framing and the same 2D world/type painter as the GPU backdrop. Prepaint code restores the validated local choice, queried format and optional return link before the large interactive module loads. Two opaque-product posters use a correctly premultiplied transparent export so their contact shadows match the live renderer. Original engraving and manufacturing geometry remain unchanged.

The liquid effect restores group visibility before its geometry-cache check, retaining the full 250 ml fill after repeated Shampoo/Refill changes. Mobile home, refill and related-product tracks use mandatory native snapping, with trailing space that aligns the final card at the same leading edge. Regression coverage includes the real THREE camera projection, prepaint query/bookmark initialization, denied storage, and repeated liquid hide/restore. Controlled browser checks compared the still and live product poses and exercised repeated format switching and native partial-scroll snapping; physical Safari behavior still requires device verification.

The final release passes 192 tests and the 31-page checker. Preview-world bitmaps are cached by viewport, fragrance, lettering and font readiness; scroll pose updates do not repaint the hidden backdrop. Mobile native snap checks aligned the second and final cards within one CSS pixel. Tablet and large-desktop inspection at 768 × 1024 and 2560 × 1440 retained the selected refill and showed no horizontal document overflow.
