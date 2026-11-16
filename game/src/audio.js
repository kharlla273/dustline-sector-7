// Procedural sound: every effect is synthesised with WebAudio (noise bursts and
// short oscillator envelopes), so the game ships no audio files. The context is
// created lazily on the first user gesture; before that every call is a no-op.
// Volume falls with distance for world sounds; the player's own actions are full.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function noise(duration, filterFreq, gain, when = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, t);
    envelope.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start(t);
    source.stop(t + duration + 0.02);
  }

  function tone(freq, duration, gain, type = 'sine', slideTo = null, when = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, t);
    envelope.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(envelope);
    envelope.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // Distance gain: 1 close, fading to 0 past `range` metres.
  function at(distance, range) {
    if (distance <= 1) return 1;
    return Math.max(0, 1 - distance / range);
  }

  return {
    unlock() {
      ensure();
    },
    shoot(kind, distance = 0) {
      const volume = kind === 'sniper' ? 0.9 : 0.55;
      noise(kind === 'sniper' ? 0.28 : 0.12, kind === 'pistol' ? 2600 : 1500, volume * at(distance, 60));
      tone(140, 0.09, 0.5 * at(distance, 60), 'triangle', 55);
    },
    dryFire() {
      tone(1400, 0.04, 0.2, 'square');
    },
    reload() {
      tone(700, 0.05, 0.25, 'square');
      tone(500, 0.05, 0.25, 'square', null, 0.18);
      tone(900, 0.06, 0.3, 'square', null, 0.55);
    },
    hit() {
      tone(2200, 0.05, 0.3, 'sine');
    },
    kill() {
      tone(1800, 0.06, 0.3, 'sine');
      tone(2600, 0.08, 0.3, 'sine', null, 0.07);
    },
    hurt() {
      noise(0.12, 500, 0.5);
      tone(90, 0.15, 0.4, 'sawtooth', 50);
    },
    step(distance = 0) {
      noise(0.05, 700, 0.12 * at(distance, 18));
    },
    jump() {
      noise(0.06, 900, 0.1);
    },
    plantTick() {
      tone(1200, 0.05, 0.25, 'square');
    },
    bombBeep(fast) {
      tone(fast ? 1500 : 1000, 0.09, 0.35, 'square');
    },
    explode(distance = 0) {
      noise(0.9, 300, 1.0 * at(distance, 90));
      tone(60, 0.7, 0.9 * at(distance, 90), 'sine', 30);
    },
    roundWin() {
      tone(523, 0.14, 0.3, 'triangle');
      tone(659, 0.14, 0.3, 'triangle', null, 0.14);
      tone(784, 0.28, 0.32, 'triangle', null, 0.28);
    },
    roundLose() {
      tone(392, 0.16, 0.3, 'triangle');
      tone(311, 0.16, 0.3, 'triangle', null, 0.16);
      tone(262, 0.32, 0.3, 'triangle', null, 0.32);
    },
    buy() {
      tone(880, 0.07, 0.25, 'sine');
      tone(1320, 0.1, 0.25, 'sine', null, 0.07);
    },
    denied() {
      tone(220, 0.12, 0.3, 'square');
    },
    click() {
      tone(1000, 0.03, 0.15, 'sine');
    },
  };
}
