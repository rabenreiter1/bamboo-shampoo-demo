import * as THREE from '/bamboo-shampoo-demo/assets/assembly/vendor/three.module.js';
import { mountShopScene } from '/bamboo-shampoo-demo/assets/shop-scene.js?v=motion-posters-20261016';
import {finishBamboo,finishCap,finishMicroSurface} from '/bamboo-shampoo-demo/assets/assembly/surface-finish.js';
import { PRODUCT_THEMES } from '/bamboo-shampoo-demo/assets/product-theme.js';
import { CAP_SOURCE } from '/bamboo-shampoo-demo/assets/assembly/cap-data.js';
import { createBody } from '/bamboo-shampoo-demo/assets/assembly/body.js';
import { createRitualCap } from '/bamboo-shampoo-demo/assets/assembly/ritual-cap.js';
import { createStudioEnvironment } from '/bamboo-shampoo-demo/assets/assembly/studio-environment.js';
import { configurePetReflectionSkin, createPeelSeal } from '/bamboo-shampoo-demo/assets/assembly/ritual-effects.js';

const WIDTH=1280,HEIGHT=1600,TOTAL=27,SCENTS=['aloe','argan','bamboo'];
const ENGRAVING_SHA='67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa';
const SOURCE_FILES=['product-theme.js','shop-scene.js','scene-framing.js','campaign-backdrop.js',
  'journey-pose.js','scene-preview.js','prime-shop.js','assembly/surface-finish.js','assembly/surface-buffers.js','assembly/surface-worker.js','assembly/bamboo-culm-albedo.webp','assembly/studio-environment.js','assembly/body.js','assembly/body-profile.js','assembly/cap-data.js','assembly/ritual-cap.js',
  'assembly/ritual-timeline.js','assembly/ritual-space.js','assembly/ritual-effects.js'];
const EXTERNAL_REGION={minX:.06,maxX:.94,minY:.05,maxY:.95,layout:'external'};
const stage=document.querySelector('#stage'),status=document.querySelector('#state'),proofs=document.querySelector('#proofs');
const bundle={schema:'bamboo-motion-posters-v1',reference:[WIDTH,HEIGHT],source:null,images:{},frames:{}};
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
let busy=false,downloadUrl=null,activeView=null;

function report(message){status.value=message;stage.dataset.captureStatus=busy?'capturing':'ready';}
async function sha256(buffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(value=>value.toString(16).padStart(2,'0')).join('');}
async function sourceManifest(){
  const files={};
  for(const name of SOURCE_FILES){const response=await fetch(`/bamboo-shampoo-demo/assets/${name}`,{cache:'no-store'});if(!response.ok)throw new Error(`Cannot read source ${name}.`);files[name]=await sha256(await response.arrayBuffer());}
  const response=await fetch('/bamboo-shampoo-demo/assets/assembly/original-engraving.svg',{cache:'no-store'});
  if(!response.ok)throw new Error('Cannot verify the original engraving.');
  const engravingSha256=await sha256(await response.arrayBuffer());
  if(engravingSha256!==ENGRAVING_SHA)throw new Error('Original engraving differs from the accepted source.');
  return {engravingSha256,capReferenceSha256:CAP_SOURCE.source.sha256,factorySha256:files,
    method:'Source-derived WebGL factory capture; native browser alpha conversion; no retouching or baked background',themes:PRODUCT_THEMES};
}
function verifyMetrics(metrics){
  const body=metrics.body||metrics;
  if(body.surfaceMap?.originalAssetSha256!==ENGRAVING_SHA||body.surfaceMap?.originalSourceUnchanged!==true)throw new Error('The renderer did not use the unchanged original engraving.');
  const cap=metrics.cap;
  if(cap&&cap.source?.sha256!==CAP_SOURCE.source.sha256)throw new Error('The renderer did not use the accepted cap reference.');
}
function encodeCanvas(canvas){
  // drawImage obeys the WebGL context alpha contract and exports conventional
  // unassociated PNG colour, including translucent contact shadows.
  const output=document.createElement('canvas');output.width=WIDTH;output.height=HEIGHT;
  const context=output.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('2D export canvas unavailable.');
  context.clearRect(0,0,WIDTH,HEIGHT);context.drawImage(canvas,0,0,WIDTH,HEIGHT);
  const corners=[[0,0],[WIDTH-1,0],[0,HEIGHT-1],[WIDTH-1,HEIGHT-1]];
  if(corners.some(([x,y])=>context.getImageData(x,y,1,1).data[3]!==0))throw new Error('Capture has an opaque background; the live capture adapter must allow alpha.');
  const url=output.toDataURL('image/png');output.width=output.height=1;return url;
}
function store(name,canvas,frame){
  bundle.images[name]=encodeCanvas(canvas);
  bundle.frames[name]={...frame,capture:{width:WIDTH,height:HEIGHT,sourceWidth:canvas.width,sourceHeight:canvas.height,normalisedInBrowser:true}};
  let figure=proofs.querySelector(`[data-name="${name}"]`);
  if(!figure){figure=document.createElement('figure');figure.dataset.name=name;figure.append(new Image(),document.createElement('figcaption'));proofs.append(figure);}
  figure.querySelector('img').src=bundle.images[name];figure.querySelector('img').alt=name;figure.querySelector('figcaption').textContent=name;
}
async function completedFrame(view,mode,progress){
  const deadline=performance.now()+45000;
  while(performance.now()<deadline){
    await nextPaint();const state=view.getState();
    if(state.error)throw new Error(state.error);
    if(state.ready&&state.rendered&&state.renderedMode===mode&&(progress===undefined||Math.abs(state.cyclePosition-progress)<.00001))return state;
  }
  throw new Error(`The ${mode} frame did not finish.`);
}
async function captureScene({name,mode,scent,artDirection,progress=0,cameraRegion,playbackProfile}){
  report(`Rendering ${name}. ${Object.keys(bundle.images).length}/${TOTAL} verified frames captured.`);
  stage.replaceChildren();
  const premultiplied=mode!=='refill';
  activeView=mountShopScene(stage,{mode,scent,artDirection,progress,cameraRegion,playbackProfile,
    capture:true,capturePremultiplied:premultiplied,opaque:false,interactive:false,reveal:1,
    automaticYaw:mode==='ritual'?0:undefined,background:PRODUCT_THEMES[scent].world.base});
  try{
    await activeView.ready;
    if(mode==='ritual'&&activeView.setAutomaticYaw)activeView.setAutomaticYaw(0);
    if(progress)activeView.setProgress(progress,{immediate:true,automaticYaw:mode==='ritual'?0:undefined});
    const state=await completedFrame(activeView,mode,progress),metrics=activeView.getMetrics();verifyMetrics(metrics);
    if(state.background.opaque)throw new Error(`The ${mode} capture is opaque. Enable transparent source capture first.`);
    if(state.world!==scent)throw new Error('Renderer world differs from the requested scent.');
    store(name,stage.querySelector('canvas'),{kind:mode==='journey'?'guide':mode==='ritual'?'teaser':'matched',
      mode,scent,artDirection,progress,automaticYaw:mode==='ritual'?0:null,
      premultipliedAlpha:premultiplied,cameraRegion:cameraRegion||null,
      framing:state.framing,spatial:state.spatial,size:state.size,visibility:state.visibility,
      fillAppearance:state.fillAppearance,theme:PRODUCT_THEMES[scent],body:metrics.body.confirmed,
      engravingSha256:metrics.body.surfaceMap.originalAssetSha256,capReferenceSha256:metrics.cap?.source?.sha256});
  }finally{activeView?.destroy();activeView=null;}
}

