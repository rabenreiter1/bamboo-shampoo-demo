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

/** Analytical gravity centreline and incompressible-area pressure expansion. */
export function sampleGelStream(t, state = {}) {
  t = clamp(t);
  const flow = clamp(state.flow), gush = clamp(state.gush), progress = clamp(state.progress);
  const origin = vectorArray(state.outletWorld, [0, 0, 0]), direction = directionArray(state.outletDirection);
  const length = (104 + gush * 14) * Math.pow(flow, .28);
  const phase = progress * 125;
  const neck = 6 * (1 - Math.exp(-t * 5));
  const gravity = length * (.15 * t + .85 * t * t);
  const bend = .4 * t * t * Math.sin(t * 7 + phase);
  const pressureAreaMultiplier = 1 + 2.2 * gush;
  const ripple = 1 + .09 * Math.sin(t * 17 - phase) * Math.sin(PI * t);
  const taper = .86 - .27 * t + .04 * Math.sin(t * 9 + phase);
  const end = t > .84 ? Math.sqrt(Math.max(.015, (1 - t) / .16)) : 1;
  const radius = 1.55 * Math.sqrt(flow * pressureAreaMultiplier) * ripple * taper * end;
  return {
    x: origin[0] + direction[0] * neck + bend,
    y: origin[1] + direction[1] * neck - gravity,
    z: origin[2] + direction[2] * neck + bend * .35,
    radius, length, pressureAreaMultiplier,
  };
}

/** A fixed small set of droplets follows progress directly, including the tail. */
export function sampleGelDrop(index, state = {}) {
  const p = clamp(state.progress), flow = clamp(state.flow), gush = clamp(state.gush);
  const origin = vectorArray(state.outletWorld, [0, 0, 0]), direction = directionArray(state.outletDirection);
  index = Math.max(0, Math.min(4, Math.floor(index)));
  let phase, visible, dropDistance, scale;
  if (p >= .65) {
    const start = .650 + index * .0013, end = .668 + index * .00035;
    phase = clamp((p - start) / (end - start));
    visible = p >= start && p < end && p < .67;
    dropDistance = 30 + 99 * phase * phase;
    scale = (.65 + (4 - index) * .1) * Math.pow(Math.max(.05, 1 - phase), .23);
  } else {
    const raw = (p - .475) * 83 + index * .193;
    phase = raw - Math.floor(raw);
    visible = flow > .0001 && p >= .475 && p < .65 && phase > .12;
    dropDistance = 88 + phase * 37;
    scale = (.52 + index * .09) * Math.sqrt(flow) * Math.sqrt(1 + .8 * gush);
  }
  return {
    visible, phase,
    x: origin[0] + direction[0] * 5.8 + Math.sin(index * 2.71 + phase * 2) * .62,
    y: origin[1] + direction[1] * 5.8 - dropDistance,
    z: origin[2] + direction[2] * 5.8 + Math.cos(index * 1.82 + phase * 2) * .45,
    radius: scale, axialScale: 1.25 + (1 - phase) * .55,
  };
}

function createFillMesh(THREE, material, name) {
  const group = new THREE.Group(); group.name = name;
  // Keep the full geometry in physical millimetres. A unit-height cylinder
  // stretched148times also stretches the transmission ray's volume thickness,
  // which makes a clear fill sample distant bamboo and appear opaque amber.
  const cylinder = new THREE.CylinderGeometry(GEL_RADIUS, GEL_RADIUS, GEL_HEIGHT, 96, 1, true);
  cylinder.translate(0, GEL_HEIGHT / 2, 0);
  const body = new THREE.Mesh(cylinder, material);
  body.name = 'Measured_250ml_gel_volume'; body.position.y = GEL_FLOOR_Y; body.castShadow = false;
  const surfaceGeometry = new THREE.CircleGeometry(GEL_RADIUS, 96);
  surfaceGeometry.rotateX(-PI / 2);
  const surface = new THREE.Mesh(surfaceGeometry, material); surface.name = 'Level_gel_free_surface'; surface.castShadow = false;
  const bottomGeometry = new THREE.CircleGeometry(GEL_RADIUS, 96);
  bottomGeometry.rotateX(PI / 2); bottomGeometry.translate(0, GEL_FLOOR_Y, 0);
  const bottom = new THREE.Mesh(bottomGeometry, material); bottom.name = 'Gel_bottom_surface'; bottom.castShadow = false;
  // A tiny contact meniscus catches grazing light when an insert is outside the
  // bamboo. It is a visual surface detail, separate from the measured volume.
  const meniscusGeometry = new THREE.TorusGeometry(GEL_RADIUS - .17, .16, 6, 96);
  meniscusGeometry.rotateX(PI / 2);
  const meniscus = new THREE.Mesh(meniscusGeometry, material); meniscus.name = 'Subtle_contact_meniscus'; meniscus.castShadow = false;
  group.add(body, surface, bottom, meniscus);
  function update(fraction) {
    const fill = sampleFill(fraction);
    group.visible = fill.fraction > .00001;
    body.scale.y = Math.max(.00001, fill.fraction);
    surface.position.y = fill.surfaceY;
    meniscus.position.y = fill.surfaceY - .1;
    group.userData.fillMilliliters = fill.volumeMilliliters;
  }
  update(1);
  return { group, update, geometries: [cylinder, surfaceGeometry, bottomGeometry, meniscusGeometry] };
}

