import * as THREE from 'three';
import { glowing } from '../glow';
import type { GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { tileRandom } from '../tile-random';
import { tilesOfType } from './instancing';
import type { LiquidSurface } from './liquid-shaders';

const EMBERS_PER_TILE = 3;
const RISE_HEIGHT = 1.6;
/** World size of an ember; turned into pixels by how far it is from the camera. */
const EMBER_SIZE = 0.07;
const PIXELS_PER_UNIT_AT_ONE_METRE = 1100;

const vertexShader = /* glsl */ `
  uniform float time;
  uniform float riseHeight;
  uniform float pointScale;
  attribute float phase;
  attribute float speed;
  varying float brightness;

  void main() {
    float life = fract(time * speed + phase);
    vec3 p = position;
    p.y += life * riseHeight;
    p.x += sin(time * 1.3 + phase * 20.0) * 0.1 * life;
    p.z += cos(time * 1.1 + phase * 13.0) * 0.1 * life;
    brightness = (1.0 - life) * smoothstep(0.0, 0.1, life);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = pointScale * (1.0 - life * 0.5) / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 color;
  varying float brightness;

  void main() {
    float fromCentre = length(gl_PointCoord - 0.5);
    if (fromCentre > 0.5) discard;
    gl_FragColor = vec4(color, brightness * (1.0 - fromCentre * 2.0));
    #include <colorspace_fragment>
  }
`;

/** Sparks drifting up from the lava and fading out. They loop forever, all on the graphics card. */
export function buildLavaEmbers(map: GameMap, theme: Theme, surfaceHeight: number): LiquidSurface {
  const positions: number[] = [];
  const phases: number[] = [];
  const speeds: number[] = [];
  for (const { column, row } of tilesOfType(map, ['lava'])) {
    for (let index = 0; index < EMBERS_PER_TILE; index++) {
      const salt = 200 + index * 5;
      positions.push(column + tileRandom(column, row, salt), surfaceHeight, row + tileRandom(column, row, salt + 1));
      phases.push(tileRandom(column, row, salt + 2));
      speeds.push(0.25 + tileRandom(column, row, salt + 3) * 0.3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      riseHeight: { value: RISE_HEIGHT },
      pointScale: { value: EMBER_SIZE * PIXELS_PER_UNIT_AT_ONE_METRE * Math.min(window.devicePixelRatio, 2) },
      color: { value: glowing(theme.lava.glow, 2.5) },
    },
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    object: points,
    update(time) {
      material.uniforms.time.value = time;
    },
  };
}
