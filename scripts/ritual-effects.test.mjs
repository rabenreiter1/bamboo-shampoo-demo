import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createPeelSeal, createGel, samplePeelPoint, samplePeelState, sampleFoldedTab,
  sampleFill, sampleGelStream, sampleGelDrop, sampleGelSurface, sampleGelOpticalPath,
  configurePetReflectionSkin, samplePetFresnel, GEL_APPEARANCE,
  GEL_SCENT_APPEARANCES, getGelAppearance } from '../assets/assembly/ritual-effects.js';

const near = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const finite = object => { for (const value of Object.values(object)) if (typeof value === 'number') assert.ok(Number.isFinite(value)); };

test('clear PET Fresnel reflection strengthens at the silhouette without a white diffuse wash', () => {
  const f0 = ((1.57 - 1) / (1.57 + 1)) ** 2;
  near(samplePetFresnel(1), f0); near(samplePetFresnel(0), 1);
  let previous = 1;
  for (let i = 0; i <= 100; i++) {
    const reflectance = samplePetFresnel(i / 100);
    assert.ok(reflectance <= previous + 1e-12); previous = reflectance;
    assert.ok(reflectance >= f0 && reflectance <= 1);
    const contents = [.73, .31, .26], incident = [.7, .8, .9];
    const reflected = incident.map(value => value * reflectance);
    const straightRgb = reflected.map(value => value / reflectance);
    straightRgb.forEach((value, channel) => near(value * reflectance + contents[channel] * (1 - reflectance),
      reflected[channel] + contents[channel] * (1 - reflectance)));
  }
  const material = new THREE.MeshPhysicalMaterial({ ior: 1.57, thickness: .3, opacity: .22,
    transmission: 0, transparent: true, clearcoat: .85 });
  configurePetReflectionSkin({ THREE, material });
  const shader = { fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /vec3 outgoingLight = totalSpecular/);
  assert.doesNotMatch(shader.fragmentShader, /outgoingLight = totalDiffuse \+ totalSpecular/);
  assert.match(shader.fragmentShader, /outgoingLight \/ petReflectance, petReflectance/);
  assert.match(shader.fragmentShader, /ior - 1\.0/);
  assert.equal(material.opacity, 1); assert.equal(material.transmission, 0);
  assert.equal(material.clearcoat, 0); assert.equal(material.depthWrite, false);
  near(material.ior, 1.57); near(material.thickness, .3);
  material.dispose();
});

test('PET reflection configuration changes no manufactured geometry or source dimensions', async () => {
  const { createBody } = await import('../assets/assembly/body.js');
  const body = await createBody({ THREE });
  const snapshot = () => {
    const hash = createHash('sha256');
    body.components.inlay.traverse(object => {
      for (const attribute of Object.values(object.geometry?.attributes || {})) {
        hash.update(Buffer.from(attribute.array.buffer));
      }
      if (object.geometry?.index) hash.update(Buffer.from(object.geometry.index.array.buffer));
      hash.update(JSON.stringify([object.position.toArray(), object.quaternion.toArray(), object.scale.toArray()]));
    });
    return hash.digest('hex');
  };
  const initial = snapshot(), dimensions = structuredClone(body.components.inlay.userData.confirmedDimensions);
  configurePetReflectionSkin({ THREE, material: body.materials.clearPET });
  assert.equal(snapshot(), initial);
  assert.deepEqual(body.components.inlay.userData.confirmedDimensions, dimensions);
  assert.deepEqual(dimensions, { bodyDiameter: 47, bodyHeight: 165, flangeDiameter: 58, flangeRadialWidth: 5.5 });
  body.dispose();
});

test('retail foil fits below the cap and folded tab stays inside its bore', () => {
  const seal = createPeelSeal({ THREE });
  const box = new THREE.Box3().setFromObject(seal.group, true);
  near(box.min.y, 170.3, 2e-5);
  assert.ok(box.max.y < 170.55, `Retail foil extends to Y${box.max.y}`);
  near(box.max.x - box.min.x, 58);
  near(box.max.z - box.min.z, 58);
  for (let l = 0; l <= 8.8; l += .05) for (const z of [-3.8, 0, 3.8]) {
    const folded = sampleFoldedTab(l, z, 0); finite(folded);
    assert.ok(Math.hypot(folded.x, folded.z) < 29.5);
  }
  seal.dispose();
});

