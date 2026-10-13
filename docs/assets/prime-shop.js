import {normalizeBookmark,normalizeChoice} from './journey.js?v=shop-20261013-jury4';
import {scenePreviewAsset,paintScenePreviewWorld} from './scene-preview.js?v=shop-20261013-jury4';
import {scenePreviewBox} from './scene-framing.js?v=shop-20261013-jury4';

// Serialized into the static document and run before its first paint. The main
// controller uses the same validators, image names and camera calculations.
// A saved return link, scent, or ?format=refill must not reflow a visible page
// several seconds later when the full interactive module has downloaded.
export function primeShop({doc,storage,href,ui}){
  const read=key=>{try{return JSON.parse(storage.getItem(key));}catch{return null;}};
  const main=doc.querySelector('main'),form=doc.querySelector('main.pdp-page [data-product-form]');
  const format=new URL(href).searchParams.get('format');
  const choice=normalizeChoice(form?{scent:form.dataset.id,format}:read('bamboo-journey-choice-v1'));
  doc.documentElement.dataset.selectedScent=choice.scent;
  const bookmark=normalizeBookmark(read('bamboo-journey-return-v1'));
  for(const link of doc.querySelectorAll('[data-resume-journey]')){
    link.hidden=!!main?.hasAttribute('data-journey')||!bookmark;
    if(bookmark)link.href=`${ui.base}/${ui.lang}/?resume=1#${bookmark.chapter}`;
  }
  for(const world of doc.querySelectorAll('[data-world]')){
    world.dataset.world=choice.scent;
    world.classList.remove('scent-aloe','scent-argan','scent-bamboo');world.classList.add(`scent-${choice.scent}`);
    world.querySelectorAll('[data-world-name]').forEach(el=>el.textContent=ui.names[choice.scent]);
    world.querySelectorAll('[data-world-description]').forEach(el=>el.textContent=ui.scentDescriptions[choice.scent]);
    world.querySelectorAll('[data-world-link]').forEach(el=>el.href=`${ui.base}/${ui.lang}/products/${choice.scent}/${el.dataset.worldFormat==='refill'?'?format=refill':''}`);
  }
  doc.querySelectorAll('[data-world-scent]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.worldScent===choice.scent)));
  if(form){
    form.elements.format.value=choice.format;
    const value=choice.format==='refill'?450:1250;
    const money=cents=>new Intl.NumberFormat(ui.lang==='de'?'de-DE':'en-GB',{style:'currency',currency:'EUR'}).format(cents/100);
    form.querySelectorAll('[data-product-price],[data-price]').forEach(el=>el.textContent=money(value));
    form.querySelector('[data-unit-price]').textContent=money(value*4);
    form.querySelector('[data-add-label]').textContent=ui.formatAdd[choice.format];
    form.querySelector('[data-format-note]').textContent=ui.formatNote[choice.format];
  }
  for(const element of doc.querySelectorAll('[data-shop-scene].scene-preview')){
    const campaign=element.dataset.artDirection==='campaign',mode=form&&element.classList.contains('product-viewer')
      ?choice.format==='refill'?'refill':'product':element.dataset.shopScene;
    const scent=form?form.dataset.id:choice.scent;
    element.dataset.scent=scent;element.dataset.requestedMode=mode;
    const image=element.querySelector('img'),name=scenePreviewAsset({mode,scent,campaign});
    if(image&&name){image.src=`${ui.base}/assets/${name}?v=${ui.version}`;const label=ui.productGallery?.[mode];if(label){image.alt=label;element.setAttribute('aria-label',label);}}
    const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)continue;
    const frame=scenePreviewBox({width:rect.width,height:rect.height,mode,campaign,reserved:!!element.closest('.campaign-hero')});
    for(const [name,value] of Object.entries(frame))element.style.setProperty(`--preview-${name}`,`${value}${name==='rotation'?'deg':'px'}`);
    paintScenePreviewWorld(element,{width:rect.width,height:rect.height,scent,campaign,doc});
  }
}
