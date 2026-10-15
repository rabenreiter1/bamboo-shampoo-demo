import {TUBE_PROFILE} from './body-profile.js';
import {shellRadiusAt} from './body.js';

export const SURFACE_FINISH = Object.freeze({
 version:'culm-20261015-1', textureSize:2048, circumference:Math.PI*58, height:170,
 engravingDepth:.065, reliefAssumed:true, angularSegments:256, axialSegments:256,
 source:'Original prototype photograph used as material reference; generated unlit culm albedo. Original SVG is the sole engraving mask.',
 limits:'Laser depth, microscopic roughness and optical coefficients are visual material settings, not measured manufacturing specifications.',
});
const TAU=Math.PI*2, front=221/516.5;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const canvas=(w,h=w)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
async function image(url){const i=new Image();i.decoding='async';i.src=url;await i.decode();return i;}
function texture(THREE,c,color=false){const t=new THREE.CanvasTexture(c);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=THREE.RepeatWrapping;t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=8;return t;}

export function sampleEngraving(mask,width,height,u,v){
 const x=((u%1+1)%1)*(width-1),y=clamp(1-v)*(height-1),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=x-x0,fy=y-y0;
 const a=mask[y0*width+x0]*(1-fx)+mask[y0*width+x1]*fx,b=mask[y1*width+x0]*(1-fx)+mask[y1*width+x1]*fx;
 return clamp(a*(1-fy)+b*fy);
}

/** Inward-only micromachining, never a new envelope or guessed tube contour.
 * Original drawing samples remain in the tessellation; cap seating and cut
 * end faces are protected. High-resolution tangent normals resolve fine type
 * below the mesh sampling pitch, as in a normal/displacement production asset.
 */
export function createEngravedSurface({THREE,mask,width,height,angularSegments=SURFACE_FINISH.angularSegments,axialSegments=SURFACE_FINISH.axialSegments,depth=SURFACE_FINISH.engravingDepth}){
 if(!(mask instanceof Float32Array)||mask.length!==width*height)throw new TypeError('An original-artwork coverage mask is required.');
 if(!Number.isFinite(depth)||depth<0||depth>.1)throw new RangeError('Laser relief is limited to 0.1 mm inward.');
 const ys=[...new Set([...TUBE_PROFILE.map(p=>p[0]),...Array.from({length:axialSegments+1},(_,n)=>170*n/axialSegments)])].sort((a,b)=>a-b);
 const g=new THREE.LatheGeometry(ys.map(y=>new THREE.Vector2(shellRadiusAt(y),y)),angularSegments,-TAU*front,TAU);
 const p=g.attributes.position,uv=g.attributes.uv,normals=g.attributes.normal;
 let deepest=0;
 for(let i=0;i<p.count;i++){
  const y=p.getY(i),u=uv.getX(i),weight=clamp(y/.8)*clamp((148.8-y)/.8),cut=depth*sampleEngraving(mask,width,height,u,y/170)*weight;
  const r=Math.hypot(p.getX(i),p.getZ(i)),scale=(r-cut)/r;
  p.setXYZ(i,p.getX(i)*scale,y,p.getZ(i)*scale);uv.setY(i,y/170);deepest=Math.max(deepest,cut);
  // The raster trace contains subpixel slope steps, not machined horizontal
  // rings. Smooth its shading derivative without moving a contour vertex.
  if(y<148.5){
   const low=Math.max(0,y-3),high=Math.min(148.5,y+3),slope=(shellRadiusAt(high)-shellRadiusAt(low))/(high-low);
   const length=Math.hypot(1,slope);normals.setXYZ(i,p.getX(i)/(r-cut)/length,-slope/length,p.getZ(i)/(r-cut)/length);
  }
 }
 // The high-resolution height-derived normals supply the full laser bevel;
 // retaining the underlying contour normals prevents counting relief twice.
 p.needsUpdate=true;uv.needsUpdate=true;g.computeTangents();g.computeBoundingBox();g.computeBoundingSphere();
 g.userData={surfaceFinish:SURFACE_FINISH.version,inwardOnly:true,maximumCutMillimeters:deepest,referenceContour:'actual250.pdf',originalArtworkUnchanged:true};
 return g;
}

