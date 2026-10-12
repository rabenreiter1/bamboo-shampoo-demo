import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { CHAPTERS, COMPONENT_IDS, computeAssemblyState } from './timeline.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const copy = {
  de: {
    skip: 'Zur Animationssteuerung', lab: 'MATERIAL LAB', study: 'ASSEMBLY STUDY 01', preview: 'PRODUKTPRÜFUNG · 250 ML', interactive: 'INTERAKTIVES 3D-MODELL', scroll: 'Scrollen, um zu entdecken', loading: 'Materialien & Geometrie werden geladen',
    renderTitle: 'Die 3D-Ansicht konnte nicht starten.', renderMessage: 'Bitte aktiviere WebGL oder öffne diese Seite in einem aktuellen Browser. Die Originalreferenz und die Bauteilmaße bleiben zugänglich.', retry: 'Erneut laden ↗', topView: 'Draufsicht', palette: 'CAD-Farben', reference: 'Original-Verschluss ↗', specs: 'Maße & Bauteile ↗', assembly: 'MONTAGE', rotate: 'Rotation', footerTitle: 'Das Produkt im Detail.', footerCopy: 'Eine separate Ansicht zur Freigabe von Form, Materialien und Montage.', download: 'Montageanimation herunterladen', restart: 'Noch einmal ansehen ↑', source: 'ORIGINALREFERENZ', referenceTitle: 'Der Verschluss von oben.', referenceCopy: 'Das bereitgestellte Referenzbild, vollständig unverändert. Die CAD-Farben kennzeichnen die drei separaten Bauteile.', dimensions: 'BAUTEILE · MILLIMETER', specsTitle: 'Die Maße hinter der Form.', modelNote: 'Bemaßte Vorgaben werden direkt im Modell verwendet. Nicht bemaßte Tiefen des Knopfs, Kappenprofile und PET-Wandstärke bleiben gekennzeichnete Modellannahmen. Die Gravurdatei ist unverändert.', downloadAssembled: 'Montiertes Modell · GLB ↗', downloadAnimation: 'Montageanimation · GLB', downloadCurrent: 'Aktueller Zustand · GLB ↗', exportNote: 'Alle Dateien enthalten sechs separate Bauteile, einschließlich der Siegelfolie.', exported: 'Dein 3D-Modell wird heruntergeladen.', exportFailed: 'Der Export konnte nicht abgeschlossen werden.', exportLoading: 'Das 3D-Modell wird vorbereitet.', play: 'Animation abspielen', pause: 'Animation anhalten', progress: 'Montagefortschritt', close: 'Schließen', rotationOn: 'Rotation anhalten', rotationOff: 'Rotation fortsetzen', canvas: '3D-Produkt. Ziehen zum Drehen; Pfeiltasten zum Untersuchen.', viewport: 'Interaktives 3D-Modell des Bamboo Shampoo Produkts',
    componentNames: ['Bambustubus', 'PET-Inlay', 'Siegelfolie', 'Äußere Kappe', 'Nippelring', 'Dosierknopf'],
    componentDetails: [
      ['Ø58 außen / Ø48 innen', '170 mm hoch · oberer Bereich 20 mm'],
      ['Ø47 außen × 165 mm', 'Kranz Ø58 · Breite 5,5 mm · Nennfüllmenge 250 ml'],
      ['Abziehbar auf dem Kranz', 'Folienstärke ist eine Modellannahme'],
      ['Ø59 oben / Ø58 unten', 'Wandstärke 0,5 mm · unbemaßte Profile schematisch'],
      ['Kreisrund um den Knopf', 'Kontur und Laschen aus der Draufsicht'],
      ['Tropfenform aus der Referenz', 'Draufsicht übernommen · Tiefe nicht bemaßt'],
    ],
  },
  en: {
    skip: 'Skip to animation controls', lab: 'MATERIAL LAB', study: 'ASSEMBLY STUDY 01', preview: 'PRODUCT REVIEW · 250 ML', interactive: 'INTERACTIVE 3D MODEL', scroll: 'Scroll to explore', loading: 'Loading materials & geometry',
    renderTitle: 'The 3D view could not start.', renderMessage: 'Please enable WebGL or open this page in a current browser. The original reference and component dimensions remain available.', retry: 'Try again ↗', topView: 'Top view', palette: 'CAD colours', reference: 'Original closure ↗', specs: 'Dimensions & parts ↗', assembly: 'ASSEMBLY', rotate: 'Rotation', footerTitle: 'The product in detail.', footerCopy: 'A dedicated view to approve the shape, materials and assembly.', download: 'Download assembly animation', restart: 'Explore again ↑', source: 'ORIGINAL REFERENCE', referenceTitle: 'The closure from above.', referenceCopy: 'Your supplied reference image, completely unchanged. The CAD colours identify the three separate components.', dimensions: 'COMPONENTS · MILLIMETRES', specsTitle: 'The dimensions behind the shape.', modelNote: 'Specified dimensions are used directly in the model. Undimensioned button depths, cap profiles and PET wall thickness remain identified model assumptions. The engraving file is unchanged.', downloadAssembled: 'Assembled model · GLB ↗', downloadAnimation: 'Assembly animation · GLB', downloadCurrent: 'Current state · GLB ↗', exportNote: 'All files contain six separate components, including the sealing film.', exported: 'Your 3D model is downloading.', exportFailed: 'The export could not be completed.', exportLoading: 'Preparing the 3D model.', play: 'Play animation', pause: 'Pause animation', progress: 'Assembly progress', close: 'Close', rotationOn: 'Pause rotation', rotationOff: 'Resume rotation', canvas: '3D product. Drag to rotate; use arrow keys to inspect.', viewport: 'Interactive 3D model of the Bamboo Shampoo product',
    componentNames: ['Bamboo shell', 'PET inlay', 'Sealing film', 'Outer cap', 'Nipple ring', 'Dosing button'],
    componentDetails: [
      ['Ø58 outside / Ø48 inside', '170 mm high · upper section 20 mm'],
      ['Ø47 outside × 165 mm', 'Flange Ø58 · width 5.5 mm · nominal fill 250 ml'],
      ['Peels away from the flange', 'Film thickness is a model assumption'],
      ['Ø59 top / Ø58 bottom', 'Wall thickness 0.5 mm · undimensioned profiles schematic'],
      ['Circular around the button', 'Outline and connected tabs from the top reference'],
      ['Teardrop from the reference', 'Top outline reproduced · depth not dimensioned'],
    ],
  },
};

