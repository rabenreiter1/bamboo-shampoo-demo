import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { computeIntroPose } from '../assets/intro-pose.js';
import { createJourneySpace } from '../assets/journey-pose.js';
import { playbackAt } from '../assets/playback.js';
import { playbackSceneFrame, projectScenePoint } from '../assets/scene-framing.js';
import { needsPlaybackRestorePreview } from '../assets/prime-shop.js';

const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
test('the sealed introduction returns to its starting assembly with no disappearing parts', () => {
  const first=computeIntroPose(0),last=computeIntroPose(1);
  for(const name of ['cap','oldRefill','newRefill','seal','newSeal','liquid'])assert.deepEqual(first.state[name],last.state[name]);
  near(first.roll,last.roll);near(first.state.yaw,last.state.yaw);
  assert.equal(playbackAt('hero-intro',16).q,0);
  for(let i=0;i<=1600;i++){
    const pose=computeIntroPose(playbackAt('hero-intro',i/100).q),s=pose.state;
    assert.equal(s.oldRefill.visible,true);assert.equal(s.oldRefill.depart,0);
    assert.equal(s.newRefill.visible,false);assert.equal(s.seal.peel,0);assert.equal(s.seal.exit,0);
    assert.equal(s.liquid.fillOld,1);assert.equal(s.liquid.flow,0);
    if(s.cap.park>0)near(s.cap.position[1],44);
    if(s.oldRefill.position[1]>0)near(s.cap.park,1);
    assert.ok(s.oldRefill.position[1]>=0&&s.oldRefill.position[1]<=110);
  }
});
test('intro first-frame placement matches the existing source-rendered guide poster across screen shapes', () => {
  const space=createJourneySpace({THREE});
  for(const [width,height] of [[320,260],[390,312],[430,340],[768,620],[850,315],[1440,770],[1720,1100]]){
    const camera=new THREE.PerspectiveCamera(30,width/height,.5,5000),tiltRig=new THREE.Group();
    tiltRig.rotation.z=.10;tiltRig.updateWorldMatrix(true,true);
    const live=space.fitCamera({pose:computeIntroPose(0),camera,tiltRig,width,height,region:{minX:.06,maxX:.94,minY:.05,maxY:.95,layout:'external'}});
    const preview=playbackSceneFrame({width,height,profile:'hero-intro',reserved:true});
    live.cameraPosition.forEach((value,i)=>near(value,preview.cameraPosition[i]));
    for(let i=0;i<=100;i++){
      const pose=computeIntroPose(i/100);
      space.fitCamera({pose,camera,tiltRig,width,height,region:preview.region});
      const point=new THREE.Vector3(0,170.5+pose.state.oldRefill.position[1]-85,0).applyMatrix4(tiltRig.matrixWorld).project(camera);
      assert.ok(Math.abs(point.x)<.9&&Math.abs(point.y)<.9,'the lifted refill stays in frame');
    }
    for(const point of preview.points){const pixel=projectScenePoint(point,preview,width,height);assert.ok(pixel.x>0&&pixel.x<width&&pixel.y>0&&pixel.y<height);}
  }
});
test('a returning introduction does not flash a closed poster over an open or inspected assembly', () => {
  const state={version:1,profile:'hero-intro',elapsed:5,paused:true,yaw:0};
  assert.equal(needsPlaybackRestorePreview(state,'hero-intro'),true);
  assert.equal(needsPlaybackRestorePreview({...state,elapsed:0},'hero-intro'),false);
  assert.equal(needsPlaybackRestorePreview({...state,elapsed:15},'hero-intro'),false);
  assert.equal(needsPlaybackRestorePreview({...state,elapsed:0,yaw:1},'hero-intro'),true);
});
