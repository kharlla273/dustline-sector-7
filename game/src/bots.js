// The bots: nine opponents and teammates with a small state machine each.
// They follow routes through the map, hold positions with a facing, see enemies
// by line of sight, hear nearby gunfire, and fight back in bursts with an aim
// error that shrinks the longer they hold a target. The carrier plants the
// Device at its site; defenders run to defuse once it is planted. Perception
// runs staggered, ten times a second per bot, against the collider list.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { MAP } from './map.js';
import { createBody } from './mover.js';
import { WEAPONS, createGun, gunStep, gunFire, gunReload, gunDamageAt } from './weapons.js';
import { range, pick, shuffle } from './rng.js';

const BOT_SPEED = 4.6;
const THINK_INTERVAL = 0.12;
const HEAR_RANGE = 30;
const REACTION_MIN = 0.4;
const REACTION_MAX = 0.7;

const VIPER_NAMES = ['Rook', 'Fennec', 'Havoc', 'Sable'];
const WARDEN_NAMES = ['Bastion', 'Garrison', 'Sentry', 'Bulwark', 'Vigil'];

const ATTACK_ROUTES = ['attackWest', 'attackMidA', 'attackMidB', 'attackEast'];
const DEFEND_ROUTES = ['defendA1', 'defendA2', 'defendB1', 'defendB2', 'defendMid'];

