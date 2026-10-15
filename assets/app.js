import { createScenePreviews } from './scene-preview.js?v=shop-20261015-intro1';
import { sanitizeCart, prices, fragrances, formatPrice, productKey, cartTotal } from './catalog.js';
import { initializeNavigation } from './navigation.js?v=shop-20261015-intro1';
import { createSceneLoader } from './scene-loader.js?v=shop-20261015-intro1';
import { initializeJourney, normalizeBookmark } from './journey.js?v=shop-20261015-intro1';
import { initializePlayback, playbackAt, playbackTimeForProgress, PLAYBACK_VERSION } from './playback.js?v=shop-20261015-intro1';
import { BRAND_THEME } from './product-theme.js?v=shop-20261015-intro1';
import { needsPlaybackRestorePreview } from './prime-shop.js?v=shop-20261015-stills7';
import { productPhotoAsset, updateProductPhoto } from './product-photos.js?v=shop-20261015-stills7';
import { initializeProductJourney } from './journey-caption.js?v=shop-20261015-intro1';

const ui = JSON.parse(document.querySelector('#ui-copy').textContent);
const lang=ui.lang, de=lang==='de', base=ui.base;
const bag=document.querySelector('#bag-dialog'), menu=document.querySelector('#menu-dialog');
const KEY='bamboo-demo-bag-v1';
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
let journey, checkout;
initializeNavigation({base});
function readCart(fallback=[]){try{return sanitizeCart(JSON.parse(sessionStorage.getItem(KEY)||'[]'));}catch{return fallback;}}
let cart=readCart();
const icon=name=>`<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name==='bag'?'<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>':name==='minus'?'<path d="M5 12h14"/>':name==='plus'?'<path d="M5 12h14M12 5v14"/>':name==='check'?'<path d="m5 12 4 4L19 6"/>':'<path d="M4 12h16M13 5l7 7-7 7"/>'}</svg>`;
const clampQuantity=value=>Math.min(20,Math.max(1,Math.floor(Number(value)||1)));
const show=dialog=>{if(dialog&&!dialog.open)dialog.showModal();};