test('peeling retains a truly flat bonded region and a smooth circular bend', () => {
  let lastArea = Infinity;
  for (let i = 0; i <= 100; i++) {
    const peel = i / 100, state = samplePeelState(peel);
    assert.ok(state.bondedArea <= lastArea + 1e-7); lastArea = state.bondedArea;
    for (let x = -29; x <= 29; x += .5) {
      const point = samplePeelPoint(x, 2, peel); finite(point);
      near(Math.hypot(point.nx, point.ny, point.nz), 1);
      if (x <= state.front) { near(point.x, x); near(point.y, 170.34); assert.equal(point.bonded, true); }
      else { assert.equal(point.bonded, false); assert.ok(point.y >= 170.34); }
    }
    if (state.front >= -29 && state.front <= 29) {
      const before = samplePeelPoint(state.front - 1e-6, 0, peel);
      const after = samplePeelPoint(state.front + 1e-6, 0, peel);
      assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 3e-6, 'Crack at peel front');
      near(after.nx, before.nx, 1e-6); near(after.ny, before.ny, 1e-6);
    }
  }
  near(samplePeelState(0).bondedFraction, 1);
  near(samplePeelState(1).bondedFraction, 0);
  assert.ok(samplePeelPoint(29, 0, .7).y > 195, 'Released tail does not lift visibly');
});

test('membrane deformation is finite and reproduces exactly after reverse scrubbing', () => {
  const seal = createPeelSeal({ THREE });
  const capture = () => {
    const result = [];
    seal.group.traverse(object => { if (object.geometry) result.push([...object.geometry.attributes.position.array], [...object.geometry.attributes.normal.array]); });
    return { vertices: result, position: seal.group.position.toArray(), visible: seal.group.visible };
  };
  seal.update({ unfold: 1, peel: .53, exit: 0 });
  const reference = capture();
  for (let i = 0; i <= 40; i++) seal.update({ unfold: i / 40, peel: i / 40, exit: i / 40 });
  seal.update({ unfold: 1, peel: .53, exit: 0 });
  assert.deepEqual(capture(), reference);
  for (const array of reference.vertices) for (const number of array) assert.ok(Number.isFinite(number));
  seal.update({ unfold: 1, peel: 1, exit: 1 }); assert.equal(seal.group.visible, false);
  seal.update(); assert.equal(seal.group.visible, true);
  seal.dispose();
});

test('deformed foil updates camera bounds and its skins have outward normals', () => {
  const seal = createPeelSeal({ THREE });
  const flatBox = new THREE.Box3().setFromObject(seal.group);
  seal.update({ unfold: 1, peel: .64 });
  const currentBox = new THREE.Box3().setFromObject(seal.group);
  assert.ok(currentBox.max.y > flatBox.max.y + 25, 'Camera bounds remained at the retail foil height');
  const preciseBox = new THREE.Box3().setFromObject(seal.group, true);
  near(currentBox.min.x, preciseBox.min.x); near(currentBox.max.x, preciseBox.max.x);
  near(currentBox.min.y, preciseBox.min.y); near(currentBox.max.y, preciseBox.max.y);
  const disk = seal.group.getObjectByName('Continuous_peeling_foil_disk').geometry;
  const p = disk.attributes.position, n = disk.attributes.normal, index = disk.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const geometric = new THREE.Vector3(), average = new THREE.Vector3(), temporary = new THREE.Vector3();
  for (const skin of disk.groups.slice(0, 2)) for (let i = skin.start; i < skin.start + skin.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    a.fromBufferAttribute(p, ids[0]); b.fromBufferAttribute(p, ids[1]); c.fromBufferAttribute(p, ids[2]);
    geometric.crossVectors(b.sub(a), c.sub(a));
    if (geometric.lengthSq() < 1e-10) continue;
    geometric.normalize(); average.set(0, 0, 0);
    for (const id of ids) average.add(temporary.fromBufferAttribute(n, id));
    average.normalize();
    assert.ok(geometric.dot(average) > .9, 'A foil skin has inverted face winding or normals');
  }
  seal.dispose();
});

