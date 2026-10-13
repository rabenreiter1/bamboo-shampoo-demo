/**
 * Reversible material effects for the refill ritual.
 *
 * All geometry is in millimetres, Y up, and is authored in the assembled tube
 * frame. The stream alone lives in world coordinates. Nothing reads a clock,
 * accumulates simulation state, or emits particles between updates.
 */
const PI = Math.PI;
const TAU = PI * 2;
const clamp = (value, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Number.isFinite(value) ? value : lo));
const smooth = value => { const t = clamp(value); return t * t * t * (t * (t * 6 - 15) + 10); };
const FOIL_RADIUS = 29;
const FOIL_THICKNESS = .08;
const FOIL_Y = 170.34; // Bottom surface contacts the top of the PET flange.
const TAB_HINGE_X = 28.35;
const TAB_LENGTH = 8.8;
const TAB_BEND_RADIUS = .05;
const PEEL_BEND_RADIUS = 3;
const PEEL_ANGLE = PI * 2 / 3;
const PEEL_START_X = TAB_HINGE_X + TAB_LENGTH + .05;
const PEEL_END_X = -FOIL_RADIUS - .3;
const GEL_RADIUS = 23.2;
const GEL_FLOOR_Y = 5.3;
const GEL_VOLUME_MM3 = 250000;
const GEL_HEIGHT = GEL_VOLUME_MM3 / (PI * GEL_RADIUS * GEL_RADIUS);
// The refill remains clear PET. Colour and absorption belong to the liquid,
// with a coherent tint across its measured bulk, free surface, strand and drops.
// Preserve the approved grapefruit appearance for the standalone inspection.
export const GEL_APPEARANCE = Object.freeze({
  color: '#ffd8ca', attenuationColor: '#f36962', attenuationDistance: 40,
  transmission: .94, roughness: .065, ior: 1.42, thickness: 28,
  streamColor: '#ffd8ca', streamAttenuationDistance: 40, streamThickness: 3.4,
});

/** Authored scent colours; optical absorption, rather than PET paint, adds depth. */
export const GEL_SCENT_APPEARANCES = Object.freeze({
  grapefruit: Object.freeze({ scent: 'grapefruit', ...GEL_APPEARANCE }),
  aloe: Object.freeze({ scent: 'aloe', ...GEL_APPEARANCE,
    color: '#dcf7f0', streamColor: '#dcf7f0', attenuationColor: '#62c6b2',
    attenuationDistance: 60, streamAttenuationDistance: 60 }),
  argan: Object.freeze({ scent: 'argan', ...GEL_APPEARANCE,
    color: '#fff0d6', streamColor: '#fff0d6', attenuationColor: '#e6a244',
    attenuationDistance: 60, streamAttenuationDistance: 60 }),
  bamboo: Object.freeze({ scent: 'bamboo', ...GEL_APPEARANCE,
    color: '#e1f0e3', streamColor: '#e1f0e3', attenuationColor: '#9bc9a4',
    attenuationDistance: 80, streamAttenuationDistance: 80 }),
});

/** Safe, immutable palette lookup. Unknown or absent scents retain grapefruit. */
export function getGelAppearance(scent) {
  const key = typeof scent === 'string' ? scent.trim().toLowerCase() : '';
  return Object.hasOwn(GEL_SCENT_APPEARANCES, key)
    ? GEL_SCENT_APPEARANCES[key] : GEL_SCENT_APPEARANCES.grapefruit;
}

/** Schlick reflectance for a clear dielectric/air interface. */
export function samplePetFresnel(cosine, ior = 1.57) {
  const eta = Number.isFinite(ior) ? clamp(ior, 1, 2.333) : 1.57;
  const f0 = ((eta - 1) / (eta + 1)) ** 2;
  return f0 + (1 - f0) * (1 - clamp(cosine)) ** 5;
}

/**
 * Thin PET has no white diffuse wash. The renderers use this reflection skin
 * over the separately refracting shampoo because overlapping transmission
 * prepasses do not capture one another. RGB contains only reflected PBR light;
 * Schlick alpha controls the portion of the contents seen through the skin.
 * It is a thin-interface approximation, not a second refraction simulation.
 * Manufactured geometry, source IOR and source wall thickness are untouched.
 */
export function configurePetReflectionSkin({ THREE, material } = {}) {
  if (!THREE?.MeshPhysicalMaterial || !material?.isMeshPhysicalMaterial) {
    throw new Error('configurePetReflectionSkin requires THREE and the shared physical PET material.');
  }
  Object.assign(material, { transmission: 0, transparent: true, opacity: 1, depthWrite: false,
    roughness: .045, metalness: 0, clearcoat: 0, premultipliedAlpha: false });
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
        'vec3 outgoingLight = totalSpecular;')
      .replace('#include <opaque_fragment>', /* glsl */`
        float petCosine = clamp( abs( dot( normal, geometryViewDir ) ), 0.0, 1.0 );
        float petRatio = ( ior - 1.0 ) / ( ior + 1.0 );
        float petF0 = petRatio * petRatio;
        float petReflectance = max( 0.0001, petF0 + ( 1.0 - petF0 ) * pow( 1.0 - petCosine, 5.0 ) );
        // PBR specular already includes its interface Fresnel factor. Divide
        // once to obtain straight-alpha reflection colour, rather than apply
        // Fresnel twice when this skin blends over the coloured liquid.
        gl_FragColor = vec4( outgoingLight / petReflectance, petReflectance );
      `);
  };
  material.customProgramCacheKey = () => 'clear-pet-specular-fresnel-skin-v1';
  material.userData.reflectionSkin = { specularOnly: true, schlickAlpha: true,
    ior: material.ior, normalReflectance: samplePetFresnel(1, material.ior),
    sourceThicknessUnchanged: material.thickness, overlappingTransmissionAvoided: true,
    approximation: 'Thin reflection interface with separately resolved liquid refraction; no white diffuse wall tint.' };
  material.needsUpdate = true;
  return material;
}

