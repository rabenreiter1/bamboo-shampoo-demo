# Fullscreen product ritual

The `/assembly/` approval page now contains only the product animation. The shop redesign stays paused. GitHub Pages continues to publish `main/docs`; no domain or DNS is connected.

## Source contract

The bamboo contour is taken from the current actual 250 ml drawing, not a backup drawing. Body dimensions remain H170 / OD58 / bore48 mm. The PET insert remains OD47 × H165 mm with an OD58 flange, radial width5.5 mm. Nominal content is250 ml.

The entire original engraving is unchanged, including its lettering, logo, fragrance and250 ml marking. SHA-256: `67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa`.

The operative cap uses the approved current top-view contours, including the teardrop actuator, circular outer bearing, two linked discs, lettering and original logo. Its upper OD59 / bore58, lower seat OD58 / bore57 and radial wall0.5 mm are retained. The historical OD65 STL generation is not used. Image-derived outlines retain approximately0.06 mm pixel precision; the tube raster contour has approximately0.21 mm precision. This is a product visualization, not a replacement for production CAD.

## Choreography and inspection

| Scroll | Product action |
| --- | --- |
| 0–6% | Closed retail product: full250 ml insert, intact film, cap on, nipple closed |
| 6–15% | Complete cap lifts vertically clear of the collar, then parks beside the product |
| 15–27% | Pull tab unfolds; bonded film stays flat while released film curls, peels and exits |
| 27–35% | Complete cap returns and seats |
| 35–42% | Stopper lifts; circular bearing swivels110° around the center actuator |
| 42–49% | Product tilts135°; gel starts flowing only once the outlet points down |
| 49–54% | Steady glossy gel stream |
| 54–59% | One button press, pressure gush, release and steady flow again |
| 59–66% | Remaining content drains, stream tapers, final drops follow |
| 66–72% | Product straightens, ring swings home, nipple reseats |
| 72–90% | Cap comes off; empty PET clears the rim before moving away; fresh sealed PET arrives, aligns and lowers |
| 90–96% | Complete cap returns over the intact new film |
| 96–100% | Same factory-sealed product state as the start |

The approved factory-sealed ending deliberately leaves the replacement film intact. A second peel would end in a different physical state. The cap's three parts remain connected throughout; only their confirmed operational movements occur.

The document spans ten viewport heights. Scroll and vertical dragging move the timeline both ways; there is no autoplay. Horizontal dragging adds persistent axial rotation. Pinch or trackpad Ctrl-wheel zooms0.6–3× and leaves timeline progress unchanged. Gestures lock after8 px and rebase when fingers join, leave or cancel. Viewport changes preserve the normalized stage and inspection state, including browsers which emit scroll before resize.

A gentle authored revolution is distributed across the cycle, held during pouring. The model hierarchy applies product tilt before longitudinal-axis yaw. The stream lives in world coordinates and begins at the transformed outlet, so user inspection never rotates gravity with the bottle.

## Implementation responsibilities

- Closure agent: operative cap, circular hidden bearing, flexing linked stopper, outlet, button stroke and mechanism tests.
- Material-effects agent: continuous membrane deformation, fill volume, analytical gel stream and deterministic droplets.
- Fullscreen/input agent: page shell, pointer arbitration, pinch, wheel handling and gesture tests.
- Integrator: pure timeline, scene hierarchy, lighting, continuous camera framing, source integrity, independent integration audit, browser QA and deployment.

`ritual-timeline.js` maps one normalized progress value to every pose and effect value. Identical progress and inspection inputs reproduce identical geometry in either direction. The viewer renders only when an input or resize changes; a stationary timeline freezes the gel and foil too.

Foil deformation uses an isometric3 mm bend followed by a rising120° tail. Attached vertices remain exactly on the flange. Gel uses an analytical, tapered stream with a single3.2× pressure-area pulse and five progress-driven droplets. No elapsed-time solver, random emission or accumulated particle state is involved.

