import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker as NodeWorker} from 'node:worker_threads';
import * as THREE from '../assets/assembly/vendor/three.module.js';
import {createEngravedSurface} from '../assets/assembly/surface-finish.js';
import {buildBambooMaps,buildBambooMapsYielding,prepareBambooSurface,packSurfaceGeometry} from '../assets/assembly/surface-buffers.js';

function inputs(width=129,height=130){const pixels=new Uint8ClampedArray(width*height*4),ink=new Uint8ClampedArray(pixels.length);for(let i=0;i<pixels.length;i++){pixels[i]=(i*47+19)%256;ink[i]=(i*17+91)%256;}return {pixels,ink,width,height,circumference:Math.PI*58,depth:.065};}
// Frozen independent copy of the pre-worker arithmetic, used as a migration oracle.
function legacyMaps({pixels,ink,width:w,height:h,circumference,depth}){
 const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),colour=new Uint8ClampedArray(w*h*4),roughness=new Uint8ClampedArray(w*h*4),normal=new Uint8ClampedArray(w*h*4),mask=new Float32Array(w*h),height=new Float32Array(w*h);
 for(let i=0;i<w*h;i++){
  const j=i*4,luma=(pixels[j]*.2126+pixels[j+1]*.7152+pixels[j+2]*.0722)/255,coverage=(1-(ink[j]*.2126+ink[j+1]*.7152+ink[j+2]*.0722)/255)*ink[j+3]/255;mask[i]=coverage;
  const burn=[.36,.265,.17];for(let k=0;k<3;k++){colour[j+k]=pixels[j+k]*(1-coverage)+pixels[j+k]*burn[k]*coverage;roughness[j+k]=clamp(.71+(1-luma)*.16+coverage*.1)*255;}
  colour[j+3]=roughness[j+3]=normal[j+3]=255;const y=170*(1-Math.floor(i/w)/(h-1)),edge=clamp(y/.8)*clamp((148.8-y)/.8);height[i]=(luma-.68)*.028-coverage*depth*edge;
 }
 const dx=circumference/w,dy=170/h;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const j=4*(y*w+x),nx=(height[y*w+(x+w-1)%w]-height[y*w+(x+1)%w])/(2*dx),ny=(height[Math.min(h-1,y+1)*w+x]-height[Math.max(0,y-1)*w+x])/(2*dy),length=Math.hypot(nx,ny,1);
  normal[j]=(nx/length*.5+.5)*255;normal[j+1]=(ny/length*.5+.5)*255;normal[j+2]=(.5/length+.5)*255;
 }
 return {colour,roughness,normal,mask};
}
function workerFactory(){
 const url=new URL('../assets/assembly/surface-worker.js',import.meta.url).href;
 const worker=new NodeWorker(`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:(value,transfer)=>parentPort.postMessage(value,transfer)};import(${JSON.stringify(url)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,{eval:true});
 const facade={postMessage:(value,transfer)=>worker.postMessage(value,transfer),terminate:()=>worker.terminate()};
 worker.on('message',data=>facade.onmessage?.({data}));worker.on('error',error=>facade.onerror?.(error));return facade;
}
test('worker map arithmetic and yielding fallback are byte-identical to the pre-worker material maps',async()=>{
 const input=inputs(),expected=legacyMaps(input);let yields=0;
 const direct=buildBambooMaps(input),fallback=await buildBambooMapsYielding(input,async()=>{yields++;});
 for(const name of Object.keys(expected)){assert.deepEqual(direct[name],expected[name]);assert.deepEqual(fallback[name],expected[name]);}assert.ok(yields>=4,'fallback yields during both expensive passes');
});
test('actual module worker transfers exact map, mesh, normal, UV, tangent and index buffers',async()=>{
 const input=inputs(),expected=legacyMaps(input),geometry=createEngravedSurface({THREE,mask:expected.mask,width:input.width,height:input.height,depth:input.depth});
 const result=await prepareBambooSurface(input,{THREE,geometryFactory:createEngravedSurface,workerFactory});
 assert.equal(result.execution,'worker');assert.equal(input.pixels.byteLength,0,'source rasters are transferred rather than copied');
 for(const name of['colour','roughness','normal'])assert.deepEqual(result[name],expected[name]);
 assert.deepEqual(packSurfaceGeometry(result.geometry),packSurfaceGeometry(geometry));geometry.dispose();result.geometry.dispose();
});
test('blocked worker uses the yielding fallback without changing geometry or material bytes',async()=>{
 const input=inputs(),expected=legacyMaps(input);let yields=0;
 const result=await prepareBambooSurface(input,{THREE,geometryFactory:createEngravedSurface,workerFactory:()=>{throw new Error('CSP');},yieldTask:async()=>{yields++;}});
 assert.equal(result.execution,'yielding');assert.ok(yields>=5);for(const name of['colour','roughness','normal'])assert.deepEqual(result[name],expected[name]);result.geometry.dispose();
});
test('failure after transfer re-reads decoded rasters and terminates the failed worker',async()=>{
 const input=inputs(),backup=inputs();let terminated=false,reRead=false;
 const result=await prepareBambooSurface(input,{THREE,geometryFactory:createEngravedSurface,readInputs:()=>{reRead=true;return backup;},workerFactory:()=>({postMessage(value,transfer){structuredClone(value,{transfer});queueMicrotask(()=>this.onerror({message:'failed',preventDefault(){}}));},terminate(){terminated=true;}}),yieldTask:async()=>{}});
 assert.ok(reRead&&terminated);assert.equal(result.execution,'yielding');assert.deepEqual(result.colour,legacyMaps(backup).colour);result.geometry.dispose();
});