async function captureFronts(){
  stage.replaceChildren();
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  renderer.setPixelRatio(1);renderer.setSize(WIDTH,HEIGHT,false);renderer.setClearColor('#000000',0);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-100,100,100,-100,.5,2400);
  const environment=createStudioEnvironment({THREE,renderer});scene.environment=environment.texture;scene.environmentIntensity=.62;
  scene.add(new THREE.HemisphereLight('#fff9ef','#687567',.38));
  const key=new THREE.DirectionalLight('#fff6ea',1.8);key.position.set(-160,310,420);key.castShadow=true;
  key.shadow.mapSize.set(4096,4096);Object.assign(key.shadow.camera,{left:-160,right:160,top:250,bottom:-100,near:1,far:1200});key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias=-.00012;key.shadow.normalBias=.15;key.shadow.radius=5;scene.add(key);
  const fill=new THREE.DirectionalLight('#f2f8ff',.60);fill.position.set(260,110,310);scene.add(fill);
  const rim=new THREE.DirectionalLight('#ffffff',1);rim.position.set(180,240,-240);scene.add(rim);
  let body,cap,seal,floor;
  try{
    [body,cap]=await Promise.all([createBody({THREE,engravingUrl:'/bamboo-shampoo-demo/assets/assembly/original-engraving.svg'}),createRitualCap({THREE,colors:PRODUCT_THEMES.aloe.capColors})]);
    await finishBamboo({THREE,body});finishCap(cap);verifyMetrics({body:body.metrics,cap:cap.metrics});configurePetReflectionSkin({THREE,material:body.materials.clearPET});
    const anisotropy=renderer.capabilities.getMaxAnisotropy();for(const material of Object.values(body.materials))for(const value of Object.values(material))if(value?.isTexture)value.anisotropy=anisotropy;
    const product=new THREE.Group();product.name='sage-approved-front-card-capture';seal=createPeelSeal({THREE});
    product.add(body.components.shell,body.components.inlay,seal.group,cap.group);scene.add(product);
    seal.update({unfold:0,peel:0,exit:0});cap.update({lift:0,swivel:0,press:0});
    floor=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),new THREE.ShadowMaterial({color:'#4a5145',opacity:.075}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.15;floor.receiveShadow=true;scene.add(floor);
    // Exact private card-studio orthographic framing: 6° elevation, 88% fill.
    const elevation=THREE.MathUtils.degToRad(6),direction=new THREE.Vector3(0,Math.sin(elevation),Math.cos(elevation));
    const top=173.34,radius=37,projectedHeight=top*Math.cos(elevation)+2*radius*Math.sin(elevation),worldHeight=projectedHeight/.88;
    camera.left=-worldHeight*(WIDTH/HEIGHT)/2;camera.right=-camera.left;camera.top=worldHeight/2;camera.bottom=-camera.top;
    const center=new THREE.Vector3(0,top/2,0);camera.position.copy(center).addScaledVector(direction,800);camera.up.set(0,1,0);camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    product.rotation.y=0;product.updateWorldMatrix(true,true);if(renderer.compileAsync)await renderer.compileAsync(scene,camera);
    for(const scent of SCENTS){
      const name=`shop-product-front-${scent}`;report(`Rendering ${name}. ${Object.keys(bundle.images).length}/${TOTAL} verified frames captured.`);
      cap.setColors(PRODUCT_THEMES[scent].capColors);renderer.render(scene,camera);await nextPaint();renderer.render(scene,camera);
      store(name,renderer.domElement,{kind:'front',mode:'product',scent,artDirection:'orthographic',progress:0,premultipliedAlpha:true,
        framing:{type:'orthographic',elevationDegrees:6,fill:.88,yawDegrees:0,worldHeight,projectedHeight,
          left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom,cameraPosition:camera.position.toArray(),center:center.toArray()},
        size:{width:WIDTH,height:HEIGHT},visibility:{shell:true,cap:true,oldRefill:true,oldSeal:true,oldFill:false},
        theme:PRODUCT_THEMES[scent],body:body.metrics.confirmed,engravingSha256:body.metrics.surfaceMap.originalAssetSha256,capReferenceSha256:cap.metrics.source.sha256});
    }
  }finally{body?.dispose();cap?.dispose();seal?.dispose();floor?.geometry.dispose();floor?.material.dispose();environment.dispose();renderer.dispose();}
}

