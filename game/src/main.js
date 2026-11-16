// DUSTLINE — Sector 7. Boot and the one loop: a fixed 60 Hz simulation feeding
// a render at the display's rate. This file owns the player: movement, shooting,
// buying, planting, grenades, and the round machine that ties the modules
// together. Bots, the bomb and the match state live in their own modules.
// ?shot=spawn|combat|site|round with &seed=N stages a deterministic frame for a
// capture, renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { MAP, inSite } from './map.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createBody, createMover } from './mover.js';
import { WEAPONS, GRENADE, createGun, gunStep, gunFire, gunReload, gunSpread, gunDamageAt } from './weapons.js';
import { createViewModel } from './viewmodel.js';
import { createEffects } from './effects.js';
import { createGrenades, explosionDamage } from './grenades.js';
import { createBomb, PLANT_TIME, DEFUSE_TIME, BOMB_TIMER } from './bomb.js';
import { createBots } from './bots.js';
import { createMatch, BUY_SECONDS, ROUND_SECONDS, END_SECONDS, START_MONEY } from './match.js';
import { createHud } from './hud.js';

const FIXED_STEP = 1 / 60;
const WALK_SPEED = 5.2;
const CROUCH_SPEED = 2.4;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const random = mulberry32(seed);

// --- Renderer, scene, camera -------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 200);
scene.add(camera);

// --- World and systems -------------------------------------------------------
const world = createWorld(scene);
const mover = createMover(world.colliders);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud();
const match = createMatch();
const bomb = createBomb(scene);
const viewmodel = createViewModel(camera);

const player = {
  id: 'player',
  name: 'You',
  team: 'attackers',
  isPlayer: true,
  body: createBody(0, 28),
  health: 100,
  alive: true,
  sidearm: createGun(WEAPONS.pistol),
  primary: null,
  current: 'sidearm',
  frags: 0,
  money: START_MONEY,
  kills: 0,
  deaths: 0,
  diedLastRound: false,
};

// The player's hitbox: invisible material, still raycastable, so bots can
// shoot the player with the same raycast the player uses on them.
const hitboxMaterial = new THREE.MeshBasicMaterial({ visible: false });
const playerTorso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), hitboxMaterial);
const playerHead = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), hitboxMaterial);
playerTorso.userData.fighter = player;
playerTorso.userData.part = 'torso';
playerHead.userData.fighter = player;
playerHead.userData.part = 'head';
scene.add(playerTorso, playerHead);

const fighters = [player];
const bots = createBots({
  scene,
  mover,
  shootables: world.shootables,
  effects,
  audio,
  random,
  damage: (target, amount, attacker, headshot, point) => damageFighter(target, amount, attacker, headshot, point),
  onShot: (bot) => bots.hearShot(bot.body.position, bot.team, elapsed),
  onPlantTick: (bot, dt) => plantTick(bot, dt),
  onDefuseTick: (bot, dt) => defuseTick(bot, dt),
  onPickup: (bot) => pickupBomb(bot),
});
for (const bot of bots.list) fighters.push(bot);
const botHitMeshes = bots.hitMeshes;
const allHitMeshes = botHitMeshes.concat([playerTorso, playerHead]);

const grenades = createGrenades(scene, mover, effects, audio, (point) => {
  for (const fighter of fighters) {
    if (!fighter.alive) continue;
    const chest = new THREE.Vector3(fighter.body.position.x, fighter.body.position.y + 1.2, fighter.body.position.z);
    const damage = explosionDamage(point, chest, mover);
    if (damage > 0) damageFighter(fighter, damage, player, false, chest);
  }
});

const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const shootDirection = new THREE.Vector3();
const muzzlePoint = new THREE.Vector3();
const tmpVector = new THREE.Vector3();

let elapsed = 0;
let started = false;
let frozen = false;
let accumulator = 0;
let lastTime = performance.now();
let planting = false;
let defusing = false;
let stepDistance = 0;
let fovCurrent = 74;

const input = createInput(renderer.domElement, onLockChange);
hud.onPlay(onPlayClick);
hud.onBuy((item) => buy(item));

function currentGun() {
  return player.current === 'primary' ? player.primary : player.sidearm;
}