function itemMarkup(row){
 const key=productKey(row.scent,row.format);
 return `<article class="bag-item scent-${row.scent}" data-key="${key}"><img src="${base}/assets/${productPhotoAsset(row.format==='refill'?'refill':'product',row.scent,true)}" alt="${ui.names[row.scent]} · ${ui[row.format]}" width="80" height="114"><div><div class="bag-item-head"><h3><a href="${base}/${lang}/products/${row.scent}/${row.format==='refill'?'?format=refill':''}" data-native-route>${ui.names[row.scent]}</a></h3><span>${formatPrice(prices[row.format]*row.quantity,lang)}</span></div><p>${ui[row.format]} · 250 ml</p><div class="bag-item-actions"><div class="quantity-control"><button type="button" data-bag-change="-1" aria-label="${de?'Menge reduzieren':'Decrease quantity'}" ${row.quantity===1?'disabled':''}>${icon('minus')}</button><input aria-label="${ui.quantity}: ${ui.names[row.scent]} ${ui[row.format]}" type="number" min="1" max="20" value="${row.quantity}" inputmode="numeric" data-bag-quantity><button type="button" data-bag-change="1" aria-label="${de?'Menge erhöhen':'Increase quantity'}" ${row.quantity===20?'disabled':''}>${icon('plus')}</button></div><button type="button" class="bag-remove" data-remove>${ui.remove}</button></div></div></article>`;
}
function renderCart(){
 const count=cart.reduce((n,r)=>n+r.quantity,0), total=formatPrice(cartTotal(cart),lang);
 document.querySelectorAll('[data-count]').forEach(el=>el.textContent=count);
 document.querySelectorAll('[data-total],[data-review-total]').forEach(el=>el.textContent=total);
 const empty=`<div class="bag-empty">${icon('bag')}<h3>${ui.empty}</h3><p>${ui.emptyDesc}</p><a class="button" href="${base}/${lang}/shop/">${ui.explore}${icon('arrow')}</a></div>`;
 for(const items of document.querySelectorAll('#bag-items,[data-review-items]')) items.innerHTML=cart.length?cart.map(itemMarkup).join(''):empty;
 const review=bag?.querySelector('.bag-bottom .button');
 if(review){review.hidden=!cart.length;}
 if(review)review.setAttribute('aria-label',`${ui.review} · ${count} ${de?'Artikel':'items'} · ${total}`);
}
function save(){cart=sanitizeCart(cart);try{sessionStorage.setItem(KEY,JSON.stringify(cart));}catch{/* Local storage is optional. */}renderCart();checkout?.syncCart();}
function add(scent,format,quantity=1,open=false){
 if(!fragrances.includes(scent)||!Object.hasOwn(prices,format))return;
 const row=cart.find(r=>productKey(r.scent,r.format)===productKey(scent,format));
 const before=row?.quantity||0;
 if(row)row.quantity=Math.min(20,row.quantity+clampQuantity(quantity));else cart.push({scent,format,quantity:clampQuantity(quantity)});
 save();
 const toast=document.querySelector('.toast');
 toast.textContent=`${ui.names[scent]} · ${ui[format]} — ${ui.toast}`;toast.classList.add('visible');
 clearTimeout(add.timer);add.timer=setTimeout(()=>toast.classList.remove('visible'),2800);
 if(open)show(bag);
 return {added:(cart.find(r=>productKey(r.scent,r.format)===productKey(scent,format))?.quantity||0)-before};
}
function restoreItemFocus(container,key,selector){
 const remaining=container?.querySelector(`[data-key="${key}"]`);
 const fallback=container?.id==='bag-items'?bag?.querySelector('[data-close]'):container?.querySelector('a');
 const focus=remaining?.querySelector(selector+':not(:disabled)')||remaining?.querySelector('input')||container?.querySelector('[data-remove]')||fallback;
 focus?.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
 const target=event.target.closest('button,a');if(!target)return;
 if(target.hasAttribute('data-open-bag'))show(bag);
 if(target.hasAttribute('data-open-menu'))show(menu);
 if(target.hasAttribute('data-close'))target.closest('dialog')?.close();
 if(target.closest('#menu-dialog')&&target.tagName==='A')menu.close();
 if(target.hasAttribute('data-add')||target.hasAttribute('data-quick-add')){
  add(target.dataset.id||target.dataset.quickAdd,target.dataset.format||target.dataset.quickFormat||'shampoo');
  target.originalIcon??=target.innerHTML;target.innerHTML=icon('check');target.classList.add('is-added');clearTimeout(target.restoreTimer);target.restoreTimer=setTimeout(()=>{target.innerHTML=target.originalIcon;target.classList.remove('is-added');},1600);
 }
 if(target.hasAttribute('data-remove')||target.hasAttribute('data-bag-change')){
  const item=target.closest('[data-key]');if(!item)return;
  const key=item.dataset.key,container=item.parentElement,index=cart.findIndex(r=>productKey(r.scent,r.format)===key);
  if(index<0)return;
  if(target.hasAttribute('data-remove'))cart.splice(index,1);else cart[index].quantity=clampQuantity(cart[index].quantity+Number(target.dataset.bagChange));
  const selector=target.hasAttribute('data-remove')?'[data-remove]':`[data-bag-change="${target.dataset.bagChange}"]`;save();restoreItemFocus(container,key,selector);
 }
});
document.addEventListener('change',event=>{
 if(!event.target.hasAttribute('data-bag-quantity'))return;
 const item=event.target.closest('[data-key]'),key=item?.dataset.key,container=item?.parentElement;
 const row=cart.find(r=>productKey(r.scent,r.format)===key);if(row){row.quantity=clampQuantity(event.target.value);save();restoreItemFocus(container,key,'[data-bag-quantity]');}
});
for(const dialog of [bag,menu])dialog?.addEventListener('click',event=>{
 if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
});
renderCart();
if(document.querySelector('[data-checkout-root]')){
 import(`${base}/assets/checkout.js?v=${ui.version}`).then(({initializeCheckout})=>{
  checkout=initializeCheckout({lang,base,getCart:()=>sanitizeCart(cart),onCartChange:next=>{cart=sanitizeCart(next);save();},onComplete:()=>{cart=[];save();}});
 });
}

