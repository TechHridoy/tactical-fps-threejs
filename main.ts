// Emberline — three.js tactical FPS entrypoint.
//
// This program hands the finished game in: it copies the playable static
// files under game/ and the screenshots under screenshots/ from this
// repository into the output directory, then writes dossier.json there
// with the vendored make.fun library, so the judge can read the game.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for
// /output, e.g.:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

// Directory holding this file, i.e. the repository root.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// Where the handed-in game goes: /output in the grader, or the
// MAKEFUN_OUTPUT_DIR override when run locally.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

// The playable game: plain static files the browser loads as ES modules.
copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));

// Screenshots of the game, taken by its maker; the first by name is the
// cover image. Only copied when the folder exists beside this file.
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  copyTree(shotsDir, join(outputDir, 'screenshots'));
}

// The dossier the judge reads, built from the copied files with the
// scorer's own caps (see the gate's reference limits).
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};
const dossier = buildDossier(outputDir, dossierCaps);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
