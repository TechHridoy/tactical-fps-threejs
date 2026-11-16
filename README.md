[![make.fun](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/TechHridoy/tactical-fps-threejs/rank.svg)](https://make.fun/bounty/threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/TechHridoy/tactical-fps-threejs/reward.svg)](https://make.fun/bounty/threejs-fps-02)

# Emberline — Tactical FPS on Ember Yard

A round-based, Counter-Strike-style tactical FPS in three.js, built for the
[make.fun bounty "Make the best three.js tactical FPS"](https://make.fun/bounty/threejs-fps-02).
Single-player against bots, static files, no build step, no network request.

## The game

- **Map: Ember Yard** (40 × 30 m, original) — three lanes (West, Mid, East),
  Site A "Foundry" and Site B "Garden", crates, pillars and low walls.
- **5v5** — you (Ember, amber) with 4 bot teammates vs 5 Tide bots (teal).
- **Rounds** — first to 5 (max 9). Win by eliminating the other team, or by
  capturing a site (stand in it for 4 seconds). 100-second round timer;
  a timeout goes to the team with more fighters alive, then more health.
- **Economy** — start with $800 and a P-9 Sparrow. Kills pay $300, a round
  win $1,000, a loss $700. Buy between rounds: K-7 Wasp SMG ($900),
  AR-77 Longbow rifle ($2,200), L-88 Horizon sniper ($3,200).
- **Gunplay** — hitscan with headshots, recoil, and spread that punishes
  firing on the move. Bots strafe, take cover, fall back when hurt, and
  need a beat to react when they spot you.
- **HUD** — health, money, ammo, weapon, round timer, team scores,
  kill feed, capture progress, and a live minimap.
- **Sound** — synthesised WebAudio (shots, hits, reloads, round stingers);
  no audio files.

## Controls

WASD move · mouse look (pointer lock) · click fire · R reload · B buy menu ·
1–4 buy weapon · Ctrl/C crouch · Space jump · Esc pause.

## Play it

```sh
node serve.ts   # then open http://localhost:8080
```

Needs Node 22.18+ and a desktop browser with WebGL 2. Screenshots are
taken with `?shot=start|play|end&seed=1`.

## Entry

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored `vendor/makefun-threejs.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
