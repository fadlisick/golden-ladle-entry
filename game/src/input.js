// Keyboard and mouse input for Golden Ladle, collected into one plain object
// the kitchen simulation reads each frame. No game logic lives here.

export function createInput(canvas) {
  const keys = {
    left: false, right: false, up: false, down: false,
    useHeld: false, usePressed: false, bastePressed: false,
    pantry: null, click: null,
  };
  const held = new Set();

  function keyName(event) {
    const key = event.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') return 'left';
    if (key === 'arrowright' || key === 'd') return 'right';
    if (key === 'arrowup' || key === 'w') return 'up';
    if (key === 'arrowdown' || key === 's') return 'down';
    if (key === ' ' || key === 'e') return 'use';
    if (key === 'b') return 'baste';
    return null;
  }

  window.addEventListener('keydown', (event) => {
    const name = keyName(event);
    if (name) event.preventDefault();
    if (event.key >= '1' && event.key <= '6') {
      keys.pantry = Number(event.key) - 1;
      return;
    }
    if (name === 'use' && !held.has('use')) keys.usePressed = true;
    if (name === 'baste' && !held.has('baste')) keys.bastePressed = true;
    if (name) {
      held.add(name);
      if (name === 'use') keys.useHeld = true;
      else keys[name] = true;
    }
  });

  window.addEventListener('keyup', (event) => {
    const name = keyName(event);
    if (!name) return;
    held.delete(name);
    if (name === 'use') keys.useHeld = false;
    else keys[name] = false;
  });

  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    keys.click = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  });

  window.addEventListener('blur', () => {
    held.clear();
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false;
    keys.useHeld = false;
  });

  return {
    keys,
    /** Clear the one-frame presses after the simulation has read them. */
    endFrame() {
      keys.usePressed = false;
      keys.bastePressed = false;
      keys.pantry = null;
      keys.click = null;
    },
  };
}
