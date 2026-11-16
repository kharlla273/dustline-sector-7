// Shared movement: one AABB body (the player and every bot) resolved against the
// world's colliders one axis at a time, so a wall never swallows a body. Also the
// segment-versus-box test the bots use for line of sight, which is cheaper than a
// raycast: a bot checks sight against the collider list, not the meshes.
import * as THREE from 'three';

const RADIUS = 0.34;
const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;
const GRAVITY = 20;
const JUMP_SPEED = 6.4;

export function createBody(x, z) {
  return {
    position: new THREE.Vector3(x, 0, z),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    eye: 1.6,
    onGround: true,
    crouching: false,
    height: STAND_HEIGHT,
  };
}

export function createMover(colliders) {
  const probe = new THREE.Box3();
  const segmentDir = new THREE.Vector3();

  function overlaps(x, y, z, height, lift) {
    probe.min.set(x - RADIUS, y + lift, z - RADIUS);
    probe.max.set(x + RADIUS, y + height - lift, z + RADIUS);
    for (const collider of colliders) {
      if (probe.intersectsBox(collider)) return collider;
    }
    return null;
  }

  // Move a body by its velocity for dt, resolving each axis in turn. Returns
  // true when a horizontal wall blocked it (bots jump on that).
  function move(body, dt) {
    let blocked = false;
    const nextX = body.position.x + body.velocity.x * dt;
    if (!overlaps(nextX, body.position.y, body.position.z, body.height, 0.04)) {
      body.position.x = nextX;
    } else {
      body.velocity.x = 0;
      blocked = true;
    }
    const nextZ = body.position.z + body.velocity.z * dt;
    if (!overlaps(body.position.x, body.position.y, nextZ, body.height, 0.04)) {
      body.position.z = nextZ;
    } else {
      body.velocity.z = 0;
      blocked = true;
    }
    body.position.y += body.velocity.y * dt;
    body.onGround = false;
    const hit = overlaps(body.position.x, body.position.y, body.position.z, body.height, 0);
    if (hit && body.velocity.y <= 0) {
      body.position.y = hit.max.y;
      body.velocity.y = 0;
      body.onGround = true;
    } else if (hit) {
      body.position.y = hit.min.y - body.height;
      body.velocity.y = 0;
    }
    if (body.position.y < 0) {
      body.position.y = 0;
      body.velocity.y = 0;
      body.onGround = true;
    }
    body.velocity.y = Math.max(-30, body.velocity.y);
    return blocked;
  }

  // Drive a body toward a wish direction (unit XZ vector, or zero) at `speed`,
  // with acceleration and friction. Crouch shrinks the body; standing back up
  // is refused while the ceiling is low.
  function drive(body, wishX, wishZ, speed, crouch, dt, jump) {
    if (crouch && !body.crouching) {
      body.crouching = true;
      body.height = CROUCH_HEIGHT;
    } else if (!crouch && body.crouching && !overlaps(body.position.x, body.position.y, body.position.z, STAND_HEIGHT, 0.02)) {
      body.crouching = false;
      body.height = STAND_HEIGHT;
    }
    const eyeTarget = body.crouching ? 1.02 : 1.6;
    body.eye += (eyeTarget - body.eye) * Math.min(1, dt * 12);

    const accel = body.onGround ? 42 : 9;
    const blend = Math.min(1, (accel * dt) / Math.max(speed, 0.01));
    body.velocity.x += (wishX * speed - body.velocity.x) * blend;
    body.velocity.z += (wishZ * speed - body.velocity.z) * blend;
    if (body.onGround && wishX === 0 && wishZ === 0) {
      const damp = Math.max(0, 1 - 9 * dt);
      body.velocity.x *= damp;
      body.velocity.z *= damp;
    }
    if (jump && body.onGround) {
      body.velocity.y = JUMP_SPEED;
      body.onGround = false;
    }
    body.velocity.y -= GRAVITY * dt;
    return move(body, dt);
  }

  // True when the segment from `from` to `to` crosses any collider.
  function segmentBlocked(from, to) {
    const dir = segmentDir.subVectors(to, from);
    const length = dir.length();
    if (length === 0) return false;
    dir.divideScalar(length);
    for (const box of colliders) {
      if (rayHitsBox(from, dir, length, box)) return true;
    }
    return false;
  }

  return { move, drive, overlaps, segmentBlocked };
}

// Slab test: does the ray from origin along dir hit the box within `length`?
function rayHitsBox(origin, dir, length, box) {
  let tmin = 0;
  let tmax = length;
  const axes = ['x', 'y', 'z'];
  for (const axis of axes) {
    const o = origin[axis];
    const d = dir[axis];
    const lo = box.min[axis];
    const hi = box.max[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return false;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}
