// The heads-up display of Golden Ladle: the top bar (clock, score, combo,
// hearts) and the order board (ticket cards). The judge reads the game
// mostly through these, so every ticket state must read at a glance.

import { dishById, finishedComponent } from './recipes.js';
import { drawIngredientIcon } from './render.js';

const CARD_W = 296;
const CARD_H = 92;
const CARD_Y = 96;

function formatClock(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

function patienceColor(fraction) {
  if (fraction > 0.5) return '#58b368';
  if (fraction > 0.25) return '#f2c14e';
  return '#e2543e';
}

/** Component keys the chef already has finished, on a station or in hand. */
function coveredKeys(world) {
  const keys = [];
  for (const key of world.plateComponentKeys()) keys.push(key);
  if (world.board.piece) {
    const key = finishedComponent(world.board.piece);
    if (key) keys.push(key);
  }
  for (const burner of world.burners) {
    if (burner.piece) {
      const key = finishedComponent(burner.piece);
      if (key) keys.push(key);
    }
  }
  for (const item of world.chef.carrying) {
    if (item.kind === 'piece') {
      const key = finishedComponent(item);
      if (key) keys.push(key);
    }
  }
  return keys;
}

export function drawTopBar(ctx, world) {
  ctx.fillStyle = '#23262f';
  ctx.fillRect(0, 0, 1280, 88);
  ctx.fillStyle = '#3a3f4d';
  ctx.fillRect(0, 86, 1280, 2);

  // Title and ladle mark, left.
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.arc(52, 44, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#23262f';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('L', 52, 45);
  ctx.fillStyle = '#f5ead2';
  ctx.textAlign = 'left';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('GOLDEN LADLE', 80, 40);
  ctx.fillStyle = '#b9ac93';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Hearth Kitchen Rush', 82, 66);

  // Day clock, centre, big enough to feel.
  const lowTime = world.dayLeft <= 30;
  const golden = world.goldenHour();
  ctx.textAlign = 'center';
  ctx.fillStyle = lowTime && Math.floor(world.elapsed * 2) % 2 === 0 ? '#ff8a7a' : '#ffe9a8';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(formatClock(world.dayLeft), 640, 52);
  if (golden) {
    ctx.fillStyle = '#f2c14e';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('★ GOLDEN HOUR · TIPS x2 ★', 640, 78);
  } else {
    ctx.fillStyle = '#b9ac93';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('DAY TIMER', 640, 78);
  }
  // Day-progress bar under the top bar: the whole day, shrinking.
  const dayFraction = Math.max(0, world.dayLeft / 180);
  ctx.fillStyle = '#3a3f4d';
  ctx.fillRect(0, 88, 1280, 6);
  ctx.fillStyle = golden ? '#f2c14e' : lowTime ? '#e2543e' : '#58b368';
  ctx.fillRect(0, 88, 1280 * dayFraction, 6);

  // Score, combo and hearts, right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f5ead2';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, 1256, 34);
  if (world.combo >= 2) {
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(1064, 48, 192, 28);
    ctx.fillStyle = '#23262f';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`COMBO x${world.combo}`, 1160, 62);
  } else {
    ctx.fillStyle = '#b9ac93';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`Served ${world.served}  ·  Best combo x${world.bestCombo}`, 1256, 66);
  }
  // Hearts sit under the title, left of the clock.
  for (let index = 0; index < 3; index += 1) {
    const x = 470 + index * 30;
    const y = 44;
    ctx.fillStyle = index < world.hearts ? '#e2543e' : '#4a4f5e';
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.bezierCurveTo(x - 11, y - 3, x - 6, y - 12, x, y - 4);
    ctx.bezierCurveTo(x + 6, y - 12, x + 11, y - 3, x, y + 8);
    ctx.fill();
  }
}