let language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'de';
let targetProgress = 0, progress = 0, activeChapter = -1;
let autoplay = false, topView = false, cadPalette = false, rotationPaused = false;
let rotationOverride = 0, manualTilt = 0, dirty = true, lastFrame = 0, toastTimer;
let scene, renderer, camera, productRoot, bodyModel, capModel, components = {};
let status = 'loading', modelError = null, sceneBounds = null;
let lastTelemetryTime = -1000, lastTelemetrySignature = '', telemetryPending = true;
const metrics = {};
const viewport = $('viewport');
const scrollRange = () => Math.max(1, $('assembly-scroll').offsetHeight - $('stage').offsetHeight);

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
}

function renderSpecs() {
  const t = copy[language];
  $('specs-list').replaceChildren(...COMPONENT_IDS.map((id, index) => {
    const row = document.createElement('div');
    row.className = 'spec-row'; row.dataset.component = id;
    const number = document.createElement('span'); number.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('strong'); name.textContent = t.componentNames[index];
    const detail = document.createElement('div'); detail.className = 'spec-detail'; detail.textContent = t.componentDetails[index][0];
    const secondary = document.createElement('small'); secondary.textContent = t.componentDetails[index][1]; detail.append(secondary);
    row.append(number, name, detail); return row;
  }));
}

function renderNavigation() {
  $('chapter-nav').replaceChildren(...CHAPTERS.map((chapter, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.chapter = String(index); button.setAttribute('aria-label', `${chapter.number} ${chapter[language].label}`);
    const number = document.createElement('span'); number.textContent = chapter.number;
    const label = document.createElement('span'); label.className = 'nav-label'; label.textContent = chapter[language].label;
    button.append(number, label);
    button.addEventListener('click', () => { stopAutoplay(); setProgress(chapter.at, { immediate: false }); });
    return button;
  }));
}

