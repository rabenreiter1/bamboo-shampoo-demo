# Bamboo Shampoo: AI design research and build playbook

Research date: 13 October 2026. This is a development brief, not public shop copy.

The practical finding is that impressive AI-assisted sites come from a concrete art direction, subject-specific assets, explicit motion choreography, and repeated inspection of the rendered result. A longer adjective-heavy prompt, another animation library, or more agents alone does not establish design quality. The shop should make the approved bamboo product and its refill mechanism the memorable visual idea, while making scent, format, price, and the bag easy to use.

## What the primary sources establish

### Codex: composition, reference fidelity, and complete experience

OpenAI's March 2026 frontend guide recommends a single strong first-screen composition, an unmistakable brand/product, dominant imagery, a limited hero content budget, and motion that strengthens hierarchy. It rejects decorative hero badges, unnecessary cards, and competing content. Applied here: replace the rejected inset product ellipse, stamp, and several competing text blocks with a unified campaign scene containing the actual product and the Bamboo identity. This source discusses GPT-5.4; its model-specific reasoning recommendation is not a reason to change this project's model. [Designing delightful frontends](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4)

OpenAI's reference-to-frontend workflow asks for desktop, mobile, selected, hover, loading, and empty references, then real-browser comparison and iteration. It recommends translating the target into the repository's canonical components and tokens. Applied here: preserve the functioning static routes, bag state, approved component factories, and legal fragment; use screenshots to judge the redesigned composition instead of replacing working architecture to imitate a fashionable stack. [Build responsive front-end designs](https://learn.chatgpt.com/use-cases/frontend-designs)

The Codex prompting guide encourages purposeful type, a committed visual language, meaningful motion, and a complete working desktop/mobile result. This supports a distinctive shop rather than a generic component demonstration. [Codex Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide)

The September 2026 Astra guidance warns that accumulated skills and oversized recipes can consume context or conflict. It recommends task-specific guidance, progressive disclosure, and defining completion to include running, inspecting, and fixing the implementation. Applied here: use a compact creative brief and a separate evidence-based critique; do not install every community animation skill or import incompatible pinned runtimes. [Rethinking skills and prompts](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)

### Claude: avoid convergent aesthetics and separate generation from judgment

Anthropic's current public frontend skill derives design choices from the subject, uses type as an active compositional element, and concentrates boldness in one memorable feature. It specifically identifies warm cream with contrast serif, isolated italic headline words, repetitive labels, card kits, and indiscriminate fade-up animations as common generated defaults. It also identifies black plus an acid accent as another convergence. Applied here: changing ivory to black or swapping fonts is insufficient; the refill construction must shape the composition and behavior. [Anthropic frontend-design source](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)

The official aesthetics cookbook demonstrates a prompt that separately directs typography, color, motion, and atmosphere, rather than merely asking for a premium website. It reports more varied output with that guidance. It is a useful baseline, not a guarantee of a distinctive shop. [Frontend Aesthetics cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb)

Anthropic's March 2026 harness article documents planner, generator, and evaluator roles. Its evaluator uses a live browser and critiques design, originality, craft, and functionality. Independent skeptical evaluation helps counter the builder's tendency to approve mediocre work. The article describes multiple refinement rounds and occasional conceptual pivots; later iterations were not always the author's favorite. Applied here: preserve the best visual iteration and reject a technically passing but unconvincing design. [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)

The earlier long-running harness uses an explicit feature list, incremental changes, progress artifacts, and browser testing to prevent premature completion. Applied here: retain a compact route/interaction matrix and check the full fragrance-to-bag-to-review path after visual work. [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

### Comparable builds with documented AI workflows

| Build | Documented method | Useful lesson for Bamboo |
| --- | --- | --- |
| [Forged in Silence](https://developers.openai.com/showcase/forged-in-silence) | Codex scaffold, procedural Three.js geometry, repeated lighting/material passes, Lenis/GSAP scroll timeline, responsive camera/DPR, then storefront pages and cart | Treat geometry, cinematography, choreography, and commerce as distinct work. The published account is iterative, not a one-prompt miracle. |
| [Kiln](https://developers.openai.com/showcase/kiln) | Catalog and local bag around one interactive cup; several passes corrected believable structure, glaze detail, reflections, grounding, and resolution | One accurately rendered physical object can carry the signature. Keep the purchase interface familiar. |
| [Scent Cartography](https://developers.openai.com/showcase/scent-cartography) | Fragrance catalog plus a live scent interaction; the direction and botanical construction changed across critique rounds | An interaction can be specific to the product, and a promising first direction can still require a major pivot. Do not add a fictional scent configurator to Bamboo's three fixed fragrances. |

These are published build accounts and demos. They establish approaches and outputs, not audited commercial conversion rates, sales success, or proof that every asset and decision came solely from AI.

### Firsthand community recipes: use selectively

The cross-tool cinematic workflow by `amrrs` packages a demo and guidance for Codex, Claude Code, and Cursor. Its useful pattern is a precise brief: identity, sections, asset paths, transforms, motion ownership, and responsive rules. It couples generated media with Three.js/GSAP when suitable. Its pinned Three.js 0.136 recipe is unsuitable for wholesale adoption in this existing r186 project. [Cinematic workflow](https://github.com/amrrs/cinematic-webscroll-frontend-skill) · [Published prompts](https://github.com/amrrs/cinematic-webscroll-frontend-skill/blob/main/docs/prompts.md)

`tsogjavklann/awwwards-3d` supplies working object, glass, and camera-path templates with damping, lighting, post-processing, and cleanup patterns. Take those implementation concerns as a review checklist, not its claim that a fixed style or stack produces an award. Retain the project's compatible local vendor version. [3D templates and workflow](https://github.com/tsogjavklann/awwwards-3d)

`gabremoku/immersive-3d-web` documents its own failure: unrelated briefs converged on the same floating primitive. Its correction is to derive form and motion from the actual subject. Applied here: the existing approved product is already the right hero object. Floating torus decorations, arbitrary particles, or a generic glossy blob would dilute it. [Firsthand concept-to-form correction](https://github.com/gabremoku/immersive-3d-web/blob/master/reference/concept-to-form.md)

No community skill was installed. Their source documents were read as research. Their imperative instructions do not override this project's requirements.

## Applied creative direction

The following is a project-specific design proposal inferred from the research and the user's feedback, not a prediction of a universal 2027 trend.

**Concept: a refillable object worth keeping.** Make the bamboo cylinder, emerald silicone cap, coral grapefruit liquid, and clear refill visually tangible. A large integrated product scene and an unusually confident Bamboo type composition should establish identity before the first scroll. Product photography should feel like campaign photography with coherent light, scale, and shadows, rather than a stock image placed inside an ornamental shape.

The chosen direction is an immersive lavender and ice-blue world with grapefruit-coral moments, a giant condensed sans composition, and the approved product centered as the visual anchor. Warm organic wood against precise silicone/PET construction and luminous grapefruit shampoo provides the product-specific contrast. The light and ground must make this feel like a coherent campaign world rather than a purple gradient behind unrelated UI. Use restrained utility typography and purposeful spacing around that single statement. Test the palette against the actual renderer output, not color swatches alone.

Barlow Condensed Bold 700 is a practical self-hosted display candidate. Google Fonts' official metadata identifies the family, designer, weight, and OFL license. The official CSS response for `family=Barlow+Condensed:wght@700&display=swap` provided the [Latin WOFF2 asset](https://fonts.gstatic.com/s/barlowcondensed/v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2z3bWuQ.woff2), whose declared range includes German umlauts, ß, and the euro symbol. Copy the accompanying copyright/license into the distributed font assets. This is a genuinely condensed design; avoid horizontally scaling an ordinary sans to imitate it. [Google Fonts metadata](https://github.com/google/fonts/blob/main/ofl/barlowcondensed/METADATA.pb) · [OFL license](https://github.com/google/fonts/blob/main/ofl/barlowcondensed/OFL.txt)

Page jobs:

- **Home:** establish Bamboo and the physical product in a single scene; make the set and refill proposition clear; move into scent choice, the refill ritual, and a concise material story.
- **Product detail:** the product is the largest visual anchor; scent/format selection and the correct price remain clear. Close-up views explain the cap and PET rim without adding a second competing experience.
- **Refill:** lead with the transparent, sealed refill and coral contents. Scroll shows opening, dosing, and replacement; a refill selection is available without requiring the visitor to finish the film.
- **Collection:** show the three actual fragrances and two actual formats. The imagery and layout feel like the same campaign, while filters and selection remain ordinary and usable.
- **Bag/review:** quantities, format, fragrance, and totals are explicit; interaction feedback is immediate. Preserve the clearly identified GitHub Pages preview with inactive ordering.

Do not invent testimonials, awards, ingredients, efficacy, environmental statistics, stock urgency, shipping promises, or discounts to make the page appear commercially mature. Original engraving, logo artwork, component geometry, prices, volume label, and legal source are fixed constraints.

## Motion and fluid specification

Use one normalized playhead for each scene. Give camera, model, copy, and material changes clear ownership; do not let multiple smoothing layers independently control the same variable. GSAP's numeric scrub continues the animation after input stops, and its documentation advises updating dependent presentation from the animation's update rather than only the scroll event. This is the same synchronization concern as the approved inertial ritual. [ScrollTrigger documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)

If a smooth-scroll library is introduced, configure anchors, nested dialogs, reduced motion, and one render clock deliberately. Lenis documents each of those concerns and warns about iframe and some touch limitations. Adding it by default is not necessary when native page scroll plus the existing damped scene already meets the desired behavior. [Lenis documentation](https://github.com/darkroomengineering/lenis)

Three.js physical materials support transmission, thickness, absorption color/distance, IOR, clearcoat, and environment reflections. They cost more per pixel as features are enabled. Use this to improve gel/PET optics, not just opacity or a painted cylinder. Material parameters are art-directed approximations unless measured product data exists. [MeshPhysicalMaterial documentation](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)

Project acceptance for the requested grapefruit liquid:

- A translucent coral/pink body of shampoo fills the interior; the thin PET wall is separately legible and remains clear.
- Headspace and a connected liquid surface are visible in the refill. Tilting should make the surface respond to gravity rather than stay glued perpendicular to the tube.
- The outlet stream emerges from the actual opened port. It has a coherent viscous neck, plausible narrowing, specular highlights, and restrained droplets. It must not look like uniformly spaced beads, a rigid tube, or a ribbon clipped into the cap.
- No stream before opening; no flow when the container is upright/empty; no material teleportation at the transition.
- A deterministic scroll position gives a deterministic liquid state when scrubbing backward. Prefer a carefully choreographed approximation or a baked simulation when real-time simulation would break reversibility or mobile performance.
- Collision and fluid edge cases are checked at the maximum tilt, open/close boundaries, container removal, and cycle seam. A beautiful still frame does not establish believable motion.

Only claim a full fluid simulation if one is actually implemented. Evaluate the rendered result against the user's requested realism; describe an optical/procedural approximation accurately in development notes.

## Working prompt for the builder

```text
Rebuild Bamboo Shampoo as an immersive, contemporary product campaign with a usable bilingual storefront. The previous warm-ivory serif shop was rejected for feeling dated and generic. Preserve existing routes, cart behavior, prices, legal fragment, exact approved geometry, cap construction, and original engraving SVG.

Core idea: a refillable object worth keeping. Use the actual bamboo/emerald-cap product as the dominant central hero, with luminous grapefruit-coral shampoo and transparent PET. The chosen world is immersive lavender/ice blue with coral moments and giant condensed sans typography. Compose the first screen as one visual world. Bamboo must be unmistakable without reading navigation. Use typography as composition, coherent campaign lighting, deliberate negative space, and one primary action. Remove decorative badges, generic pills, arbitrary orbital shapes, and competing hero metadata.

First create a short design contract: palette, type roles, desktop/mobile composition, route jobs, asset plan, and 2-3 signature motions. Compare two genuinely different compositions and choose the strongest against the user reference evidence. Do not confuse a palette change with a new concept.

Build home, fragrance detail, collection, refill, story, FAQ, and bag/review as one consistent experience. Keep scent/format/price explicit. Aloe, Argan, Bamboo. Set 250 ml €12.50; refill 250 ml €4.50. Do not invent proof, shipping policies, product claims, or transactions.

Integrate the approved ritual through a single reversible scroll playhead. Coordinate camera, product, fluid, and copy. Improve coral gel optics and viscous flow without changing the physical parts. Keep the standalone animation accessible separately. Keep buying tasks usable without completing scroll cinema.

Inspect rendered pages at desktop, short desktop, portrait mobile, and narrow mobile. Check selected, hover, loading, WebGL-fallback, reduced-motion, menu, empty bag, mixed formats, quantities, locale switching, and navigation. Iterate on screenshots as well as behavior. Continue until the route/interaction contract and independent visual critique pass. Preserve the strongest iteration. Publish on the existing GitHub.io preview only.
```

## Independent critique and quality gate

Use a separate evaluator with current screenshots and reference evidence. It should not know which agent built a view and should not infer visual quality from the count of automated tests. Ask it for the three largest concrete visual defects, their location, and a proposed remedy before it scores the work.

Project scoring is intentionally weighted toward the dimensions that failed in the user's review. The weights and thresholds below are this project's proposal, not published benchmarks.

| Dimension | Weight | Concrete question |
| --- | ---: | --- |
| Identity and composition | 30% | Does the first screen read as one distinctive Bamboo campaign with an unmistakable actual product? |
| Originality and relevance | 25% | Do layout and motion emerge from the bamboo/refill mechanism, or could the same screen sell any unrelated product? |
| Material and motion craft | 20% | Are PET, wood, silicone, gel, peeling, port opening, liquid flow, and scene transitions convincing in motion? |
| Shopping clarity | 15% | Can a visitor choose a fragrance and format, understand the price, add it, and edit the bag without guessing? |
| Responsive and accessible execution | 10% | Does the composition survive narrow/short viewports, keyboard, reduced motion, loading, and unavailable WebGL? |

A candidate needs an overall 8/10 and no dimension below 7/10 before final publication. Functional correctness, exact product geometry/artwork, correct totals, readable controls, and absence of major runtime errors are hard gates independent of that score. Keep screenshot evidence, not just an approval statement.

Evaluator prompt:

```text
Act as a skeptical creative director and shopper. Inspect the live home, one product page, refill, collection, and bag on desktop and portrait mobile. Compare against the supplied reference evidence and the Bamboo creative contract. The previous version was technically complete but visually rejected, so passing tests is not evidence of taste.

First identify the three largest specific defects. Explain what makes each screen look generic, dated, incoherent, or physically unconvincing. Then score the five rubric dimensions independently. Avoid rewarding complexity, animation quantity, or giant type alone. Exercise the shopping path and reversible ritual. Flag any unsupported product claim or changed geometry/artwork. Recommend refine or pivot, with concrete changes. Do not approve merely because a proposed fix sounds plausible; inspect the rendered fix.
```

Performance targets are LCP ≤2.5 seconds, INP ≤200 ms, and CLS ≤0.1 at the 75th percentile, measured separately for mobile and desktop once field traffic exists. Local lab checks can catch regressions but do not establish field compliance. For this preview, prioritize an immediate coherent poster, no layout shift, responsive controls during shader warmup, capped/adaptive render resolution, and idle suspension. [Web Vitals](https://web.dev/articles/vitals)

Respect reduced motion for nonessential interaction animation and parallax; expose the same product information and purchase actions in the quieter presentation. WCAG's interaction-animation guidance allows disabling that motion and distinguishes essential information from decoration. This is a quality floor, not a substitute for visual design. [W3C animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

## Evidence limits

The parent agent directly inspected both references in native Chrome. The first reel, by hanzife, presents a pink, full-bleed fashion hero: a central jacket model, oversized “THE JACKET COLLECTION” type on the left, and a floating garment on the right. A later white product view places “CUT ONCE / WORN FOR YEARS” left, a full-body model centrally, and a quiet configuration area right. Its “Master Shopify Templates” caption did not establish AI authorship. Apply its scale, subject hierarchy, and calm purchasing area to Bamboo; do not copy a garment layout mechanically. [First reference reel](https://www.instagram.com/reel/DdjLsxnsbfW/)

The second reel, by by.flowww, shows a full-bleed elevator/walking-film sequence with “SUMMIT / FLOOR 34,” followed by a garment hero with enormous type behind the subject. Its caption attributes architecture and component code to ChatGPT Astra and visual/motion assets to Higgsfield. That is the creator's firsthand claim, not an independently inspected repository, deployment, production-performance result, or proof of sales. Its useful lesson is coordinated art direction across film, typography, and interaction rather than the mere presence of cinematic effects. [Second reference reel](https://www.instagram.com/reel/DdLCb5oyhYZ/)

Documented AI showcases establish that comparable interactive work is possible, but their precise visual choices should not be copied into Bamboo without a product-specific reason. Neither these showcases nor the reference reels establish commercial success or conversion gains. Future-facing design is the creative brief; no source verifies a universal “2027 website style.”
