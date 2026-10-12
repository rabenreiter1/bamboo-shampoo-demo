import { TUBE_PROFILE, PROFILE_SOURCE } from './body-profile.js';

/**
 * Component geometry uses millimeters and assembled, Y-up coordinates.
 * The source artwork is never rewritten: its original paths, text and layout
 * are rendered as one full-wrap mask over the bamboo colour/bump texture.
 * Standard maps make the result portable to glTF/GLB, without custom shaders.
 */
const TAU = Math.PI * 2;
const ENGRAVING_FRONT_U = 221 / 516.5;
// The original wrap ratio matches a 150mm print height around a Ø58 tube.
// Keep its original aspect instead of stretching the art over the 20mm collar.
const ENGRAVING_HEIGHT = TAU * 29 * 425.2 / 516.5;
const SOURCE_HASH = '67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa';
const D = Object.freeze({
  shellHeight: 170, shellOuterDiameter: 58, shellInnerDiameter: 48,
  rimWall: 5, gripZoneHeight: 20, shellBottomPlaceholder: 5,
  inlayOuterDiameter: 47, inlayHeight: 165, inlayBottomY: 5,
  petWallPlaceholder: .3, flangeOuterDiameter: 58, flangeRadialWidth: 5.5,
  flangeThicknessPlaceholder: .3, sealThicknessPlaceholder: .08,
  sealBottomY: 170.38,
});

/** Linear interpolation of the measured silhouette, including its actual notch. */
export function shellRadiusAt(y) {
  y = Math.max(0, Math.min(D.shellHeight, y));
  let lo = 0, hi = TUBE_PROFILE.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (TUBE_PROFILE[mid][0] < y) lo = mid;
    else hi = mid;
  }
  const a = TUBE_PROFILE[lo], b = TUBE_PROFILE[hi];
  return a[1] + (b[1] - a[1]) * ((y - a[0]) / (b[0] - a[0]));
}

function seededRandom(seed = 758239) {
  return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
}

function makeCanvas(width, height = width) {
  const el = document.createElement('canvas');
  el.width = width; el.height = height;
  return el;
}

function fromCanvas(THREE, source, colour = false) {
  const t = new THREE.CanvasTexture(source);
  t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  return t;
}

async function decodeImage(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('The unchanged original engraving could not be loaded.'));
    if (image.complete && image.naturalWidth) resolve();
  });
  if (image.decode) await image.decode();
  return image;
}