/** The geometric peel front and the exact remaining flat, bonded disk area. */
export function samplePeelState(peel = 0) {
  peel = clamp(peel);
  const front = PEEL_START_X + (PEEL_END_X - PEEL_START_X) * peel;
  const a = clamp(front, -FOIL_RADIUS, FOIL_RADIUS);
  const bondedArea = FOIL_RADIUS * FOIL_RADIUS * (Math.asin(a / FOIL_RADIUS) + PI / 2)
    + a * Math.sqrt(Math.max(0, FOIL_RADIUS * FOIL_RADIUS - a * a));
  return { peel, front, bondedArea, bondedFraction: bondedArea / (PI * FOIL_RADIUS * FOIL_RADIUS) };
}

/**
 * Isometric strip bending: every detached strip has a circular bend followed
 * by a straight rising tail. The front and its tangent are continuous. Bonded
 * vertices keep their original coordinates exactly; this is not a rotating
 * flat disk. z is preserved, so the mesh stays connected across the sheet.
 */
export function samplePeelPoint(x, z, peel = 0) {
  const { front } = samplePeelState(peel);
  const released = Math.max(0, x - front);
  if (released === 0) return { x, y: FOIL_Y, z, nx: 0, ny: 1, nz: 0, bonded: true };
  const bendLength = PEEL_BEND_RADIUS * PEEL_ANGLE;
  const theta = Math.min(PEEL_ANGLE, released / PEEL_BEND_RADIUS);
  const tail = Math.max(0, released - bendLength);
  return {
    x: front + PEEL_BEND_RADIUS * Math.sin(theta) + tail * Math.cos(PEEL_ANGLE),
    y: FOIL_Y + PEEL_BEND_RADIUS * (1 - Math.cos(theta)) + tail * Math.sin(PEEL_ANGLE),
    z, nx: -Math.sin(theta), ny: Math.cos(theta), nz: 0, bonded: false,
  };
}

/** A physical 0.1 mm hairpin fold keeps the retail pull tab inside the cap. */
export function sampleFoldedTab(distance, z, unfold = 0) {
  const theta = (1 - clamp(unfold)) * PI;
  const arcLength = TAB_BEND_RADIUS * theta;
  const angle = Math.min(theta, Math.max(0, distance) / TAB_BEND_RADIUS);
  const tail = Math.max(0, distance - arcLength);
  return {
    x: TAB_HINGE_X + TAB_BEND_RADIUS * Math.sin(angle) + tail * Math.cos(theta),
    y: FOIL_Y + TAB_BEND_RADIUS * (1 - Math.cos(angle)) + tail * Math.sin(theta),
    z, nx: -Math.sin(angle), ny: Math.cos(angle), nz: 0,
  };
}

function diskRestMesh(radial = 40, angular = 112) {
  const rest = [{ x: 0, z: 0 }], indices = [], boundary = [];
  for (let ring = 1; ring <= radial; ring++) {
    const radius = FOIL_RADIUS * ring / radial;
    for (let s = 0; s < angular; s++) {
      const angle = s / angular * TAU;
      rest.push({ x: radius * Math.cos(angle), z: radius * Math.sin(angle) });
      if (ring === radial) boundary.push(rest.length - 1);
    }
  }
  for (let s = 0; s < angular; s++) indices.push(0, 1 + (s + 1) % angular, 1 + s);
  for (let ring = 1; ring < radial; ring++) {
    const inner = 1 + (ring - 1) * angular, outer = inner + angular;
    for (let s = 0; s < angular; s++) {
      const n = (s + 1) % angular;
      indices.push(inner + s, outer + n, outer + s, inner + s, inner + n, outer + n);
    }
  }
  return { rest, indices, boundary };
}

