# bamboo-shampoo design preview

German: https://rabenreiter1.github.io/bamboo-shampoo-demo/de/
English: https://rabenreiter1.github.io/bamboo-shampoo-demo/en/
Fullscreen 3D product ritual: https://rabenreiter1.github.io/bamboo-shampoo-demo/assembly/

A botanical luxury design preview with responsive editorial layouts, fragrance pages, animated refill explanation, scroll reveals, desktop parallax, accessible native dialogs, and a session-only demo bag. It accepts no orders, payments or customer contact details.

## Product briefing

250 ml shampoo with bamboo shell: EUR 12.50. 250 ml refill: EUR 4.50. Fragrances: Aloe, Argan, Bamboo. The refill is a thin transparent PET insert sealed with peel-off film. The existing cap with pump functionality is reused. Concept images are labelled and may differ from final manufacturing details. Final ingredients, tax, shipping and verified usage information remain prerequisites for a commercial launch.

## Run and maintain

Node 20 or newer. Install the development dependencies for geometry tests and glTF validation.

```sh
npm ci
npm run build
npm test
npm run dev
```

The server runs on port 4173. GitHub Pages publishes the committed `docs/` directory from `main`. Change copy and templates in `scripts/build.mjs`, styles in `assets/style.css`, interactions in `assets/app.js`, and product logic in `assets/catalog.js`. Rebuild before publishing changes.

## 3D product approval page

`assets/assembly/` contains source-derived tube and cap geometry, the unchanged original engraving SVG, and a fullscreen reversible use/refill cycle. Scroll opens the cap, progressively peels the film, opens the outlet, tilts and dispenses gel with one pressure dose, then replaces the empty insert and closes over a fresh intact seal. Horizontal drag spins the product; pinch or Ctrl-wheel zooms. No visible controls or autoplay are present.

```sh
npm run build:assembly
npm run test:ritual
npm run test:assembly
npm run validate:assembly
```

The selective assembly build leaves existing shop files untouched. The complete build also includes the assembly page. See [RITUAL_PLAN.md](RITUAL_PLAN.md) for the current choreography, dimensions, visual assumptions, prompt research and checks. [ASSEMBLY_PLAN.md](ASSEMBLY_PLAN.md) records the earlier exploded-study work. Its six-component,14-second animated GLB remains an archived asset in metres; it does not encode the new procedural foil/liquid cycle. The marketing redesign remains paused until the product model is approved.

## SEO and hosting

Localized titles, descriptions, canonical URLs, hreflang, social metadata, WebSite structured data and a sitemap are included. The preview deliberately uses `noindex` until approved for a real launch. No custom domain or DNS is configured. GitHub Pages is used for this non-transactional design demo; use suitable commerce hosting and a payment backend for the future live store.

Fonts and images are self-hosted. No analytics, third-party embeds or marketing cookies. The demo bag uses sessionStorage. Reduced-motion preferences disable animation and parallax; parallax is also disabled on small screens.

The legal notice reproduces the operator-provided source page as requested. Review legal information for the future commercial launch.

## Asset provenance

The shop's six photographs were generated with OpenAI ImageGen as concept visuals, using the supplied bamboo vessel photo as a shape reference for product scenes. Those concept images remain unchanged. The assembly review separately publishes the authorised current cap reference image and exact original engraving artwork. Private technical drawings, legacy CAD files and backup files are not published. No stock photographs or footage are used.

- `assets/hero.webp`: bamboo vessel on travertine, moss and bamboo leaves, warm sunlight, editorial space at left.
- `assets/product.webp`: whole bamboo vessel centred on ivory, soft sunlight and leaf shadows.
- `assets/aloe.webp`: matching vessel with aloe leaves and droplets on a sage background.
- `assets/argan.webp`: matching vessel on warm almond with argan nuts and branch.
- `assets/refill.webp`: bamboo vessel beside a thin transparent PET insert with pale liquid and partially peeled film seal; explicitly avoid an opaque black insert.
- `assets/forest.webp`: lush green bamboo forest with morning sunlight.

Prompts specified photorealistic luxury product photography, natural materials, no third-party branding, and concept packaging engraved only with bamboo/shampoo. These are artistic renderings, not documentary product photographs. The refill diagram is original HTML/CSS, simplified for explanation.

Cormorant Garamond and Manrope are distributed under their included Open Font Licenses in `assets/`. The favicon and interface graphics are original SVG/CSS.
