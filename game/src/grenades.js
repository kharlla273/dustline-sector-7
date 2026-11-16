// Frag grenades: thrown on an arc, bouncing off the map with damped reflection,
// exploding on a fuse with radius damage that falls off from the centre. A
// grenade is one mesh plus a state record; at most a handful fly at once.
import * as THREE from 'three';
import { GRENADE } from './weapons.js';

const GRAVITY = 18;
const BOUNCE = 0.42;

export function createGrenades(scene, mover, effects, audio, onExplode) {
  const geometry = new THREE.SphereGeometry(0.07, 12, 10);
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3d5230'), roughness: 0.6, metalness: 0.3 });
  const live = [];
  const tmp = new THREE.Vector3();

  return {
    live,
    throwFrom(origin, direction, throwerVelocity) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(origin);
      mesh.castShadow = true;
      scene.add(mesh);
      const velocity = new THREE.Vector3()
        .copy(direction)
        .multiplyScalar(15)
        .add(throwerVelocity);
      velocity.y += 2.5;
      live.push({ mesh, velocity, fuse: GRENADE.fuse });
    },
    step(dt, fighters) {
      for (let i = live.length - 1; i >= 0; i -= 1) {
        const grenade = live[i];
        grenade.fuse -= dt;
        grenade.velocity.y -= GRAVITY * dt;
        const next = tmp.copy(grenade.mesh.position).addScaledVector(grenade.velocity, dt);
        // Bounce: test each axis against the colliders; a hit reflects that axis.
        const blocked = mover.overlaps(next.x, next.y - 0.07, next.z, 0.14, 0);
        if (blocked) {
          const probeX = mover.overlaps(next.x, grenade.mesh.position.y - 0.07, grenade.mesh.position.z, 0.14, 0);
          const probeZ = mover.overlaps(grenade.mesh.position.x, grenade.mesh.position.y - 0.07, next.z, 0.14, 0);
          if (probeX) grenade.velocity.x *= -BOUNCE;
          if (probeZ) grenade.velocity.z *= -BOUNCE;
          if (!probeX && !probeZ) grenade.velocity.y *= -BOUNCE;
          grenade.velocity.multiplyScalar(0.85);
        } else {
          grenade.mesh.position.copy(next);
        }
        if (grenade.mesh.position.y < 0.07) {
          grenade.mesh.position.y = 0.07;
          grenade.velocity.y = Math.abs(grenade.velocity.y) * BOUNCE;
        }
        if (grenade.fuse <= 0) {
          const point = grenade.mesh.position.clone();
          scene.remove(grenade.mesh);
          live.splice(i, 1);
          effects.explosion(point);
          audio.explode(0);
          onExplode(point, fighters);
        }
      }
    },
    clear() {
      for (const grenade of live) scene.remove(grenade.mesh);
      live.length = 0;
    },
  };
}

// Radius damage for an explosion: full at the centre, the minimum at the edge,
// and nothing through a wall (the mover's segment test).
export function explosionDamage(point, target, mover) {
  const distance = point.distanceTo(target);
  if (distance > GRENADE.radius) return 0;
  if (mover.segmentBlocked(point, target)) return 0;
  const t = distance / GRENADE.radius;
  return GRENADE.maxDamage + (GRENADE.minDamage - GRENADE.maxDamage) * t;
}
