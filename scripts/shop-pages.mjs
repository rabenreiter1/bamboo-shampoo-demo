import { createCheckoutPage } from './checkout-page.mjs';
/**
 * Localised shop bodies. The build owns document metadata, navigation, legal
 * pages and dialogs; the shop runtime owns configuration and the 3D viewers.
 */
export const shopCopy = {
  de: {
    names: { aloe: 'Aloe', argan: 'Argan', bamboo: 'Bamboo' },
    scentWords: { aloe: 'LEICHT / FRISCH / SANFT', argan: 'WARM / RUHIG / WEICH', bamboo: 'GRÜN / KLAR / NATURNAH' },
    scentDescriptions: {
      aloe: 'Frisch, leicht und sanft. Dein Duft für einen klaren Start.',
      argan: 'Warm, weich und ruhig. Ein Duft zum Abschalten.',
      bamboo: 'Grün, klar und naturnah. Ein frischer Blick auf dein tägliches Ritual.'
    },
    fragranceNote: 'Die Dufttexte beschreiben eine redaktionelle Stimmung, keine Inhaltsstoffe oder Pflegewirkung.',
    shampoo: 'Starter-Set', refill: 'Refill', quantity: 'Menge', add: 'In die Tasche',
    bag: 'Deine Tasche', empty: 'Dein Ritual beginnt hier.',
    emptyDesc: 'Wähle einen Duft und das passende Format.', explore: 'Zur Kollektion',
    remove: 'Entfernen', toast: 'In deiner Tasche', close: 'Schließen',
    home: 'Startseite', shop: 'Shop', story: 'Die Idee', faq: 'Fragen & Antworten',
    checkout: 'Auswahl ansehen', continue: 'Weiter entdecken', subtotal: 'Gesamtsumme',
    productPriceLabel: 'Produktpreis', unitPriceLabel: 'Grundpreis',
    productGallery: { product: 'Starter-Set', refill: 'Refill' },
    formatAdd: { shampoo: 'Starter-Set in die Tasche', refill: 'Refill in die Tasche' },
    formatNote: {
      shampoo: 'Dein Starter-Set: Bambushülle, Silikonkappe und ein gefüllter 250-ml-Einsatz.',
      refill: 'Der gefüllte 250-ml-Einsatz. Deine Hülle und Kappe bleiben.'
    },
    filterResults: 'Produkte',
    meta: {
      home: ['Bamboo Shampoo — Dein Ritual. Neu gedreht.', '250 ml Shampoo in einer Bambushülle mit wiederverwendbarer Silikonkappe. Entdecke Aloe, Argan und Bamboo sowie das PET-Refill für 4,50 €.'],
      collection: ['Starter-Set & Refill · Aloe, Argan, Bamboo | Bamboo Shampoo', 'Entdecke drei Düfte in zwei Formaten: ein Starter-Set mit 250 ml Shampoo für 12,50 € und ein gefülltes 250-ml-Refill für 4,50 €.'],
      refill: ['Das Refill-System · 250 ml für 4,50 € | Bamboo Shampoo', 'Behalte Bambushülle und Silikonkappe. Entdecke den transparenten PET-Einsatz mit abziehbarer Siegelfolie und erlebe den Wechsel in 3D.'],
      story: ['Material mit Charakter. Design mit einem Plan. | Bamboo Shampoo', 'Eine Bambushülle, eine flexible Silikonkappe und ein austauschbarer PET-Einsatz. Entdecke die Konstruktion hinter Bamboo Shampoo.'],
      faq: ['Fragen zu Shampoo, Kappe & Refill | Bamboo Shampoo', 'Antworten zu 250 ml, Aloe, Argan, Bamboo, dem Refill-System und dieser Shop-Vorschau.'],
      checkout: ['Deine Auswahl | Bamboo Shampoo', 'Prüfe deine Produktauswahl, Düfte und Mengen in der Bamboo Shampoo Shop-Vorschau.']
    }
  },
  en: {
    names: { aloe: 'Aloe', argan: 'Argan', bamboo: 'Bamboo' },
    scentWords: { aloe: 'LIGHT / FRESH / SOFT', argan: 'WARM / CALM / MELLOW', bamboo: 'GREEN / CLEAR / EARTHY' },
    scentDescriptions: {
      aloe: 'Fresh, light and soft. A scent for a clear start.',
      argan: 'Warm, mellow and calm. A scent to slow things down.',
      bamboo: 'Green, clear and earthy. A fresh take on your daily ritual.'
    },
    fragranceNote: 'The scent descriptions are editorial impressions, not ingredient or haircare claims.',
    shampoo: 'Starter Set', refill: 'Refill', quantity: 'Quantity', add: 'Add to bag',
    bag: 'Your bag', empty: 'Your ritual starts here.',
    emptyDesc: 'Choose a scent and the format that fits.', explore: 'Explore the collection',
    remove: 'Remove', toast: 'In your bag', close: 'Close',
    home: 'Home', shop: 'Shop', story: 'The idea', faq: 'Questions & answers',
    checkout: 'Review selection', continue: 'Keep exploring', subtotal: 'Total',
    productPriceLabel: 'Product price', unitPriceLabel: 'Unit price',
    productGallery: { product: 'Starter Set', refill: 'Refill' },
    formatAdd: { shampoo: 'Add starter set to bag', refill: 'Add refill to bag' },
    formatNote: {
      shampoo: 'Your starter set: bamboo shell, silicone cap and a filled 250 ml insert.',
      refill: 'The filled 250 ml insert. Keep your shell and cap.'
    },
    filterResults: 'products',
    meta: {
      home: ['Bamboo Shampoo — A new turn on your daily ritual.', '250 ml shampoo in a bamboo shell with a reusable silicone cap. Explore Aloe, Argan and Bamboo, and the €4.50 PET refill.'],
      collection: ['Starter Set & Refill · Aloe, Argan, Bamboo | Bamboo Shampoo', 'Explore three scents in two formats: a starter set with 250 ml shampoo for €12.50 and a filled 250 ml refill for €4.50.'],
      refill: ['The refill system · 250 ml for €4.50 | Bamboo Shampoo', 'Keep the bamboo shell and silicone cap. Discover the transparent PET insert with a peel-off film seal and watch the change in 3D.'],
      story: ['Material with character. Design with a plan. | Bamboo Shampoo', 'A bamboo shell, a flexible silicone cap and a replaceable PET insert. Explore the construction behind Bamboo Shampoo.'],
      faq: ['Questions about shampoo, the cap & refills | Bamboo Shampoo', 'Answers about 250 ml, Aloe, Argan, Bamboo, the refill system and this shop preview.'],
      checkout: ['Your selection | Bamboo Shampoo', 'Review your products, scents and quantities in the Bamboo Shampoo shop preview.']
    }
  }
};