function setLanguage(next) {
  language = next === 'en' ? 'en' : 'de'; document.documentElement.lang = language;
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = copy[language][element.dataset.i18n] || element.textContent;
  for (const button of document.querySelectorAll('[data-language]')) button.setAttribute('aria-pressed', String(button.dataset.language === language));
  for (const button of document.querySelectorAll('.dialog-close')) button.setAttribute('aria-label', copy[language].close);
  $('scrubber').setAttribute('aria-label', copy[language].progress);
  viewport.setAttribute('aria-label', copy[language].viewport);
  renderer?.domElement.setAttribute('aria-label', copy[language].canvas);
  renderNavigation(); renderSpecs(); activeChapter = -1; updateUI(computeAssemblyState(progress));
}

function updateUI(state) {
  if (state.chapter !== activeChapter) {
    activeChapter = state.chapter;
    const chapter = CHAPTERS[state.chapter], content = chapter[language];
    $('chapter-number').textContent = chapter.number; $('chapter-label').textContent = content.label;
    $('chapter-title').replaceChildren(...content.title.split('\n').flatMap((line, index) => index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
    $('chapter-description').textContent = content.copy;
    for (const button of $('chapter-nav').children) {
      if (Number(button.dataset.chapter) === state.chapter) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    }
  }
  const percent = Math.round(state.progress * 100);
  $('progress-value').replaceChildren(document.createTextNode(String(percent).padStart(3, '0')), Object.assign(document.createElement('span'), { textContent: '%' }));
  $('scrubber').value = String(Math.round(state.progress * 1000));
  $('scrubber').style.setProperty('--fill', `${state.progress * 100}%`);
  $('scrubber').setAttribute('aria-valuetext', `${percent} ${language === 'de' ? 'Prozent' : 'percent'}`);
  $('scroll-cue').style.opacity = state.progress < 0.025 ? '1' : '0';
  $('play').setAttribute('aria-pressed', String(autoplay)); $('play').setAttribute('aria-label', copy[language][autoplay ? 'pause' : 'play']);
  $('pause-rotation').setAttribute('aria-pressed', String(rotationPaused)); $('pause-rotation').setAttribute('aria-label', copy[language][rotationPaused ? 'rotationOff' : 'rotationOn']);
}

function stopAutoplay() { autoplay = false; dirty = true; }

function setProgress(value, { immediate = true, scroll = true } = {}) {
  const p = clamp(Number(value) || 0); targetProgress = p;
  if (scroll) window.scrollTo({ top: $('assembly-scroll').offsetTop + p * scrollRange(), behavior: 'instant' });
  if (immediate) { progress = p; applyState(computeAssemblyState(p)); }
  dirty = true;
  return computeAssemblyState(p);
}

function visibleBounds(capOnly = false) {
  const bounds = new THREE.Box3();
  productRoot.updateWorldMatrix(true, true);
  for (const [id, part] of Object.entries(components)) if (part.visible && (!capOnly || ['cap', 'ring', 'button'].includes(id))) bounds.union(new THREE.Box3().setFromObject(part));
  return bounds;
}

function fitCamera(state) {
  if (!renderer || !productRoot) return;
  const bounds = visibleBounds(topView);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const elevation = topView ? 2.6 : clamp(state.cameraElevation + manualTilt, 0.12, 1.6);
  const direction = topView ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0.25, elevation, 1).normalize();
  const cameraUp = topView ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const right = cameraUp.clone().cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const tanH = tanV * camera.aspect;
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const corner = new THREE.Vector3(x, y, z).sub(center);
    distance = Math.max(distance, corner.dot(direction) + Math.abs(corner.dot(up)) / tanV, corner.dot(direction) + Math.abs(corner.dot(right)) / tanH);
  }
  distance = Math.max(distance * 1.17, topView ? 85 : 230);
  camera.up.copy(cameraUp); camera.position.copy(center).addScaledVector(direction, distance); camera.lookAt(center); camera.updateMatrixWorld();
  sceneBounds = { min: bounds.min.toArray(), max: bounds.max.toArray(), center: center.toArray(), cameraDistance: distance };
}

