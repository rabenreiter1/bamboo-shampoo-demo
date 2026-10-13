import { scenePreviewBox } from './scene-framing.js?v=shop-20261013-jury4';
import { paintCampaignWorld } from './campaign-backdrop.js?v=shop-20261013-jury4';

export function paintScenePreviewWorld(element,{width,height,scent,campaign,doc=element.ownerDocument}){
  if(!doc?.createElement)return false;
  let canvas=element.querySelector('.scene-preview-world');
  if(!canvas){canvas=doc.createElement('canvas');canvas.className='scene-preview-world';canvas.setAttribute('aria-hidden','true');element.appendChild(canvas);}
  const context=canvas.getContext('2d');if(!context)return false;
  const scale=Math.min(1.5,2048/Math.max(width,height));
  const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const hero=element.closest('.campaign-hero');
  const word=hero?(hero.classList.contains('campaign-hero--refill')?'REFILL':'BAMBOO')
    :element.closest('.product-gallery__primary')?.querySelector('.product-gallery__word')?.textContent||'BAMBOO';
  const signature=JSON.stringify([width,height,scent,word,campaign,doc.fonts?.check?.('700 160px Campaign')]);
  if(canvas.dataset.previewWorldSignature===signature)return true;
  paintCampaignWorld(context,{width,height,world:scent,word,layout:campaign?'campaign':'detail',scale});
  canvas.dataset.previewWorldSignature=signature;
  return true;
}

export function scenePreviewAsset({mode='product',scent='bamboo',campaign=false}){
  if(!['product','refill'].includes(mode))return null;
  const family=campaign?'campaign':'detail';
  return `shop-${family}-${mode==='refill'?`refill-${['aloe','argan','bamboo'].includes(scent)?scent:'bamboo'}`:'product'}.webp`;
}

export function createScenePreviews({elements,base,version,window:win=window}){
  const records=new Map();
  function resize(record){
    const box=record.element.getBoundingClientRect();if(!box.width||!box.height)return;
    const frame=scenePreviewBox({width:box.width,height:box.height,mode:record.mode,campaign:record.campaign,reserved:record.reserved,pose:record.pose});
    for(const [name,value] of Object.entries(frame))record.element.style.setProperty(`--preview-${name}`,`${value}${name==='rotation'?'deg':'px'}`);
    paintScenePreviewWorld(record.element,{width:box.width,height:box.height,scent:record.scent,campaign:record.campaign});
  }
  function update(element,mode=element.dataset.requestedMode||element.dataset.shopScene,scent=element.dataset.scent){
    let record=records.get(element);
    if(!record){
      if(!element.classList.contains('scene-preview'))return false;
      record={element,campaign:element.dataset.artDirection==='campaign',reserved:!!element.closest('.campaign-hero'),pose:0};records.set(element,record);
    }
    const name=scenePreviewAsset({mode,scent,campaign:record.campaign});if(!name)return false;
    record.mode=mode;record.scent=scent;
    const image=element.querySelector('img');if(image){const src=`${base}/assets/${name}?v=${version}`;if(image.getAttribute('src')!==src)image.src=src;}
    element.dataset.previewMode=mode;element.dataset.previewScent=scent;resize(record);return true;
  }
  const refresh=()=>{for(const record of records.values())resize(record);};
  for(const element of elements)update(element);
  records.keys().next().value?.ownerDocument?.fonts?.ready.then(refresh);
  win.addEventListener('resize',refresh,{passive:true});
  return {update,setPose(element,pose){const record=records.get(element);if(record){record.pose=pose;resize(record);}},
    destroy(){win.removeEventListener('resize',refresh);records.clear();}};
}
