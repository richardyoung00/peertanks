import { audioContext, channelOutput, type SoundChannel } from './audio-engine';

export interface PlayOptions {
  /** 0–1, on top of the channel's volume. */
  volume?: number;
  /** -1 (left) to 1 (right). */
  pan?: number;
  /** 1 plays at normal speed and pitch; higher is faster and higher. */
  rate?: number;
}

/** Plays a loaded sound once, returning it so it can be stopped. Does nothing until the player has clicked or pressed a key. */
export function playBuffer(buffer: AudioBuffer, channel: SoundChannel, options: PlayOptions = {}): AudioBufferSourceNode | null {
  const output = channelOutput(channel);
  if (!output) return null;
  const ctx = audioContext();

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = options.rate ?? 1;
  const gain = ctx.createGain();
  gain.gain.value = options.volume ?? 1;
  const panner = ctx.createStereoPanner();
  panner.pan.value = options.pan ?? 0;

  source.connect(gain).connect(panner).connect(output);
  source.start();
  return source;
}

/** Fetches and decodes a sound file from the public folder. Resolves null if it can't be loaded. */
export async function loadBuffer(path: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await audioContext().decodeAudioData(await response.arrayBuffer());
  } catch (error) {
    console.warn(`Couldn't load sound ${path}`, error);
    return null;
  }
}