test('external foil departure preserves scene-owned pose and visibility through reverse scrubbing', () => {
  const seal = createPeelSeal({ THREE });
  seal.group.position.set(300, 440, -70); seal.group.rotation.set(.2, 1.1, -.3);
  seal.group.visible = true;
  const quaternion = seal.group.quaternion.toArray();
  for (const exit of [0, .25, 1, .3, 0]) {
    seal.update({ unfold: 1, peel: 1, exit, externalExit: true });
    assert.equal(seal.group.visible, true, 'Effect hid a foil still controlled by the scene');
    assert.deepEqual(seal.group.position.toArray(), [300, 440, -70]);
    assert.deepEqual(seal.group.quaternion.toArray(), quaternion);
  }
  seal.group.visible = false;
  seal.update({ unfold: 1, peel: 1, exit: 0, externalExit: true });
  assert.equal(seal.group.visible, false, 'Repeated effect updates overrode scene visibility');
  seal.reset();
  for (const coordinate of seal.group.position.toArray()) near(coordinate, 0);
  assert.deepEqual(seal.group.quaternion.toArray(), [0, 0, 0, 1]);
  assert.equal(seal.group.visible, true);
  near(seal.getLocalBounds().max.y, 170.48, 2e-5);
  seal.dispose();
});

test('local foil bounds remain precise independently of departing world transforms', () => {
  const seal = createPeelSeal({ THREE });
  seal.update({ unfold: 1, peel: .82, externalExit: true });
  const local = seal.getLocalBounds();
  seal.group.position.set(590, 750, -110); seal.group.rotation.y = 2;
  const departingLocal = seal.getLocalBounds();
  assert.deepEqual([departingLocal.min.toArray(), departingLocal.max.toArray()],
    [local.min.toArray(), local.max.toArray()]);
  for (const mesh of seal.group.children) {
    const position = mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      assert.ok(local.containsPoint(new THREE.Vector3().fromBufferAttribute(position, i)), 'A foil vertex escaped its departure envelope');
    }
  }
  seal.dispose();
});

test('nominal gel cylinder contains exactly 250 ml and proportional drain volume', () => {
  for (const fraction of [0, .12, .5, .88, 1]) {
    const fill = sampleFill(fraction);
    near(Math.PI * 23.2 ** 2 * fill.height / 1000, 250 * fraction);
    near(fill.volumeMilliliters, 250 * fraction); near(fill.surfaceY, 5.3 + fill.height);
  }
  assert.ok(sampleFill(1).surfaceY < 170, '250 ml fill lacks headspace');
});

test('full transmissive fill uses physical-height geometry and unit model scale', () => {
  const gel = createGel({ THREE });
  const body = gel.oldFillGroup.getObjectByName('Measured_250ml_gel_volume');
  assert.deepEqual(body.scale.toArray(), [1, 1, 1]);
  for (const fraction of [1, .88, .55, .12]) {
    gel.update({ fillOld: fraction });
    const bounds = new THREE.Box3().setFromObject(body, true);
    near(body.scale.y, fraction); near(bounds.min.y, 5.3, 2e-5);
    near(bounds.max.y - bounds.min.y, sampleFill(fraction).height, 2e-5);
  }
  gel.dispose();
});

