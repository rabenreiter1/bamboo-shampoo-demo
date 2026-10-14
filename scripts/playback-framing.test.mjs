import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { playbackSceneFrame, playbackPreviewBox, projectScenePoint, refillTeaserRegion } from '../assets/scene-framing.js';
import { campaignLayout } from '../assets/campaign-backdrop.js';
import { computeJourneyPose, createJourneySpace } from '../assets/journey-pose.js';
import { createRitualSpace } from '../assets/assembly/ritual-space.js';
import { computeCycleState, TILT_AXIS } from '../assets/assembly/ritual-timeline.js';
import { CAP_SOURCE } from '../assets/assembly/cap-data.js';
import { TUBE_PROFILE } from '../assets/assembly/body-profile.js';
import { normalizeBookmark, positionFromBookmark, BOOKMARK_LAYOUT } from '../assets/journey.js';
import { PLAYBACK_VERSION, normalizePlaybackSnapshot } from '../assets/playback.js';

const VIEWPORTS=[[320,568],[390,844],[430,932],[768,1024],[844,390],[1440,900],[3440,1440]];
const EXTERNAL=Object.freeze({minX:.06,maxX:.94,minY:.05,maxY:.95,layout:'external'});
const near=(actual,expected,description,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${description}: ${actual} != ${expected}`);
const nearVector=(actual,expected,description)=>actual.forEach((value,index)=>near(value,expected[index],`${description}[${index}]`));

// This is the live hierarchy and pose assignment, without any renderer, shader
// or browser. Camera fitting comes from the actual shop spatial factories.
function liveFrame({width,height,profile,region=EXTERNAL,zoom=1,end=false}){
  const progress=end?1:profile==='home-cycle'?0:.72;
  const pose=computeJourneyPose(progress),state=computeCycleState(progress);
  const tiltRig=new THREE.Group(),yawRig=new THREE.Group(),product=new THREE.Group();
  product.position.y=-85;tiltRig.add(yawRig);yawRig.add(product);
  tiltRig.quaternion.setFromAxisAngle(new THREE.Vector3(...TILT_AXIS),state.tilt);
  if(profile==='home-cycle')tiltRig.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),pose.roll));
  yawRig.rotation.y=profile==='home-cycle'?state.yaw:0;
  tiltRig.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(30,width/height,.5,5000);
  const space=profile==='home-cycle'?createJourneySpace({THREE}):createRitualSpace({THREE});
  const frame=profile==='home-cycle'
    ?space.fitCamera({pose,camera,tiltRig,width,height,zoom,region})
    :space.fitCamera({state,camera,product,tiltRig,zoom,region});
  return {frame,camera,product};
}
const cases=()=>[
  {profile:'home-cycle',reserved:false},
  {profile:'refill-teaser',reserved:false},
  {profile:'refill-teaser',reserved:true},
];
const regionFor=(entry,width,height)=>entry.reserved?refillTeaserRegion(width,height):EXTERNAL;

test('playback poster cameras match the actual spatial factories across phones, landscape, tablet and ultrawide',()=>{
  for(const [width,height]of [[1280,1600],...VIEWPORTS])for(const entry of cases())for(const zoom of [.6,1]){
    const region=regionFor(entry,width,height),cpu=playbackSceneFrame({width,height,...entry,zoom});
    const actual=liveFrame({width,height,profile:entry.profile,region,zoom});
    near(cpu.distance,actual.frame.distance,`${entry.profile} ${width}×${height} distance`);
    nearVector(cpu.center,actual.frame.center,'product envelope center');
    nearVector(cpu.aim,actual.frame.viewCenter,'camera aim');
    nearVector(cpu.cameraPosition,actual.camera.position.toArray(),'camera position');
    assert.deepEqual(cpu.region,region);
    for(const point of cpu.points){
      const projected=new THREE.Vector3(...point).project(actual.camera),predicted=projectScenePoint(point,cpu,width,height);
      near(predicted.x,(projected.x+1)*width/2,'screen x');
      near(predicted.y,(1-projected.y)*height/2,'screen y');
      assert.ok(predicted.x>=region.minX*width-.01&&predicted.x<=region.maxX*width+.01,'complete envelope fits the horizontal camera region');
      assert.ok(predicted.y>=region.minY*height-.01&&predicted.y<=region.maxY*height+.01,'complete envelope fits above purchase controls');
    }
  }
});

test('an explicit reference region overrides reserved teaser framing and mobile controls receive 280px',()=>{
  for(const [width,height]of VIEWPORTS){
    const cpu=playbackSceneFrame({width,height,profile:'refill-teaser',reserved:true,region:EXTERNAL});
    const actual=liveFrame({width,height,profile:'refill-teaser',region:EXTERNAL});
    assert.deepEqual(cpu.region,EXTERNAL);
    nearVector(cpu.cameraPosition,actual.camera.position.toArray(),'reference capture camera');
    const region=refillTeaserRegion(width,height),compact=width<=760&&!(width>height&&height<=560);
    if(compact){
      near(region.maxY,Math.max(.38,1-280/height),'compact purchase reserve');
      near(region.minY,campaignLayout(width,height).minY,'header reserve');
    }else assert.deepEqual(region,campaignLayout(width,height));
  }
});

test('both first frames retain the complete source tube, PET flange and every traced cap contour',()=>{
  const points=[];
  for(const [y,radius]of TUBE_PROFILE)for(let i=0;i<48;i++)points.push([radius*Math.cos(i*Math.PI/24),y,radius*Math.sin(i*Math.PI/24)]);
  // Exact Ø47 body and Ø58 flange, with the confirmed assembly heights.
  for(const [radius,bottom,top]of [[23.5,5,170],[29,170,170.3]])for(const y of [bottom,top])for(let i=0;i<48;i++)points.push([radius*Math.cos(i*Math.PI/24),y,radius*Math.sin(i*Math.PI/24)]);
  for(const [contours,bottom,top]of [[CAP_SOURCE.button,172.45,173.3],[CAP_SOURCE.ring,171.062,171.8],
    [CAP_SOURCE.letters,171.064,171.099],[CAP_SOURCE.logo,173.312,173.347],[CAP_SOURCE.buttonInset,173.306,173.320]]){
    for(const contour of contours)for(const [x,z]of contour.points)for(const y of [bottom,top])points.push([x,y,z]);
  }
  for(const [width,height]of VIEWPORTS)for(const entry of cases()){
    const region=regionFor(entry,width,height),actual=liveFrame({width,height,profile:entry.profile,region});
    const lowerX=region.minX*width,upperX=region.maxX*width,lowerY=region.minY*height,upperY=region.maxY*height;
    for(const point of points){
      const p=new THREE.Vector3(...point).applyMatrix4(actual.product.matrixWorld).project(actual.camera);
      const x=(p.x+1)*width/2,y=(1-p.y)*height/2;
      assert.ok(x>=lowerX-.01&&x<=upperX+.01&&y>=lowerY-.01&&y<=upperY+.01&&p.z>=-1&&p.z<=1,
        `${entry.profile} ${width}×${height}: original source point ${point} leaves the stage`);
    }
  }
});

test('the closed endpoints fit the same camera and the still placement uses the measured factory frame',()=>{
  for(const [width,height]of VIEWPORTS)for(const entry of cases()){
    const region=regionFor(entry,width,height),actual=liveFrame({width,height,profile:entry.profile,region});
    const end=liveFrame({width,height,profile:entry.profile,region,end:true});
    near(actual.frame.distance,end.frame.distance,'loop-end fit distance');
    nearVector(actual.camera.position.toArray(),end.camera.position.toArray(),'loop-end camera');
    const reference=liveFrame({width:1280,height:1600,profile:entry.profile,region:EXTERNAL});
    const box=playbackPreviewBox({width,height,...entry}),center=new THREE.Vector3(...actual.frame.center).project(actual.camera);
    near(box.left,(center.x+1)*width/2,'poster center x');
    near(box.top,(1-center.y)*height/2,'poster center y');
    const scale=height/1600*reference.frame.distance/actual.frame.distance;
    near(box.width,1280*scale,'poster width');near(box.height,1600*scale,'poster height');
    assert.equal(box.rotation,0);assert.ok(Object.values(box).every(Number.isFinite));
    assert.ok(box.width>0&&box.height>0);
  }
});

test('legacy scroll bookmarks restore the corresponding explanation, while current playback preserves its pause and inspection',()=>{
  const old={chapter:'ritual',progress:.54,scroll:8300,lang:'de',viewportHeight:844,viewportWidth:390,layout:'collection-before-ritual-v1'};
  const migrated=normalizeBookmark(old);
  assert.equal(migrated.layout,BOOKMARK_LAYOUT);assert.equal(migrated.progress,0);assert.equal(migrated.legacyAnimationProgress,.54);
  assert.equal(migrated.viewportHeight,undefined);assert.equal(migrated.viewportWidth,undefined);
  assert.equal(positionFromBookmark(migrated,{top:2450,height:720},844,82,390),2368,'the obsolete 8300px cannot jump into a different section');
  assert.equal(old.progress,.54);assert.equal(old.viewportHeight,844,'normalizing does not mutate the saved legacy evidence');
  const material=normalizeBookmark({...old,chapter:'materials'});assert.equal(material.chapter,'ritual');assert.equal(material.progress,0);
  const playback={version:PLAYBACK_VERSION,profile:'home-cycle',elapsed:18.25,paused:true,yaw:1.8};
  const current=normalizeBookmark({...old,layout:BOOKMARK_LAYOUT,playback});
  assert.deepEqual(current.playback,playback);assert.equal(current.viewportHeight,844);
  assert.deepEqual(normalizePlaybackSnapshot({...playback,scroll:8300,viewportWidth:390},'home-cycle'),playback,'playback position contains no obsolete page pixels');
});
