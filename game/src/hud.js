// The DOM HUD: health, ammo, money, timer, score, kill feed, crosshair,
// hit marker, damage vignette, minimap, buy menu and overlays. It never touches
// the simulation; main.js pushes numbers in and reads the play/buy callbacks
// out. Every setter caches its last value and touches the DOM only on change.
import { WEAPONS, GRENADE, BUY_MENU } from './weapons.js';
import { MAP } from './map.js';

const COPY = {
  start: {
    title: 'DUSTLINE',
    copy: 'Sector 7, dusk. Vipers attack, Wardens defend. Plant the Device at A or B — or eliminate the other team. First to 5 rounds takes the match.',
    action: 'Click to play',
  },
  paused: { title: 'DUSTLINE', copy: 'Paused. Click to resume.', action: 'Click to resume' },
  dead: { title: 'You are down', copy: 'Your team fights on. You return next round.', action: '' },
  matchEnd: { title: '', copy: '', action: 'Play again' },
};

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const overlayTitle = $('overlay-title');
  const overlayCopy = $('overlay-copy');
  const playButton = $('play');
  const crosshair = $('crosshair');
  const hitmarker = $('hitmarker');
  const vignette = $('damage-vignette');
  const damageDir = $('damage-dir');
  const healthFill = $('health-fill');
  const healthNum = $('health-num');
  const moneyValue = $('money-value');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const weaponName = $('weapon-name');
  const fragsValue = $('frags-value');
  const timerValue = $('timer-value');
  const timerLabel = $('timer-label');
  const scoreA = $('score-attackers');
  const scoreD = $('score-defenders');
  const roundNum = $('round-num');
  const killFeedEl = $('killfeed');
  const bombStatus = $('bomb-status');
  const bombBar = $('bomb-bar');
  const promptEl = $('prompt');
  const banner = $('banner');
  const bannerTitle = $('banner-title');
  const bannerSub = $('banner-sub');
  const scope = $('scope');
  const buyMenu = $('buy-menu');
  const buyMoney = $('buy-money');
  const buyItems = $('buy-items');
  const minimap = $('minimap');
  const minimapCtx = minimap.getContext('2d');

  let lastHealth = -1;
  let lastMoney = -1;
  let lastMag = -1;
  let lastReserve = -1;
  let lastWeapon = '';
  let lastFrags = -1;
  let lastTimer = '';
  let lastScore = '';
  let lastBomb = '';
  let lastPrompt = '';
  let lastFeedKey = '';
  let hitTimer = 0;
  let bannerTimer = 0;

  // Minimap: the static layer (walls, sites) is painted once; each frame the
  // dots are drawn over it. Map 76 x 64 m onto 176 x 148 px.
  const mapScale = 176 / 76;
  const mapOffX = 88;
  const mapOffY = 74;
  const staticMap = document.createElement('canvas');
  staticMap.width = 176;
  staticMap.height = 148;
  (function paintStatic() {
    const ctx = staticMap.getContext('2d');
    ctx.fillStyle = '#1d2733';
    ctx.fillRect(0, 0, 176, 148);
    ctx.fillStyle = '#3a4554';
    for (const box of MAP.boxes) {
      ctx.fillRect(
        mapOffX + (box.x - box.w / 2) * mapScale,
        mapOffY + (box.z - box.d / 2) * mapScale,
        box.w * mapScale,
        box.d * mapScale,
      );
    }
    ctx.strokeStyle = '#f2a93b';
    ctx.lineWidth = 1.5;
    for (const site of Object.values(MAP.sites)) {
      ctx.strokeRect(
        mapOffX + site.minX * mapScale,
        mapOffY + site.minZ * mapScale,
        (site.maxX - site.minX) * mapScale,
        (site.maxZ - site.minZ) * mapScale,
      );
    }
    ctx.fillStyle = '#f2a93b';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText('A', mapOffX - 25 * mapScale - 3, mapOffY - 20 * mapScale + 3);
    ctx.fillText('B', mapOffX + 25 * mapScale - 3, mapOffY - 20 * mapScale + 3);
  })();

  function formatTime(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  // Build the buy menu items once from the weapon data.
  for (const entry of BUY_MENU) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'buy-item';
    item.dataset.buy = entry.weapon ?? 'grenade';
    if (entry.weapon) {
      const def = WEAPONS[entry.weapon];
      item.innerHTML = `<span class="buy-key">${entry.key.slice(-1)}</span><span class="buy-name">${def.name}</span><span class="buy-desc">${def.damage} dmg · ${def.magSize} mag</span><span class="buy-price">$${def.price}</span>`;
    } else {
      item.innerHTML = `<span class="buy-key">${entry.key.slice(-1)}</span><span class="buy-name">${GRENADE.name}</span><span class="buy-desc">Radius ${GRENADE.radius} m</span><span class="buy-price">$${GRENADE.price}</span>`;
    }
    buyItems.appendChild(item);
  }

  return {
    setHealth(hp) {
      const value = Math.max(0, Math.ceil(hp));
      if (value === lastHealth) return;
      lastHealth = value;
      healthNum.textContent = String(value);
      healthFill.style.width = `${value}%`;
      healthFill.classList.toggle('low', value <= 30);
    },
    setMoney(value) {
      if (value === lastMoney) return;
      lastMoney = value;
      moneyValue.textContent = `$${value}`;
      buyMoney.textContent = `$${value}`;
    },
    setAmmo(mag, reserve, weapon, frags) {
      if (mag !== lastMag || reserve !== lastReserve || weapon !== lastWeapon || frags !== lastFrags) {
        lastMag = mag;
        lastReserve = reserve;
        lastWeapon = weapon;
        lastFrags = frags;
        ammoMag.textContent = String(mag);
        ammoReserve.textContent = `/ ${reserve}`;
        weaponName.textContent = weapon;
        fragsValue.textContent = `◉ ${frags}`;
      }
    },
    setMatch(attackers, defenders, round, phase, seconds) {
      const score = `${attackers}-${defenders} R${round}`;
      if (score !== lastScore) {
        lastScore = score;
        scoreA.textContent = String(attackers);
        scoreD.textContent = String(defenders);
        roundNum.textContent = `ROUND ${round}`;
      }
      const label = phase === 'buy' ? 'BUY' : phase === 'live' ? '' : phase.toUpperCase();
      const text = `${label} ${formatTime(seconds)}`.trim();
      if (text !== lastTimer) {
        lastTimer = text;
        timerValue.textContent = formatTime(seconds);
        timerLabel.textContent = label;
        timerValue.classList.toggle('urgent', phase === 'live' && seconds <= 10);
      }
    },
    setKillFeed(feed, now) {
      const fresh = feed.filter((entry) => now - entry.time < 6);
      const key = fresh.map((entry) => `${entry.killer}>${entry.victim}${entry.headshot ? 'h' : ''}`).join('|');
      if (key === lastFeedKey) return;
      lastFeedKey = key;
      killFeedEl.innerHTML = fresh
        .map(
          (entry) => `<div class="feed-row ${entry.killerTeam}"><span>${entry.killer}</span><i>${entry.headshot ? '◉' : '▸'}</i><span>${entry.victim}</span></div>`,
        )
        .join('');
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.classList.toggle('kill', killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    damageFrom(angleRad) {
      vignette.classList.add('on');
      setTimeout(() => vignette.classList.remove('on'), 220);
      damageDir.style.transform = `translate(-50%, -50%) rotate(${angleRad}rad)`;
      damageDir.classList.add('on');
      setTimeout(() => damageDir.classList.remove('on'), 600);
    },
    setCrosshair(spreadPx) {
      crosshair.style.setProperty('--gap', `${Math.round(spreadPx)}px`);
    },
    setScoped(scoped) {
      scope.hidden = !scoped;
      crosshair.style.visibility = scoped ? 'hidden' : '';
    },
    setBomb(text, fraction) {
      if (text === lastBomb) return;
      lastBomb = text;
      bombStatus.textContent = text;
      bombBar.style.width = `${Math.round(fraction * 100)}%`;
      bombStatus.classList.toggle('planted', text.startsWith('DEVICE'));
    },
    setPrompt(text) {
      if (text === lastPrompt) return;
      lastPrompt = text;
      promptEl.textContent = text ?? '';
      promptEl.hidden = !text;
    },
    showBanner(title, sub, holdMs = 3500) {
      bannerTitle.textContent = title;
      bannerSub.textContent = sub;
      banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => {
        banner.hidden = true;
      }, holdMs);
    },
    hideBanner() {
      banner.hidden = true;
    },
    showBuy() {
      buyMenu.hidden = false;
    },
    hideBuy() {
      buyMenu.hidden = true;
    },
    buyOpen() {
      return !buyMenu.hidden;
    },
    showOverlay(mode, data) {
      const text = COPY[mode];
      if (mode === 'matchEnd' && data) {
        overlayTitle.textContent = data.winner === 'attackers' ? 'VIPERS TAKE THE MATCH' : 'WARDENS TAKE THE MATCH';
        overlayCopy.textContent = `Final score ${data.attackers} — ${data.defenders}. ${data.winner === 'attackers' ? 'Sector 7 is yours.' : 'The yard holds.'}`;
      } else {
        overlayTitle.textContent = text.title;
        overlayCopy.textContent = text.copy;
      }
      playButton.textContent = text.action;
      playButton.hidden = !text.action;
      overlay.hidden = false;
      if (text.action) playButton.focus();
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      playButton.addEventListener('click', handler);
    },
    onBuy(handler) {
      buyItems.addEventListener('click', (event) => {
        const item = event.target.closest('[data-buy]');
        if (item) handler(item.dataset.buy);
      });
    },
    drawMinimap(player, teammates, bomb) {
      const ctx = minimapCtx;
      ctx.drawImage(staticMap, 0, 0);
      const dot = (x, z, color, radius = 3) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(mapOffX + x * mapScale, mapOffY + z * mapScale, radius, 0, Math.PI * 2);
        ctx.fill();
      };
      for (const mate of teammates) {
        if (mate.alive) dot(mate.body.position.x, mate.body.position.z, '#2fd4c0', 3);
      }
      if (bomb.state.mode === 'dropped' || bomb.state.mode === 'planted') {
        dot(bomb.state.position.x, bomb.state.position.z, '#e5484d', 4);
      }
      // The player: a wedge pointing where they look.
      const px = mapOffX + player.body.position.x * mapScale;
      const py = mapOffY + player.body.position.z * mapScale;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-player.body.yaw);
      ctx.fillStyle = '#ece7db';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.5, 5);
      ctx.lineTo(-4.5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  };
}