test('grapefruit absorption belongs to the measured liquid volume and disappears with its contents', () => {
  const gel = createGel({ THREE });
  const body = gel.oldFillGroup.getObjectByName('Measured_250ml_gel_volume');
  const surface = gel.oldFillGroup.getObjectByName('Level_gel_free_surface');
  const material = body.material;
  assert.ok(surface.material.color.equals(material.color), 'Free surface and bulk have different liquid tint');
  assert.ok(surface.material.attenuationColor.equals(material.attenuationColor), 'Free surface and bulk have different absorption');
  near(surface.material.transmission, material.transmission);
  assert.equal(material.opacity, 1); assert.ok(material.transmission > .8);
  // Beer-Lambert attenuation should yield a perceptibly coral bulk, rather
  // than applying an opaque tint to the PET wall. Three stores linear RGB.
  const transmitted = ['r', 'g', 'b'].map(channel => Math.pow(material.attenuationColor[channel], material.thickness / material.attenuationDistance));
  assert.ok(transmitted[0] > transmitted[1] && transmitted[1] > transmitted[2]);
  assert.ok(transmitted[0] - transmitted[2] > .5, 'The bulk remains too pale to read separately from bamboo');
  assert.ok(transmitted[1] - transmitted[2] < .12, 'The contents still read yellow/amber rather than grapefruit coral');
  assert.equal(material.color.getHexString(), GEL_APPEARANCE.color.slice(1));
  assert.equal(material.attenuationColor.getHexString(), GEL_APPEARANCE.attenuationColor.slice(1));
  const stream = gel.streamGroup.getObjectByName('World_gravity_viscous_shampoo_stream');
  assert.ok(stream.material.attenuationColor.equals(material.attenuationColor), 'Stream hue differs from the refill contents');
  assert.ok(stream.material.color.equals(material.color), 'The thin strand uses a darker painted tint');
  near(stream.material.attenuationDistance, material.attenuationDistance);
  const strandTransmission = ['r', 'g', 'b'].map(channel => Math.pow(stream.material.attenuationColor[channel], stream.material.thickness / stream.material.attenuationDistance));
  assert.ok(strandTransmission[0] - strandTransmission[2] > .1, 'The strand loses its grapefruit absorption');
  assert.ok(strandTransmission[0] - strandTransmission[2] < transmitted[0] - transmitted[2], 'A thin strand absorbs more light than the thick refill volume');
  gel.update({ fillOld: 0, fillNew: 1 });
  assert.equal(gel.oldFillGroup.visible, false); assert.equal(gel.newFillGroup.visible, true);
  assert.equal(gel.oldFillGroup.userData.fillMilliliters, 0);
  const bounds = new THREE.Box3().setFromObject(gel.newFillGroup, true);
  assert.ok(bounds.max.y < 170 - 10, 'A clear air space must separate gel from the sealed flange');
  gel.dispose();
});

test('scent palettes are immutable and unknown input preserves the approved grapefruit appearance', () => {
  assert.equal(getGelAppearance('  ALOE '), GEL_SCENT_APPEARANCES.aloe);
  for (const input of [undefined, null, '', 'unknown', '__proto__', 'constructor', 12, {}, []]) {
    assert.equal(getGelAppearance(input), GEL_SCENT_APPEARANCES.grapefruit);
  }
  const { scent, ...fallback } = getGelAppearance();
  assert.equal(scent, 'grapefruit'); assert.deepEqual(fallback, GEL_APPEARANCE);
  assert.ok(Object.isFrozen(GEL_SCENT_APPEARANCES));
  for (const appearance of Object.values(GEL_SCENT_APPEARANCES)) assert.ok(Object.isFrozen(appearance));
  assert.throws(() => { GEL_SCENT_APPEARANCES.aloe.color = '#000000'; }, TypeError);
});

