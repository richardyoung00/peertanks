import { audioContext, channelOutput, type SoundChannel } from './audio-engine';

// Small sounds made in code with Web Audio, so they need no files.

interface Tone {
  type: OscillatorType;
  startHz: number;
  endHz: number;
  /** Seconds after the sound starts. */
  delay: number;
  duration: number;
  volume: number;
}

/** A soft wooden "tock" for pressing a button. */
const BUTTON_PRESS: Tone[] = [{ type: 'sine', startHz: 520, endHz: 240, delay: 0, duration: 0.07, volume: 0.35 }];

/** A rising two-note blip that confirms an option was changed. */
const OPTION_CHANGED: Tone[] = [
  { type: 'triangle', startHz: 880, endHz: 880, delay: 0, duration: 0.05, volume: 0.25 },
  { type: 'triangle', startHz: 1320, endHz: 1320, delay: 0.05, duration: 0.08, volume: 0.25 },
];

export function playButtonPress(channel: SoundChannel = 'menus'): void {
  playTones(BUTTON_PRESS, channel);
}

export function playOptionChanged(channel: SoundChannel = 'menus'): void {
  playTones(OPTION_CHANGED, channel);
}

const WHISTLE_START_HZ = 2100;
const WHISTLE_END_HZ = 650;
const WHISTLE_WOBBLE_HZ = 7;
const WHISTLE_WOBBLE_DEPTH_HZ = 25;
const WHISTLE_VOLUME = 0.12;

/** The falling whistle of an incoming mortar shell, ending as it lands. */
export function playIncomingWhistle(delaySeconds: number, durationSeconds: number, volume: number, pan: number): void {
  const output = channelOutput('effects');
  if (!output) return;
  const ctx = audioContext();
  const start = ctx.currentTime + delaySeconds;
  const end = start + durationSeconds;

  const whistle = ctx.createOscillator();
  whistle.type = 'sine';
  whistle.frequency.setValueAtTime(WHISTLE_START_HZ, start);
  whistle.frequency.exponentialRampToValueAtTime(WHISTLE_END_HZ, end);

  const wobble = ctx.createOscillator();
  wobble.frequency.value = WHISTLE_WOBBLE_HZ;
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.value = WHISTLE_WOBBLE_DEPTH_HZ;
  wobble.connect(wobbleDepth).connect(whistle.frequency);

  // Fades in from far away, gets louder as it falls, and cuts off on impact.
  const gain = ctx.createGain();
  const peak = WHISTLE_VOLUME * volume;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, end - 0.05);
  gain.gain.linearRampToValueAtTime(0, end);

  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  whistle.connect(gain).connect(panner).connect(output);
  for (const oscillator of [whistle, wobble]) {
    oscillator.start(start);
    oscillator.stop(end);
  }
}

function playTones(tones: Tone[], channel: SoundChannel): void {
  const output = channelOutput(channel);
  if (!output) return;
  const ctx = audioContext();
  for (const tone of tones) {
    const start = ctx.currentTime + tone.delay;
    const end = start + tone.duration;
    const oscillator = ctx.createOscillator();
    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.startHz, start);
    oscillator.frequency.exponentialRampToValueAtTime(tone.endHz, end);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(tone.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(output);
    oscillator.start(start);
    oscillator.stop(end);
  }
}