const batches={
  async essential(){for(const scent of SCENTS)await captureScene({name:`shop-detail-product-${scent}`,mode:'product',scent,artDirection:'detail'});await batches.guide();await batches.teaser();await batches.ritual();},
  async matched(){for(const artDirection of ['detail','campaign'])for(const mode of ['product','refill'])for(const scent of SCENTS)await captureScene({name:`shop-${artDirection}-${mode}-${scent}`,mode,scent,artDirection});},
  front:captureFronts,
  async guide(){for(const scent of SCENTS)await captureScene({name:`shop-guide-product-${scent}`,mode:'journey',scent,artDirection:'studio',progress:0,cameraRegion:EXTERNAL_REGION});},
  async teaser(){for(const scent of SCENTS)await captureScene({name:`shop-teaser-product-${scent}`,mode:'ritual',scent,artDirection:'campaign',progress:.72,playbackProfile:'refill-teaser',cameraRegion:EXTERNAL_REGION});},
  async ritual(){for(const scent of SCENTS)await captureScene({name:`shop-ritual-product-${scent}`,mode:'ritual',scent,artDirection:'studio',progress:0});},
  async cap(){for(const scent of SCENTS)await captureScene({name:`shop-cap-${scent}`,mode:'cap',scent,artDirection:'studio'});},
};
async function runBatch(batch){
  if(busy)return;busy=true;document.querySelectorAll('[data-batch]').forEach(button=>button.disabled=true);
  try{
    const source=await sourceManifest();
    if(bundle.source&&JSON.stringify(bundle.source)!==JSON.stringify(source))throw new Error('Source changed between batches. Reload the studio before capturing a consistent bundle.');
    bundle.source=source;
    if(batch==='all')for(const name of ['matched','front','guide','teaser','ritual','cap'])await batches[name]();else await batches[batch]();
    const finalSource=await sourceManifest();if(JSON.stringify(source)!==JSON.stringify(finalSource))throw new Error('Source changed during the render. Reload and capture after implementation is stable.');
    if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'}));
    const download=document.querySelector('#download');download.href=downloadUrl;download.hidden=false;
    document.querySelector('#manifest').textContent=JSON.stringify({schema:bundle.schema,reference:bundle.reference,source:bundle.source,frames:bundle.frames},null,2);
    report(`${Object.keys(bundle.images).length}/${TOTAL} source frames ready. Download the JSON bundle, then run the private encoder.`);
  }catch(error){report(`Capture failed: ${error.message}`);console.error(error);}
  finally{activeView?.destroy();activeView=null;busy=false;document.querySelectorAll('[data-batch]').forEach(button=>button.disabled=false);stage.dataset.captureStatus='ready';}
}
for(const button of document.querySelectorAll('[data-batch]'))button.addEventListener('click',()=>runBatch(button.dataset.batch));
window.addEventListener('pagehide',()=>{activeView?.destroy();if(downloadUrl)URL.revokeObjectURL(downloadUrl);},{once:true});


