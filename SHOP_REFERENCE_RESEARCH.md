# Bamboo Shampoo: reference research and art direction

Research date: 13 October 2026. Seven live consumer-commerce references were inspected in the browser, alongside primary agency case studies. Polaroid and Nothing were also inspected at 390 × 844. This is a design investigation, not a conversion audit: active commerce and agency work are verified; commercial success caused by a particular visual treatment is not established. “2027” below describes the proposed aesthetic, not a verified future trend.

## Five decisions to carry into the build

1. The approved bottle should dominate a full-screen composition. It should feel like a tangible object in a designed environment, with an immediate route to buying it.
2. Use scale, contrast, precise typography and materials to establish identity. Remove decorative circles, generic luxury serifs and repeated boxed feature cards.
3. Selecting Aloe, Argan or Bamboo should change the surrounding light, color and mood. The product geometry and original engraving remain identical.
4. Give first purchase and refill two immediately understandable paths: 250 ml starter at €12.50, 250 ml refill at €4.50. Explain what arrives through the object itself.
5. Concentrate motion into purposeful chapters. Product demonstration, scene transitions and responsive feedback justify movement; an always-moving interface does not.

## Seven references

### 1. Polaroid I-2 — make the physical product an interaction language

**Observed:** A dark campaign world, close product views, light-leak atmosphere and photo imagery are continuous rather than boxed into UI cards. A compact navigation bar keeps a conspicuous yellow Buy control available. On mobile, navigation collapses to a Discover menu while Buy stays visible. The live page alternates technical features with photographs and artists, then provides bundles. [Live campaign](https://i2-camera.polaroid.com/)

**Verified:** Build in Amsterdam documents Next.js, React Spline, Framer Motion and Sass. Its more detailed account describes dynamic 3D layers made with BoldlyXR, a draggable rotary dial, setting previews and photo cycling. These interactions come from the real camera rather than arbitrary effects. [Agency case](https://www.buildinamsterdam.com/case/polaroid-i-2), [interaction account](https://www.buildinamsterdam.com/article/unveiling-polaroids-new-showpiece-minisite)

**Bamboo inference:** Use the real silicone cap, peelable foil and replaceable PET cartridge as the site's visual vocabulary. Preserve a buy action through the story. The existing Three.js geometry is more suitable than rebuilding an approximation in Spline.

### 2. Secrid — exact rendering matters more than ornamental 3D

**Observed:** The engraving landing page uses a large material/product image beside a very large condensed headline, then a clear four-step sequence. Personalization leads toward purchase rather than becoming a disconnected showcase. [Official engraving page](https://secrid.com/nl-nl/engrave-your-wallet/)

**Verified:** Q42 describes a one-week validation prototype, followed by a three-month tool build. Its stated challenge was accurate light and color so the screen product matches the delivered object. It uses Three.js to place designs over existing models, with Next.js, Storyblok and a production pipeline. The agency reports substantial engraving adoption without publishing a numerical conversion lift. [Developer case](https://www.q42.nl/werk/secrid)

**Bamboo inference:** Keep the accepted CAD proportions and SVG. Improve camera, light, shadow, surface response and framing; do not improvise the cap or erase the engraving to make a prettier render. Keep the shopper's exact configuration visible when it enters the bag.

### 3. Moooi — a store can feel like entering a world

**Observed:** The current homepage opens with an edge-to-edge product story, unusually large centered type and a small purchase/discovery action. Menu, search and shopping utilities are restrained. The campaign media has a visible pause control. [Live storefront](https://www.moooi.com/eu/)

**Verified:** Build in Amsterdam describes a multisensory system of large type, imagery/video, motion and sound, plus fully keyboard-navigable interfaces and deliberately designed accessible states. It names Centra, Storyblok and Next.js. Accessibility is part of the visual system rather than a later layer. [Agency case](https://www.buildinamsterdam.com/case/moooi)

**Bamboo inference:** The bottle and gel can inhabit a coherent studio world. A viewer, its captions, purchase action and fallback image should belong to the same composition. Keep decorative sound opt-in and avoid making sound necessary to understand the product.

### 4. BYOMA — unmistakable visual identity at accessible prices

**Observed:** The storefront's fuchsia/yellow navigation and blue/yellow campaign produce a strong identity before any animation. Bold uppercase type, packaging colors and ingredient graphics connect product discovery to education. Collections expose prices and add actions rather than hiding all commerce behind brand storytelling. [Live storefront](https://byoma.com/), [collection](https://byoma.com/collections/shop-all-skin)

**Verified:** The official navigation separates products, concerns, routines and refills. A primary launch partner reports two sellouts during launch week and press/social activity; this is campaign evidence, not proof that the homepage design increased conversion. [Launch partner case](https://www.seengroup.com/case-study/byoma/)

**Bamboo inference:** Low price need not mean generic design. Build an ownable chromatic system around ink, lavender, ice blue and grapefruit coral. Use only claims supplied by the product owner; BYOMA's clinical statements and endorsements cannot be borrowed.

### 5. Gentle Monster — separate cinematic discovery from shopping utility

**Observed:** The stories index opens with a full-width cinematic scene and modest lower-corner captions, framed by a simple store navigation. Its collections can have their own narrative worlds while the catalog remains reachable. [Live stories](https://www.gentlemonster.com/us/en/stories)

**Verified:** The official BOLD story connects a named design idea to three explicit scenes, with video play/pause and mute controls, product attributes, and a Shop the Collection action. The current stories index also links campaign experiences, games and an AI filter. These are distinct experiences, not evidence that the store was created solely by AI. [Official BOLD story](https://www.gentlemonster.com/legacy/story/ja/bold-story.html)

**Bamboo inference:** A surreal macro world of bamboo, translucent gel and wet light can create a campaign signature. Keep the dedicated ritual page as the pure cinematic experience and make ordinary product pages easy to shop.

### 6. Nothing — fewer elements can create a stronger first impression

**Observed:** The current desktop hero uses one dark oversized headphone subject, one central headline and one discovery action. A compact floating navigation contrasts with the full-bleed scene. At 390 px the same hierarchy survives; it does not shrink a desktop two-column layout into tiny fragments. Later sections provide category routes and individual campaigns. [Live storefront](https://us.nothing.tech/)

**Verified:** The live page separates discovery, shopping categories and purchase-service information. Its current design includes a serif hero headline and a dot-style logo; the useful reference is its composition and restraint, not a font or color to copy.

**Bamboo inference:** A whole-screen bottle, a short claim and one strong purchase route should carry the hero. Use a deliberately reframed mobile camera, not a scaled desktop canvas. Avoid a second announcement bar or duplicate CTA competing for attention.

### 7. Fussy — reusable housing and consumable refill must stay clear

**Observed:** The hero shows the reusable case alongside its refill, on a photographed surface. The physical distinction is immediately understandable. Navigation explicitly separates starter packs, refills and cases; the homepage explains choosing a case, choosing a scent and choosing a purchase plan. [Live storefront](https://www.getfussy.com/)

**Verified:** The refill page explicitly addresses returning owners and exposes scent choices; its homepage credits Neverbland. Its subscription terms and multi-refill purchasing are features of Fussy's business, not proposed Bamboo features. [Refill page](https://www.getfussy.com/products/refills)

**Bamboo inference:** Show the PET cartridge and flange clearly beside the bamboo shell. Use a direct refill path for existing owners, with an optional concise physical demonstration. Do not invent subscriptions, bundles, testimonials or environmental measurements.

## User's showcase references

The implementation lead inspected both Instagram reels in the browser. In [DdjLsxnsbfW](https://www.instagram.com/reel/DdjLsxnsbfW/) the observed composition was a pink full-bleed campaign with a centrally staged jacket/model, followed by a restrained product page: large editorial type on the left, garment in the centre and buying controls on the right. The creator presents it as a Shopify template showcase. In [DdLCb5oyhYZ](https://www.instagram.com/reel/DdLCb5oyhYZ/) the observed SUMMIT FLOOR 34 campaign used a full-bleed elevator/walking sequence, very large type behind a garment and compact left-side navigation. The creator mentions Higgsfield and ChatGPT Astra. These are creator claims and visual demonstrations, not evidence of conversion results or proof that a single prompt built a production shop.

The transferable idea is spatial hierarchy: one dominant subject, type on a different depth plane, small useful controls, and a decisive transition into commerce. Bamboo retains its actual engineered object rather than copying those brands or inventing product photography.

## Proposed direction: bamboo object design with grapefruit light

This is the recommendation, not an observation of another site.

**Identity:** Ink `#1C1B25`, chalk `#F4F5F7`, lavender `#D1C5EE`, ice blue `#C6E4EE`, grapefruit coral `#F2AC9F`. Use self-hosted Barlow Condensed Bold for very large campaign type and Manrope for commerce. The palette separates the natural bamboo object from its usual green/beige category styling. Avoid ornamental italics, seals, radial badges, fake serials and generic luxury cards.

**Homepage opening:** A scene filling the viewport beneath one compact header. The approved bottle is enlarged, diagonally framed and lit like an industrial-design campaign; the original engraving must remain readable from at least one view. Headline occupies a deliberate spatial plane instead of a left text column beside a product card. Show the €12.50 starting price and 250 ml without making the visitor scroll. Scroll first changes the pose and reveals the refill logic; it should not immediately launch an entire forced ritual.

**Merchandising:** Three large editorial scent panels and one scene with three direct scent controls. Selecting a scent changes light, backdrop and copy, with a stable price/format chooser. Aloe uses cool ice blue, Argan rosy light and coral accents, Bamboo lavender and aquatic blue accents. Grapefruit-colored gel is a rendering direction across the system, not a fourth fragrance. Use the lavender water landscape once as the shell-retention chapter and the coral gel macro once as a refill texture study; neither substitutes for actual product geometry.

**Product page:** A large object view and a crisp transaction panel. Format, scent, volume, quantity, price and included components remain together. A compact sticky mobile purchase strip appears when the main purchase control leaves view. Put deeper dimensions and mechanics in disclosures. Maintain functional static images and text before WebGL loads.

**Refill page:** Start with the translucent, visibly filled cartridge rather than another closed bottle. Pair the €4.50 refill choice with three physical beats: remove old cartridge, insert sealed cartridge, peel and close. The full approved ritual remains reachable. The shopper should not have to complete a scroll cinema to select Aloe/Argan/Bamboo.

**Motion:** One coordinated camera/product/light system; editorial text fades and translates as the subject moves. Fragrance transitions settle within roughly 450–650 ms. Bag feedback is immediate. Natural scroll remains native. Use restrained easing and idle motion only where it improves material perception.

## Implementation and acceptance rules

- Preserve component geometry and the original engraving. The “2027” effect comes from composition, materials, camera work and choreography.
- Keep liquid volume visibly three-dimensional: grapefruit absorption through the depth, an independent meniscus, tiny restrained bubbles, refraction and bright specular bands. A realistic viscous stream needs continuous attachment, gravity-aligned fall, changing thickness and plausible breakup; a colored solid ribbon alone will look artificial. These are visual criteria, not claims of a physical fluid solver.
- Share the renderer or tightly limit simultaneously active contexts; prepare shaders while the initial image remains visible, stop offscreen rendering and reduce mobile resolution before sacrificing input responsiveness. These are implementation recommendations, not verified internals of the reference sites.
- For DOM animation prefer transforms and opacity. Avoid animating layout dimensions and large paint-heavy blurs; use `will-change` only when justified. [Google's animation guidance](https://web.dev/articles/animations-guide)
- Target LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1 at the 75th percentile. Lab checks alone do not establish field compliance. Keep size-reserved posters and ordinary purchase controls usable while 3D initializes. [Core Web Vitals guidance](https://web.dev/articles/vitals)
- Review actual screenshots at desktop and mobile, each important scroll chapter and the first interaction. Test bag, keyboard, reduced motion, touch scrolling, language links and model failure. A functioning test suite does not establish visual quality.

## What the primary creators say about process

Build in Amsterdam describes strategy first, one leading concept, then close design/development collaboration and rapid prototypes. Its interview places AI in inspiration, translation and repetitive tasks, and explicitly retains human judgment for final creative work. [Creator interview](https://www.buildinamsterdam.com/article/impactful-design-starts-with-a-clear-concept)

BASIC/DEPT's WHOOP case describes audience journeys, progressive disclosure, motion, and more than ten functional prototypes tested with users before refinement. This is a useful standard for an AI-led build: specify the design intent, implement a constrained slice, inspect the rendered result and correct it before multiplying templates. [Primary WHOOP case](https://www.basicagency.com/case-studies/whoop)

None of these sources verifies that a single prompt produced an entire finished store of this quality. Their documented craft can be translated into agent work, but the validation and refinement still have to happen.
