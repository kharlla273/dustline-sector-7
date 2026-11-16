// The look plan, in one place: dusk over a desert freight yard. Warm sand and rust
// against a blue dusk sky, teal for the Vipers, amber for the Wardens. Every colour
// in the game and the HUD is one of these. Textures are painted on canvas at boot,
// so the game ships no image files at all.
import * as THREE from 'three';

export const PALETTE = {
  sky: '#243244',
  surface: '#2a3442',
  ground: '#8f7a5c',
  concrete: '#7d8187',
  darkConcrete: '#565a60',
  rust: '#a34d2d',
  teal: '#2fd4c0',
  amber: '#f2a93b',
  ink: '#ece7db',
  muted: '#9aa3ad',
  red: '#e5484d',
};

function paintCanvas(size, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  painter(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function speckle(ctx, size, count, colors, min, max) {
  for (let i = 0; i < count; i += 1) {
    const shade = colors[(Math.random() * colors.length) | 0];
    const r = min + Math.random() * (max - min);
    ctx.fillStyle = shade;
    ctx.globalAlpha = 0.25 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Sand: warm tan with darker speckles and faint tyre ruts.
export function sandTexture() {
  return paintCanvas(256, (ctx, size) => {
    ctx.fillStyle = '#8f7a5c';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, 900, ['#7a6749', '#a08a68', '#6f5d42'], 0.5, 2.2);
    ctx.strokeStyle = 'rgba(90, 74, 52, 0.18)';
    ctx.lineWidth = 7;
    for (let x = 24; x < size; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 14, size);
      ctx.stroke();
    }
  });
}

// Concrete: cool grey with noise, panel seams and stains.
export function concreteTexture() {
  return paintCanvas(256, (ctx, size) => {
    ctx.fillStyle = '#7d8187';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, 700, ['#6b6f75', '#8d9196', '#5d6167'], 0.5, 2.5);
    ctx.strokeStyle = 'rgba(60, 63, 68, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(70, 66, 58, 0.18)';
    ctx.beginPath();
    ctx.ellipse(size * 0.7, size * 0.8, 60, 26, 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Corrugated metal: vertical ribs with rust streaks, tinted per container.
export function metalTexture(base, rib) {
  return paintCanvas(256, (ctx, size) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = rib;
      ctx.fillRect(x, 0, 5, size);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 5, 0, 3, size);
    }
    speckle(ctx, size, 260, ['#6e3a20', '#4a2a18', '#8a5a34'], 1, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, size, 6);
    ctx.fillRect(0, size - 6, size, 6);
  });
}

// Hazard stripes: amber and near-black diagonals for site borders and barriers.
export function hazardTexture() {
  return paintCanvas(128, (ctx, size) => {
    ctx.fillStyle = '#f2a93b';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#1d2733';
    for (let i = -size; i < size * 2; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 16, 0);
      ctx.lineTo(i + 16 + size, size);
      ctx.lineTo(i + size, size);
      ctx.closePath();
      ctx.fill();
    }
  });
}

// A site letter (A or B) on a dark plate, for the wall signs.
export function letterTexture(letter) {
  return paintCanvas(128, (ctx, size) => {
    ctx.fillStyle = '#232c3d';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#f2a93b';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, size - 12, size - 12);
    ctx.fillStyle = '#ece7db';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, size / 2, size / 2 + 4);
  });
}
