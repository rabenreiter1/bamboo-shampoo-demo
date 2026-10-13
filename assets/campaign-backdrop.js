// The hero's typography, coloured world and product share one opaque canvas.
// Semantic HTML remains available while this source-derived stage is loading.
export const CAMPAIGN_WORLDS = Object.freeze({
  aloe: { base: '#c4e4ec', light: '#e9f8f8', accent: '#83c8d1', ink: '#24515b' },
  argan: { base: '#ecd0d0', light: '#f9e7e5', accent: '#eea69c', ink: '#6b3e48' },
  bamboo: { base: '#cdc0e8', light: '#f0e8ff', accent: '#b5d8e9', ink: '#413356' },
});

export function campaignLayout(width, height) {
  const landscape = width > height && height <= 560;
  const compact = width <= 760 && !landscape;
  const top = landscape ? 69 : compact ? 102 : 84;
  const bottom = landscape ? 82 : compact ? 180 : 146;
  return { minX: landscape ? .15 : .025, maxX: landscape ? .85 : .975,
    minY: Math.min(.4, top / height), maxY: Math.max(.55, 1 - bottom / height),
    wordY: compact ? .39 : .43, fontSize: width * (compact ? .32 : landscape ? .29 : .34) };
}

export function paintCampaignWorld(context,{width,height,world='bamboo',word='BAMBOO',layout='campaign',scale=1}){
  const palette=CAMPAIGN_WORLDS[world]||CAMPAIGN_WORLDS.bamboo;
  context.setTransform(scale,0,0,scale,0,0);
  context.fillStyle=palette.base; context.fillRect(0,0,width,height);
  const glow=context.createRadialGradient(width*.72,height*.35,0,width*.72,height*.35,width*.68);
  glow.addColorStop(0,palette.light); glow.addColorStop(1,palette.base);
  context.globalAlpha=.75; context.fillStyle=glow; context.fillRect(0,0,width,height);
  const wash=context.createLinearGradient(0,0,width,height);
  wash.addColorStop(0,'#ffffff00'); wash.addColorStop(1,palette.accent);
  context.globalAlpha=.20; context.fillStyle=wash; context.fillRect(0,0,width,height);
  context.globalAlpha=1;
  const type=layout === 'detail'
    ? { fontSize: width * .32 * 6 / Math.max(4, word.length), wordY: .46 }
    : campaignLayout(width,height);
  context.font=`700 ${type.fontSize}px Campaign, Impact, sans-serif`;
  context.textAlign='center'; context.textBaseline='middle'; context.fillStyle=palette.ink;
  context.globalAlpha=layout === 'detail' ? .23 : 1;
  context.fillText(word.toUpperCase(),width/2,height*type.wordY,width*.975);
  context.globalAlpha=1;
}

export function createCampaignBackdrop({ THREE, world = 'bamboo', word = 'BAMBOO', layout = 'campaign' }) {
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  if (!context) throw new Error('The campaign backdrop needs a 2D canvas.');
  const makeTexture = () => {
    const value=new THREE.CanvasTexture(canvas);
    value.colorSpace=THREE.SRGBColorSpace; value.generateMipmaps=false;
    value.minFilter=THREE.LinearFilter; return value;
  };
  let texture=makeTexture();
  const material = new THREE.ShaderMaterial({
    uniforms: { backdropMap: { value: texture } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,1.0,1.0); }',
    fragmentShader: `uniform sampler2D backdropMap;
      varying vec2 vUv;
      void main(){
        gl_FragColor=texture2D(backdropMap,vUv);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.name = 'campaign-type-and-colour-backdrop'; mesh.frustumCulled = false;
  mesh.renderOrder = -10000;
  let width=1, height=1;
  function paint() {
    const palette=CAMPAIGN_WORLDS[world] || CAMPAIGN_WORLDS.bamboo;
    const scale=Math.min(1.5, 2048 / Math.max(width,height));
    const nextWidth=Math.max(1,Math.round(width*scale)),nextHeight=Math.max(1,Math.round(height*scale));
    if(canvas.width!==nextWidth||canvas.height!==nextHeight){
      // GPU texture storage is immutable once uploaded. Reallocate on phone
      // rotation/resize rather than stretching the preceding viewport bitmap.
      texture.dispose(); canvas.width=nextWidth; canvas.height=nextHeight;
      texture=makeTexture(); material.uniforms.backdropMap.value=texture;
    }
    paintCampaignWorld(context,{width,height,world,word,layout,scale});
    texture.needsUpdate=true;
  }
  return { mesh, resize(w,h){width=w;height=h;paint();}, setWorld(value){world=value;paint();},
    dispose(){mesh.geometry.dispose();material.dispose();texture.dispose();canvas.width=canvas.height=1;} };
}
