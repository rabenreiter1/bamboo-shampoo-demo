/** Photographic stills are deliberately separate from matched animation frames. */
export function productPhotoAsset(mode='product',scent='aloe',small=false){
  const fragrance=['aloe','argan','bamboo'].includes(scent)?scent:'aloe';
  const name=mode==='shell'?'photo-shell':mode==='cap'?'photo-cap-argan':
    ['product','refill'].includes(mode)?`photo-${mode}-${fragrance}`:null;
  return name?`${name}${small?'-640':''}.webp`:null;
}

export function updateProductPhoto(root,{base,version='',mode,scent}={}){
  if(!root)return false;
  mode??=root.dataset.photoMode||root.dataset.photoDefaultMode;
  scent??=root.dataset.photoScent||root.dataset.photoDefaultScent;
  const file=productPhotoAsset(mode,scent),image=root.querySelector('[data-product-photo]');
  if(!file||!image)return false;
  const suffix=version?`?v=${version}`:'';
  image.src=`${base}/assets/${file}${suffix}`;
  image.srcset=`${base}/assets/${productPhotoAsset(mode,scent,true)}${suffix} 640w, ${base}/assets/${file}${suffix} 1280w`;
  root.dataset.photoMode=mode;root.dataset.photoScent=scent;
  return true;
}

/** Also serialized into the document's first-paint boot for ?format=refill. */
export function primeProductPhotos({doc,base,version,choice}){
  for(const root of doc.querySelectorAll('[data-product-photo-viewer]')){
    const form=root.closest('main.pdp-page')?.querySelector('[data-product-form]');
    const mode=form?(choice.format==='refill'?'refill':'product'):root.dataset.photoDefaultMode;
    const scent=form?form.dataset.id:root.closest('[data-world]')?choice.scent:root.dataset.photoDefaultScent;
    updateProductPhoto(root,{base,version,mode,scent});
    const scene=root.querySelector('[data-shop-scene]');
    if(scene){scene.dataset.scent=scent;scene.dataset.requestedMode=mode;}
    const image=root.querySelector('[data-product-photo]');
    if(image&&['product','refill'].includes(mode)){image.alt=root.dataset[mode==='refill'?'photoRefillAlt':'photoProductAlt']||image.alt;}
  }
}
