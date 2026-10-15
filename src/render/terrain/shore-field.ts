import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { TerrainType } from '../../sim/terrain';

export const SAMPLES_PER_TILE = 8;
/** Distances are only measured this far into a liquid; anything deeper counts as this. */
export const MAX_SHORE_DISTANCE = 2;
/** How much pond corners are rounded off, in samples. */
const SMOOTHING_SAMPLES = 2;

/**
 * For every point, how far it is inside one kind of liquid (0 on dry land, growing towards the middle of a
 * pond). It's smoothed so pond corners round off, but never beyond the true distance, so anything drawn from it
 * (banks, the waterline) always stays inside the hazard tiles and never makes safe ground look dangerous.
 */
export class ShoreField {
  readonly columns: number;
  readonly rows: number;
  private readonly values: Float32Array;

  constructor(
    private readonly map: GameMap,
    private readonly liquid: TerrainType,
  ) {
    this.columns = map.width * SAMPLES_PER_TILE + 1;
    this.rows = map.height * SAMPLES_PER_TILE + 1;
    const exact = this.measureDistances();
    const smoothed = blur(exact, this.columns, this.rows, SMOOTHING_SAMPLES);
    this.values = exact.map((distance, index) => Math.min(distance, smoothed[index]));
  }

  /** The distance at a map position, blended between samples. */
  at(x: number, z: number): number {
    const sampleX = THREE.MathUtils.clamp(x * SAMPLES_PER_TILE, 0, this.columns - 1);
    const sampleZ = THREE.MathUtils.clamp(z * SAMPLES_PER_TILE, 0, this.rows - 1);
    const left = Math.min(Math.floor(sampleX), this.columns - 2);
    const top = Math.min(Math.floor(sampleZ), this.rows - 2);
    const blendX = sampleX - left;
    const blendZ = sampleZ - top;
    const value = (column: number, row: number) => this.values[row * this.columns + column];
    const upper = value(left, top) * (1 - blendX) + value(left + 1, top) * blendX;
    const lower = value(left, top + 1) * (1 - blendX) + value(left + 1, top + 1) * blendX;
    return upper * (1 - blendZ) + lower * blendZ;
  }

  /** The same values as a texture, so shaders can find the shore. Distances are stored as a share of the maximum. */
  toTexture(): THREE.DataTexture {
    const pixels = new Uint8Array(this.columns * this.rows * 4);
    this.values.forEach((distance, index) => {
      pixels[index * 4] = Math.round((distance / MAX_SHORE_DISTANCE) * 255);
      pixels[index * 4 + 3] = 255;
    });
    const texture = new THREE.DataTexture(pixels, this.columns, this.rows, THREE.RGBAFormat);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  private measureDistances(): Float32Array {
    const distances = new Float32Array(this.columns * this.rows);
    for (let row = 0; row < this.rows; row++) {
      for (let column = 0; column < this.columns; column++) {
        distances[row * this.columns + column] = this.distanceToLand(column / SAMPLES_PER_TILE, row / SAMPLES_PER_TILE);
      }
    }
    return distances;
  }

  /** Straight-line distance from a point to the nearest tile that isn't this liquid (the map edge counts as land). */
  private distanceToLand(x: number, z: number): number {
    let nearest = MAX_SHORE_DISTANCE;
    const reach = Math.ceil(MAX_SHORE_DISTANCE);
    for (let row = Math.floor(z) - reach; row <= Math.floor(z) + reach; row++) {
      for (let column = Math.floor(x) - reach; column <= Math.floor(x) + reach; column++) {
        if (this.isLiquid(column, row)) continue;
        const dx = Math.max(column - x, 0, x - (column + 1));
        const dz = Math.max(row - z, 0, z - (row + 1));
        nearest = Math.min(nearest, Math.hypot(dx, dz));
      }
    }
    return nearest;
  }

  private isLiquid(column: number, row: number): boolean {
    const inside = column >= 0 && row >= 0 && column < this.map.width && row < this.map.height;
    return inside && this.map.terrain[row * this.map.width + column] === this.liquid;
  }
}

/** A Gaussian blur, done across and then down. */
function blur(values: Float32Array, columns: number, rows: number, sigma: number): Float32Array {
  const radius = Math.ceil(sigma * 3);
  const weights = Array.from({ length: radius * 2 + 1 }, (_, index) => Math.exp(-((index - radius) ** 2) / (2 * sigma * sigma)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const across = new Float32Array(values.length);
  const result = new Float32Array(values.length);
  const pass = (source: Float32Array, target: Float32Array, horizontal: boolean) => {
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        let sum = 0;
        weights.forEach((weight, index) => {
          const offset = index - radius;
          const sampleColumn = horizontal ? THREE.MathUtils.clamp(column + offset, 0, columns - 1) : column;
          const sampleRow = horizontal ? row : THREE.MathUtils.clamp(row + offset, 0, rows - 1);
          sum += source[sampleRow * columns + sampleColumn] * weight;
        });
        target[row * columns + column] = sum / total;
      }
    }
  };
  pass(values, across, true);
  pass(across, result, false);
  return result;
}
