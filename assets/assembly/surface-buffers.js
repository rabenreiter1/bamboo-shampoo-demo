/** Deterministic material arithmetic; shared by the worker and yielding fallback. */
const clamp=(value,a=0,b=1)=>Math.min(b,Math.max(a,value));
export function* bambooMapSteps({pixels,ink,width:w,height:h,circumference=Math.PI*58,depth=.065}){
 if(pixels.length!==w*h*4||ink.length!==pixels.length)throw new TypeError('Bamboo inputs must be complete RGBA rasters.');
 const colour=new Uint8ClampedArray(w*h*4),roughness=new Uint8ClampedArray(w*h*4),normal=new Uint8ClampedArray(w*h*4),mask=new Float32Array(w*h),height=new Float32Array(w*h);
 for(let i=0;i<w*h;i++){
  const j=i*4,luma=(pixels[j]*.2126+pixels[j+1]*.7152+pixels[j+2]*.0722)/255;
  const coverage=(1-(ink[j]*.2126+ink[j+1]*.7152+ink[j+2]*.0722)/255)*ink[j+3]/255;mask[i]=coverage;
  const burn=[.36,.265,.17];
  for(let k=0;k<3;k++){colour[j+k]=pixels[j+k]*(1-coverage)+pixels[j+k]*burn[k]*coverage;roughness[j+k]=clamp(.71+(1-luma)*.16+coverage*.1)*255;}
  colour[j+3]=roughness[j+3]=normal[j+3]=255;
  const y=170*(1-Math.floor(i/w)/(h-1)),edge=clamp(y/.8)*clamp((148.8-y)/.8);
  height[i]=(luma-.68)*.028-coverage*depth*edge;
  if(i>0&&i%(w*64)===0)yield;
 }
 const dx=circumference/w,dy=170/h;
 for(let y=0;y<h;y++){
  for(let x=0;x<w;x++){
   const j=4*(y*w+x),nx=(height[y*w+(x+w-1)%w]-height[y*w+(x+1)%w])/(2*dx),ny=(height[Math.min(h-1,y+1)*w+x]-height[Math.max(0,y-1)*w+x])/(2*dy),length=Math.hypot(nx,ny,1);
   normal[j]=(nx/length*.5+.5)*255;normal[j+1]=(ny/length*.5+.5)*255;normal[j+2]=(.5/length+.5)*255;
  }
  if(y>0&&y%64===0)yield;
 }
 return {colour,roughness,normal,mask};
}
export function buildBambooMaps(input){const steps=bambooMapSteps(input);let value;do{value=steps.next();}while(!value.done);return value.value;}
export async function buildBambooMapsYielding(input,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))){const steps=bambooMapSteps(input);let value;while(!(value=steps.next()).done)await yieldTask();return value.value;}

export function packSurfaceGeometry(geometry){
 const attributes=Object.fromEntries(Object.entries(geometry.attributes).map(([name,attribute])=>[name,{array:attribute.array,itemSize:attribute.itemSize,normalized:attribute.normalized}]));
 return {attributes,index:geometry.index.array,userData:geometry.userData};
}
export function unpackSurfaceGeometry(THREE,packed){
 const geometry=new THREE.BufferGeometry();
 for(const [name,value]of Object.entries(packed.attributes))geometry.setAttribute(name,new THREE.BufferAttribute(value.array,value.itemSize,value.normalized));
 geometry.setIndex(new THREE.BufferAttribute(packed.index,1));geometry.userData=packed.userData;geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

/** Transfer expensive pixel and geometry work off the UI thread; failure is recoverable. */
export async function prepareBambooSurface(input,{THREE,geometryFactory,readInputs,workerFactory=typeof Worker==='function'?()=>new Worker(new URL('./surface-worker.js?v=runtime-worker1',import.meta.url),{type:'module'}):null,yieldTask}={}){
 if(workerFactory){
  let worker;
  try{
   worker=workerFactory();
   const packed=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Material preparation timed out.')),45000);
    worker.onmessage=event=>{clearTimeout(timer);event.data?.error?reject(new Error(event.data.error)):resolve(event.data);};
    worker.onerror=event=>{clearTimeout(timer);event.preventDefault?.();reject(new Error(event.message||'Material worker unavailable.'));};
    worker.onmessageerror=()=>{clearTimeout(timer);reject(new Error('Material worker response unavailable.'));};
    try{worker.postMessage(input,[input.pixels.buffer,input.ink.buffer]);}catch(error){clearTimeout(timer);reject(error);}
   });
   if(!packed?.geometry||!packed.colour||!packed.roughness||!packed.normal)throw new Error('Incomplete material worker response.');
   return {...packed,geometry:unpackSurfaceGeometry(THREE,packed.geometry),execution:'worker'};
  }catch{
   // Transferred rasters detach. Re-read the existing decoded canvases only if a worker failed.
   if(!input.pixels.byteLength||!input.ink.byteLength){if(!readInputs)throw new Error('Material inputs unavailable after worker failure.');input={...input,...readInputs()};}
  }finally{worker?.terminate();}
 }
 const maps=await buildBambooMapsYielding(input,yieldTask);
 if(yieldTask)await yieldTask();else await new Promise(resolve=>setTimeout(resolve,0));
 return {...maps,geometry:geometryFactory({THREE,mask:maps.mask,width:input.width,height:input.height,depth:input.depth}),execution:'yielding'};
}