async function makeWoodMaps(THREE, url) {
  const w = 2048, h = 2048;
  const source = await decodeImage(url);
  const art = makeCanvas(w, h);
  const artCtx = art.getContext('2d', { willReadFrequently: true });
  // Full original viewBox, with no clipping, replacements, additions or glyph edits.
  artCtx.clearRect(0, 0, w, h);
  const printHeight = h * ENGRAVING_HEIGHT / D.shellHeight;
  artCtx.drawImage(source, 0, h - printHeight, w, printHeight);
  const artwork = artCtx.getImageData(0, 0, w, h).data;
  const colourCanvas = makeCanvas(w, h);
  const reliefCanvas = makeCanvas(w, h);
  const roughCanvas = makeCanvas(w, h);
  const colourCtx = colourCanvas.getContext('2d');
  const reliefCtx = reliefCanvas.getContext('2d');
  const roughCtx = roughCanvas.getContext('2d');
  const colour = colourCtx.createImageData(w, h);
  const relief = reliefCtx.createImageData(w, h);
  const rough = roughCtx.createImageData(w, h);
  const rng = seededRandom();
  const columns = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    columns[x] = Math.sin(x * .021) * 5.2 + Math.sin(x * .083) * 3.8
      + Math.sin(x * .421) * 2.0 + (rng() - .5) * 2.4;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = 4 * (y * w + x);
      const noise = columns[x] + (rng() - .5) * 4.2
        + Math.sin(y * .006 + x * .08) * .6;
      // White native SVG paths are negative-space details, not white paint.
      const luminance = (artwork[i] * .2126 + artwork[i + 1] * .7152 + artwork[i + 2] * .0722) / 255;
      const engraving = (1 - luminance) * artwork[i + 3] / 255;
      const base = [206 + noise, 176 + noise * .91, 126 + noise * .81];
      const charred = [83 + noise * .35, 57 + noise * .32, 33 + noise * .23];
      for (let c = 0; c < 3; c++) {
        colour.data[i + c] = base[c] * (1 - engraving) + charred[c] * engraving;
        relief.data[i + c] = 135 + noise * 1.5 - engraving * 73;
        rough.data[i + c] = 176 + noise * .5 + engraving * 17;
      }
      colour.data[i + 3] = relief.data[i + 3] = rough.data[i + 3] = 255;
    }
  }
  colourCtx.putImageData(colour, 0, 0);
  reliefCtx.putImageData(relief, 0, 0);
  roughCtx.putImageData(rough, 0, 0);
  // glTF supports tangent normal maps rather than Three's bumpMap. Convert
  // physical-millimetre laser relief so both the browser and downloadable GLB
  // retain recessed marks and subtle fibre normals with the same source mask.
  const normalCanvas = makeCanvas(w, h);
  const normalCtx = normalCanvas.getContext('2d');
  const normal = normalCtx.createImageData(w, h);
  const dx = TAU * 29 / w, dy = D.shellHeight / h, reliefScale = .085 / 255;
  for (let y = 0; y < h; y++) {
    const above = Math.max(0, y - 1), below = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const left = (x + w - 1) % w, right = (x + 1) % w;
      const nx = (relief.data[4 * (y * w + left)] - relief.data[4 * (y * w + right)]) * reliefScale / (2 * dx);
      const ny = (relief.data[4 * (below * w + x)] - relief.data[4 * (above * w + x)]) * reliefScale / (2 * dy);
      const len = Math.sqrt(nx * nx + ny * ny + 1), i = 4 * (y * w + x);
      normal.data[i] = (nx / len * .5 + .5) * 255;
      normal.data[i + 1] = (ny / len * .5 + .5) * 255;
      normal.data[i + 2] = (.5 / len + .5) * 255;
      normal.data[i + 3] = 255;
    }
  }
  normalCtx.putImageData(normal, 0, 0);
  // Interrupted axial fibres complement the scanned body form. They are kept
  // low contrast so the source engraving remains clear under grazing light.
  for (let n = 0; n < 3600; n++) {
    const x = rng() * w, y = rng() * h;
    const length = 2 + Math.pow(rng(), 2) * 170;
    const a = .06 + rng() * .12;
    colourCtx.strokeStyle = `rgba(87,54,21,${a})`;
    colourCtx.lineWidth = .30 + rng() * .7;
    colourCtx.beginPath(); colourCtx.moveTo(x, y);
    colourCtx.quadraticCurveTo(x + .35, y + length / 2, x + (rng() - .5) * .8, y + length);
    colourCtx.stroke();
  }
  // Bamboo end grain has fibre pores rather than concentric timber growth rings.
  const end = makeCanvas(512);
  const endCtx = end.getContext('2d');
  endCtx.fillStyle = '#c3a573'; endCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const x = rng() * 512, y = rng() * 512;
    endCtx.fillStyle = `rgba(75,46,16,${.025 + rng() * .18})`;
    endCtx.beginPath(); endCtx.ellipse(x, y, .25 + rng() * .5, .35 + rng() * .85, 0, 0, TAU); endCtx.fill();
  }
  return {
    map: fromCanvas(THREE, colourCanvas, true),
    normalMap: fromCanvas(THREE, normalCanvas),
    roughnessMap: fromCanvas(THREE, roughCanvas),
    endMap: fromCanvas(THREE, end, true),
    loaded: true,
  };
}

function lathe(THREE, points, segments = 160, start = 0) {
  return new THREE.LatheGeometry(points.map(([radius, y]) => new THREE.Vector2(radius, y)), segments, start, TAU);
}

