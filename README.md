# Отбой (Otboy)

A simple browser Breakout-style game. 100% client-side — all game logic runs in the browser, no server interaction. Built with TypeScript and served by [Bun](https://bun.com).

## Features

- Paddle, ball, and brick physics (angle-based paddle bounce)
- **50 levels** — procedurally generated (8 patterns × varying grid sizes), 2-color scheme per level (no rainbow)
- Visible board borders
- Russian UI
- **Settings panel**: ball speed (slow / normal / fast), top-5 scores, level selection
- **Level selection**: progress is saved — you can start from any level you've already unlocked
- 3 lives, score, level/score/lives HUD
- Game over / win screens with tap-to-restart
- Mobile-friendly: canvas scales to any screen size, touch-drag paddle control
- Desktop: mouse drag or arrow keys
- Data stored in `localStorage` (best level, top-5 scores, settings)

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move paddle | Mouse drag / ← → | Touch drag |
| Launch ball | Space / tap | Tap |
| Settings | ⚙ Настройки button | ⚙ Настройки button |
| Restart | Tap | Tap |

## Run locally

```bash
bun install
bun run start        # dev server with HMR at http://localhost:3000
```

Or directly:

```bash
bun --hot ./index.ts
```

## Run with Docker

```bash
docker compose up -d --build   # build + start
docker compose logs -f         # follow logs
docker compose down            # stop
```

The game is served at **http://localhost:3000** (port configurable via `PORT` env var).

## Static build & GitHub Pages

```bash
bun run build        # outputs dist/ (index.html + bundled JS, CSS inline)
```

Deploying to GitHub Pages:

1. In the repo settings: **Settings → Pages → Source: GitHub Actions**
2. Push to `main` — `.github/workflows/deploy.yml` builds and deploys automatically
3. The game is served at `https://<user>.github.io/<repo>/`

## Type check & format

```bash
bun check          # type check (reads tsconfig.json)
bun fmt            # format
```

## Project structure

```
├── index.ts          # Bun.serve() entry point (dev server with HMR)
├── index.html        # Canvas page, mobile viewport setup
├── game.ts           # All game logic: physics, levels, input, rendering
├── Dockerfile        # oven/bun:1 image, production run
└── docker-compose.yml
```

## Configuration

- `PORT` — server port (default `3000`)
- Game constants (canvas size, paddle/ball size, ball speeds, level count) are at the top of `game.ts`
- Saved data keys in `localStorage`: `otboy.bestLevel`, `otboy.topScores`, `otboy.speed`, `otboy.save`