function buildModel(scene, team) {
  const teamColor = team === 'attackers' ? PALETTE.teal : PALETTE.amber;
  const torsoMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor), roughness: 0.7, metalness: 0.1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2c3138'), roughness: 0.85, metalness: 0.05 });
  const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a582'), roughness: 0.7, metalness: 0 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor), roughness: 0.5, metalness: 0.3 });
  const gunMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1c1f24'), roughness: 0.5, metalness: 0.5 });

  const group = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), torsoMat);
  torso.position.y = 1.11;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), headMat);
  head.position.y = 1.57;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
  helmet.position.y = 1.59;
  const legL = new THREE.Group();
  legL.position.set(-0.14, 0.8, 0);
  const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.18), darkMat);
  legLMesh.position.y = -0.4;
  legL.add(legLMesh);
  const legR = new THREE.Group();
  legR.position.set(0.14, 0.8, 0);
  const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.18), darkMat);
  legRMesh.position.y = -0.4;
  legR.add(legRMesh);
  const gun = new THREE.Group();
  gun.position.set(0.2, 1.32, -0.2);
  const gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.55), gunMat);
  gunMesh.position.z = -0.2;
  gun.add(gunMesh);
  group.add(torso, head, helmet, legL, legR, gun);
  group.traverse((mesh) => {
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  scene.add(group);
  return { group, torso, head, legL, legR, gun };
}

export function createBots(deps) {
  const { scene, mover, shootables, effects, audio, random } = deps;
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;
  const bots = [];
  const hitMeshes = [];
  const eye = new THREE.Vector3();
  const chest = new THREE.Vector3();
  const aimDir = new THREE.Vector3();
  const wish = new THREE.Vector3();

  function spawnBot(team, name, spawn, routeName, weaponId) {
    const body = createBody(spawn[0], spawn[1]);
    body.yaw = team === 'attackers' ? 0 : Math.PI;
    const model = buildModel(scene, team);
    const bot = {
      id: `bot-${team}-${name}`,
      name,
      team,
      isPlayer: false,
      body,
      health: 100,
      alive: true,
      gun: createGun(WEAPONS[weaponId]),
      frags: 0,
      money: 800,
      kills: 0,
      deaths: 0,
      model,
      ai: {
        state: 'advance',
        route: MAP.routes[routeName],
        waypointIndex: 0,
        target: null,
        visibleSince: 0,
        lastSeen: new THREE.Vector3(),
        aimError: 0.06,
        reactionAt: 0,
        burstLeft: 0,
        burstPauseUntil: 0,
        thinkAt: random() * THINK_INTERVAL,
        heardAt: -10,
        heardPos: new THREE.Vector3(),
        stuckSince: 0,
        lastProgress: new THREE.Vector3(spawn[0], 0, spawn[1]),
        strafeDir: 1,
        strafeAt: 0,
        scanPhase: random() * Math.PI * 2,
        isCarrier: false,
        fall: 0,
        walkPhase: 0,
      },
    };
    model.torso.userData.fighter = bot;
    model.torso.userData.part = 'torso';
    model.head.userData.fighter = bot;
    model.head.userData.part = 'head';
    hitMeshes.push(model.torso, model.head);
    bots.push(bot);
    return bot;
  }

  function resetRound(carrier) {
    const attackRoutes = shuffle(random, ATTACK_ROUTES.concat(['attackMidA', 'attackMidB'])).slice(0, 4);
    const defendRoutes = shuffle(random, DEFEND_ROUTES);
    let attackIndex = 0;
    let defendIndex = 0;
    for (const bot of bots) {
      const spawns = MAP.spawns[bot.team];
      const spawn = spawns[bot.team === 'attackers' ? attackIndex + 1 : defendIndex];
      if (bot.team === 'attackers') attackIndex += 1;
      else defendIndex += 1;
      bot.body.position.set(spawn[0], 0, spawn[1]);
      bot.body.velocity.set(0, 0, 0);
      bot.body.yaw = bot.team === 'attackers' ? 0 : Math.PI;
      bot.body.pitch = 0;
      bot.health = 100;
      bot.alive = true;
      bot.gun = createGun(bot.gun.def);
      bot.ai.state = 'advance';
      bot.ai.route = MAP.routes[bot.team === 'attackers' ? attackRoutes[attackIndex - 1] : defendRoutes[defendIndex - 1]];
      bot.ai.waypointIndex = 0;
      bot.ai.target = null;
      bot.ai.aimError = 0.06;
      bot.ai.burstLeft = 0;
      bot.ai.fall = 0;
      bot.ai.isCarrier = bot === carrier;
      bot.ai.heardAt = -10;
      bot.model.group.rotation.set(0, bot.body.yaw, 0);
      bot.model.group.position.copy(bot.body.position);
      bot.model.group.visible = true;
    }
  }

  function eyeOf(fighter) {
    eye.set(fighter.body.position.x, fighter.body.position.y + fighter.body.eye, fighter.body.position.z);
    return eye;
  }

  function chestOf(fighter) {
    chest.set(fighter.body.position.x, fighter.body.position.y + 1.2, fighter.body.position.z);
    return chest;
  }

  function visible(from, to) {
    const fromEye = eyeOf(from);
    const toChest = chestOf(to);
    return !mover.segmentBlocked(fromEye, toChest);
  }

  function faceToward(bot, point, dt, rate = 6) {
    const dx = point.x - bot.body.position.x;
    const dz = point.z - bot.body.position.z;
    const targetYaw = Math.atan2(-dx, -dz);
    let diff = targetYaw - bot.body.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    bot.body.yaw += Math.max(-rate * dt, Math.min(rate * dt, diff));
  }

  function think(bot, now, fighters, bomb) {
    const ai = bot.ai;
    // Perception: nearest visible enemy.
    let nearest = null;
    let nearestDistance = Infinity;
    for (const other of fighters) {
      if (other === bot || !other.alive || other.team === bot.team) continue;
      const distance = bot.body.position.distanceTo(other.body.position);
      if (distance > 70) continue;
      if (!visible(bot, other)) continue;
      if (distance < nearestDistance) {
        nearest = other;
        nearestDistance = distance;
      }
    }
    if (nearest) {
      if (ai.target !== nearest) {
        ai.target = nearest;
        ai.visibleSince = now;
        ai.reactionAt = now + range(random, REACTION_MIN, REACTION_MAX);
        ai.aimError = 0.06;
      }
      ai.lastSeen.copy(nearest.body.position);
      ai.aimError = Math.max(0.015, ai.aimError - 0.05 * THINK_INTERVAL);
    } else if (ai.target) {
      // Lost sight: keep the last known spot for a second, then forget.
      if (now - ai.visibleSince > 1.2) ai.target = null;
    }

    // State selection.
    if (ai.target) {
      ai.state = 'engage';
    } else if (bomb.state.mode === 'planted' && bot.team === 'defenders') {
      ai.state = 'defuse';
    } else if (bomb.state.mode === 'dropped' && bot.team === 'attackers') {
      ai.state = 'fetch';
    } else if (ai.isCarrier && ai.waypointIndex >= ai.route.points.length) {
      ai.state = 'plant';
    } else if (ai.waypointIndex >= ai.route.points.length) {
      ai.state = 'hold';
    } else {
      ai.state = 'advance';
    }
  }

  function shootAt(bot, now, fighters) {
    const ai = bot.ai;
    const target = ai.target;
    if (!target || !target.alive) return;
    if (now < ai.reactionAt) return;
    if (now < ai.burstPauseUntil) return;
    if (ai.burstLeft <= 0) {
      ai.burstLeft = 3 + ((random() * 3) | 0);
      ai.burstPauseUntil = now + range(random, 0.5, 1.0) + ai.burstLeft * bot.gun.def.fireGap;
    }
    if (!gunFire(bot.gun)) {
      if (bot.gun.mag === 0) gunReload(bot.gun);
      return;
    }
    ai.burstLeft -= 1;
    const muzzle = eyeOf(bot);
    const aimAt = chestOf(target);
    if (random() < 0.15) aimAt.y = target.body.position.y + 1.57; // head
    aimDir.subVectors(aimAt, muzzle).normalize();
    const error = ai.aimError + (bot.body.velocity.length() > 1 ? 0.02 : 0);
    aimDir.x += (random() * 2 - 1) * error;
    aimDir.y += (random() * 2 - 1) * error;
    aimDir.z += (random() * 2 - 1) * error;
    aimDir.normalize();
    raycaster.set(muzzle, aimDir);
    const targets = shootables.concat(hitMeshes);
    const hit = raycaster.intersectObjects(targets, false)[0];
    const end = hit ? hit.point : muzzle.clone().addScaledVector(aimDir, 60);
    effects.tracer(muzzle, end);
    audio.shoot(bot.gun.def.id, 0);
    deps.onShot(bot);
    if (!hit) return;
    const fighter = hit.object.userData.fighter;
    if (fighter && fighter.team !== bot.team && fighter.alive) {
      const headshot = hit.object.userData.part === 'head';
      const distance = muzzle.distanceTo(hit.point);
      deps.damage(fighter, gunDamageAt(bot.gun.def, distance, headshot), bot, headshot, hit.point);
    } else if (!fighter) {
      effects.impact(hit.point);
    }
  }

  function moveToward(bot, point, dt, speed) {
    const dx = point.x - bot.body.position.x;
    const dz = point.z - bot.body.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.05) return true;
    wish.set(dx / distance, 0, dz / distance);
    const blocked = mover.drive(bot.body, wish.x, wish.z, speed, false, dt, false);
    faceToward(bot, point, dt, 8);
    // Stuck: jumping clears low cover; skipping the waypoint clears the rest.
    if (bot.body.position.distanceTo(bot.ai.lastProgress) > 0.4) {
      bot.ai.lastProgress.copy(bot.body.position);
      bot.ai.stuckSince = 0;
    } else {
      bot.ai.stuckSince += dt;
      if (bot.ai.stuckSince > 0.6 && bot.body.onGround) {
        bot.body.velocity.y = 6.4;
        bot.body.onGround = false;
      }
      if (bot.ai.stuckSince > 2.5) {
        bot.ai.stuckSince = 0;
        bot.ai.waypointIndex += 1;
      }
    }
    return distance < 1.4;
  }

  function stepBot(bot, dt, now, fighters, bomb, phase) {
    const ai = bot.ai;
    gunStep(bot.gun, dt);
    if (!bot.alive) {
      ai.fall = Math.min(1, ai.fall + dt / 0.4);
      return;
    }
    if (phase !== 'live') {
      mover.drive(bot.body, 0, 0, 0, false, dt, false);
      return;
    }
    if (now >= ai.thinkAt) {
      ai.thinkAt = now + THINK_INTERVAL;
      think(bot, now, fighters, bomb);
    }

    if (ai.state === 'engage' && ai.target) {
      faceToward(bot, ai.lastSeen, dt, 10);
      // Strafe across the line of fire, switching direction regularly.
      if (now >= ai.strafeAt) {
        ai.strafeAt = now + range(random, 0.6, 1.3);
        ai.strafeDir = random() < 0.5 ? -1 : 1;
      }
      const dx = ai.lastSeen.x - bot.body.position.x;
      const dz = ai.lastSeen.z - bot.body.position.z;
      const length = Math.hypot(dx, dz) || 1;
      mover.drive(bot.body, (-dz / length) * ai.strafeDir, (dx / length) * ai.strafeDir, BOT_SPEED * 0.5, false, dt, false);
      shootAt(bot, now, fighters);
    } else if (ai.state === 'advance') {
      const route = ai.route;
      const point = route.points[Math.min(ai.waypointIndex, route.points.length - 1)];
      if (moveToward(bot, { x: point[0], z: point[1] }, dt, BOT_SPEED)) {
        ai.waypointIndex += 1;
      }
      // Hear a shot while advancing: glance toward it.
      if (now - ai.heardAt < 2) faceToward(bot, ai.heardPos, dt, 4);
    } else if (ai.state === 'hold') {
      mover.drive(bot.body, 0, 0, 0, false, dt, false);
      const hold = ai.route.hold;
      if (hold) {
        ai.scanPhase += dt * 0.5;
        const scan = { x: hold.lookAt[0] + Math.sin(ai.scanPhase) * 4, z: hold.lookAt[1] };
        faceToward(bot, scan, dt, 3);
      }
      if (now - ai.heardAt < 2) faceToward(bot, ai.heardPos, dt, 5);
    } else if (ai.state === 'plant') {
      mover.drive(bot.body, 0, 0, 0, false, dt, false);
      deps.onPlantTick(bot, dt);
    } else if (ai.state === 'fetch') {
      const bombPos = bomb.state.position;
      if (moveToward(bot, { x: bombPos.x, z: bombPos.z }, dt, BOT_SPEED)) {
        deps.onPickup(bot);
      }
    } else if (ai.state === 'defuse') {
      const bombPos = bomb.state.position;
      const distance = Math.hypot(bombPos.x - bot.body.position.x, bombPos.z - bot.body.position.z);
      if (distance > 1.8) {
        moveToward(bot, { x: bombPos.x, z: bombPos.z }, dt, BOT_SPEED);
      } else {
        mover.drive(bot.body, 0, 0, 0, false, dt, false);
        faceToward(bot, bombPos, dt, 6);
        deps.onDefuseTick(bot, dt);
      }
    }
  }

  function syncModel(bot, dt) {
    const model = bot.model;
    const body = bot.body;
    model.group.position.copy(body.position);
    if (!bot.alive) {
      model.group.rotation.set(-aiFall(bot), body.yaw, 0);
      model.group.position.y = -bot.ai.fall * 0.1;
      return;
    }
    model.group.rotation.set(0, body.yaw, 0);
    const speed = Math.hypot(body.velocity.x, body.velocity.z);
    bot.ai.walkPhase += dt * (4 + speed * 1.8);
    const swing = Math.min(1, speed / BOT_SPEED) * 0.55;
    model.legL.rotation.x = Math.sin(bot.ai.walkPhase) * swing;
    model.legR.rotation.x = -Math.sin(bot.ai.walkPhase) * swing;
    model.gun.rotation.x = body.pitch * 0.5;
  }

  function aiFall(bot) {
    return bot.ai.fall * 1.45;
  }

  // Create the nine bots: four Viper teammates, five Wardens.
  const viperWeapons = ['rifle', 'rifle', 'smg', 'rifle'];
  VIPER_NAMES.forEach((name, index) => {
    spawnBot('attackers', name, MAP.spawns.attackers[index + 1], ATTACK_ROUTES[index % ATTACK_ROUTES.length], viperWeapons[index]);
  });
  const wardenWeapons = ['rifle', 'smg', 'rifle', 'smg', 'rifle'];
  WARDEN_NAMES.forEach((name, index) => {
    spawnBot('defenders', name, MAP.spawns.defenders[index], DEFEND_ROUTES[index], wardenWeapons[index]);
  });

  return {
    list: bots,
    hitMeshes,
    resetRound,
    step(dt, now, fighters, bomb, phase) {
      for (const bot of bots) stepBot(bot, dt, now, fighters, bomb, phase);
    },
    sync(dt) {
      for (const bot of bots) syncModel(bot, dt);
    },
    hearShot(position, team, now) {
      for (const bot of bots) {
        if (!bot.alive || bot.team === team) continue;
        if (bot.body.position.distanceTo(position) > HEAR_RANGE) continue;
        bot.ai.heardAt = now;
        bot.ai.heardPos.copy(position);
      }
    },
  };
}
