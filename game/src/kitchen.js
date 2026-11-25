// The kitchen simulation of Golden Ladle: chef movement, stations, cooking,
// plating and serving. Pure logic, no DOM: the browser loop feeds it input
// and it answers with events the sound layer plays. A Node test can drive it
// the same way, which is how the rules were verified.

import {
  INGREDIENTS, DISHES, ingredientById, dishById, componentKey,
  finishedComponent, matchedNeedCount, plateMatchesDish, firstMissingNeed,
} from './recipes.js';
import { makeSeededRandom, pickFrom } from './rng.js';

export const DAY_SECONDS = 180;
export const MAX_TICKETS = 3;
export const MAX_HEARTS = 3;
export const CHEF_SPEED = 275;
export const INTERACT_RANGE = 100;
export const BURN_GRACE_SECONDS = 5;
export const BASTE_EXTRA_SECONDS = 4;
export const BASTE_TIP = 15;
export const GOLDEN_HOUR_SECONDS = 30;
// Rush Hour: two 20-second surges when the dining room floods. Orders come
// faster and every tip pays +25%, so the day has two peaks to play around.
export const RUSH_HOUR_WINDOWS = [[60, 80], [120, 140]];
export const RUSH_TIP_BONUS = 0.25;
export const RUSH_SPAWN_SECONDS = 0.6;

// Combo Streak: dishes served one after another, with no ticket walking
// out in between, build a tip multiplier — 3 in a row pays double, 5 or
// more pays triple. One expired ticket breaks the streak back to zero, so
// the streak is the reason to save the ticket that is about to leave.
export function comboMultiplier(streak) {
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  return 1;
}

/** The streak a cook must reach for the next multiplier tier, or null at the top. */
export function comboNextAt(streak) {
  if (streak < 3) return 3;
  if (streak < 5) return 5;
  return null;
}

// Station rectangles on the 1280x720 floor, and the spot the chef stands on
// to use each one. Stations hug the back wall; the chef works the floor below.
export const STATIONS = {
  pantry: { label: 'Pantry', x: 24, y: 212, w: 288, h: 132, approach: { x: 168, y: 364 } },
  board: { label: 'Chopping Board', x: 24, y: 356, w: 288, h: 104, approach: { x: 168, y: 480 } },
  hearth: { label: 'Hearth', x: 336, y: 212, w: 360, h: 248, approach: { x: 516, y: 490 } },
  plating: { label: 'Plating', x: 720, y: 212, w: 280, h: 170, approach: { x: 860, y: 402 } },
  serve: { label: 'Serve', x: 1024, y: 212, w: 232, h: 170, approach: { x: 1140, y: 402 } },
  trash: { label: 'Trash', x: 24, y: 640, w: 120, h: 64, approach: { x: 84, y: 616 } },
};

export const BURNERS = [
  { x: 442, y: 342, r: 48 },
  { x: 598, y: 342, r: 48 },
];

export const PANTRY_CRATES = INGREDIENTS.map((item, index) => ({
  ingredient: item,
  x: 36 + (index % 3) * 94,
  y: 238 + Math.floor(index / 3) * 58,
  w: 86,
  h: 48,
}));

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function freshPiece(ingredientId) {
  return { kind: 'piece', ingredient: ingredientId, state: 'raw', basted: false };
}

export class KitchenWorld {
  constructor(seed) {
    this.seed = seed || 7;
    this.random = makeSeededRandom(this.seed);
    this.reset();
  }

  reset() {
    this.random = makeSeededRandom(this.seed);
    this.elapsed = 0;
    this.dayLeft = DAY_SECONDS;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.served = 0;
    this.lost = 0;
    this.burntCount = 0;
    this.trashedCount = 0;
    this.hearts = MAX_HEARTS;
    this.over = false;
    this.overReason = null;
    this.chef = { x: 640, y: 600, tx: null, ty: null, dir: 1, moving: false, carrying: [] };
    this.pendingStation = null;
    this.trail = [];
    this.floaters = [];
    this.particles = [];
    this.tickets = [];
    this.nextTicketUid = 1;
    this.spawnIn = 0.5;
    this.board = { piece: null, progress: 0 };
    this.burners = BURNERS.map(() => ({ piece: null, progress: 0, burn: 0, basted: false }));
    this.plate = { pieces: [], dishId: null };
    this.passDish = null;
    this.selectedPantry = 0;
    this.inRush = false;
    this.trailClock = 0;
    this.particleClock = 0;
    for (let index = 0; index < MAX_TICKETS; index += 1) this.dealTicket();
  }

