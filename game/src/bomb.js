// The Device: the objective beyond killing. One attacker carries it; standing
// in a site and holding the interact key plants it (3 s). Once planted it ticks
// for 35 s, beeping faster as it runs down, until it detonates (attackers win)
// or a defender holds the key beside it for 5 s to defuse (defenders win). A
// carrier who dies drops it; any attacker picks it up by walking over it.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const PLANT_TIME = 3.0;
export const DEFUSE_TIME = 5.0;
export const BOMB_TIMER = 35;

export function createBomb(scene) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.2, 0.24),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.darkConcrete), roughness: 0.5, metalness: 0.5 }),
  );
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.red) }),
  );
  light.position.set(0.12, 0.12, 0);
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.muted), roughness: 0.4, metalness: 0.7 }),
  );
  antenna.position.set(-0.12, 0.18, 0);
  group.add(body, light, antenna);
  group.visible = false;
  scene.add(group);

  const state = {
    mode: 'carried', // carried | dropped | planted | detonated | defused
    carrier: null, // fighter record, while carried
    site: null, // 'A' | 'B', once planted
    position: new THREE.Vector3(),
    timer: BOMB_TIMER,
    plantProgress: 0,
    defuseProgress: 0,
    beepAt: 0,
  };

  return {
    state,
    group,
    reset(carrier) {
      state.mode = 'carried';
      state.carrier = carrier;
      state.site = null;
      state.timer = BOMB_TIMER;
      state.plantProgress = 0;
      state.defuseProgress = 0;
      state.beepAt = 0;
      group.visible = false;
    },
    drop(position) {
      state.mode = 'dropped';
      state.carrier = null;
      state.position.copy(position);
      state.position.y = 0.12;
      group.position.copy(state.position);
      group.visible = true;
    },
    pickup(fighter) {
      state.mode = 'carried';
      state.carrier = fighter;
      group.visible = false;
    },
    plant(site, position) {
      state.mode = 'planted';
      state.site = site;
      state.carrier = null;
      state.timer = BOMB_TIMER;
      state.plantProgress = 0;
      state.position.copy(position);
      state.position.y = 0.12;
      group.position.copy(state.position);
      group.visible = true;
    },
    defuse() {
      state.mode = 'defused';
      state.defuseProgress = 0;
      group.visible = false;
    },
    // Tick the planted timer; returns 'detonated' once, at zero.
    step(dt, now, onBeep) {
      if (state.mode !== 'planted') return null;
      state.timer -= dt;
      const interval = state.timer > 10 ? 1.0 : state.timer > 5 ? 0.5 : 0.25;
      if (now >= state.beepAt) {
        state.beepAt = now + interval;
        onBeep(state.timer <= 10);
      }
      light.material.color.setHex(Math.sin(now * 10) > 0 ? 0xe5484d : 0x5c1a1c);
      if (state.timer <= 0) {
        state.mode = 'detonated';
        group.visible = false;
        return 'detonated';
      }
      return null;
    },
  };
}
