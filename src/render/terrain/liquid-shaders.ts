import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { TerrainType } from '../../sim/terrain';
import { tilesOfType } from './instancing';
import { MAX_SHORE_DISTANCE, SAMPLES_PER_TILE, type ShoreField } from './shore-field';

/** Low-poly facets on the surfaces, so waves catch the light in flat patches like the rest of the art. */
const SURFACE_STEPS = 4;

/** A liquid (or group of them) that animates over time. */
export interface LiquidSurface {
  object: THREE.Object3D;
  update(time: number): void;
}

/** Smooth value noise and a few layers of it (fbm), for ripples, crust and foam. */
export const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 local = fract(p);
    vec2 blend = local * local * (3.0 - 2.0 * local);
    float a = hash(cell);
    float b = hash(cell + vec2(1.0, 0.0));
    float c = hash(cell + vec2(0.0, 1.0));
    float d = hash(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
  }

  float fbm(vec2 p) {
    float total = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
      total += noise(p) * amplitude;
      p *= 2.03;
      amplitude *= 0.5;
    }
    return total;
  }
`;

/** Looks up how far a map position is inside the liquid, from the shore field texture. */
export const SHORE_GLSL = /* glsl */ `
  uniform sampler2D shoreField;
  uniform vec2 shoreFieldSize;

  float shoreDistance(vec2 mapPosition) {
    vec2 uv = (mapPosition * ${SAMPLES_PER_TILE.toFixed(1)} + 0.5) / shoreFieldSize;
    return texture2D(shoreField, uv).r * ${MAX_SHORE_DISTANCE.toFixed(1)};
  }
`;

/** A flat-shaded normal from screen-space slopes, so every facet is evenly lit. */
export const FACET_NORMAL_GLSL = /* glsl */ `
  vec3 facetNormal(vec3 worldPosition) {
    vec3 normal = normalize(cross(dFdx(worldPosition), dFdy(worldPosition)));
    return normal.y < 0.0 ? -normal : normal;
  }
`;

export function shoreUniforms(field: ShoreField): Record<string, THREE.IUniform> {
  return {
    shoreField: { value: field.toTexture() },
    shoreFieldSize: { value: new THREE.Vector2(field.columns, field.rows) },
  };
}

/** A finely divided flat sheet over every tile of one liquid, at the given height. */
export function buildSurfaceGeometry(map: GameMap, liquid: TerrainType, height: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const { column, row } of tilesOfType(map, [liquid])) {
    for (let stepZ = 0; stepZ < SURFACE_STEPS; stepZ++) {
      for (let stepX = 0; stepX < SURFACE_STEPS; stepX++) {
        const left = column + stepX / SURFACE_STEPS;
        const top = row + stepZ / SURFACE_STEPS;
        const right = left + 1 / SURFACE_STEPS;
        const bottom = top + 1 / SURFACE_STEPS;
        positions.push(left, height, top, left, height, bottom, right, height, top);
        positions.push(right, height, top, left, height, bottom, right, height, bottom);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}