function onPlayClick() {
  if (shot) return;
  audio.unlock();
  if (match.state.phase === 'matchEnd') restartMatch();
  input.requestLock();
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
  } else if (match.state.phase === 'matchEnd') {
    hud.showOverlay('matchEnd', { winner: match.state.matchWinner, attackers: match.state.score.attackers, defenders: match.state.score.defenders });
  } else if (!player.alive) {
    hud.showOverlay('dead');
  } else if (started) {
    hud.showOverlay('paused');
  }
}

function restartMatch() {
  const state = match.state;
  state.score.attackers = 0;
  state.score.defenders = 0;
  state.losses.attackers = 0;
  state.losses.defenders = 0;
  state.round = 1;
  state.matchWinner = null;
  state.killFeed.length = 0;
  state.log.length = 0;
  for (const fighter of fighters) {
    fighter.money = START_MONEY;
    fighter.kills = 0;
    fighter.deaths = 0;
    fighter.frags = 0;
  }
  player.primary = null;
  player.current = 'sidearm';
  resetRound();
}

// --- Rounds ------------------------------------------------------------------
function resetRound() {
  player.body.position.set(0, 0, 28);
  player.body.velocity.set(0, 0, 0);
  player.body.yaw = 0;
  player.body.pitch = 0;
  player.body.crouching = false;
  player.health = 100;
  player.alive = true;
  if (player.diedLastRound) {
    player.primary = null;
    player.current = 'sidearm';
  }
  player.sidearm = createGun(WEAPONS.pistol);
  player.diedLastRound = false;
  bots.resetRound(player);
  bomb.reset(player);
  grenades.clear();
  match.startRound();
  viewmodel.setWeapon(currentGun().def);
  hud.hideBanner();
  hud.setPrompt(null);
  hud.showBuy();
  syncHud();
}

function startLivePhase() {
  match.startLive();
  hud.hideBuy();
  hud.showBanner(`ROUND ${match.state.round}`, match.state.round === 1 ? 'Plant the Device at A or B' : '', 2200);
}

// --- Combat ------------------------------------------------------------------
function damageFighter(target, amount, attacker, headshot, point) {
  if (!target.alive) return;
  target.health -= amount;
  effects.blood(point);
  if (target.isPlayer) {
    audio.hurt();
    const dx = attacker.body.position.x - player.body.position.x;
    const dz = attacker.body.position.z - player.body.position.z;
    const worldAngle = Math.atan2(-dx, -dz);
    let relative = worldAngle - player.body.yaw;
    while (relative > Math.PI) relative -= Math.PI * 2;
    while (relative < -Math.PI) relative += Math.PI * 2;
    hud.damageFrom(-relative);
  } else if (attacker.isPlayer) {
    hud.hitMarker(target.health <= 0);
    audio.hit();
    if (target.health <= 0) audio.kill();
  }
  if (target.health > 0) return;
  target.health = 0;
  target.alive = false;
  match.addKill(attacker, target, headshot, elapsed);
  hud.setKillFeed(match.state.killFeed, elapsed);
  if (bomb.state.carrier === target) {
    if (target.ai) target.ai.isCarrier = false;
    bomb.drop(target.body.position);
  }
  if (target.isPlayer) {
    player.diedLastRound = true;
    input.exitLock();
    hud.showOverlay('dead');
  }
}

