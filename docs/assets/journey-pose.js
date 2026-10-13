import { computeCycleState, clamp, easeRange } from '../assembly/ritual-timeline.js?v=ritual-20261012-4';

// These are chapters in one native-scroll story, not autoplay timings. Every
// component pose can be reconstructed directly from q in either direction.
export const JOURNEY_PHASES = Object.freeze([
  { id: 'closed', start: 0, end: .06 },
  { id: 'uncap', start: .06, end: .15 },
  { id: 'unseal', start: .15, end: .27 },
  { id: 'recap', start: .27, end: .35 },
  { id: 'dose', start: .35, end: .72 },
  { id: 'remove', start: .72, end: .83 },
  { id: 'refill', start: .83, end: .96 },
  { id: 'ready', start: .96, end: 1 },
].map(Object.freeze));

export const JOURNEY_CLEARANCES = Object.freeze({
  capAxialLift: 44, capScreenLeft: 130, capScreenUp: 20,
  insertAxialLift: 174,
});

/** The shop follows the approved opening/use/refill cycle from its first frame. */
export function computeJourneyPose(value) {
  const q = clamp(Number.isFinite(value) ? value : 0);
  const chapter = JOURNEY_PHASES.findLast(item => q >= item.start);
  // One continuous 720-degree rotation spans the complete shop story. The
  // approved operating choreography does not depend on the inspection yaw.
  const state = computeCycleState(q);
  return { q, phase: chapter.id,
    phaseProgress: clamp((q - chapter.start) / (chapter.end - chapter.start)),
    ritualProgress: q, state,
    roll: .10 * (1 - easeRange(q, 0, .06)) + .10 * easeRange(q, .96, 1),
  };
}

const collarWeight = y => clamp((151 - y) / .4);

/**
 * The confirmed Ø57 seat has to pass a Ø58 lip. Silicone therefore stretches
 * briefly during removal/insertion. This visual flex is derived from the real
 * tube silhouette and PET flange; the seated geometry is exactly untouched.
 */
export function collarExpansionForLift(value, shellRadiusAt) {
  const lift = Number.isFinite(value) ? value : 0;
  if (lift <= 0 || lift > 21) return 0;
  let expansion = 0;
  const ys = [];
  for (let i = 0; i <= 110; i++) ys.push(149.9 + i / 100);
  for (const worldY of [170, 170.3]) if (worldY - lift >= 149.9 && worldY - lift <= 151) ys.push(worldY - lift);
  for (const y of ys) {
    const weight = collarWeight(y);
    if (weight <= 1e-6) continue;
    const inner = 29 - .5 * weight, worldY = y + lift;
    let required = worldY <= 170 ? shellRadiusAt(worldY) : 0;
    if (worldY >= 170 && worldY <= 170.3) required = Math.max(required, 29);
    const interference = Math.max(0, required - inner);
    if (interference > 0) {
      const clearance = .04 * easeRange(interference / weight, 0, .04);
      expansion = Math.max(expansion, interference / weight + clearance);
    }
  }
  return Math.min(.54, expansion);
}

export function createJourneyCollarFlex({ cap, shellRadiusAt }) {
  const mesh = cap.components.cap.children.find(part => part.name.startsWith('cap-collar'));
  if (!mesh?.geometry?.attributes.position || typeof shellRadiusAt !== 'function') throw new TypeError('Collar flex requires the actual cap and measured tube profile.');
  const geometry = mesh.geometry, positions = geometry.attributes.position, normals = geometry.attributes.normal;
  const rest = Float32Array.from(positions.array), restNormals = Float32Array.from(normals.array);
  const weights = new Float32Array(positions.count);
  for (let i = 0; i < positions.count; i++) weights[i] = collarWeight(rest[i * 3 + 1]);
  let applied = -1;
  function update(lift) {
    const expansion = collarExpansionForLift(lift, shellRadiusAt);
    if (expansion === applied) return expansion;
    for (let i = 0; i < positions.count; i++) {
      const at = i * 3, x = rest[at], z = rest[at + 2], r = Math.hypot(x, z);
      const scale = r ? 1 + expansion * weights[i] / r : 1;
      positions.array[at] = x * scale; positions.array[at + 2] = z * scale;
    }
    if (expansion) geometry.computeVertexNormals();
    else normals.array.set(restNormals);
    positions.needsUpdate = true; normals.needsUpdate = true;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    applied = expansion;
    cap.group.userData.collarExpansion = expansion;
    return expansion;
  }
  update(0);
  return { update, get expansion() { return applied; }, maximumRadialExpansion: .54 };
}

/**
 * The cap uses a screen-aligned lane after full axial clearance. Parts do
 * not orbit through neighbouring parts when the customer inspects the axis.
 * The reserved camera region leaves captions alongside/below the real model;
 * the canvas still paints the entire stage with one coherent background.
 */