function createStreamMesh(THREE, material, longitudinal = 44, radial = 14) {
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
        const nx = side.x * co + binormal.x * si, ny = side.y * co + binormal.y * si, nz = side.z * co + binormal.z * si;
        positions[o] = c.x + nx * c.radius; positions[o + 1] = c.y + ny * c.radius; positions[o + 2] = c.z + nz * c.radius;
        normals[o] = nx; normals[o + 1] = ny; normals[o + 2] = nz;
      }
    }
    geometry.attributes.position.needsUpdate = true; geometry.attributes.normal.needsUpdate = true;
  }
  return { mesh, geometry, update };
}

export function createGel({ THREE } = {}) {
  if (!THREE?.BufferGeometry) throw new Error('createGel requires the shared THREE namespace.');
  const liquid = new THREE.MeshPhysicalMaterial({
    color: '#ffe0a3', metalness: 0, roughness: .09, transmission: .88, opacity: 1,
    thickness: 26, ior: 1.43, clearcoat: 1, clearcoatRoughness: .025,
    attenuationColor: '#c67a14', attenuationDistance: 35, side: THREE.FrontSide,
  });
  liquid.name = 'Translucent_warm_amber_viscous_shampoo_volume';
  const movingGel = liquid.clone(); movingGel.thickness = 2.8;
  // A thin strand needs stronger absorption than the bulk to remain legible
  // against the studio background. This is an authored appearance adjustment,
  // not a measured chemical property; hue stays identical to the refill gel.
  movingGel.color.set('#f3c36d'); movingGel.attenuationDistance = 3.2;
  movingGel.name = 'Matching_amber_shampoo_stream_and_drops';
  const oldFill = createFillMesh(THREE, liquid, 'Old_refill_250ml_gel_fill');
  const newFill = createFillMesh(THREE, liquid, 'New_refill_250ml_gel_fill');
  const streamGroup = new THREE.Group(); streamGroup.name = 'Shampoo_flow_in_world_gravity';
  const stream = createStreamMesh(THREE, movingGel); streamGroup.add(stream.mesh);
  const dropGeometry = new THREE.SphereGeometry(1, 16, 10);
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
    oldFill.update(state.fillOld); newFill.update(state.fillNew); stream.update(state);
    let anyDrop = false;
    for (let i = 0; i < drops.length; i++) {
      const sample = sampleGelDrop(i, state), mesh = drops[i]; mesh.visible = sample.visible;
      anyDrop ||= sample.visible; mesh.position.set(sample.x, sample.y, sample.z);
      mesh.scale.set(sample.radius, sample.radius * sample.axialScale, sample.radius);
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
    appearance: { color: '#ffe0a3', attenuationColor: '#c67a14', attenuationDistance: 35,
      transmission: .88, roughness: .09, ior: 1.43, streamColor: '#f3c36d', streamAttenuationDistance: 3.2 },
    assumptions: [
      'Gel appearance, flow rate,3.2times pressure area and trajectory are authored visual effects, not measured fluid data.',
      'The inner radius23.2mm follows the unmeasured0.3mm PET wall placeholder;250ml is the user-confirmed nominal fill.',
      'The hidden interior liquid remains an axial volume display during tilt; exterior flow follows world gravity.',
      'Contact meniscus0.16mm is a visual reflection detail; nominal volume is computed from the cylindrical interior.',
    ],
  };
  return {
    streamGroup, oldFillGroup: oldFill.group, newFillGroup: newFill.group, update, metrics,
    dispose() {
      for (const geometry of [...oldFill.geometries, ...newFill.geometries, stream.geometry, dropGeometry]) geometry.dispose();
      liquid.dispose(); movingGel.dispose();
    },
  };
}