function playerShoot() {
  const gun = currentGun();
  if (!gunFire(gun)) {
    if (gun.mag === 0 && gun.reloadLeft <= 0) audio.dryFire();
    return;
  }
  const body = player.body;
  scene.updateMatrixWorld(true);
  camera.getWorldDirection(shootDirection);
  const speed = Math.hypot(body.velocity.x, body.velocity.z);
  const scoped = input.state.scoped && gun.def.id === 'sniper';
  const spread = gunSpread(gun, speed, !body.onGround, body.crouching, scoped);
  shootDirection.x += (random() * 2 - 1) * spread;
  shootDirection.y += (random() * 2 - 1) * spread;
  shootDirection.z += (random() * 2 - 1) * spread;
  shootDirection.normalize();
  raycaster.set(camera.position, shootDirection);
  const hit = raycaster.intersectObjects(world.shootables.concat(botHitMeshes), false)[0];
  const end = hit ? hit.point : tmpVector.copy(camera.position).addScaledVector(shootDirection, 80);
  viewmodel.muzzleWorld(muzzlePoint);
  effects.tracer(muzzlePoint, end);
  viewmodel.pullTrigger();
  audio.shoot(gun.def.id, 0);
  bots.hearShot(body.position, 'attackers', elapsed);
  body.pitch = Math.min(1.45, body.pitch + gun.def.kick * (0.8 + random() * 0.5));
  body.yaw += (random() * 2 - 1) * gun.def.kick * 0.35;
  if (!hit) return;
  const fighter = hit.object.userData.fighter;
  if (fighter && fighter.team !== 'attackers' && fighter.alive) {
    const headshot = hit.object.userData.part === 'head';
    const distance = camera.position.distanceTo(hit.point);
    damageFighter(fighter, gunDamageAt(gun.def, distance, headshot), player, headshot, hit.point);
  } else if (!fighter) {
    effects.impact(hit.point);
  }
  hud.setAmmo(gun.mag, gun.reserve, gun.def.name, player.frags);
}

function throwGrenade() {
  if (player.frags <= 0 || !player.alive) return;
  player.frags -= 1;
  scene.updateMatrixWorld(true);
  camera.getWorldDirection(shootDirection);
  tmpVector.copy(camera.position).addScaledVector(shootDirection, 0.5);
  grenades.throwFrom(tmpVector, shootDirection, player.body.velocity);
  audio.click();
  hud.setAmmo(currentGun().mag, currentGun().reserve, currentGun().def.name, player.frags);
}

// --- Bomb: plant, defuse, pickup ---------------------------------------------
function plantTick(planter, dt) {
  planting = true;
  bomb.state.plantProgress += dt;
  audio.plantTick();
  if (bomb.state.plantProgress >= PLANT_TIME) {
    const site = inSite(MAP.sites.A, planter.body.position.x, planter.body.position.z) ? 'A' : 'B';
    bomb.plant(site, planter.body.position);
    match.state.log.push(`Device planted at ${site} by ${planter.name}`);
    if (planter.isPlayer) hud.showBanner('DEVICE PLANTED', `Defend site ${site} — ${BOMB_TIMER} seconds`, 2500);
  }
}

function defuseTick(defuser, dt) {
  defusing = true;
  bomb.state.defuseProgress += dt;
  if (bomb.state.defuseProgress >= DEFUSE_TIME) {
    bomb.defuse();
    match.state.log.push(`Device defused by ${defuser.name}`);
  }
}

function pickupBomb(fighter) {
  if (bomb.state.mode !== 'dropped') return;
  bomb.pickup(fighter);
  if (fighter.ai) fighter.ai.isCarrier = true;
  if (fighter.isPlayer) hud.showBanner('DEVICE RECOVERED', 'Plant it at A or B', 2000);
}

function playerPlantAttempt(dt) {
  if (!player.alive || bomb.state.carrier !== player) return;
  const inA = inSite(MAP.sites.A, player.body.position.x, player.body.position.z);
  const inB = inSite(MAP.sites.B, player.body.position.x, player.body.position.z);
  if (!inA && !inB) return;
  if (!input.state.keys.has('KeyE')) return;
  const moving = input.state.keys.has('KeyW') || input.state.keys.has('KeyA') || input.state.keys.has('KeyS') || input.state.keys.has('KeyD');
  if (moving) return;
  plantTick(player, dt);
}

// --- Buying --------------------------------------------------------------------
function buy(item) {
  if (match.state.phase !== 'buy' || !player.alive) {
    audio.denied();
    return;
  }
  if (item === 'grenade') {
    if (player.frags >= GRENADE.maxCarry || player.money < GRENADE.price) {
      audio.denied();
      return;
    }
    player.money -= GRENADE.price;
    player.frags += 1;
  } else {
    const def = WEAPONS[item];
    if (!def || player.money < def.price) {
      audio.denied();
      return;
    }
    if (player.primary && player.primary.def.id === item) {
      audio.denied();
      return;
    }
    player.money -= def.price;
    player.primary = createGun(def);
    player.current = 'primary';
    viewmodel.setWeapon(def);
  }
  audio.buy();
  hud.setMoney(player.money);
  const gun = currentGun();
  hud.setAmmo(gun.mag, gun.reserve, gun.def.name, player.frags);
}