function tabRestMesh(lengthSteps = 64, widthSteps = 8) {
  const rest = [], indices = [], boundary = [];
  for (let i = 0; i <= lengthSteps; i++) {
    const distance = TAB_LENGTH * i / lengthSteps;
    const roundedTip = clamp((distance - (TAB_LENGTH - 2.2)) / 2.2);
    const width = 3.8 * Math.sqrt(Math.max(.0001, 1 - roundedTip * roundedTip));
    for (let j = 0; j <= widthSteps; j++) rest.push({ distance, z: width * (j / widthSteps * 2 - 1) });
  }
  const row = widthSteps + 1;
  for (let i = 0; i < lengthSteps; i++) for (let j = 0; j < widthSteps; j++) {
    const a = i * row + j, b = a + row;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  for (let j = 0; j <= widthSteps; j++) boundary.push(j);
  for (let i = 1; i <= lengthSteps; i++) boundary.push(i * row + widthSteps);
  for (let j = widthSteps - 1; j >= 0; j--) boundary.push(lengthSteps * row + j);
  for (let i = lengthSteps - 1; i > 0; i--) boundary.push(i * row);
  return { rest, indices, boundary: boundary.reverse() };
}

function filmGeometry(THREE, restMesh) {
  const { rest, indices, boundary } = restMesh;
  const count = rest.length, edgeOffset = count * 2;
  const positions = new Float32Array((edgeOffset + boundary.length * 2) * 3);
  const normals = new Float32Array(positions.length);
  const uv = new Float32Array(positions.length / 3 * 2);
  const faces = [...indices];
  for (let i = 0; i < indices.length; i += 3) faces.push(count + indices[i], count + indices[i + 2], count + indices[i + 1]);
  const edgeStart = faces.length;
  for (let i = 0; i < boundary.length; i++) {
    const n = (i + 1) % boundary.length;
    const a = edgeOffset + i * 2, b = edgeOffset + n * 2;
    faces.push(a, b + 1, a + 1, a, b, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(faces);
  geometry.addGroup(0, indices.length, 0);
  geometry.addGroup(indices.length, indices.length, 1);
  geometry.addGroup(edgeStart, faces.length - edgeStart, 2);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, FOIL_Y + 25, 0), 105);
  function write(i, p, side) {
    const o = i * 3;
    positions[o] = p.x + p.nx * FOIL_THICKNESS / 2 * side;
    positions[o + 1] = p.y + p.ny * FOIL_THICKNESS / 2 * side;
    positions[o + 2] = p.z;
    normals[o] = p.nx * side; normals[o + 1] = p.ny * side; normals[o + 2] = 0;
    uv[i * 2] = (p.x + FOIL_RADIUS) / (FOIL_RADIUS * 2);
    uv[i * 2 + 1] = (p.z + FOIL_RADIUS) / (FOIL_RADIUS * 2);
  }
  function deform(sample) {
    const values = new Array(count);
    for (let i = 0; i < count; i++) {
      const p = sample(rest[i]); values[i] = p;
      write(i, p, 1); write(i + count, p, -1);
    }
    for (let i = 0; i < boundary.length; i++) {
      const p = values[boundary[i]], n = edgeOffset + i * 2;
      write(n, p, 1); write(n + 1, p, -1);
      const next = values[boundary[(i + 1) % boundary.length]];
      const previous = values[boundary[(i + boundary.length - 1) % boundary.length]];
      const tx = next.x - previous.x, ty = next.y - previous.y, tz = next.z - previous.z;
      let nx = p.ny * tz, ny = -p.nx * tz, nz = p.nx * ty - p.ny * tx;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length; ny /= length; nz /= length;
      for (const vertex of [n, n + 1]) { normals[vertex * 3] = nx; normals[vertex * 3 + 1] = ny; normals[vertex * 3 + 2] = nz; }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    // Camera framing reads current bounds. Recompute only when the membrane
    // actually changes (the factory's state signature skips identical frames).
    geometry.computeBoundingBox();
  }
  return { geometry, deform };
}

export function createPeelSeal({ THREE } = {}) {
  if (!THREE?.BufferGeometry) throw new Error('createPeelSeal requires the shared THREE namespace.');
  const group = new THREE.Group(); group.name = 'Progressively_peeled_sealing_membrane';
  const top = new THREE.MeshPhysicalMaterial({
    color: '#e5e9e5', metalness: .76, roughness: .29, clearcoat: .3, clearcoatRoughness: .22,
    side: THREE.FrontSide,
  });
  const bottom = new THREE.MeshStandardMaterial({ color: '#eeeae2', metalness: .22, roughness: .39, side: THREE.FrontSide });
  const edge = new THREE.MeshStandardMaterial({ color: '#b8c0b9', metalness: .55, roughness: .35, side: THREE.DoubleSide });
  top.name = 'Satin_reflective_seal_face'; bottom.name = 'Peel_film_inner_face'; edge.name = 'Thin_seal_edge';
  const disk = filmGeometry(THREE, diskRestMesh());
  const tab = filmGeometry(THREE, tabRestMesh());
  for (const [name, geometry] of [['Continuous_peeling_foil_disk', disk.geometry], ['Folded_pull_tab', tab.geometry]]) {
    const mesh = new THREE.Mesh(geometry, [top, bottom, edge]);
    mesh.name = name; mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
    group.add(mesh);
  }
  let previous = '';
  function update({ unfold = 0, peel = 0, exit = 0, externalExit = false } = {}) {
    unfold = clamp(unfold); peel = clamp(peel); exit = clamp(exit);
    const signature = `${unfold}|${peel}|${exit}|${Boolean(externalExit)}`;
    if (signature === previous) return;
    previous = signature;
    // The fullscreen scene routes fully detached foil through a world-space
    // lane. It owns that transform and its frustum-safe visibility; deformation
    // must never overwrite either, including when its state has not changed.
    if (!externalExit) {
      group.visible = exit < .99999;
      const depart = smooth(exit);
      group.position.set(-145 * depart, 95 * depart, -18 * depart);
    }
    disk.deform(p => samplePeelPoint(p.x, p.z, peel));
    tab.deform(p => {
      const fold = sampleFoldedTab(p.distance, p.z, unfold);
      if (peel <= 0) return fold;
      const bent = samplePeelPoint(fold.x, fold.z, peel);
      // Root choreography finishes unfolding before peeling; this addition also
      // makes a partially unfolded state continuous and safe to inspect.
      bent.y += fold.y - FOIL_Y;
      if (bent.bonded) { bent.nx = fold.nx; bent.ny = fold.ny; }
      return bent;
    });
    group.userData.effectState = { unfold, peel, exit, externalExit: Boolean(externalExit), ...samplePeelState(peel) };
  }
  update();
  const metrics = {
    unit: 'mm', diameter: 58, filmThickness: FOIL_THICKNESS, filmBottomY: FOIL_Y - FOIL_THICKNESS / 2,
    retailTabMaximumY: FOIL_Y + TAB_BEND_RADIUS * 2 + FOIL_THICKNESS / 2,
    foldedTabInsideCap: true, circularBendRadius: PEEL_BEND_RADIUS, pullAngleDegrees: 120,
    animation: 'Pure scroll-state membrane deformation; circular bend, attached flat region, rising tail, no rigid disk flip.',
    assumptions: [
      'Film thickness0.08mm, pull-tab outline and folded0.1mm height are functional visual assumptions.',
      'The3mm peel radius and120degree pull angle illustrate progressive peeling; adhesive mechanics are not simulated.',
    ],
  };
  return {
    group, update, metrics,
    getLocalBounds(target = new THREE.Box3()) {
      target.makeEmpty();
      for (const mesh of group.children) {
        mesh.updateMatrix();
        target.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix));
      }
      return target;
    },
    reset() {
      previous = ''; group.position.set(0, 0, 0);
      group.quaternion.identity(); group.scale.set(1, 1, 1); update();
    },
    dispose() { disk.geometry.dispose(); tab.geometry.dispose(); top.dispose(); bottom.dispose(); edge.dispose(); },
  };
}

