# A continuous Bamboo Shampoo journey

Research and source audit: 13 October 2026. Scope: the supplied reference sites, the existing shop source, and a native-scroll shopping journey with short, returnable detours. This document is a design decision record, not a claim that award-winning interaction increases sales.

## What was verified

The references were read through their live primary pages, accessible controls/content, and creator-authored case studies. The coordinating agent also interactively checked Charles Leclerc's Training detail in Chrome; that observation is identified below. No reference was interactively driven on a phone during this research. Consequently, a control visible in a page is evidence that the control exists, not proof of its exact animation, focus handling, performance, or return-position behavior. Canvas-only experiences are identified as such. Current live versions may differ from their 2025 award entries.

[CSS Design Awards’ 2025 results](https://www.cssdesignawards.com/blog/2025-website-of-the-year-winners/430/) were published on 12 February 2026. The [2025 gallery](https://www.cssdesignawards.com/woty2025) establishes the intended references and creators. Awards evaluate design; the supplied sources do not publish controlled conversion results for these experiences.

## The reference patterns

### Dropbox Brand — motion with a job

**Primary observation.** The [live brand system](https://brand.dropbox.com/) has clear subject navigation. Its [framework](https://brand.dropbox.com/framework) organizes the brand around humanity, clarity, action, and delight. Its [motion guidelines](https://brand.dropbox.com/motion) explicitly connect motion to simplicity, understanding, immediate feedback, and small moments of play. The motion page contains interactive examples and a cubic-bezier easing example, rather than merely a decorative showreel.

**Transfer to Bamboo.** Each movement should either expose construction, explain use, preserve continuity, or confirm an action. Selecting Aloe must immediately update the selected control and price context, even while the product lighting settles. Opening a detail should visually come from the current chapter; closing it should reconnect to that chapter. A fluid transition is a supporting explanation, not a loading gate for a purchase button.

**Limit.** This is a brand-guideline system, not an ecommerce checkout. Its easing example is a reference for coherent motion grammar, not a universal timing prescription.

### Charles Leclerc — chapters and optional depth

**Primary observation.** [Charles Leclerc’s live site](https://charlesleclerc.com/en/) exposes a chapter control and five named driver-story chapters. “Life as a driver” presents Training, Preparation, Racing, and Off Season details; close controls and separate scroll/swipe instructions are present in the document. The retail store is a distinct external destination. [Apart’s project account](https://apart-collective.com/works/charles-leclerc/) describes an information architecture, driver-page rhythm, a separate more fluid personal journal, and custom condensed typography; animation is credited to Uprising.

**Transfer to Bamboo.** This is the closest structural reference for a clear main path with optional depth. Use a compact chapter index and short product/material/refill panels. A visitor should be able to inspect the cap, close that view, and resume the peel sequence at the same position with the same fragrance selected.

**Interactive observation.** The coordinating agent opened Training in Chrome after declining optional cookies. It presented a near-full-screen dark detail scene with a top-right close control, training copy/photo, and its own exploration instruction. The URL remained `/en/`; the story used managed containers rather than ordinary window scroll.

**Limit.** Exact preservation of scroll position and browser history was not established. Several hidden overlays remained exposed in the reference's accessibility tree. Our native dialog and strictly hidden inactive panels should preserve the visual branching idea while providing clearer semantics.

### Bruno Simon — agency, input clarity, and recovery

**Primary observation.** The [current live portfolio](https://bruno-simon.com/) provides explicit desktop, touch, and gamepad controls, an interact action, an unstuck action, respawn/reset, a quality option, and a renderer option. Its touch instructions distinguish movement from camera/zoom gestures. The site’s own technical description identifies Three.js, TSL, Rapier, and Howler and links source material.

**Transfer to Bamboo.** The object can be playful while remaining controllable. State which gesture does what. A reset-view control is a useful recovery mechanism, especially in inspection mode. A failed or slow 3D view must leave a complete poster and usable shopping interface.

**Limit.** This is a game-like portfolio, and the current version may differ from the 2025 award version. Driving, discoveries, or an entrance challenge should not become compulsory steps before a €12.50 purchase. Renderer controls are not evidence of a particular phone frame rate.

### Exat — the product is the demonstration

**Primary observation.** The [Exat typeface site](https://exat.hottype.co/) combines a story about the typeface with subject navigation, a type tester, size/line-height/spacing controls, character coverage, and a visible “Get Font” purchasing route. The demonstration is the actual product, not an unrelated animation.

**Transfer to Bamboo.** Every interactive detour should answer a specific product question: how the film peels, where the PET flange rests, what stays after a refill, or how the flexible silicone top doses. Keep a direct purchase action available while a visitor explores. The chosen scent and format should survive movement between the demonstration and purchase panel.

**Limit.** The control surface is verified from the page. This research did not measure its live input latency or mobile gesture behavior. Typeface-specific controls should not be copied as arbitrary shampoo configurators.

### ComPsych — a stable overview with deeper rooms

**Primary observation.** The [ComPsych brand hub](https://compsych.konpo.co/) uses a repeated six-topic navigation and obvious routes into deeper brand content. Color controls include a copy-feedback state. [Konpo’s own project presentation](https://www.konpo.studio/) identifies the hub as a consistency tool and describes the blue/ripple visual language.

**Transfer to Bamboo.** Optional depth should have stable names and a consistent entry/return mechanism. A material panel, FAQ panel, and product panel should feel like different rooms within one product system, rather than unrelated page redesigns. Feedback should confirm the actual action.

**Limit.** Brand governance is a different task from shopping. The hub supports topic scanning; it does not establish that every visitor benefits from a forced linear story.

### Bürocratik — a recognizable voice across varied content

**Primary observation.** The [live agency site](https://www.burocratik.com/) has strong typographic personality, explicit open/close menu controls, named project destinations, service groups, and a separate retrospective story. Its portfolio remains identifiable even though the projects differ.

**Transfer to Bamboo.** Keep the approved condensed type, lavender/ice/coral worlds, and real product as the visual signature. The journey can vary in scale and camera distance without introducing unrelated visual themes. Navigation and detail labels remain quiet and readable.

**Limit.** This is an agency portfolio. Its project variety and retrospective are not templates for a small product catalogue. The accessible page alone does not establish its WebGL architecture or mobile performance.

### Symphony of Vines — named chapters, causal storytelling, and a skip

**Identity and primary observation.** The supplied award entry resolves to [The Symphony of Vines by Unseen Studio](https://symphonyofvines.unseen.co/). It is an experimental cinematic experience with an entrance action, four named geological chapters, chapter-specific cursor/press-and-hold instructions, a chapter index, a skip action, and a restart at the end. The narrative explains an origin through successive causes.

**Transfer to Bamboo.** Use physical causality: closed product → cap removal → film peeling → dosing → replacement. Pair a named chapter with what is happening now. Provide a way to move directly to fragrance choice and a clear continuation after inspection. The physical animation is the story, so surrounding text can stay short.

**Limit.** The accessible page verifies the instruction and navigation structure, not exact scroll scrubbing or playback behavior. The whole reference should not be described as scroll-controlled without observing it. An entry gate and forced cinematic length would add friction to this shop.

### Monolith — transitions as a composable system

**Identity and creator evidence.** The actual experience is [The Monolith Project](https://themonolithproject.net/), whose canvas interface was not readable through the web tool. [Ethan Chiu’s technical account](https://tympanus.net/codrops/2025/11/29/building-the-monolith-composable-rendering-systems-for-a-13-scene-webgl-epic/) explains thirteen scenes, reusable materials/particles, and scene-transition materials. Two scenes can be rendered separately and blended by progress; the article describes zoom, masks, and radial transitions. It credits a multidisciplinary production team.

**Transfer to Bamboo.** Model transitions as explicit states with continuity, rather than independently revealing sections. The same chosen product can change pose, scale, and lighting as the main journey advances. Use modular, reversible scene updates so scrolling backward reconstructs the same physical state.

**Limit.** Rendering two full scenes is a performance cost, not a free visual upgrade. A thirteen-scene architecture would be disproportionate here. The shop already has a working Three.js model; a framework rewrite is not justified by this reference. The account describes skilled authored production, not a single AI prompt.

### Merouane Bali — deliberately different mobile structure

**Identity and creator evidence.** The 2025 reference is [merodev.net](https://merodev.net/), not the creator’s older Netlify portfolio. Its canvas surface was not readable through the web tool. [Merouane Bali’s own production account](https://tympanus.net/codrops/2025/01/21/the-journey-of-creating-a-3d-portfolio/) describes Blender/Three.js object-based desktop exploration, navigation cues, and a deliberate mobile alternative: an interactive 3D header with a more traditional content body. Small screens, performance, and unreliable connections informed that decision.

**Transfer to Bamboo.** Mobile should preserve the product’s character while simplifying its surroundings. Keep a generous interactive product view, then use concise native content and internally scrolling detail panels. Recompose the camera and controls for the phone instead of reducing every desktop measurement.

**Limit.** The creator’s stated architecture is evidence; this research did not benchmark the live phone version. The reference is free exploration rather than a proof that a scroll-driven checkout journey converts better.

### Lacoste Members Experience — customization connected to a real choice

**Identity and creator evidence.** The primary experience is [membersexperience-create.lacoste.com](https://membersexperience-create.lacoste.com/). [Merci-Michel’s exact project page](https://www.merci-michel.com/projects/lacoste-members-experience/) confirms that identity, describes personalization, and credits UX/UI, art direction, motion graphics, functional prototyping, and technical development. The distinct older “Draw it yourself” project is not this reference.

**Transfer to Bamboo.** A visual interaction should produce a useful choice. Changing fragrance should change the real product context in the viewer, purchase form, refill choice, and bag. Inspection controls can explain the exact cap and refill rather than inventing unapproved product customization.

**Limit.** The live canvas returned no readable interface. Specific drawing tools, persistence architecture, render stack, or phone performance are therefore not verified here and are deliberately not claimed. Public award placement does not establish purchase conversion.

## The existing shop: strengths to retain

The audit before journey changes used `scripts/shop-pages.mjs`, `assets/app.js`, and `assets/style.css`.

- The homepage has a recognizable full-screen product composition, three fragrance worlds, actual source-approved geometry and engraving, readable prices, and a real reversible physical ritual.
- Native page scrolling is already retained. Scenes are mounted near the viewport, and the runtime uses requestAnimationFrame for scroll updates.
- Cart selections persist in session storage. Direct localized product, shop, refill, story, and FAQ routes exist.
- Reduced-motion/static ritual content includes all five written steps. A render failure can become a static ritual. Browser back/forward cache handling remounts viewers.
- The purchasing interface clearly remains a preview: there is no live payment/order integration to misrepresent.

These are useful foundations. A new journey should coordinate them, not replace a correct product with generated substitute geometry or discard working commerce hooks.

## Ranked gaps and changes

| Priority | Source-backed gap before this change | Proposed result | Acceptance check |
| --- | --- | --- | --- |
| P0 | Home is hero → collection → reusable shell image → ritual → FAQ. Product understanding comes after product choice, and the path has no named chapter state. | One main sequence: Discover → Construction → Use/refill → Choose → Questions, with a compact native-anchor chapter index and a direct skip to Choose. | Scroll both ways; active chapter follows viewport; anchor destinations remain useful without JavaScript. |
| P0 | Hero/product/refill/material links leave the current route. BFCache recovery is not an explicit detour contract. | Short closeable product, materials, refill, questions, and inspection panels keep the current chapter behind them. | Open while half-way through peeling; close, Escape, and Back return to the same chapter, progress, scroll position, and trigger focus. |
| P0 | Fragrance-world selection changes only the local hero scene/copy. Product scent navigation is a route change. | Shared scent/format state follows the object, detour form, refill choice, and buying action. | Choose Aloe in the hero, inspect the insert, choose refill, add it; bag reads Aloe/Refill/€4.50 and closing resumes the Aloe chapter. |
| P1 | The same long ritual appears independently on several routes. | The main path has one purposeful physical chapter; deeper inspection is optional and resumable. Direct routes remain independently complete. | A buyer can jump to Choose at any time; an explorer can open inspection without restarting the main ritual. |
| P1 | Several mobile action labels are 7–10px; desktop sticky minimum heights can exceed a short landscape viewport; the mobile ritual-height rule can override static mode. | Readable action labels, 44px controls, phone-specific panel camera area, and explicit reduced-motion/short-height overrides. | 320/390/430px portrait, short landscape, enlarged text, and reduced motion expose every step/action without trapped sticky content or horizontal page overflow. |
| P1 | Native scroll, product dragging, and full-screen pinch have different ownership but little shared context. | Normal page keeps native vertical scroll; inspect mode clearly owns drag/pinch/zoom and offers reset. | A vertical swipe over the normal product continues the page; inspection zoom/rotation works, closes safely, and does not move the background chapter. |
| P1 | Detail routes are shareable, but journey continuity is not serialized. | Real href fallbacks remain; optional history/state supports Back and return without breaking direct landing pages. | New tab, refresh, copied PDP URL, and unavailable storage still give a full usable product page. |
| P2 | Scene mounts are deferred, but adding several detail viewers could multiply active GPU contexts. | Mount only the open detour, suspend offscreen viewers, retain transparent source-model posters, and preload only the likely next chapter. | Rendering unavailable/slow does not hide price, format, answers, or Add to bag; closed panels contain no running interaction. |

## The journey contract

The homepage is the continuous path; the dedicated routes remain direct-entry destinations. Native anchors supply a usable baseline. A detour saves the origin chapter, its local progress, page scroll position, focus target, selected scent, and selected format. The background is fixed while the dialog’s body scrolls. Closing through every supported route restores that origin; it does not reset the physical ritual. A nested detail switches the panel inside the same dialog rather than stacking modals.

The main route is a finite shopping narrative. The previously approved full-screen physical animation can keep its endless loop separately. A looping animation should not make the shopping journey itself endless: choosing and reviewing a bag need a clear arrival.

Keep detail copy brief and factual. Construction concerns bamboo, silicone, PET, flange, seal, and retained parts. Ingredient availability belongs in the product/FAQ detail, not a decorative pseudo-scientific claim. Preserve the original engraving, 250 ml label, three fragrance names, €12.50 product, €4.50 refill, and legal content.

## Mobile and motion rules

1. Maintain native scroll and browser pinch on normal shop pages. Camera interaction is optional. The dedicated inspect surface may own camera pinch, with explicit zoom/reset buttons as alternatives.
2. Put chapter navigation below the header once the visitor leaves the hero; do not add a second large bottom dock competing with a purchase action.
3. In a phone detour, the initial gallery occupies at most roughly half the usable viewport. The chosen scent, format, price, return control, and purchase form remain close together.
4. Make readable controls the constraint. Prefer shorter text or wrapping to 7px action labels. Use visible focus and native dialog keyboard semantics.
5. Treat scroll position as the physical state’s input. Smooth camera/material settling may add polish; it must not make the narrative lag so far that the active text describes the wrong assembly state.
6. On reduced motion or failed rendering, show every written step in normal flow, with no sticky minimum height or inert/hidden panel that removes necessary information.
7. Verify on real devices before asserting smoothness. Primary reference pages and source inspection cannot establish our FPS, memory use, or gesture latency.

## What the references imply about AI production

The creator accounts demonstrate scoped interaction design, authored models/assets, modular rendering, functional prototypes, mobile alternatives, and repeated usability work. They do not substantiate “one prompt produces this finished shop.” AI can assist at each stage, but the useful production pattern is specification → component/state contract → implementation → visual and interaction checks on target sizes → revision. For this shop, the correct approved model and a tested return path are more valuable than adding another spectacular but disconnected scene.

Research ownership: primary-source comparison and initial source audit. Implementation validation, mobile screenshots, and interaction tests are separate evidence to be recorded after changes.