function applyState(state) {
  if (productRoot) {
    for (const id of COMPONENT_IDS) {
      const part = components[id], transform = state.components[id];
      part.position.fromArray(transform.position); part.rotation.set(...transform.rotation); part.visible = transform.visible;
    }
    // The comparison view matches the source drawing orientation exactly.
    productRoot.rotation.y = topView ? 0 : (rotationPaused ? rotationOverride : state.rotationY);
    fitCamera(state); renderer.render(scene, camera);
  }
  updateUI(state); emitInspectionData(state); dirty = false;
}

function emitInspectionData(state, force = false) {
  const now = performance.now();
  const rotationY = productRoot?.rotation.y ?? 0;
  const signature = [status, state.progress.toFixed(5), rotationY.toFixed(5), topView, cadPalette, language, autoplay, rotationPaused].join('|');
  if (!force && signature === lastTelemetrySignature) { telemetryPending = false; return; }
  if (!force && now - lastTelemetryTime < 200) { telemetryPending = true; return; }
  lastTelemetryTime = now; lastTelemetrySignature = signature; telemetryPending = false;
  const renderInfo = renderer?.info.render;
  Object.assign(viewport.dataset, {
    status, progress: state.progress.toFixed(6), rotationY: rotationY.toFixed(6),
    drawCalls: String(renderInfo?.calls ?? 0), triangles: String(renderInfo?.triangles ?? 0), componentCount: String(Object.keys(components).length),
  });
  $('assembly-state').textContent = JSON.stringify({
    ...state, status, ready: status === 'ready', error: modelError, targetProgress,
    actualRotationY: rotationY, rotationPaused, autoplay, language, topView, cadPalette,
    render: { drawCalls: renderInfo?.calls ?? 0, triangles: renderInfo?.triangles ?? 0 }, bounds: sceneBounds, metrics,
  });
}

function resize() {
  if (!renderer) return;
  const width = Math.max(viewport.clientWidth, 1), height = Math.max(viewport.clientHeight, 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.2 : 1.8));
  renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); dirty = true;
}

function toggleRotation(force) {
  const next = typeof force === 'boolean' ? force : !rotationPaused;
  if (next && !rotationPaused) rotationOverride = productRoot?.rotation.y ?? computeAssemblyState(progress).rotationY;
  rotationPaused = next; dirty = true;
}

function attachInteraction(canvas) {
  let pointer = null;
  canvas.tabIndex = 0; canvas.setAttribute('aria-label', copy[language].canvas);
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    stopAutoplay(); toggleRotation(true); pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    rotationOverride += (event.clientX - pointer.x) * 0.012;
    manualTilt = clamp(manualTilt + (event.clientY - pointer.y) * 0.004, -0.22, 1.2);
    pointer.x = event.clientX; pointer.y = event.clientY; dirty = true;
  });
  const finish = () => { pointer = null; };
  canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); stopAutoplay(); toggleRotation(true);
    if (event.key === 'ArrowLeft') rotationOverride -= 0.16;
    if (event.key === 'ArrowRight') rotationOverride += 0.16;
    if (event.key === 'ArrowUp') manualTilt = clamp(manualTilt + 0.07, -0.22, 1.2);
    if (event.key === 'ArrowDown') manualTilt = clamp(manualTilt - 0.07, -0.22, 1.2);
    dirty = true;
  });
}

function cloneExportProduct({ assembled = true, includeSeal = true } = {}) {
  if (!productRoot) throw new Error('Product is not ready');
  const clone = productRoot.clone(true); clone.name = 'Bamboo_Shampoo_250ml';
  // glTF uses metres. Keep source geometry in millimetres and convert only the
  // export root, so downstream viewers receive a 170 mm rather than 170 m object.
  clone.scale.setScalar(0.001);
  clone.userData.units = 'm'; clone.userData.sourceUnits = 'mm';
  if (assembled) clone.rotation.set(0, 0, 0);
  for (const child of clone.children) {
    if (assembled) { child.position.set(0, 0, 0); child.rotation.set(0, 0, 0); }
    child.visible = child.name !== 'seal' || includeSeal;
  }
  clone.updateMatrixWorld(true); return clone;
}