test('each scent colours the actual bulk, surface, stream and droplets with coherent translucent absorption', () => {
  const expected = {
    aloe: ['dcf7f0', '62c6b2', 60],
    argan: ['fff0d6', 'e6a244', 60],
    bamboo: ['e1f0e3', '9bc9a4', 80],
  };
  const absorptions = {};
  for (const [scent, [color, attenuation, distance]] of Object.entries(expected)) {
    const gel = createGel({ THREE, scent });
    const materials = new Set();
    for (const group of [gel.oldFillGroup, gel.newFillGroup, gel.streamGroup]) {
      group.traverse(mesh => { if (mesh.isMesh) materials.add(mesh.material); });
    }
    assert.equal(materials.size, 3);
    assert.equal(gel.scent, scent); assert.equal(gel.metrics.appearance.scent, scent);
    for (const material of materials) {
      assert.equal(material.color.getHexString(), color);
      assert.equal(material.attenuationColor.getHexString(), attenuation);
      assert.equal(material.userData.scent, scent);
      near(material.attenuationDistance, distance); near(material.transmission, .94);
      near(material.ior, 1.42); near(material.roughness, .065); near(material.opacity, 1);
    }
    const bulk = gel.oldFillGroup.getObjectByName('Measured_250ml_gel_volume');
    const stream = gel.streamGroup.getObjectByName('World_gravity_viscous_shampoo_stream');
    const absorb = path => ['r', 'g', 'b'].map(channel => Math.pow(bulk.material.attenuationColor[channel], path / distance));
    absorptions[scent] = absorb(46.4);
    // A thinner strand must transmit more light at every wavelength than the
    // full-diameter refill, while retaining the same selected scent spectrum.
    const thin = absorb(stream.material.thickness);
    absorptions[scent].forEach((value, channel) => assert.ok(value < thin[channel] && thin[channel] < 1));
    near(gel.oldFillGroup.userData.fillMilliliters, 250);
    near(Math.PI * 23.2 ** 2 * gel.metrics.fullFillHeight / 1000, 250);
    gel.dispose();
  }
  const [aloeRed, aloeGreen, aloeBlue] = absorptions.aloe;
  assert.ok(aloeGreen > aloeBlue && aloeBlue > aloeRed, 'Aloe must read fresh turquoise-green');
  const [arganRed, arganGreen, arganBlue] = absorptions.argan;
  assert.ok(arganRed > arganGreen && arganGreen > arganBlue, 'Argan must read honey amber');
  const [bambooRed, bambooGreen, bambooBlue] = absorptions.bamboo;
  assert.ok(bambooGreen > bambooBlue && bambooBlue > bambooRed, 'Bamboo must read cool green');
  assert.ok(Math.max(...absorptions.bamboo) - Math.min(...absorptions.bamboo)
    < Math.max(...absorptions.aloe) - Math.min(...absorptions.aloe), 'Bamboo should be paler than Aloe');
});

test('live scent changes retain GPU resources, geometry, shader programs and reversible effect state', () => {
  const gel = createGel({ THREE, scent: 'aloe' });
  const independent = createGel({ THREE, scent: 'bamboo' });
  const state = { progress: .565, flow: 1, gush: .6, fillOld: .31, fillNew: 1,
    outletWorld: [18, 50, -12], outletDirection: [.25, -.97, 0] };
  gel.update(state);
  const meshes = [], materials = new Set();
  for (const group of [gel.oldFillGroup, gel.newFillGroup, gel.streamGroup]) {
    group.traverse(mesh => { if (mesh.isMesh) { meshes.push(mesh); materials.add(mesh.material); } });
  }
  const resources = meshes.map(mesh => ({ mesh, geometry: mesh.geometry, material: mesh.material,
    index: mesh.geometry.index, attributes: { ...mesh.geometry.attributes } }));
  const uniforms = [...materials].map(material => ({ material, color: material.color,
    attenuationColor: material.attenuationColor, version: material.version,
    compile: material.onBeforeCompile, programKey: material.customProgramCacheKey() }));
  const geometryState = () => {
    const hash = createHash('sha256');
    for (const mesh of meshes) {
      for (const attribute of Object.values(mesh.geometry.attributes)) {
        hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
      }
      hash.update(Buffer.from(mesh.geometry.index.array.buffer));
      hash.update(JSON.stringify([mesh.position.toArray(), mesh.quaternion.toArray(), mesh.scale.toArray(), mesh.visible]));
    }
    return hash.digest('hex');
  };
  const before = geometryState(), appearanceReference = gel.metrics.appearance;
  for (const input of ['argan', 'bamboo', 'missing', ' ALOE ']) {
    const appearance = getGelAppearance(input);
    assert.equal(gel.setScent(input), appearance.scent);
    assert.equal(gel.scent, appearance.scent);
    assert.equal(gel.metrics.appearance, appearanceReference);
    assert.deepEqual(gel.metrics.appearance, appearance);
    gel.update(state); // A held scroll position must still recolour immediately.
    assert.equal(geometryState(), before);
    for (const material of materials) {
      assert.equal(material.color.getHexString(), appearance.color.slice(1));
      assert.equal(material.attenuationColor.getHexString(), appearance.attenuationColor.slice(1));
    }
  }
  for (const resource of resources) {
    assert.equal(resource.mesh.geometry, resource.geometry); assert.equal(resource.mesh.material, resource.material);
    assert.equal(resource.geometry.index, resource.index);
    for (const [key, attribute] of Object.entries(resource.attributes)) assert.equal(resource.geometry.attributes[key], attribute);
  }
  for (const uniform of uniforms) {
    assert.equal(uniform.material.color, uniform.color); assert.equal(uniform.material.attenuationColor, uniform.attenuationColor);
    assert.equal(uniform.material.version, uniform.version); assert.equal(uniform.material.onBeforeCompile, uniform.compile);
    assert.equal(uniform.material.customProgramCacheKey(), uniform.programKey);
  }
  assert.equal(independent.scent, 'bamboo');
  assert.equal(independent.oldFillGroup.getObjectByName('Measured_250ml_gel_volume').material.color.getHexString(), 'e1f0e3');
  gel.update({ progress: .9, fillOld: 0 }); gel.update(state);
  assert.equal(geometryState(), before);
  gel.dispose(); independent.dispose();
});

