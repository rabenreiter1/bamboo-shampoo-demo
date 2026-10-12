/**
 * A dimension-independent assembly timeline. Geometry stays in millimetres;
 * only rigid transforms change. Every state can be reached in either direction.
 */
export const CHAPTERS = Object.freeze([
  { id: 'object', at: 0, number: '01', de: { label: 'Das Objekt', title: 'Natur.\nNeu gedacht.', copy: 'Eine Hülle aus Bambus. Ein austauschbares Inlay. Ein Verschluss, der bleibt.' }, en: { label: 'The object', title: 'Nature.\nReassembled.', copy: 'A bamboo shell. An interchangeable inlay. A closure made to stay.' } },
  { id: 'parts', at: 0.24, number: '02', de: { label: 'Die Bauteile', title: 'Sechs Teile.\nEin System.', copy: 'Bambus, PET, Siegelfolie, Kappe, Dosierknopf und Nippelring — jedes Bauteil ist ein eigenes 3D-Modell.' }, en: { label: 'The components', title: 'Six parts.\nOne system.', copy: 'Bamboo, PET, sealing film, cap, dosing button and nipple ring — every component is a separate 3D model.' } },
  { id: 'inlay', at: 0.43, number: '03', de: { label: 'Das Inlay', title: 'Einsetzen.\nPassgenau.', copy: 'Ø47 × 165 mm. Der Kranz mit Ø58 mm und 5,5 mm Breite liegt oben auf dem Bambusrand auf.' }, en: { label: 'The inlay', title: 'Insert.\nPrecisely.', copy: 'Ø47 × 165 mm. The Ø58 mm flange, 5.5 mm wide, rests on the top edge of the bamboo.' } },
  { id: 'seal', at: 0.58, number: '04', de: { label: 'Die Siegelfolie', title: 'Abziehen.\nDann verschließen.', copy: 'Die Folie wird vor dem Aufsetzen der Kappe entfernt. Das Inlay bleibt im Tubus.' }, en: { label: 'The sealing film', title: 'Peel away.\nThen close.', copy: 'Remove the film before fitting the cap. The inlay stays inside the shell.' } },
  { id: 'closure', at: 0.75, number: '05', de: { label: 'Der Verschluss', title: 'Drei Bauteile.\nEine Verbindung.', copy: 'Der tropfenförmige Knopf sitzt im kreisrunden Nippelring. Die Kappe schließt am Tubus an.' }, en: { label: 'The closure', title: 'Three components.\nOne connection.', copy: 'The teardrop button sits in the circular nipple ring. The cap seats against the bamboo shell.' } },
  { id: 'assembled', at: 1, number: '06', de: { label: 'Die Produktprüfung', title: 'Bereit für\ndeinen Blick.', copy: 'Prüfe Kontur, Gravur und Verschluss. Die Originalgravur ist unverändert; die Nennfüllmenge bleibt 250 ml.' }, en: { label: 'The product review', title: 'Ready for\na closer look.', copy: 'Review the shape, engraving and closure. The original engraving is unchanged; the nominal fill remains 250 ml.' } },
]);

export const COMPONENT_IDS = Object.freeze(['shell', 'inlay', 'seal', 'cap', 'ring', 'button']);
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : 0));
const smooth = (value) => value * value * (3 - 2 * value);
const mix = (a, b, t) => a + (b - a) * t;
const pose = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => ({ position: [x, y, z], rotation: [rx, ry, rz] });

