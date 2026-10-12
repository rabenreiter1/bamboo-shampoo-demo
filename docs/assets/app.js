import { sanitizeCart, prices, formatPrice, productKey, cartTotal } from './catalog.js';

const ui = JSON.parse(document.querySelector('#ui-copy').textContent);
const bag = document.querySelector('#bag-dialog');
const notice = document.querySelector('#notice-dialog');
const menu = document.querySelector('#menu-dialog');
const KEY = 'bamboo-demo-bag-v1';
let cart = [];
try { cart = sanitizeCart(JSON.parse(sessionStorage.getItem(KEY) || '[]')); } catch { cart = []; }
const svg = name => `<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">${name==='bag'?'<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>':name==='minus'?'<path d="M5 12h14"/>':name==='plus'?'<path d="M5 12h14M12 5v14"/>':'<path d="M4 12h16M13 5l7 7-7 7"/>'}</svg>`;
function save() {
  cart = sanitizeCart(cart);
  try { sessionStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* Session storage is optional; the bag still works in memory. */ }
  renderBag();
}
function renderBag() {
  document.querySelectorAll('[data-count]').forEach(el => { el.textContent = cart.reduce((n,row)=>n+row.quantity,0); });
  document.querySelector('[data-total]').textContent = formatPrice(cartTotal(cart),ui.lang);
  const items = document.querySelector('#bag-items');
  items.innerHTML = cart.length ? cart.map(row => `<article class="bag-item" data-key="${productKey(row.scent,row.format)}"><img src="${ui.base}/assets/${row.format==='refill'?'refill':row.scent==='bamboo'?'product':row.scent}.webp" alt="${ui.names[row.scent]} ${ui[row.format]}" width="75" height="105"><div><div class="bag-item-head"><h3>${ui.names[row.scent]}</h3><span>${formatPrice(prices[row.format]*row.quantity,ui.lang)}</span></div><p>${ui[row.format]} · 250 ml</p><div class="bag-item-actions"><div class="quantity-control"><button data-bag-change="-1" aria-label="${ui.lang==='de'?'Menge reduzieren':'Decrease quantity'}" ${row.quantity===1?'disabled':''}>${svg('minus')}</button><input aria-label="${ui.quantity}: ${ui.names[row.scent]} ${ui[row.format]}" type="number" min="1" max="20" value="${row.quantity}" inputmode="numeric" data-bag-quantity><button data-bag-change="1" aria-label="${ui.lang==='de'?'Menge erhöhen':'Increase quantity'}" ${row.quantity===20?'disabled':''}>${svg('plus')}</button></div><button class="bag-remove" data-remove>${ui.remove}</button></div></div></article>`).join('') : `<div class="bag-empty">${svg('bag')}<h3>${ui.empty}</h3><p>${ui.emptyDesc}</p><a class="button button-dark" href="${ui.base}/${ui.lang}/#collection" data-close-bag-link>${ui.explore}${svg('arrow')}</a></div>`;
}
function show(dialog) {
  if (!dialog.open) dialog.showModal();
}
function add(scent,format,quantity=1) {
  const key = productKey(scent,format);
  const row = cart.find(item=>productKey(item.scent,item.format)===key);
  if (row) row.quantity = Math.min(20,row.quantity+quantity);
  else cart.push({scent,format,quantity});
  save();
  const toast=document.querySelector('.toast');
  toast.textContent=`${ui.names[scent]} · ${ui[format]} — ${ui.toast}`;
  toast.classList.add('visible');
  window.clearTimeout(add.timer);
  add.timer=window.setTimeout(()=>toast.classList.remove('visible'),3000);
}
document.addEventListener('click',event=>{
  const target=event.target.closest('button,a');
  if (!target) return;
  if (target.hasAttribute('data-open-bag')) show(bag);
  if (target.hasAttribute('data-open-menu')) show(menu);
  if (target.hasAttribute('data-open-notice')) { if (bag.open) bag.close(); show(notice); }
  if (target.hasAttribute('data-close')) target.closest('dialog')?.close();
  if (target.hasAttribute('data-close-bag-link')) bag.close();
  if (target.closest('#menu-dialog') && target.tagName==='A') menu.close();
  if (target.dataset.quickAdd) add(target.dataset.quickAdd,'shampoo');
  if (target.hasAttribute('data-remove') || target.hasAttribute('data-bag-change')) {
    const item = target.closest('[data-key]');
    const index = cart.findIndex(row=>productKey(row.scent,row.format)===item.dataset.key);
    if (index<0) return;
    if (target.hasAttribute('data-remove')) cart.splice(index,1);
    else cart[index].quantity=Math.max(1,Math.min(20,cart[index].quantity+Number(target.dataset.bagChange)));
    const focusName=target.hasAttribute('data-remove')?'remove':target.dataset.bagChange==='1'?'plus':'minus';
    save();
    const surviving=bag.querySelector(`[data-key="${item.dataset.key}"]`);
    if (surviving) (surviving.querySelector(focusName==='remove'?'[data-remove]':`[data-bag-change="${focusName==='plus'?1:-1}"]:not(:disabled)`) || surviving.querySelector('input')).focus();
    else (bag.querySelector('[data-remove]') || bag.querySelector('[data-close]')).focus();
  }
});
document.addEventListener('change',event=>{
  if (!event.target.hasAttribute('data-bag-quantity')) return;
  const item=event.target.closest('[data-key]');
  const row=cart.find(row=>productKey(row.scent,row.format)===item.dataset.key);
  if (row) row.quantity=Math.max(1,Math.min(20,Math.floor(Number(event.target.value)||1)));
  save();
});
for (const dialog of [bag,notice,menu]) {
  dialog.addEventListener('click',event=>{ if (event.target!==dialog) return; const bounds=dialog.getBoundingClientRect(); if (event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom) dialog.close(); });
}
for (const form of document.querySelectorAll('[data-product-form]')) {
  const unit=form.querySelector('[data-unit-price]');
  const quantity=form.elements.quantity;
  const update=()=>{
    const scent=form.elements.scent.value;
    const format=form.elements.format.value;
    form.querySelector('[data-scent-name]').textContent=ui.names[scent];
    form.querySelector('[data-price]').textContent=formatPrice(prices[format],ui.lang);
    unit.textContent=formatPrice(prices[format]*4,ui.lang);
    const picture=document.querySelector('.featured-art>img, .detail-main>img');
    if (picture) {
      picture.src=`${ui.base}/assets/${format==='refill'?'refill':scent==='bamboo'?'product':scent}.webp`;
      picture.alt=`${ui.names[scent]} · ${ui[format]}`;
    }
    document.querySelectorAll('[data-detail-scent], .gallery-label').forEach(el=>el.textContent=ui.names[scent]);
    const subtitle=document.querySelector('.scent-subtitle');
    if (subtitle) subtitle.textContent=ui.scentWords[scent];
    quantity.value=String(Math.max(1,Math.min(20,Math.floor(Number(quantity.value)||1))));
    form.querySelector('[data-quantity="-1"]').disabled=Number(quantity.value)<=1;
    form.querySelector('[data-quantity="1"]').disabled=Number(quantity.value)>=20;
  };
  if (new URLSearchParams(location.search).get('format')==='refill') form.querySelector('[value="refill"]').checked=true;
  form.addEventListener('change',update);
  for (const button of form.querySelectorAll('[data-quantity]')) button.addEventListener('click',()=>{ quantity.value=String(Math.max(1,Math.min(20,(Number(quantity.value)||1)+Number(button.dataset.quantity)))); update(); });
  form.addEventListener('submit',event=>{ event.preventDefault(); update(); add(form.elements.scent.value,form.elements.format.value,Number(quantity.value)); });
  update();
}
const steps=[...document.querySelectorAll('[data-step]')];
steps.forEach(button=>button.addEventListener('click',()=>{
  steps.forEach(step=>{ const active=step===button;step.classList.toggle('active',active);step.setAttribute('aria-pressed',String(active)); });
  button.closest('.refill-grid')?.querySelectorAll('.refill-photo, .refill-diagram').forEach(el=>el.dataset.currentStep=button.dataset.step);
}));
renderBag();

const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
if (!reduced.matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('js-motion');
  const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{ if (entry.isIntersecting) {entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);} }),{threshold:.08});
  document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));
}
const layers=[...document.querySelectorAll('[data-parallax]')];
let scheduled=false;
function renderScroll() {
  scheduled=false;
  document.querySelector('.header')?.classList.toggle('scrolled',window.scrollY>30);
  if (reduced.matches || window.innerWidth<761) { layers.forEach(el=>el.style.transform=''); return; }
  for (const layer of layers) { const rect=layer.parentElement.getBoundingClientRect(); if (rect.bottom>0 && rect.top<innerHeight) { const offset=(innerHeight/2-rect.top-rect.height/2)*.08;layer.style.transform=`translate3d(0,${Math.max(-55,Math.min(55,offset))}px,0)`; } }
}
function schedule(){if (!scheduled){scheduled=true;requestAnimationFrame(renderScroll);}}
window.addEventListener('scroll',schedule,{passive:true});
window.addEventListener('resize',schedule,{passive:true});
reduced.addEventListener('change',()=>{if(reduced.matches){document.documentElement.classList.remove('js-motion');document.querySelectorAll('.reveal').forEach(el=>el.classList.add('is-visible'));}schedule();});
schedule();