export function createShopPages({ BASE, icon, fragrances, formatPrice, esc, version = '' }) {
  const L = (lang, de, en) => lang === 'de' ? de : en;
  const path = (lang, route = '') => `${BASE}/${lang}/${route}`;
  const orderedScents = ['aloe', 'argan', 'bamboo'].filter(id => fragrances.includes(id));
  const price = (format, lang) => formatPrice(format === 'refill' ? 450 : 1250, lang);
  const asset = name => `${BASE}/assets/${name}${version ? `?v=${version}` : ''}`;
  const contextualAttributes = href => href.startsWith('#') ? '' : 'data-native-route';
  const button = (href, label, modifier = '', attributes = contextualAttributes(href)) => `<a class="button ${modifier}" href="${href}" ${attributes}><span>${label}</span>${icon('arrow')}</a>`;
  const link = (href, label, attributes = contextualAttributes(href)) => `<a class="text-link" href="${href}" ${attributes}><span>${label}</span>${icon('arrow')}</a>`;
  const eyebrow = text => `<p class="eyebrow">${text}</p>`;
  const image = (name, alt, eager = false, cls = '') => `<img class="${cls}" src="${asset(name)}" alt="${esc(alt)}" width="1024" height="1280" ${eager ? 'fetchpriority="high" loading="eager"' : 'loading="lazy"'} decoding="async">`;

  function viewer(lang, mode = 'product', scent = 'aloe', cls = '', eager = false, direction = 'detail') {
    const matched = ['product','refill','cap'].includes(mode);
    const family = direction === 'campaign' ? 'campaign' : 'detail';
    const filename = mode === 'ritual' && direction === 'campaign' ? `shop-teaser-product-${scent}.webp` : mode === 'cap' ? `shop-cap-${scent}.webp` : matched ? `shop-${family}-${mode === 'refill' ? `refill-${scent}` : `product-${scent}`}.webp` : mode === 'refill' ? `shop-refill-${scent}.webp` : mode === 'shell' ? 'shop-shell.webp' : `shop-product-front-${scent}.webp`;
    const alt = L(lang,
      mode === 'refill' ? 'Transparenter PET-Einsatz mit gefülltem Shampoo und Siegelfolie' : mode === 'shell' ? 'Der offene Bambustubus mit Originalgravur, ohne Kappe und PET-Einsatz' : mode === 'cap' ? 'Silikon-Dosierkappe mit ringgelagerter Verschlusslasche' : mode === 'ritual' ? 'Der Refill-Wechsel im vorhandenen Bamboo Starter-Set. Angeboten wird der gefüllte Einsatz.' : 'Bamboo Starter-Set: Bambushülle, Silikonkappe und gefüllter PET-Einsatz',
      mode === 'refill' ? 'Transparent PET insert filled with shampoo and sealed with film' : mode === 'shell' ? 'The open bamboo tube with original engraving, without cap or PET insert' : mode === 'cap' ? 'Silicone dosing cap with a ring-mounted closure' : mode === 'ritual' ? 'Changing a refill in the existing Bamboo starter set. The filled insert is the item offered.' : 'Bamboo starter set: bamboo shell, silicone cap and filled PET insert');
    return `<div class="shop-scene ${cls}${matched || mode === 'ritual' && direction === 'campaign' ? ' scene-preview' : ''}" data-shop-scene="${mode}" data-art-direction="${direction}" data-scent="${scent}" role="group" aria-label="${esc(alt)}">${image(filename, alt, eager, 'shop-scene__fallback')}</div>`;
  }

  function scentCards(lang, format = 'shampoo', selected = orderedScents) {
    const t = shopCopy[lang];
    return selected.map(id => {
      const href = path(lang, `products/${id}/`) + (format === 'refill' ? '?format=refill' : '');
      const label = t[format];
      return `<article class="product-card scent-${id}" data-reveal data-format="${format}" data-fragrance="${id}">
        <a class="product-card__art" href="${href}" data-native-route aria-label="${esc(`${t.names[id]} ${label}, 250 ml — ${L(lang, 'ansehen', 'view')}`)}">
          <div class="product-card__meta"><span>${label.toUpperCase()}</span><span>250 ML</span></div>
          <span class="product-card__world" aria-hidden="true">${t.names[id]}</span>
          ${image(format === 'refill' ? `shop-detail-refill-${id}.webp` : `shop-product-front-${id}.webp`, `${t.names[id]} ${label} · 250 ml`)}
          <span class="product-card__scent">${t.scentWords[id]}</span>
          <span class="product-card__arrow" aria-hidden="true">${icon('arrow')}</span>
        </a>
        <div class="product-card__info"><h3><a href="${href}" data-native-route>${t.names[id]}<span>${label}</span></a></h3><strong class="product-card__price">${price(format, lang)}</strong></div>
        <div class="product-card__bottom">${link(href, L(lang, 'Entdecken', 'Discover'), 'data-native-route')}<button class="product-card__add" type="button" data-add="${id}" data-id="${id}" data-format="${format}" data-quick-add="${id}" data-quick-format="${format}" aria-label="${esc(`${t.names[id]} ${label} ${L(lang, 'in die Tasche', 'add to bag')}`)}">${icon('plus')}</button></div>
      </article>`;
    }).join('');
  }

  function accordions(items, prefix = 'answer') {
    return items.map(([question, answer], index) => `<details class="accordion" id="${prefix}-${index}"><summary><span>${question}</span>${icon('plus')}</summary><div class="accordion__body">${answer}</div></details>`).join('');
  }

  function closing(lang, inJourney = false) {
    return `<section class="closing-cta section-shell"><div data-reveal>${eyebrow(L(lang, 'DEIN DUFT. DEIN FORMAT.', 'YOUR SCENT. YOUR FORMAT.'))}<h2 class="display">${L(lang, 'Einmal anfangen.<br>Immer wieder.', 'Start once.<br>Keep going.')}</h2></div><div class="closing-cta__action"><p>${L(lang, 'Aloe, Argan oder Bamboo.<br>Mit dem Starter-Set beginnen. Mit Refill weiterpflegen.', 'Aloe, Argan or Bamboo.<br>Begin with a starter set. Keep going with a refill.')}</p>${button(inJourney ? '#collection' : path(lang, 'shop/'), L(lang, 'Duft auswählen', 'Choose your scent'))}</div></section>`;
  }

  function ritual(lang, variant = 'home', scent = 'aloe') {
    const steps = lang === 'de' ? [
      ['ALLES DRIN.', 'Bambushülle, Silikonkappe und ein gefüllter Einsatz. Die Siegelfolie hält das neue Refill geschlossen.'],
      ['PEEL IT.', 'Kappe abnehmen. Die Siegelfolie lösen und vollständig vom Rand abziehen.'],
      ['PRESS. POUR.', 'Kappe aufsetzen, die Verschlusslasche öffnen und zur Seite drehen. Die flexible Silikonmitte gehört zur Kappe.'],
      ['REFILL IT.', 'Kappe abnehmen. Den leeren PET-Einsatz herausnehmen und ein neues Refill einsetzen.'],
      ['GO AGAIN.', 'Bambushülle und Silikonkappe bleiben. Das neue Refill ist bis zur nächsten Verwendung versiegelt.']
    ] : [
      ['ALL IN.', 'Bamboo shell, silicone cap and a filled insert. The film keeps the new refill sealed.'],
      ['PEEL IT.', 'Take the cap off. Lift the film seal and peel it completely off the rim.'],
      ['PRESS. POUR.', 'Put the cap back on, open the closure and turn it aside. The flexible silicone centre is part of the cap.'],
      ['REFILL IT.', 'Take the cap off. Remove the empty PET insert and put a new refill in.'],
      ['GO AGAIN.', 'Keep the bamboo shell and silicone cap. The new refill stays sealed until its next use.']
    ];
    return `<section class="ritual-scroll ritual-scroll--${variant} scent-${scent}" ${variant === 'home' ? 'id="ritual" data-journey-chapter="ritual"' : ''} ${variant === 'product' ? '' : `data-world="${scent}" data-world-kind="product"`} data-ritual-scroll aria-label="${L(lang, 'Das Produkt vom ersten Öffnen bis zum nächsten Refill', 'The product from first opening to the next refill')}">
      <div class="ritual-sticky">
        <div class="ritual-stage" data-shop-scene="ritual" data-scent="${scent}" role="group" aria-label="${L(lang, '3D-Animation: öffnen, Siegelfolie abziehen, dosieren und PET-Einsatz wechseln', '3D animation: open, peel the film, dose and replace the PET insert')}">${image(`shop-product-front-${scent}.webp`, L(lang, 'Bamboo Shampoo in der geschlossenen Produktansicht', 'Bamboo Shampoo in its closed product view'))}</div>
        <div class="ritual-copy" data-ritual-copy>
          ${eyebrow(L(lang, 'DAS SYSTEM IN BEWEGUNG', 'THE SYSTEM IN MOTION'))}
          <div class="ritual-panels">${steps.map(([title, body], index) => `<div class="ritual-step ${index === 0 ? 'is-active' : ''}" data-ritual-step="${index}"><h2 class="display">${title}</h2><p>${body}</p></div>`).join('')}</div>
          <div class="ritual-progress" aria-hidden="true"><span></span></div>
          <p class="ritual-instruction">${icon('down')}<span>${L(lang, 'Scrollen bewegt das Produkt', 'Scroll to move the product')}</span></p>
        </div>
        <span class="ritual-background-word" aria-hidden="true">REPEAT</span>
      </div>
    </section>`;
  }

  function homeHero(lang) {
    const t = shopCopy[lang];
    return `<section class="campaign-hero campaign-hero--home intro-hero scent-aloe" id="discover" data-journey-chapter="discover" data-world="aloe" data-world-kind="product" data-playback-profile="hero-intro">
      <div class="intro-copy">
        ${eyebrow(L(lang, '250 ML · SHAMPOO & REFILL', '250 ML · SHAMPOO & REFILL'))}
        <h1 class="intro-title">${L(lang, 'Shampoo zum<br><em>Nachfüllen.</em>', 'A fresh take<br><em>on refilling.</em>')}</h1>
        <p class="intro-description">${L(lang, 'Die Bambushülle bleibt.<br>Du wechselst nur den Einsatz.', 'Keep the bamboo shell.<br>Just change the insert.')}</p>
      </div>
      <div class="intro-visual">
        <div class="shop-scene intro-stage scene-preview" data-shop-scene="journey" data-art-direction="intro" data-scent="aloe" role="group" aria-label="${L(lang, 'Animiertes Refill-Prinzip: Die Kappe hebt sich, der versiegelte Einsatz gleitet aus der Bambushülle und wieder hinein. Ziehen zum Drehen.', 'Animated refill principle: the cap lifts, the sealed insert slides out of the bamboo shell and back in. Drag to rotate.')}">${image('shop-guide-product-aloe.webp', L(lang, 'Das Bamboo Starter-Set mit wiederverwendbarer Kappe und Bambushülle', 'The Bamboo starter set with its reusable cap and bamboo shell'), true, 'shop-scene__fallback')}</div>
        <div class="intro-annotations" aria-hidden="true">
          <svg class="intro-leaders" viewBox="0 0 1000 1000" preserveAspectRatio="none"><path data-intro-line="cap" pathLength="1"/><path data-intro-line="insert" pathLength="1"/><path data-intro-line="shell" pathLength="1"/></svg>
          <span class="intro-label intro-label--cap" data-intro-anchor="cap"><span>${L(lang, 'Kappe behalten', 'Keep the cap')}</span></span>
          <span class="intro-label intro-label--insert" data-intro-anchor="insert"><span>${L(lang, 'Refill wechseln', 'Change the refill')}</span></span>
          <span class="intro-label intro-label--shell" data-intro-anchor="shell"><span>${L(lang, 'Hülle behalten', 'Keep the shell')}</span></span>
        </div>
        <div class="intro-transport" data-playback-controls>
          <button type="button" class="intro-loop-caption" data-playback-at=".52" aria-label="${L(lang, 'Refill-Prinzip im Detail ansehen', 'Inspect the refill principle')}" disabled>${L(lang, 'Das Refill-Prinzip', 'The refill principle')} <span aria-hidden="true">↗</span></button>
          <button class="playback-toggle" type="button" data-playback-toggle aria-label="${L(lang, 'Animation pausieren', 'Pause animation')}" disabled><span class="playback-toggle__icon" aria-hidden="true"></span><span data-playback-toggle-label>Pause</span></button>
          <span class="intro-loop-track" aria-hidden="true"></span>
        </div>
      </div>
      <div class="intro-actions">
        <div class="campaign-switch" role="group" aria-label="${L(lang, 'Duft wählen', 'Choose your scent')}">${orderedScents.map(id => `<button class="world-choice scent-${id}" type="button" data-world-scent="${id}" aria-pressed="${id === 'aloe'}"><span class="world-choice__swatch" aria-hidden="true"></span><span>${t.names[id]}</span></button>`).join('')}</div>
        <a class="hero-buy intro-buy" href="${path(lang, 'products/aloe/')}" data-world-link data-native-route><span><strong>${L(lang, 'Starter-Set entdecken', 'Explore the starter set')}</strong><small>${price('shampoo', lang)}</small></span><span class="hero-buy__arrow">${icon('arrow')}</span></a>
      </div>
      <a class="intro-explain" href="#ritual"><span>${L(lang, 'So funktioniert das Refill', 'How the refill works')}</span>${icon('down')}</a>
    </section>`;
  }

  function playbackControls(lang, profile = 'home-cycle') {
    const teaser = profile === 'refill-teaser';
    const chapters = teaser ? [
      ['.765', L(lang, 'Entnehmen', 'Remove')], ['.83', L(lang, 'Einsetzen', 'Insert')],
      ['.90', L(lang, 'Kappe auf', 'Cap on')], ['.96', L(lang, 'Weiterpflegen', 'Continue')]
    ] : [
      ['.10', L(lang, 'Öffnen', 'Open')], ['.20', L(lang, 'Entsiegeln', 'Peel')],
      ['.54', L(lang, 'Dosieren', 'Dispense')], ['.875', 'Refill']
    ];
    return `<div class="playback-controls ${teaser ? 'playback-controls--teaser' : ''}" data-playback-controls>
      <div class="playback-transport"><button class="playback-toggle" type="button" data-playback-toggle aria-label="${L(lang, 'Animation pausieren', 'Pause animation')}" disabled><span class="playback-toggle__icon" aria-hidden="true"></span><span data-playback-toggle-label>${L(lang, 'Pause', 'Pause')}</span></button><label class="playback-seek"><span class="sr-only">${L(lang, 'Position der Animation', 'Animation position')}</span><input type="range" min="0" max="1000" step="1" value="0" data-playback-seek aria-label="${L(lang, 'Position der Animation', 'Animation position')}" disabled></label><span class="playback-status" data-playback-status aria-live="off">${L(lang, 'Wird vorbereitet', 'Preparing')}</span></div>
      <div class="playback-chapters" role="group" aria-label="${L(lang, 'Direkt zu einem Schritt', 'Go to a step')}">${chapters.map(([progress, label], index) => `<button type="button" data-playback-at="${progress}" disabled><span aria-hidden="true">0${index + 1}</span>${label}</button>`).join('')}</div>
    </div>`;
  }

  function productJourney(lang) {
    const phases = lang === 'de' ? [
      { id: 'closed', tag: 'DEIN BAMBOO. BEREIT FÜR DICH.', title: 'Alles drin.', body: '250 ml Shampoo. Versiegelt, bis du es öffnest.' },
      { id: 'uncap', tag: '01 / ÖFFNEN', title: 'Kappe ab.', body: 'Die Silikonkappe abnehmen. Darunter liegt die Siegelfolie.' },
      { id: 'unseal', tag: '02 / ABZIEHEN', title: 'Ein frischer Anfang.', body: 'Die Lasche greifen und die Folie vollständig vom Rand abziehen.' },
      { id: 'recap', tag: '03 / AUFSETZEN', title: 'Kappe drauf.', body: 'Die Kappe wieder aufsetzen. Sie sitzt bündig auf dem Bambustubus.' },
      { id: 'dose', tag: '04 / DOSIEREN', title: 'Drehen. Drücken. Los.', body: 'Verschlusslasche öffnen und zur Seite drehen. Neigen und die flexible Silikonmitte drücken.' },
      { id: 'remove', tag: '05 / WECHSELN', title: 'Leer? Einfach raus.', body: 'Kappe abnehmen. Den leeren PET-Einsatz herausziehen. Dein Bambustubus bleibt.' },
      { id: 'refill', tag: '06 / NACHLEGEN', title: 'Frisch geht weiter.', body: 'Ein neues, versiegeltes Refill einsetzen. Deine Kappe verwendest du weiter.' },
      { id: 'ready', tag: 'KEEP. REFILL. REPEAT.', title: 'Wieder bereit.', body: 'Dieselbe Hülle. Dieselbe Kappe. Dein nächstes Ritual.' }
    ] : [
      { id: 'closed', tag: 'YOUR BAMBOO. READY FOR YOU.', title: 'All in.', body: '250 ml shampoo. Sealed until you open it.' },
      { id: 'uncap', tag: '01 / OPEN', title: 'Cap off.', body: 'Lift off the silicone cap. The film seal sits underneath.' },
      { id: 'unseal', tag: '02 / PEEL', title: 'A fresh beginning.', body: 'Take the tab and peel the film completely off the rim.' },
      { id: 'recap', tag: '03 / REPLACE', title: 'Cap on.', body: 'Put the cap back on. It fits flush against the bamboo tube.' },
      { id: 'dose', tag: '04 / DISPENSE', title: 'Turn. Press. Go.', body: 'Open the closure and turn it aside. Tilt and press the flexible silicone centre.' },
      { id: 'remove', tag: '05 / CHANGE', title: 'Empty? Lift it out.', body: 'Take the cap off. Remove the empty PET insert. Keep your bamboo tube.' },
      { id: 'refill', tag: '06 / REFILL', title: 'Fresh goes on.', body: 'Put in a fresh, sealed refill. Keep using the same cap.' },
      { id: 'ready', tag: 'KEEP. REFILL. REPEAT.', title: 'Ready again.', body: 'The same shell. The same cap. Your next ritual.' }
    ];
    const intervals={ closed:[0,.06], uncap:[.06,.15], unseal:[.15,.27], recap:[.27,.35], dose:[.35,.72], remove:[.72,.83], refill:[.83,.96], ready:[.96,1] };
    const caption=phase=>`<article class="journey-caption journey-caption--${phase.id}" data-journey-caption="${phase.id}" data-phase-start="${intervals[phase.id][0]}" data-phase-end="${intervals[phase.id][1]}"><p class="journey-caption__kicker">${phase.tag}</p><h2 class="journey-caption__title"><span class="journey-caption__line"><span>${phase.title}</span></span></h2><p class="journey-caption__body">${phase.body}</p></article>`;
    return `<section id="ritual" class="product-playback scent-aloe" data-playback-profile="home-cycle" data-journey-chapter="ritual" data-world="aloe" data-world-kind="product" aria-label="${L(lang,'So funktioniert Bamboo Shampoo','How Bamboo Shampoo works')}">
      <div class="playback-heading"><p class="eyebrow">KEEP. REFILL. REPEAT.</p><h2 class="display">${L(lang, 'So funktioniert’s.', 'This is how it works.')}</h2><p>${L(lang, 'Eine Hülle, viele frische Anfänge.', 'One shell. Many fresh beginnings.')}</p></div>
      <div class="product-playback__layout"><div class="playback-stage scene-preview" data-shop-scene="journey" data-art-direction="journey" data-scent="aloe" role="group" aria-label="${L(lang,'Öffnen, Folie abziehen, dosieren und Refill wechseln','Open, peel, dispense and change the refill')}">${image('shop-guide-product-aloe.webp',L(lang,'Das geschlossene Bamboo Starter-Set vor dem ersten Öffnen','The closed Bamboo starter set before its first opening'),false,'shop-scene__fallback')}</div>
        <div class="playback-copy"><div class="playback-captions">${phases.map(caption).join('')}</div>${playbackControls(lang)}<a class="playback-fullscreen text-link" href="${BASE}/assembly/" data-native-route><span>${L(lang,'Im Vollbild ansehen','View fullscreen')}</span>${icon('arrow')}</a></div>
      </div>
    </section>`;
  }

  function home(lang) {
    return `<main id="main" data-journey>
      ${homeHero(lang)}
      <section class="section-shell home-collection" id="collection" data-journey-chapter="collection">
        <div class="section-heading" data-reveal><div>${eyebrow(L(lang, 'DIE KOLLEKTION', 'THE COLLECTION'))}<h2 class="display">${L(lang, 'Drei Düfte.<br>Dein Ritual.', 'Three scents.<br>Your ritual.')}</h2></div><div class="section-heading__aside"><p>${L(lang, 'Finde deinen Duft.<br>Der Rest bleibt.', 'Find your scent.<br>Keep everything else.')}</p>${link(path(lang, 'shop/'), L(lang, 'Alle Produkte', 'All products'))}</div></div>
        <div class="collection-grid collection-grid--campaign">${scentCards(lang)}</div>
        <div class="section-end"><span class="collection-format-note">${shopCopy[lang].shampoo} ${formatPrice(1250, lang)} · Refill ${formatPrice(450, lang)}</span></div>
      </section>
      ${productJourney(lang)}
      <section class="section-shell faq-tease" id="questions" data-journey-chapter="questions"><div class="section-heading" data-reveal><div>${eyebrow(L(lang, 'GUT ZU WISSEN', 'GOOD TO KNOW'))}<h2 class="display">${L(lang, 'Gute Fragen.<br>Klare Antworten.', 'Good questions.<br>Clear answers.')}</h2></div>${link(path(lang, 'faq/'), L(lang, 'Alle Antworten', 'All the answers'))}</div><div class="faq-list">${accordions(faqItems(lang).slice(0, 3), 'home-answer')}</div></section>
      ${closing(lang, true)}
    </main>`;
  }

  function collection(lang) {
    const t = shopCopy[lang];
    return `<main id="main" class="catalog-page">
      <section class="section-shell collection-intro"><div data-reveal>${eyebrow(L(lang, 'DIE KOLLEKTION / 250 ML', 'THE COLLECTION / 250 ML'))}<h1 class="display">${L(lang, 'Dein Duft.<br>Dein Format.', 'Your scent.<br>Your format.')}</h1></div><div class="collection-intro__aside"><p>${L(lang, 'Starter-Set: Hülle, Kappe und gefüllter Einsatz.<br>Refill: ein neuer, gefüllter Einsatz.', 'Starter set: shell, cap and filled insert.<br>Refill: a new, filled insert.')}</p><div class="collection-intro__prices"><span>${t.shampoo}<strong>${formatPrice(1250, lang)}</strong></span><span>Refill<strong>${formatPrice(450, lang)}</strong></span></div></div></section>
      <section class="section-shell collection-products" aria-label="${L(lang, 'Produkte', 'Products')}">
        <div class="collection-toolbar"><div class="collection-filters" role="group" aria-label="${L(lang, 'Nach Format filtern', 'Filter by format')}"><button class="is-active" type="button" data-filter="all" aria-pressed="true">${L(lang, 'Alle', 'All')}<span>6</span></button><button type="button" data-filter="shampoo" aria-pressed="false">${t.shampoo}<span>3</span></button><button type="button" data-filter="refill" aria-pressed="false">Refill<span>3</span></button></div><span class="collection-count" data-result-count aria-live="polite">6 ${t.filterResults}</span></div>
        <div class="collection-grid collection-grid--shop">${scentCards(lang, 'shampoo')}${scentCards(lang, 'refill')}</div>
      </section>
      <section class="format-chapter section-shell"><h2 class="display" data-reveal">${L(lang, 'Hülle behalten.<br>Duft nachlegen.', 'Keep the shell.<br>Refill the scent.')}</h2><div data-reveal><p>${L(lang, 'Beim Refill ersetzt du den PET-Einsatz. Bambushülle und Silikonkappe bleiben bei dir.', 'A refill replaces the PET insert. The bamboo shell and silicone cap stay with you.')}</p>${button(path(lang, 'refill/'), L(lang, 'Das Refill-System', 'Explore the refill system'))}</div></section>
    </main>`;
  }

  function refill(lang) {
    const t = shopCopy[lang];
    return `<main id="main">
      <section class="campaign-hero campaign-hero--refill scent-aloe" data-world="aloe" data-world-kind="refill" data-playback-profile="refill-teaser">
        <div class="campaign-atmosphere" aria-hidden="true"></div><div class="campaign-topline">${eyebrow('KEEP. REFILL. REPEAT.')}<span>250 ML / ${formatPrice(1800, lang)} / L</span></div>
        <h1 class="campaign-word">REFILL<span class="sr-only"> ${L(lang, 'für Bamboo Shampoo', 'for Bamboo Shampoo')}</span></h1>
        ${viewer(lang, 'ritual', 'aloe', 'campaign-product campaign-product--refill', true, 'campaign')}
        <div class="refill-teaser-controls">${playbackControls(lang, 'refill-teaser')}</div>
        <div class="campaign-deck campaign-deck--refill"><div class="campaign-world-copy"><h2>${L(lang, 'Deine Hülle bleibt.', 'Your shell stays.')}</h2><p>${L(lang, 'Du wechselst nur den gefüllten Einsatz.', 'Replace only the filled insert.')}</p></div><div class="campaign-purchase"><p>250 ml · ${L(lang, 'gefüllter Einsatz', 'filled insert')}<strong>${price('refill', lang)}</strong></p>${button('#refill-scents', L(lang, 'Refill auswählen', 'Choose a refill'))}</div></div>
        <a class="campaign-scroll" href="#refill-scents" aria-label="${L(lang, 'Refill-Düfte ansehen', 'View refill scents')}">${icon('down')}</a>
      </section>
      <section class="section-shell refill-selection" id="refill-scents"><div class="section-heading" data-reveal><div>${eyebrow(L(lang, 'DEIN NÄCHSTES REFILL', 'YOUR NEXT REFILL'))}<h2 class="display">${L(lang, 'Gleicher Duft.<br>Oder ein neuer.', 'Same scent.<br>Or something new.')}</h2></div><div class="section-heading__aside"><p>Aloe / Argan / Bamboo<br>250 ml · ${price('refill', lang)}</p>${link(`${BASE}/assembly/`, L(lang, 'Wechsel im Vollbild', 'Watch the change fullscreen'))}</div></div><div class="collection-grid collection-grid--campaign">${scentCards(lang, 'refill')}</div></section>
      <div id="refill-ritual">${ritual(lang, 'refill')}</div>
      <section class="gel-chapter"><img src="${asset('gel-macro.webp')}" width="1536" height="1024" alt="${L(lang, 'Grapefruitfarbene Gelfalten auf einer roséfarbenen Oberfläche als Texturstudie', 'Grapefruit-coloured gel folds on a rose surface, a texture study')}" loading="lazy" decoding="async"><div class="gel-chapter__copy" data-reveal>${eyebrow('FRESH INSIDE.')}<h2 class="display">${L(lang, 'Passt rein.<br>Geht weiter.', 'Fits inside.<br>Goes again.')}</h2><p>${L(lang, 'Dünnes, transparentes PET. Ein Auflagerand, der auf der Bambushülle sitzt. Und eine Folie, die vor der Verwendung abgezogen wird.', 'Thin, transparent PET. A support flange that rests on the bamboo shell. And a film that peels off before use.')}</p></div><span class="gel-chapter__caption">${L(lang, 'TEXTURSTUDIE / 250 ML', 'TEXTURE STUDY / 250 ML')}</span></section>
      <section class="section-shell refill-practical"><div class="section-heading" data-reveal><div>${eyebrow(L(lang, 'DER WECHSEL', 'THE CHANGE'))}<h2 class="display">${L(lang, 'Auf. Raus.<br>Neu rein.', 'Open. Out.<br>New one in.')}</h2></div><p>${L(lang, 'Die Siegelfolie vor der Verwendung vollständig entfernen.', 'Remove the film seal completely before use.')}</p></div><ol class="process-list"><li><span>${icon('minus')}</span><div><h3>${L(lang, 'Öffnen & entnehmen', 'Open & remove')}</h3><p>${L(lang, 'Kappe abnehmen und den leeren PET-Einsatz aus der Bambushülle ziehen.', 'Take off the cap and lift the empty PET insert out of the bamboo shell.')}</p></div></li><li><span>${icon('plus')}</span><div><h3>${L(lang, 'Neu einsetzen', 'Put the new one in')}</h3><p>${L(lang, 'Das neue Refill einsetzen. Sein oberer Rand liegt auf dem Tubusrand auf.', 'Put the new refill in. Its upper flange rests on the tube rim.')}</p></div></li><li><span>${icon('arrow')}</span><div><h3>${L(lang, 'Abziehen & aufsetzen', 'Peel & replace')}</h3><p>${L(lang, 'Vor der Verwendung die Folie abziehen. Dann die Silikonkappe wieder aufsetzen.', 'Before use, peel off the film. Then put the silicone cap back on.')}</p></div></li></ol></section>
      ${closing(lang)}
    </main>`;
  }

  function productForm(lang, id) {
    const t = shopCopy[lang];
    return `<form class="product-form" id="product-form-${id}" data-product-form data-id="${id}" data-default-format="shampoo">
      <input type="hidden" name="scent" value="${id}">
      <fieldset><legend>${L(lang, 'Duft', 'Scent')}<span data-scent-name>${t.names[id]}</span></legend><div class="scent-options">${orderedScents.map(scent => `<a class="scent-option scent-${scent} ${scent === id ? 'is-current' : ''}" data-scent-link href="${path(lang, `products/${scent}/`)}" ${scent === id ? 'aria-current="page"' : ''}><i class="scent-dot" aria-hidden="true"></i><span>${t.names[scent]}</span></a>`).join('')}</div></fieldset>
      <div class="product-price-line"><strong class="product-price" data-product-price data-price aria-label="${t.productPriceLabel}">${formatPrice(1250, lang)}</strong><span class="unit-price"><span data-unit-price>${formatPrice(5000, lang)}</span> / l · 250 ml</span></div>
      <div class="product-add-line"><div class="quantity-control"><button type="button" data-quantity="-1" disabled aria-label="${L(lang, 'Menge reduzieren', 'Decrease quantity')}">${icon('minus')}</button><input name="quantity" type="number" min="1" max="20" value="1" inputmode="numeric" aria-label="${t.quantity}"><button type="button" data-quantity="1" aria-label="${L(lang, 'Menge erhöhen', 'Increase quantity')}">${icon('plus')}</button></div><button class="button product-add" type="submit"><span data-add-label>${t.formatAdd.shampoo}</span>${icon('bag')}</button></div>
      <p class="product-format-note" data-format-note>${t.formatNote.shampoo}</p>
      <div class="product-dock" data-product-dock><div><span data-product-dock-label>${t.names[id]} / 250 ml</span><strong data-product-price>${formatPrice(1250, lang)}</strong></div><button class="button" type="submit"><span>${t.add}</span>${icon('bag')}</button></div>
    </form>`;
  }

  function productGallery(lang, id = 'aloe', eager = false) {
    const t=shopCopy[lang];
    return `<div class="product-gallery"><div class="product-gallery__primary"><span class="product-gallery__word" data-scent="${id}" aria-hidden="true">${t.names[id]}</span>${viewer(lang,'product',id,'product-viewer',eager,'detail')}<span class="product-gallery__volume">250 ML</span></div><fieldset class="product-format"><legend class="sr-only">${L(lang,'Produkt wählen','Choose a product')}</legend><div class="format-options">${['shampoo','refill'].map(format=>`<label class="format-option"><input type="radio" form="product-form-${id}" name="format" value="${format}" ${format==='shampoo'?'checked':''}><span><span class="format-option__head"><strong>${t[format]}</strong><b>${price(format,lang)}</b></span><small>${format==='shampoo'?L(lang,'Das komplette Produkt','The complete product'):L(lang,'Der gefüllte Einsatz','The filled insert')}</small></span></label>`).join('')}</div></fieldset><p class="product-gallery__hint">${L(lang,'Ziehen zum Drehen','Drag to rotate')}</p></div>`;
  }

  function product(lang, id) {
    const t = shopCopy[lang];
    const acc = lang === 'de' ? [
      ['Was ist enthalten?', '<p>Starter-Set: Bambushülle, Silikonkappe und ein gefüllter 250-ml-Einsatz mit Siegelfolie.</p><p>Refill: der gefüllte 250-ml-Einsatz mit Siegelfolie. Deine Hülle und Kappe verwendest du weiter.</p>'],
      ['Wie funktioniert die Kappe?', '<p>Die Mitte ist Teil der flexiblen Silikonkappe. Beim Drücken gibt die Oberfläche nach. Die ringgelagerte Verschlusslasche wird aus der Öffnung gelöst und zur Seite gedreht.</p>'],
      ['Duft & Inhaltsstoffe', `<p>${t.scentDescriptions[id]}</p><p>Die vollständige Inhaltsstoffliste und verbindliche Anwendungshinweise werden vor Verkaufsstart ergänzt.</p>`],
      ['Was bleibt beim Refill?', '<p>Bambushülle und Silikonkappe. Der leere PET-Einsatz wird entnommen. Der neue Einsatz sitzt mit seinem oberen Rand auf dem Tubusrand. Seine Siegelfolie wird vor der Verwendung vollständig abgezogen.</p>']
    ] : [
      ['What is included?', '<p>Starter set: bamboo shell, silicone cap and a filled 250 ml insert with a film seal.</p><p>Refill: the filled 250 ml insert with a film seal. Keep your shell and cap.</p>'],
      ['How does the cap work?', '<p>The centre is part of the flexible silicone cap. The surface yields when pressed. The ring-mounted closure lifts out of the opening and turns aside.</p>'],
      ['Scent & ingredients', `<p>${t.scentDescriptions[id]}</p><p>The full ingredient list and final directions will be added before sales begin.</p>`],
      ['What do I keep for a refill?', '<p>The bamboo shell and silicone cap. Remove the empty PET insert. The new insert rests on the tube rim with its upper flange. Remove its film seal completely before use.</p>']
    ];
    return `<main id="main" class="pdp-page scent-${id}">
      <nav class="breadcrumb section-shell" aria-label="${L(lang, 'Seitenpfad', 'Breadcrumb')}"><a href="${path(lang)}">${t.home}</a><span aria-hidden="true">/</span><a href="${path(lang, 'shop/')}">Shop</a><span aria-hidden="true">/</span><span aria-current="page">${t.names[id]}</span></nav>
      <section class="product-layout section-shell">
        ${productGallery(lang, id, true)}
        <div class="product-config"><div>${eyebrow('BAMBOO SHAMPOO / 250 ML')}<h1 class="display" data-detail-scent>${t.names[id]}</h1><p class="scent-subtitle">${t.scentWords[id]}</p><p class="product-scent-copy">${t.scentDescriptions[id]}</p></div>${productForm(lang, id)}<div class="product-details faq-list" id="product-details">${accordions(acc, `${id}-detail`)}</div></div>
      </section>
      <section class="format-chapter section-shell"><h2 class="display" data-reveal">${L(lang, 'Dein Bamboo.<br>Immer wieder.', 'Your Bamboo.<br>Again and again.')}</h2><div data-reveal><p>${L(lang, '250 ml im transparenten PET-Einsatz. Deine Hülle und die Dosierkappe bleiben für das nächste Refill.', '250 ml in a transparent PET insert. Your shell and dosing cap stay for the next refill.')}</p>${button(path(lang, 'refill/'), L(lang, 'Das Refill-System', 'Explore the refill system'))}</div></section>
      ${ritual(lang, 'product', id)}
      <section class="section-shell related-products"><div class="section-heading" data-reveal><div>${eyebrow(L(lang, 'MEHR ENTDECKEN', 'EXPLORE MORE'))}<h2 class="display">${L(lang, 'Die anderen<br>beiden.', 'Meet the<br>other two.')}</h2></div>${link(path(lang, 'shop/'), L(lang, 'Die ganze Kollektion', 'The full collection'))}</div><div class="collection-grid collection-grid--two">${scentCards(lang, 'shampoo', orderedScents.filter(scent => scent !== id))}</div></section>
    </main>`;
  }

  function story(lang) {
    return `<main id="main" class="story-page">
      <section class="section-shell story-intro"><div data-reveal>${eyebrow('BAMBOO / SILICONE / PET')}<h1 class="display">${L(lang, 'Drei Teile.<br>Ein Bamboo.', 'Three parts.<br>One Bamboo.')}</h1></div><p class="lede" data-reveal>${L(lang, 'Die Hülle bleibt. Der Einsatz wechselt. Dazwischen: Details, die genau zusammenpassen.', 'The shell stays. The insert changes. Between them: details designed to fit.')}</p></section>
      <section class="story-product-stage scent-aloe">${viewer(lang, 'product', 'aloe', 'story-product', true, 'campaign')}<span class="story-product-stage__word" aria-hidden="true">KEEP IT.</span><a class="text-link" href="${BASE}/assembly/" data-native-route><span>${L(lang, 'Die Konstruktion in Bewegung', 'See the construction in motion')}</span>${icon('arrow')}</a></section>
      <section class="section-shell story-components"><div class="component-list">
        <article class="component-row" data-reveal><div class="component-row__copy">${eyebrow('BAMBOO')}<h2 class="display">${L(lang, 'Die Hülle.', 'The shell.')}</h2><p>${L(lang, 'Bambus mit gelaserter Gravur. Der zylindrische Tubus nimmt den PET-Einsatz auf. Oben schließen Kappe und Rand bündig aneinander an.', 'Bamboo with laser engraving. The cylindrical tube holds the PET insert. At the top, the cap meets the rim in a flush fit.')}</p><p class="component-row__caption">${L(lang, 'FÜR DAS NÄCHSTE REFILL BEHALTEN', 'KEEP FOR THE NEXT REFILL')}</p></div><figure class="component-row__art scent-aloe">${viewer(lang, 'shell', 'aloe', 'component-viewer')}<figcaption class="scene-hint">${L(lang, 'Ziehen zum Drehen', 'Drag to rotate')}</figcaption></figure></article>
        <article class="component-row component-row--reverse" data-reveal><div class="component-row__copy">${eyebrow('SILICONE')}<h2 class="display">${L(lang, 'Die Kappe.', 'The cap.')}</h2><p>${L(lang, 'Die Mitte ist Teil der Kappe. Beim Drücken biegt sich die Silikonoberfläche. Der kreisrunde Ring lässt die Verschlusslasche um die Mitte schwenken.', 'The centre is part of the cap. Pressing it bends the silicone surface. The circular ring lets the closure swivel around the centre.')}</p><p class="component-row__caption">PRESS TO DOSE.</p></div><figure class="component-row__art scent-argan">${viewer(lang, 'cap', 'argan', 'component-viewer')}</figure></article>
        <article class="component-row" data-reveal><div class="component-row__copy">${eyebrow('PET / 250 ML')}<h2 class="display">${L(lang, 'Das Refill.', 'The refill.')}</h2><p>${L(lang, 'Dünn und transparent. Der umlaufende obere Rand liegt auf der Bambushülle auf. Darauf sitzt die Folie, die vor der Verwendung vollständig abgezogen wird.', 'Thin and transparent. The upper flange rests on the bamboo shell. It holds the film that peels off completely before use.')}</p>${link(path(lang, 'refill/'), L(lang, 'Der nächste Einsatz', 'Meet your next insert'))}</div><figure class="component-row__art scent-aloe" data-world="aloe" data-world-kind="refill">${viewer(lang, 'refill', 'aloe', 'component-viewer')}</figure></article>
      </div></section>
      ${closing(lang)}
    </main>`;
  }

  function faqItems(lang) {
    return lang === 'de' ? [
      ['Welche Düfte gibt es?', '<p>Aloe, Argan und Bamboo. Jeden Duft gibt es als Starter-Set mit Bambushülle und als gefülltes 250-ml-Refill.</p>'],
      ['Was ist im Starter-Set enthalten?', `<p>Für ${formatPrice(1250, lang)}: Bambushülle, wiederverwendbare Silikonkappe und ein gefüllter 250-ml-PET-Einsatz mit abziehbarer Siegelfolie.</p>`],
      ['Was kostet ein Refill — und was ist enthalten?', `<p>Ein 250-ml-Refill kostet ${formatPrice(450, lang)}. Es besteht aus dem gefüllten, transparenten PET-Einsatz mit Siegelfolie. Deine Bambushülle und Kappe verwendest du weiter.</p>`],
      ['Wie wechsle ich den Einsatz?', `<p>Kappe abnehmen, den leeren Einsatz entnehmen und das neue Refill einsetzen. Den Folienverschluss vor der Verwendung vollständig abziehen und die vorhandene Kappe wieder aufsetzen.</p><p>${link(path(lang, 'refill/'), 'Den Refill-Wechsel erleben')}</p>`],
      ['Ist das Refill eine flexible Nachfüllpackung?', '<p>Es ist ein dünner, transparenter PET-Einsatz, der direkt in die Bambushülle passt. Sein oberer Rand liegt auf dem Tubusrand auf und trägt die Siegelfolie.</p>'],
      ['Wie öffnet sich die Dosierkappe?', '<p>Die Verschlusslasche wird aus der Öffnung gelöst und zur Seite gedreht. Ihr Ring kann sich um die Mitte bewegen. Die flexible Mitte selbst gehört zur Silikonkappe und biegt die Oberfläche beim Drücken.</p>'],
      ['Wo finde ich die Inhaltsstoffe?', '<p>Aloe, Argan und Bamboo sind die Namen der Düfte. Die vollständigen Inhaltsstofflisten und finalen Anwendungshinweise werden vor Verkaufsstart ergänzt.</p>'],
      ['Kann ich in dieser Vorschau bestellen?', '<p>Du kannst Produkte auswählen und einen vollständigen Demo-Checkout mit fiktiven Angaben durchspielen. Es entstehen keine Bestellungen oder Zahlungen. Persönliche Kundendaten werden nicht abgefragt.</p>'],
      ['Wo wird meine Auswahl gespeichert?', '<p>Deine Auswahl bleibt für diese Browsersitzung lokal im Browser. Es gibt dafür kein Kundenkonto. Ohne Browserspeicher funktioniert die Tasche während des geöffneten Besuchs weiter.</p>']
    ] : [
      ['Which scents are available?', '<p>Aloe, Argan and Bamboo. Each scent comes as a starter set with the bamboo shell and as a filled 250 ml refill.</p>'],
      ['What is included in the starter set?', `<p>For ${formatPrice(1250, lang)}: the bamboo shell, reusable silicone cap and a filled 250 ml PET insert with a peel-off film seal.</p>`],
      ['How much is a refill — and what is included?', `<p>A 250 ml refill costs ${formatPrice(450, lang)}. It contains the filled, transparent PET insert with a film seal. Your bamboo shell and cap are reused.</p>`],
      ['How do I replace the insert?', `<p>Take off the cap, remove the empty insert and put the new refill in. Peel off the film seal completely before use, then put your existing cap back on.</p><p>${link(path(lang, 'refill/'), 'Watch the refill change')}</p>`],
      ['Is the refill a flexible refill pouch?', '<p>It is a thin, transparent PET insert that fits directly inside the bamboo shell. Its upper flange rests on the tube rim and holds the film seal.</p>'],
      ['How does the dosing cap open?', '<p>The closure lifts out of the opening and turns aside. Its ring can rotate around the centre. The flexible centre itself belongs to the silicone cap and bends the surface when pressed.</p>'],
      ['Where can I find the ingredients?', '<p>Aloe, Argan and Bamboo are the scent names. Full ingredient lists and final directions will be added before sales begin.</p>'],
      ['Can I order from this preview?', '<p>Choose products and try the complete demo checkout with fictional details. No orders or payments are made, and no personal customer information is requested.</p>'],
      ['Where is my selection saved?', '<p>Your selection stays locally in the browser for this browsing session. There is no customer account. If browser storage is unavailable, the bag still works during the open visit.</p>']
    ];
  }

  function faq(lang) {
    return `<main id="main" class="faq-page"><section class="section-shell faq-intro"><div data-reveal>${eyebrow(L(lang, 'FRAGEN & ANTWORTEN', 'QUESTIONS & ANSWERS'))}<h1 class="display">${L(lang, 'Gut zu<br>wissen.', 'Good to<br>know.')}</h1></div><p class="lede" data-reveal>${L(lang, 'Düfte, Formate und die Details des Refill-Systems. Hier findest du die Antworten.', 'Scents, formats and the details of the refill system. Here are the answers.')}</p></section><section class="section-shell faq-layout"><aside class="faq-aside">${eyebrow('KEEP. REFILL. REPEAT.')}<p>${L(lang, 'Sieh das Produkt in Bewegung — vom ersten Öffnen bis zum nächsten Einsatz.', 'See the product in motion — from its first opening to the next insert.')}</p>${link(path(lang, 'refill/'), L(lang, 'Zum Refill-System', 'Explore the refill system'))}${link(path(lang, 'shop/'), L(lang, 'Zur Kollektion', 'Explore the collection'))}</aside><div class="faq-list">${accordions(faqItems(lang), 'faq-answer')}</div></section>${closing(lang)}</main>`;
  }

  function checkout(lang) { return createCheckoutPage({BASE,icon,esc,lang}); }

  const withReturn = (lang, body) => body.replace(/<main\b[^>]*>/, opening => `${opening}<a class="journey-resume" href="${path(lang)}?resume=1" data-resume-journey hidden><span>${L(lang, 'Entdecken fortsetzen', 'Resume your journey')}</span>${icon('arrow')}</a>`);
  return Object.fromEntries(['de', 'en'].map(lang => [lang, {
    home: home(lang), collection: withReturn(lang, collection(lang)), refill: withReturn(lang, refill(lang)),
    story: withReturn(lang, story(lang)), faq: withReturn(lang, faq(lang)), checkout: withReturn(lang, checkout(lang)),
    products: Object.fromEntries(orderedScents.map(id => [id, withReturn(lang, product(lang, id))]))
  }]));
}