/** Apply once to a shared body. The original source factories stay immutable. */
export async function finishBamboo({THREE,body,albedoUrl=new URL('./bamboo-culm-albedo.webp',import.meta.url).href,engravingUrl=new URL('./original-engraving.svg',import.meta.url).href}){
 if(body.metrics.surfaceFinish)return body;
 const [albedo,art]=await Promise.all([image(albedoUrl),image(engravingUrl)]),w=SURFACE_FINISH.textureSize,h=w;
 const base=canvas(w,h),bc=base.getContext('2d',{willReadFrequently:true});bc.drawImage(albedo,0,0,w,h);
 const pixels=bc.getImageData(0,0,w,h).data;
 const artwork=canvas(w,h),ac=artwork.getContext('2d',{willReadFrequently:true}),printHeight=h*body.metrics.surfaceMap.printHeightMillimeters/170;
 ac.drawImage(art,0,h-printHeight,w,printHeight);const ink=ac.getImageData(0,0,w,h).data;
 const colour=canvas(w,h),rough=canvas(w,h),normal=canvas(w,h),cc=colour.getContext('2d'),rc=rough.getContext('2d'),nc=normal.getContext('2d');
 const cd=cc.createImageData(w,h),rd=rc.createImageData(w,h),nd=nc.createImageData(w,h),mask=new Float32Array(w*h),height=new Float32Array(w*h);
 for(let i=0;i<w*h;i++){
  const j=i*4,luma=(pixels[j]*.2126+pixels[j+1]*.7152+pixels[j+2]*.0722)/255;
  const coverage=(1-(ink[j]*.2126+ink[j+1]*.7152+ink[j+2]*.0722)/255)*ink[j+3]/255;mask[i]=coverage;
  // Burnt fibre remains porous wood, rather than opaque black printing.
  const burn=[.36,.265,.17];
  for(let k=0;k<3;k++){cd.data[j+k]=pixels[j+k]*(1-coverage)+pixels[j+k]*burn[k]*coverage;rd.data[j+k]=clamp(.71+(1-luma)*.16+coverage*.1)*255;}
  cd.data[j+3]=rd.data[j+3]=nd.data[j+3]=255;
  const y=170*(1-Math.floor(i/w)/(h-1)),edge=clamp(y/.8)*clamp((148.8-y)/.8);
  height[i]=(luma-.68)*.028-coverage*SURFACE_FINISH.engravingDepth*edge;
 }
 const dx=SURFACE_FINISH.circumference/w,dy=170/h;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const j=4*(y*w+x),nx=(height[y*w+(x+w-1)%w]-height[y*w+(x+1)%w])/(2*dx),ny=(height[Math.min(h-1,y+1)*w+x]-height[Math.max(0,y-1)*w+x])/(2*dy),length=Math.hypot(nx,ny,1);
  nd.data[j]=(nx/length*.5+.5)*255;nd.data[j+1]=(ny/length*.5+.5)*255;nd.data[j+2]=(.5/length+.5)*255;
 }
 cc.putImageData(cd,0,0);rc.putImageData(rd,0,0);nc.putImageData(nd,0,0);
 const oldWood=body.materials.wood;
 for(const name of ['map','normalMap','roughnessMap'])oldWood[name]?.dispose();
 const wood=new THREE.MeshPhysicalMaterial({color:'#ffffff',map:texture(THREE,colour,true),normalMap:texture(THREE,normal),roughnessMap:texture(THREE,rough),roughness:.76,metalness:0,ior:1.46,specularIntensity:.9,clearcoat:.12,clearcoatRoughness:.48,anisotropy:.15,anisotropyRotation:Math.PI/2});
 wood.name='Natural_culm_satin_finish_with_recessed_original_laser_artwork';
 body.components.shell.traverse(o=>{if(o.material===oldWood)o.material=wood;});body.materials.wood=wood;oldWood.dispose();
 const shell=body.components.shell.getObjectByName('Bamboo_outer_sourced_contour_and_original_engraving'),old=shell.geometry;
 shell.geometry=createEngravedSurface({THREE,mask,width:w,height:h});old.dispose();
 // The bore has the same axial culm grain, without any copied label artwork.
 body.materials.innerWood.color.set('#cbb58c');body.materials.innerWood.map=texture(THREE,base,true);body.materials.innerWood.roughness=.84;body.materials.innerWood.needsUpdate=true;
 body.materials.endGrain.color.setRGB(1.12,1.08,1.02);body.materials.endGrain.roughness=.8;
 body.metrics.surfaceFinish={...SURFACE_FINISH,reliefVertices:shell.geometry.attributes.position.count,reliefTriangles:shell.geometry.index.count/3,geometryRelief:true,grainRelief:'Height-derived tangent normals; photographic culm albedo; no painted lighting.',finish:'Subtle satin dielectric finish; longitudinal anisotropy; rough burnt laser fibres.'};
 return body;
}