const viewers=new Map(), mounting=new WeakMap(), sceneSnapshots=new WeakMap();let sceneModule;
let sceneEpoch=0,pageActive=true;
const scenes=[...document.querySelectorAll('[data-shop-scene]')];
const scenePreviews=createScenePreviews({elements:scenes,base,version:ui.version});
const rituals=[...document.querySelectorAll('[data-ritual-scroll]')];
const playbacks=new Map([...document.querySelectorAll('[data-playback-profile]')].map(section=>[section,initializePlayback(section,{lang})]));
const playbackFor=element=>playbacks.get(element.closest('[data-playback-profile]'));
for(const controller of playbacks.values())controller.prepare();
try{const point=normalizeBookmark(JSON.parse(sessionStorage.getItem('bamboo-journey-return-v1')));
 if(Number.isFinite(point?.legacyAnimationProgress)){const controller=[...playbacks.values()].find(value=>value.getSnapshot().profile==='home-cycle');
 controller?.restore({version:PLAYBACK_VERSION,profile:'home-cycle',elapsed:playbackTimeForProgress('home-cycle',point.legacyAnimationProgress),paused:true,yaw:0});}
}catch{/* Denied storage does not prevent a fresh product journey. */}
const productJourneys=new Map([...document.querySelectorAll('[data-product-journey]')].map(section=>[section,initializeProductJourney(section)]));
if(!reduced.matches)for(const controller of productJourneys.values())controller.prepare();
function staticRitual(section){
 section.classList.add('ritual-static');
 section.querySelectorAll('[data-ritual-step]').forEach(el=>{el.removeAttribute('aria-hidden');el.classList.add('is-active');});
 const view=viewers.get(section.querySelector('[data-shop-scene]'));view?.setProgress(0);
 section.querySelectorAll('[data-ritual-step]').forEach(el=>el.inert=false);
}
function updateRitualCopy(section,progress){
 if(section.classList.contains('ritual-static'))return;
 const step=progress<.15?0:progress<.35?1:progress<.72?2:progress<.96?3:4;
 section.style.setProperty('--progress',String(progress));section.dataset.ritualStep=String(step);
 section.querySelectorAll('[data-ritual-step]').forEach(el=>{const active=Number(el.dataset.ritualStep)===step;el.classList.toggle('is-active',active);el.setAttribute('aria-hidden',String(!active));el.inert=!active;});
 const detail=section.querySelector('[data-ritual-detail]');
 if(detail){detail.dataset.detour=step===0?'materials':step===1?'refill':step===2?'materials':'refill';detail.dataset.detourTarget=step===2?'dose':'current';
  detail.querySelector('[data-ritual-detail-label]').textContent=de?(step===0?'Die drei Teile ansehen':step===1?'Folie & Rand ansehen':step===2?'Die Kappe genauer ansehen':'Das Refill genauer ansehen'):(step===0?'Explore the three parts':step===1?'Explore the seal & rim':step===2?'Explore the cap':'Explore the refill');}
}
async function mountScene(element){
 if(!pageActive||viewers.has(element)||mounting.has(element))return;
 if(reduced.matches&&(element.closest('[data-product-journey]')||playbackFor(element))){element.dataset.sceneStatus='static';return;}
 if(element.closest('dialog') && (!element.closest('dialog').open || element.closest('[data-detour-panel]')?.hidden))return;
 const token={epoch:sceneEpoch};mounting.set(element,token);
 const current=()=>pageActive&&token.epoch===sceneEpoch&&mounting.get(element)===token;
 try{
  sceneModule??=import(`${base}/assets/shop-scene.js?v=${ui.version}`);
  const {mountShopScene}=await sceneModule;
  if(!current())return;
  const section=element.closest('[data-ritual-scroll]');
  const productJourney=productJourneys.get(element.closest('[data-product-journey]'));
  const playback=playbackFor(element),playbackSnapshot=playback?.getSnapshot();
  const playbackProfile=playbackSnapshot?.profile;
  if(playback)element.dataset.previewRestoring=String(needsPlaybackRestorePreview(playbackSnapshot,playbackProfile));
  const mode=element.dataset.requestedMode||element.dataset.shopScene;
  const snapshot=sceneSnapshots.get(element);
  const campaignHero=element.closest('.campaign-hero');
  const productArt=element.closest('.product-gallery__primary');
  const view=mountShopScene(element,{mode,artDirection:element.dataset.artDirection,scent:element.dataset.scent,
   progress:playback?.getProgress()??snapshot?.progress??productJourney?.getProgress()??0,
   playbackProfile,automaticYaw:playbackSnapshot?playbackAt(playbackProfile,playbackSnapshot.elapsed).automaticYaw:undefined,
   cameraRegion:['home-cycle','hero-intro'].includes(playbackProfile)?{minX:.06,maxX:.94,minY:.05,maxY:.95,layout:'external'}:undefined,
   yaw:snapshot?.yaw??playbackSnapshot?.yaw??(element.hasAttribute('data-inspection')?Number(element.dataset.inspectionYaw)||0:0),
   zoom:snapshot?.zoom||1,reveal:1,poseProgress:snapshot?.pose||0,opaque:true,
   backdrop:campaignHero&&!campaignHero.classList.contains('intro-hero')?'campaign':productArt?'detail':undefined,
   backdropWord:campaignHero?(campaignHero.classList.contains('campaign-hero--refill')?'REFILL':'BAMBOO'):productArt?.querySelector('.product-gallery__word')?.textContent,
   inspection:element.hasAttribute('data-inspection'),paused:!!journey?.isLocked()&&element.closest('dialog')!==journey.getTopDialog(),
   background:playbackProfile==='home-cycle'?BRAND_THEME.sage:getComputedStyle(element).getPropertyValue('--world-bg').trim()||undefined,
   label:element.getAttribute('aria-label'),instructions:de?
    'Pfeiltasten links und rechts drehen die Ansicht. Pos1 setzt die Drehung zurück.'+(element.hasAttribute('data-inspection')?' Plus und Minus zoomen. Der Regler bewegt die Animation.':' Scrollen bewegt die Seite.'):
    'Left and right arrow keys rotate the view. Home resets rotation.'+(element.hasAttribute('data-inspection')?' Plus and minus zoom. The slider moves the animation.':' Scroll to move through the page.'),onJourneyFrame:state=>{
   if(!pageActive||token.epoch!==sceneEpoch||reduced.matches)return;
   playback?.render(state);
   if(playbackProfile==='hero-intro'){
    const section=element.closest('.intro-hero'),q=state.q;
    const reveal=Math.min(1,Math.max(0,(q-.30)/.12),Math.max(0,(.78-q)/.12));
    section.style.setProperty('--intro-reveal',String(reveal));
    for(const label of section.querySelectorAll('[data-intro-anchor]')){
     const anchor=state.anchors?.[label.dataset.introAnchor];
     const end={cap:[200,185],insert:[790,445],shell:[400,810]}[label.dataset.introAnchor];
     if(anchor&&end)section.querySelector(`[data-intro-line="${label.dataset.introAnchor}"]`)?.setAttribute('d',`M${anchor.x*1000},${anchor.y*1000} L${end[0]},${end[1]} h${label.dataset.introAnchor==='insert'?45:-45}`);
    }
   }
   if(!productJourney)return;
   if(!productJourney.enhanced){productJourney.enhance(state);journey?.ready();scheduleScroll();}
   else productJourney.render(state);
  },onState:state=>{
   if(!pageActive||token.epoch!==sceneEpoch)return;
   if(section){if(state.status==='error')staticRitual(section);else updateRitualCopy(section,Math.max(0,Math.min(1,state.cyclePosition)));}
   playback?.render(state);
   if(productJourney&&state.status==='error')productJourney.fallback();
  }});
  viewers.set(element,view);await view.ready;
  if(!current()||viewers.get(element)!==view){view.destroy();return;}
  if(section&&reduced.matches)staticRitual(section);
  playback?.attach(view);
  if(productJourney){if(reduced.matches)productJourney.fallback();else productJourney.enhance(view.getJourneyState());journey?.ready();}
  scheduleScroll();return view;
 }catch(error){
  if(!current())return;
  viewers.get(element)?.destroy();viewers.delete(element);
  element.dataset.sceneStatus='error';element.dataset.sceneRendered='false';element.dataset.sceneError=error?.message||'Model unavailable';
  const section=element.closest('[data-ritual-scroll]');if(section)staticRitual(section);
  productJourneys.get(element.closest('[data-product-journey]'))?.fallback();
  playbackFor(element)?.fallback();
  if(element.closest('[data-product-journey]'))journey?.ready();
 }finally{
  if(mounting.get(element)===token)mounting.delete(element);
 }
}
const sceneLoader=createSceneLoader({mount:mountScene,rootMargin:'280px 0px'});
scenes.filter(el=>!el.closest('dialog')).forEach(el=>sceneLoader.observe(el));
rituals.forEach(section=>{if(reduced.matches)staticRitual(section);});

