// The first-person view model: a gun built from boxes, hung off the camera,
// one shape per weapon, with a muzzle flash, a kick on every shot, a dip while
// reloading and a sway while walking. It is presentation only: the simulation
// never reads it.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const FLASH_TIME = 0.06;

function buildGun(def) {
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.surface), roughness: 0.6, metalness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.muted), roughness: 0.45, metalness: 0.6 });
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a2f24'), roughness: 0.85, metalness: 0.05 });
  const group = new THREE.Group();

  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  if (def.id === 'pistol') {
    add(new THREE.BoxGeometry(0.05, 0.07, 0.22), metal, 0, 0, -0.1);
    add(new THREE.BoxGeometry(0.045, 0.11, 0.06), grip, 0, -0.07, 0.04);
    add(new THREE.BoxGeometry(0.02, 0.03, 0.03), dark, 0, 0.05, -0.18);
  } else if (def.id === 'smg') {
    add(new THREE.BoxGeometry(0.07, 0.09, 0.34), dark, 0, 0, -0.08);
    add(new THREE.BoxGeometry(0.04, 0.04, 0.22), metal, 0, 0.02, -0.32);
    add(new THREE.BoxGeometry(0.05, 0.14, 0.06), grip, 0, -0.09, -0.05);
    add(new THREE.BoxGeometry(0.06, 0.07, 0.16), grip, 0, -0.02, 0.18);
  } else if (def.id === 'sniper') {
    add(new THREE.BoxGeometry(0.08, 0.1, 0.5), dark, 0, 0, -0.1);
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 10), metal, 0, 0.02, -0.5).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), dark, 0, 0.09, -0.12).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.06, 0.09, 0.24), grip, 0, -0.01, 0.28);
  } else {
    // Rifle.
    add(new THREE.BoxGeometry(0.08, 0.1, 0.44), dark, 0, 0, -0.08);
    add(new THREE.BoxGeometry(0.04, 0.04, 0.34), metal, 0, 0.025, -0.44);
    add(new THREE.BoxGeometry(0.05, 0.12, 0.07), grip, 0, -0.09, -0.02);
    add(new THREE.BoxGeometry(0.07, 0.08, 0.2), grip, 0, -0.02, 0.28);
    add(new THREE.BoxGeometry(0.03, 0.05, 0.12), metal, 0, 0.075, -0.2);
  }
  return group;
}

export function createViewModel(camera) {
  const rig = new THREE.Group();
  rig.position.set(0.26, -0.23, -0.42);
  rig.scale.setScalar(0.85);
  camera.add(rig);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.amber), transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0, 0.01, -0.72);
  flash.visible = false;
  rig.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.amber), 0, 6);
  flashLight.position.set(0, 0, -0.5);
  rig.add(flashLight);

  const grenadeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 10),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#3d5230'), roughness: 0.6, metalness: 0.3 }),
  );
  grenadeMesh.position.set(0, -0.02, -0.3);
  grenadeMesh.visible = false;
  rig.add(grenadeMesh);

  let gunMesh = null;
  let flashLeft = 0;
  let kick = 0;
  let bobPhase = 0;

  return {
    setWeapon(def) {
      if (gunMesh) {
        rig.remove(gunMesh);
        gunMesh = null;
      }
      gunMesh = buildGun(def);
      rig.add(gunMesh);
      flash.position.z = def.id === 'sniper' ? -0.78 : def.id === 'pistol' ? -0.32 : -0.68;
      grenadeMesh.visible = false;
    },
    showGrenade(show) {
      grenadeMesh.visible = show;
      if (gunMesh) gunMesh.visible = !show;
    },
    pullTrigger() {
      flashLeft = FLASH_TIME;
      kick = 0.06;
    },
    step(dt, speed, reloading) {
      flashLeft = Math.max(0, flashLeft - dt);
      kick += (0 - kick) * Math.min(1, dt * 14);
      bobPhase += dt * (4 + speed * 1.6);
      const bob = Math.min(1, speed / 5.2) * 0.008;
      rig.position.y = -0.21 + Math.sin(bobPhase * 2) * bob - (reloading ? 0.09 : 0);
      rig.position.x = 0.24 + Math.cos(bobPhase) * bob * 0.6;
      rig.position.z = -0.42 + kick;
      rig.rotation.x = kick * 2.4 - (reloading ? 0.45 : 0);
      flash.visible = flashLeft > 0;
      if (flash.visible) flash.rotation.z = flashLeft * 40;
      flashLight.intensity = flashLeft > 0 ? 14 : 0;
    },
    muzzleWorld(out) {
      return flash.getWorldPosition(out);
    },
  };
}