test('optical depth follows the real cylinder chord and finite drained volume', () => {
  const radius = 23.2, height = sampleFill(1).height;
  const point = [radius, height / 2, 0];
  near(sampleGelOpticalPath(point, [-1, 0, 0]), radius * 2);
  for (const angle of [0, .2, .5, .75, 1.1, 1.4]) {
    const ray = [-Math.cos(angle), 0, Math.sin(angle)];
    const distance = sampleGelOpticalPath(point, ray);
    near(distance, radius * 2 * Math.cos(angle));
    const exit = point.map((value, i) => value + ray[i] * distance);
    near(Math.hypot(exit[0], exit[2]), radius);
  }
  for (const fraction of [1, .55, .12, .001]) {
    const path = sampleGelOpticalPath([0, height, 0], [0, -1, 0], { scale: [1, fraction, 1] });
    near(path, sampleFill(fraction).height);
  }
  const clipped = sampleGelOpticalPath([radius, 3, 0], [-Math.SQRT1_2, -Math.SQRT1_2, 0]);
  near(clipped, 3 * Math.SQRT2);
});

test('bulk refraction shader uses actual geometry and retains built-in physical attenuation', () => {
  const gel = createGel({ THREE });
  const material = gel.oldFillGroup.getObjectByName('Measured_250ml_gel_volume').material;
  const shader = { vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /vGelVolumePosition = position/);
  assert.match(shader.fragmentShader, /refract\( -v, normalize\( n \), 1\.0 \/ ior \)/);
  assert.match(shader.fragmentShader, /sideExit/); assert.match(shader.fragmentShader, /axialExit/);
  assert.match(shader.fragmentShader, /volumeAttenuation\( length\( transmissionRay \)/);
  assert.match(shader.fragmentShader, /return ray \* distance/);
  assert.match(shader.fragmentShader, /material\.transmissionAlpha = 1\.0/);
  assert.equal((shader.fragmentShader.match(/vec3 getVolumeTransmissionRay\(/g) || []).length, 1);
  assert.equal(material.userData.optics.timeUniform, false);
  assert.equal(material.userData.resolvedBackgroundCoverage, true);
  assert.notEqual(material.customProgramCacheKey(), new THREE.MeshPhysicalMaterial().customProgramCacheKey());
  gel.dispose();
});

test('the capillary free surface has zero mean displacement and remains inside the PET bore', () => {
  const gel = createGel({ THREE });
  const surface = gel.oldFillGroup.getObjectByName('Level_gel_free_surface');
  for (const state of [ { fraction: 1, progress: 0, flow: 0 }, { fraction: .6, progress: .557, flow: 1, gush: .9 },
    { fraction: .002, progress: .655, flow: .01 }, { fraction: 0, progress: .66, flow: 0 } ]) {
    let mean = 0;
    // Equal-area annuli, rather than uniformly spaced radii, test real volume.
    for (let ring = 0; ring < 512; ring++) for (let j = 0; j < 12; j++) {
      const radius = Math.sqrt((ring + .5) / 512);
      mean += sampleGelSurface(radius, j * Math.PI / 6, state) / (512 * 12);
    }
    near(mean, 0, 1e-6);
    assert.ok(sampleGelSurface(1, 0, state) >= sampleGelSurface(0, 0, state), 'Meniscus should rise toward its wetting wall');
    gel.update({ progress: state.progress, fillOld: state.fraction, flow: state.flow, gush: state.gush });
    const position = surface.geometry.attributes.position, normal = surface.geometry.attributes.normal;
    for (let i = 0; i < position.count; i++) {
      assert.ok(Math.hypot(position.getX(i), position.getZ(i)) <= 23.200002, 'The liquid enters the PET wall');
      assert.ok(Math.abs(position.getY(i)) < .3);
      assert.ok(normal.getY(i) > .99, 'The viscous free surface acquired a harsh ripple');
      near(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)), 1, 2e-6);
    }
    let area = 0, displacedVolume = 0;
    const index = surface.geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      const faceArea = Math.abs((position.getX(b) - position.getX(a)) * (position.getZ(c) - position.getZ(a))
        - (position.getX(c) - position.getX(a)) * (position.getZ(b) - position.getZ(a))) / 2;
      area += faceArea;
      displacedVolume += faceArea * (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    }
    near(displacedVolume / area, 0, 1e-8);
  }
  gel.dispose();
});

