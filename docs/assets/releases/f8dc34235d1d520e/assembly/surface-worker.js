import * as THREE from './vendor/three.module.js';
import {createEngravedSurface} from './surface-finish.js?v=runtime-worker1';
import {buildBambooMaps,packSurfaceGeometry} from './surface-buffers.js?v=runtime-worker1';

self.onmessage=event=>{
 try{
  const input=event.data,maps=buildBambooMaps(input);
  const geometry=createEngravedSurface({THREE,mask:maps.mask,width:input.width,height:input.height,depth:input.depth});
  const packed=packSurfaceGeometry(geometry),output={colour:maps.colour,roughness:maps.roughness,normal:maps.normal,geometry:packed};
  const transfers=[output.colour.buffer,output.roughness.buffer,output.normal.buffer,packed.index.buffer,...Object.values(packed.attributes).map(attribute=>attribute.array.buffer)];
  self.postMessage(output,transfers);geometry.dispose();
 }catch(error){self.postMessage({error:error?.message||String(error)});}
};
