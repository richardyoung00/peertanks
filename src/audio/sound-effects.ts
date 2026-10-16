import { loadBuffer, playBuffer, type PlayOptions } from './play-sound';

interface SoundEffect {
  /** Files in public/audio/effects, without the extension. One is picked at random each time. */
  files: string[];
  volume: number;
  /** How far the pitch wanders each time (0.05 = ±5%), so repeats don't sound identical. */
  pitchVariation: number;
  /** Playback speed before variation; below 1 is deeper. */
  rate?: number;
}

// Sources and licences are listed in ASSETS.md.
const SOUND_EFFECTS = {
  cannon: { files: ['cannon'], volume: 0.3, pitchVariation: 0.05 },
  bouncyCannon: { files: ['cannon'], volume: 0.25, pitchVariation: 0.05, rate: 1.25 },
  machineGun: { files: ['machine-gun'], volume: 0.3, pitchVariation: 0.08 },
  laser: { files: ['laser'], volume: 0.5, pitchVariation: 0.04 },
  launch: { files: ['launch'], volume: 0.5, pitchVariation: 0.06 },
  grenadeThrow: { files: ['grenade-throw'], volume: 0.5, pitchVariation: 0.1 },
  wallHit: { files: ['wall-hit'], volume: 0.4, pitchVariation: 0.1 },
  tankHit: { files: ['tank-hit-1', 'tank-hit-2', 'tank-hit-3'], volume: 0.5, pitchVariation: 0.06 },
  ownTankHit: { files: ['own-tank-hit'], volume: 0.65, pitchVariation: 0.05 },
  explosion: { files: ['explosion-1', 'explosion-2', 'explosion-3'], volume: 0.7, pitchVariation: 0.06 },
  tankDestroyed: { files: ['tank-destroyed'], volume: 0.8, pitchVariation: 0.05 },
  tankSankWater: { files: ['tank-sank-water'], volume: 0.6, pitchVariation: 0.05 },
  tankSankLava: { files: ['tank-sank-lava'], volume: 0.6, pitchVariation: 0.05 },
  weaponPickup: { files: ['weapon-pickup'], volume: 0.7, pitchVariation: 0.03 },
  powerupPickup: { files: ['powerup-pickup'], volume: 0.3, pitchVariation: 0 },
} satisfies Record<string, SoundEffect>;

export type SoundEffectId = keyof typeof SOUND_EFFECTS;

const buffers = new Map<string, AudioBuffer>();
let loading: Promise<void> | null = null;

/** Starts loading every effect; safe to call more than once. */
export function loadSoundEffects(): Promise<void> {
  loading ??= Promise.all(allFiles().map(loadFile)).then(() => undefined);
  return loading;
}

/** Plays an effect on the effects channel. `volume` scales the effect's own volume, e.g. for distance. */
export function playSoundEffect(id: SoundEffectId, options: PlayOptions = {}): void {
  const effect: SoundEffect = SOUND_EFFECTS[id];
  const file = effect.files[Math.floor(Math.random() * effect.files.length)];
  const buffer = buffers.get(file);
  if (!buffer) return;
  const wander = 1 + (Math.random() * 2 - 1) * effect.pitchVariation;
  playBuffer(buffer, 'effects', {
    pan: options.pan,
    volume: effect.volume * (options.volume ?? 1),
    rate: (effect.rate ?? 1) * wander,
  });
}

function allFiles(): string[] {
  return [...new Set(Object.values(SOUND_EFFECTS).flatMap((effect) => effect.files))];
}

async function loadFile(file: string): Promise<void> {
  const buffer = await loadBuffer(`audio/effects/${file}.mp3`);
  if (buffer) buffers.set(file, buffer);
}
