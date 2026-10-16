export interface ListenerPosition {
  x: number;
  y: number;
}

export interface Placement {
  volume: number;
  pan: number;
}

// In tiles. The camera shows roughly 20 tiles across, so sounds fade out a little beyond the screen edge.
const FULL_VOLUME_DISTANCE = 4;
const SILENT_DISTANCE = 24;
/** How far to the side a sound has to be to come fully from one speaker (it never quite does). */
const PAN_DISTANCE = 14;
const MAX_PAN = 0.7;

/** How loud, and from which side, a sound at (x, y) is for the listener. Null when it's too far to hear. */
export function placeSound(x: number, y: number, listener: ListenerPosition): Placement | null {
  const distance = Math.hypot(x - listener.x, y - listener.y);
  if (distance >= SILENT_DISTANCE) return null;
  const fade = Math.max(0, distance - FULL_VOLUME_DISTANCE) / (SILENT_DISTANCE - FULL_VOLUME_DISTANCE);
  const volume = (1 - fade) * (1 - fade);
  const pan = Math.max(-MAX_PAN, Math.min(MAX_PAN, (x - listener.x) / PAN_DISTANCE));
  return { volume, pan };
}
