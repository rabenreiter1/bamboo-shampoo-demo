/** Browser-only source bridge for the private Cycles studio.
 * Build from current operative factories, never from the historical GLB.
 * The caller owns the page/import map, download UI and private server.
 */
import * as THREE from '/bamboo-shampoo-demo/assets/assembly/vendor/three.module.js';
import { GLTFExporter } from '/bamboo-shampoo-demo/assets/assembly/vendor/GLTFExporter.js';
import { createBody } from '/bamboo-shampoo-demo/assets/assembly/body.js';
import { createRitualCap } from '/bamboo-shampoo-demo/assets/assembly/ritual-cap.js';
import { createGel, createPeelSeal, getGelAppearance, configurePetReflectionSkin } from '/bamboo-shampoo-demo/assets/assembly/ritual-effects.js';
import { finishBamboo, finishCap, finishMicroSurface, SURFACE_FINISH } from '/bamboo-shampoo-demo/assets/assembly/surface-finish.js';
import { PRODUCT_THEMES } from '/bamboo-shampoo-demo/assets/product-theme.js';

const BASE = '/bamboo-shampoo-demo/assets/';
const ENGRAVING_SHA = '67a2b2534da5cbeaf044e115d4db34ff7c604d190435ba393ea85ea2485f47aa';
const CAP_REFERENCE_SHA = 'dbd0fd9d44a9bc04225e9430fe4d2cd9accadf9a59b2912d20fd49e05a495a41';
const SOURCE_FILES = [
 'assembly/vendor/three.module.js', 'assembly/vendor/GLTFExporter.js',
 'assembly/body.js', 'assembly/body-profile.js', 'assembly/ritual-cap.js',
 'assembly/cap-data.js', 'assembly/ritual-effects.js', 'assembly/surface-finish.js',
 'assembly/original-engraving.svg', 'assembly/cap-reference.jpg',
 'assembly/bamboo-culm-albedo.webp', 'product-theme.js',
];
const bytes = value => value instanceof ArrayBuffer ? new Uint8Array(value)
 : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