// --- Fixed-step simulation ------------------------------------------------------
function step(dt) {
  elapsed += dt;
  const state = match.state;

  if (state.phase === 'buy' || state.phase === 'live' || state.phase === 'end') {
    state.phaseTime -= dt;
  }

  // Phase transitions.
  if (state.phase === 'buy' && state.phaseTime <= 0) {
    startLivePhase();
  } else if (state.phase === 'end' && state.phaseTime <= 0) {
    if (state.matchWinner) {
      match.finishMatch();
      input.exitLock();
      hud.showOverlay('matchEnd', { winner: state.matchWinner, attackers: state.score.attackers, defenders: state.score.defenders });
    } else {
      match.nextRound();
      resetRound();
    }
  }

  const body = player.body;
  const pressed = input.consumePressed();

  // Buy menu and weapon switching.
  if (pressed.has('KeyB') && state.phase === 'buy' && player.alive) {
    if (hud.buyOpen()) hud.hideBuy();
    else hud.showBuy();
  }
  if (hud.buyOpen()) {
    if (pressed.has('Digit1')) buy('rifle');
    if (pressed.has('Digit2')) buy('smg');
    if (pressed.has('Digit3')) buy('sniper');
    if (pressed.has('Digit4')) buy('grenade');
    if (pressed.has('Escape')) hud.hideBuy();
  } else {
    if (pressed.has('Digit1') && player.primary) {
      player.current = 'primary';
      viewmodel.setWeapon(player.primary.def);
    }
    if (pressed.has('Digit2')) {
      player.current = 'sidearm';
      viewmodel.setWeapon(player.sidearm.def);
    }
  }
  if (pressed.has('KeyG')) throwGrenade();
  if (pressed.has('KeyR') && gunReload(currentGun())) audio.reload();

  // Player movement.
  if (player.alive && (state.phase === 'buy' || state.phase === 'live')) {
    const keys = input.state.keys;
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const crouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    const walk = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = body.crouching ? CROUCH_SPEED : walk ? WALK_SPEED * 0.55 : WALK_SPEED;
    let wishX = 0;
    let wishZ = 0;
    if (forward || strafe) {
      const sin = Math.sin(body.yaw);
      const cos = Math.cos(body.yaw);
      wishX = -sin * forward + cos * strafe;
      wishZ = -cos * forward - sin * strafe;
      const length = Math.hypot(wishX, wishZ) || 1;
      wishX /= length;
      wishZ /= length;
    }
    mover.drive(body, wishX, wishZ, speed, crouch, dt, keys.has('Space'));
    const moved = Math.hypot(body.velocity.x, body.velocity.z) * dt;
    stepDistance += moved;
    if (stepDistance > 2.4 && body.onGround && moved > 0) {
      stepDistance = 0;
      if (!walk) audio.step(0);
    }
  } else {
    mover.drive(body, 0, 0, 0, false, dt, false);
  }

  // Player shooting: hold for autos, one click per shot for semi-autos.
  if (player.alive && state.phase === 'live') {
    const gun = currentGun();
    const wantFire = gun.def.auto ? input.state.firing : pressed.has('MouseLeft');
    if (wantFire) playerShoot();
  }
  gunStep(player.sidearm, dt);
  if (player.primary) gunStep(player.primary, dt);

  // Bomb: planting (player or carrier bot), the timer, pickup.
  planting = false;
  defusing = false;
  if (state.phase === 'live') {
    playerPlantAttempt(dt);
    if (bomb.state.mode === 'dropped' && player.alive) {
      const distance = Math.hypot(bomb.state.position.x - body.position.x, bomb.state.position.z - body.position.z);
      if (distance < 1.4) pickupBomb(player);
    }
  }
  bots.step(dt, elapsed, fighters, bomb, state.phase);
  if (state.phase === 'live') {
    if (!planting) bomb.state.plantProgress = Math.max(0, bomb.state.plantProgress - dt * 2);
    if (!defusing) bomb.state.defuseProgress = Math.max(0, bomb.state.defuseProgress - dt * 2);
    const result = bomb.step(dt, elapsed, (fast) => audio.bombBeep(fast));
    if (result === 'detonated') {
      effects.explosion(bomb.state.position);
      audio.explode(0);
    }
  }

  grenades.step(dt, fighters);

  // Round end.
  if (state.phase === 'live') {
    const end = match.checkEnd(fighters, bomb.state.mode);
    if (end) {
      match.endRound(end.winner, end.reason, fighters);
      const playerWon = end.winner === 'attackers';
      hud.showBanner(playerWon ? 'VIPERS WIN' : 'WARDENS WIN', end.reason, 3800);
      if (playerWon) audio.roundWin();
      else audio.roundLose();
      hud.hideBuy();
    }
  }

  viewmodel.step(dt, Math.hypot(body.velocity.x, body.velocity.z), currentGun().reloadLeft > 0);
  effects.step(dt);
  syncHud();
}

