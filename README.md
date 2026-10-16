# Tanks

A top-down, free-for-all tank shooter that runs entirely in the browser. One player hosts, shares a link, and up to 8 players (people and bots) fight in 3-minute rounds. There is no game server: the site is static files on GitHub Pages, and players connect to each other directly.

Play it at https://richardyoung.co.za/peertanks/

## The game

- **Drive** with the arrow keys or WASD (up is always up the screen), **aim** with the mouse, **click** to fire.
- Everyone has a cannon with unlimited ammo. Other weapons appear on the map: machine gun, bouncy cannon, laser, rocket, grenade (hold to throw further) and mortar (flies over walls).
- **Powerups** last a short time: shield, speed, damage boost, and a dead man's switch that explodes when you die.
- Water, lava and pits destroy tanks. Explosions push tanks, so a near miss can still knock you in.
- A kill scores a point. The highest score when the round ends wins.
- **Bots** come in easy, medium and hard, each with a random play style so they don't all play alike.
- **Maps:** Meadow (grassland), Frostbite (snow) and Caldera (volcanic).

## How it works

**Peer-to-peer.** The host's browser runs the game and is the final word on what happens. Other players connect to it over WebRTC, using [PeerJS](https://peerjs.com) only to find each other. Players send their key and mouse input; the host sends back the state of the game 20 times a second in a compact binary format. Your own tank and shots react instantly, and other tanks are smoothed between updates.

**Joining.** Hosting creates a 6-character code and a link like `…/peertanks/#join=ABC123`. Opening the link joins that game. Builds are version-checked on join, so a player with an old cached copy is told to refresh.

**Connection help.** Most players connect directly. Those who can't (for example on some mobile networks) go through Cloudflare's TURN relay. A small Cloudflare Worker in `workers/turn-credentials` hands out short-lived relay logins so no secret ships in the game. If the Worker can't be reached, the game falls back to a free relay set at build time.

**Code layout** (`src/`):

| Folder | What's in it |
|---|---|
| `sim/` | Game rules and physics (2D, using Rapier). No graphics code, so it runs the same everywhere and in tests |
| `net/` | Hosting, joining, packets, prediction and smoothing |
| `bots/` | Bot perception, decisions, pathfinding and aim. Bots send the same input a person would |
| `render/` | 3D graphics with three.js. Tanks, trees, rocks and effects are built in code |
| `ui/`, `audio/`, `input/` | Menus and HUD, sound, keyboard and mouse |
| `app/` | Ties it together for the host and for joining players |

- **Balance numbers** (damage, speeds, ammo, bot skill) all live in `src/gameplay-config.ts`.
- **Maps** are [Tiled](https://www.mapeditor.org) JSON files in `public/maps`, listed in `public/maps/index.json`. Each map is one self-contained file.

More detail is in [docs/PLAN.md](docs/PLAN.md). Asset sources and licences are in [ASSETS.md](ASSETS.md).

## Running it locally

**You need:** Node.js 20.19+ or 22.12+, npm, a modern browser, and an internet connection (players find each other through the public PeerJS server).

```sh
npm install
npm run dev
```

Open the address Vite prints. To try multiplayer, host in one tab and open the invite link in another. Use `npm run dev -- --host` to join from another device on your network.

In dev builds the host has shortcuts: **F8** ends the round, **F9** gives every weapon, **F10** turns on every powerup.

| Command | Does |
|---|---|
| `npm run dev` | Dev server with live reload |
| `npm test` | Runs the tests (game rules, weapons, packets, maps, bot matches) |
| `npm run typecheck` | Checks types |
| `npm run build` | Type-checks and builds to `dist/` |
| `npm run preview` | Serves the built `dist/` |

### Optional setup

None of this is needed to play locally.

- **Fallback relay:** put `TURN_SERVER`, `TURN_USERNAME` and `TURN_PASSWORD` in a `.env` file to build in the fallback relay. The deploy gets these from GitHub secrets.
- **Announcer voice:** `npm run voice` records new or changed lines from `tools/voice-lines.json`. Needs [uv](https://docs.astral.sh/uv/), Python 3.10–3.12 and ffmpeg. The speech model downloads on first run.
- **Sound effects:** `tools/import-sound-effects.sh <folder>` rebuilds `public/audio/effects`. Needs ffmpeg and the unzipped Kenney Sci-Fi and Impact sound packs.
- **Relay Worker:** `npm run deploy:turn` deploys it with Wrangler. Needs a Cloudflare account, with `CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_API_TOKEN` set as Worker secrets.

## Deploying

Every push to `main` runs the tests, builds the game and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).
