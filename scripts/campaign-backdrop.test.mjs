import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCampaignBackdrop, campaignLayout } from '../assets/campaign-backdrop.js';
import { BRAND_THEME } from '../assets/product-theme.js';

test('hero resizing reallocates GPU storage, preserves type proportions and stays within the texture budget',()=>{
  const previous=globalThis.document;
  const calls=[];
  const context={ setTransform(){},fillRect(){}, createRadialGradient(){return {addColorStop(){}};},
    createLinearGradient(){return {addColorStop(){}};}, fillText(text,x,y,max){calls.push({text,x,y,max,font:this.font,ink:this.fillStyle});} };
  globalThis.document={createElement(){return {width:1,height:1,getContext(){return context;}};}};
  let backdrop;
  try{
    backdrop=createCampaignBackdrop({THREE});
    backdrop.resize(1440,900);
    const desktop=backdrop.mesh.material.uniforms.backdropMap.value;
    let disposed=false; desktop.addEventListener('dispose',()=>{disposed=true;});
    backdrop.resize(390,844);
    const portrait=backdrop.mesh.material.uniforms.backdropMap.value;
    assert.notEqual(portrait,desktop,'portrait gets a newly allocated texture'); assert.ok(disposed);
    assert.equal(portrait.image.width,585); assert.equal(portrait.image.height,1266);
    assert.equal(calls.at(-1).font,`700 ${390*.32}px Campaign, Impact, sans-serif`);
    assert.equal(calls.at(-1).y,844*.39);
    backdrop.setWorld('argan');
    assert.equal(backdrop.mesh.material.uniforms.backdropMap.value,portrait,'same-size colour changes reuse the texture');
    assert.equal(calls.at(-1).ink,BRAND_THEME.ink);
    backdrop.resize(3840,2160);
    const large=backdrop.mesh.material.uniforms.backdropMap.value.image;
    assert.ok(large.width<=2048&&large.height<=2048);
    assert.equal(backdrop.mesh.material.depthWrite,false);
    assert.equal(backdrop.mesh.material.toneMapped,false,'brand colours bypass product lighting exposure');
  }finally{backdrop?.dispose();globalThis.document=previous;}
});

test('the campaign reserves space for navigation and purchase controls in phone and landscape layouts',()=>{
  for(const [width,height] of [[320,740],[390,844],[430,932],[844,390],[1440,900]]){
    const layout=campaignLayout(width,height);
    assert.ok(layout.minY>=0&&layout.minY<layout.maxY&&layout.maxY<=1);
    assert.ok(layout.minX<layout.maxX);
    assert.ok(layout.wordY>layout.minY&&layout.wordY<layout.maxY);
    assert.ok(layout.maxY*height<=height-70);
  }
});

test('refill and scent lettering survives opaque rendering, world changes and resizing',()=>{
  const previous=globalThis.document,calls=[];
  const context={setTransform(){},fillRect(){},createRadialGradient(){return {addColorStop(){}};},
    createLinearGradient(){return {addColorStop(){}};},
    fillText(text,x,y,max){calls.push({text,x,y,max,font:this.font,alpha:this.globalAlpha});}};
  globalThis.document={createElement(){return {width:1,height:1,getContext(){return context;}};}};
  try{
    for(const [word,layout] of [['REFILL','campaign'],['Aloe','detail'],['Argan','detail'],['Bamboo','detail']]){
      const backdrop=createCampaignBackdrop({THREE,word,layout});
      for(const [width,height] of [[320,440],[390,844],[844,390],[1440,900],[3440,1440]]){
        backdrop.resize(width,height);backdrop.setWorld('argan');
        const painted=calls.at(-1);
        assert.equal(painted.text,word.toUpperCase());
        assert.equal(painted.max,width*.975);
        assert.ok(painted.y>0&&painted.y<height);
        assert.equal(painted.alpha,layout==='detail'?.23:1);
        assert.equal(context.globalAlpha,1,'type opacity must not tint the next world paint');
      }
      backdrop.dispose();
    }
  }finally{globalThis.document=previous;}
});