/** Nominal fill: a linear fraction represents millilitres, not an arbitrary level. */
export function sampleFill(fraction = 1) {
  fraction = clamp(fraction);
  return { fraction, volumeMilliliters: fraction * 250, height: GEL_HEIGHT * fraction, surfaceY: GEL_FLOOR_Y + GEL_HEIGHT * fraction };
}

function vectorArray(value, fallback) {
  if (value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)) return [value.x, value.y, value.z];
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite)) return value.slice(0, 3);
  return fallback.slice();
}
function directionArray(value) {
  const a = vectorArray(value, [0, -1, 0]), length = Math.hypot(...a) || 1;
  return a.map(v => v / length);
}

/**
 * Distance from an entry point to the next boundary of the finite fill volume.
 * The point is in the unscaled cylinder frame; the ray is a normalised physical
 * direction in that frame. Scaling the Y axis drains the measured fill without
 * stretching a fixed optical thickness. The quadratic is the standard
 * ray/cylinder intersection; attenuation uses the resulting real millimetres.
 * References: pbr-book.org/4ed/Shapes/Cylinders and KHR_materials_volume.
 */
export function sampleGelOpticalPath(point, refractedDirection, { scale = [1, 1, 1] } = {}) {
  const p = vectorArray(point, [GEL_RADIUS, GEL_HEIGHT / 2, 0]);
  const ray = directionArray(refractedDirection);
  const s = vectorArray(scale, [1, 1, 1]).map(value => Math.max(.00001, Math.abs(value)));
  const d = ray.map((value, index) => value / s[index]);
  const a = d[0] * d[0] + d[2] * d[2];
  const b = p[0] * d[0] + p[2] * d[2];
  const c = p[0] * p[0] + p[2] * p[2] - GEL_RADIUS * GEL_RADIUS;
  const side = a > 1e-10 ? (-b + Math.sqrt(Math.max(0, b * b - a * c))) / a : Infinity;
  const axial = Math.abs(d[1]) > 1e-10 ? ((d[1] > 0 ? GEL_HEIGHT : 0) - p[1]) / d[1] : Infinity;
  const distance = Math.min(side, axial);
  return Number.isFinite(distance) ? Math.max(0, distance) : 0;
}

function useCylindricalVolumeOptics(THREE, material) {
  // Three's physical material uses a nominal uniform thickness. This boundary
  // has known dimensions, so trace the Snell-refracted ray to its actual exit
  // instead. No painted tint, time uniform, or camera-dependent colour ramp.
  const opticalRay = /* glsl */`
    vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness,
      const in float ior, const in mat4 modelMatrix ) {
      vec3 ray = refract( -v, normalize( n ), 1.0 / ior );
      if ( dot( ray, ray ) < 1e-10 ) return vec3( 0.0 );
      ray = normalize( ray );
      vec3 scaleSquared = max( vec3( dot( modelMatrix[0].xyz, modelMatrix[0].xyz ),
        dot( modelMatrix[1].xyz, modelMatrix[1].xyz ), dot( modelMatrix[2].xyz, modelMatrix[2].xyz ) ), vec3( 1e-10 ) );
      // Parent transforms are rotations/translations/scales, with no shear.
      // These inverse basis dot products keep the ray parameter in world mm.
      vec3 localRay = vec3( dot( ray, modelMatrix[0].xyz ), dot( ray, modelMatrix[1].xyz ),
        dot( ray, modelMatrix[2].xyz ) ) / scaleSquared;
      vec3 point = vGelVolumePosition;
      float a = dot( localRay.xz, localRay.xz );
      float b = dot( point.xz, localRay.xz );
      float c = dot( point.xz, point.xz ) - ${GEL_RADIUS.toFixed(10)} * ${GEL_RADIUS.toFixed(10)};
      float sideExit = a > 1e-10 ? ( -b + sqrt( max( 0.0, b * b - a * c ) ) ) / a : 1e20;
      float axialExit = abs( localRay.y ) > 1e-10
        ? ( ( localRay.y > 0.0 ? ${GEL_HEIGHT.toFixed(10)} : 0.0 ) - point.y ) / localRay.y : 1e20;
      float distance = max( 0.002, min( sideExit, axialExit ) );
      return ray * distance;
    }
  `;
  const pars = THREE.ShaderChunk.transmission_pars_fragment
    .replace('vec3 getVolumeTransmissionRay(', 'vec3 getNominalVolumeTransmissionRay(')
    .replace('float applyIorToRoughness(', `${opticalRay}\nfloat applyIorToRoughness(`);
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGelVolumePosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGelVolumePosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGelVolumePosition;')
      .replace('#include <transmission_pars_fragment>', pars);
    useResolvedLiquidCoverage(shader);
  };
  material.customProgramCacheKey = () => 'grapefruit-finite-cylinder-optics-v2';
  material.userData.optics = { rayExit: 'Snell-refracted finite-cylinder boundary', attenuation: 'Beer-Lambert world-mm path',
    baseRadius: GEL_RADIUS, baseHeight: GEL_HEIGHT, scaleAware: true, timeUniform: false };
}