function syncHud() {
  const state = match.state;
  hud.setHealth(player.health);
  hud.setMoney(player.money);
  const gun = currentGun();
  hud.setAmmo(gun.mag, gun.reserve, gun.def.name, player.frags);
  hud.setMatch(state.score.attackers, state.score.defenders, state.round, state.phase, state.phaseTime);
  hud.setKillFeed(state.killFeed, elapsed);
  const scoped = input.state.scoped && gun.def.id === 'sniper' && player.alive;
  hud.setScoped(scoped);

  // Crosshair gap follows the live spread.
  const body = player.body;
  const speed = Math.hypot(body.velocity.x, body.velocity.z);
  const spread = gunSpread(gun, speed, !body.onGround, body.crouching, scoped);
  hud.setCrosshair(6 + spread * 900);

  // Bomb status line.
  if (bomb.state.mode === 'planted') {
    hud.setBomb(`DEVICE PLANTED AT ${bomb.state.site} — ${Math.ceil(bomb.state.timer)}s`, bomb.state.timer / BOMB_TIMER);
  } else if (bomb.state.mode === 'carried' && bomb.state.carrier === player) {
    hud.setBomb('YOU CARRY THE DEVICE — reach A or B, hold E to plant', 0);
  } else if (bomb.state.mode === 'carried') {
    hud.setBomb(`${bomb.state.carrier.name} carries the Device`, 0);
  } else if (bomb.state.mode === 'dropped') {
    hud.setBomb('DEVICE DROPPED — pick it up', 0);
  } else {
    hud.setBomb('', 0);
  }

  // Interact prompt.
  if (player.alive && state.phase === 'live' && bomb.state.carrier === player) {
    const inA = inSite(MAP.sites.A, body.position.x, body.position.z);
    const inB = inSite(MAP.sites.B, body.position.x, body.position.z);
    if (inA || inB) {
      const progress = bomb.state.plantProgress;
      hud.setPrompt(progress > 0 ? `Planting… ${Math.round((progress / PLANT_TIME) * 100)}%` : 'Hold E to plant the Device');
    } else {
      hud.setPrompt(null);
    }
  } else {
    hud.setPrompt(null);
  }
}

function syncCamera() {
  const body = player.body;
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
  const gun = currentGun();
  const scoped = input.state.scoped && gun.def.id === 'sniper' && player.alive;
  const targetFov = scoped ? 28 : 74;
  if (Math.abs(fovCurrent - targetFov) > 0.1) {
    fovCurrent += (targetFov - fovCurrent) * 0.25;
    camera.fov = fovCurrent;
    camera.updateProjectionMatrix();
  }
  playerTorso.position.set(body.position.x, body.position.y + 1.11, body.position.z);
  playerHead.position.set(body.position.x, body.position.y + 1.57, body.position.z);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    if (player.alive) {
      const sensitivity = input.state.scoped && currentGun().def.id === 'sniper' ? 0.0009 : 0.0022;
      player.body.yaw -= look.x * sensitivity;
      player.body.pitch = Math.max(-1.45, Math.min(1.45, player.body.pitch - look.y * sensitivity));
    }
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    bots.sync(dt);
    syncCamera();
    hud.drawMinimap(player, bots.list.filter((bot) => bot.team === 'attackers'), bomb);
  }
  renderer.render(scene, camera);
}

