// Battle effects, pooled: tracers, impact sparks and explosions. Every pool is
// allocated once at boot and reused, so the hot loop makes no objects. A tracer
// is a fading line from muzzle to hit; sparks are points with velocities; an
// explosion is a flash of light, an expanding shell and a burst of sparks.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const TRACER_COUNT = 40;
const TRACER_LIFE = 0.09;
const SPARK_COUNT = 240;
const SPARK_LIFE = 0.5;

export function createEffects(scene) {
  // Tracers: one Line per slot, two points each, opacity fades with age.
  const tracers = [];
  for (let i = 0; i < TRACER_COUNT; i += 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color('#ffd27a'), transparent: true, opacity: 0 });
    const line = new THREE.Line(geometry, material);
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tracerNext = 0;

  // Sparks: one Points cloud, each spark a position plus a velocity.
  const sparkPositions = new Float32Array(SPARK_COUNT * 3);
  const sparkVelocities = new Float32Array(SPARK_COUNT * 3);
  const sparkLife = new Float32Array(SPARK_COUNT);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = new THREE.PointsMaterial({ color: new THREE.Color(PALETTE.amber), size: 0.07, transparent: true, opacity: 0.95, depthWrite: false });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  scene.add(sparks);
  let sparkNext = 0;

  // Explosion: a light and an expanding shell, reused for every blast.
  const blastLight = new THREE.PointLight(new THREE.Color('#ff9a3c'), 0, 18);
  scene.add(blastLight);
  const blastShell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb45c'), transparent: true, opacity: 0, depthWrite: false }),
  );
  blastShell.visible = false;
  scene.add(blastShell);
  let blastLife = 0;

  const tmpDirection = new THREE.Vector3();

  function spawnSparks(point, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const slot = sparkNext;
      sparkNext = (sparkNext + 1) % SPARK_COUNT;
      sparkPositions[slot * 3] = point.x;
      sparkPositions[slot * 3 + 1] = point.y;
      sparkPositions[slot * 3 + 2] = point.z;
      tmpDirection.set(Math.random() * 2 - 1, Math.random() * 1.4, Math.random() * 2 - 1).normalize();
      sparkVelocities[slot * 3] = tmpDirection.x * speed * (0.4 + Math.random() * 0.8);
      sparkVelocities[slot * 3 + 1] = tmpDirection.y * speed * (0.4 + Math.random() * 0.8);
      sparkVelocities[slot * 3 + 2] = tmpDirection.z * speed * (0.4 + Math.random() * 0.8);
      sparkLife[slot] = SPARK_LIFE * (0.5 + Math.random() * 0.7);
    }
    sparkGeometry.attributes.position.needsUpdate = true;
  }

  return {
    tracer(from, to) {
      const slot = tracers[tracerNext];
      tracerNext = (tracerNext + 1) % TRACER_COUNT;
      const positions = slot.line.geometry.attributes.position.array;
      positions[0] = from.x;
      positions[1] = from.y;
      positions[2] = from.z;
      positions[3] = to.x;
      positions[4] = to.y;
      positions[5] = to.z;
      slot.line.geometry.attributes.position.needsUpdate = true;
      slot.line.visible = true;
      slot.life = TRACER_LIFE;
    },
    impact(point) {
      spawnSparks(point, 6, 3.5);
    },
    blood(point) {
      spawnSparks(point, 8, 2.5);
    },
    explosion(point) {
      blastLight.position.copy(point);
      blastLight.intensity = 60;
      blastShell.position.copy(point);
      blastShell.visible = true;
      blastLife = 0.35;
      spawnSparks(point, 40, 9);
    },
    step(dt) {
      for (const slot of tracers) {
        if (slot.life <= 0) continue;
        slot.life -= dt;
        slot.line.material.opacity = Math.max(0, slot.life / TRACER_LIFE) * 0.85;
        if (slot.life <= 0) slot.line.visible = false;
      }
      let anySpark = false;
      for (let i = 0; i < SPARK_COUNT; i += 1) {
        if (sparkLife[i] <= 0) continue;
        anySpark = true;
        sparkLife[i] -= dt;
        sparkVelocities[i * 3 + 1] -= 12 * dt;
        sparkPositions[i * 3] += sparkVelocities[i * 3] * dt;
        sparkPositions[i * 3 + 1] += sparkVelocities[i * 3 + 1] * dt;
        sparkPositions[i * 3 + 2] += sparkVelocities[i * 3 + 2] * dt;
        if (sparkPositions[i * 3 + 1] < 0.02) {
          sparkPositions[i * 3 + 1] = 0.02;
          sparkVelocities[i * 3 + 1] *= -0.3;
        }
        if (sparkLife[i] <= 0) sparkPositions[i * 3 + 1] = -10;
      }
      if (anySpark) sparkGeometry.attributes.position.needsUpdate = true;
      if (blastLife > 0) {
        blastLife -= dt;
        const t = 1 - Math.max(0, blastLife / 0.35);
        const radius = 0.5 + t * 5;
        blastShell.scale.setScalar(radius);
        blastShell.material.opacity = Math.max(0, 0.7 * (1 - t));
        blastLight.intensity = Math.max(0, 60 * (1 - t));
        if (blastLife <= 0) {
          blastShell.visible = false;
          blastLight.intensity = 0;
        }
      }
    },
  };
}