async function exportProduct({ assembled = true, includeSeal = true, download = true } = {}) {
  const { GLTFExporter } = await import('./vendor/GLTFExporter.js');
  const product = cloneExportProduct({ assembled, includeSeal });
  const exporter = new GLTFExporter();
  const data = await exporter.parseAsync(product, { binary: true, trs: true, onlyVisible: true, maxTextureSize: 2048 });
  const blob = new Blob([data], { type: 'model/gltf-binary' });
  if (download) {
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = assembled ? 'bamboo-shampoo-250ml-assembled.glb' : `bamboo-shampoo-250ml-state-${Math.round(progress * 100)}.glb`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
  return { blob, data, product };
}

async function exportAnimated(options = {}) {
  const { exportAssemblyAnimation } = await import('./animated-export.js');
  return exportAssemblyAnimation({ THREE, cloneExportProduct, ...options });
}

async function downloadAnimationAsset() {
  const url = new URL('./models/bamboo-250ml-animated-assembly.glb', import.meta.url);
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) return false;
    const link = document.createElement('a'); link.href = url.href; link.download = 'bamboo-shampoo-250ml-assembly-animation.glb';
    document.body.append(link); link.click(); link.remove(); return true;
  } catch { return false; }
}

async function downloadModel(kind = 'assembled') {
  if (status !== 'ready') { toast(copy[language].exportLoading); return; }
  const buttons = [$('download-model'), $('download-animation'), $('download-assembled'), $('download-current')];
  buttons.forEach((button) => { button.disabled = true; });
  toast(copy[language].exportLoading);
  try { if (kind === 'animation') { if (!await downloadAnimationAsset()) await exportAnimated(); } else await exportProduct({ assembled: kind === 'assembled', includeSeal: true }); toast(copy[language].exported); }
  catch (error) { console.error('GLB export failed', error); toast(copy[language].exportFailed); }
  finally { buttons.forEach((button) => { button.disabled = false; }); }
}

async function boot() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor('#f1efe8', 1); viewport.prepend(renderer.domElement);
    scene = new THREE.Scene(); scene.background = new THREE.Color('#f1efe8');
    camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    const room = new RoomEnvironment(); const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, 0.05); scene.environment = environment.texture; scene.environmentIntensity = 0.45; room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#fff8e7', '#d0d4c1', 0.6));
    const key = new THREE.DirectionalLight('#fff2dc', 1.9); key.position.set(-230, 430, 330); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -330; key.shadow.camera.right = 330; key.shadow.camera.top = 500; key.shadow.camera.bottom = -220; key.shadow.camera.near = 1; key.shadow.camera.far = 1500; key.shadow.bias = -0.00018; key.shadow.normalBias = 0.32; key.shadow.radius = 4; scene.add(key);
    const fill = new THREE.DirectionalLight('#f8fbec', 0.8); fill.position.set(220, 220, 370); scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffffff', 1.4); rim.position.set(120, 330, -260); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600), new THREE.ShadowMaterial({ color: '#59634b', opacity: 0.14 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.45; floor.receiveShadow = true; floor.name = 'Studio floor'; scene.add(floor);
    const [{ createBody }, { createCap }] = await Promise.all([import('./body.js'), import('./cap.js')]);
    [bodyModel, capModel] = await Promise.all([createBody({ THREE, engravingUrl: './original-engraving.svg' }), Promise.resolve(createCap({ THREE }))]);
    await Promise.all([bodyModel.ready, capModel.ready].filter(Boolean));
    components = { ...bodyModel.components, ...capModel.components };
    for (const id of COMPONENT_IDS) if (!components[id]?.isObject3D) throw new Error(`Missing model component: ${id}`);
    productRoot = new THREE.Group(); productRoot.name = 'Bamboo_Shampoo_Assembly';
    for (const id of COMPONENT_IDS) { components[id].name = id; productRoot.add(components[id]); }
    scene.add(productRoot); Object.assign(metrics, { body: bodyModel.metrics, cap: capModel.metrics, componentIds: COMPONENT_IDS, units: 'mm' });
    capModel.setPalette?.('concept'); resize(); attachInteraction(renderer.domElement);
    new ResizeObserver(resize).observe(viewport);
    targetProgress = clamp((scrollY - $('assembly-scroll').offsetTop) / scrollRange()); progress = targetProgress;
    status = 'ready'; applyState(computeAssemblyState(progress)); emitInspectionData(computeAssemblyState(progress), true); $('loading').hidden = true;
    document.dispatchEvent(new CustomEvent('assembly-ready', { detail: { metrics } }));
  } catch (error) {
    status = 'error'; modelError = String(error?.message || error); console.error('Assembly viewer could not start', error);
    $('loading').hidden = true; $('render-fallback').hidden = false; renderer?.domElement.remove(); emitInspectionData(computeAssemblyState(progress), true);
  }
}