function horizontalCircle(THREE, radius, y, up = true) {
  const g = new THREE.CircleGeometry(radius, 160);
  g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function horizontalRing(THREE, inner, outer, y) {
  const g = new THREE.RingGeometry(inner, outer, 160, 1);
  g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  return g;
}

function addMesh(THREE, group, name, geometry, material, { shadow = true } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name; mesh.castShadow = shadow; mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/**
 * Awaiting the factory means artwork and all textures are ready, not just meshes.
 * Importing this module in Node creates no DOM objects; geometry audits work there.
 */
export async function createBody({ THREE, engravingUrl = new URL('./original-engraving.svg', import.meta.url).href } = {}) {
  if (!THREE?.Group || !THREE?.LatheGeometry) throw new Error('createBody requires the shared THREE namespace.');
  const browserTextures = typeof document !== 'undefined' && typeof Image !== 'undefined';
  const maps = browserTextures ? await makeWoodMaps(THREE, engravingUrl) : { loaded: false };
  const shell = new THREE.Group(); shell.name = 'Bamboo_shell';
  const inlay = new THREE.Group(); inlay.name = 'Clear_PET_refill_inlay';
  const seal = new THREE.Group(); seal.name = 'Peel_off_sealing_film';
  const wood = new THREE.MeshStandardMaterial({
    color: maps.loaded ? '#ffffff' : '#ceb07e',
    map: maps.map || null, normalMap: maps.normalMap || null,
    normalScale: new THREE.Vector2(1, 1), roughnessMap: maps.roughnessMap || null,
    roughness: .82, metalness: 0,
  });
  wood.name = 'Natural_bamboo_with_exact_original_laser_engraving';
  const endGrain = new THREE.MeshStandardMaterial({
    color: maps.loaded ? '#ffffff' : '#c3a573', map: maps.endMap || null,
    roughness: .88, metalness: 0,
  });
  endGrain.name = 'Cut_bamboo_end_grain';
  const innerWood = new THREE.MeshStandardMaterial({ color: '#c6aa79', roughness: .87 });
  innerWood.name = 'Unengraved_bamboo_inner_bore';
  const clearPET = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: .085, metalness: 0,
    transmission: .985, thickness: D.petWallPlaceholder,
    ior: 1.57, clearcoat: .85, clearcoatRoughness: .045,
    attenuationColor: '#f7fff9', attenuationDistance: 300,
    side: THREE.FrontSide,
  });
  clearPET.name = 'Thin_clear_PET_visual_wall_0_3mm';
  clearPET.userData = { confirmedThickness: false, visualThicknessMillimeters: .3 };
  const foil = new THREE.MeshStandardMaterial({ color: '#dce2df', metalness: .68, roughness: .33, side: THREE.DoubleSide });
  foil.name = 'Peelable_seal_film';

  const outer = lathe(THREE, TUBE_PROFILE.map(([y, radius]) => [radius, y]), 192, -TAU * ENGRAVING_FRONT_U);
  // Lathe defaults V to profile-point index. Physical-height V preserves source
  // layout even where contour sampling is denser around the small seating notch.
  const uv = outer.getAttribute('uv'), position = outer.getAttribute('position');
  for (let i = 0; i < uv.count; i++) uv.setY(i, position.getY(i) / D.shellHeight);
  uv.needsUpdate = true;
  outer.computeTangents();
  addMesh(THREE, shell, 'Bamboo_outer_sourced_contour_and_original_engraving', outer, wood);
  addMesh(THREE, shell, 'Bamboo_inner_bore_D48', lathe(THREE, [[24, 170], [24, 5]]), innerWood);
  addMesh(THREE, shell, 'Bamboo_top_rim_D58_D48', horizontalRing(THREE, 24, 29, 170), endGrain);
  addMesh(THREE, shell, 'Bamboo_external_bottom', horizontalCircle(THREE, 29, 0, false), endGrain);
  addMesh(THREE, shell, 'Bamboo_internal_floor_visual_Y5', horizontalCircle(THREE, 24, 5), endGrain);

  // The open-mouth inner and outer skins and bottom constitute one real hollow
  // inlay. Its body diameter and axial envelope are exact user dimensions.
  const petBody = lathe(THREE, [
    [0, 5], [23.5, 5], [23.5, 170], [23.2, 170], [23.2, 5.3], [0, 5.3],
  ], 192);
  addMesh(THREE, inlay, 'PET_hollow_body_D47_H165', petBody, clearPET, { shadow: false });
  const flange = lathe(THREE, [
    [23.2, 170], [29, 170], [29, 170.3], [23.2, 170.3], [23.2, 170],
  ], 192);
  addMesh(THREE, inlay, 'PET_sealing_flange_D58_radial5_5', flange, clearPET, { shadow: false });

  // Generic pull-tab profile is deliberately separate from the CAD-derived cap.
  // The exact seal outline/thickness was not supplied; the film demonstrates its
  // actual function and flange contact in the assembly sequence.
  const film = new THREE.Shape();
  const a = .18, r = 29, joinX = r * Math.cos(a), joinZ = r * Math.sin(a);
  film.moveTo(joinX, joinZ); film.lineTo(33, joinZ);
  film.quadraticCurveTo(37, joinZ, 37, 1.6);
  film.lineTo(37, -1.6); film.quadraticCurveTo(37, -joinZ, 33, -joinZ);
  film.lineTo(joinX, -joinZ); film.absarc(0, 0, r, -a, a, true); film.closePath();
  const filmGeometry = new THREE.ExtrudeGeometry(film, {
    depth: D.sealThicknessPlaceholder, bevelEnabled: false, steps: 1, curveSegments: 128,
  });
  filmGeometry.rotateX(-Math.PI / 2); filmGeometry.translate(0, D.sealBottomY, 0);
  addMesh(THREE, seal, 'Peel_off_foil_and_pull_tab', filmGeometry, foil, { shadow: false });

  shell.userData = { component: 'shell', confirmedDimensions: { height: 170, outerDiameter: 58, boreDiameter: 48 }, source: PROFILE_SOURCE };
  inlay.userData = { component: 'inlay', confirmedDimensions: { bodyDiameter: 47, bodyHeight: 165, flangeDiameter: 58, flangeRadialWidth: 5.5 } };
  seal.userData = { component: 'seal', sourceProfileConfirmed: false, function: 'Remove before fitting reusable cap.' };
  const cavityVolume = Math.PI * Math.pow(23.5 - .3, 2) * (165 - .3) / 1000;
  const metrics = {
    unit: 'mm', coordinateSystem: 'Y up; Y=0 bamboo bottom; Y=170 bamboo rim; component group transforms identity.',
    dimensions: D,
    confirmed: {
      shellHeight: 170, shellOuterDiameter: 58, shellInnerDiameter: 48, shellRimWall: 5, gripZoneHeight: 20,
      inlayBodyOuterDiameter: 47, inlayBodyHeight: 165, flangeOuterDiameter: 58, flangeRadialWidth: 5.5,
      nominalFillMilliliters: 250,
    },
    derived: {
      radialInlayToBoreClearance: .5,
      modeledInlayCavityVolumeMilliliters: cavityVolume,
      flangeSupport: 'Y170 over the full Ø48–Ø58 bamboo rim; body OD47 leaves 0.5mm radial bore clearance.',
      minTubeOuterRadius: Math.min(...TUBE_PROFILE.map(p => p[1])),
      minTubeWallAtContour: Math.min(...TUBE_PROFILE.map(p => p[1])) - 24,
    },
    assumptions: [
      'PET body and flange thickness 0.3mm are visual placeholders; only thin PET was specified.',
      'Bamboo inner floor at Y5 is a fit visualization; source does not dimension the bottom thickness.',
      'Seal thickness0.08mm, tab shape and0.08mm peel gap are functional visual placeholders.',
      'Outer contour is sampled from the actual dimensioned drawing raster, tolerance about0.21mm; no manufacturing curve radii are inferred.',
      'Engraving is registered above Y0; its source aspect gives150.003mm wrap height at nominal Ø58. Production registration offset is not dimensioned.',
    ],
    profileSource: PROFILE_SOURCE,
    surfaceMap: {
      originalAssetSha256: SOURCE_HASH, originalAssetBytes: 242374,
      fullOriginalViewBox: [0, 0, 516.5, 425.2],
      originalSourceUnchanged: true, clippingOrGlyphReplacement: false,
      mapping: 'Source x0..516.5 maps once around360degrees; source y0..425.2 maps Y150.003..0. Original aspect preserved at nominal Ø58.',
      printHeightMillimeters: ENGRAVING_HEIGHT,
      nominalAspectRatioPreserved: true,
      frontSourceX: 221, frontAzimuthRadians: 0, frontDirection: '+Z',
      shader: 'Standard MeshStandardMaterial maps; baked colour plus roughness and physical laser-relief tangent normals.',
      portableGLTFMaps: true, textureReady: maps.loaded,
    },
  };
  function dispose() {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    for (const group of [shell, inlay, seal]) group.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) if (material) materials.add(material);
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
  }
  return { components: { shell, inlay, seal }, materials: { wood, innerWood, endGrain, clearPET, foil }, metrics, dispose };
}