function useResolvedLiquidCoverage(shader) {
  // The transmission shader has already integrated the RGB background sampled
  // along the refracted ray. Its scalar transmissionAlpha is a CSS-background
  // approximation; applying that again makes coloured absorption pastel and
  // discards reflected softbox energy. A bounded liquid pixel has full surface
  // coverage, with optical transparency provided by physical transmission.
  // The renderer supplies the matching world RGB; MSAA retains silhouette AA.
  shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>',
    '#include <transmission_fragment>\n#ifdef USE_TRANSMISSION\nmaterial.transmissionAlpha = 1.0;\n#endif');
}

/**
 * A cohesive, gravity-stretched viscous strand. The nozzle section stays normal
 * to the real dosing outlet; gravity takes over progressively rather than
 * starting with an angular kink. Capillary necks and swellings move only with
 * scroll. This is an authored analytical surface, not a CFD solver.
 */
export function sampleGelStream(t, state = {}) {
  t = clamp(t);
  const flow = clamp(state.flow), gush = clamp(state.gush), progress = clamp(state.progress);
  const origin = vectorArray(state.outletWorld, [0, 0, 0]), direction = directionArray(state.outletDirection);
  const length = (104 + gush * 14) * Math.pow(flow, .28);
  const phase = TAU * (progress - .475) * 17;
  const neck = 7.2 * (1 - Math.exp(-t * 5.8));
  const gravity = length * t * t;
  const bend = .24 * t * t * Math.sin(t * 7 + phase);
  const pressureAreaMultiplier = 1 + 2.2 * gush;
  // Area varies inversely with the authored accelerating axial velocity. The
  // pressure pulse changes area by exactly 3.2x, never the 6 mm outlet contour.
  const gravityStretch = Math.pow(1 + 2.15 * t, -.25);
  const capillaryArea = 1 + .18 * Math.sin(t * 19 - phase) * Math.sin(PI * t) ** 2;
  const travellingNeck = .81 + .018 * Math.sin(phase);
  const travellingBead = .884 + .016 * Math.sin(phase);
  const necking = 1 - .31 * Math.exp(-(((t - travellingNeck) / .033) ** 2));
  const bead = 1 + .34 * Math.exp(-(((t - travellingBead) / .04) ** 2));
  // A spherical terminal cap closes the liquid surface. There is no open
  // tube-shaped cut end, and its derivative supplies the correct shiny normal.
  const terminal = clamp((t - .925) / .075);
  const end = Math.sqrt(Math.max(0, 1 - terminal * terminal));
  const radius = 1.62 * Math.sqrt(flow * pressureAreaMultiplier * capillaryArea)
    * gravityStretch * necking * bead * end;
  return {
    x: origin[0] + direction[0] * neck + bend,
    y: origin[1] + direction[1] * neck - gravity,
    z: origin[2] + direction[2] * neck + bend * .35,
    radius, length, pressureAreaMultiplier,
    ellipticity: .032 * Math.sin(t * 11 - phase) * Math.sin(PI * t),
  };
}

/**
 * Separated pearls start at the rounded strand tip and accelerate under world
 * gravity. Birth and departure have zero-scale endpoints, so reversing a scrub
 * cannot pop a full-sized sphere into the scene. A small final set survives the
 * stopped strand. No emitted-particle history or wall-clock time is required.
 */
export function sampleGelDrop(index, state = {}) {
  const p = clamp(state.progress), flow = clamp(state.flow), gush = clamp(state.gush);
  const origin = vectorArray(state.outletWorld, [0, 0, 0]), direction = directionArray(state.outletDirection);
  index = Math.floor(clamp(index, 0, 4));
  let phase, visible, dropDistance, scale, tip;
  if (p >= .65) {
    const start = .650 + index * .0013, end = .668 + index * .00035;
    phase = clamp((p - start) / (end - start));
    const birthFlow = 1 - smooth((start - .635) / .025);
    tip = sampleGelStream(1, { ...state, progress: start, flow: birthFlow, gush: 0 });
    const initialDistance = origin[1] - tip.y;
    dropDistance = initialDistance + (129 - initialDistance) * phase * phase;
    scale = (.76 + (4 - index) * .09) * smooth(phase / .095) * (1 - smooth((phase - .88) / .12));
    visible = p >= start && p < end && p < .67 && scale > .00001;
  } else {
    const raw = (p - .475) * 17 + index * .193;
    const slot = raw - Math.floor(raw);
    phase = clamp(slot / .36);
    tip = sampleGelStream(1, state);
    const initialDistance = origin[1] - tip.y;
    dropDistance = initialDistance + Math.max(0, 129 - initialDistance) * phase * phase;
    scale = (.66 + index * .055) * Math.sqrt(flow * (1 + .8 * gush))
      * smooth(phase / .12) * (1 - smooth((phase - .87) / .13));
    visible = flow > .0001 && p >= .475 && p < .65 && slot < .36 && scale > .00001;
  }
  const axialScale = 1 + .72 * Math.exp(-phase * 3.4) + .1 * Math.sin(phase * TAU) * Math.exp(-phase * 4);
  return {
    visible, phase,
    x: tip.x + direction[0] * phase * .7 + Math.sin(index * 2.71 + phase * 2) * .18 * phase,
    y: origin[1] - dropDistance,
    z: tip.z + direction[2] * phase * .7 + Math.cos(index * 1.82 + phase * 2) * .14 * phase,
    radius: scale, axialScale, radialScale: 1 / Math.sqrt(axialScale),
  };
}

