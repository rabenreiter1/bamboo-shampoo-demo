/** A browser-only checkout demonstration. No customer or payment input fields. */
export function createCheckoutPage({ BASE, icon, esc, lang }) {
  const de = lang === 'de';
  const text = (german, english) => de ? german : english;
  const path = route => `${BASE}/${lang}/${route}`;
  const button = (label, attributes = '', secondary = false) => `<button type="button" class="button ${secondary ? 'button--outline' : ''}" ${attributes}><span>${label}</span>${icon('arrow')}</button>`;
  const back = step => `<button type="button" class="checkout-back" data-checkout-step="${step}">${icon('arrow')}<span>${text('Zurück', 'Back')}</span></button>`;
  const link = (href, label) => `<a class="text-link" href="${href}" data-native-route><span>${label}</span>${icon('arrow')}</a>`;
  const option = (name, value, title, detail, art, checked = false) => `<label class="checkout-card-option"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span class="checkout-card-option__art" aria-hidden="true">${icon(art)}</span><span class="checkout-card-option__copy"><strong>${title}</strong><small>${detail}</small></span><span class="checkout-card-option__check" aria-hidden="true">${icon('check')}</span></label>`;
  const edit = (step, label) => `<button type="button" class="checkout-edit" data-checkout-step="${step}" aria-label="${esc(label)}">${text('Ändern', 'Edit')}</button>`;

  return `<main id="main" class="checkout-page" data-checkout-root>
    <section class="section-shell checkout-heading">
      <div><p class="eyebrow">${text('DEIN NÄCHSTES RITUAL', 'YOUR NEXT RITUAL')}</p><h1 class="display">${text('FAST<br>DEIN.', 'ALMOST<br>YOURS.')}</h1></div>
      <div><p class="lede">${text('Ein Duft. Ein Anfang. Ein Bamboo, das bleibt.', 'A scent. A beginning. A Bamboo to keep.')}</p><p class="checkout-demo-note">${text('Demo-Checkout · Keine Bestellung. Keine Zahlung.', 'Demo checkout · No orders. No payments.')}</p></div>
    </section>
    <section class="section-shell checkout-flow" aria-label="${text('Demo-Checkout', 'Demo checkout')}">
      <ol class="checkout-steps" aria-label="${text('Schritte', 'Checkout steps')}">
        ${[['selection', text('Auswahl', 'Selection')], ['delivery', text('Zustellung', 'Delivery')], ['payment', text('Zahlung', 'Payment')], ['review', text('Prüfen', 'Review')]].map(([id, label], index) => `<li><button type="button" data-checkout-step="${id}" ${index ? 'disabled' : 'aria-current="step"'}><span class="checkout-step__number" aria-hidden="true">0${index + 1}</span><span>${label}</span></button></li>`).join('')}
      </ol>
      <p class="checkout-status sr-only" data-checkout-status role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="checkout-layout">
        <div class="checkout-main">
          <section class="checkout-panel" data-checkout-panel="selection" aria-labelledby="checkout-selection-title">
            <div class="checkout-panel__header"><p class="eyebrow">01 / ${text('AUSWAHL', 'SELECTION')}</p><h2 id="checkout-selection-title" tabindex="-1">${text('Deine Tasche.', 'Your bag.')}</h2><p>${text('Dein Duft, dein Format, deine Menge.', 'Your scent, your format, your quantity.')}</p></div>
            <div class="checkout-line-items" data-checkout-items></div>
            <div class="checkout-empty" data-checkout-empty><span aria-hidden="true">${icon('bag')}</span><h3>${text('Noch Platz für deinen Duft.', 'Room for your scent.')}</h3><p>${text('Entdecke die drei Düfte und beginne dein Ritual.', 'Discover the three scents and begin your ritual.')}</p>${link(path('shop/'), text('Die Kollektion entdecken', 'Explore the collection'))}</div>
            <div class="checkout-actions" data-checkout-nonempty hidden>${link(path('shop/'), text('Weiter entdecken', 'Keep exploring'))}${button(text('Zur Zustellung', 'Continue to delivery'), 'data-checkout-next')}</div>
          </section>
          <section class="checkout-panel" data-checkout-panel="delivery" aria-labelledby="checkout-delivery-title" hidden>
            <div class="checkout-panel__header"><p class="eyebrow">02 / ${text('ZUSTELLUNG', 'DELIVERY')}</p><h2 id="checkout-delivery-title" tabindex="-1">${text('Der Weg zu dir.', 'On its way to you.')}</h2><p>${text('Erlebe den nächsten Schritt mit einer fiktiven Adresse.', 'Try the next step with a fictional address.')}</p></div>
            <fieldset class="checkout-options"><legend class="sr-only">${text('Demo-Zustellung wählen', 'Choose demo delivery')}</legend>
              ${option('demo-delivery', 'standard', text('An die Beispieladresse', 'To the sample address'), text('Demo-Zustellung · 0,00 €', 'Demo delivery · €0.00'), 'arrow', true)}
              ${option('demo-delivery', 'pickup', text('An den Beispiel-Abholpunkt', 'To the sample pickup point'), text('Demo-Abholung · 0,00 €', 'Demo pickup · €0.00'), 'bag')}
            </fieldset>
            <div class="checkout-demo-address"><p class="eyebrow">${text('FIKTIVES BEISPIEL', 'FICTIONAL EXAMPLE')}</p><p data-checkout-address>${text('Alex Beispiel<br>Musterstraße 12<br>10115 Berlin', 'Alex Example<br>12 Sample Street<br>10115 Berlin')}</p><small>${text('Keine echten Adressdaten nötig. Versandart und Kosten dienen nur der Simulation.', 'No real address needed. Delivery options and charges are for this simulation only.')}</small></div>
            <div class="checkout-actions">${back('selection')}${button(text('Zur Zahlung', 'Continue to payment'), 'data-checkout-next')}</div>
          </section>
          <section class="checkout-panel" data-checkout-panel="payment" aria-labelledby="checkout-payment-title" hidden>
            <div class="checkout-panel__header"><p class="eyebrow">03 / ${text('ZAHLUNG', 'PAYMENT')}</p><h2 id="checkout-payment-title" tabindex="-1">${text('Ein Klick entfernt.', 'One click closer.')}</h2><p>${text('Wähle eine Demo-Zahlungsart. Es wird nichts abgebucht.', 'Choose a demo payment method. Nothing will be charged.')}</p></div>
            <fieldset class="checkout-options"><legend class="sr-only">${text('Demo-Zahlungsart wählen', 'Choose demo payment')}</legend>
              ${option('demo-payment', 'card', text('Demo-Karte', 'Demo card'), text('Beispielkarte · •••• 4242', 'Sample card · •••• 4242'), 'check', true)}
              ${option('demo-payment', 'wallet', 'Demo-Wallet', text('Ein simulierter Wallet-Abschluss', 'A simulated wallet checkout'), 'circle')}
            </fieldset>
            <p class="checkout-payment-note">${text('Keine Kartendaten. Keine Verbindung zu Zahlungsdiensten.', 'No card details. No connection to payment services.')}</p>
            <div class="checkout-actions">${back('delivery')}${button(text('Auswahl prüfen', 'Review selection'), 'data-checkout-next')}</div>
          </section>
          <section class="checkout-panel" data-checkout-panel="review" aria-labelledby="checkout-review-title" hidden>
            <div class="checkout-panel__header"><p class="eyebrow">04 / ${text('PRÜFEN', 'REVIEW')}</p><h2 id="checkout-review-title" tabindex="-1">${text('Alles in deinem Duft.', 'Everything in your scent.')}</h2><p>${text('Ein letzter Blick, bevor du die Demo abschließt.', 'One last look before completing the demo.')}</p></div>
            <div class="checkout-review-block"><div><h3>${text('Deine Auswahl', 'Your selection')}</h3>${edit('selection', text('Produktauswahl ändern', 'Edit your products'))}</div><div data-checkout-review-items></div></div>
            <div class="checkout-review-block"><div><h3>${text('Demo-Zustellung', 'Demo delivery')}</h3>${edit('delivery', text('Demo-Zustellung ändern', 'Edit demo delivery'))}</div><p data-checkout-review-delivery></p></div>
            <div class="checkout-review-block"><div><h3>${text('Demo-Zahlung', 'Demo payment')}</h3>${edit('payment', text('Demo-Zahlung ändern', 'Edit demo payment'))}</div><p data-checkout-review-payment></p></div>
            <label class="checkout-consent"><input type="checkbox" data-checkout-accept><span>${text('Ich möchte die Demo abschließen. Es entsteht keine Bestellung und keine Zahlung.', 'I want to complete the demo. No order will be placed and no payment will be made.')}</span></label>
            <div class="checkout-actions">${back('payment')}${button(text('Demo abschließen', 'Complete demo'), 'data-checkout-submit disabled')}</div>
          </section>
          <section class="checkout-panel checkout-receipt" data-checkout-panel="complete" aria-labelledby="checkout-complete-title" hidden>
            <div class="checkout-receipt__mark" aria-hidden="true">${icon('check')}</div><p class="eyebrow">${text('DEMO ABGESCHLOSSEN', 'DEMO COMPLETE')}</p><h2 id="checkout-complete-title" tabindex="-1">${text('Ein guter<br>Anfang.', 'A fresh<br>beginning.')}</h2>
            <p class="checkout-receipt__intro">${text('So fühlt sich dein neues Ritual an. Danke fürs Entdecken.', 'This is how your new ritual begins. Thanks for exploring.')}</p>
            <p class="checkout-receipt__reference"><span>${text('Demo-Referenz', 'Demo reference')}</span><strong data-checkout-reference></strong></p>
            <p class="checkout-demo-note">${text('Simulation beendet. Keine Bestellung, keine Zahlung, kein Versand.', 'Simulation complete. No order, no payment, no shipment.')}</p>
            <div class="checkout-actions"><a class="button" href="${path('')}" data-native-route><span>${text('Zurück zum Ritual', 'Return to the ritual')}</span>${icon('arrow')}</a>${link(path('shop/'), text('Weiter entdecken', 'Keep exploring'))}</div>
          </section>
        </div>
        <aside class="checkout-summary" aria-labelledby="checkout-summary-title">
          <p class="eyebrow">BAMBOO SHAMPOO</p><h2 id="checkout-summary-title">${text('Dein Ritual.', 'Your ritual.')}</h2><p class="checkout-summary__count" data-checkout-count></p>
          <div class="checkout-summary__preview" data-checkout-summary-preview></div>
          <dl class="checkout-summary__totals">
            <div class="checkout-summary__row"><dt>${text('Produkte', 'Products')}</dt><dd data-checkout-subtotal>0,00 €</dd></div>
            <div class="checkout-summary__row"><dt>${text('Demo-Zustellung', 'Demo delivery')}</dt><dd data-checkout-shipping>0,00 €</dd></div>
            <div class="checkout-summary__row checkout-summary__row--total"><dt>${text('Demo-Gesamtsumme', 'Demo total')}</dt><dd data-checkout-total>0,00 €</dd></div>
          </dl><p class="checkout-summary__note">${text('Reine Design-Simulation. Zustellung mit 0,00 € illustriert den Ablauf und ist kein Versandangebot.', 'A design simulation. The €0.00 delivery charge illustrates the flow and is not a shipping offer.')}</p>
        </aside>
      </div>
      <noscript><p>${text('Die Demo-Kasse benötigt JavaScript. Die Kollektion kannst du weiterhin entdecken.', 'The demo checkout needs JavaScript. You can still explore the collection.')}</p>${link(path('shop/'), text('Zur Kollektion', 'Explore the collection'))}</noscript>
    </section>
  </main>`;
}
