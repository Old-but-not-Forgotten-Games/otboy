# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Arkanoid (Breakout) — a 100% client-side browser game. All logic runs in the browser; Bun is only the dev/production server. UI text is in **Russian** — keep it that way.

## Commands

```bash
bun install          # install deps
bun run start        # dev server with HMR at http://localhost:3000 (bun --hot ./index.ts)
bun check            # type check (reads tsconfig.json; strict mode)
bun fmt              # format
docker compose up -d --build   # production run (oven/bun:1, port 3000, PORT env var)
```

There is no test suite. Verify changes by running the dev server and playing in a browser.

## Architecture

Three files, no build step — Bun's bundler transpiles `game.ts` on the fly when `index.html` is served:

- `index.ts` — `Bun.serve()` entry point; imports `index.html` and serves it with HMR.
- `index.html` — page markup, all CSS (inline `<style>`), and the settings panel DOM. Loads `game.ts` as a module.
- `game.ts` — **everything else**: physics, level generation, input, settings panel, save/restore, HUD, rendering, game loop. It is one flat module with module-level mutable state (no classes), so new features are added as top-level functions/vars in the same style.

Key invariants to preserve when editing:

- **Fixed logical canvas size 480×720** (`W`/`H` at top of `game.ts`). All coordinates are in this space; `resize()` scales via CSS + `ctx.setTransform(dpr, ...)`. Never change the logical size without updating the physics constants.
- **Levels are deterministic, not stored.** `makeBricks(n)` procedurally generates level `n` (8 patterns × grid sizes, 2 colors per level). Save/restore relies on this: `SaveData.bricks` is only a `boolean[]` of alive flags, re-applied onto a freshly generated `makeBricks(s.level)`. Changing the generator changes all saved games' layouts.
- **Game state machine**: `"ready" | "playing" | "paused" | "gameover" | "win"` — transitions happen in the pointer handler, pause button, and `update()`. The `paused` flag (settings panel open) is separate from `state === "paused"`.
- **Persistence is `localStorage` only**, keys in the `LS` object: `arkanoid.bestLevel` (unlocked level, 0-based), `arkanoid.topScores` (top-5), `arkanoid.speed`, `arkanoid.save` (mid-game snapshot, auto-saved every second while playing).
- **Ball speed** comes from `SPEEDS[speed]` (slow/normal/fast) and is re-read on paddle hit and `resetBall()` — it does not change mid-flight.

## Conventions

- `AGENTS.md` (checked in) mandates Bun over Node: `bun test` not jest, `Bun.serve()` not express, `Bun.file` over `node:fs`, etc. Follow it.
- `tsconfig.json` is strict with `noUncheckedIndexedAccess` — array index access returns `T | undefined` (note the `?? fallback` pattern already used in `makeBricks`).
