# Fullscreen product ritual

The `/assembly/` approval page contains only the product animation. The shop now uses the same component factories and choreography through its element-sized viewer, with native page scrolling for the embedded story. GitHub Pages continues to publish `main/docs`; no domain or DNS is connected.

## Source contract

The bamboo contour is taken from the current actual 250 ml drawing, not a backup drawing. Body dimensions remain H170 / OD58 / bore48 mm. The PET insert remains OD47 × H165 mm with an OD58 flange, radial width5.5 mm. Nominal content is250 ml.

The entire original engraving is unchanged, including its lettering, logo, fragrance and250 ml marking. SHA-256: `67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa`.

The operative cap uses the approved current top-view contours, including the integral molded teardrop feature, circular outer bearing, two linked discs, lettering and original logo. The center is part of the silicone cap. Pressing it bends the continuous roof; there is no central aperture or independent plunger. Its upper OD59 / bore58, lower seat OD58 / bore57 and radial wall0.5 mm are retained. The historical OD65 STL generation is not used. Image-derived outlines retain approximately0.06 mm pixel precision; the tube raster contour has approximately0.21 mm precision. This is a product visualization, not a replacement for production CAD.

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
| 54–59% | One broad silicone-roof press, pressure gush, release and steady flow again |
| 59–66% | Remaining content drains, stream tapers, final drops follow |
| 66–72% | Product straightens, ring swings home, nipple reseats |
| 72–90% | Cap parks upper-left; empty PET clears the rim and exits upper-right by82.5%; fresh sealed PET enters83–86%, aligns and lowers86–90% |
| 90–96% | Complete cap returns over the intact new film |
| 96–100% | Same factory-sealed product state as the start |

The approved factory-sealed ending deliberately leaves the replacement film intact. A second peel would end in a different physical state. The complete cap remains together throughout. Its center is integral silicone; only the captive ring and linked closure discs move independently.

The document is one fullscreen viewport. Virtual scroll uses nine viewport heights per cycle and an unbounded signed cycle coordinate, so forward and backward scrolling never reaches a finite endpoint. There is no autoplay. Horizontal dragging adds persistent axial rotation; pinch or trackpad Ctrl-wheel zooms0.6–3× while freezing timeline and spin momentum. Gestures lock after8 px and rebase when fingers join, leave, cancel or the viewport changes.

The product rotates continuously720° per complete cycle, including pouring; authored yaw stays unwrapped across cycle boundaries. Manual spin is additive. Wheel inputs follow an accumulated target with a0.18 s exponential time constant; native trackpad momentum is not duplicated. Pointer release velocities use a60 ms filter, with0.22 s scroll and0.30 s axial-spin deceleration. Fresh contact, pinch, cancellation or backgrounding stops momentum. Reduced-motion preferences remove the optional coasting. RAF timing uses elapsed seconds, sleeps at rest and discards background-tab elapsed time.

The model hierarchy applies tilt before longitudinal-axis yaw. The stream lives in world coordinates and begins at the deformed outlet position and normal, so inspection never rotates gravity with the bottle.

## Implementation responsibilities

- Closure agent: integral silicone cap, continuous roof deformation, circular hidden bearing, flexing linked stopper, deformed outlet and mechanism tests.
- Material-effects agent: continuous membrane deformation, fill volume, analytical gel stream and deterministic droplets.
- Fullscreen/input agent: page shell, pointer arbitration, pinch, wheel handling and gesture tests.
- Integrator: pure timeline, scene hierarchy, lighting, continuous camera framing, source integrity, independent integration audit, browser QA and deployment.

`ritual-timeline.js` maps the fractional part of an unbounded cycle coordinate to every pose and effect value. Identical cycle and inspection inputs reproduce identical geometry in either direction. Quintic movement transitions have zero velocity and acceleration at rest. The viewer renders during input/coasting and viewport changes; a settled timeline freezes gel and foil too. The sealed seam changes equivalent refill identities inside the closed product while camera and physical pose remain continuous.

Foil deformation uses an isometric3 mm bend followed by a rising120° tail. Attached vertices remain exactly on the flange. Gel uses an analytical, tapered stream with a single3.2× pressure-area pulse and five progress-driven droplets. No elapsed-time solver, random emission or accumulated particle state is involved.

