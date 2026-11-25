// Golden Ladle: the browser loop. It owns the screen (title, play, pause,
// game over), feeds input into the kitchen simulation, plays the sounds the
// kitchen reports, and draws one frame per animation tick. With ?shot=<name>
// it stages one screenshot scene and draws exactly one frozen frame; with
// ?selftest=1 it drives the rules headlessly and reports PASS or FAIL.

import { KitchenWorld } from './kitchen.js';
import { renderKitchenFrame } from './render.js';
import { drawTitleOverlay, drawPauseOverlay, drawGameOverOverlay } from './hud.js';
import { createInput } from './input.js';
import { createSoundboard } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const sounds = createSoundboard();
const input = createInput(canvas);
const world = new KitchenWorld(7);
let screen = 'title';
let lastTime = 0;

window.addEventListener('error', (event) => {
  document.title = `ERR: ${event.message}`;
});

function startDay() {
  world.reset();
  screen = 'play';
  sounds.unlock();
}

function togglePause() {
  if (screen === 'play') screen = 'pause';
  else if (screen === 'pause') screen = 'play';
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'enter') {
    if (screen === 'title' || screen === 'over') startDay();
  } else if (key === 'p' || key === 'escape') {
    togglePause();
  } else if (key === 'm') {
    sounds.toggleMute();
  }
});

canvas.addEventListener('mousedown', () => {
  if (screen === 'title' || screen === 'over') startDay();
  sounds.unlock();
});

function frame(time) {
  const dt = Math.min(0.05, (time - lastTime) / 1000 || 0);
  lastTime = time;
  if (screen === 'play') {
    const keys = input.keys;
    if (keys.click) world.clickAt(keys.click.x, keys.click.y);
    const events = world.step(dt, keys);
    for (const event of events) sounds.play(event);
    input.endFrame();
    if (world.over) {
      screen = 'over';
      sounds.play('game-over');
    }
  }
  renderKitchenFrame(ctx, world);
  if (screen === 'title') drawTitleOverlay(ctx, world);
  else if (screen === 'pause') drawPauseOverlay(ctx);
  else if (screen === 'over') drawGameOverOverlay(ctx, world);
  requestAnimationFrame(frame);
}

/** Drive the rules without a human: finish one dish, burn one, lose one
 *  order and run the clock out. Returns one line per check. */
function runSelfTest() {
  const lines = [];
  const check = (name, ok) => lines.push(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  const testWorld = new KitchenWorld(11);
  const idle = { left: false, right: false, up: false, down: false, useHeld: false, usePressed: false, bastePressed: false, pantry: null, click: null };
  const pressUse = (station) => {
    testWorld.chef.x = station.x;
    testWorld.chef.y = station.y;
    testWorld.step(0.05, { ...idle, usePressed: true });
  };

  // 1. A full dish: Garden Salad needs chopped tomato, mushroom and herb.
  testWorld.tickets = [{ uid: 1, dishId: 'garden-salad', patience: 50, max: 50 }];
  const pantryAt = { x: 168, y: 352 };
  const boardAt = { x: 168, y: 480 };
  const plateAt = { x: 860, y: 392 };
  const serveAt = { x: 1140, y: 392 };
  for (const pantryIndex of [0, 1, 2]) {
    testWorld.step(0.05, { ...idle, pantry: pantryIndex });
    pressUse(pantryAt);
    pressUse(boardAt);
    for (let step = 0; step < 40; step += 1) {
      testWorld.chef.x = boardAt.x;
      testWorld.chef.y = boardAt.y;
      testWorld.step(0.05, { ...idle, useHeld: true });
    }
    pressUse(boardAt);
    pressUse(plateAt);
  }
  check('plate completes Garden Salad', testWorld.plate.dishId === 'garden-salad');
  pressUse(plateAt);
  const scoreBefore = testWorld.score;
  pressUse(serveAt);
  check('serving scores and counts', testWorld.score > scoreBefore && testWorld.served === 1 && testWorld.combo === 1);

  // 2. Cooking burns when left on the fire.
  testWorld.step(0.05, { ...idle, pantry: 3 });
  pressUse(pantryAt);
  testWorld.chef.x = 516;
  testWorld.chef.y = 490;
  testWorld.step(0.05, { ...idle, usePressed: true });
  for (let step = 0; step < 260; step += 1) testWorld.step(0.05, { ...idle });
  const burnerPiece = testWorld.burners.find((burner) => burner.piece);
  check('steak left on the fire burns', !!burnerPiece && burnerPiece.piece.state === 'burnt');

  // 3. Basting holds the burn off: a basted egg survives past its grace.
  const freshWorld = new KitchenWorld(12);
  freshWorld.step(0.05, { ...idle, pantry: 5 });
  freshWorld.chef.x = 168;
  freshWorld.chef.y = 352;
  freshWorld.step(0.05, { ...idle, usePressed: true });
  freshWorld.chef.x = 516;
  freshWorld.chef.y = 490;
  freshWorld.step(0.05, { ...idle, usePressed: true });
  for (let step = 0; step < 100; step += 1) freshWorld.step(0.05, { ...idle });
  freshWorld.step(0.05, { ...idle, bastePressed: true });
  for (let step = 0; step < 120; step += 1) freshWorld.step(0.05, { ...idle });
  const eggBurner = freshWorld.burners.find((burner) => burner.piece);
  check('basted egg is not burnt yet', !!eggBurner && eggBurner.piece.state !== 'burnt');

  // 4. An expired ticket costs a heart.
  const heartsBefore = testWorld.hearts;
  testWorld.tickets = [{ uid: 9, dishId: 'ember-steak', patience: 0.05, max: 40 }];
  testWorld.step(0.1, { ...idle });
  check('expired order costs a heart', testWorld.hearts === heartsBefore - 1 && testWorld.lost >= 1);

  // 5. The day timer ends the day.
  testWorld.elapsed = 179.9;
  testWorld.step(0.2, { ...idle });
  check('day timer ends the game', testWorld.over === true && testWorld.overReason === 'day');
  check('no network requests were made', performance.getEntriesByType('resource').every((entry) => !entry.name.startsWith('http') || entry.name.startsWith(window.location.origin)));
  return lines;
}

const shotName = params.get('shot');
if (shotName) {
  stageShot(shotName, world);
  renderKitchenFrame(ctx, world);
  document.title = `SHOT ${shotName} OK`;
} else if (params.get('selftest') === '1') {
  const lines = runSelfTest();
  document.title = lines.every((line) => line.startsWith('PASS')) ? 'SELFTEST PASS' : 'SELFTEST FAIL';
  const pre = document.getElementById('selftest');
  if (pre) pre.textContent = lines.join('\n');
  renderKitchenFrame(ctx, world);
} else {
  renderKitchenFrame(ctx, world);
  requestAnimationFrame((time) => {
    lastTime = time;
    requestAnimationFrame(frame);
  });
}