const sha256 = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
function base64(value) {
 const input = bytes(value), chunks = [];
 for (let i = 0; i < input.length; i += 32768) chunks.push(String.fromCharCode(...input.subarray(i, i + 32768)));
 return btoa(chunks.join(''));
}
async function sourceHashes() {
 const result = {};
 for (const file of SOURCE_FILES) {
  const response = await fetch(BASE + file, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Cycles export source unavailable: ${file} (${response.status})`);
  result[file] = await sha256(await response.arrayBuffer());
 }
 if (result['assembly/original-engraving.svg'] !== ENGRAVING_SHA) throw new Error('The original engraving is not byte-identical.');
 if (result['assembly/cap-reference.jpg'] !== CAP_REFERENCE_SHA) throw new Error('The original cap reference changed.');
 return result;
}
async function meshManifest(root) {
 const meshes = [];
 root.traverse(object => { if (object.isMesh) meshes.push(object); });
 const result = [];
 for (const object of meshes) {
  const geometry = object.geometry, attributes = {};
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
   if (attribute.isInterleavedBufferAttribute) throw new Error(`Unexpected interleaved geometry: ${object.name}/${name}`);
   attributes[name] = { sha256: await sha256(attribute.array), count: attribute.count, itemSize: attribute.itemSize, type: attribute.array.constructor.name };
  }
  const index = geometry.index ? { sha256: await sha256(geometry.index.array), count: geometry.index.count, type: geometry.index.array.constructor.name } : null;
  result.push({ name: object.name, attributes, index,
   groups: geometry.groups.map(group => ({ ...group })),
   matrix: object.matrix.toArray(), matrixWorld: object.matrixWorld.toArray(),
   materials: (Array.isArray(object.material) ? object.material : [object.material]).map(material => material.name || material.uuid),
  });
 }
 return result;
}
function positionSignature(manifest) {
 return JSON.stringify(manifest.map(mesh => ({ name: mesh.name, position: mesh.attributes.position, uv: mesh.attributes.uv, index: mesh.index, groups: mesh.groups, matrix: mesh.matrix, matrixWorld: mesh.matrixWorld })));
}
async function textureManifest(root) {
 const unique = new Map();
 root.traverse(object => {
  if (!object.isMesh) return;
  for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
   for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap']) {
    const texture = material[slot];
    if (!texture?.image) continue;
    if (!unique.has(texture.uuid)) unique.set(texture.uuid, { texture, uses: [] });
    unique.get(texture.uuid).uses.push({ mesh: object.name, material: material.name, slot });
   }
  }
 });
 const output = [];
 for (const { texture, uses } of unique.values()) {
  const image = texture.image, canvas = document.createElement('canvas');
  canvas.width = image.width || image.naturalWidth; canvas.height = image.height || image.naturalHeight;
  canvas.getContext('2d').drawImage(image, 0, 0);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Unable to encode source texture.')), 'image/png'));
  const data = await blob.arrayBuffer();
  output.push({ id: texture.uuid, uses, width: canvas.width, height: canvas.height,
   mimeType: 'image/png', base64: base64(data), sha256: await sha256(data),
   colorSpace: texture.colorSpace, flipY: texture.flipY, wrapS: texture.wrapS, wrapT: texture.wrapT,
   repeat: texture.repeat.toArray(), offset: texture.offset.toArray(), rotation: texture.rotation,
  });
  canvas.width = canvas.height = 1;
 }
 return output;
}

/** Returns a JSON-serializable fresh GLB, portable textures and verification.
 * Geometry coordinates remain source millimetres; the single export root
 * scales .001 to glTF metres. Blender's glTF importer performs Y-up conversion.
 */
export async function createCyclesBundle({ status = () => {} } = {}) {
 let body, cap, seal, gel;
 try {
  status('Hashing current operative source files…');
  const source = await sourceHashes();
  status('Constructing the current engraved bamboo, PET and corrected cap…');
  [body, cap] = await Promise.all([createBody({ THREE }), createRitualCap({ THREE, colors: PRODUCT_THEMES.aloe.capColors })]);
  await finishBamboo({ THREE, body }); finishCap(cap);
  configurePetReflectionSkin({ THREE, material: body.materials.clearPET });
  finishMicroSurface(body.materials.clearPET, { kind: 'PET' });
  seal = createPeelSeal({ THREE }); gel = createGel({ THREE, scent: 'aloe' });
  cap.update({ lift: 0, swivel: 0, press: 0 });
  seal.update({ unfold: 0, peel: 0, exit: 0 });
  gel.update({ progress: 0, flow: 0, fillOld: 1, fillNew: 0, visible: true });
  const root = new THREE.Group(); root.name = 'Current_operative_product_mm_to_metres'; root.scale.setScalar(.001);
  root.userData = { units: 'source millimetres; root converts to metres', geometryPolicy: 'No remesh, bevel modifier, subdivision or replacement contours', sourceEngravingSha256: ENGRAVING_SHA };
  const components = { shell: body.components.shell, inlay: body.components.inlay, cap: cap.group, seal: seal.group, liquid: gel.oldFillGroup };
  for (const [component, group] of Object.entries(components)) {
   group.visible = true; group.userData.component = component; root.add(group);
  }
  root.updateMatrixWorld(true);
  const beforeExport = await meshManifest(root), textures = await textureManifest(root);
  status('Serializing source geometry and textures to a fresh GLB…');
  const glb = await new GLTFExporter().parseAsync(root, {
   binary: true, trs: true, onlyVisible: false, maxTextureSize: 4096,
   includeCustomExtensions: false, animations: [],
  });
  const afterExport = await meshManifest(root);
  if (positionSignature(beforeExport) !== positionSignature(afterExport)) throw new Error('GLTF export changed operative positions, UVs, indices or transforms.');
  const sourceAfter = await sourceHashes();
  if (JSON.stringify(source) !== JSON.stringify(sourceAfter)) throw new Error('The operative sources changed during export; discard this bundle and capture again.');
  const result = {
   schema: 'bamboo-cycles-source-bundle-v1', source, sourceAfter,
   createdAt: new Date().toISOString(), threeRevision: THREE.REVISION,
   units: { source: 'mm', gltf: 'm', rootScale: .001, sourceUp: 'Y', blenderImportUp: 'Z' },
   glb: { mimeType: 'model/gltf-binary', byteLength: glb.byteLength, sha256: await sha256(glb), base64: base64(glb) },
   geometry: { beforeExport, afterExport, positionIndexUvTransformsUnchanged: true }, textures,
   components: Object.fromEntries(Object.entries(components).map(([name, group]) => [name, { name: group.name, position: group.position.toArray(), rotation: group.rotation.toArray(), scale: group.scale.toArray() }])),
   metrics: { body: body.metrics, cap: cap.metrics, seal: seal.metrics, gel: gel.metrics, surfaceFinish: SURFACE_FINISH },
   palette: PRODUCT_THEMES,
   liquidAppearances: Object.fromEntries(['aloe', 'argan', 'bamboo'].map(scent => [scent, getGelAppearance(scent)])),
   importerNotes: [
    'Rebuild named silicone materials with raytraced dielectric/SSS nodes; onBeforeCompile microtexture is not serialized in GLB.',
    'Rebuild Thin_clear_PET_visual_wall_0_3mm as a true transmitting dielectric: IOR1.57, roughness0.045; existing wall geometry0.3mm stays unchanged. GLB material transmission0 is a WebGL-only reflection-skin approximation.',
    'Rebuild liquid as a real refracting/absorbing volume with IOR1.42 and scent absorption distances converted from mm to m. WebGL analytic chord shader is not serialized.',
    'Use exported original-artwork colour/normal/roughness textures and inward-only engraved shell geometry. Never remesh or add geometry bevels.',
    'Degenerate trace triangles and source normal lengths are preserved; no visible contours or indexed vertex positions were simplified.',
   ],
  };
  status(`Source-verified Cycles bundle ready: ${beforeExport.length} meshes, ${textures.length} textures.`);
  return result;
 } finally {
  body?.dispose(); cap?.dispose(); seal?.dispose(); gel?.dispose();
 }
}