The nominal liquid volume is derived from the modeled23.2 mm inner radius: `250000 / (π × 23.2²) =147.84756 mm` fill height, surface atY153.14756 above the Y5.3 floor. Full-fill geometry uses unit scale so transmission rays have correct physical scale. The thin PET is a transparent reflective overlay over refractive gel, avoiding overlapping transmission-buffer omissions in Three.js.

`ritual-space.js` fits the camera to yaw-invariant cylindrical envelopes, blending peel/pour/exchange framing deterministically. The cap parks in a separate upper-left lane. Cleared film and PET move along camera-aligned upper-right paths, with the empty insert completely outside before the replacement arrives. Exit endpoints clear every bounding corner at zoom0.6 plus a24 px margin. Visibility changes only outside the actual camera frustum. No full mesh vertex scan runs on every draw. Runtime code, materials and textures are self-hosted; the fallback is a screenshot of this exact product.

The shampoo uses amber volumetric absorption rather than a colored PET wall. The neutral PET encloses a250 ml gel body, visible meniscus and air space. Bulk attenuation is#c67a14 at35 mm; the thinner stream uses the same hue at3.2 mm to keep its color legible. These settings are authored appearance, not a measured shampoo formulation.

## Provisional dimensions and effect limits

Confirmed outlines and diameters are preserved. Unmeasured internal details remain visual assumptions: PET/flange thickness0.3 mm, film thickness0.08 mm, cap roof clearance0.25 mm, hidden outletØ6 mm, nipple lift1.4 mm, silicone center deflection1.2 mm, bearing depths, relief depths and folded tab profile. The roof field is constant throughR11 and quintic to zero at the flange-supportedR23.5 annulus. The ring carrier follows the center, while its flexible bridge lets the linked discs follow their local roof displacement, preserving nipple clearance. Current production CAD is needed to certify these details.

Gel tint, viscosity appearance, flow rate and pressure multiplier are authored effects, not fluid measurements. Hidden interior liquid uses an axial volume display during tilt; exterior gel follows world gravity. The previous exploded-study GLB remains an archived asset and does not contain the new procedural membrane/liquid cycle.

## Prompt research

[OpenAI's Codex product-scene example](https://developers.openai.com/showcase/forged-in-silence) documents procedural Three.js geometry, scroll sections and lighting iteration. [The author's Claude cinematic-scroll workflow](https://github.com/zubair-trabzada/scroll-cinematic-claude/blob/main/SKILL.md) gives a structured scene brief for image sequences. Neither demonstrates this exact closure, peel and refill mechanism.

The implementation brief therefore specifies approved meshes, a normalized reversible timeline, operational clearance, a deforming bonded membrane, world-gravity gel, independent inspection controls and forward/reverse geometry checks. Published prompts are research material, not instructions executed in this repository.

[Three.js BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html) supports the membrane deformation; [MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) supplies the gel's refraction. [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/) and [MDN pinch gestures](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures) inform input arbitration.

[Lenis](https://github.com/darkroomengineering/lenis) provides a reference for infinite scrolling, target smoothing and touch inertia. This canvas uses a small custom controller to preserve its existing axial-drag/pinch arbitration without a competing touch system. [MDN RAF timing](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) informs refresh-rate independence and background suspension handling.

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

### Current verification coverage

All 66 tests pass, followed by the 15-page link, asset, language, indexing and domain-isolation check. Cached analytic roof weights and normals reduce the measured cap-update benchmark from about29.8 ms to2.2 ms per changing pressure frame; browser pressure-pose rendering settles around2.5 ms of CPU work. These are local measurements rather than device-independent frame-rate guarantees.

Checks cover signed/multiple loop crossings and exactly720° authored rotation, equal30/60/120 Hz coast trajectories, gesture reversal/cancellation/pinch/reduced-motion handling, exact reverse membrane geometry, the shared silicone roof/outlet field, true hollow-bore collision predicates and world-gravity stream clearance. Spatial tests cover1,001 dense cycle samples plus12 manual-yaw directions at zoom0.6/1/3 in portrait and landscape, including the previously colliding refill entry and offscreen visibility cutoffs. Physical sealed endpoint meshes agree within0.00001 mm.

Chrome review confirms the actual amber volume and stream, curled film, pressure stroke, refill lanes, forward and backward loop crossings and portrait framing at390×844. The settled viewer stops rendering, and the browser console contains no errors or warnings. Physical multi-touch device testing remains separate from reducer/adapter verification.
