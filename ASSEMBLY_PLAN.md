# Scroll assembly review

This is a separate product approval page at `/assembly/`. The storefront and custom domains remain untouched.

## Geometry and source contract

All meshes use millimeters, Y up, and the bamboo tube base at Y0. Every component is a named, independently addressable group.

| Component | Confirmed geometry | Source |
| --- | --- | --- |
| Bamboo tube | Height 170, outside diameter 58, bore 48, top wall 5, upper neck zone 20 | Current actual 250 ml tube drawing |
| Clear PET inlay | Outside diameter 47, body height 165 | User dimensions |
| PET flange | Outside diameter 58, radial width 5.5 | User's confirmed rim correction |
| Peel seal | Separate membrane on flange, removed before cap seating | User photos and mechanism description |
| Outer cap | Upper diameter 59, bore 58, wall 0.5, lower seating ring diameter 58 | Latest correction and current cap reference |
| Dose button | Original teardrop and original engraved logo | Current top reference, contour extracted from its pixels |
| Nipple ring | Circular annulus, linked round closure discs and connecting straps | Current top reference, contour extracted from its pixels |
| Engraving | Complete current original SVG, byte-for-byte unchanged | Current final engraving source |

Nominal fill remains **250 ml**. PET thickness, flange thickness, tube bottom thickness, and the cap's vertical relief are visualization parameters where the source does not give measurements. The review inspector must distinguish these from confirmed dimensions. The old STL cap generation is rejected because its shape and diameter differ from the current reference.

## Implementation responsibilities

1. **Body model agent:** source-derived bamboo outline, hollow bore, clear PET with wide flange, separate seal, realistic exportable wood/engraving maps.
2. **Cap model agent:** current reference contours, separate cap/button/ring meshes, original relief and logo, dimensional and interference audit.
3. **Experience agent:** premium responsive standalone page, lighting, deterministic scroll choreography, inspection controls, reduced motion and exports.
4. **Integrator:** research, source integrity, packaging, independent geometry/browser validation, performance checks, GitHub Pages deployment, live verification.

## Choreography

- Start with a readable assembled product reveal.
- Separate and identify all six physical groups while the root rotates about Y.
- Slide the refill into its actual bore and rest its flange on the bamboo rim.
- Peel the separate seal away before the dosing cap seats.
- Assemble the cap's three parts, then lower the closure into its seating notch.
- Finish on the complete product with inspection controls.

Every position is a deterministic function of normalized progress. Reversing scroll reverses assembly without accumulating transform errors. A scrubber and chapter buttons also allow precise review. Scroll rotation can be paused independently; reduced motion removes smoothing and decorative transitions.

## Acceptance checks

- Original engraving SHA-256 matches source; no substituted glyphs, names, or artwork.
- Actual geometry bounds match 170/58/48, 47/165/58, 59/58/0.5 values.
- Cap collar sits in the measured source notch and does not require altering the bamboo contour.
- Seal leaves the opening before cap seating.
- Six independently addressable component groups exist and exported GLB retains them.
- Scroll/root rotation and individual translations are reversible and finite at all checkpoints.
- Desktop and mobile views render every chapter without clipped parts or obscured controls.
- No browser console errors, broken assets, external runtime dependencies, or blank WebGL frames.
- Reduced-motion and WebGL-error states are usable.
- Existing store pages and CNAME state are unchanged; publish only `/assembly/` and required model/code assets.

## Prompt research and decisions

[The Codex build documented by OpenAI](https://developers.openai.com/showcase/forged-in-silence) describes a detailed scaffold, procedural geometry, lighting iterations and a six-chapter scroll timeline. Its relevant lesson is to specify scene architecture and evaluate separate stages, rather than request a cinematic site in one vague sentence.

[The author's Claude cinematic-scroll workflow](https://github.com/zubair-trabzada/scroll-cinematic-claude) demonstrates a different approach using rendered sequences. That can create an appealing scroll effect, but this review needs inspectable, separate 3D components, so it uses actual meshes.

[A published scroll-driven product implementation](https://github.com/Dieg0arc/3D-scrolling-practice) demonstrates a pinned 3D product scene and rotation synchronized to progress. [GSAP's documented scrub model](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) confirms the useful separation of scroll progress and smoothed presentation. This implementation can use the same progress model with native scroll and requestAnimationFrame without adding a library solely for that mapping.

The project-specific brief given to the modeling and experience agents includes exact dimensions, named parts, source restrictions, deterministic transform contracts, exportable materials and explicit acceptance checks. No downloaded prompt or skill is executed as instructions.

## Completed validation

- Seven automated tests pass, including geometry dimensions, collar clearance, engraving integrity and 1,001 reversible timeline samples.
- The animated GLB contains six named components, 14 animation channels and a 14-second clip, in glTF metres.
- The independent Khronos glTF validator reports zero errors and zero warnings.
- Original engraving SHA-256: `67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa`.
- Exported GLB SHA-256: `e4b6f4a6414956d59789e50a0d71adb3ec44795ef2aab2ba63530afc6511030f`.
- Browser review covers desktop and mobile layouts, scrolling, inspection controls, DE/EN copy and cap-reference access. Undimensioned depths remain visible in the inspector rather than being presented as measured CAD data.
