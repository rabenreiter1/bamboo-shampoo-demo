# bamboo-shampoo design preview

German: https://rabenreiter1.github.io/bamboo-shampoo-demo/de/
English: https://rabenreiter1.github.io/bamboo-shampoo-demo/en/
Fullscreen 3D product ritual: https://rabenreiter1.github.io/bamboo-shampoo-demo/assembly/

A bilingual storefront preview built around the approved 3D product. The homepage, each fragrance page and the refill page contain a reversible, native-scroll use/refill story. The collection, product configuration, editorial story, FAQ, bag and selection review have dedicated routes and responsive layouts. It accepts no orders, payments or customer contact details.

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

`assets/assembly/` contains source-derived tube and cap geometry, the unchanged original engraving SVG, and a fullscreen, endlessly reversible use/refill cycle. Scroll opens the cap, progressively peels the film, opens the outlet, tilts and dispenses amber shampoo with one silicone-roof pressure dose, then replaces the empty insert and closes over a fresh intact seal. Automatic axial rotation totals720° per cycle. Scroll and drag release coast smoothly; horizontal drag adds axial spin, and pinch or Ctrl-wheel zooms. Separate camera-aligned lanes prevent component collisions and carry discarded parts outside the frame. No visible controls or autoplay are present.

```sh
npm run build:assembly
npm run test:ritual
npm run test:assembly
npm run validate:assembly
```

The selective assembly build leaves existing shop files untouched. The complete build also includes the assembly page. The standalone animation remains unchanged by the shop integration. See [RITUAL_PLAN.md](RITUAL_PLAN.md) for choreography, dimensions, visual assumptions, prompt research and checks. [ASSEMBLY_PLAN.md](ASSEMBLY_PLAN.md) records the earlier exploded study. Its six-component, 14-second animated GLB remains an archived asset in metres; it does not encode the procedural foil/liquid cycle.

## SEO and hosting

Route-specific localized titles and descriptions, canonical URLs, reciprocal hreflang, social cards, breadcrumbs, collection metadata and a sitemap are included. The session-only review page is excluded from the sitemap. The preview deliberately uses `noindex` until approved for a real launch. No custom domain or DNS is configured. GitHub Pages hosts the design preview; a commerce backend is needed for real orders.

Fonts and images are self-hosted. No analytics, third-party embeds or marketing cookies. The demo bag uses sessionStorage. Reduced-motion preferences disable animation and parallax; parallax is also disabled on small screens.

The legal notice preserves the operator-provided source fragment verbatim. Regression checks lock both its hash and the hash of the original engraving.

## Asset provenance

The current product photographs are screenshots of the approved 3D model, captured locally with the same component factories used by the interactive viewer:

- `assets/shop-product.jpg`: closed product with bamboo shell, original engraving and complete silicone cap.
- `assets/shop-refill.jpg`: sealed transparent PET insert with support flange, amber shampoo and visible headspace.
- `assets/shop-cap.jpg`: complete silicone cap viewed from above.
- `assets/forest.webp`: the existing ImageGen bamboo-forest editorial photograph.

Earlier generated packaging concepts and rejected engraving variants are not included in the new shop build. The build uses an explicit asset allowlist. The assembly review publishes only the authorised cap reference and original engraving, not private technical drawings, legacy CAD, backup files or local QA captures. No stock footage, analytics or external embeds are used.

Cormorant Garamond and Manrope are distributed under their included Open Font Licenses in `assets/`. The favicon and interface graphics are original SVG/CSS.
