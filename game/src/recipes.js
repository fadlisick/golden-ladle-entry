// The pantry and the menu of Golden Ladle: what each ingredient needs before it
// can go on a plate, and which combinations of finished pieces make a dish.
// A component is written as "<ingredient>:<finish>", e.g. "steak:cooked".
// Twelve dishes now: the two new ones are Ember Surf (both grill items, fast
// to fire) and Harvest Feast (the big four-need plate for the late rush).

export const INGREDIENTS = [
  { id: 'tomato', name: 'Tomato', color: '#e2543e', dark: '#a83226', process: 'chop', workSeconds: 1.2, hint: 'Chop' },
  { id: 'mushroom', name: 'Mushroom', color: '#e8dcc0', dark: '#b09a6d', process: 'chop', workSeconds: 1.2, hint: 'Chop' },
  { id: 'herb', name: 'Herb', color: '#58b368', dark: '#2f7d3e', process: 'chop', workSeconds: 0.9, hint: 'Chop' },
  { id: 'steak', name: 'Steak', color: '#b0563f', dark: '#7c3524', process: 'cook', workSeconds: 6.0, hint: 'Grill' },
  { id: 'fish', name: 'Fish', color: '#7fb3d5', dark: '#4a7ba0', process: 'cook', workSeconds: 5.0, hint: 'Grill' },
  { id: 'egg', name: 'Egg', color: '#f6d87c', dark: '#d9a93c', process: 'cook', workSeconds: 4.0, hint: 'Fry' },
];

export const DISHES = [
  { id: 'garden-salad', name: 'Garden Salad', price: 100, needs: ['tomato:chopped', 'mushroom:chopped', 'herb:chopped'] },
  { id: 'ember-steak', name: 'Ember Steak', price: 140, needs: ['steak:cooked', 'herb:chopped'] },
  { id: 'golden-catch', name: 'Golden Catch', price: 130, needs: ['fish:cooked', 'tomato:chopped'] },
  { id: 'hearth-omelette', name: 'Hearth Omelette', price: 150, needs: ['egg:cooked', 'mushroom:chopped', 'herb:chopped'] },
  { id: 'surf-turf', name: 'Surf & Turf', price: 190, needs: ['steak:cooked', 'fish:cooked', 'herb:chopped'] },
  { id: 'ladle-special', name: 'Ladle Special', price: 240, needs: ['steak:cooked', 'egg:cooked', 'tomato:chopped', 'herb:chopped'] },
  { id: 'mushroom-skillet', name: 'Mushroom Skillet', price: 150, needs: ['mushroom:chopped', 'egg:cooked', 'tomato:chopped'] },
  { id: 'fishermans-plate', name: "Fisherman's Plate", price: 170, needs: ['fish:cooked', 'egg:cooked', 'herb:chopped'] },
  { id: 'hearth-brunch', name: 'Hearth Brunch', price: 160, needs: ['egg:cooked', 'tomato:chopped', 'herb:chopped'] },
  { id: 'golden-chowder', name: 'Golden Chowder', price: 180, needs: ['fish:cooked', 'mushroom:chopped', 'egg:cooked'] },
  { id: 'ember-surf', name: 'Ember Surf', price: 170, needs: ['steak:cooked', 'fish:cooked'] },
  { id: 'harvest-feast', name: 'Harvest Feast', price: 210, needs: ['tomato:chopped', 'mushroom:chopped', 'egg:cooked', 'fish:cooked'] },
];

export function ingredientById(id) {
  return INGREDIENTS.find((item) => item.id === id) || null;
}

export function dishById(id) {
  return DISHES.find((dish) => dish.id === id) || null;
}

export function componentKey(ingredientId, finish) {
  return `${ingredientId}:${finish}`;
}

export function finishFor(ingredientId) {
  const found = ingredientById(ingredientId);
  if (!found) return 'raw';
  return found.process === 'chop' ? 'chopped' : 'cooked';
}

/** The finished component a raw ingredient becomes, or null while it is raw. */
export function finishedComponent(piece) {
  if (!piece || piece.state === 'raw' || piece.state === 'burnt') return null;
  return componentKey(piece.ingredient, piece.state);
}

/** How many of a dish's needs are already covered by the given component keys. */
export function matchedNeedCount(dish, componentKeys) {
  const remaining = dish.needs.slice();
  let matched = 0;
  for (const key of componentKeys) {
    const at = remaining.indexOf(key);
    if (at !== -1) {
      remaining.splice(at, 1);
      matched += 1;
    }
  }
  return matched;
}

/** The first need of a dish that the given component keys do not cover yet. */
export function firstMissingNeed(dish, componentKeys) {
  const remaining = dish.needs.slice();
  for (const key of componentKeys) {
    const at = remaining.indexOf(key);
    if (at !== -1) remaining.splice(at, 1);
  }
  return remaining.length > 0 ? remaining[0] : null;
}

/** True when the component keys cover a dish exactly, no more and no less. */
export function plateMatchesDish(componentKeys, dish) {
  if (componentKeys.length !== dish.needs.length) return false;
  return matchedNeedCount(dish, componentKeys) === dish.needs.length;
}