/** Zero-mean capillary profile; the optical detail does not raise nominal fill. */
export function sampleGelSurface(radius, angle = 0, state = {}) {
  const r = clamp(radius), fraction = clamp(state.fraction ?? 1);
  const height = sampleFill(fraction).height;
  const contact = .24 * (r ** 12 - 1 / 7);
  // Both angular modes integrate to zero, are finite at the centre, and die
  // against the wall. The viscous free surface remains nearly still at rest.
  const phase = clamp(state.progress) * TAU * 14;
  const amplitude = .095 * clamp(state.flow) * (1 + .35 * clamp(state.gush));
  const waves = amplitude * (1 - r * r) * (r * Math.sin(angle - phase)
    + .28 * r * r * Math.sin(2 * angle + phase * .7));
  return (contact + waves) * smooth(height / .6);
}

function createFreeSurfaceGeometry(THREE, radial = 18, angular = 96) {
  const positions = new Float32Array((1 + radial * angular) * 3);
  const uv = new Float32Array((1 + radial * angular) * 2), indices = [];
  uv[0] = .5; uv[1] = .5;
  for (let ring = 1; ring <= radial; ring++) for (let j = 0; j < angular; j++) {
    const radius = GEL_RADIUS * ring / radial, angle = j / angular * TAU;
    const index = 1 + (ring - 1) * angular + j;
    positions[index * 3] = radius * Math.cos(angle);
    positions[index * 3 + 2] = radius * Math.sin(angle);
    uv[index * 2] = .5 + positions[index * 3] / (2 * GEL_RADIUS);
    uv[index * 2 + 1] = .5 + positions[index * 3 + 2] / (2 * GEL_RADIUS);
    if (ring === 1) indices.push(0, 1 + (j + 1) % angular, 1 + j);
    else {
      const a = index - angular, b = 1 + (ring - 2) * angular + (j + 1) % angular;
      const c = index, d = 1 + (ring - 1) * angular + (j + 1) % angular;
      indices.push(a, d, c, a, b, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  function update(state) {
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], z = positions[i + 2];
      positions[i + 1] = sampleGelSurface(Math.hypot(x, z) / GEL_RADIUS, Math.atan2(z, x), state);
    }
    // Preserve zero displaced volume in the tessellated mesh too. A steep
    // contact profile sampled on finite rings has a small quadrature bias.
    let area = 0, displacement = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      const projectedArea = Math.abs((positions[b] - positions[a]) * (positions[c + 2] - positions[a + 2])
        - (positions[c] - positions[a]) * (positions[b + 2] - positions[a + 2])) / 2;
      area += projectedArea;
      displacement += projectedArea * (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3;
    }
    const mean = displacement / area;
    for (let i = 1; i < positions.length; i += 3) positions[i] -= mean;
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  }
  update({ fraction: 1 });
  geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  return { geometry, update };
}

function createFillMesh(THREE, material, name, bulkMaterial = material) {
  const group = new THREE.Group(); group.name = name;
  // Keep the full geometry in physical millimetres. A unit-height cylinder
  // stretched148times also stretches the transmission ray's volume thickness,
  // which makes a clear fill sample distant bamboo and appear opaque amber.
  const cylinder = new THREE.CylinderGeometry(GEL_RADIUS, GEL_RADIUS, GEL_HEIGHT, 96, 1, true);
  cylinder.translate(0, GEL_HEIGHT / 2, 0);
  const body = new THREE.Mesh(cylinder, bulkMaterial);
  body.name = 'Measured_250ml_gel_volume'; body.position.y = GEL_FLOOR_Y; body.castShadow = false;
  const freeSurface = createFreeSurfaceGeometry(THREE);
  const surfaceGeometry = freeSurface.geometry;
  const surface = new THREE.Mesh(surfaceGeometry, material); surface.name = 'Level_gel_free_surface'; surface.castShadow = false;
  const bottomGeometry = new THREE.CircleGeometry(GEL_RADIUS, 96);
  bottomGeometry.rotateX(PI / 2); bottomGeometry.translate(0, GEL_FLOOR_Y, 0);
  const bottom = new THREE.Mesh(bottomGeometry, material); bottom.name = 'Gel_bottom_surface'; bottom.castShadow = false;
  // A tiny contact meniscus catches grazing light when an insert is outside the
  // bamboo. It is a visual surface detail, separate from the measured volume.
  const meniscusGeometry = new THREE.TorusGeometry(GEL_RADIUS - .14, .14, 8, 96);
  meniscusGeometry.rotateX(PI / 2);
  const meniscus = new THREE.Mesh(meniscusGeometry, material); meniscus.name = 'Subtle_contact_meniscus'; meniscus.castShadow = false;
  group.add(body, surface, bottom, meniscus);
  let previousProfile = '';
  function update(fraction, state = {}) {
    const fill = sampleFill(fraction);
    group.visible = fill.fraction > .00001;
    body.scale.y = Math.max(.00001, fill.fraction);
    surface.position.y = fill.surfaceY;
    const profile = { fraction: fill.fraction, progress: clamp(state.flow) > 0 ? clamp(state.progress) : 0,
      flow: clamp(state.flow), gush: clamp(state.gush) };
    const signature = JSON.stringify(profile);
    if (signature !== previousProfile) { freeSurface.update(profile); previousProfile = signature; }
    meniscus.position.y = fill.surfaceY + .072 * smooth(fill.height / .6);
    meniscus.scale.y = smooth(fill.height / .6);
    group.userData.fillMilliliters = fill.volumeMilliliters;
  }
  update(1);
  return { group, update, geometries: [cylinder, surfaceGeometry, bottomGeometry, meniscusGeometry] };
}

function createStreamMesh(THREE, material, longitudinal = 72, radial = 14) {
  const rows = longitudinal + 1, stride = radial + 1;
  const positions = new Float32Array(rows * stride * 3), normals = new Float32Array(positions.length), uv = new Float32Array(rows * stride * 2);
  const indices = [];
  for (let i = 0; i < longitudinal; i++) for (let j = 0; j < radial; j++) {
    const a = i * stride + j, b = a + stride;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j <= radial; j++) {
    const o = (i * stride + j) * 2; uv[o] = j / radial; uv[o + 1] = i / longitudinal;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'World_gravity_viscous_shampoo_stream'; mesh.castShadow = false; mesh.frustumCulled = false;
  const tangent = new THREE.Vector3(), side = new THREE.Vector3(), binormal = new THREE.Vector3(), reference = new THREE.Vector3(0, 0, 1);
  const around = new THREE.Vector3(), along = new THREE.Vector3(), normal = new THREE.Vector3();
  function update(state) {
    mesh.visible = state.flow > .00001;
    if (!mesh.visible) {
      // Reset hidden buffers too: returning to a sealed endpoint must not keep
      // old stream vertices from the previous scrub direction.
      const origin = vectorArray(state.outletWorld, [0, 0, 0]);
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = origin[0]; positions[i + 1] = origin[1]; positions[i + 2] = origin[2];
        normals[i] = 0; normals[i + 1] = 1; normals[i + 2] = 0;
      }
      geometry.attributes.position.needsUpdate = true; geometry.attributes.normal.needsUpdate = true;
      return;
    }
    for (let i = 0; i < rows; i++) {
      const t = i / longitudinal, c = sampleGelStream(t, state);
      const before = sampleGelStream(Math.max(0, t - .001), state), after = sampleGelStream(Math.min(1, t + .001), state);
      tangent.set(after.x - before.x, after.y - before.y, after.z - before.z).normalize();
      if (Math.abs(tangent.z) > .98) reference.set(1, 0, 0); else reference.set(0, 0, 1);
      side.crossVectors(tangent, reference).normalize(); binormal.crossVectors(tangent, side).normalize();
      for (let j = 0; j <= radial; j++) {
        const angle = j / radial * TAU, co = Math.cos(angle), si = Math.sin(angle), o = (i * stride + j) * 3;
        // Reciprocal axis factors retain cross-sectional area while the very
        // small ovalisation produces wet, moving highlight ribbons.
        const a = co * Math.exp(c.ellipticity), b = si * Math.exp(-c.ellipticity);
        const nx = side.x * a + binormal.x * b, ny = side.y * a + binormal.y * b, nz = side.z * a + binormal.z * b;
        positions[o] = c.x + nx * c.radius; positions[o + 1] = c.y + ny * c.radius; positions[o + 2] = c.z + nz * c.radius;
      }
    }
    // A radial-only normal makes a tapered strand look like a striped plastic
    // hose. Differentiate the deformed surface in both directions instead.
    for (let i = 0; i < rows; i++) for (let j = 0; j <= radial; j++) {
      const before = (i * stride + (j + radial - 1) % radial) * 3;
      const after = (i * stride + (j + 1) % radial) * 3;
      const up = (Math.max(0, i - 1) * stride + j) * 3;
      const down = (Math.min(longitudinal, i + 1) * stride + j) * 3;
      around.set(positions[after] - positions[before], positions[after + 1] - positions[before + 1], positions[after + 2] - positions[before + 2]);
      along.set(positions[down] - positions[up], positions[down + 1] - positions[up + 1], positions[down + 2] - positions[up + 2]);
      normal.crossVectors(around, along);
      if (normal.lengthSq() < 1e-12) normal.copy(tangent);
      normal.normalize();
      const o = (i * stride + j) * 3;
      normals[o] = normal.x; normals[o + 1] = normal.y; normals[o + 2] = normal.z;
    }
    geometry.attributes.position.needsUpdate = true; geometry.attributes.normal.needsUpdate = true;
  }
  return { mesh, geometry, update };
}

export function createGel({ THREE, scent } = {}) {
  if (!THREE?.BufferGeometry) throw new Error('createGel requires the shared THREE namespace.');
  let appearance = getGelAppearance(scent);
  const liquid = new THREE.MeshPhysicalMaterial({
    color: appearance.color, metalness: 0, roughness: appearance.roughness,
    transmission: appearance.transmission, opacity: 1,
    thickness: appearance.thickness, ior: appearance.ior,
    clearcoat: .25, clearcoatRoughness: .05, envMapIntensity: 1.1,
    attenuationColor: appearance.attenuationColor,
    attenuationDistance: appearance.attenuationDistance, side: THREE.FrontSide,
  });
  liquid.name = 'Translucent_viscous_shampoo_free_surface';
  liquid.onBeforeCompile = useResolvedLiquidCoverage;
  liquid.customProgramCacheKey = () => 'grapefruit-resolved-background-coverage-v1';
  liquid.userData.resolvedBackgroundCoverage = true;
  const bulkLiquid = liquid.clone();
  bulkLiquid.name = 'Shampoo_volume_with_analytic_refracted_cylinder_chord';
  useCylindricalVolumeOptics(THREE, bulkLiquid);
  const movingGel = liquid.clone(); movingGel.thickness = appearance.streamThickness;
  movingGel.onBeforeCompile = useResolvedLiquidCoverage;
  movingGel.customProgramCacheKey = liquid.customProgramCacheKey;
  // The strand is the same liquid, with the same absorption coefficient. Its
  // shorter optical path produces a paler core and clear Fresnel edges instead
  // of an opaque orange string. Lighting supplies the reflection contrast.
  movingGel.color.set(appearance.streamColor);
  movingGel.attenuationDistance = appearance.streamAttenuationDistance;
  movingGel.name = 'Matching_scented_shampoo_stream_and_drops';
  for (const material of [liquid, bulkLiquid, movingGel]) material.userData.scent = appearance.scent;
  const oldFill = createFillMesh(THREE, liquid, 'Old_refill_250ml_gel_fill', bulkLiquid);
  const newFill = createFillMesh(THREE, liquid, 'New_refill_250ml_gel_fill', bulkLiquid);
  const streamGroup = new THREE.Group(); streamGroup.name = 'Shampoo_flow_in_world_gravity';
  const stream = createStreamMesh(THREE, movingGel); streamGroup.add(stream.mesh);
  const dropGeometry = new THREE.SphereGeometry(1, 24, 16);
  const drops = Array.from({ length: 5 }, (_, i) => {
    const mesh = new THREE.Mesh(dropGeometry, movingGel); mesh.name = `Deterministic_gel_drop_${i + 1}`; mesh.castShadow = false;
    streamGroup.add(mesh); return mesh;
  });
  let previous = '';
  function update({ progress = 0, flow = 0, gush = 0, fillOld = 1, fillNew = 1, outletWorld, outletDirection } = {}) {
    const state = { progress: clamp(progress), flow: clamp(flow), gush: clamp(gush), fillOld: clamp(fillOld), fillNew: clamp(fillNew),
      outletWorld: vectorArray(outletWorld, [0, 0, 0]), outletDirection: directionArray(outletDirection) };
    const signature = JSON.stringify(state);
    if (signature === previous) return;
    previous = signature;
    oldFill.update(state.fillOld, state); newFill.update(state.fillNew); stream.update(state);
    let anyDrop = false;
    for (let i = 0; i < drops.length; i++) {
      const sample = sampleGelDrop(i, state), mesh = drops[i]; mesh.visible = sample.visible;
      anyDrop ||= sample.visible; mesh.position.set(sample.x, sample.y, sample.z);
      mesh.scale.set(sample.radius * sample.radialScale, sample.radius * sample.axialScale,
        sample.radius * sample.radialScale);
    }
    streamGroup.visible = state.flow > .00001 || anyDrop;
    streamGroup.userData.effectState = { progress: state.progress, flow: state.flow, gush: state.gush,
      pressureAreaMultiplier: 1 + 2.2 * state.gush, oldFillMilliliters: state.fillOld * 250, newFillMilliliters: state.fillNew * 250,
      activeDroplets: drops.filter(drop => drop.visible).length };
  }
  update();
  const metrics = {
    unit: 'mm', nominalFillMilliliters: 250, liquidRadius: GEL_RADIUS, liquidFloorY: GEL_FLOOR_Y,
    fullFillHeight: GEL_HEIGHT, fullFillSurfaceY: GEL_FLOOR_Y + GEL_HEIGHT,
    areaPressureMultiplier: 3.2, maximumStreamLength: 118, maximumDropletGravityDistance: 129,
    stateOnly: true, worldGravity: [0, -1, 0], seededByProgress: true,
    appearance: { ...appearance },
    bulkOptics: { rayExit: 'Snell-refracted finite-cylinder boundary', attenuation: 'Beer-Lambert world-mm path',
      viewDependentPathLength: true, opaqueWallTint: false, resolvedBackgroundCoverage: true },
    surfaceDetail: { meniscusHeight: .24, contactRadius: GEL_RADIUS, volumeMeanOffset: 0,
      strandSegments: 72, strandRadialSegments: 14, roundedClosedTail: true,
      normalsFollowDeformedSurface: true, volumePreservingDropStretch: true },
    assumptions: [
      'Gel appearance, flow rate,3.2times pressure area and trajectory are authored visual effects, not measured fluid data.',
      'Aloe, Argan and Bamboo colours are authored scent palettes; absorption belongs to the shampoo rather than the clear PET.',
      'The inner radius23.2mm follows the unmeasured0.3mm PET wall placeholder;250ml is the user-confirmed nominal fill.',
      'The hidden interior liquid remains an axial volume display during tilt; exterior flow follows world gravity.',
      'Bulk optical paths intersect the measured finite cylindrical volume after Snell refraction; the thin free surface retains the standard physical-material approximation.',
      'The liquid shader resolves full geometric pixel coverage after physical transmission; the renderer must provide world-matching background RGB to avoid a second CSS background blend.',
      'The zero-mean0.24mm concave meniscus and sub0.13mm surface waves are authored capillary details, not measured fluid data.',
      'World-gravity strand acceleration, capillary necking, closed bead tip and separating volume-preserving droplet stretch are analytical scroll-driven surfaces, not a CFD simulation.',
    ],
  };
  function setScent(nextScent) {
    const next = getGelAppearance(nextScent);
    if (next === appearance) return appearance.scent;
    appearance = next;
    // These are existing physical-material uniforms. Recolouring creates no
    // materials, meshes or buffers and does not trigger shader recompilation.
    for (const material of [liquid, bulkLiquid, movingGel]) {
      material.color.set(next.color);
      material.attenuationColor.set(next.attenuationColor);
      material.attenuationDistance = next.attenuationDistance;
      material.userData.scent = next.scent;
    }
    movingGel.color.set(next.streamColor);
    movingGel.attenuationDistance = next.streamAttenuationDistance;
    Object.assign(metrics.appearance, next);
    return appearance.scent;
  }
  return {
    streamGroup, oldFillGroup: oldFill.group, newFillGroup: newFill.group, update, metrics, setScent,
    get scent() { return appearance.scent; },
    dispose() {
      for (const geometry of [...oldFill.geometries, ...newFill.geometries, stream.geometry, dropGeometry]) geometry.dispose();
      liquid.dispose(); bulkLiquid.dispose(); movingGel.dispose();
    },
  };
}
