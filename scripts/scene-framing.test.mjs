import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {staticSceneFrame,projectScenePoint,scenePreviewBox} from '../assets/scene-framing.js';
import {campaignLayout} from '../assets/campaign-backdrop.js';
import {scenePreviewAsset,createScenePreviews,paintScenePreviewWorld} from '../assets/scene-preview.js';
import {playbackSceneFrame,playbackPreviewBox} from '../assets/scene-framing.js';
import {createRitualSpace} from '../assets/assembly/ritual-space.js';
import {computeCycleState} from '../assets/assembly/ritual-timeline.js';

test('the shared first-frame camera projects exactly like the live THREE camera',()=>{
  for(const [width,height] of [[320,440],[390,472],[390,844],[844,390],[768,700],[1440,900],[3440,1440]])
    for(const mode of ['product','refill','shell','cap'])for(const campaign of [false,true]){
      const reserved=campaign,frame=staticSceneFrame({width,height,mode,campaign,reserved});
      const camera=new THREE.PerspectiveCamera(30,width/height,.5,5000);
      camera.position.fromArray(frame.cameraPosition);camera.up.set(0,1,0);camera.lookAt(...frame.aim);camera.updateMatrixWorld();
      const region=reserved?campaignLayout(width,height):{minX:0,maxX:1,minY:0,maxY:1};
      for(const point of frame.points){
        const actual=new THREE.Vector3(...point).project(camera),predicted=projectScenePoint(point,frame,width,height);
        assert.ok(Math.abs(predicted.x-(actual.x+1)*width/2)<1e-8);
        assert.ok(Math.abs(predicted.y-(1-actual.y)*height/2)<1e-8);
        assert.ok(predicted.x>=region.minX*width-.01&&predicted.x<=region.maxX*width+.01);
        assert.ok(predicted.y>=region.minY*height-.01&&predicted.y<=region.maxY*height+.01);
      }
      const box=scenePreviewBox({width,height,mode,campaign,reserved});
      assert.ok(Object.values(box).every(Number.isFinite));assert.ok(box.width>0&&box.height>0);
    }
});

test('the preview world stays cached through pose updates and repaints after its font becomes ready',()=>{
  let paints=0,fontReady=false;
  const context={setTransform(){},fillRect(){},createRadialGradient(){return {addColorStop(){}};},
    createLinearGradient(){return {addColorStop(){}};},fillText(){paints++;}};
  const canvas={dataset:{},setAttribute(){},getContext:()=>context};let attached=false;
  const doc={fonts:{check:()=>fontReady},createElement:()=>canvas};
  const hero={classList:{contains:()=>false}};
  const element={ownerDocument:doc,querySelector:()=>attached?canvas:null,appendChild:()=>{attached=true;},closest:selector=>selector==='.campaign-hero'?hero:null};
  const state={width:390,height:844,scent:'argan',campaign:true};
  for(let i=0;i<60;i++)paintScenePreviewWorld(element,state);
  assert.equal(paints,1,'scroll pose updates do not redraw a hidden full-screen bitmap');
  fontReady=true;paintScenePreviewWorld(element,state);assert.equal(paints,2);
  paintScenePreviewWorld(element,{...state,scent:'aloe'});assert.equal(paints,3);
});

test('mode and scent changes replace the matching preview and reframe it without a renderer',()=>{
  const writes=new Map(),attributes=new Map();let rect={width:390,height:472};let resize;
  const image={getAttribute:name=>attributes.get(name),set src(value){attributes.set('src',value);}};
  const element={dataset:{shopScene:'product',artDirection:'detail',scent:'argan'},classList:{contains:()=>true},
    getBoundingClientRect:()=>rect,closest:()=>null,querySelector:()=>image,style:{setProperty:(name,value)=>writes.set(name,value)}};
  const win={addEventListener:(name,callback)=>{resize=callback;},removeEventListener:()=>{resize=null;}};
  const previews=createScenePreviews({elements:[element],base:'/demo',version:'test',window:win});
  assert.match(attributes.get('src'),/shop-detail-product-argan\.webp\?v=test$/);
  previews.update(element,'refill','argan');assert.match(attributes.get('src'),/shop-detail-refill-argan\.webp/);
  assert.equal(element.dataset.previewMode,'refill');assert.equal(element.dataset.previewScent,'argan');
  const old=writes.get('--preview-height');rect={width:340,height:568};resize();assert.notEqual(writes.get('--preview-height'),old);
  assert.equal(scenePreviewAsset({mode:'refill',scent:'aloe',campaign:true}),'shop-campaign-refill-aloe.webp');
  previews.destroy();assert.equal(resize,null);
});

test('the explanatory stage paints a quiet sage field instead of campaign lettering',()=>{
  let fills=0,letters=0,fill;
  const context={setTransform(){},fillRect(){fills++;fill=this.fillStyle;},fillText(){letters++;}};
  const canvas={dataset:{},setAttribute(){},getContext:()=>context};let attached=false;
  const doc={fonts:{check:()=>true},createElement:()=>canvas};
  const element={ownerDocument:doc,querySelector:()=>attached?canvas:null,appendChild:()=>{attached=true;},
    closest:selector=>selector==='[data-playback-profile="home-cycle"]'?{}:null};
  paintScenePreviewWorld(element,{width:390,height:422,scent:'argan',campaign:false});
  assert.equal(fills,1);assert.equal(letters,0);assert.equal(fill,'#E6EEE0');
  assert.equal(scenePreviewAsset({mode:'journey',scent:'argan'}),'shop-guide-product-argan.webp');
  assert.equal(scenePreviewAsset({mode:'ritual',scent:'bamboo',profile:'refill-teaser'}),'shop-teaser-product-bamboo.webp');
});

test('plain scroll rituals use their live initial camera, not a static product photograph camera',()=>{
 for(const [width,height]of[[320,330],[390,472],[430,700],[844,300],[1440,900],[3440,1440]]){
  const camera=new THREE.PerspectiveCamera(30,width/height,.5,5000),rig=new THREE.Group();rig.updateMatrixWorld(true);
  const actual=createRitualSpace({THREE}).fitCamera({state:computeCycleState(0),camera,tiltRig:rig,zoom:1});
  const expected=playbackSceneFrame({width,height,profile:'ritual'});
  for(let i=0;i<3;i++)assert.ok(Math.abs(actual.cameraPosition[i]-expected.cameraPosition[i])<1e-8);
  assert.ok(Math.abs(actual.distance-expected.distance)<1e-8);
  const box=playbackPreviewBox({width,height,profile:'ritual'});assert.ok(Object.values(box).every(Number.isFinite));
 }
 for(const scent of['aloe','argan','bamboo'])assert.equal(scenePreviewAsset({mode:'ritual',scent}),`shop-ritual-product-${scent}.webp`);
 assert.equal(scenePreviewAsset({mode:'ritual',scent:'argan',profile:'refill-teaser'}),'shop-teaser-product-argan.webp');
});
