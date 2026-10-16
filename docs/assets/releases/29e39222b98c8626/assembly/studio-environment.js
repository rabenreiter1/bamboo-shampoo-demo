/**
 * A self-contained photographic light tent. Bright reflection cards against
 * negative fill give PET and gel actual highlights rather than a flat wash.
 * It changes the lighting environment only; no model dimensions or surfaces.
 */
export function createStudioEnvironment({ THREE, renderer }) {
  const room = new THREE.Scene();
  room.background = new THREE.Color('#34382f');
  const resources = [];
  function card(width, height, position, radiance, tint = [1, 1, 1]) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(...tint.map(channel => channel * radiance)),
      side: THREE.DoubleSide,
    });
    const light = new THREE.Mesh(geometry, material);
    light.position.set(...position); light.lookAt(0, 0, 0);
    room.add(light); resources.push(geometry, material);
  }
  card(3.8, 6.5, [-5.2, 2, 3.5], 4.5, [1, .98, .94]);
  card(.85, 6.0, [4.5, 1.2, 3], 5.0, [.95, .98, 1]);
  card(4, 2.5, [0, 5, -2], 2.6);
  card(2.0, 5.0, [-2, .5, -5.5], 1.8);
  // Real negative-fill flags give clear PET a readable edge without tinting it.
  card(2.2, 6.5, [5.0, .2, -1.7], .015);
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(room, .018);
  generator.dispose();
  for (const resource of resources) resource.dispose();
  return environment;
}