/** Object-space, derivative-filtered mould microtexture works even on the
 * cap's refined surfaces that deliberately have no UVs. No silhouette noise.
 */
export function finishMicroSurface(material,{kind='silicone'}={}){
 if(material.userData.microSurface)return;
 const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey.bind(material);
 const isPET=kind==='PET',amplitude=isPET?.00065:.0025;
 material.onBeforeCompile=function(shader,...args){
  previous.call(this,shader,...args);
  shader.vertexShader='varying vec3 vFinishPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFinishPosition = position;');
  shader.fragmentShader=/* glsl */`varying vec3 vFinishPosition;
    float finishHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
    float finishNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(finishHash(i),finishHash(i+vec3(1,0,0)),f.x),mix(finishHash(i+vec3(0,1,0)),finishHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(finishHash(i+vec3(0,0,1)),finishHash(i+vec3(1,0,1)),f.x),mix(finishHash(i+vec3(0,1,1)),finishHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
   `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',/* glsl */`#include <normal_fragment_maps>
   float footprint=max(length(dFdx(vFinishPosition)),length(dFdy(vFinishPosition)));
   float finishHeight=finishNoise(vFinishPosition*18.0)*${amplitude.toFixed(6)}*(1.0-smoothstep(.025,.16,footprint));
   vec3 finishDx=dFdx(-vViewPosition),finishDy=dFdy(-vViewPosition);
   vec3 finishR1=cross(finishDy,normal),finishR2=cross(normal,finishDx);
   float finishDet=dot(finishDx,finishR1);
   vec3 finishGradient=sign(finishDet)*(dFdx(finishHeight)*finishR1+dFdy(finishHeight)*finishR2);
   if(abs(finishDet)>1e-8) normal=normalize(abs(finishDet)*normal-finishGradient);
  `);
 };
 material.customProgramCacheKey=()=>`${oldKey()}-${SURFACE_FINISH.version}-${kind}`;
 if(!isPET){Object.assign(material,{roughness:.59,metalness:0,clearcoat:0});if(material.isMeshPhysicalMaterial){material.ior=1.41;material.specularIntensity=.85;material.sheen=.06;material.sheenRoughness=.8;material.sheenColor.set('#d8ded4');}}
 material.userData.microSurface={kind,amplitudeMillimeters:amplitude,filtered:true,coordinateSpace:'object',profileUnchanged:true};material.needsUpdate=true;
}

export function finishCap(cap){cap.group.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])finishMicroSurface(m);});cap.metrics.surfaceFinish={version:SURFACE_FINISH.version,material:'pigmented moulded silicone',ior:1.41,roughness:.59,measured:false};return cap;}