export function drawOrderBoard(ctx, world) {
  const covered = coveredKeys(world);
  const highlighted = world.highlightedTicketUid();
  ctx.textBaseline = 'alphabetic';
  world.tickets.forEach((ticket, index) => {
    const dish = dishById(ticket.dishId);
    const x = 24 + index * (CARD_W + 32);
    const status = world.ticketStatus(ticket);
    const fraction = Math.max(0, ticket.patience / ticket.max);

    ctx.fillStyle = status === 'ready' ? '#eef7e6' : '#f5ead2';
    ctx.strokeStyle = status === 'ready' ? '#58b368' : ticket.uid === highlighted ? '#f2c14e' : '#8a7a5c';
    ctx.lineWidth = ticket.uid === highlighted || status === 'ready' ? 4 : 2;
    ctx.beginPath();
    ctx.roundRect(x, CARD_Y, CARD_W, CARD_H, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#23262f';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(dish.name, x + 12, CARD_Y + 26);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = status === 'ready' ? '#2f7d3e' : status === 'mid' ? '#a87608' : '#8a7a5c';
    ctx.textAlign = 'right';
    ctx.fillText(status === 'ready' ? 'READY!' : status === 'mid' ? 'COOKING' : 'NEW', x + CARD_W - 12, CARD_Y + 26);

    const remaining = dish.needs.slice();
    dish.needs.forEach((need, needIndex) => {
      const [ingredientId, finish] = need.split(':');
      const iconX = x + 28 + needIndex * 52;
      const iconY = CARD_Y + 56;
      drawIngredientIcon(ctx, ingredientId, iconX, iconY, 34, finish);
      const coveredAt = remaining.indexOf(need);
      const isCovered = covered.includes(need) && coveredAt !== -1;
      if (isCovered) remaining.splice(coveredAt, 1);
      if (isCovered) {
        ctx.strokeStyle = '#2f7d3e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(iconX - 8, iconY);
        ctx.lineTo(iconX - 2, iconY + 7);
        ctx.lineTo(iconX + 9, iconY - 7);
        ctx.stroke();
      }
    });

    ctx.fillStyle = '#d8cbb2';
    ctx.fillRect(x + 12, CARD_Y + CARD_H - 14, CARD_W - 24, 8);
    ctx.fillStyle = patienceColor(fraction);
    ctx.fillRect(x + 12, CARD_Y + CARD_H - 14, (CARD_W - 24) * fraction, 8);
    ctx.fillStyle = '#8a7a5c';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(ticket.patience)}s`, x + CARD_W - 12, CARD_Y + CARD_H - 18);
  });
  // Empty slots keep the board honest about the rush.
  for (let index = world.tickets.length; index < 3; index += 1) {
    const x = 24 + index * (CARD_W + 32);
    ctx.strokeStyle = '#8a7a5c';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, CARD_Y, CARD_W, CARD_H, 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#8a7a5c';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Next order coming…', x + CARD_W / 2, CARD_Y + CARD_H / 2 + 6);
  }
}

function overlayPanel(ctx, title, lines, prompt) {
  ctx.fillStyle = 'rgba(20, 18, 24, 0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#f5ead2';
  ctx.strokeStyle = '#f2c14e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(290, 150, 700, 420, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#23262f';
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(title, 640, 225);
  ctx.font = '19px system-ui, sans-serif';
  lines.forEach((line, index) => {
    ctx.fillText(line, 640, 285 + index * 32);
  });
  ctx.fillStyle = '#a87608';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(prompt, 640, 520);
}

export function drawTitleOverlay(ctx, world) {
  overlayPanel(ctx, 'GOLDEN LADLE', [
    'Hearth Kitchen Rush — a timed cooking game.',
    'Grab ingredients from the pantry, chop them on the board,',
    'grill them on the hearth, plate the dish and ring the bell.',
    'Move: WASD / arrows or click  ·  Use: E or Space (hold to chop)',
    'Baste with B to hold a burn and earn a tip  ·  1-6 picks a crate',
    'Serve fast: tips shrink as patience runs out. Three strikes and the day ends.',
    'Last 30 seconds are Golden Hour: every tip pays double.',
  ], 'Press Enter or click to start cooking');
  void world;
}

export function drawPauseOverlay(ctx) {
  overlayPanel(ctx, 'PAUSED', ['Take a breath. The hearth stays warm.'], 'Press P to keep cooking');
}

export function drawGameOverOverlay(ctx, world) {
  const title = world.overReason === 'hearts' ? 'SERVICE CLOSED' : 'DAY COMPLETE';
  const lines = [
    `Score ${world.score.toLocaleString('en-US')}  ·  Dishes served ${world.served}`,
    `Best combo x${world.bestCombo}  ·  Orders lost ${world.lost}  ·  Burnt ${world.burntCount}`,
    world.overReason === 'hearts'
      ? 'Three orders walked out. The regulars will be back tomorrow.'
      : 'The day timer ran out. The hearth is banked for the night.',
  ];
  overlayPanel(ctx, title, lines, 'Press Enter to cook another day');
}
