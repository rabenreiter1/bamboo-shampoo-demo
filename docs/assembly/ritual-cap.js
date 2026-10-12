import { CAP_SOURCE } from './cap-data.js';

const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = value => value * value * (3 - 2 * value);
const smoothRange = (a, b, value) => smooth(clamp01((value - a) / (b - a)));
const quintic = t => t * t * t * (t * (6 * t - 15) + 10);

/** The flange supports the outer annulus. The integral central feature and
 * captive circular support move together; the surrounding silicone bends. */
export function siliconeRoofField(x, z, stroke = 0) {
  const radius = Math.hypot(x, z), t = clamp01((radius - 11) / 12.5);
  const weight = 1 - quintic(t);
  const slope = radius > 11 && radius < 23.5 ? stroke * 30 * t * t * (t - 1) ** 2 / 12.5 : 0;
  return { weight, displacement: -stroke * weight,
    dx: radius ? slope * x / radius : 0, dz: radius ? slope * z / radius : 0 };
}

/**
 * Operative version of the approved closure. All coordinates are mm, Y up.
 * The visible contours are the original traced image, including its artwork.
 * The hidden bearing, outlet and movement clearance are explicitly provisional.
 * update() is a pure pose assignment: it never integrates time or previous poses.
 */
export async function createRitualCap({ THREE } = {}) {
  if (!THREE?.Group || !THREE?.LatheGeometry) throw new TypeError('createRitualCap requires the supplied THREE namespace.');

  const d = {
    upperOuterDiameter: 59, upperBoreDiameter: 58,
    lowerRingOuterDiameter: 58, lowerRingBoreDiameter: 57,
    wallThickness: 0.5, roofThickness: 0.5,
    lowerSeatBottom: 149.9, lowerSeatTop: 150.6,
    tubeTop: 170, flangeTop: 170.3,
    sealedFilmClearance: 0.25,
    roofUnderside: 170.55, roofTop: 171.05,
    ringBottom: 171.062, ringTop: 171.8,
    bearingInnerRadius: 7.74, bearingOuterRadius: 9.77,
    stemRadius: 7.55,
    buttonFaceBottom: 172.45, buttonTop: 173.3,
    buttonStroke: 1.2,
    outletDiameter: 6, outletZ: 19,
    plugDiameter: 5.8, plugBottom: 170.42,
    stopperLift: 1.4,
    minimumSwivelLift: 0.6,
  };

  const group = new THREE.Group();
  group.name = 'complete-operative-cap';
  group.userData.component = 'cap';
  group.userData.units = 'mm';
  const components = Object.fromEntries(['cap', 'ring'].map(name => {
    const part = new THREE.Group();
    part.name = `ritual-cap-${name}`;
    part.userData.component = name;
    part.userData.source = CAP_SOURCE.source;
    group.add(part);
    return [name, part];
  }));
  // Compatibility feature handle, integral to the silicone cap, never a plunger.
  components.button = new THREE.Group();
  components.button.name = 'integral-silicone-teardrop-feature';
  components.button.userData.component = 'cap';
  components.cap.add(components.button);
  const materials = {
    cap: new THREE.MeshPhysicalMaterial({ color: '#156b43', roughness: 0.33, metalness: 0.025, clearcoat: 0.2, clearcoatRoughness: 0.36 }),
    button: new THREE.MeshPhysicalMaterial({ color: '#25805a', roughness: 0.31, metalness: 0.025, clearcoat: 0.22, clearcoatRoughness: 0.33 }),
    ring: new THREE.MeshPhysicalMaterial({ color: '#0c4c33', roughness: 0.4, metalness: 0.02, clearcoat: 0.12, clearcoatRoughness: 0.4 }),
    capDetail: new THREE.MeshStandardMaterial({ color: '#0b4e33', roughness: 0.47 }),
    buttonDetail: new THREE.MeshStandardMaterial({ color: '#165b40', roughness: 0.42 }),
  };
  const geometries = new Set();

  function refineSurface(geometry, edgeLimit = 2) {
    const input = geometry.index ? geometry.toNonIndexed() : geometry;
    const positions = input.getAttribute('position'), normals = input.getAttribute('normal');
    const p = [], n = [], limit2 = edgeLimit ** 2;
    function triangle(vertices, depth = 0) {
      let edge = -1, longest = limit2;
      for (let i = 0; i < 3; i++) {
        const a = vertices[i], b = vertices[(i + 1) % 3];
        const length = (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
        if (length > longest) { longest = length; edge = i; }
      }
      if (edge >= 0 && depth < 16) {
        const a = vertices[edge], b = vertices[(edge + 1) % 3], c = vertices[(edge + 2) % 3];
        const middle = a.map((value, i) => (value + b[i]) / 2);
        triangle([a, middle, c], depth + 1); triangle([middle, b, c], depth + 1);
      } else for (const vertex of vertices) { p.push(...vertex.slice(0,3)); n.push(...vertex.slice(3)); }
    }
    for (let i = 0; i < positions.count; i += 3) {
      triangle([0,1,2].map(j => [positions.getX(i+j), positions.getY(i+j), positions.getZ(i+j), normals.getX(i+j), normals.getY(i+j), normals.getZ(i+j)]));
    }
    const refined = new THREE.BufferGeometry();
    refined.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    refined.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    if (input !== geometry) input.dispose(); geometry.dispose();
    return refined;
  }

  function mesh(geometry, material, name, parent) {
    geometries.add(geometry);
    if (!name.startsWith('cap-collar')) {
      geometries.delete(geometry);
      geometry = refineSurface(geometry);
      geometries.add(geometry);
    }
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData.source = name.includes('traced') ? CAP_SOURCE.source : 'Confirmed collar dimensions; provisional hidden operating clearance';
    parent.add(object);
    return object;
  }

  function pointInside(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, zi] = polygon[i], [xj, zj] = polygon[j];
      if (((zi > point[1]) !== (zj > point[1])) && point[0] < (xj - xi) * (point[1] - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }

  function writeContour(target, points) {
    target.moveTo(points[0][0], -points[0][1]);
    for (let i = 1; i < points.length; i++) target.lineTo(points[i][0], -points[i][1]);
    target.closePath();
    return target;
  }

  function tracedShapes(contours) {
    const shapes = contours.filter(c => c.area > 0).map(contour => ({ contour, shape: writeContour(new THREE.Shape(), contour.points) }));
    for (const hole of contours.filter(c => c.area < 0)) {
      const candidates = shapes.filter(o => pointInside(hole.points[0], o.contour.points));
      if (candidates.length) {
        candidates.sort((a, b) => a.contour.area - b.contour.area);
        candidates[0].shape.holes.push(writeContour(new THREE.Path(), hole.points));
      }
    }
    return shapes.map(({ shape }) => shape);
  }

  function extrudeTrace(contours, y, depth, material, name, parent) {
    const shapes = tracedShapes(contours);
    if (!shapes.length) return null;
    const geometry = new THREE.ExtrudeGeometry(shapes, { depth, steps: 1, curveSegments: 32, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y, 0);
    geometry.computeVertexNormals();
    return mesh(geometry, material, name, parent);
  }

  function annularShape(outer, inner) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return shape;
  }

  function extrudeShape(shape, y, depth, material, name, parent) {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, curveSegments: 96, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y, 0);
    return mesh(geometry, material, name, parent);
  }

  const sideProfile = [
    [29, d.lowerSeatBottom], [29, d.lowerSeatTop],
    [29.5, 151], [29.5, d.roofUnderside],
    [29, d.roofUnderside], [29, 151],
    [28.5, d.lowerSeatTop], [28.5, d.lowerSeatBottom],
    [29, d.lowerSeatBottom],
  ];
  mesh(new THREE.LatheGeometry(sideProfile.map(([r, y]) => new THREE.Vector2(r, y)), 256), materials.cap, 'cap-collar-OD59-seat-OD58-wall0.5', components.cap);

  // The aperture remains hidden beneath the closed source stopper disc.
  // It is a genuine hole through the cap roof, not a painted circle.
  const roof = new THREE.Shape();
  roof.absarc(0, 0, 29.5, 0, Math.PI * 2, false);
  const outletHole = new THREE.Path();
  outletHole.absarc(0, -d.outletZ, d.outletDiameter / 2, 0, Math.PI * 2, true);
  roof.holes.push(outletHole);
  extrudeShape(roof, d.roofUnderside, d.roofThickness, materials.cap, 'cap-roof-with-open-dosing-aperture', components.cap);
  extrudeTrace(CAP_SOURCE.letters, d.roofTop + 0.014, 0.035, materials.capDetail, 'PRESS-TO-DOSE-traced-original', components.cap);

  // The circular bearing surrounds an integral molded silicone boss. Its
  // underside clears the continuous roof instead of sitting in a roof hole.
  extrudeShape(annularShape(d.bearingOuterRadius, d.bearingInnerRadius), d.roofTop + 0.012, 0.13, materials.ring, 'hidden-circular-captive-bearing', components.ring);
  const ring = extrudeTrace(CAP_SOURCE.ring, d.ringBottom, d.ringTop - d.ringBottom, materials.ring, 'ring-and-two-discs-traced-original', components.ring);
  const ringPosition = ring.geometry.getAttribute('position');
  ringPosition.setUsage(THREE.DynamicDrawUsage);
  const ringRest = Float32Array.from(ringPosition.array);
  const liftWeights = new Float32Array(ringPosition.count);
  const liftGradients = new Float32Array(ringPosition.count);
  for (let i = 0; i < liftWeights.length; i++) {
    // Only the short bridge flexes. Both linked discs lift together, while
    // every point of the circular bearing stays at its original height.
    liftWeights[i] = smoothRange(10.05, 14.0, ringRest[i * 3 + 2]);
    const t = clamp01((ringRest[i * 3 + 2] - 10.05) / 3.95);
    liftGradients[i] = t > 0 && t < 1 ? 6 * t * (1 - t) / 3.95 : 0;
  }

  const stopper = new THREE.Group();
  stopper.name = 'outlet-stopper-underside-plug';
  components.ring.add(stopper);
  const plugHeight = d.ringBottom - d.plugBottom;
  const plugGeometry = new THREE.CylinderGeometry(d.plugDiameter / 2, d.plugDiameter / 2, plugHeight, 64);
  plugGeometry.translate(0, d.plugBottom + plugHeight / 2, d.outletZ);
  mesh(plugGeometry, materials.ring, 'shallow-nipple-plug-provisional-D5.8', stopper);

  const stemHeight = d.buttonFaceBottom - d.roofUnderside;
  const stemGeometry = new THREE.CylinderGeometry(d.stemRadius, d.stemRadius, stemHeight, 96);
  stemGeometry.translate(0, d.roofUnderside + stemHeight / 2, 0);
  mesh(stemGeometry, materials.button, 'integral-molded-silicone-pedestal', components.button);
  extrudeTrace(CAP_SOURCE.button, d.buttonFaceBottom, d.buttonTop - d.buttonFaceBottom, materials.button, 'teardrop-button-traced-original', components.button);
  extrudeTrace(CAP_SOURCE.logo, d.buttonTop + 0.012, 0.035, materials.buttonDetail, 'original-J-sprig-logo-traced-original', components.button);
  extrudeTrace(CAP_SOURCE.buttonInset, d.buttonTop + 0.006, 0.014, materials.buttonDetail, 'button-circular-inset-outline-traced-original', components.button);

  const outlet = new THREE.Object3D();
  outlet.name = 'dosing-outlet-world-anchor';
  outlet.position.set(0, d.roofTop + 0.004, d.outletZ);
  outlet.userData.localNormal = [0, 1, 0];
  outlet.userData.diameter = d.outletDiameter;
  components.cap.add(outlet);

  const siliconeSurfaces = [];
  function conservativeBounds(geometry, down = 0, up = 0) {
    geometry.computeBoundingBox();
    geometry.boundingBox.min.y -= down; geometry.boundingBox.max.y += up;
    geometry.boundingSphere = new THREE.Sphere();
    geometry.boundingBox.getBoundingSphere(geometry.boundingSphere);
    return { box: geometry.boundingBox.clone(), sphere: geometry.boundingSphere.clone() };
  }
  components.cap.traverse(object => {
    if (!object.isMesh || object.name.startsWith('cap-collar')) return;
    const position = object.geometry.getAttribute('position'), normal = object.geometry.getAttribute('normal');
    position.setUsage(THREE.DynamicDrawUsage); normal.setUsage(THREE.DynamicDrawUsage);
    const rest = Float32Array.from(position.array), restNormals = Float32Array.from(normal.array);
    const weight = new Float64Array(position.count), normalDX = new Float64Array(position.count), normalDZ = new Float64Array(position.count);
    const normalizedRest = Float32Array.from(restNormals), varyingNormals = [];
    for (let i = 0; i < position.count; i++) {
      const at = i * 3, field = siliconeRoofField(rest[at], rest[at+2], 1);
      weight[i] = field.weight;
      normalDX[i] = restNormals[at+1] * field.dx; normalDZ[i] = restNormals[at+1] * field.dz;
      if (normalDX[i] || normalDZ[i]) varyingNormals.push(i);
      const length = Math.sqrt(restNormals[at]**2 + restNormals[at+1]**2 + restNormals[at+2]**2) || 1;
      for (let j = 0; j < 3; j++) normalizedRest[at+j] = restNormals[at+j]/length;
    }
    const bounds = conservativeBounds(object.geometry, d.buttonStroke);
    siliconeSurfaces.push({ object, position, normal, rest, restNormals, weight, normalDX, normalDZ, normalizedRest, varyingNormals, bounds });
  });
  const ringNormals = ring.geometry.getAttribute('normal');
  const ringRestNormals = Float32Array.from(ringNormals.array);
  ringNormals.setUsage(THREE.DynamicDrawUsage);
  // Bridge displacement is bounded by nipple lift plus central-to-outlet
  // differential. Group translation handles the central stroke separately.
  const ringBounds = conservativeBounds(ring.geometry, 0, d.stopperLift + d.buttonStroke);
  let lastLift = -1, lastStroke = -1, disposed = false;
  function update({ lift = 0, swivel = 0, press = 0 } = {}) {
    const appliedLift = clamp01(lift);
    const requestedSwivel = Number.isFinite(swivel) ? swivel : 0;
    // Illegal input cannot sweep an engaged nipple sideways through the roof.
    // The authored timeline lifts completely before beginning its swivel.
    const swivelFreedom = smoothRange(d.minimumSwivelLift, 0.85, appliedLift);
    const appliedSwivel = requestedSwivel * swivelFreedom;
    components.ring.rotation.y = appliedSwivel;
    const appliedPress = appliedLift >= 0.999 ? clamp01(press) : 0;
    const stroke = d.buttonStroke * appliedPress;
    const outletField = siliconeRoofField(0, d.outletZ, stroke);
    // The circular support follows the center; the flex bridge allows the
    // linked discs to follow their local roof instead of pushing into it.
    const bridgeMotion = d.stopperLift * appliedLift + stroke + outletField.displacement;
    components.ring.position.y = -stroke;
    stopper.position.y = bridgeMotion;
    if (stroke !== lastStroke) {
      for (const surface of siliconeSurfaces) {
        const positions = surface.position.array, normals = surface.normal.array;
        for (let i = 0; i < surface.position.count; i++) positions[i*3+1] = surface.rest[i*3+1] - stroke * surface.weight[i];
        if (!stroke) normals.set(surface.restNormals);
        else {
          if (lastStroke <= 0) normals.set(surface.normalizedRest);
          for (const i of surface.varyingNormals) {
            const at = i * 3;
            const nx = surface.restNormals[at] - stroke * surface.normalDX[i];
            const ny = surface.restNormals[at+1];
            const nz = surface.restNormals[at+2] - stroke * surface.normalDZ[i];
            const inverseLength = 1 / (Math.sqrt(nx*nx + ny*ny + nz*nz) || 1);
            normals[at] = nx*inverseLength; normals[at+1] = ny*inverseLength; normals[at+2] = nz*inverseLength;
          }
        }
        surface.position.needsUpdate = true; surface.normal.needsUpdate = true;
        surface.object.geometry.boundingBox.copy(surface.bounds.box);
        surface.object.geometry.boundingSphere.copy(surface.bounds.sphere);
      }
      outlet.position.y = d.roofTop + 0.004 + outletField.displacement;
      const normal = new THREE.Vector3(-outletField.dx, 1, -outletField.dz).normalize();
      outlet.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), normal);
      outlet.userData.localNormal = normal.toArray();
    }
    if (appliedLift !== lastLift || stroke !== lastStroke) {
      const positions = ringPosition.array, normals = ringNormals.array;
      for (let i = 0; i < ringPosition.count; i++) {
        const at = i * 3;
        positions[at+1] = ringRest[at+1] + bridgeMotion * liftWeights[i];
        if (!bridgeMotion) {
          normals[at] = ringRestNormals[at]; normals[at+1] = ringRestNormals[at+1]; normals[at+2] = ringRestNormals[at+2];
        } else {
          const nx = ringRestNormals[at], ny = ringRestNormals[at+1];
          const nz = ringRestNormals[at+2] - ny * bridgeMotion * liftGradients[i];
          const inverseLength = 1 / (Math.sqrt(nx*nx + ny*ny + nz*nz) || 1);
          normals[at] = nx*inverseLength; normals[at+1] = ny*inverseLength; normals[at+2] = nz*inverseLength;
        }
      }
      ringPosition.needsUpdate = true;
      ringNormals.needsUpdate = true;
      ring.geometry.boundingBox.copy(ringBounds.box);
      ring.geometry.boundingSphere.copy(ringBounds.sphere);
      lastLift = appliedLift;
    }
    lastStroke = stroke;
    group.userData.operation = {
      lift: appliedLift, swivel: appliedSwivel, press: appliedPress,
      nippleEngaged: appliedLift < d.minimumSwivelLift,
      nippleBottomY: d.plugBottom + d.stopperLift * appliedLift + outletField.displacement,
      outletCovered: appliedLift < d.minimumSwivelLift && Math.abs(appliedSwivel) < 0.001,
    };
    return group.userData.operation;
  }
  update();

  const metrics = {
    ...d, dimensions: d, source: CAP_SOURCE.source,
    axis: 'Millimetres; Y up; source linked discs toward +Z; complete group at identity',
    componentNames: ['integral silicone cap with molded teardrop feature', 'circular captive bearing with flex bridge and linked closure discs'],
    exact: [
      'Upper outside diameter 59 mm, upper bore 58 mm, collar radial wall 0.5 mm',
      'Lower seat outside diameter 58 mm and bore 57 mm',
      'Original source teardrop, linked disc contours, lettering and original logo',
    ],
    assumptions: [
      'Original planar contours are current CAD-image pixel traces calibrated to diameter 59 mm, approximately 0.06 mm pixel precision.',
      'Roof underside is 0.25 mm above the placeholder PET flange top to clear the closed film and folded tab; roof thickness 0.5 mm.',
      'Lower notch seat Y149.9–150.6 and shoulder Y150.6–151.0 are fitted to the actual tube raster contour, approximately 0.2 mm precision.',
      'Outlet diameter 6 mm, shallow plug diameter 5.8 mm, circular bearing bore radius 7.74 mm and stem radius 7.55 mm are hidden visual construction assumptions.',
      'The integral teardrop retains the source footprint; its unmeasured lower face is Y172.45. The roof and feature share an analytic 1.2 mm center deformation, constant through R11, quintic to zero at the supported R23.5 annulus.',
      'The short closure bridge flexes to lift the stopper 1.4 mm and follows its local deformed roof while the circular carrier follows the center; no exposed pump internals are inferred.',
      'Nipple lift, silicone deflection, bearing axial depths, embossing heights and all internal sealing surfaces require current production CAD before manufacture.',
    ],
    closedSilhouette: { button: 'CAP_SOURCE.button unmodified', ring: 'CAP_SOURCE.ring unmodified', artwork: 'CAP_SOURCE.letters/logo/buttonInset unmodified' },
    clearances: {
      buttonAtFullPressAboveRing: d.buttonFaceBottom - d.ringTop,
      circularBearingRadial: d.bearingInnerRadius - d.stemRadius,
      nippleAtSwivelStartAboveRoof: d.plugBottom + d.stopperLift * d.minimumSwivelLift - d.roofTop,
    },
  };
  group.userData.metrics = metrics;

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const material of Object.values(materials)) material.dispose();
  }
  return { group, components, outlet, update, metrics, dispose };
}