The nominal liquid volume is derived from the modeled23.2 mm inner radius: `250000 / (π × 23.2²) =147.84756 mm` fill height, surface atY153.14756 above the Y5.3 floor. Full-fill geometry uses unit scale so transmission rays have correct physical scale. The thin PET is a transparent reflective overlay over refractive gel, avoiding overlapping transmission-buffer omissions in Three.js.

The camera projects transformed local bounds, anticipates the refill exchange continuously, and lets discarded parts leave the view. No full mesh vertex scan runs on every draw. All runtime code, materials and textures are self-hosted. The static fallback is a screenshot of this exact rendered product; it introduces no alternative geometry or visible UI.

## Provisional dimensions and effect limits

Confirmed outlines and diameters are preserved. Unmeasured internal details remain visual assumptions: PET/flange thickness0.3 mm, film thickness0.08 mm, cap roof clearance0.25 mm, hidden outletØ6 mm, nipple lift1.4 mm, actuator stroke0.55 mm, bearing depths, relief depths and folded tab profile. Current production CAD is needed to certify those details.

Gel tint, viscosity appearance, flow rate and pressure multiplier are authored effects, not fluid measurements. Hidden interior liquid uses an axial volume display during tilt; exterior gel follows world gravity. The previous exploded-study GLB remains an archived asset and does not contain the new procedural membrane/liquid cycle.

## Prompt research

[OpenAI's Codex product-scene example](https://developers.openai.com/showcase/forged-in-silence) documents procedural Three.js geometry, scroll sections and lighting iteration. [The author's Claude cinematic-scroll workflow](https://github.com/zubair-trabzada/scroll-cinematic-claude/blob/main/SKILL.md) gives a structured scene brief for image sequences. Neither demonstrates this exact closure, peel and refill mechanism.

The implementation brief therefore specifies approved meshes, a normalized reversible timeline, operational clearance, a deforming bonded membrane, world-gravity gel, independent inspection controls and forward/reverse geometry checks. Published prompts are research material, not instructions executed in this repository.

[Three.js BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html) supports the membrane deformation; [MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) supplies the gel's refraction. [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/) and [MDN pinch gestures](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures) inform input arbitration.

## Acceptance and verification

- Original engraving and cap-reference hashes match their supplied sources.
- Real mesh clearances verify foil, folded tab, flange, roof, stem and outlet plug.
- PET and cap clear bamboo before lateral travel.
- Every flowing pose has an open, unsealed, downward outlet, including four manual yaw directions.
- The stream mouth fits the outlet and its vertices clear the bamboo.
- Visible factory-sealed endpoint meshes match within0.00001 mm; reversing returns exact initial vertex arrays.
- 10,001 pure timeline samples are finite and deterministic in both directions.
- Gesture tests cover axis locking, pinch freezing, finger replacement, cancellation, wheel semantics and resize.
- Browser QA covers the sealed pose, actual curled foil, steady flow, single pressure dose, refill removal/insertion and mobile framing.
- Publish scope is limited to the assembly experience and its build/tests/documentation; store pages and domain settings remain unchanged.

### Completed local verification

All 43 automated tests pass, followed by the existing15-page link, asset, language, preview-indexing and domain-isolation checks. Browser review covers the native desktop viewport and390×844 portrait layout, forward/reverse scroll, drag inspection, pressure dose, clear full refill and sealed endpoints. Pinch state transitions and zoom bounds are verified by the gesture reducer/adapter tests; a physical multi-touch device was not available to the browser automation.

Native desktop start/end screenshots are byte-for-byte identical (JPEG SHA-256 `4748f22fe8bfa2961d002fbbc855cef900612d3b1c72aad3f12da70bf1384076`). After viewport resizing in both directions, the measured stage remained0.555556 and manual axial yaw remained1.008 radians, within scroll-pixel rounding.