export function createJourneySpace({ THREE }) {
  const direction = new THREE.Vector3(.19, .44, 1).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const point = new THREE.Vector3(), inverse = new THREE.Matrix4();
  const projection = new THREE.Matrix4(), frustum = new THREE.Frustum();
  const offset = new THREE.Vector3(), filmBounds = new THREE.Box3();
  const center = new THREE.Vector3(), wideCenter = new THREE.Vector3();
  let frame;

  function cameraRegion(width, height, copyHeight = width <= 760 ? 156 : 132, footerHeight = 0, stageHeight = height) {
    // A quiet caption lives below the product in the dedicated studio chapter.
    // Only short landscape screens put it alongside the model.
    const beside = height <= 560 && width > height;
    return beside ? { minX: .36, maxX: .97, minY: .10, maxY: .93, layout: 'beside' }
      : { minX: width <= 760 ? .035 : .105, maxX: width <= 760 ? .965 : .895, minY: .075,
        maxY: Math.max(.22, Math.min(.82, (stageHeight - copyHeight - footerHeight - 32) / Math.max(1, stageHeight))), layout: 'studio' };
  }

  function componentOffset(pose, name, target = new THREE.Vector3()) {
    const { state } = pose;
    target.set(0, 0, 0);
    if (name === 'cap') {
      target.addScaledVector(right, -JOURNEY_CLEARANCES.capScreenLeft * state.cap.park)
        .addScaledVector(up, JOURNEY_CLEARANCES.capScreenUp * state.cap.park);
    }
    return target;
  }

  function fitCamera({ pose, camera, tiltRig, zoom = 1, width, height, copyHeight, footerHeight, layoutWidth = width, layoutHeight = height }) {
    const state = pose.state, matrix = tiltRig.matrixWorld;
    const points = [];
    const limits = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
    const axes = [right, up, direction];
    function cylinder(radius, bottom, top, delta = null) {
      for (const y of [bottom, top]) for (let j = 0; j < 24; j++) {
        const angle = j * Math.PI / 12;
        const p = new THREE.Vector3(radius * Math.cos(angle), y - 85, radius * Math.sin(angle)).applyMatrix4(matrix);
        if (delta) p.add(delta);
        points.push(p);
      }
    }
    cylinder(29.5, 0, 173.4);
    offset.set(0, 1, 0).transformDirection(matrix).multiplyScalar(state.cap.position[1]);
    offset.add(componentOffset(pose, 'cap'));
    cylinder(40, 149.9, 173.4, offset);
    const foil = state.framing.foil;
    if (foil > 0) cylinder(29 + 35 * foil, 170, 170 + 64 * foil);
    const pour = easeRange(state.progress, .445, .49) * (1 - easeRange(state.progress, .67, .72));
    if (pour > 0) {
      const roofCenter = new THREE.Vector3(0, 171 - 85, 0).applyMatrix4(matrix);
      for (const x of [-25, 25]) for (const z of [-25, 25]) points.push(roofCenter.clone().add(new THREE.Vector3(x, -136 * pour, z)));
    }
    const exchange = easeRange(state.progress, .735, .785) * (1 - easeRange(state.progress, .90, .96));
    if (exchange > 0) cylinder(29, 5, 170.5 + JOURNEY_CLEARANCES.insertAxialLift * exchange);
    for (const p of points) for (let j = 0; j < 3; j++) {
      const value = p.dot(axes[j]);
      limits[j][0] = Math.min(limits[j][0], value); limits[j][1] = Math.max(limits[j][1], value);
    }
    center.set(0, 0, 0);
    for (let j = 0; j < 3; j++) center.addScaledVector(axes[j], (limits[j][0] + limits[j][1]) / 2);
    const region = cameraRegion(layoutWidth, layoutHeight, copyHeight, footerHeight, height);
    const minX = 2 * region.minX - 1, maxX = 2 * region.maxX - 1;
    const minY = 1 - 2 * region.maxY, maxY = 1 - 2 * region.minY;
    const aimX = (minX + maxX) / 2, aimY = (minY + maxY) / 2;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
    let distance = 0;
    for (const p of points) {
      point.copy(p).sub(center);
      const x = point.dot(right), y = point.dot(up), z = point.dot(direction);
      distance = Math.max(distance,
        (x + maxX * tanH * z) / ((maxX - aimX) * tanH),
        (x + minX * tanH * z) / ((minX - aimX) * tanH),
        (y + maxY * tanV * z) / ((maxY - aimY) * tanV),
        (y + minY * tanV * z) / ((minY - aimY) * tanV));
    }
    const fittedDistance = Math.max(250, distance * 1.08), visibleDistance = fittedDistance / zoom;
    const viewCenter = center.clone().addScaledVector(right, -aimX * tanH * visibleDistance)
      .addScaledVector(up, -aimY * tanV * visibleDistance);
    camera.position.copy(viewCenter).addScaledVector(direction, visibleDistance);
    camera.up.set(0, 1, 0); camera.lookAt(viewCenter); camera.updateMatrixWorld();
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projection);
    wideCenter.copy(center).addScaledVector(right, -aimX * tanH * fittedDistance / .6)
      .addScaledVector(up, -aimY * tanV * fittedDistance / .6);
    frame = { center: center.toArray(), viewCenter: viewCenter.toArray(), distance: fittedDistance, zoom,
      cameraPosition: camera.position.toArray(), region, min: new THREE.Box3().setFromPoints(points).min.toArray(),
      max: new THREE.Box3().setFromPoints(points).max.toArray() };
    return frame;
  }

  function setOffset(group, position, worldDelta, parent) {
    inverse.copy(parent.matrixWorld).invert();
    const localDelta = worldDelta.clone().applyMatrix4(inverse).sub(point.set(0, 0, 0).applyMatrix4(inverse));
    group.position.fromArray(position).add(localDelta); group.updateMatrixWorld(true);
  }

  function exitDelta(bounds, matrix, camera, width) {
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const distance = frame.distance / .6;
    let travel = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      point.set(x, y, z).applyMatrix4(matrix).sub(wideCenter);
      const depth = distance - point.dot(direction), halfWidth = depth * tanH;
      const margin = 2 * halfWidth * 24 / Math.max(1, width);
      travel = Math.max(travel, halfWidth - point.dot(right) + margin);
    }
    return new THREE.Vector3().addScaledVector(right, travel + 12).addScaledVector(up, (travel + 12) * .34);
  }

  function placeParts({ pose, camera, product, cap, oldRefill, newRefill, oldSeal, width }) {
    const state = pose.state;
    setOffset(cap.group, [0, state.cap.position[1], 0], componentOffset(pose, 'cap'), product);
    const pet = new THREE.Box3(new THREE.Vector3(-29, 5, -29), new THREE.Vector3(29, 170.5, 29));
    const observations = {};
    for (const [name, group, part, amount] of [
      ['oldRefill', oldRefill, state.oldRefill, state.oldRefill.depart],
      ['newRefill', newRefill, state.newRefill, state.newRefill.approach],
    ]) {
      group.position.fromArray(part.position); group.rotation.set(...part.rotation); group.updateMatrixWorld(true);
      const travel = exitDelta(pet, group.matrixWorld, camera, width);
      offset.copy(travel).multiplyScalar(amount);
      setOffset(group, part.position, offset, product);
      const worldBounds = pet.clone().applyMatrix4(group.matrixWorld), intersects = frustum.intersectsBox(worldBounds);
      group.visible = part.visible && (amount === 0 || intersects);
      observations[name] = { inFrustum: intersects, visible: group.visible, travel: travel.toArray(),
        worldBounds: { min: worldBounds.min.toArray(), max: worldBounds.max.toArray() } };
    }
    oldSeal.group.position.set(0, 0, 0); oldSeal.group.updateMatrixWorld(true); oldSeal.getLocalBounds(filmBounds);
    const filmTravel = exitDelta(filmBounds, oldSeal.group.matrixWorld, camera, width);
    setOffset(oldSeal.group, [0, 0, 0], filmTravel.multiplyScalar(state.seal.exit), oldRefill);
    const worldFilm = filmBounds.clone().applyMatrix4(oldSeal.group.matrixWorld), intersects = frustum.intersectsBox(worldFilm);
    oldSeal.group.visible = state.seal.visible && (state.seal.exit === 0 || intersects);
    observations.seal = { inFrustum: intersects, visible: oldSeal.group.visible,
      worldBounds: { min: worldFilm.min.toArray(), max: worldFilm.max.toArray() } };
    return observations;
  }

  function anchors({ pose, camera, product, cap, oldRefill, newRefill, oldSeal, newSeal }) {
    const refill = newRefill.visible ? newRefill : oldRefill;
    const seal = newRefill.visible ? newSeal : oldSeal;
    function project(group, x, y, z, visible = true) {
      point.set(x, y, z).applyMatrix4(group.matrixWorld).project(camera);
      return { x: clamp((point.x + 1) / 2), y: clamp((1 - point.y) / 2),
        visible: visible && point.z >= -1 && point.z <= 1 && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 };
    }
    return {
      shell: project(product, 0, 88, 29, product.children[0].visible),
      insert: project(refill, 0, 93, 23.5, refill.visible && (pose.state.framing.oldRefill || pose.state.framing.newRefill)),
      cap: project(cap.group, 0, 171.8, 0, cap.group.visible),
      film: project(seal.group, 0, 170.4, 0, refill.visible && seal.group.visible && pose.state.cap.park > .05),
      outlet: project(cap.outlet, 0, 0, 0, cap.group.visible && pose.state.cap.lift > .95),
    };
  }
  return { fitCamera, placeParts, anchors, directions: { right, up, direction }, get frame() { return frame; } };
}
