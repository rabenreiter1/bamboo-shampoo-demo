import {normalizeBookmark,normalizeChoice} from './journey.js?v=modern-20261016-1';
import {scenePreviewAsset,paintScenePreviewWorld} from './scene-preview.js?v=modern-20261016-1';
import {scenePreviewBox,playbackPreviewBox,classicGuideRegion} from './scene-framing.js?v=modern-20261016-1';
import {primeProductPhotos} from './product-photos.js?v=modern-20261016-1';
import {syncRelatedFormat} from './commerce.js?v=modern-20261016-1';

// This changes only the loading illustration, never the stored pose. A closed
// poster must not contradict a restored, open or manually rotated product.
export function needsPlaybackRestorePreview(snapshot,profile){
  const duration=profile==='home-cycle'?32:profile==='refill-teaser'?14:profile==='hero-intro'?16:0;
  if(!duration||!snapshot||snapshot.version!==1||snapshot.profile!==profile
    ||!Number.isFinite(snapshot.elapsed)||snapshot.elapsed<0||typeof snapshot.paused!=='boolean'
    ||snapshot.yaw!==undefined&&!Number.isFinite(snapshot.yaw))return false;
  const elapsed=snapshot.elapsed%duration,yaw=snapshot.yaw||0;
  const rotated=Math.abs(Math.atan2(Math.sin(yaw),Math.cos(yaw)))>.0001;
  return rotated||(profile==='home-cycle'?elapsed>2&&elapsed<30:profile==='hero-intro'?elapsed>2&&elapsed<14:elapsed>.0001);
}

// Serialized into the static document and run before its first paint. The main
// controller uses the same validators, image names and camera calculations.
// A saved return link, scent, or ?format=refill must not reflow a visible page
// several seconds later when the full interactive module has downloaded.
export function primeShop({doc,storage,href,ui}){
  const read=key=>{try{return JSON.parse(storage.getItem(key));}catch{return null;}};
  const main=doc.querySelector('main'),form=doc.querySelector('main.pdp-page [data-product-form]');
  const format=new URL(href).searchParams.get('format');
  for(const link of doc.querySelectorAll('a.lang-switch,[data-language-route]')){
    const target=new URL(link.href,href);
    target.search=new URL(href).search;target.hash=new URL(href).hash;
    if(['refill','shampoo'].includes(format))target.searchParams.set('format',format);
    else target.searchParams.delete('format');
    link.href=target.href;
  }
  const choice=normalizeChoice(form?{scent:form.dataset.id,format}:read('bamboo-journey-choice-v1'),{scent:ui.design==='classic'?'bamboo':'aloe',format:'shampoo'});
  doc.documentElement.dataset.selectedScent=choice.scent;
  const routeBase=ui.routeBase||ui.base;
  const bookmark=normalizeBookmark(read(ui.bookmarkKey||(ui.design==='classic'?'bamboo-journey-return-v1:classic':'bamboo-journey-return-v1')),ui.bookmarkLayout||(ui.design==='classic'?'classic-scroll-guide-v1':undefined));
  for(const link of doc.querySelectorAll('[data-resume-journey]')){
    link.hidden=!!main?.hasAttribute('data-journey')||!bookmark;
    if(bookmark)link.href=`${routeBase}/${ui.lang}/?resume=1#${bookmark.chapter}`;
  }
  for(const world of doc.querySelectorAll('[data-world]')){
    world.dataset.world=choice.scent;
    world.classList.remove('scent-aloe','scent-argan','scent-bamboo');world.classList.add(`scent-${choice.scent}`);
    world.querySelectorAll('[data-world-name]').forEach(el=>el.textContent=ui.names[choice.scent]);
    world.querySelectorAll('[data-world-description]').forEach(el=>el.textContent=ui.scentDescriptions[choice.scent]);
    world.querySelectorAll('[data-world-link]').forEach(el=>el.href=`${routeBase}/${ui.lang}/products/${choice.scent}/${el.dataset.worldFormat==='refill'?'?format=refill':''}`);
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
    const label=ui[choice.format]||(choice.format==='refill'?'Refill':ui.lang==='de'?'Starter-Set':'Starter Set');
    doc.querySelectorAll('[data-product-dock-label]').forEach(el=>el.textContent=`${ui.names[form.dataset.id]} · ${label} · 250 ml`);
    doc.querySelectorAll('[data-product-dock-add]').forEach(el=>el.textContent=ui.formatAdd[choice.format]);
    syncRelatedFormat(doc,{format:choice.format,lang:ui.lang,base:ui.base,version:ui.version,names:ui.names,label});
  }
  primeProductPhotos({doc,base:ui.base,version:ui.version,choice});
  for(const element of doc.querySelectorAll('[data-shop-scene].scene-preview')){
    const campaign=element.dataset.artDirection==='campaign',mode=form&&(element.classList.contains('product-viewer')||element.closest('.product-gallery'))
      ?choice.format==='refill'?'refill':'product':element.dataset.shopScene;
    const scent=form?form.dataset.id:choice.scent,profile=element.dataset.previewProfile||element.closest('[data-playback-profile]')?.dataset.playbackProfile;
    if(profile){
      const id=element.closest('[data-playback-profile]')?.dataset.playbackId||profile;
      const snapshot=read(`bamboo-playback-v1:${id}`);
      const legacy=profile==='home-cycle'&&Number.isFinite(bookmark?.legacyAnimationProgress)&&bookmark.legacyAnimationProgress>0&&bookmark.legacyAnimationProgress<1;
      element.dataset.previewRestoring=String(needsPlaybackRestorePreview(snapshot,profile)||legacy);
    }
    if(profile==='ritual'){
      const section=element.closest('[data-ritual-scroll]'),sticky=section?.querySelector('.ritual-sticky');
      const header=doc.querySelector('.header')?.getBoundingClientRect().height||64;
      const box=section?.getBoundingClientRect(),height=sticky?.getBoundingClientRect().height;
      if(box&&height){const progress=Math.max(0,Math.min(1,(header-box.top)/Math.max(1,box.height-height)));
        element.dataset.previewRestoring=String(progress>1e-5&&progress<1-1e-5);}
    }
    element.dataset.scent=scent;element.dataset.requestedMode=mode;
    const image=element.querySelector('img'),name=scenePreviewAsset({mode,scent,campaign,profile});
    if(image&&name){image.src=`${ui.previewBase||`${ui.base}/assets`}/${name}?v=${ui.version}`;const label=ui.productGallery?.[mode];if(label){image.alt=label;element.setAttribute('aria-label',label);}}
    const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)continue;
    const classicGuide=mode==='journey'&&ui.design==='classic';
    const copyHeight=classicGuide?parseFloat(doc.defaultView?.getComputedStyle(element.closest('.product-journey__sticky')).getPropertyValue('--journey-copy-height')):undefined;
    const region=classicGuide?classicGuideRegion({width:rect.width,height:rect.height,copyHeight:copyHeight||undefined,viewportHeight:doc.defaultView?.innerHeight}):undefined;
    const frame=profile||classicGuide?playbackPreviewBox({width:rect.width,height:rect.height,profile,reserved:!!element.closest('.campaign-hero'),region})
      :scenePreviewBox({width:rect.width,height:rect.height,mode,campaign,reserved:!!element.closest('.campaign-hero')});
    for(const [name,value] of Object.entries(frame))element.style.setProperty(`--preview-${name}`,`${value}${name==='rotation'?'deg':'px'}`);
    paintScenePreviewWorld(element,{width:rect.width,height:rect.height,scent,campaign,doc});
  }
}
