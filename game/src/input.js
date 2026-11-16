// Keyboard and mouse, and the pointer lock that turns the mouse into look.
// Plain browser APIs only. Besides the held-key set it reports edge events:
// pressed keys (for buy, reload, grenade, interact), mouse clicks and the
// scope toggle, so the simulation never reads a DOM event itself.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const pressed = new Set();
  const state = {
    keys,
    pressed,
    locked: false,
    firing: false,
    scoped: false,
    lookX: 0,
    lookY: 0,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    pressed.add(event.code);
    keys.add(event.code);
    if (event.code === 'Space') event.preventDefault();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    keys.clear();
    pressed.clear();
    state.firing = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.lookX += event.movementX;
    state.lookY += event.movementY;
  });
  window.addEventListener('mousedown', (event) => {
    if (!state.locked) return;
    if (event.button === 0) {
      state.firing = true;
      pressed.add('MouseLeft');
    }
    if (event.button === 2) state.scoped = !state.scoped;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
  });
  window.addEventListener('contextmenu', (event) => {
    if (state.locked) event.preventDefault();
  });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) {
      keys.clear();
      pressed.clear();
      state.firing = false;
      state.scoped = false;
    }
    onLockChange(state.locked);
  });

  return {
    state,
    requestLock() {
      canvas.requestPointerLock();
    },
    exitLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    takeLook() {
      const look = { x: state.lookX, y: state.lookY };
      state.lookX = 0;
      state.lookY = 0;
      return look;
    },
    // Consume one pressed edge; the simulation calls this once per fixed step.
    consumePressed() {
      const out = new Set(pressed);
      pressed.clear();
      return out;
    },
  };
}
