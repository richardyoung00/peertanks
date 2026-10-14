# Tanks Game – Plan

A browser-based, peer-to-peer, free-for-all tank shooter. The game rules are 2D and the graphics are 3D. It is hosted as static files on GitHub Pages. See [README.md](../README.md) for the original game ideas.

## 1. Decisions so far

| Area | Choice |
|---|---|
| Language / build | TypeScript + Vite |
| Rendering | three.js, tilted top-down perspective camera (not true isometric) |
| Art style | Stylised low-poly. Tanks built in code from simple shapes, scenery from CC0 kits (Kenney, Quaternius) |
| Physics | Rapier 2D (`@dimforge/rapier2d-compat`, WASM) |
| Networking | PeerJS (WebRTC), host is authoritative |
| Maps | Tiled JSON files |
| Players | Up to ~8 per game |
| Host leaves | Game ends for everyone (no host migration in v1) |
| NAT / TURN | Public STUN by default, TURN credentials optional in a config file |
| Announcer voice | Generated once with ElevenLabs (free tier), committed as audio files, credited in the README |

Phaser is no longer used: it can't render 3D models, and we don't need its 2D features alongside three.js.

## 2. Architecture

Three layers that only talk through plain data:

```
 input ──► Simulation (pure TS + Rapier) ──► GameState ──► Renderer (three.js)
                     ▲            │                          UI (HTML/CSS)
                     │            ▼                          Audio
                 Network (host / client)
```

- **Simulation** has no three.js or DOM code. The host runs it as the source of truth. Clients run a copy of it to predict their own tank's movement.
- **Renderer** reads game state and draws it. It never changes the game state.
- **UI** is an HTML/CSS layer over the canvas (menus, HUD). This is simpler and sharper than drawing text in WebGL.

### Folder layout

```
src/
  main.ts                 entry, screen routing (menu → lobby → game)
  config.ts               tick rates, ICE/TURN servers, tuning constants
  sim/
    world.ts              owns Rapier world, steps the game at a fixed rate
    map-loader.ts         Tiled JSON → colliders, spawns, pickup points
    tank.ts               movement, health, invulnerability, respawn
    weapons/              one file per weapon + shared weapon interface
    projectiles.ts        projectile lifetime, bounces, hits
    explosions.ts         area damage with distance falloff
    pickups.ts            weapon/ammo spawns and respawn timers
    round.ts              timer, scores, round end
  net/
    peer.ts               PeerJS setup, join codes, ICE config
    host.ts               accepts clients, applies inputs, broadcasts snapshots
    client.ts             sends inputs, prediction + reconciliation, interpolation
    protocol.ts           message types + binary encode/decode
    ping.ts               round-trip time measurement
  render/
    scene.ts              renderer, lights, shadows, camera follow
    tank-model.ts         procedural low-poly tank, tinted per player
    terrain.ts            map tiles → instanced 3D meshes
    effects/              muzzle flash, trails, explosions, laser beams, decals
  input/                  keyboard (screen-relative), mouse → ground-plane aim
  ui/                     menu, lobby, HUD, scoreboard, kill feed
  audio/                  SFX player, announcer queue
public/
  maps/                   *.json Tiled maps (+ tileset used only for editing)
  audio/                  sfx/, announcer/
  models/                 CC0 glTF props (trees, rocks, crates)
tools/
  generate-voice.ts       script to (re)generate announcer lines via ElevenLabs
  voice-lines.json        the announcer script: id → text (+ voice settings)
```

## 3. Networking

**Joining**
- The host's PeerJS ID is `tanks-game-v1-<CODE>`, where CODE is 6 characters with no ambiguous letters (e.g. no O/0).
- The share link is `https://<user>.github.io/tanks-game/#join=<CODE>`. It uses a hash so GitHub Pages doesn't need routing rules.
- Visiting a join link pre-fills the code. The player just enters a name, which is saved in `localStorage`.

