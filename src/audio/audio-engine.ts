import { VOLUMES, type VolumeChannel } from './volume-settings';

/** Every sound plays on one of these; each has its own volume, and all of them go through master. */
export type SoundChannel = Exclude<VolumeChannel, 'master'>;

const SOUND_CHANNELS: SoundChannel[] = ['effects', 'announcer', 'menus'];

let context: AudioContext | null = null;
const channelGains = new Map<SoundChannel, GainNode>();

/** The shared audio context, created on first use. Browsers keep it silent until the player clicks or presses a key. */
export function audioContext(): AudioContext {
  if (context) return context;
  context = new AudioContext();
  const master = context.createGain();
  master.connect(context.destination);
  followVolume(master, 'master');
  for (const channel of SOUND_CHANNELS) {
    const gain = context.createGain();
    gain.connect(master);
    followVolume(gain, channel);
    channelGains.set(channel, gain);
  }
  return context;
}

/** Where a sound on this channel should connect to, or null while sound isn't allowed yet. */
export function channelOutput(channel: SoundChannel): GainNode | null {
  const ctx = audioContext();
  if (ctx.state !== 'running') return null;
  return channelGains.get(channel) ?? null;
}

/**
 * Starts the audio on the player's first click or key press, which is the earliest browsers allow it.
 * `onUnlocked` is the time to load sounds: creating the audio before then makes browsers log a warning.
 */
export function unlockAudioOnFirstGesture(onUnlocked: () => void): void {
  const unlock = () => {
    void audioContext().resume();
    onUnlocked();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

function followVolume(gain: GainNode, channel: VolumeChannel): void {
  const apply = (percent: number) => {
    gain.gain.value = loudnessCurve(percent);
  };
  apply(VOLUMES[channel].get());
  VOLUMES[channel].onChange(apply);
}

/** Ears hear volume roughly logarithmically, so squaring makes the slider feel even across its range. */
function loudnessCurve(percent: number): number {
  const fraction = percent / 100;
  return fraction * fraction;
}