function frame(time) {
  requestAnimationFrame(frame);
  const delta = clamp((time - lastFrame) / 1000, 0, 0.06); lastFrame = time;
  if (autoplay && status === 'ready') {
    targetProgress = clamp(targetProgress + delta / 34);
    window.scrollTo({ top: $('assembly-scroll').offsetTop + targetProgress * scrollRange(), behavior: 'instant' });
    if (targetProgress >= 1) autoplay = false;
    dirty = true;
  }
  const difference = targetProgress - progress;
  if (Math.abs(difference) > 0.00001) {
    progress = reducedMotion.matches ? targetProgress : progress + difference * (1 - Math.exp(-delta * 10));
    if (Math.abs(targetProgress - progress) < 0.00002) progress = targetProgress;
    dirty = true;
  }
  if (dirty) applyState(computeAssemblyState(progress));
  else if (telemetryPending) emitInspectionData(computeAssemblyState(progress));
}

window.__ASSEMBLY__ = {
  setProgress,
  getState: () => ({ ...computeAssemblyState(progress), targetProgress, actualRotationY: productRoot?.rotation.y ?? 0, rotationPaused, autoplay, language, topView, cadPalette, status, ready: status === 'ready', error: modelError, bounds: sceneBounds }),
  getMetrics: () => metrics,
  get scene() { return scene; }, get renderer() { return renderer; }, get camera() { return camera; },
  get productRoot() { return productRoot; }, get components() { return components; },
  cloneExportProduct, exportProduct, exportAnimated,
  render: () => applyState(computeAssemblyState(progress)),
  setPalette: (mode) => { cadPalette = mode === 'cad'; capModel?.setPalette?.(cadPalette ? 'cad' : 'concept'); $('palette').setAttribute('aria-pressed', String(cadPalette)); dirty = true; },
  setTopView: (enabled) => { topView = Boolean(enabled); $('top-view').setAttribute('aria-pressed', String(topView)); dirty = true; },
  pauseRotation: (paused = true) => toggleRotation(paused),
  setLanguage,
  timeline: computeAssemblyState,
};

window.addEventListener('scroll', () => { targetProgress = clamp((scrollY - $('assembly-scroll').offsetTop) / scrollRange()); dirty = true; }, { passive: true });
window.addEventListener('wheel', stopAutoplay, { passive: true });
window.addEventListener('touchstart', stopAutoplay, { passive: true });
window.addEventListener('resize', resize, { passive: true });
$('scrubber').addEventListener('input', (event) => { stopAutoplay(); setProgress(Number(event.target.value) / 1000, { immediate: true }); });
$('play').addEventListener('click', () => {
  if (autoplay) stopAutoplay(); else { if (targetProgress >= 0.99) setProgress(0); autoplay = true; dirty = true; }
});
$('pause-rotation').addEventListener('click', () => toggleRotation());
$('top-view').addEventListener('click', () => { if (!topView) { stopAutoplay(); setProgress(1); } window.__ASSEMBLY__.setTopView(!topView); });
$('palette').addEventListener('click', () => window.__ASSEMBLY__.setPalette(cadPalette ? 'concept' : 'cad'));
for (const button of document.querySelectorAll('[data-language]')) button.addEventListener('click', () => setLanguage(button.dataset.language));
for (const id of ['reference', 'specs']) $('open-' + id).addEventListener('click', () => { stopAutoplay(); $(id + '-dialog').showModal(); });
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => $(button.dataset.close).close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
$('retry').addEventListener('click', () => location.reload());
$('restart').addEventListener('click', () => { stopAutoplay(); setProgress(0); });
$('download-model').addEventListener('click', () => downloadModel('animation'));
$('download-animation').addEventListener('click', () => downloadModel('animation'));
$('download-assembled').addEventListener('click', () => downloadModel('assembled'));
$('download-current').addEventListener('click', () => downloadModel('current'));
setLanguage(language); requestAnimationFrame(frame); boot();
