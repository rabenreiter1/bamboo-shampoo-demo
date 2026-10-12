import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createBody,shellRadiusAt} from '../assets/assembly/body.js';
import {createCap} from '../assets/assembly/cap.js';
import {computeAssemblyState,COMPONENT_IDS} from '../assets/assembly/timeline.js';

const body=await createBody({THREE}),cap=await createCap({THREE});
const near=(actual,expected,tolerance=.0001)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} ≠ ${expected}`);
const size=group=>new THREE.Box3().setFromObject(group,true).getSize(new THREE.Vector3());

test('six independent, finite geometry groups have confirmed dimensions',()=>{
  const parts={...body.components,...cap.components};
  assert.deepEqual(Object.keys(parts).sort(),[...COMPONENT_IDS].sort());
  const shell=size(parts.shell);near(shell.x,58);near(shell.y,170);near(shell.z,58);
  const petBody=size(parts.inlay.getObjectByName('PET_hollow_body_D47_H165'));near(petBody.x,47);near(petBody.y,165);
  const petFlange=size(parts.inlay.getObjectByName('PET_sealing_flange_D58_radial5_5'));near(petFlange.x,58);near(petFlange.z,58);
  near(size(parts.cap).x,59);near(size(parts.cap).z,59);
  for(const part of Object.values(parts))part.traverse(object=>{
    for(const attribute of Object.values(object.geometry?.attributes||{}))for(const number of attribute.array)assert.ok(Number.isFinite(number));
  });
});

test('cap collar fits actual tube contour and upper roof contacts PET flange',()=>{
  const collar=cap.components.cap.getObjectByName('cap-collar-OD59-seat-OD58-wall0.5');
  const position=collar.geometry.getAttribute('position');
  const level=new Map();
  for(let i=0;i<position.count;i++) {
    const y=position.getY(i),r=Math.hypot(position.getX(i),position.getZ(i));
    const entry=level.get(y)||{min:Infinity,max:-Infinity};entry.min=Math.min(entry.min,r);entry.max=Math.max(entry.max,r);level.set(y,entry);
  }
  const sorted=[...level].sort((a,b)=>a[0]-b[0]);
  for(const [y,r]of sorted) near(r.max-r.min,.5,.00002);
  for(let y=cap.metrics.lowerSeatBottom;y<=170;y+=.02) {
    let i=1;while(i<sorted.length-1&&sorted[i][0]<y)i++;
    const [ay,a]=sorted[i-1],[by,b]=sorted[i],mix=(y-ay)/(by-ay);
    const bore=a.min+(b.min-a.min)*mix;
    assert.ok(bore-shellRadiusAt(y)>-.00002,`Collar overlaps bamboo at Y${y}`);
  }
  near(cap.metrics.roofUnderside,body.metrics.dimensions.shellHeight+body.metrics.dimensions.flangeThicknessPlaceholder);
});

test('source engraving bytes and native artwork aspect are retained',()=>{
  const originalUrl=new URL('../qa/reference/final-engraving.svg',import.meta.url);
  const delivery=fs.readFileSync(new URL('../assets/assembly/original-engraving.svg',import.meta.url));
  if(fs.existsSync(originalUrl))assert.ok(fs.readFileSync(originalUrl).equals(delivery));
  assert.equal(createHash('sha256').update(delivery).digest('hex'),'67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa');
  assert.equal(createHash('sha256').update(delivery).digest('hex'),body.metrics.surfaceMap.originalAssetSha256);
  assert.equal(body.metrics.surfaceMap.nominalAspectRatioPreserved,true);
});

test('timeline is reversible, finite and moves the PET axially while inside bamboo',()=>{
  const forward=[];
  for(let i=0;i<=1000;i++) {
    const state=computeAssemblyState(i/1000);forward.push(state);
    for(const part of Object.values(state.components))for(const n of [...part.position,...part.rotation])assert.ok(Number.isFinite(n));
    const [x,y,z]=state.components.inlay.position;
    if(5+y<170-.001)assert.ok(Math.hypot(x,z)<=.5,`PET passes sideways through shell at progress${i/1000}`);
    if(state.assembled)assert.equal(state.components.seal.visible,false);
  }
  for(let i=1000;i>=0;i--)assert.deepEqual(computeAssemblyState(i/1000),forward[i]);
  assert.equal(forward[0].components.seal.visible,false);
  assert.equal(forward[240].components.seal.visible,true);
  const last=forward.at(-1);near(last.rotationY,Math.PI*4);
  for(const id of COMPONENT_IDS.filter(id=>id!=='seal'))assert.deepEqual(last.components[id].position,[0,0,0]);
  assert.equal(last.components.seal.visible,false);
});

test.after(()=>{body.dispose();cap.dispose();});
