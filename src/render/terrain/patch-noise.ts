import { tileRandom } from '../tile-random';

/**
 * Smooth noise across the map (0 to 1), changing over roughly `cellSize` tiles. Used for patches that
 * should clump together, like bare ground, rather than appear on random single tiles.
 */
export function patchNoise(x: number, y: number, cellSize: number, salt: number): number {
  const gridX = x / cellSize;
  const gridY = y / cellSize;
  const left = Math.floor(gridX);
  const top = Math.floor(gridY);
  const blendX = smooth(gridX - left);
  const blendY = smooth(gridY - top);
  const topEdge = mix(tileRandom(left, top, salt), tileRandom(left + 1, top, salt), blendX);
  const bottomEdge = mix(tileRandom(left, top + 1, salt), tileRandom(left + 1, top + 1, salt), blendX);
  return mix(topEdge, bottomEdge, blendY);
}

/** 0 below `from`, 1 above `to`, and a smooth ramp between. */
export function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
  return smooth(t);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
