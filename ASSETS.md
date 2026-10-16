# Assets and licences

Everything shipped with the game must be free to use without royalties or attribution (see PLAN §9).
Anything not listed here (models, terrain, effects, thumbnails, menu sounds, the mortar whistle) is made in code.

## Fonts

| Asset | Source | Licence |
|---|---|---|
| Lilita One (headings) | [`@fontsource/lilita-one`](https://fontsource.org/fonts/lilita-one) | SIL Open Font License 1.1 |
| Barlow Semi Condensed (text) | [`@fontsource/barlow-semi-condensed`](https://fontsource.org/fonts/barlow-semi-condensed) | SIL Open Font License 1.1 |

## Sound effects

Every sound effect is **CC0** (public domain; crediting is welcome but not required), from [Freesound](https://freesound.org)
or [Kenney](https://kenney.nl/assets). `tools/import-sound-effects.sh` downloads or converts each one into
`public/audio/effects` as mono mp3, trimmed and levelled. Freesound sounds come from the site's public previews.

| Game file | Used for | Source | Original |
|---|---|---|---|
| `cannon` | cannon, bouncy cannon | [Freesound 850499](https://freesound.org/s/850499/) by vulkanbruder | Little Cannon |
| `machine-gun` | machine gun | [Freesound 648733](https://freesound.org/s/648733/) by mikobuntu | machine_gun.wav |
| `launch` | rocket, mortar | [Freesound 521377](https://freesound.org/s/521377/) by Jarusca | Rocket Launch |
| `grenade-throw` | grenade | [Freesound 394873](https://freesound.org/s/394873/) (user since deleted) | Throw 1.mp3 |
| `tank-sank-water` | tank lost in water | [Freesound 9508](https://freesound.org/s/9508/) by petenice | SPLASH.wav |
| `tank-sank-lava` | tank lost in lava | [Freesound 90143](https://freesound.org/s/90143/) by pengo_au | steam_burst.wav |
| `weapon-pickup` | picking up a weapon | [Freesound 442847](https://freesound.org/s/442847/) by krucifix | Gun Cock.wav |
| `powerup-pickup` | picking up a powerup | [Freesound 407479](https://freesound.org/s/407479/) by Loyalty_Freak_Music | heal.mp3 (first 0.5 s) |
| `laser` | laser | Kenney Sci-Fi Sounds | `laserLarge_000` |
| `explosion-1..3` | explosions | Kenney Sci-Fi Sounds | `explosionCrunch_000..002` |
| `tank-destroyed` | tank destroyed | Kenney Sci-Fi Sounds | `lowFrequency_explosion_000` |
| `wall-hit` | shell hits a wall | Kenney Impact Sounds | `impactPlate_heavy_000` |
| `tank-hit-1..3` | shell hits a tank | Kenney Impact Sounds | `impactMetal_medium_000..002` |
| `own-tank-hit` | your tank takes damage | Kenney Impact Sounds | `impactMetal_heavy_000` |

## Announcer

The lines in `public/audio/voice` are generated locally by `npm run voice` from `tools/voice-lines.json`. To add or
change a line, edit that file and run the command again; only new or changed lines are recorded.

**The voice:** Kokoro voice `am_michael` at speed 0.95, then pitched down to 0.82 (about three semitones, same speed),
compressed, and given a short stadium echo. The voice, speed and pitch live in `tools/voice-lines.json`, and the
filters are in `finishing_filter` in `tools/generate-voice-lines.py`, so new lines match the existing ones.

| Part | Source | Licence |
|---|---|---|
| Speech model and voices (Kokoro-82M) | [hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | Apache-2.0, no conditions on the generated audio |
| Model runner | [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) | MIT |

The model is downloaded to `tools/.voice-models` (not committed) and never ships with the game.
