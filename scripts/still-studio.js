// Private, repeatable still capture. Not included in the public asset allowlist.
// Geometry is imported directly from the approved animation; no AI image edits.
import * as THREE from '/bamboo-shampoo-demo/assets/assembly/vendor/three.module.js';
import { createBody } from '/bamboo-shampoo-demo/assets/assembly/body.js';
import { createRitualCap } from '/bamboo-shampoo-demo/assets/assembly/ritual-cap.js';
import { createGel, createPeelSeal, configurePetReflectionSkin } from '/bamboo-shampoo-demo/assets/assembly/ritual-effects.js';
import { createStudioEnvironment } from '/bamboo-shampoo-demo/assets/assembly/studio-environment.js';
import { PRODUCT_THEMES } from '/bamboo-shampoo-demo/assets/product-theme.js';

const WIDTH=1280,HEIGHT=1600,ENGRAVING_SHA='67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa';
const SOURCE_NAMES=['assembly/body.js','assembly/body-profile.js','assembly/cap-data.js','assembly/ritual-cap.js','assembly/ritual-effects.js','assembly/original-engraving.svg','assembly/cap-reference.jpg','product-theme.js'];
const stage=document.querySelector('#stage'),status=document.querySelector('#status'),proofs=document.querySelector('#proofs');
const bundle={schema:'bamboo-source-stills-v1',source:{},frames:{},images:{}};
const paint=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const canvas=(w,h=w)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const texture=(source,color=false)=>{const t=new THREE.CanvasTexture(source);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=THREE.RepeatWrapping;t.anisotropy=16;return t;};
async function image(url){const i=new Image();i.src=url;await i.decode();return i;}
async function sourceManifest(){
 const files={};for(const name of SOURCE_NAMES){const r=await fetch(`/bamboo-shampoo-demo/assets/${name}`,{cache:'no-store'});if(!r.ok)throw Error(`Source missing: ${name}`);files[name]=await digest(await r.arrayBuffer());}
 const drawing=await fetch('/reference/actual250.pdf');files.actual250Drawing=await digest(await drawing.arrayBuffer());
 if(files['assembly/original-engraving.svg']!==ENGRAVING_SHA)throw Error('Original engraving changed.');
 return files;
}
async function geometryDigest(groups){
 const entries=[];for(const group of groups)group.traverse(o=>{if(!o.isMesh)return;entries.push([o.name,o.geometry]);});
 const result={};for(const [name,g] of entries){const attrs={};for(const key of Object.keys(g.attributes).sort())attrs[key]=await digest(g.attributes[key].array.buffer);if(g.index)attrs.index=await digest(g.index.array.buffer);result[name]=attrs;}
 return result;
}
// Use a clean, unengraved patch of the REAL prototype for fibre variation.
// Remove photographic lighting before applying it as an albedo/roughness map.
// The original SVG is rasterized separately at its factory registration/aspect.
async function materialStudy(body){
 const w=2048,h=2048,patch=canvas(135,140),pc=patch.getContext('2d',{willReadFrequently:true});
 pc.drawImage(await image('/reference/material.jpg'),95,335,135,140,0,0,135,140);
 const pixels=pc.getImageData(0,0,135,140).data,lum=new Float32Array(135*140);
 const row=new Float32Array(140),col=new Float32Array(135);let mean=0;
 for(let y=0;y<140;y++)for(let x=0;x<135;x++){const i=y*135+x,j=i*4,v=pixels[j]*.2126+pixels[j+1]*.7152+pixels[j+2]*.0722;lum[i]=v;row[y]+=v/135;col[x]+=v/140;mean+=v/(135*140);}
 const art=canvas(w,h),ac=art.getContext('2d',{willReadFrequently:true});
 const printHeight=h*body.metrics.surfaceMap.printHeightMillimeters/170;
 ac.drawImage(await image('/bamboo-shampoo-demo/assets/assembly/original-engraving.svg'),0,h-printHeight,w,printHeight);
 const mask=ac.getImageData(0,0,w,h).data;
 const color=canvas(w,h),rough=canvas(w,h),normal=canvas(w,h),height=new Float32Array(w*h);
 const cc=color.getContext('2d'),rc=rough.getContext('2d'),nc=normal.getContext('2d');
 const cd=cc.createImageData(w,h),rd=rc.createImageData(w,h),nd=nc.createImageData(w,h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,j=i*4;
  // Mirrored tiling avoids seams; physical fibre width follows the real patch.
  const sx=x%270,sy=y%280,px=sx<135?sx:269-sx,py=sy<140?sy:279-sy;
  const fibre=(lum[py*135+px]-row[py]-.6*(col[px]-mean))*.62;
  const broad=Math.sin(x*.012)*1.8+Math.sin(x*.043+y*.0005)*.8;
  const grain=fibre+broad;
  const ink=(1-(mask[j]*.2126+mask[j+1]*.7152+mask[j+2]*.0722)/255)*mask[j+3]/255;
  const base=[198+grain,163+grain*.9,109+grain*.7],burn=[77+grain*.22,48+grain*.18,24+grain*.12];
  for(let k=0;k<3;k++){cd.data[j+k]=base[k]*(1-ink)+burn[k]*ink;rd.data[j+k]=185+grain*.6+ink*12;}
  cd.data[j+3]=rd.data[j+3]=255;height[i]=grain*.0012-ink*.028;
 }
 const dx=Math.PI*58/w,dy=170/h;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const j=(y*w+x)*4,nx=(height[y*w+(x+w-1)%w]-height[y*w+(x+1)%w])/(2*dx),ny=(height[Math.min(h-1,y+1)*w+x]-height[Math.max(0,y-1)*w+x])/(2*dy),l=Math.hypot(nx,ny,1);
  nd.data[j]=(nx/l*.5+.5)*255;nd.data[j+1]=(ny/l*.5+.5)*255;nd.data[j+2]=(.5/l+.5)*255;nd.data[j+3]=255;
 }
 cc.putImageData(cd,0,0);rc.putImageData(rd,0,0);nc.putImageData(nd,0,0);
 const wood=body.materials.wood;
 wood.map=texture(color,true);wood.roughnessMap=texture(rough);wood.normalMap=texture(normal);wood.roughness=.91;wood.needsUpdate=true;
 // Fine silicone microtexture changes normals only, never the source outline.
 const micro=canvas(256),mc=micro.getContext('2d'),md=mc.createImageData(256,256);let seed=832715;
 for(let i=0;i<md.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=120+(seed>>>24)/16;md.data[i]=md.data[i+1]=md.data[i+2]=v;md.data[i+3]=255;}mc.putImageData(md,0,0);
 const noise=texture(micro);noise.wrapT=THREE.RepeatWrapping;noise.repeat.set(12,12);
 const sourceBytes=await (await fetch('/reference/material.jpg')).arrayBuffer();
 return {noise,patchRect:[95,335,135,140],sha256:await digest(sourceBytes),source:'User photograph, C2C2DB76/1-Photo-1.jpg, real bamboo material only; does not supply geometry.'};
}
let running=false;
async function run(){
 if(running)return;running=true;document.querySelector('#capture').disabled=true;
 let body,cap,seal,gel,renderer,env;
 try{
  status.textContent='Verifying current drawing and source meshes…';bundle.source=await sourceManifest();
  [body,cap]=await Promise.all([createBody({THREE}),createRitualCap({THREE,colors:PRODUCT_THEMES.aloe.capColors})]);
  seal=createPeelSeal({THREE});gel=createGel({THREE,scent:'aloe'});
  const groups=[body.components.shell,body.components.inlay,cap.group];
  const before=await geometryDigest(groups),materials=await materialStudy(body);
  cap.group.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.roughness=.67;if(o.geometry.attributes.uv){m.bumpMap=materials.noise;m.bumpScale=.009;}m.needsUpdate=true;}});
  const after=await geometryDigest(groups);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Material study changed source geometry.');
  bundle.geometry={before,after,identical:true};bundle.body=body.metrics;bundle.cap=cap.metrics;bundle.seal=seal.metrics;bundle.gel=gel.metrics;bundle.materialReference=materials;
  delete bundle.materialReference.noise;
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true});
  renderer.setSize(WIDTH,HEIGHT,false);renderer.setPixelRatio(1);renderer.setClearColor('#F8F6EF',0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.replaceChildren(renderer.domElement);
  const scene=new THREE.Scene();env=createStudioEnvironment({THREE,renderer});scene.environment=env.texture;scene.environmentIntensity=.42;
  scene.add(new THREE.HemisphereLight('#fffaf2','#5d6658',.32));
  for(const [x,y,z,power] of [[-220,340,300,2.3],[-170,370,325,.6]]){
   const light=new THREE.DirectionalLight('#fff5e7',power);light.position.set(x,y,z);light.castShadow=true;light.shadow.mapSize.set(4096,4096);Object.assign(light.shadow.camera,{left:-150,right:150,top:210,bottom:-120,near:1,far:1200});light.shadow.camera.updateProjectionMatrix();light.shadow.bias=-.00007;light.shadow.normalBias=.04;light.shadow.radius=6;scene.add(light);
  }
  const fill=new THREE.DirectionalLight('#eef4ff',.38);fill.position.set(260,160,180);scene.add(fill);
  const rim=new THREE.DirectionalLight('#fffaf0',.55);rim.position.set(150,240,-170);scene.add(rim);
  const product=new THREE.Group();product.add(body.components.shell,body.components.inlay,seal.group,cap.group,gel.oldFillGroup);scene.add(product);
  configurePetReflectionSkin({THREE,material:body.materials.clearPET});
  // A broad light-tent contact pool avoids a clipped, hard directional shadow
  // on the transparent packshot. This is lighting, not part of the product.
  const contact=canvas(512),ctx=contact.getContext('2d'),gradient=ctx.createRadialGradient(256,256,0,256,256,256);
  gradient.addColorStop(0,'#2632204d');gradient.addColorStop(.28,'#26322024');gradient.addColorStop(.65,'#26322009');gradient.addColorStop(1,'#26322000');ctx.fillStyle=gradient;ctx.fillRect(0,0,512,512);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(130,105),new THREE.MeshBasicMaterial({map:texture(contact,true),transparent:true,depthWrite:false,toneMapped:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-.12;scene.add(floor);
  const camera=new THREE.OrthographicCamera(-100,100,100,-100,.1,2400);
  function frame({mode,elevation=12,focus,worldHeight,yaw=0}){
   body.components.shell.visible=mode==='product'||mode==='shell';body.components.inlay.visible=mode==='refill'||mode==='detail';
   cap.group.visible=mode==='product'||mode==='cap';seal.group.visible=mode==='refill'||mode==='detail';gel.oldFillGroup.visible=mode==='refill'||mode==='detail';
   gel.update({fillOld:1,fillNew:1,visible:mode==='refill'||mode==='detail'});cap.update({lift:0,swivel:0,press:0});seal.update({unfold:0,peel:0,exit:0});
   product.rotation.set(0,yaw,0);product.position.set(0,0,0);floor.visible=mode!=='detail';floor.position.y=mode==='cap'?149.78:-.12;
   const box=new THREE.Box3().setFromObject(mode==='cap'?cap.group:mode==='shell'?body.components.shell:mode==='refill'||mode==='detail'?body.components.inlay:product);
   const center=focus?new THREE.Vector3(...focus):box.getCenter(new THREE.Vector3());
   const e=THREE.MathUtils.degToRad(elevation),height=worldHeight||((mode==='cap'?75:box.max.y-box.min.y)/.86);
   camera.left=-height*(renderer.domElement.width/renderer.domElement.height)/2;camera.right=-camera.left;camera.top=height/2;camera.bottom=-height/2;
   camera.position.copy(center).add(new THREE.Vector3(0,Math.sin(e)*800,Math.cos(e)*800));camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld();scene.updateMatrixWorld(true);
   return {mode,elevation,yaw,center:center.toArray(),worldHeight:height,camera:camera.position.toArray(),left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom};
  }
  async function capture(name,options){
   status.textContent=`Rendering ${name} from approved source…`;
   const detail=options.mode==='detail';renderer.setSize(detail?1536:WIDTH,detail?1024:HEIGHT,false);
   const projection=frame(options);if(renderer.compileAsync)await renderer.compileAsync(scene,camera);await paint();renderer.render(scene,camera);await paint();renderer.render(scene,camera);
   const out=canvas(renderer.domElement.width,renderer.domElement.height);out.getContext('2d').drawImage(renderer.domElement,0,0);
   bundle.images[name]=out.toDataURL('image/png');bundle.frames[name]={...projection,width:out.width,height:out.height,scent:options.scent||'aloe',sourceGeometryIdentical:true,engravingSha256:ENGRAVING_SHA};
   const figure=document.createElement('figure'),img=new Image();img.src=bundle.images[name];img.alt=name;const caption=document.createElement('figcaption');caption.textContent=name;figure.append(img,caption);proofs.append(figure);
  }
  for(const scent of ['aloe','argan','bamboo']){cap.setColors(PRODUCT_THEMES[scent].capColors);await capture(`photo-product-${scent}`,{mode:'product',scent});}
  for(const scent of ['aloe','argan','bamboo']){gel.setScent(scent);await capture(`photo-refill-${scent}`,{mode:'refill',scent,elevation:10});}
  await capture('photo-shell',{mode:'shell',elevation:18});cap.setColors(PRODUCT_THEMES.argan.capColors);await capture('photo-cap-argan',{mode:'cap',scent:'argan',elevation:56,yaw:-.12,worldHeight:86});
  gel.setScent('aloe');await capture('photo-refill-detail',{mode:'detail',elevation:22,focus:[0,153,0],worldHeight:64});
  if(JSON.stringify(bundle.source)!==JSON.stringify(await sourceManifest()))throw Error('Source changed during capture.');
  bundle.captureScriptSha256=await digest(await (await fetch('/scripts/still-studio.js',{cache:'no-store'})).arrayBuffer());
  const download=document.querySelector('#download');download.href=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'}));download.download='bamboo-source-stills-20261015-v2.json';download.hidden=false;
  status.textContent='9 source-derived frames ready. Geometry unchanged; original engraving verified.';
 }catch(error){status.textContent=`Capture failed: ${error.message}`;console.error(error);}finally{running=false;document.querySelector('#capture').disabled=false;body?.dispose();cap?.dispose();seal?.dispose();gel?.dispose();env?.dispose();renderer?.dispose();}
}
document.querySelector('#capture').addEventListener('click',run);