  /** Deal one new order ticket; early in the day the menu stays simple,
   *  late in the day the big four-need dishes show up more often. */
  dealTicket() {
    const simple = DISHES.filter((dish) => dish.needs.length === 2);
    const big = DISHES.filter((dish) => dish.needs.length === 4);
    let pool = DISHES;
    if (this.elapsed < 60 && this.random() < 0.6) pool = simple;
    else if (this.elapsed >= 90 && this.random() < 0.35) pool = big;
    const dish = pickFrom(this.random, pool);
    const patience = Math.round(55 - Math.min(25, (this.elapsed / DAY_SECONDS) * 25));
    this.tickets.push({ uid: this.nextTicketUid, dishId: dish.id, patience, max: patience });
    this.nextTicketUid += 1;
  }

  /** The last 30 seconds of the day: every tip is doubled. */
  goldenHour() {
    return !this.over && this.dayLeft <= GOLDEN_HOUR_SECONDS;
  }

  /** True while the dining room floods: orders arrive faster, tips pay +25%. */
  rushHour() {
    if (this.over) return false;
    for (const [start, end] of RUSH_HOUR_WINDOWS) {
      if (this.elapsed >= start && this.elapsed < end) return true;
    }
    return false;
  }

  plateComponentKeys() {
    return this.plate.pieces.map((piece) => finishedComponent(piece)).filter(Boolean);
  }

  plateDish() {
    if (!this.plate.dishId) return null;
    return dishById(this.plate.dishId);
  }

  refreshPlateDish() {
    const keys = this.plateComponentKeys();
    const found = DISHES.find((dish) => plateMatchesDish(keys, dish));
    this.plate.dishId = found ? found.id : null;
    return found || null;
  }

  /** 'ready' when a finished plate waits for this ticket, 'mid' while any of
   *  its needs is being chopped, cooked or plated, otherwise 'new'. */
  ticketStatus(ticket) {
    if (this.plate.dishId === ticket.dishId) return 'ready';
    const carriedPlate = this.carryingPlate();
    if (carriedPlate && carriedPlate.dishId === ticket.dishId) return 'ready';
    const inFlight = [];
    if (this.board.piece) inFlight.push(finishedComponent(this.board.piece));
    for (const burner of this.burners) {
      if (burner.piece) inFlight.push(finishedComponent(burner.piece));
    }
    for (const key of this.plateComponentKeys()) inFlight.push(key);
    const dish = dishById(ticket.dishId);
    const inFlightKeys = inFlight.filter(Boolean);
    if (inFlightKeys.some((key) => dish.needs.includes(key))) return 'mid';
    return 'new';
  }

  /** The ticket whose needs the in-progress work matches best, for the gold border. */
  highlightedTicketUid() {
    let bestUid = null;
    let bestScore = 0;
    const keys = [];
    if (this.board.piece) keys.push(finishedComponent(this.board.piece));
    for (const burner of this.burners) {
      if (burner.piece) keys.push(finishedComponent(burner.piece));
    }
    for (const key of this.plateComponentKeys()) keys.push(key);
    const clean = keys.filter(Boolean);
    if (clean.length === 0) return null;
    for (const ticket of this.tickets) {
      const dish = dishById(ticket.dishId);
      const score = matchedNeedCount(dish, clean);
      if (score > bestScore) {
        bestScore = score;
        bestUid = ticket.uid;
      }
    }
    return bestUid;
  }

  addFloater(x, y, text, color) {
    this.floaters.push({ x, y, text, color: color || '#ffe9a8', life: 1.4 });
  }

  stationAtPoint(x, y) {
    for (const [name, rect] of Object.entries(STATIONS)) {
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return name;
    }
    return null;
  }

  nearestStation() {
    let best = null;
    let bestDistance = Infinity;
    for (const [name, rect] of Object.entries(STATIONS)) {
      const d = distance(this.chef.x, this.chef.y, rect.approach.x, rect.approach.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = name;
      }
    }
    return bestDistance <= INTERACT_RANGE ? best : null;
  }

