import { loadBuffer, playBuffer } from './play-sound';

export type AnnouncerLine = 'roundStart' | 'finalSeconds' | 'roundOver' | 'youWin';

/** Written by `npm run voice`: the recorded variants of each line, as files in public/audio/voice. */
interface VoiceIndex {
  lines: Partial<Record<AnnouncerLine, string[]>>;
}

const recordings = new Map<AnnouncerLine, AudioBuffer[]>();
let loading: Promise<void> | null = null;
let speaking: AudioBufferSourceNode | null = null;

/** Starts loading every recorded line; safe to call more than once. */
export function loadAnnouncerLines(): Promise<void> {
  loading ??= loadAll();
  return loading;
}

/** Says one variant of the line, cutting off anything the announcer was still saying. */
export function playAnnouncerLine(line: AnnouncerLine): void {
  const variants = recordings.get(line);
  if (!variants?.length) return;
  speaking?.stop();
  speaking = playBuffer(variants[Math.floor(Math.random() * variants.length)], 'announcer');
}

/** For the volume slider: something short to hear the announcer's level by. */
export function playAnnouncerSample(): void {
  playAnnouncerLine('roundStart');
}

async function loadAll(): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}audio/voice/index.json`);
    const index = (await response.json()) as VoiceIndex;
    const entries = Object.entries(index.lines) as [AnnouncerLine, string[]][];
    await Promise.all(entries.map(([line, files]) => loadLine(line, files)));
  } catch (error) {
    console.warn("Couldn't load the announcer's lines", error);
  }
}

async function loadLine(line: AnnouncerLine, files: string[]): Promise<void> {
  const buffers = await Promise.all(files.map((file) => loadBuffer(`audio/voice/${file}`)));
  recordings.set(line, buffers.filter((buffer): buffer is AudioBuffer => buffer !== null));
}
