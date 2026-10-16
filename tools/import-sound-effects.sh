#!/usr/bin/env bash
# Builds the game's sound effects as small mono mp3s in public/audio/effects. Every source is CC0 (see ASSETS.md).
# Usage: tools/import-sound-effects.sh <folder with the unzipped Kenney packs>
# The Kenney packs are Sci-Fi Sounds and Impact Sounds from https://kenney.nl/assets.
# Freesound sounds are downloaded from their public previews.
set -euo pipefail

packs="${1:?Pass the folder holding the unzipped kenney_* packs}"
out="$(dirname "$0")/../public/audio/effects"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$out"
rm -f "$out"/*.mp3

# game file name | kenney or freesound | pack/file, or preview link | seconds to keep (optional, fades out)
sounds="
cannon|freesound|https://cdn.freesound.org/previews/850/850499_17413428-hq.mp3
machine-gun|freesound|https://cdn.freesound.org/previews/648/648733_1428489-hq.mp3
launch|freesound|https://cdn.freesound.org/previews/521/521377_10847299-hq.mp3
tank-sank-water|freesound|https://cdn.freesound.org/previews/9/9508_26137-hq.mp3
tank-sank-lava|freesound|https://cdn.freesound.org/previews/90/90143_793892-hq.mp3
weapon-pickup|freesound|https://cdn.freesound.org/previews/442/442847_2237208-hq.mp3
grenade-throw|freesound|https://cdn.freesound.org/previews/394/394873_6479820-hq.mp3
powerup-pickup|freesound|https://cdn.freesound.org/previews/407/407479_7947620-hq.mp3|0.5
laser|kenney|kenney_sci-fi-sounds/laserLarge_000
wall-hit|kenney|kenney_impact-sounds/impactPlate_heavy_000
tank-hit-1|kenney|kenney_impact-sounds/impactMetal_medium_000
tank-hit-2|kenney|kenney_impact-sounds/impactMetal_medium_001
tank-hit-3|kenney|kenney_impact-sounds/impactMetal_medium_002
own-tank-hit|kenney|kenney_impact-sounds/impactMetal_heavy_000
explosion-1|kenney|kenney_sci-fi-sounds/explosionCrunch_000
explosion-2|kenney|kenney_sci-fi-sounds/explosionCrunch_001
explosion-3|kenney|kenney_sci-fi-sounds/explosionCrunch_002
tank-destroyed|kenney|kenney_sci-fi-sounds/lowFrequency_explosion_000
"

# Mono, with the silence at both ends trimmed so the sound lands right on its event.
trim="silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse"

for line in $sounds; do
  IFS='|' read -r name source location keep <<< "$line"
  if [ "$source" = kenney ]; then
    input="$packs/${location%%/*}/Audio/${location#*/}.ogg"
    [ -f "$input" ] || { echo "Missing $input" >&2; exit 1; }
  else
    input="$work/$name.mp3"
    curl -sSfL -o "$input" "$location"
  fi
  filters="$trim"
  if [ -n "$keep" ]; then
    # Fading in the reversed sound fades out its last moment, without working out when that starts.
    filters="$filters,atrim=0:$keep,areverse,afade=t=in:d=0.15,areverse"
  fi
  # Level every sound so its loudest moment peaks at -1 dB, as the Kenney sounds already do.
  peak=$(ffmpeg -hide_banner -i "$input" -af "$filters,volumedetect" -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB/\1/p')
  gain=$(echo "-1 - ($peak)" | bc)
  ffmpeg -hide_banner -loglevel error -y -i "$input" -af "$filters,volume=${gain}dB" \
    -ac 1 -ar 44100 -codec:a libmp3lame -b:a 96k "$out/$name.mp3"
  echo "$name ← $location"
done