test('gel exits its world outlet, follows gravity and expands during the one pressure gush', () => {
  const base = { progress: .55, flow: 1, gush: 0, outletWorld: [17, 121, -25], outletDirection: [.6, -.8, 0] };
  const beginning = sampleGelStream(0, base);
  near(beginning.x, 17); near(beginning.y, 121); near(beginning.z, -25);
  const steady = sampleGelStream(.4, base), gush = sampleGelStream(.4, { ...base, gush: 1 });
  near(gush.radius ** 2 / steady.radius ** 2, 3.2);
  assert.ok(gush.y < steady.y, 'Pressure should extend the stream');
  const end = sampleGelStream(1, base); assert.ok(end.y < beginning.y - 100);
  const yawed = sampleGelStream(1, { ...base, outletDirection: [0, -.8, .6] });
  near(yawed.y, end.y); assert.ok(yawed.y < base.outletWorld[1]);
  for (let i = 0; i <= 1000; i++) {
    const state = { ...base, progress: i / 1000, flow: i / 1000, gush: (i % 17) / 16 };
    finite(sampleGelStream((i % 101) / 100, state));
    for (let drop = 0; drop < 5; drop++) finite(sampleGelDrop(drop, state));
  }
});

test('final droplets remain after the continuous flow stops, then vanish before refill', () => {
  const tail = Array.from({ length: 5 }, (_, index) => sampleGelDrop(index, { progress: .664, flow: 0 }));
  assert.ok(tail.some(drop => drop.visible));
  for (const progress of [0, .4, .67, .75, 1]) for (let index = 0; index < 5; index++) {
    assert.equal(sampleGelDrop(index, { progress, flow: 0 }).visible, false);
  }
});

