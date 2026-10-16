import {productPhotoAsset} from '../assets/product-photos.js';
/** Presentation recovered from a5071f1. Commerce and corrected model factories stay current. */
export function createClassicPages({pages, BASE, routeBase=BASE, icon, fragrances, formatPrice, esc, version=''}) {
  const L=(lang,de,en)=>lang==='de'?de:en;
  const path=(lang,route='')=>`${routeBase}/${lang}/${route}`;
  const asset=name=>`${BASE}/assets/${name}?v=${version}`;
  const orderedScents=['aloe','argan','bamboo'].filter(id=>fragrances.includes(id));
  const price=(format,lang)=>formatPrice(format==='refill'?450:1250,lang);
  const eyebrow=text=>`<p class="eyebrow">${text}</p>`;
  const shopCopy={de:{names:{aloe:'Aloe',argan:'Argan',bamboo:'Bamboo'}},en:{names:{aloe:'Aloe',argan:'Argan',bamboo:'Bamboo'}}};
  const image=(name,alt,eager=false,cls='')=>`<img class="${cls}" src="${asset(name)}" alt="${esc(alt)}" width="1280" height="1600" ${eager?'loading="eager" fetchpriority="high"':'loading="lazy"'} decoding="async">`;
  const motionLoading = lang => `<div class="scene-loading" role="status" aria-live="polite"><span class="scene-loading__mark" aria-hidden="true"></span><span class="scene-loading__pending">${L(lang,'Dein Produkt wird vorbereitet.','Preparing your product.')}</span><span class="scene-loading__fallback">${L(lang,'Das Refill-Prinzip. Alle Schritte findest du unten.','The refill principle. Find every step below.')}</span></div>`;
  function viewer(lang, mode, scent, cls, eager) {
    return `<div class="photo-viewer classic-hero-photo ${cls}" data-product-photo-viewer data-photo-default-mode="${mode}" data-photo-default-scent="${scent}" data-photo-mode="${mode}" data-photo-scent="${scent}"><img class="product-photograph" data-product-photo src="${asset(productPhotoAsset(mode,scent))}" srcset="${asset(productPhotoAsset(mode,scent,true))} 640w, ${asset(productPhotoAsset(mode,scent))} 1280w" sizes="100vw" width="1280" height="1600" alt="${mode==='refill'?L(lang,'Versiegeltes 250-ml-Refill aus transparentem PET','Sealed 250 ml refill in clear PET'):L(lang,'Starter-Set mit Bambustubus und Silikonkappe','Starter set with bamboo tube and silicone cap')}" ${eager?'loading="eager" fetchpriority="high"':'loading="lazy"'} decoding="async"></div>`;
  }
  function replaceDiv(html,marker,replacement='') {
    const start=html.indexOf(marker);if(start<0)throw new Error(`Missing classic presentation marker: ${marker}`);
    const tags=/<\/?div\b[^>]*>/g;tags.lastIndex=start;
    let depth=0,tag;while((tag=tags.exec(html))){depth+=tag[0].startsWith('</')?-1:1;if(!depth)return html.slice(0,start)+replacement+html.slice(tags.lastIndex);}
    throw new Error(`Unbalanced classic presentation: ${marker}`);
  }
  function homeHero(lang) {
    const t = shopCopy[lang];
    return `<section class="campaign-hero campaign-hero--home scent-bamboo" id="discover" data-journey-chapter="discover" data-world="bamboo" data-world-kind="product">
      <div class="campaign-atmosphere" aria-hidden="true"></div>
      <div class="campaign-topline">${eyebrow('SHAMPOO, REDESIGNED.')}<span>250 ML / ALOE · ARGAN · BAMBOO</span></div>
      <div class="campaign-lettering" data-parallax="0.045"><h1 class="campaign-word">BAMBOO<span class="sr-only"> Shampoo</span></h1></div>
      ${viewer(lang, 'product', 'bamboo', 'campaign-product', true, 'campaign')}
      <div class="campaign-deck campaign-deck--home">
        <p class="hero-statement">${L(lang, '250 ml.<br>Immer wieder.', '250 ml.<br>Again & again.')}</p>
        <div class="campaign-switch" role="group" aria-label="${L(lang, 'Duft wählen', 'Choose your scent')}">${orderedScents.map(id => `<button class="world-choice scent-${id}" type="button" data-world-scent="${id}" aria-pressed="${id === 'bamboo'}"><span class="world-choice__swatch" aria-hidden="true"></span><span>${t.names[id]}</span></button>`).join('')}</div>
        <a class="hero-buy" href="${path(lang, 'products/bamboo/')}" data-world-link data-native-route><span><strong>${L(lang, 'Starter-Set entdecken', 'Discover your starter set')}</strong><small>250 ml · ${price('shampoo', lang)}</small></span><span class="hero-buy__arrow">${icon('arrow')}</span></a>
      </div>
      <a class="campaign-scroll" href="#collection"><span>${L(lang, 'Deinen Duft entdecken', 'Find your scent')}</span>${icon('down')}</a>
    </section>`;
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
    const chapters=[{id:'open',at:.07,until:.15,label:L(lang,'Öffnen','Open')},{id:'peel',at:.16,until:.27,label:L(lang,'Entsiegeln','Peel')},{id:'dose',at:.36,until:.72,label:L(lang,'Dosieren','Dispense')},{id:'refill',at:.735,until:.96,label:'Refill'}];
    const markers=chapters.map(chapter=>`<span id="ritual-${chapter.id}" class="product-journey__marker" data-journey-at="${chapter.at}" data-journey-until="${chapter.until}" aria-hidden="true"></span>`).join('');
    const navigation=`<nav class="guide-chapters" aria-label="${L(lang,'Animationsschritt wählen','Choose an animation step')}">${chapters.map((chapter,index)=>`<a href="#ritual-${chapter.id}" data-guide-chapter="${chapter.id}"><span aria-hidden="true">0${index+1}</span>${chapter.label}</a>`).join('')}</nav>`;
    return `<section id="ritual" class="product-journey product-journey--guide scent-bamboo" data-product-journey data-journey-chapter="ritual" data-world="bamboo" data-world-kind="product" aria-label="${L(lang,'So funktioniert Bamboo Shampoo','How Bamboo Shampoo works')}">${markers}<div class="product-journey__sticky"><div class="product-journey__stage scene-preview" data-shop-scene="journey" data-art-direction="journey" data-loading-state="neutral" data-preview-profile="home-cycle" data-scent="bamboo" role="group" aria-label="${L(lang,'Öffnen, Folie abziehen, dosieren und Refill wechseln','Open, peel, dispense and change the refill')}">${motionLoading(lang)}</div><div class="guide-heading"><span>${L(lang,'SO FUNKTIONIERT’S','HOW IT WORKS')}</span><a href="#collection">${L(lang,'Duft wählen','Choose a scent')}${icon('arrow')}</a></div><div class="product-journey__captions">${phases.map(caption).join('')}</div>${navigation}<div class="guide-progress" aria-hidden="true"><span></span></div></div></section>`;
  }

  return Object.fromEntries(['de','en'].map(lang=>{
    const current=pages[lang];
    const home=current.home.replace(/<section class="campaign-hero[^]*?(?=<section class="section-shell home-collection")/,homeHero(lang)+'\n').replace(/<section id="ritual"[^]*?(?=<section class="section-shell faq-tease")/,productJourney(lang)+'\n');
    // Refill's closed still replaces only its autoplay opening; detailed scrolling below remains.
    let refill=replaceDiv(current.refill,'<div class="refill-teaser-controls">');
    const oldStage=refill.match(/<div class="shop-scene[^>]*data-shop-scene="ritual"[^>]*>/)?.[0];
    refill=replaceDiv(refill,oldStage,viewer(lang,'refill','bamboo','campaign-product campaign-product--refill',true))
      .replace(/ data-playback-profile="refill-teaser"/g,'').replace('campaign-hero--refill scent-aloe','campaign-hero--refill scent-bamboo').replace('data-world="aloe"','data-world="bamboo"');
    return [lang,{...current,home,refill:refill.replace(/^[\t ]+$/gm,'')}];
  }));
}
