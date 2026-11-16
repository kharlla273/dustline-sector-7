// A seeded generator (mulberry32) plus the small helpers the game draws from it:
// ranges, picks and shuffles. The screenshot modes seed it so a staged frame is
// the same every time it is taken; live play seeds it from the clock.
export function mulberry32(initial) {
  let a = initial | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(random, min, max) {
  return min + random() * (max - min);
}

export function pick(random, list) {
  return list[(random() * list.length) | 0];
}

export function shuffle(random, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = (random() * (i + 1)) | 0;
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