test('the viscous strand has a closed rounded tail, correct slope normals and an outlet-safe start', () => {
  const gel = createGel({ THREE });
  const mesh = gel.streamGroup.getObjectByName('World_gravity_viscous_shampoo_stream');
  const origin = [13, 114, -7], direction = [.6, -.8, 0];
  const normal = new THREE.Vector3(), across = new THREE.Vector3(), down = new THREE.Vector3();
  const positions = mesh.geometry.attributes.position, normals = mesh.geometry.attributes.normal;
  for (const progress of [.49, .553, .57, .64, .653]) {
    const state = { progress, flow: 1, gush: .8, outletWorld: origin, outletDirection: direction };
    gel.update(state);
    near(sampleGelStream(1, state).radius, 0);
    const start = sampleGelStream(0, state), next = sampleGelStream(.0001, state);
    const nozzleTangent = new THREE.Vector3(next.x - start.x, next.y - start.y, next.z - start.z).normalize();
    assert.ok(nozzleTangent.dot(new THREE.Vector3(...direction)) > .9999);
    assert.ok(start.radius < 3, 'Stream fills or intersects the 6 mm aperture lip');
    const last = positions.count - 15;
    for (let j = 1; j < 15; j++) {
      near(positions.getX(last + j), positions.getX(last));
      near(positions.getY(last + j), positions.getY(last));
      near(positions.getZ(last + j), positions.getZ(last));
    }
    // Compare the shading normal to the real deformed surface derivatives,
    // catching the old radial normals on capillary necks and tapered tips.
    for (let i = 1; i < 72; i++) for (let j = 0; j < 14; j++) {
      const id = i * 15 + j;
      const a = i * 15 + (j + 13) % 14, b = i * 15 + (j + 1) % 14;
      across.set(positions.getX(b) - positions.getX(a), positions.getY(b) - positions.getY(a), positions.getZ(b) - positions.getZ(a));
      down.set(positions.getX(id + 15) - positions.getX(id - 15), positions.getY(id + 15) - positions.getY(id - 15), positions.getZ(id + 15) - positions.getZ(id - 15));
      normal.crossVectors(across, down).normalize();
      assert.ok(normal.dot(new THREE.Vector3().fromBufferAttribute(normals, id)) > .9999);
    }
    for (let i = 0; i < normals.count; i++) near(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)), 1, 2e-6);
  }
  gel.dispose();
});

test('detached droplets stretch without changing their volume and emerge smoothly from the tip', () => {
  const origin = [2, 80, -1], state = { flow: 1, outletWorld: origin, outletDirection: [.6, -.8, 0] };
  for (let i = 0; i <= 1000; i++) for (let index = 0; index < 5; index++) {
    const sample = sampleGelDrop(index, { ...state, progress: .475 + i / 1000 * .195 });
    finite(sample);
    near(sample.radialScale ** 2 * sample.axialScale, 1, 1e-12);
    if (sample.visible) assert.ok(origin[1] - sample.y <= 129.000001, 'A drop escapes the shared camera gravity envelope');
  }
  const beginning = sampleGelDrop(0, { ...state, progress: .65, flow: 0 });
  const next = sampleGelDrop(0, { ...state, progress: .650001, flow: 0 });
  assert.equal(beginning.visible, false); near(beginning.radius, 0);
  assert.ok(next.radius < .00001, 'A final drop pops into existence at full scale');
  assert.ok(Math.hypot(next.x - beginning.x, next.y - beginning.y, next.z - beginning.z) < .01);
});

test('world gel meshes are history independent and hold still without scroll', () => {
  const gel = createGel({ THREE });
  const state = { progress: .57, flow: 1, gush: .7, fillOld: .68, fillNew: 1,
    outletWorld: new THREE.Vector3(1, 51, 3), outletDirection: new THREE.Vector3(.6, -.8, 0) };
  const capture = () => {
    const objects = [];
    for (const group of [gel.streamGroup, gel.oldFillGroup, gel.newFillGroup]) group.traverse(object => {
      objects.push({ name: object.name, visible: object.visible, position: object.position.toArray(), scale: object.scale.toArray(),
        vertices: object.geometry ? createHash('sha256').update(Buffer.from(object.geometry.attributes.position.array.buffer)).digest('hex') : null,
        normals: object.geometry ? createHash('sha256').update(Buffer.from(object.geometry.attributes.normal.array.buffer)).digest('hex') : null });
    });
    return objects;
  };
  gel.update(state); const reference = capture(); gel.update(state); assert.deepEqual(capture(), reference);
  gel.update({ progress: .665, flow: 0, fillOld: 0, fillNew: .5, outletWorld: [10, 100, 20] });
  gel.update(state); assert.deepEqual(capture(), reference);
  gel.update({ progress: 1, flow: 0, fillOld: 1, fillNew: 1 });
  assert.equal(gel.streamGroup.visible, false);
  near(gel.oldFillGroup.userData.fillMilliliters, 250);
  const endpoint = capture(); gel.update(state); gel.update({ progress: 1, flow: 0, fillOld: 1, fillNew: 1 });
  assert.deepEqual(capture(), endpoint);
  gel.dispose();
});
