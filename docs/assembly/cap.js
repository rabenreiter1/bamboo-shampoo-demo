import { CAP_SOURCE } from './cap-data.js?v=tip-20261015-2';

/**
 * Current cap proof. World coordinates are millimetres, Y up; the tether in
 * the user's CAD top view points along +Z. Its planar shapes are recovered
 * from original image pixels, not the incompatible older STL generation.
 *
 * No unsourced replacement lettering or logo. Axial heights of the actuator,
 * tether and dosing-ring remain visual placeholders, recorded in metrics.
 */
export async function createCap({ THREE, mode = 'product' } = {}) {
  if (!THREE?.Group || !THREE?.LatheGeometry) throw new TypeError('createCap requires the supplied THREE namespace.');

  const parts = Object.fromEntries(['cap', 'button', 'ring'].map(name => {
    const group = new THREE.Group();
    group.name = `cap-${name}`;
    group.userData.component = name;
    group.userData.source = 'Current supplied CAD top-view; traced source pixels';
    return [name, group];
  }));
  const materials = {
    cap: new THREE.MeshPhysicalMaterial({ color: '#156b43', roughness: 0.33, metalness: 0.025, clearcoat: 0.2, clearcoatRoughness: 0.36 }),
    button: new THREE.MeshPhysicalMaterial({ color: '#25805a', roughness: 0.31, metalness: 0.025, clearcoat: 0.22, clearcoatRoughness: 0.33 }),
    ring: new THREE.MeshPhysicalMaterial({ color: '#0c4c33', roughness: 0.4, metalness: 0.02, clearcoat: 0.12, clearcoatRoughness: 0.4 }),
    capDetail: new THREE.MeshStandardMaterial({ color: '#0b4e33', roughness: 0.47 }),
    buttonDetail: new THREE.MeshStandardMaterial({ color: '#165b40', roughness: 0.42 }),
  };
  const geometries = new Set();
  const dimensional = {
    upperOuterDiameter: 59, upperBoreDiameter: 58,
    lowerRingOuterDiameter: 58, lowerRingBoreDiameter: 57,
    wallThickness: 0.5, roofThickness: 0.5,
    tubeTop: 170, flangeTop: 170.3,
    roofUnderside: 170.3, roofTop: 170.8,
    lowerSeatBottom: 149.9, lowerSeatTop: 150.6,
  };

  function mesh(geometry, material, name, parent) {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, material);
    result.name = name;
    result.castShadow = true;
    result.receiveShadow = true;
    result.userData.source = name.includes('traced') ? CAP_SOURCE.source.method : 'Confirmed diameters and nominal wall';
    parent.add(result);
    return result;
  }

  function pointInside(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
      if (((yi > point[1]) !== (yj > point[1])) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function writeContour(target, points) {
    // Shape plane (x,-z) becomes world (x,+y,z) after -PI/2 about X.
    target.moveTo(points[0][0], -points[0][1]);
    for (let i = 1; i < points.length; i++) target.lineTo(points[i][0], -points[i][1]);
    target.closePath();
    return target;
  }

  function tracedShapes(contours) {
    const positive = contours.filter(c => c.area > 0);
    const negative = contours.filter(c => c.area < 0);
    const shapes = positive.map(c => ({ contour: c, shape: writeContour(new THREE.Shape(), c.points) }));
    for (const hole of negative) {
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
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth, steps: 1, curveSegments: 32, bevelEnabled: false,
    });
    // Bake millimetre-world orientation into geometry, so all groups stay at
    // identity for independent assembly transforms and glTF export.
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y, 0);
    geometry.computeVertexNormals();
    return mesh(geometry, material, name, parent);
  }

  const d = dimensional;
  const sideProfile = [
    [29, d.lowerSeatBottom], [29, d.lowerSeatTop],
    [29.5, 151], [29.5, d.roofUnderside],
    [29, d.roofUnderside], [29, 151],
    [28.5, d.lowerSeatTop], [28.5, d.lowerSeatBottom],
    [29, d.lowerSeatBottom],
  ];
  mesh(new THREE.LatheGeometry(sideProfile.map(([r, y]) => new THREE.Vector2(r, y)), 256), materials.cap, 'cap-collar-OD59-seat-OD58-wall0.5', parts.cap);

  // Original circular nipple-ring outside, calibrated from the source image.
  // Cap roof has a genuine aperture: the ring and actuator are independent
  // components, not printed on a closed generic cylinder.
  const apertureRadius = 9.93;
  const roof = new THREE.Shape();
  roof.absarc(0, 0, 29.5, 0, Math.PI * 2, false);
  const aperture = new THREE.Path();
  aperture.absarc(0, 0, apertureRadius, 0, Math.PI * 2, true);
  roof.holes.push(aperture);
  const roofGeometry = new THREE.ExtrudeGeometry(roof, { depth: d.roofThickness, steps: 1, curveSegments: 96, bevelEnabled: false });
  roofGeometry.rotateX(-Math.PI / 2);
  roofGeometry.translate(0, d.roofUnderside, 0);
  mesh(roofGeometry, materials.cap, 'cap-annular-roof-thickness0.5', parts.cap);

  // Three source colours are the three physical components. The dark ring,
  // bridges and both closure discs remain one connected independent part.
  const ringTop = 171.55;
  extrudeTrace(CAP_SOURCE.ring, d.roofTop + 0.012, ringTop - d.roofTop - 0.012, materials.ring, 'ring-and-two-discs-traced-original', parts.ring);
  const buttonBase = d.roofTop + 0.014;
  const buttonTop = 173.05;
  extrudeTrace(CAP_SOURCE.button, buttonBase, buttonTop - buttonBase, materials.button, 'teardrop-button-traced-original', parts.button);

  // Source outline art is retained as tiny actual relief geometry. This uses
  // no font reconstruction, no replacement glyph and no hand-drawn logo.
  extrudeTrace(CAP_SOURCE.letters, d.roofTop + 0.014, 0.035, materials.capDetail, 'PRESS-TO-DOSE-traced-original', parts.cap);
  extrudeTrace(CAP_SOURCE.logo, buttonTop + 0.012, 0.035, materials.buttonDetail, 'original-J-sprig-logo-traced-original', parts.button);
  extrudeTrace(CAP_SOURCE.buttonInset, buttonTop + 0.006, 0.014, materials.buttonDetail, 'button-circular-inset-outline-traced-original', parts.button);

  function setPalette(next = 'concept') {
    const cad = next === 'cad';
    materials.cap.color.set(cad ? '#0b8b38' : '#156b43');
    materials.button.color.set(cad ? '#c99732' : '#25805a');
    materials.ring.color.set(cad ? '#414141' : '#0c4c33');
    materials.capDetail.color.set(cad ? '#063e1a' : '#0b4e33');
    materials.buttonDetail.color.set(cad ? '#80571e' : '#165b40');
  }
  setPalette(mode);

  const metrics = {
    ...dimensional,
    dimensions: dimensional,
    source: CAP_SOURCE.source,
    axis: 'Y up; source tether direction +Z; component groups at identity; units mm',
    componentNames: ['outer cap', 'teardrop actuator', 'circular nipple ring with linked two closure discs'],
    exact: ['Upper outside diameter 59 mm', 'Upper bore 58 mm', 'Lower seat outside diameter 58 mm', 'Upper/lower collar radial wall 0.5 mm', 'Roof wall 0.5 mm', 'Current original planar teardrop, linked closure silhouette and original lettering/logo contours'],
    assumptions: [
      'Planar contours are direct 1053×1140 CAD-image pixel traces, calibrated to Ø59; pixel precision is approximately ±0.06 mm, not exact original vector/CAD manufacturing precision.',
      'Lower seating notch position 149.9–150.6 mm is fitted to the source tube raster silhouette (approximately ±0.2 mm).',
      'Collar shoulder transitions at Y150.6–151.0 to fit the measured tube, an undimensioned visual profile; verified radial walls are 0.5 mm on straight upper and lower sections.',
      'PET flange top Y170.3 is a visible assembly placeholder; 0.3 mm PET flange thickness is unconfirmed.',
      'Actuator height 2.236 mm and nipple/closure thickness 0.738 mm are photo-informed visual relief, not dimensioned manufacturing values.',
      'Logo/text relief 0.035 mm and button inset outline relief 0.014 mm preserve supplied outline art; engraving/embossing depth is unconfirmed.',
      'The current internal dosing mechanism, sealing lands, exact roof apertures and undercuts have no complete current production CAD; the review models show visible assembly geometry without inventing a pump mechanism.',
    ],
    oldSTLRejected: { capOutsideDiameter: 65, reason: 'Different historical closure generation: no current teardrop, different tether. Not reused.' },
  };
  parts.cap.userData.metrics = dimensional;
  parts.button.userData.source = CAP_SOURCE.source;
  parts.ring.userData.source = CAP_SOURCE.source;

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const material of Object.values(materials)) material.dispose();
  }
  return { components: parts, metrics, setPalette, dispose };
}
