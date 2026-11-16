// The arsenal: four guns and a frag grenade. Each gun is one definition —
// damage, fire rate, magazine, spread and price — and a small state machine
// (cooldown, reload, bloom) that the simulation steps. Spread is the heart of
// the gunplay: still and crouched it is tight, moving or airborne it opens up,
// and every shot blooms it until the shooter pauses. Headshots pay four times.
export const HEADSHOT_MULTIPLIER = 4;

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'P9 Sidearm', slot: 'sidearm', price: 0,
    damage: 34, headDamage: 136, magSize: 12, reserve: 48,
    fireGap: 0.18, auto: false, reloadTime: 1.4,
    spreadStill: 0.006, spreadMove: 0.02, bloomPerShot: 0.004, bloomDecay: 7,
    kick: 0.014, falloffStart: 20, falloffEnd: 45, falloffMin: 0.6,
  },
  rifle: {
    id: 'rifle', name: 'AR-77 Longshot', slot: 'primary', price: 2700,
    damage: 33, headDamage: 132, magSize: 30, reserve: 90,
    fireGap: 0.1, auto: true, reloadTime: 2.2,
    spreadStill: 0.004, spreadMove: 0.024, bloomPerShot: 0.0035, bloomDecay: 6,
    kick: 0.011, falloffStart: 25, falloffEnd: 55, falloffMin: 0.65,
  },
  smg: {
    id: 'smg', name: 'VK-9 Ripper', slot: 'primary', price: 1200,
    damage: 22, headDamage: 88, magSize: 30, reserve: 120,
    fireGap: 0.07, auto: true, reloadTime: 1.9,
    spreadStill: 0.008, spreadMove: 0.03, bloomPerShot: 0.003, bloomDecay: 7,
    spreadCrouch: 0.7, kick: 0.008, falloffStart: 15, falloffEnd: 40, falloffMin: 0.5,
  },
  sniper: {
    id: 'sniper', name: 'LW-50 Vantage', slot: 'primary', price: 4750,
    damage: 110, headDamage: 440, magSize: 5, reserve: 15,
    fireGap: 1.2, auto: false, reloadTime: 3.2,
    spreadStill: 0.0006, spreadMove: 0.05, bloomPerShot: 0.02, bloomDecay: 4,
    spreadScoped: 0.0004, kick: 0.05, falloffStart: 60, falloffEnd: 120, falloffMin: 0.9,
  },
};

export const GRENADE = { name: 'Frag Grenade', price: 300, maxCarry: 2, fuse: 1.6, radius: 6.5, maxDamage: 95, minDamage: 10 };

// One owned gun: its definition plus live state. The player and each bot hold
// their own; the buy menu swaps the primary definition.
export function createGun(definition) {
  return {
    def: definition,
    mag: definition.magSize,
    reserve: definition.reserve,
    cooldown: 0,
    reloadLeft: 0,
    bloom: 0,
  };
}

export function gunReady(gun) {
  return gun.mag > 0 && gun.cooldown <= 0 && gun.reloadLeft <= 0;
}

export function gunStep(gun, dt) {
  gun.cooldown = Math.max(0, gun.cooldown - dt);
  gun.bloom = Math.max(0, gun.bloom - gun.def.bloomDecay * gun.bloom * dt - 0.004 * dt);
  if (gun.reloadLeft > 0) {
    gun.reloadLeft = Math.max(0, gun.reloadLeft - dt);
    if (gun.reloadLeft === 0) {
      const need = gun.def.magSize - gun.mag;
      const take = Math.min(need, gun.reserve);
      gun.mag += take;
      gun.reserve -= take;
    }
  }
}

export function gunFire(gun) {
  if (!gunReady(gun)) return false;
  gun.mag -= 1;
  gun.cooldown = gun.def.fireGap;
  gun.bloom = Math.min(0.06, gun.bloom + gun.def.bloomPerShot);
  return true;
}

export function gunReload(gun) {
  if (gun.reloadLeft > 0 || gun.mag === gun.def.magSize || gun.reserve === 0) return false;
  gun.reloadLeft = gun.def.reloadTime;
  return true;
}

// Spread in radians for a shot: base, plus movement, plus bloom, plus air.
// Crouching tightens it; a scoped sniper standing still is nearly exact.
export function gunSpread(gun, speed, airborne, crouching, scoped) {
  const def = gun.def;
  let spread = def.spreadStill;
  if (scoped && def.spreadScoped) spread = def.spreadScoped;
  spread += Math.min(1, speed / 5.2) * def.spreadMove;
  if (airborne) spread += 0.05;
  if (crouching) spread *= 0.7;
  return spread + gun.bloom;
}

// Damage at a range, with the headshot multiplier applied by the caller.
export function gunDamageAt(def, distance, headshot) {
  let damage = headshot ? def.headDamage : def.damage;
  if (distance > def.falloffStart) {
    const t = Math.min(1, (distance - def.falloffStart) / (def.falloffEnd - def.falloffStart));
    damage *= 1 - (1 - def.falloffMin) * t;
  }
  return damage;
}

export const BUY_MENU = [
  { key: 'Digit1', weapon: 'rifle' },
  { key: 'Digit2', weapon: 'smg' },
  { key: 'Digit3', weapon: 'sniper' },
  { key: 'Digit4', grenade: true },
];