**Data flow**
- Clients send **inputs** to the host every tick (60 times a second): keys pressed, aim angle, aim distance, fire and a sequence number. Each packet repeats the last 3 inputs in case one is lost.
- **Two channels per player:** PeerJS's reliable channel carries the welcome, players joining/leaving, events and pings. A second "fast" channel that we open ourselves never resends lost packets, and carries inputs and snapshots. This replaced the `reliable: false` concern below.
- The host runs the game **60 times a second** and sends **snapshots** 20 times a second. A snapshot holds tanks, projectiles, pickups and the round timer.
- One-off **events** (kill, pickup, explosion, round start/end, player join/leave) are sent reliably.
- Snapshots are compact binary (`ArrayBuffer`) using fixed-point numbers: 13 bytes per tank and 10 per projectile. Rare events use JSON. Rough cost: about 300 bytes per snapshot, so about 6 KB/s per client. With 7 clients the host uploads about 45 KB/s, which home connections handle easily.
- The host sends the whole map in the welcome message, so players can join games on custom maps they don't have.
- **Disconnects:** closing the tab shuts down the connection properly. Otherwise a player silent for 5 s is dropped by the host, and a client that gets no snapshots for 5 s shows "lost connection".
- **Background tabs:** a small worker keeps the simulation ticking when the tab is hidden, so the game doesn't freeze if the host switches tabs. A client that goes quiet is treated as idle after 0.25 s, so its tank stops driving.

**Smoothness**
- **Own tank:** moves instantly (prediction). When a snapshot arrives, the client replays any inputs the host hasn't processed yet.
- **Other tanks:** drawn ~100 ms behind real time and blended smoothly between snapshots.
- **Own shots:** recoil and muzzle flash are instant. The shell itself comes from snapshots, so on a laggy connection it appears a little behind a moving tank. **To do (M4/M5):** draw a predicted shell straight away and hand over to the real one when it arrives.
- **Events** (hits, shots) are played in time with the delayed view of other players, so puffs line up with the shells.
- **Ping:** measured every second and shown in the HUD and scoreboard.

