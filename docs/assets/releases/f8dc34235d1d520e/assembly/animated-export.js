import { computeAssemblyState, COMPONENT_IDS } from './timeline.js';
import { GLTFExporter } from './vendor/GLTFExporter.js';

/** A portable GLB with the same rigid-part choreography used by the viewer. */
export async function exportAssemblyAnimation({ THREE, cloneExportProduct, download=true, duration=14, samples=241 }) {
  const product=cloneExportProduct({assembled:true,includeSeal:true});
  product.name='Bamboo_250ml_assembly';
  product.userData.animation={type:'reversible assembly and two Y-axis turns',durationSeconds:duration,source:'same normalized scroll timeline as review page'};
  const groups=new Map();
  product.traverse(object=>{if(COMPONENT_IDS.includes(object.userData?.component)) groups.set(object.userData.component,object);});
  if(groups.size!==6) throw new Error(`Expected six separate component groups, found ${groups.size}`);
  for(const object of groups.values()) {object.position.set(0,0,0);object.quaternion.identity();object.scale.set(1,1,1);object.visible=true;}
  product.quaternion.identity();
  const time=[],values=new Map(COMPONENT_IDS.map(id=>[id,{position:[],quaternion:[],scale:[]}])),rootRotation=[];
  const euler=new THREE.Euler(),q=new THREE.Quaternion();
  for(let i=0;i<samples;i++) {
    const progress=i/(samples-1),state=computeAssemblyState(progress);
    time.push(progress*duration);
    q.setFromEuler(euler.set(0,state.rotationY,0));rootRotation.push(q.x,q.y,q.z,q.w);
    for(const id of COMPONENT_IDS) {
      const pose=state.components[id],value=values.get(id);
      value.position.push(...pose.position);
      q.setFromEuler(euler.set(...pose.rotation));value.quaternion.push(q.x,q.y,q.z,q.w);
      // glTF does not animate visibility; shrink the removed foil after its exit.
      const size=id==='seal'&&!pose.visible?0.00001:1;
      value.scale.push(size,size,size);
    }
  }
  const tracks=[new THREE.QuaternionKeyframeTrack(`${product.uuid}.quaternion`,time,rootRotation)];
  for(const [id,object] of groups) {
    const value=values.get(id);
    tracks.push(new THREE.VectorKeyframeTrack(`${object.uuid}.position`,time,value.position));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${object.uuid}.quaternion`,time,value.quaternion));
    if(id==='seal') tracks.push(new THREE.VectorKeyframeTrack(`${object.uuid}.scale`,time,value.scale));
  }
  const clip=new THREE.AnimationClip('Scroll_assembly_250ml',duration,tracks);
  const result=await new GLTFExporter().parseAsync(product,{binary:true,trs:true,onlyVisible:true,maxTextureSize:2048,animations:[clip]});
  if(download) {
    const url=URL.createObjectURL(new Blob([result],{type:'model/gltf-binary'}));
    const link=document.createElement('a');link.href=url;link.download='bamboo-250ml-animated-assembly.glb';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  return result;
}
