// Golden Ladle: the hand-in program (Node 22, standard library only).
// It gathers the playable game and its screenshots from beside this file,
// checks the hand-in is whole, and writes the dossier the judge reads.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameSource = join(repoRoot, 'game');
const shotsSource = join(repoRoot, 'screenshots');

function countGameFiles(directory) {
  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    total += entry.isDirectory() ? countGameFiles(path) : 1;
  }
  return total;
}

function handInGame() {
  const indexPath = join(gameSource, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error('game/index.html is missing: the game cannot be handed in without it');
  }
  const shotNames = existsSync(shotsSource)
    ? readdirSync(shotsSource).filter((name) => !name.startsWith('.'))
    : [];
  if (shotNames.length < 3 || shotNames.length > 4) {
    throw new Error(`expected 3 or 4 screenshots, found ${shotNames.length}`);
  }
  for (const name of shotNames) {
    const bytes = statSync(join(shotsSource, name)).size;
    if (bytes > 262144) throw new Error(`screenshot ${name} is ${bytes} bytes, over the 256 KiB cap`);
  }

  mkdirSync(outputDir, { recursive: true });
  cpSync(gameSource, join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  cpSync(shotsSource, join(outputDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);

  console.log(`Golden Ladle handed in: ${countGameFiles(gameSource)} game files, ` +
    `${shotNames.length} screenshots, dossier ${dossier.length} bytes -> ${outputDir}`);
}

handInGame();