// The opening reveal is the use-ready product. A new factory-sealed refill is
// revealed after the cap clears the opening, then unsealed before cap seating.
// Axial construction dimensions belong exclusively to models.
const KEYFRAMES = Object.freeze([
  { p: 0, poses: { shell: pose(), inlay: pose(), seal: pose(), cap: pose(), ring: pose(), button: pose() }, cameraElevation: 0.34 },
  { p: 0.075, poses: { shell: pose(), inlay: pose(), seal: pose(), cap: pose(), ring: pose(), button: pose() }, cameraElevation: 0.34 },
  { p: 0.105, poses: { shell: pose(), inlay: pose(), seal: pose(), cap: pose(0, 40, 0), ring: pose(0, 40, 0), button: pose(0, 40, 0) }, cameraElevation: 0.37 },
  { p: 0.135, poses: { shell: pose(), inlay: pose(), seal: pose(), cap: pose(-63, 112, -10), ring: pose(-63, 112, -10), button: pose(-63, 112, -10) }, cameraElevation: 0.4 },
  { p: 0.18, poses: { shell: pose(), inlay: pose(0, 196, 0), seal: pose(0, 196, 0), cap: pose(-63, 112, -10), ring: pose(-63, 112, -10), button: pose(-63, 112, -10) }, cameraElevation: 0.42 },
  { p: 0.23, poses: { shell: pose(), inlay: pose(83, 196, 8), seal: pose(83, 228, 8), cap: pose(-63, 112, -10), ring: pose(-63, 157, -10), button: pose(-63, 198, -10) }, cameraElevation: 0.42 },
  { p: 0.28, poses: { shell: pose(), inlay: pose(83, 196, 8), seal: pose(83, 228, 8), cap: pose(-63, 112, -10), ring: pose(-63, 157, -10), button: pose(-63, 198, -10) }, cameraElevation: 0.42 },
  { p: 0.32, poses: { shell: pose(), inlay: pose(83, 196, 8), seal: pose(83, 196, 8), cap: pose(-63, 112, -10), ring: pose(-63, 157, -10), button: pose(-63, 198, -10) }, cameraElevation: 0.42 },
  { p: 0.345, poses: { shell: pose(), inlay: pose(0, 196, 0), seal: pose(0, 196, 0), cap: pose(-63, 112, -10), ring: pose(-63, 157, -10), button: pose(-63, 198, -10) }, cameraElevation: 0.42 },
  { p: 0.43, poses: { shell: pose(), inlay: pose(), seal: pose(), cap: pose(-63, 109, -8), ring: pose(-63, 154, -8), button: pose(-63, 195, -8) }, cameraElevation: 0.43 },
  { p: 0.475, poses: { shell: pose(), inlay: pose(), seal: pose(), cap: pose(-42, 108, -8), ring: pose(-42, 153, -8), button: pose(-42, 194, -8) }, cameraElevation: 0.43 },
  { p: 0.58, poses: { shell: pose(), inlay: pose(), seal: pose(119, 53, 25, 0, 0, -1.28), cap: pose(-32, 102, -5), ring: pose(-32, 148, -5), button: pose(-32, 189, -5) }, cameraElevation: 0.5 },
  { p: 0.68, poses: { shell: pose(), inlay: pose(), seal: pose(146, 38, 16, 0, 0, -1.48), cap: pose(0, 85, 0), ring: pose(0, 85, 0), button: pose(0, 131, 0) }, cameraElevation: 0.57 },
  { p: 0.745, poses: { shell: pose(), inlay: pose(), seal: pose(146, 38, 16, 0, 0, -1.48), cap: pose(0, 74, 0), ring: pose(0, 74, 0), button: pose(0, 74, 0) }, cameraElevation: 0.56 },
  { p: 0.895, poses: { shell: pose(), inlay: pose(), seal: pose(146, 38, 16, 0, 0, -1.48), cap: pose(), ring: pose(), button: pose() }, cameraElevation: 0.39 },
  { p: 1, poses: { shell: pose(), inlay: pose(), seal: pose(146, 38, 16, 0, 0, -1.48), cap: pose(), ring: pose(), button: pose() }, cameraElevation: 0.34 },
]);

export function getChapter(progress) {
  const p = clamp(progress);
  const boundaries = [0.13, 0.345, 0.515, 0.64, 0.89];
  return boundaries.findIndex((boundary) => p < boundary) === -1 ? 5 : boundaries.findIndex((boundary) => p < boundary);
}

export function computeAssemblyState(progress) {
  const p = clamp(progress);
  let index = KEYFRAMES.findIndex((frame) => frame.p >= p);
  if (index <= 0) index = 1;
  const a = KEYFRAMES[index - 1], b = KEYFRAMES[index];
  const t = smooth(clamp((p - a.p) / (b.p - a.p)));
  const components = {};
  for (const id of COMPONENT_IDS) {
    components[id] = {
      position: a.poses[id].position.map((value, axis) => mix(value, b.poses[id].position[axis], t)),
      rotation: a.poses[id].rotation.map((value, axis) => mix(value, b.poses[id].rotation[axis], t)),
      visible: id !== 'seal' || (p >= 0.10 && p <= 0.635),
    };
  }
  // Meshes are authored in assembled world coordinates. Keep the film's pivot
  // at its own centre (Y170.42), rather than spinning it around the bottle base.
  const film = components.seal, filmCentreY = 170.42, rz = film.rotation[2];
  film.position[0] += Math.sin(rz) * filmCentreY;
  film.position[1] += (1 - Math.cos(rz)) * filmCentreY;
  return {
    progress: p,
    chapter: getChapter(p),
    components,
    // Exactly two revolutions; final and initial engraving orientation match.
    rotationY: p * Math.PI * 4,
    cameraElevation: mix(a.cameraElevation, b.cameraElevation, t),
    sealRemoved: p > 0.635,
    assembled: p >= 0.895,
  };
}
