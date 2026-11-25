// The look of Golden Ladle: a warm hearth kitchen at dusk, drawn entirely in
// code. Dark slate and terracotta, a glowing brick hearth, steam and embers,
// and every station readable at a glance — the judge only ever sees frames.

import { STATIONS, BURNERS, PANTRY_CRATES } from './kitchen.js';
import { ingredientById, dishById, firstMissingNeed } from './recipes.js';
import { drawTopBar, drawOrderBoard } from './hud.js';

/** One ingredient, drawn as a small picture. `finish` changes the picture:
 *  raw is whole, chopped is cut pieces, cooked is browned, burnt is black. */
export function drawIngredientIcon(ctx, ingredientId, cx, cy, size, finish) {
  const ingredient = ingredientById(ingredientId);
  if (!ingredient) return;
  const radius = size / 2;
  const burnt = finish === 'burnt';
  const main = burnt ? '#2b2622' : ingredient.color;
  const dark = burnt ? '#171310' : ingredient.dark;
  ctx.save();
  ctx.translate(cx, cy);
  if (finish === 'chopped') {
    for (let index = 0; index < 3; index += 1) {
      const angle = -0.5 + index * 0.55;
      ctx.fillStyle = index === 1 ? dark : main;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius * 0.5, Math.sin(angle) * radius * 0.5);
      ctx.arc(0, 0, radius * 0.72, angle - 0.45, angle + 0.45);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (ingredientId === 'tomato') {
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.arc(0, 1, radius * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = burnt ? dark : '#58b368';
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.9);
    ctx.lineTo(-radius * 0.35, -radius * 0.35);
    ctx.lineTo(radius * 0.35, -radius * 0.35);
    ctx.closePath();
    ctx.fill();
  } else if (ingredientId === 'mushroom') {
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.arc(0, -radius * 0.15, radius * 0.85, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = burnt ? dark : '#f5ead2';
    ctx.fillRect(-radius * 0.28, -radius * 0.2, radius * 0.56, radius * 0.85);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(-radius * 0.35, -radius * 0.45, radius * 0.14, 0, Math.PI * 2);
    ctx.arc(radius * 0.3, -radius * 0.55, radius * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (ingredientId === 'herb') {
    ctx.strokeStyle = main;
    ctx.lineWidth = radius * 0.28;
    ctx.lineCap = 'round';
    for (let index = -1; index <= 1; index += 1) {
      ctx.beginPath();
      ctx.moveTo(index * radius * 0.4, radius * 0.7);
      ctx.quadraticCurveTo(index * radius * 0.55, 0, index * radius * 0.75, -radius * 0.7);
      ctx.stroke();
    }
  } else if (ingredientId === 'steak') {
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.roundRect(-radius, -radius * 0.62, radius * 2, radius * 1.24, radius * 0.4);
    ctx.fill();
    ctx.strokeStyle = burnt ? dark : '#e8a58c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.6, -radius * 0.2);
    ctx.quadraticCurveTo(0, radius * 0.25, radius * 0.6, -radius * 0.15);
    ctx.stroke();
  } else if (ingredientId === 'fish') {
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.95, radius * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-radius * 0.8, 0);
    ctx.lineTo(-radius * 1.25, -radius * 0.55);
    ctx.lineTo(-radius * 1.25, radius * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#23262f';
    ctx.beginPath();
    ctx.arc(radius * 0.5, -radius * 0.1, radius * 0.12, 0, Math.PI * 2);
    ctx.fill();
  } else if (ingredientId === 'egg') {
    ctx.fillStyle = burnt ? dark : '#fff8e6';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = burnt ? '#171310' : '#f2a93b';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (finish === 'cooked') {
    ctx.strokeStyle = 'rgba(120, 60, 20, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.7, 0.3, 2.4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawProgressRing(ctx, x, y, radius, fraction, color) {
  ctx.strokeStyle = 'rgba(20, 18, 24, 0.55)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, fraction)));
  ctx.stroke();
}

function drawLightPool(ctx, x, y, radius, color) {
  const glow = ctx.createRadialGradient(x, y, 4, x, y, radius);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'rgba(242, 140, 60, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawPantry(ctx, world) {
  const rect = STATIONS.pantry;
  ctx.fillStyle = '#6d4a2f';
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.fillStyle = '#f5ead2';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PANTRY  ·  1-6 to pick', rect.x + 10, rect.y + 16);
  for (const crate of PANTRY_CRATES) {
    const isSelected = PANTRY_CRATES.indexOf(crate) === world.selectedPantry;
    ctx.fillStyle = '#8a5a35';
    ctx.beginPath();
    ctx.roundRect(crate.x, crate.y, crate.w, crate.h, 6);
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#f2c14e' : '#5d3d24';
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.stroke();
    drawIngredientIcon(ctx, crate.ingredient.id, crate.x + 22, crate.y + crate.h / 2, 30, 'raw');
    ctx.fillStyle = '#f5ead2';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(crate.ingredient.name, crate.x + 42, crate.y + 22);
    ctx.fillStyle = '#d8cbb2';
    ctx.fillText(crate.ingredient.hint, crate.x + 42, crate.y + 38);
  }
}

function drawBoard(ctx, world) {
  const rect = STATIONS.board;
  ctx.fillStyle = '#a9804f';
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.fillStyle = '#c49a67';
  ctx.beginPath();
  ctx.roundRect(rect.x + 10, rect.y + 10, rect.w - 20, rect.h - 20, 6);
  ctx.fill();
  ctx.fillStyle = '#5d3d24';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CHOPPING BOARD · hold E', rect.x + 14, rect.y + 18);
  if (world.board.piece) {
    const piece = world.board.piece;
    drawIngredientIcon(ctx, piece.ingredient, 168, 420, 52, piece.state);
    if (piece.state === 'raw') {
      drawProgressRing(ctx, 168, 420, 38, world.board.progress, '#f2c14e');
      if (world.board.progress > 0.05) {
        ctx.strokeStyle = 'rgba(245, 234, 210, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(168, 420, 44, -0.6 + world.board.progress * 4, 0.2 + world.board.progress * 4);
        ctx.stroke();
      }
    }
  } else {
    ctx.fillStyle = '#8a6a42';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Bring something to chop', 168, 422);
  }
}

function drawHearth(ctx, world) {
  const rect = STATIONS.hearth;
  drawLightPool(ctx, 516, 340, 260, 'rgba(242, 140, 60, 0.20)');
  ctx.fillStyle = '#7c3524';
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.fillStyle = '#93503a';
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      ctx.beginPath();
      ctx.roundRect(rect.x + 12 + col * 58 + (row % 2) * 12, rect.y + 34 + row * 22, 48, 16, 3);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#f5ead2';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HEARTH  ·  E to take  ·  B to baste', rect.x + 12, rect.y + 18);
  BURNERS.forEach((burner, index) => {
    const slot = world.burners[index];
    const glow = ctx.createRadialGradient(burner.x, burner.y, 4, burner.x, burner.y, 70);
    glow.addColorStop(0, 'rgba(255, 150, 60, 0.55)');
    glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(burner.x, burner.y, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#23262f';
    ctx.beginPath();
    ctx.arc(burner.x, burner.y, burner.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3f4d';
    ctx.beginPath();
    ctx.arc(burner.x, burner.y, burner.r - 8, 0, Math.PI * 2);
    ctx.fill();
    if (slot.piece) {
      drawIngredientIcon(ctx, slot.piece.ingredient, burner.x, burner.y, 56, slot.piece.state);
      if (slot.piece.state === 'raw') {
        drawProgressRing(ctx, burner.x, burner.y, burner.r - 2, slot.progress, '#f2c14e');
      } else if (slot.piece.state === 'cooked') {
        const grace = 5 + (slot.basted ? 4 : 0);
        const danger = slot.burn / grace;
        drawProgressRing(ctx, burner.x, burner.y, burner.r - 2, 1 - danger, danger > 0.6 ? '#e2543e' : '#58b368');
        if (danger > 0.6) {
          ctx.fillStyle = '#ff8a7a';
          ctx.font = 'bold 15px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('BURNING!', burner.x, burner.y - burner.r - 8);
        } else if (slot.basted) {
          ctx.fillStyle = '#ffd76a';
          ctx.font = 'bold 13px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('★ BASTED', burner.x, burner.y - burner.r - 8);
        }
      }
    } else {
      ctx.fillStyle = '#8a7a5c';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Empty pan', burner.x, burner.y + 4);
    }
  });
}

function drawPlating(ctx, world) {
  const rect = STATIONS.plating;
  ctx.fillStyle = '#e8e0d0';
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.fillStyle = '#5d3d24';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PLATING', rect.x + 12, rect.y + 18);
  const cx = 860;
  const cy = 296;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9bda6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 38, 0, Math.PI * 2);
  ctx.stroke();
  const keys = world.plateComponentKeys();
  keys.forEach((key, index) => {
    const [ingredientId, finish] = key.split(':');
    const angle = -Math.PI / 2 + index * ((Math.PI * 2) / Math.max(1, keys.length));
    drawIngredientIcon(ctx, ingredientId, cx + Math.cos(angle) * 22, cy + Math.sin(angle) * 22, 26, finish);
  });
  // Ghost of the missing garnish: what the best-matching ticket still needs.
  if (keys.length > 0 && !world.plate.dishId) {
    let bestDish = null;
    let bestMatched = 0;
    for (const ticket of world.tickets) {
      const dish = dishById(ticket.dishId);
      const matched = keys.filter((key) => dish.needs.includes(key)).length;
      if (matched > bestMatched) {
        bestMatched = matched;
        bestDish = dish;
      }
    }
    if (bestDish) {
      const missing = firstMissingNeed(bestDish, keys);
      if (missing) {
        const [ingredientId] = missing.split(':');
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#8a7a5c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy - 0, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        drawIngredientIcon(ctx, ingredientId, cx, cy, 26, missing.split(':')[1]);
        ctx.restore();
        ctx.fillStyle = '#8a7a5c';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`needs ${ingredientId}`, cx, cy + 70);
      }
    }
  }
  if (world.plate.dishId) {
    ctx.fillStyle = '#2f7d3e';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${dishById(world.plate.dishId).name} — ready!`, cx, cy + 70);
  }
}

function drawServePass(ctx, world) {
  const rect = STATIONS.serve;
  const carryingPlate = world.carryingPlate();
  const spotlight = carryingPlate || world.passDish;
  if (spotlight) {
    const glow = ctx.createLinearGradient(1140, 190, 1140, 380);
    glow.addColorStop(0, 'rgba(255, 230, 150, 0.34)');
    glow.addColorStop(1, 'rgba(255, 230, 150, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(1060, 190);
    ctx.lineTo(1220, 190);
    ctx.lineTo(1256, 380);
    ctx.lineTo(1024, 380);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#9aa0ad';
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.fillStyle = '#23262f';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SERVE  ·  ring the bell', rect.x + 12, rect.y + 18);
  // The bell.
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.arc(1200, 268, 20, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(1178, 268, 44, 6);
  ctx.fillStyle = '#23262f';
  ctx.beginPath();
  ctx.arc(1200, 246, 4, 0, Math.PI * 2);
  ctx.fill();
  if (carryingPlate) {
    const pulse = 0.6 + 0.4 * Math.sin(world.elapsed * 6);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#a87608';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SERVE!', 1100, 306);
    ctx.restore();
  } else if (world.passDish) {
    const dish = dishById(world.passDish.dishId);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(1100, 296, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9bda6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(1100, 296, 42, 0, Math.PI * 2);
    ctx.stroke();
    dish.needs.forEach((need, index) => {
      const [ingredientId, finish] = need.split(':');
      const angle = -Math.PI / 2 + index * ((Math.PI * 2) / dish.needs.length);
      drawIngredientIcon(ctx, ingredientId, 1100 + Math.cos(angle) * 18, 296 + Math.sin(angle) * 18, 22, finish);
    });
    ctx.fillStyle = '#2f7d3e';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dish.name, 1100, 360);
  } else {
    ctx.fillStyle = '#5d636f';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Pass is clear', 1100, 300);
  }
}

function drawTrash(ctx) {
  const rect = STATIONS.trash;
  ctx.fillStyle = '#3a3f4d';
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.fillStyle = '#f5ead2';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TRASH', rect.x + rect.w / 2, rect.y + 26);
  ctx.fillStyle = '#b9ac93';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('burnt food', rect.x + rect.w / 2, rect.y + 46);
}

function drawChef(ctx, world) {
  const chef = world.chef;
  // Golden footstep trail: the route the chef just ran.
  ctx.save();
  for (const dot of world.trail) {
    ctx.globalAlpha = Math.max(0, dot.life) * 0.7;
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  const bob = chef.moving ? Math.sin(world.elapsed * 14) * 2 : 0;
  const x = chef.x;
  const y = chef.y + bob;
  ctx.fillStyle = 'rgba(20, 18, 24, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x, chef.y + 26, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body: white apron, red scarf.
  ctx.fillStyle = '#f5ead2';
  ctx.beginPath();
  ctx.roundRect(x - 18, y - 8, 36, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#e2543e';
  ctx.fillRect(x - 18, y - 8, 36, 7);
  // Head and toque.
  ctx.fillStyle = '#f0c08f';
  ctx.beginPath();
  ctx.arc(x, y - 20, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y - 32, 13, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x - 13, y - 34, 26, 8);
  // Eyes look the way the chef walks.
  ctx.fillStyle = '#23262f';
  ctx.beginPath();
  ctx.arc(x + chef.dir * 5, y - 21, 2, 0, Math.PI * 2);
  ctx.fill();
  // The golden ladle, always in hand.
  ctx.strokeStyle = '#f2c14e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + chef.dir * 16, y + 2);
  ctx.lineTo(x + chef.dir * 30, y - 12);
  ctx.stroke();
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.ellipse(x + chef.dir * 33, y - 14, 7, 5, chef.dir * 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Carried pieces ride above the chef's head.
  chef.carrying.forEach((item, index) => {
    const iconX = x - 16 + index * 32;
    const iconY = y - 56;
    if (item.kind === 'plate') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(iconX, iconY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c9bda6';
      ctx.lineWidth = 1;
      ctx.stroke();
      const dish = dishById(item.dishId);
      if (dish) {
        ctx.fillStyle = '#2f7d3e';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓', iconX, iconY + 4);
      }
    } else {
      drawIngredientIcon(ctx, item.ingredient, iconX, iconY, 28, item.state);
    }
  });
}

function drawParticles(ctx, world) {
  for (const particle of world.particles) {
    const alpha = Math.max(0, Math.min(1, particle.life));
    if (particle.kind === 'ember') {
      ctx.fillStyle = `rgba(255, ${140 + Math.floor(60 * alpha)}, 60, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(230, 230, 230, ${alpha * 0.25})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFloaters(ctx, world) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px system-ui, sans-serif';
  for (const floater of world.floaters) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, floater.life));
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
    ctx.restore();
  }
}

/** One full frame of the kitchen: floor, stations, chef, HUD. */
export function renderKitchenFrame(ctx, world) {
  ctx.textBaseline = 'alphabetic';
  // Wall and floor.
  ctx.fillStyle = '#2b2f3a';
  ctx.fillRect(0, 0, 1280, 200);
  ctx.fillStyle = '#b5673f';
  ctx.fillRect(0, 200, 1280, 520);
  ctx.fillStyle = '#a85a36';
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 16; col += 1) {
      if ((row + col) % 2 === 0) ctx.fillRect(col * 80 + (row % 2) * 40 - 40, 200 + row * 74, 80, 74);
    }
  }
  drawLightPool(ctx, 516, 340, 300, 'rgba(242, 140, 60, 0.16)');
  drawLightPool(ctx, 1140, 300, 170, 'rgba(255, 230, 150, 0.10)');
  drawPantry(ctx, world);
  drawBoard(ctx, world);
  drawHearth(ctx, world);
  drawPlating(ctx, world);
  drawServePass(ctx, world);
  drawTrash(ctx);
  drawParticles(ctx, world);
  drawChef(ctx, world);
  drawFloaters(ctx, world);
  drawTopBar(ctx, world);
  drawOrderBoard(ctx, world);
}
