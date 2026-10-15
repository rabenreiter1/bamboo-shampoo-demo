import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createBody,shellRadiusAt} from '../assets/assembly/body.js';
import {createRitualCap} from '../assets/assembly/ritual-cap.js';
import {configurePetReflectionSkin} from '../assets/assembly/ritual-effects.js';
import {SURFACE_FINISH,createEngravedSurface,sampleEngraving,finishMicroSurface,finishCap} from '../assets/assembly/surface-finish.js';
const hash=b=>createHash('sha256').update(b).digest('hex');

test('laser relief removes material only, protects the fit and stays inside the approved drawing envelope',()=>{
 const width=32,height=32,mask=new Float32Array(width*height);
 for(let y=4;y<28;y++)for(let x=3;x<29;x++)mask[y*width+x]=1;
 const g=createEngravedSurface({THREE,mask,width,height});
 let cut=0,protectedCount=0;
 const p=g.attributes.position,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){
  const y=p.getY(i),radius=Math.hypot(p.getX(i),p.getZ(i)),reference=shellRadiusAt(y),delta=reference-radius;
  // Float32 Y at the steep seating notch contributes up to 0.000007 mm.
  assert.ok(delta>=-1e-5&&delta<=SURFACE_FINISH.engravingDepth+1e-5);
  assert.ok(Math.abs(uv.getY(i)-y/170)<1e-6);
  if(y>=148.8||y===0){assert.ok(Math.abs(delta)<1e-5);protectedCount++;}
  cut=Math.max(cut,delta);
 }
 assert.ok(protectedCount>0);assert.ok(cut>.064);
 assert.ok(g.index.count/3<220000,'one shared relief mesh remains bounded');
 assert.ok(p.count<112000,'surface tessellation stays inside its vertex budget');
 assert.equal(g.boundingBox.min.y,0);assert.equal(g.boundingBox.max.y,170);
 for(const a of Object.values(g.attributes))for(const v of a.array)assert.ok(Number.isFinite(v));
 g.dispose();
});

test('mask sampling preserves blank negative space and wraps identically across the seam',()=>{
 const mask=new Float32Array([0,1,0,0,0,0,0,0,0]);
 assert.equal(sampleEngraving(mask,3,3,0,0),0);
 assert.equal(sampleEngraving(mask,3,3,.5,1),1);
 assert.equal(sampleEngraving(mask,3,3,0,.5),sampleEngraving(mask,3,3,1,.5));
 assert.throws(()=>createEngravedSurface({THREE,mask,width:3,height:3,depth:.2}),/0.1 mm/);
});

test('silicone finish leaves cap geometry, deformation and independent pastel colours intact',async()=>{
 const a=await createRitualCap({THREE,colors:{cap:'#BAD1B0'}}),b=await createRitualCap({THREE,colors:{cap:'#E7B6AE'}});
 const meshes=[];a.group.traverse(o=>{if(o.isMesh)meshes.push([o,Float32Array.from(o.geometry.attributes.position.array)]);});
 finishCap(a);finishCap(b);
 for(const [mesh,positions]of meshes)assert.deepEqual(mesh.geometry.attributes.position.array,positions);
 const material=a.components.cap.children.find(o=>o.isMesh).material;
 assert.equal(material.roughness,.59);assert.equal(material.ior,1.41);assert.equal(material.clearcoat,0);
 const old=material.customProgramCacheKey();finishCap(a);assert.equal(material.customProgramCacheKey(),old);
 a.setColors({cap:'#B6CBDE'});
 const bMaterial=b.components.cap.children.find(o=>o.isMesh).material;
 assert.equal(bMaterial.color.getHexString(),'e7b6ae');
 a.update({press:1,lift:1,swivel:1});a.update({press:0,lift:0,swivel:0});
 for(const [mesh,positions]of meshes)assert.deepEqual(mesh.geometry.attributes.position.array,positions);
 a.dispose();b.dispose();
});

test('PET microfinish composes with its Fresnel interface without turning the liquid walls opaque',async()=>{
 const body=await createBody({THREE}),m=body.materials.clearPET;
 configurePetReflectionSkin({THREE,material:m});finishMicroSurface(m,{kind:'PET'});
 const shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <normal_fragment_maps>\nvec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;\n#include <opaque_fragment>'};
 m.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/vec3 outgoingLight = totalSpecular;/);
 assert.match(shader.fragmentShader,/petReflectance/);assert.match(shader.fragmentShader,/finishGradient/);
 assert.match(shader.fragmentShader,/smoothstep\(.025,.16,footprint\)/);
 assert.equal(m.transmission,0);assert.equal(m.depthWrite,false);assert.equal(m.transparent,true);assert.equal(m.ior,1.57);
 assert.match(m.customProgramCacheKey(),/fresnel-skin-v1.*PET/);
 body.dispose();
});

test('published material asset and immutable engraving match their recorded provenance',()=>{
 const manifest=JSON.parse(fs.readFileSync('scripts/surface-finish-manifest.json','utf8'));
 const bytes=fs.readFileSync(`assets/${manifest.asset}`);
 assert.equal(hash(bytes),manifest.assetSha256);assert.ok(bytes.length<500000);
 assert.ok(bytes.equals(fs.readFileSync(`docs/assembly/bamboo-culm-albedo.webp`)));
 assert.equal(hash(fs.readFileSync('assets/assembly/original-engraving.svg')),manifest.engravingSha256);
 assert.equal(manifest.depthMeasured,false);assert.equal(manifest.engravingDepthMillimeters,SURFACE_FINISH.engravingDepth);
 for(const [file,expected]of Object.entries(manifest.code)){
  for(const root of ['assets','docs']){
   const code=fs.readFileSync(`${root}/${file}`,'utf8').replaceAll('\r\n','\n');
   assert.equal(hash(Buffer.from(code)),expected);
  }
 }
 assert.equal(Object.keys(manifest.loadingFrames.assets).length,9);
 for(const [file,entry]of Object.entries(manifest.loadingFrames.assets)){
  const bytes=fs.readFileSync(`assets/${file}`);assert.equal(hash(bytes),entry.sha256);
  assert.ok(bytes.length<240000);assert.ok(bytes.equals(fs.readFileSync(`docs/assets/${file}`)));
 }
 const source=fs.readFileSync('assets/shop-scene.js','utf8'),standalone=fs.readFileSync('assets/assembly/scene.js','utf8');
 for(const code of [source,standalone]){assert.match(code,/finishBamboo/);assert.match(code,/finishCap/);assert.match(code,/finishMicroSurface/);}
});
