// The scene: Sector 7 built from the map data. Every box is a collider for
// movement and a surface a bullet stops on; the ground, site markers, signs and
// distant silhouettes are visual only. Dusk light: a low warm sun with shadows,
// a cool sky fill, and fog that melts the yard into the evening.
import * as THREE from 'three';
import { MAP } from './map.js';
import { PALETTE, sandTexture, concreteTexture, metalTexture, hazardTexture, letterTexture } from './palette.js';

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const sand = sandTexture();
  sand.repeat.set(16, 14);
  const concrete = concreteTexture();
  concrete.repeat.set(2, 1);
  const materials = {
    sand: new THREE.MeshStandardMaterial({ map: sand, roughness: 1, metalness: 0 }),
    concrete: new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95, metalness: 0.02 }),
    dark: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.darkConcrete), roughness: 0.9, metalness: 0.05 }),
    rust: new THREE.MeshStandardMaterial({ map: metalTexture('#a34d2d', '#7e3a20'), roughness: 0.75, metalness: 0.35 }),
    teal: new THREE.MeshStandardMaterial({ map: metalTexture('#2e7f7a', '#22605c'), roughness: 0.75, metalness: 0.35 }),
    crate: new THREE.MeshStandardMaterial({ color: new THREE.Color('#9a7b4f'), roughness: 0.9, metalness: 0 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.8, metalness: 0.05 }),
  };

  const colliders = [];
  const shootables = [];

  function addBox(box, solid) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(box.w, box.h, box.d), materials[box.mat]);
    mesh.position.set(box.x, (box.y ?? 0) + box.h / 2, box.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (solid) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }

  // Ground: one sand plane, a collider so bodies stand on y=0.
  const ground = new THREE.Mesh(new THREE.BoxGeometry(77.2, 0.4, 65.4), materials.sand);
  ground.position.set(0, -0.2, 0);
  ground.receiveShadow = true;
  group.add(ground);
  colliders.push(new THREE.Box3().setFromObject(ground));
  shootables.push(ground);

  for (const box of MAP.boxes) addBox(box, true);

  // Barrels: cylinders with a small square collider.
  const barrelGeometry = new THREE.CylinderGeometry(0.36, 0.36, 1.0, 12);
  const barrelRust = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.rust), roughness: 0.7, metalness: 0.4 });
  const barrelTeal = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2e7f7a'), roughness: 0.7, metalness: 0.4 });
  MAP.barrels.forEach(([x, z], index) => {
    const barrel = new THREE.Mesh(barrelGeometry, index % 2 ? barrelTeal : barrelRust);
    barrel.position.set(x, 0.5, z);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    group.add(barrel);
    const collider = new THREE.Box3(
      new THREE.Vector3(x - 0.36, 0, z - 0.36),
      new THREE.Vector3(x + 0.36, 1.0, z + 0.36),
    );
    colliders.push(collider);
    shootables.push(barrel);
  });

  // Site zones: hazard-striped border frames flat on the ground (visual only),
  // plus a letter sign on the north wall above each site.
  for (const [key, site] of Object.entries(MAP.sites)) {
    const width = site.maxX - site.minX;
    const depth = site.maxZ - site.minZ;
    const cx = (site.minX + site.maxX) / 2;
    const cz = (site.minZ + site.maxZ) / 2;
    const border = (w, d, x, z) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), materials.hazard);
      strip.position.set(x, 0.03, z);
      strip.receiveShadow = true;
      group.add(strip);
    };
    border(width, 0.5, cx, site.minZ + 0.25);
    border(width, 0.5, cx, site.maxZ - 0.25);
    border(0.5, depth, site.minX + 0.25, cz);
    border(0.5, depth, site.maxX - 0.25, cz);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshStandardMaterial({ map: letterTexture(key), roughness: 0.8 }),
    );
    sign.position.set(cx, 2.8, -31.95);
    group.add(sign);
  }

  // Distant silhouettes outside the walls, for depth against the dusk.
  const silhouette = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2b3849'), roughness: 1 });
  const distant = [
    [-52, -18, 22, 13, 18],
    [56, 8, 18, 9, 16],
    [0, -56, 34, 16, 12],
    [-56, 24, 14, 7, 20],
    [58, -28, 12, 11, 14],
  ];
  for (const [x, z, w, h, d] of distant) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), silhouette);
    block.position.set(x, h / 2 - 0.5, z);
    group.add(block);
  }

  // Light: a low warm sun from the west, a cool dusk fill, and a sky gradient.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.sky), 30, 95);

  const sky = new THREE.HemisphereLight(new THREE.Color('#8fa3c7'), new THREE.Color('#5c4a33'), 1.0);
  scene.add(sky);

  const sun = new THREE.DirectionalLight(new THREE.Color('#ffd9a0'), 2.6);
  sun.position.set(-30, 26, 18);
  sun.target.position.set(0, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.far = 110;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const fill = new THREE.DirectionalLight(new THREE.Color('#7d90b5'), 0.5);
  fill.position.set(20, 14, -24);
  scene.add(fill);

  return { colliders, shootables, group };
}