function setGallery(gallery,mode){
 const photograph=gallery?.querySelector('[data-product-photo-viewer]');
 if(photograph){
  updateProductPhoto(photograph,{base,version:ui.version,mode,scent:photograph.dataset.photoScent||photograph.dataset.photoDefaultScent});
  photograph.querySelector('[data-product-photo]').alt=photograph.dataset[mode==='refill'?'photoRefillAlt':'photoProductAlt'];
  return;
 }
 const element=gallery?.querySelector('[data-shop-scene]');if(!element)return;
 element.dataset.requestedMode=mode; element.setAttribute('aria-label',`${ui.productGallery?.[mode]||ui.modelNote}. ${ui.drag}.`);
 const matchedPreview=scenePreviews.update(element,mode);
 const poster=element.querySelector('img');if(poster){if(!matchedPreview)poster.src=`${base}/assets/shop-${mode==='refill'?`refill-${element.dataset.scent||'bamboo'}`:mode==='product'?'product-front':mode}.webp?v=${ui.version}`;poster.alt=ui.productGallery?.[mode]||ui.modelNote;}
 const view=viewers.get(element);if(view)view.setMode(mode);else sceneLoader.request(element);
 element.querySelector('.shop-product-canvas')?.setAttribute('aria-label',`${ui.productGallery?.[mode]||ui.modelNote}. ${ui.drag}. ${de?'Pfeiltasten links und rechts drehen die Ansicht.':'Left and right arrow keys rotate the view.'}`);
}
for(const form of document.querySelectorAll('[data-product-form]')){
 const quantity=form.elements.quantity, gallery=(form.closest('.product-layout')||form.closest('[data-detour-panel]'))?.querySelector('.product-gallery');
 const update=(switchView=true)=>{
  const format=form.elements.format.value, scent=form.elements.scent.value;
  if(!Object.hasOwn(prices,format)||!fragrances.includes(scent))return;
  form.querySelectorAll('[data-product-price],[data-price]').forEach(el=>el.textContent=formatPrice(prices[format],lang));
  form.querySelector('[data-unit-price]').textContent=formatPrice(prices[format]*4,lang);
  form.querySelector('[data-add-label]').textContent=ui.formatAdd[format];
  form.querySelector('[data-format-note]').textContent=ui.formatNote[format];
  quantity.value=String(clampQuantity(quantity.value));
  form.querySelector('[data-quantity="-1"]').disabled=Number(quantity.value)<=1;
  form.querySelector('[data-quantity="1"]').disabled=Number(quantity.value)>=20;
  form.querySelectorAll('[data-scent-link]').forEach(link=>{const url=new URL(link.href);if(format==='refill')url.searchParams.set('format','refill');else url.searchParams.delete('format');link.href=url.href;});
  const language=!form.closest('dialog')&&document.querySelector('.lang-switch');if(language){const url=new URL(language.href);if(format==='refill')url.searchParams.set('format','refill');else url.searchParams.delete('format');language.href=url.href;}
  if(!form.closest('dialog')){const url=new URL(location.href);if(format==='refill')url.searchParams.set('format','refill');else url.searchParams.delete('format');history.replaceState(history.state,'',url);}
  if(switchView)setGallery(gallery,format==='refill'?'refill':'product');
 };
 if(new URLSearchParams(location.search).get('format')==='refill')for(const input of form.elements.format)input.checked=input.value==='refill';
 for(const input of form.elements.format)input.addEventListener('change',()=>{update();journey?.select({format:input.value});});
 form.addEventListener('change',event=>update(event.target.name==='format'));
 form.addEventListener('journey-product-update',()=>update());
 for(const button of form.querySelectorAll('[data-quantity]'))button.addEventListener('click',()=>{quantity.value=String(clampQuantity(Number(quantity.value)+Number(button.dataset.quantity)));update(false);});
 form.addEventListener('submit',event=>{event.preventDefault();update(false);
  const scent=form.elements.scent.value,format=form.elements.format.value;
  add(scent,format,Number(quantity.value),true);
 });
 update();
}
const catalogFilters=[...document.querySelectorAll('[data-filter]')];
function applyCatalogFilter(filter){
 if(!catalogFilters.some(el=>el.dataset.filter===filter))return;
 catalogFilters.forEach(el=>{const active=el.dataset.filter===filter;el.classList.toggle('is-active',active);el.setAttribute('aria-pressed',String(active));});
 let count=0;document.querySelectorAll('.collection-grid--shop .product-card').forEach(el=>{el.hidden=filter!=='all'&&el.dataset.format!==filter;if(!el.hidden){count++;el.classList.add('is-visible');}});
 document.querySelector('[data-result-count]').textContent=`${count} ${ui.filterResults}`;
 const url=new URL(location.href);if(filter==='all')url.searchParams.delete('format');else url.searchParams.set('format',filter);history.replaceState(history.state,'',url);
 const language=document.querySelector('.lang-switch');if(language){const target=new URL(language.href);if(filter==='all')target.searchParams.delete('format');else target.searchParams.set('format',filter);language.href=target.href;}
}
catalogFilters.forEach(button=>button.addEventListener('click',()=>applyCatalogFilter(button.dataset.filter)));
if(catalogFilters.length){const requested=new URLSearchParams(location.search).get('format');if(requested==='shampoo'||requested==='refill')applyCatalogFilter(requested);}