  /** One frame of the kitchen. `keys` is the plain input object from input.js. */
  step(dt, keys) {
    const events = [];
    if (this.over) {
      this.updateCosmetics(dt);
      return events;
    }
    this.elapsed += dt;
    this.dayLeft = Math.max(0, DAY_SECONDS - this.elapsed);
    if (this.dayLeft <= 0) {
      this.over = true;
      this.overReason = 'day';
      events.push('game-over');
      return events;
    }

    // Rush Hour arrives with a shout the first frame it starts.
    const rushing = this.rushHour();
    if (rushing && !this.inRush) {
      this.addFloater(640, 200, 'RUSH HOUR! Tips +25%', '#ffd76a');
      events.push('rush');
    }
    this.inRush = rushing;

    if (typeof keys.pantry === 'number') this.selectedPantry = keys.pantry;

    this.moveChef(dt, keys);
    if (keys.usePressed) {
      const station = this.nearestStation();
      if (station) events.push(...this.useStation(station));
    }
    if (keys.bastePressed) events.push(...this.basteBurners());
    this.workBoard(dt, keys, events);
    this.workBurners(dt, events);
    this.ageTickets(dt, events);
    this.updateCosmetics(dt);
    return events;
  }

  moveChef(dt, keys) {
    let dx = 0;
    let dy = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (dx !== 0 || dy !== 0) {
      this.chef.tx = null;
      this.chef.ty = null;
      this.pendingStation = null;
    } else if (this.chef.tx !== null) {
      const d = distance(this.chef.x, this.chef.y, this.chef.tx, this.chef.ty);
      if (d < 6) {
        this.chef.tx = null;
        this.chef.ty = null;
        if (this.pendingStation) {
          const station = this.pendingStation;
          this.pendingStation = null;
          this.useStation(station);
        }
      } else {
        dx = (this.chef.tx - this.chef.x) / d;
        dy = (this.chef.ty - this.chef.y) / d;
      }
    }
    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy);
      this.chef.x += (dx / length) * CHEF_SPEED * dt;
      this.chef.y += (dy / length) * CHEF_SPEED * dt;
      this.chef.dir = dx < 0 ? -1 : dx > 0 ? 1 : this.chef.dir;
      this.chef.moving = true;
    } else {
      this.chef.moving = false;
    }
    this.chef.x = Math.max(40, Math.min(1240, this.chef.x));
    this.chef.y = Math.max(392, Math.min(700, this.chef.y));
  }

  /** Click a point on the floor: walk there, using a station on arrival. */
  clickAt(x, y) {
    const station = this.stationAtPoint(x, y);
    if (station === 'pantry') {
      const crate = PANTRY_CRATES.find((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
      if (crate) this.selectedPantry = INGREDIENTS.indexOf(crate.ingredient);
    }
    if (station) {
      const approach = STATIONS[station].approach;
      this.chef.tx = approach.x;
      this.chef.ty = approach.y;
      this.pendingStation = station;
    } else {
      this.chef.tx = Math.max(40, Math.min(1240, x));
      this.chef.ty = Math.max(392, Math.min(700, y));
      this.pendingStation = null;
    }
  }

  carryingPiece() {
    return this.chef.carrying.find((item) => item.kind === 'piece') || null;
  }

  carryingPlate() {
    return this.chef.carrying.find((item) => item.kind === 'plate') || null;
  }

  useStation(station) {
    const events = [];
    const chef = this.chef;
    if (station === 'pantry') {
      if (chef.carrying.length >= 2) return ['error'];
      const picked = INGREDIENTS[this.selectedPantry];
      chef.carrying.push(freshPiece(picked.id));
      this.addFloater(chef.x, chef.y - 52, picked.name, '#ffe9a8');
      return ['take'];
    }
    if (station === 'board') {
      if (!this.board.piece) {
        const held = this.carryingPiece();
        if (held && ingredientById(held.ingredient).process === 'chop' && held.state === 'raw') {
          this.board.piece = held;
          this.board.progress = 0;
          chef.carrying.splice(chef.carrying.indexOf(held), 1);
          return ['place'];
        }
        return ['error'];
      }
      if (this.board.piece.state === 'chopped') {
        if (chef.carrying.length >= 2) return ['error'];
        chef.carrying.push(this.board.piece);
        this.board.piece = null;
        this.board.progress = 0;
        return ['take'];
      }
      return [];
    }
    if (station === 'hearth') {
      const burner = this.nearestBurner();
      if (!burner) return ['error'];
      if (!burner.piece) {
        const held = this.carryingPiece();
        if (held && ingredientById(held.ingredient).process === 'cook' && held.state === 'raw') {
          burner.piece = held;
          burner.progress = 0;
          burner.burn = 0;
          burner.basted = false;
          chef.carrying.splice(chef.carrying.indexOf(held), 1);
          return ['place'];
        }
        return ['error'];
      }
      if (burner.piece.state === 'cooked' || burner.piece.state === 'burnt') {
        if (chef.carrying.length >= 2) return ['error'];
        chef.carrying.push(burner.piece);
        burner.piece = null;
        burner.progress = 0;
        burner.burn = 0;
        burner.basted = false;
        return ['take'];
      }
      return [];
    }
    if (station === 'plating') {
      const plateItem = this.carryingPlate();
      if (plateItem && this.plate.pieces.length === 0) {
        this.plate.pieces = plateItem.components.slice();
        this.refreshPlateDish();
        chef.carrying.splice(chef.carrying.indexOf(plateItem), 1);
        return ['place'];
      }
      if (this.plate.dishId && chef.carrying.length < 2) {
        chef.carrying.push({
          kind: 'plate',
          components: this.plate.pieces.slice(),
          dishId: this.plate.dishId,
          basted: this.plate.pieces.some((piece) => piece.basted),
        });
        this.plate.pieces = [];
        this.plate.dishId = null;
        return ['take'];
      }
      const held = this.carryingPiece();
      if (held && held.state !== 'raw' && held.state !== 'burnt') {
        const keys = this.plateComponentKeys();
        const key = finishedComponent(held);
        const wanted = DISHES.some((dish) => dish.needs.includes(key) && matchedNeedCount(dish, keys.concat([key])) > matchedNeedCount(dish, keys));
        if (!wanted && keys.length > 0) return ['error'];
        this.plate.pieces.push(held);
        chef.carrying.splice(chef.carrying.indexOf(held), 1);
        const done = this.refreshPlateDish();
        if (done) {
          this.addFloater(860, 240, 'Plate ready!', '#8be28b');
          return ['plate-ready'];
        }
        return ['place'];
      }
      return ['error'];
    }
    if (station === 'serve') {
      const plateItem = this.carryingPlate();
      if (!plateItem) return ['error'];
      const ticketIndex = this.tickets.findIndex((ticket) => ticket.dishId === plateItem.dishId);
      if (ticketIndex === -1) return ['error'];
      const ticket = this.tickets[ticketIndex];
      const dish = dishById(ticket.dishId);
      const tip = Math.round(dish.price * 0.5 * (ticket.patience / ticket.max)) + (plateItem.basted ? BASTE_TIP : 0);
      const streak = this.combo + 1;
      const multiplier = comboMultiplier(streak);
      const golden = this.goldenHour();
      const rush = this.rushHour();
      const earned = Math.round((dish.price + tip) * multiplier * (golden ? 2 : 1) * (rush ? 1 + RUSH_TIP_BONUS : 1));
      this.score += earned;
      this.combo = streak;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.served += 1;
      this.passDish = { dishId: dish.id, life: 2.5 };
      const comboTag = multiplier > 1 ? `COMBO x${multiplier} ` : '';
      this.addFloater(1140, 240, golden ? `GOLDEN ${comboTag}+${earned}` : rush ? `RUSH ${comboTag}+${earned}` : `${comboTag}+${earned}`, '#ffd76a');
      if (streak === 3) {
        this.addFloater(640, 200, 'COMBO x2! Tips doubled — keep the streak alive!', '#ff9a5c');
        events.push('combo');
      } else if (streak === 5) {
        this.addFloater(640, 200, 'COMBO x3! Tips tripled — the kitchen is on fire!', '#ff9a5c');
        events.push('combo');
      }
      chef.carrying.splice(chef.carrying.indexOf(plateItem), 1);
      this.tickets.splice(ticketIndex, 1);
      this.spawnIn = this.rushHour() ? RUSH_SPAWN_SECONDS : this.elapsed > 120 ? 0.8 : 1.2;
      return ['serve'];
    }
    if (station === 'trash') {
      if (chef.carrying.length === 0) return ['error'];
      chef.carrying.pop();
      this.trashedCount += 1;
      return ['trash'];
    }
    return events;
  }

  nearestBurner() {
    let best = null;
    let bestDistance = Infinity;
    for (let index = 0; index < BURNERS.length; index += 1) {
      const d = distance(this.chef.x, this.chef.y, BURNERS[index].x, BURNERS[index].y + 140);
      if (d < bestDistance) {
        bestDistance = d;
        best = this.burners[index];
      }
    }
    return bestDistance <= 190 ? best : null;
  }

  /** The golden ladle: baste what is on the fire. One baste per piece, it
   *  holds the burn off longer and earns a tip when the dish is served. */
  basteBurners() {
    const events = [];
    for (const burner of this.burners) {
      if (burner.piece && !burner.basted && burner.piece.state !== 'burnt') {
        burner.basted = true;
        burner.piece.basted = true;
        burner.burn = 0;
        this.addFloater(this.chef.x, this.chef.y - 52, 'Basted! +tip', '#ffd76a');
        events.push('baste');
      }
    }
    return events.length > 0 ? events : ['error'];
  }

  workBoard(dt, keys, events) {
    if (!this.board.piece || this.board.piece.state !== 'raw') return;
    const near = distance(this.chef.x, this.chef.y, STATIONS.board.approach.x, STATIONS.board.approach.y) <= INTERACT_RANGE;
    if (!near || !keys.useHeld) return;
    const ingredient = ingredientById(this.board.piece.ingredient);
    this.board.progress += dt / ingredient.workSeconds;
    if (this.random() < dt * 6) events.push('chop-tick');
    if (this.board.progress >= 1) {
      this.board.piece.state = 'chopped';
      this.board.progress = 0;
      this.addFloater(168, 330, 'Chopped!', '#ffe9a8');
      events.push('chop-done');
    }
  }

  workBurners(dt, events) {
    for (let index = 0; index < this.burners.length; index += 1) {
      const burner = this.burners[index];
      if (!burner.piece || burner.piece.state === 'burnt') continue;
      const ingredient = ingredientById(burner.piece.ingredient);
      if (burner.piece.state === 'raw') {
        burner.progress += dt / ingredient.workSeconds;
        if (burner.progress >= 1) {
          burner.piece.state = 'cooked';
          burner.progress = 1;
          burner.burn = 0;
          this.addFloater(BURNERS[index].x, BURNERS[index].y - 60, 'Cooked!', '#8be28b');
          events.push('cook-done');
        }
      } else if (burner.piece.state === 'cooked') {
        burner.burn += dt;
        const grace = BURN_GRACE_SECONDS + (burner.basted ? BASTE_EXTRA_SECONDS : 0);
        if (burner.burn >= grace) {
          burner.piece.state = 'burnt';
          this.burntCount += 1;
          this.addFloater(BURNERS[index].x, BURNERS[index].y - 60, 'Burnt!', '#ff8a7a');
          events.push('burnt');
        }
      }
    }
  }

  ageTickets(dt, events) {
    for (const ticket of this.tickets) ticket.patience -= dt;
    const expired = this.tickets.filter((ticket) => ticket.patience <= 0);
    for (const ticket of expired) {
      this.tickets.splice(this.tickets.indexOf(ticket), 1);
      this.hearts -= 1;
      if (this.combo >= 2) {
        this.addFloater(640, 175, `Combo streak x${this.combo} broken!`, '#ff8a7a');
      }
      this.combo = 0;
      this.lost += 1;
      this.addFloater(640, 150, `${dishById(ticket.dishId).name} walked out!`, '#ff8a7a');
      events.push('expire');
      this.spawnIn = 1.0;
    }
    if (this.hearts <= 0) {
      this.over = true;
      this.overReason = 'hearts';
      events.push('game-over');
      return;
    }
    if (this.tickets.length < MAX_TICKETS) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) {
        this.dealTicket();
        this.spawnIn = this.rushHour() ? RUSH_SPAWN_SECONDS : this.elapsed > 120 ? 0.9 : 1.5;
      }
    }
  }

  updateCosmetics(dt) {
    this.trailClock -= dt;
    if (this.chef.moving && this.trailClock <= 0) {
      this.trail.push({ x: this.chef.x, y: this.chef.y + 16, life: 0.9 });
      if (this.trail.length > 16) this.trail.shift();
      this.trailClock = 0.09;
    }
    for (const dot of this.trail) dot.life -= dt * 0.8;
    this.trail = this.trail.filter((dot) => dot.life > 0);
    for (const floater of this.floaters) {
      floater.life -= dt;
      floater.y -= 26 * dt;
    }
    this.floaters = this.floaters.filter((floater) => floater.life > 0);
    if (this.passDish) {
      this.passDish.life -= dt;
      if (this.passDish.life <= 0) this.passDish = null;
    }
    this.particleClock -= dt;
    if (this.particleClock <= 0) {
      this.particleClock = 0.12;
      const burner = BURNERS[Math.floor(this.random() * BURNERS.length)];
      this.particles.push({
        x: burner.x + (this.random() - 0.5) * 60, y: burner.y - 30,
        vx: (this.random() - 0.5) * 12, vy: -34 - this.random() * 26,
        life: 1 + this.random(), kind: this.random() < 0.5 ? 'ember' : 'steam',
      });
      if (this.particles.length > 60) this.particles.shift();
    }
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }
}