**NAT / connection problems**
- STUN servers are listed in `config.ts`. TURN servers can be added there (e.g. Metered Open Relay free tier, 20 GB/month). TURN credentials would be visible in the shipped code.
- If a connection fails or times out, the player sees a clear message suggesting what to try.
- ~~**To verify early:** PeerJS's `reliable: false` only turns off ordering, not retransmission.~~ Confirmed, and solved with the fast channel above. Trystero stays the fallback if the PeerJS public signalling server becomes unreliable.
- **TURN status (Oct 2026):** the free no-signup relays (PeerJS's own, Open Relay static auth) are offline, so there's no relay for now. Direct connections via STUN cover most home networks. If players on strict networks can't connect, add ExpressTURN (1,000 GB/month free) or Metered (20 GB/month, ports 80/443 + TLS). Both need a free signup; credentials would come from `.env` / a GitHub Actions secret at build time.
- On macOS, a browser without the **Local Network** permission can't connect directly to players on the same network. The error message points players to that setting.

## 4. Simulation

- **Movement:** the arrow keys (and WASD) move the tank relative to the screen. The camera never rotates, so screen directions are map directions. The hull turns to face the direction of travel (front or back, whichever is closer). Tanks are Rapier dynamic bodies that steer by accelerating towards the pressed direction. They slide along walls, push each other, and can be knocked back.
- **Aim:** the mouse position on screen is projected onto the ground, and the turret points at that spot. Its distance from the tank sets throw strength (grenades) and target distance (mortars).
- **Terrain types**, set as tile properties in Tiled:

| Type | Blocks tanks | Blocks direct shots | Kills tank |
|---|---|---|---|
| floor | – | – | – |
| wall / rock | ✔ | ✔ (bounces off) | – |
| tree | ✔ | ✔ | – |
| water / lava / pit | – | – | ✔ |
| arena edge | ✔ | ✔ (bounces off) | – |

Mortars ignore all terrain until they land.

- **Health:** 100. After respawning a player is invulnerable for 2 s, then a 3 s respawn delay applies after each death. A kill scores +1. The player who dies respawns at the spawn point farthest from enemies.
- **Explosions:** full damage inside an inner radius (enough to kill outright), falling off linearly to zero at an outer radius.
- **Physics that adds to gameplay** (intuitive rather than realistic):
  - explosions push tanks outwards, so a near miss with a rocket still shoves you, maybe into lava
  - small recoil pushback when firing heavy weapons
  - tanks bump and push each other rather than stopping dead
  - grenades bounce and roll with some friction, and slopes and walls behave predictably
  - knockback is decided on the host and replayed on clients, so being shoved feels fair

### Weapons (starting values, to tune by playing)

| Weapon | Behaviour | Damage | Ammo |
|---|---|---|---|
| Cannon (default) | Slow straight shot, gone on any hit | 10 (10 shots to kill) | Unlimited |
| Machine gun | Rapid fire, small spread | 4 | 60 |
| Bouncy cannon | Straight shot, bounces 3 times | 25 | 10 |
| Laser | Instant ray cast, reflects 3 times, beam effect | 40 | 5 |
| Rocket | Fast straight shot, explodes on contact | 100 inner / falloff | 4 |
| Grenade | Thrown, bounces off terrain, 2 s fuse | 100 inner / falloff | 3 |
| Mortar | High arc to the cursor spot, flies over terrain, shadow shows the landing spot | 100 inner / falloff | 3 |

- **Pickups:** weapons and powerups spawn randomly around the map (see the open question on how random). A collected pickup is replaced after a delay.

### Powerups (starting values, to tune by playing)

Powerups change your tank for a short time. An active powerup shows as a glow or icon on the tank, so other players can see it.

| Powerup | Effect | Duration |
|---|---|---|
| Shield | Take 50% less damage | 20 s |
| Speed | Move 40% faster | 10 s |
| Damage boost | Deal 50% more damage | 10 s |
| Dead man's switch | Explode on death, causing splash damage (like a rocket) | Until death or 30 s |
- **Switching weapons:** keys 1–7 or the mouse wheel. Cannon is always slot 1.

### Rounds

- Free-for-all, 3 minutes. The highest score wins. A results screen shows for 10 s, then the next round starts on the same map.
- Players can join or leave at any time. Leaving and rejoining resets the score.

## 5. Maps

- Authored in Tiled with two layers:
  - **terrain:** a tile layer. Each tile has a `type` property (see the table above) and an optional `variant` that picks which tree or rock model to show.
  - **objects:** spawn points, pickup points (with the weapon type) and decoration props.
- One map is one self-contained `.json` file, so maps can be shared. The tileset images are only needed for editing in Tiled. The game turns tile types into 3D models.
- The map is checked when it loads (spawns exist, map size is within limits, tile types are known).
- The v1 map is one small arena of about 28×20 tiles, with walls, trees, water and lava.
- **Themes:** each map has a `theme` property (v1: `grassland`; later e.g. `snow`, `lava`, `jungle`). The theme picks the palette, ground material and which model is used for each tile type. A tree is a pine in snow and a palm in the jungle, but behaves the same in the game logic. Adding a theme should only mean adding a theme file and its models, with no game logic changes.

## 6. Rendering and visuals

- **Camera:** perspective view, tilted ~55° from the ground, following the player's tank so it stays in the centre of the screen. When the player dies, the camera stays where it is until they respawn, then snaps to the new spawn point. No minimap.
- **Tanks:** low-poly, built in code (hull, tracks, turret, barrel) and tinted in each player's colour. Tracks animate as the tank moves. Each weapon gets its own barrel shape.
- **Terrain:** instanced meshes, so each tile type draws in one go. Water and lava have animated surfaces. Pits are dark drops with an edge.
- **Effects:**
  - muzzle flash and recoil
  - projectile trails
  - particle explosions with a shockwave, screen shake and a lasting scorch decal
  - glowing laser beam (bloom)
  - shimmering shield while invulnerable
  - floating damage numbers
- **Lighting:** one directional "sun" with soft shadows, plus ambient light. A low-graphics option turns off shadows and bloom.
- **Name tags:** each tank shows its player's name and health bar above it, visible to everyone.
- **Fun and quirks:**
  - squash-and-stretch on firing and getting hit
  - tanks wobble on bumps
  - destroyed tanks pop with the turret flying off and spinning away
  - cartoon "boom" puffs
  - the barrel droops briefly while reloading
  - **hazard deaths get their own animations:** a tank driving into water sinks with bubbles and a splash, and into lava it bobs, glows red-hot and melts down with smoke and sparks. A pit drop falls away with a shrinking tumble. The camera holds still during these, as with any death.
- **Consistent look:** one palette and one low-poly, flat-shaded style for everything. We only take props from kits that match (preferring one family, e.g. Kenney), and recolour them to the palette where needed.

## 7. UI

- **Menu:** name field (saved), *Host game*, *Join game* (code box).
- **Lobby/in-game:** share link with a copy button.
- **HUD:** health bar, current weapon and ammo, weapon slots, round timer, ping, kill feed, and a top-3 mini scoreboard. The full scoreboard shows while Tab is held.
- **End of round:** results with the winner.

## 8. Audio

- **Sound effects:** CC0 packs (Kenney Sci-Fi/Impact sounds, CC0 sounds from Freesound). Played through the Web Audio API, with volume set by distance from your tank.
- **Announcer:** lines such as "Round start", "Final 30 seconds", "Round over", "Double kill", "Killing spree", "First blood", and "You win". The lines live in `tools/voice-lines.json`.
  - `npm run voice` runs `tools/generate-voice.ts`. It reads `ELEVEN_LABS_API_KEY` from `.env` and writes `.mp3` files to `public/audio/announcer/`.
  - It only generates lines that are new or have changed, so the free tier's 10k characters a month go a long way.
  - The key is only used by this local script. It never goes into the game code, and `.env` is in `.gitignore`.
  - The voice engine sits behind a small interface. If ElevenLabs causes problems (quota, quality, terms), we fall back to Kokoro, which is free and runs locally. The same applies to any other paid service: free options are the fallback.
  - Lines are kept fun and a bit silly, with several variants per event (e.g. 3–4 different kill taunts) so they don't get repetitive.
  - Free-tier output is non-commercial and must credit ElevenLabs. The credit is in the README and on the in-game credits screen.
- Volume sliders for sound effects and the announcer, saved in `localStorage`.

## 9. Deployment

- A GitHub Actions workflow runs `vite build` and publishes to GitHub Pages. Vite's `base` is set to `/tanks-game/`.

## 10. Milestones

Each milestone ends with something playable for you to check.

1. **Scaffold + single player:** Vite/TS project, Rapier, map loading, 3D terrain, procedural tank, screen-relative movement, turret aim, cannon firing.
2. **P2P:** host/join with codes and links, input → host → snapshots, prediction and interpolation, ping display.
3. **Combat loop:** health, damage, death by hazards, respawn and invulnerability, scoring, 3-minute rounds, scoreboard, kill feed.
4. **Weapons, powerups and pickups:** all 7 weapons, 4 powerups, random pickup spawns, weapon switching.
5. **Polish:** effects, sound effects, announcer, menus, settings, GitHub Pages deploy.

## 11. Risks

- **PeerJS public signalling server** (used to connect players) is free but can be rate-limited or go down. Mitigation: the signalling server is configurable, and Trystero is a fallback.
- **Strict NAT without TURN:** some players won't be able to connect. Mitigation: a clear error message and an optional TURN config.
- **Rapier WASM** adds about 1–2 MB to the first download. Fine for a game, and cached after the first load.
- **Host performance:** the host runs the simulation and renders at the same time. Fine for 8 players, but worth watching on low-end laptops.

## 12. Open questions

1. ~~Which voice engine for the announcer?~~ ElevenLabs free tier (decided).
2. ~~Weapon numbers and switching keys~~: OK as starting points.
3. ~~First map~~: I design a small arena; themed arenas come later.
4. ~~Spectating / minimap~~: no minimap; the camera holds still while dead.
5. Random pickup spawning: anywhere on open floor, or random choice among spawn spots placed in the map?