if(!reduced.matches&&'IntersectionObserver'in window){
 document.documentElement.classList.add('js-motion');
 const revealObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);}},{threshold:.08});
 document.querySelectorAll('[data-reveal]').forEach(el=>revealObserver.observe(el));
}
const layers=[...document.querySelectorAll('[data-parallax]')];let scrollFrame=0;
function renderScroll(){
 scrollFrame=0;const header=document.querySelector('.header'),headerHeight=header?.offsetHeight||84;
 if(document.querySelector('dialog[open]'))return;
 header?.classList.toggle('scrolled',window.scrollY>30);
 for(const form of document.querySelectorAll('[data-product-form]')){
  const buy=form.querySelector('.product-add-line'),dock=form.querySelector('[data-product-dock]');
  if(buy&&dock){const shown=!form.closest('dialog')&&buy.getBoundingClientRect().bottom<0;dock.classList.toggle('is-active',shown);dock.inert=!shown;dock.setAttribute('aria-hidden',String(!shown));}
 }
 for(const scene of scenes){
  if(scene.dataset.artDirection!=='campaign'||playbackFor(scene))continue;
  const hero=scene.closest('.campaign-hero');if(!hero)continue;
  const rect=hero.getBoundingClientRect();
  if(rect.bottom>0&&rect.top<innerHeight){const pose=reduced.matches?0:Math.max(0,Math.min(1,-rect.top/Math.max(1,rect.height)));scenePreviews.setPose(scene,pose);viewers.get(scene)?.setPoseProgress(pose);}
 }
 for(const section of rituals){
  if(section.classList.contains('ritual-static'))continue;
  const nav=document.querySelector('[data-journey-nav]');
  const offset=headerHeight+(document.querySelector('main[data-journey]')&&!nav?.closest('[data-product-journey]')?nav?.offsetHeight||0:0);
  const rect=section.getBoundingClientRect(),travel=rect.height-(section.querySelector('.ritual-sticky')?.getBoundingClientRect().height||innerHeight-offset);
  const progress=Math.max(0,Math.min(1,(offset-rect.top)/Math.max(1,travel)));
  const view=viewers.get(section.querySelector('[data-shop-scene]'));if(view){view.setProgress(progress);updateRitualCopy(section,view.getProgress());}else updateRitualCopy(section,progress);
 }
 for(const [section,controller]of productJourneys){
  if(!controller.enhanced)continue;
  viewers.get(section.querySelector('[data-shop-scene]'))?.setProgress(controller.getProgress());
 }
 for(const layer of layers){
  if(reduced.matches||innerWidth<761){layer.style.transform='';continue;}
  const rect=layer.parentElement.getBoundingClientRect();if(rect.bottom>0&&rect.top<innerHeight){const amount=Number(layer.dataset.parallax)||.08,offset=(innerHeight/2-rect.top-rect.height/2)*amount;layer.style.transform=`translate3d(0,${Math.max(-60,Math.min(60,offset))}px,0)`;}
 }
}
function scheduleScroll(){if(!scrollFrame)scrollFrame=requestAnimationFrame(renderScroll);}
window.addEventListener('scroll',scheduleScroll,{passive:true});window.addEventListener('resize',scheduleScroll,{passive:true});
reduced.addEventListener('change',()=>{
 if(reduced.matches){document.documentElement.classList.remove('js-motion');document.querySelectorAll('[data-reveal]').forEach(el=>el.classList.add('is-visible'));rituals.forEach(staticRitual);}
 else rituals.forEach(section=>{if(section.querySelector('[data-shop-scene]').dataset.sceneStatus!=='error')section.classList.remove('ritual-static');});
 for(const [section,controller]of productJourneys){
  const element=section.querySelector('[data-shop-scene]'),view=viewers.get(element);
  if(reduced.matches){controller.fallback();mounting.delete(element);view?.destroy();viewers.delete(element);sceneSnapshots.delete(element);sceneLoader.unobserve(element);element.dataset.sceneRendered='false';}
  else if(view?.getJourneyState())controller.enhance(view.getJourneyState());
  else sceneLoader.retry(element);
 }
 for(const [section,controller]of playbacks){
  const element=section.querySelector('[data-shop-scene]'),view=viewers.get(element);
  if(reduced.matches){controller.fallback();mounting.delete(element);view?.destroy();viewers.delete(element);sceneSnapshots.delete(element);sceneLoader.unobserve(element);element.dataset.sceneRendered='false';}
  else {controller.prepare();sceneLoader.retry(element);}
 }
 scheduleScroll();
});
window.addEventListener('pagehide',()=>{pageActive=false;sceneEpoch++;for(const [section,controller]of playbacks){const stage=section.querySelector('[data-shop-scene]');if(stage)stage.dataset.previewRestoring=String(needsPlaybackRestorePreview(controller.getSnapshot(),section.dataset.playbackProfile));controller.suspend();}for(const controller of productJourneys.values())controller.suspend();for(const [el,view]of viewers){const state=view.getState();sceneSnapshots.set(el,{progress:view.getProgress(),yaw:state.manualYaw,zoom:state.framing?.zoom||1,pose:state.poseProgress});view.destroy();}viewers.clear();sceneLoader.suspend();});
window.addEventListener('pageshow',event=>{pageActive=true;if(event.persisted){for(const controller of playbacks.values())controller.resume();cart=readCart(cart);renderCart();checkout?.syncCart();for(const controller of productJourneys.values())controller.resume();for(const element of scenes)mounting.delete(element);sceneLoader.resume({reset:true});scheduleScroll();}});
journey=initializeJourney({ui,reduced,
 getPlaybackSnapshot:section=>playbacks.get(section)?.getSnapshot(),
 onReady:()=>{for(const [section,controller]of productJourneys)if(controller.enhanced)viewers.get(section.querySelector('[data-shop-scene]'))?.setProgress(controller.getProgress(),{immediate:true});},
 onChoice:choice=>{
  for(const root of document.querySelectorAll('[data-product-photo-viewer]')){
   const scent=root.closest('main.pdp-page')?.querySelector('[data-product-form]')?.dataset.id||(root.closest('[data-world]')?choice.scent:root.dataset.photoDefaultScent);
   updateProductPhoto(root,{base,version:ui.version,mode:root.dataset.photoMode||root.dataset.photoDefaultMode,scent});
  }
  for(const el of scenes){
   const scent=el.closest('main.pdp-page')?.querySelector('[data-product-form]')?.dataset.id||choice.scent;
   el.dataset.scent=scent;
   if(!scenePreviews.update(el)&& (el.dataset.shopScene==='refill'||el.dataset.requestedMode==='refill'))el.querySelector('img')?.setAttribute('src',`${base}/assets/shop-refill-${scent}.webp?v=${ui.version}`);
   const profile=playbackFor(el)?.getSnapshot().profile;
   viewers.get(el)?.setWorld(scent,profile==='home-cycle'?BRAND_THEME.sage:getComputedStyle(el).getPropertyValue('--world-bg').trim()||undefined);
  }
  const themeWorld=document.querySelector('main [data-world],main.pdp-page');
  const theme=themeWorld&&getComputedStyle(themeWorld).getPropertyValue('--world-bg').trim();
  if(theme)document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme);
 },
 onModal:(paused,top)=>{for(const controller of playbacks.values())controller.setBlocked(paused);for(const [el,view]of viewers)view.setPaused(paused&&el.closest('dialog')!==top);if(!paused)scheduleScroll();},
});
journey.ready();
scheduleScroll();
