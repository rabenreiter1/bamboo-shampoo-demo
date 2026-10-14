/** Spatial choreography shared by the viewer and collision/framing checks.
 * Axial moves stay in the product frame; cleared parts use fixed screen lanes.
 * No frame history is used, so backwards scrubbing reconstructs the same pose.
 */
import { easeRange } from './ritual-timeline.js?v=ritual-20261012-4';

export const SPATIAL_LIMITS = Object.freeze({
  capParkLeft: 130, capParkUp: 20, minZoom: .6, exitMarginPixels: 24,
  petMin: [-29, 5, -29], petMax: [29, 170.5, 29],
});

export function createRitualSpace({ THREE }) {
  const direction = new THREE.Vector3(.19, .44, 1).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const v = new THREE.Vector3(), worldOffset = new THREE.Vector3();
  const inverse = new THREE.Matrix4(), projection = new THREE.Matrix4();
  const frustum = new THREE.Frustum();
  const box = new THREE.Box3(), foilBox = new THREE.Box3();
  let frame;

  function capOffset(state) {
    return new THREE.Vector3().addScaledVector(right, -SPATIAL_LIMITS.capParkLeft * state.cap.park)
      .addScaledVector(up, SPATIAL_LIMITS.capParkUp * state.cap.park);
  }

  function fitCamera({ state, camera, product, tiltRig, zoom, region }) {
    const points = [], matrix = new THREE.Matrix4().copy(tiltRig.matrixWorld);
    // Yaw-invariant cylinders: inspection and the automatic two turns never
    // make the camera breathe as different box corners become extrema.
    function cylinder(radius, bottom, top, offset = new THREE.Vector3()) {
      for (const y of [bottom, top]) for (let j = 0; j < 24; j++) {
        const angle = j * Math.PI / 12;
        points.push(new THREE.Vector3(radius * Math.cos(angle), y - 85, radius * Math.sin(angle))
          .applyMatrix4(matrix).add(offset));
      }
    }
    cylinder(29.5, 0, 173.4);
    const axialCap = new THREE.Vector3(0, 1, 0).transformDirection(matrix)
      .multiplyScalar(state.cap.position[1]);
    cylinder(40, 149.9, 173.4, axialCap.add(capOffset(state)));
    const foil = state.framing.foil;
    if (foil > 0) cylinder(29 + 35 * foil, 170, 170 + 64 * foil);
    const pour = easeRange(state.progress, .445, .49) * (1 - easeRange(state.progress, .67, .72));
    if (pour > 0) {
      // A radial envelope of all possible outlet yaw positions, plus gravity.
      const roofCenter = new THREE.Vector3(0, 171 - 85, 0).applyMatrix4(matrix);
      for (const x of [-25, 25]) for (const z of [-25, 25]) {
        points.push(roofCenter.clone().add(new THREE.Vector3(x, -136 * pour, z)));
      }
    }
    const exchange = easeRange(state.progress, .735, .785) * (1 - easeRange(state.progress, .90, .96));
    if (exchange > 0) cylinder(29, 5, 170.5 + 174 * exchange);
    const projected = { right: [Infinity, -Infinity], up: [Infinity, -Infinity], depth: [Infinity, -Infinity] };
    for (const p of points) for (const [key, axis] of [['right', right], ['up', up], ['depth', direction]]) {
      const c = p.dot(axis);
      projected[key][0] = Math.min(projected[key][0], c);
      projected[key][1] = Math.max(projected[key][1], c);
    }
    const center = new THREE.Vector3().addScaledVector(right, (projected.right[0] + projected.right[1]) / 2)
      .addScaledVector(up, (projected.up[0] + projected.up[1]) / 2)
      .addScaledVector(direction, (projected.depth[0] + projected.depth[1]) / 2);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
    let distance = 0;
    const minX = region ? 2 * region.minX - 1 : -1, maxX = region ? 2 * region.maxX - 1 : 1;
    const minY = region ? 1 - 2 * region.maxY : -1, maxY = region ? 1 - 2 * region.minY : 1;
    const aimX = (minX + maxX) / 2, aimY = (minY + maxY) / 2;
    for (const p of points) {
      v.copy(p).sub(center);
      const x=v.dot(right), y=v.dot(up), z=v.dot(direction);
      distance = Math.max(distance, z + y / (tanV * (y >= 0 ? maxY-aimY : minY-aimY)),
        z + x / (tanH * (x >= 0 ? maxX-aimX : minX-aimX)));
    }
    const fittedDistance = Math.max(250, distance * 1.12);
    const viewCenter = center.clone().addScaledVector(right, -aimX*tanH*fittedDistance/zoom)
      .addScaledVector(up, -aimY*tanV*fittedDistance/zoom);
    camera.position.copy(viewCenter).addScaledVector(direction, fittedDistance / zoom);
    camera.up.set(0, 1, 0); camera.lookAt(viewCenter); camera.updateMatrixWorld();
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    const bounds = new THREE.Box3().setFromPoints(points);
    frame = { center: center.toArray(), viewCenter: viewCenter.toArray(), region, distance: fittedDistance, zoom, min: bounds.min.toArray(), max: bounds.max.toArray(),
      cameraPosition: camera.position.toArray() };
    return frame;
  }

  function setOffset(group, localPosition, delta, product) {
    inverse.copy(product.matrixWorld).invert();
    // Convert a world displacement, not a world position, into parent space.
    const localDelta = delta.clone().applyMatrix4(inverse).sub(v.set(0, 0, 0).applyMatrix4(inverse));
    group.position.fromArray(localPosition).add(localDelta);
    group.updateMatrixWorld(true);
  }

  function transformedBox(min, max, matrix, target = box) {
    return target.set(new THREE.Vector3(...min), new THREE.Vector3(...max)).applyMatrix4(matrix);
  }

  function exitDelta(localBounds, worldMatrix, camera, width) {
    // Move every corner past the right frustum plane at the widest permitted
    // inspection zoom. Camera-plane translation does not change view depth.
    const center = new THREE.Vector3(...frame.center);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const distance = frame.distance / SPATIAL_LIMITS.minZoom;
    let displacement = 0;
    for (const x of [localBounds.min.x, localBounds.max.x]) for (const y of [localBounds.min.y, localBounds.max.y]) for (const z of [localBounds.min.z, localBounds.max.z]) {
      v.set(x, y, z).applyMatrix4(worldMatrix).sub(center);
      const depth = distance - v.dot(direction);
      const halfWidth = depth * tanH;
      const margin = 2 * halfWidth * SPATIAL_LIMITS.exitMarginPixels / Math.max(1, width);
      displacement = Math.max(displacement, halfWidth - v.dot(right) + margin);
    }
    return new THREE.Vector3().addScaledVector(right, displacement + 12)
      .addScaledVector(up, (displacement + 12) * .34);
  }

  function placeParts({ state, camera, product, cap, oldRefill, newRefill, oldSeal, width }) {
    setOffset(cap.group, [0, state.cap.position[1], 0], capOffset(state), product);
    const pet = new THREE.Box3(new THREE.Vector3(...SPATIAL_LIMITS.petMin), new THREE.Vector3(...SPATIAL_LIMITS.petMax));
    const observations = {};
    for (const [name, group, pose, amount] of [
      ['oldRefill', oldRefill, state.oldRefill, state.oldRefill.depart],
      ['newRefill', newRefill, state.newRefill, state.newRefill.approach],
    ]) {
      group.position.fromArray(pose.position); group.rotation.set(...pose.rotation); group.updateMatrixWorld(true);
      const travel = exitDelta(pet, group.matrixWorld, camera, width);
      worldOffset.copy(travel).multiplyScalar(amount);
      setOffset(group, pose.position, worldOffset, product);
      const worldBox = transformedBox(SPATIAL_LIMITS.petMin, SPATIAL_LIMITS.petMax, group.matrixWorld);
      const intersects = frustum.intersectsBox(worldBox);
      group.visible = pose.visible && (amount === 0 || intersects);
      observations[name] = { inFrustum: intersects, visible: group.visible, travel: travel.toArray(),
        worldBounds: { min: worldBox.min.toArray(), max: worldBox.max.toArray() } };
    }
    // The spent film belongs to the old insert, which is still seated while
    // peeling. Apply its release externally so it travels toward a safe lane.
    oldSeal.group.position.set(0, 0, 0); oldSeal.group.updateMatrixWorld(true);
    oldSeal.getLocalBounds(foilBox);
    const foilTravel = exitDelta(foilBox, oldSeal.group.matrixWorld, camera, width);
    // Until peeling is complete the bonded region is never translated.
    inverse.copy(oldRefill.matrixWorld).invert();
    worldOffset.copy(foilTravel).multiplyScalar(state.seal.exit);
    oldSeal.group.position.copy(worldOffset).applyMatrix4(inverse).sub(v.set(0, 0, 0).applyMatrix4(inverse));
    oldSeal.group.updateMatrixWorld(true);
    const foilWorld = foilBox.clone().applyMatrix4(oldSeal.group.matrixWorld);
    const foilIntersects = frustum.intersectsBox(foilWorld);
    oldSeal.group.visible = state.seal.visible && (state.seal.exit === 0 || foilIntersects);
    observations.seal = { inFrustum: foilIntersects, visible: oldSeal.group.visible, travel: foilTravel.toArray(),
      worldBounds: { min: foilWorld.min.toArray(), max: foilWorld.max.toArray() } };
    return observations;
  }
  return { fitCamera, placeParts, directions: { right, up, direction }, get frame() { return frame; } };
}