// --- Screenshot staging --------------------------------------------------------
function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function aimAt(point) {
  const body = player.body;
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function placeBot(bot, x, z, yaw) {
  bot.body.position.set(x, 0, z);
  bot.body.velocity.set(0, 0, 0);
  bot.body.yaw = yaw;
  bot.alive = true;
  bot.health = 100;
  bot.ai.waypointIndex = 999;
  bot.ai.state = 'hold';
  bot.model.group.position.copy(bot.body.position);
  bot.model.group.rotation.set(0, yaw, 0);
}

function runShot(name) {
  hud.hideOverlay();
  const wardens = bots.list.filter((bot) => bot.team === 'defenders');
  const vipers = bots.list.filter((bot) => bot.team === 'attackers');

  if (name === 'spawn') {
    // Buy phase at the attacker spawn, menu open, looking up the mid lane.
    resetRound();
    player.body.position.set(0, 0, 27);
    player.body.yaw = 0;
    player.body.pitch = 0.02;
    settle(10);
    hud.showBuy();
  } else if (name === 'combat') {
    // Mid-round firefight: the player fires on a Warden in the courtyard.
    resetRound();
    match.startLive();
    hud.hideBuy();
    match.state.phaseTime = 72;
    player.money = 3050;
    player.primary = createGun(WEAPONS.rifle);
    player.current = 'primary';
    viewmodel.setWeapon(WEAPONS.rifle);
    player.body.position.set(0, 0, 5);
    placeBot(wardens[0], 2, -7, Math.PI);
    placeBot(wardens[1], -5, -11, Math.PI);
    placeBot(vipers[0], -3, 9, 0);
    // A Warden the player already dropped, lying in the courtyard.
    wardens[2].alive = false;
    wardens[2].health = 0;
    wardens[2].ai.fall = 1;
    wardens[2].body.position.set(4, 0, -2);
    wardens[2].body.yaw = Math.PI * 0.5;
    settle(10);
    match.addKill(player, wardens[2], false, elapsed);
    hud.setKillFeed(match.state.killFeed, elapsed);
    aimAt(new THREE.Vector3(2, 1.3, -7));
    settle(2);
    playerShoot();
    hud.setAmmo(currentGun().mag, currentGun().reserve, currentGun().def.name, player.frags);
  } else if (name === 'site') {
    // The Device planted at B; a Warden closes in to defuse.
    resetRound();
    match.startLive();
    hud.hideBuy();
    match.state.phaseTime = 41;
    match.state.score.attackers = 2;
    match.state.score.defenders = 1;
    match.state.round = 4;
    player.money = 4700;
    player.primary = createGun(WEAPONS.rifle);
    player.current = 'primary';
    viewmodel.setWeapon(WEAPONS.rifle);
    bomb.plant('B', new THREE.Vector3(24, 0, -20));
    bomb.state.timer = 23.4;
    player.body.position.set(16, 0, -9);
    placeBot(wardens[0], 21, -17, Math.PI * 0.75);
    placeBot(vipers[0], 14, -13, 0);
    settle(10);
    aimAt(new THREE.Vector3(24, 0.6, -20));
  } else {
    // Round won: the banner over the yard, score 3–1.
    resetRound();
    hud.hideBuy();
    match.state.score.attackers = 3;
    match.state.score.defenders = 1;
    match.state.round = 5;
    match.state.phase = 'end';
    match.state.phaseTime = 3;
    match.state.roundWinner = 'attackers';
    bomb.state.mode = 'detonated';
    bomb.state.carrier = null;
    player.money = 6250;
    player.kills = 7;
    player.primary = createGun(WEAPONS.rifle);
    player.current = 'primary';
    viewmodel.setWeapon(WEAPONS.rifle);
    player.body.position.set(0, 0, -2);
    player.body.yaw = 0.3;
    placeBot(vipers[0], -4, -6, 0);
    placeBot(vipers[1], 4, -8, -0.4);
    settle(10);
    hud.showBanner('VIPERS WIN', 'Device detonated', 60000);
  }
  syncHud();
  bots.sync(0.016);
  syncCamera();
  hud.drawMinimap(player, bots.list.filter((bot) => bot.team === 'attackers'), bomb);
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      document.title = 'SHOT READY';
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Boot: one round staged so the first frame behind the start overlay is the
// yard at dusk, then the loop (or the staged shot) takes over.
resetRound();
syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
