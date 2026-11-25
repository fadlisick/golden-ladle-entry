// Staged screenshot scenes for Golden Ladle. Each scene starts the real
// kitchen from a fixed seed and sets its state to a moment a real game
// reaches, then the renderer draws one frame: the picture is the game's own
// code, never a mock-up. Scenes: cover, assembly, serve, rush.

import { dishById } from './recipes.js';

function setTicket(world, index, dishId, patience, max) {
  const dish = dishById(dishId);
  world.tickets[index] = { uid: world.nextTicketUid + index, dishId: dish.id, patience, max };
}

function rawPiece(ingredient, basted) {
  return { kind: 'piece', ingredient, state: 'raw', basted: !!basted };
}

function donePiece(ingredient, state, basted) {
  return { kind: 'piece', ingredient, state, basted: !!basted };
}

function seedTrail(world, points) {
  world.trail = points.map((point) => ({ x: point[0], y: point[1], life: 0.9 }));
  world.chef.moving = true;
}

function seedEmbers(world) {
  world.particles = [];
  for (let index = 0; index < 14; index += 1) {
    world.particles.push({
      x: 420 + world.random() * 200, y: 260 + world.random() * 60,
      vx: (world.random() - 0.5) * 12, vy: -30 - world.random() * 20,
      life: 0.4 + world.random() * 0.6, kind: world.random() < 0.5 ? 'ember' : 'steam',
    });
  }
}

/** The cover: mid-Rush Hour (the orange banner is up, tips +25%), combo x4,
 *  three tickets in three states — one READY (the chef carries the finished
 *  Ladle Special to the pass), one mid-assembly on the plate (Harvest Feast,
 *  the grilled fish still missing, its ghost on the plate), one new — a pan
 *  sizzling, one near burn, a dish chopping, and the last serve still on the
 *  pass under its spotlight. */
function stageCover(world) {
  world.reset();
  world.elapsed = 130;
  world.dayLeft = 50;
  world.score = 1890;
  world.combo = 4;
  world.bestCombo = 4;
  world.served = 12;
  world.tickets = [];
  setTicket(world, 0, 'ladle-special', 18, 45);
  setTicket(world, 1, 'harvest-feast', 22, 45);
  setTicket(world, 2, 'garden-salad', 48, 55);
  world.board.piece = rawPiece('tomato');
  world.board.progress = 0.6;
  world.burners[0].piece = rawPiece('steak');
  world.burners[0].progress = 0.55;
  world.burners[1].piece = donePiece('fish', 'cooked');
  world.burners[1].burn = 4.2;
  world.plate.pieces = [donePiece('tomato', 'chopped'), donePiece('mushroom', 'chopped'), donePiece('egg', 'cooked')];
  world.passDish = { dishId: 'golden-catch', life: 2.5 };
  world.chef.x = 1000;
  world.chef.y = 520;
  world.chef.dir = 1;
  world.chef.carrying = [{
    kind: 'plate',
    components: [donePiece('steak', 'cooked', true), donePiece('egg', 'cooked'), donePiece('tomato', 'chopped'), donePiece('herb', 'chopped')],
    dishId: 'ladle-special',
    basted: true,
  }];
  seedTrail(world, [[880, 560], [920, 545], [960, 532]]);
  world.addFloater(1140, 420, '+310', '#8be28b');
  seedEmbers(world);
}

/** Mid-assembly: Ember Surf, the new two-grill dish — a steak rests cooked
 *  on one pan, a fish grills on the other, and the plate holds the steak
 *  while its ghost waits for the fish. A tomato chops on the board for the
 *  Hearth Brunch ticket behind it. */
function stageAssembly(world) {
  world.reset();
  world.elapsed = 45;
  world.dayLeft = 135;
  world.score = 430;
  world.combo = 1;
  world.bestCombo = 2;
  world.served = 3;
  world.tickets = [];
  setTicket(world, 0, 'ember-surf', 30, 45);
  setTicket(world, 1, 'hearth-brunch', 40, 50);
  setTicket(world, 2, 'garden-salad', 48, 55);
  world.board.piece = rawPiece('tomato');
  world.board.progress = 0.5;
  world.burners[0].piece = donePiece('steak', 'cooked');
  world.burners[1].piece = rawPiece('fish');
  world.burners[1].progress = 0.7;
  world.plate.pieces = [donePiece('steak', 'cooked')];
  world.chef.x = 516;
  world.chef.y = 560;
  world.chef.dir = 1;
  seedTrail(world, [[430, 600], [460, 585], [490, 572]]);
  seedEmbers(world);
}

/** The serve: the chef carries a finished Golden Chowder to the pass, the
 *  ticket is stamped READY and the SERVE! prompt is lit. */
function stageServe(world) {
  world.reset();
  world.elapsed = 120;
  world.dayLeft = 60;
  world.score = 1890;
  world.combo = 4;
  world.bestCombo = 4;
  world.served = 12;
  world.tickets = [];
  setTicket(world, 0, 'golden-chowder', 18, 45);
  setTicket(world, 1, 'surf-turf', 20, 40);
  setTicket(world, 2, 'fishermans-plate', 44, 50);
  world.burners[0].piece = rawPiece('steak');
  world.burners[0].progress = 0.3;
  world.chef.x = 1140;
  world.chef.y = 392;
  world.chef.dir = -1;
  world.chef.carrying = [{
    kind: 'plate',
    components: [donePiece('fish', 'cooked', true), donePiece('mushroom', 'chopped'), donePiece('egg', 'cooked')],
    dishId: 'golden-chowder',
    basted: true,
  }];
  seedTrail(world, [[1020, 520], [1060, 470], [1100, 430]]);
  world.addFloater(1050, 450, '+310', '#8be28b');
  seedEmbers(world);
}

/** The rush: twenty seconds left, one heart, three tickets bleeding out,
 *  a pan about to burn and the board still chopping. The top ticket is the
 *  big Harvest Feast, two of its four pieces already on the plate. */
function stageRush(world) {
  world.reset();
  world.elapsed = 160;
  world.dayLeft = 20;
  world.score = 2450;
  world.combo = 2;
  world.bestCombo = 5;
  world.served = 15;
  world.hearts = 1;
  world.tickets = [];
  setTicket(world, 0, 'harvest-feast', 8, 40);
  setTicket(world, 1, 'ladle-special', 12, 45);
  setTicket(world, 2, 'ember-steak', 6, 38);
  world.board.piece = rawPiece('herb');
  world.board.progress = 0.8;
  world.burners[0].piece = donePiece('steak', 'cooked');
  world.burners[0].burn = 4.5;
  world.burners[1].piece = rawPiece('fish');
  world.burners[1].progress = 0.8;
  world.plate.pieces = [donePiece('tomato', 'chopped'), donePiece('mushroom', 'chopped')];
  world.chef.x = 516;
  world.chef.y = 560;
  world.chef.dir = 1;
  seedTrail(world, [[430, 600], [460, 585], [490, 572]]);
  world.addFloater(700, 500, 'GOLDEN HOUR x2!', '#ffd76a');
  seedEmbers(world);
}

const SCENES = { cover: stageCover, assembly: stageAssembly, serve: stageServe, rush: stageRush };

export function stageShot(name, world) {
  const stage = SCENES[name] || SCENES.cover;
  stage(world);
  return { screen: 'play' };
}

export function shotNames() {
  return Object.keys(SCENES);
}
