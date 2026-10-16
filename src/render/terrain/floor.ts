import * as THREE from 'three';
import { terrainAt, type GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { tileRandom } from '../tile-random';
import { buildInstancedMesh, tilesOfType } from './instancing';
import { patchNoise, smoothstep } from './patch-noise';

const FLOOR_THICKNESS = 0.3;
const OUTER_GROUND_SIZE = 200;
const OUTER_GROUND_HEIGHT = -0.32;
const HUE_JITTER = 0.012;
const DEFAULT_TILE_VARIATION = 0.025;
/** Ground this many tiles from lava picks up a warm glow, strongest right beside it. */
const LAVA_WARMTH_REACH = 2;
const LAVA_WARMTH = 0.2;

/** Every solid tile sits on a grass block; liquids and pits leave a gap so their banks are visible. */
export function buildFloor(map: GameMap, theme: Theme): THREE.Object3D {
  const tiles = tilesOfType(map, ['floor', 'wall', 'rock', 'tree']);
  const placements = tiles.map(({ column, row }) => ({
    x: column + 0.5,
    y: -FLOOR_THICKNESS / 2,
    z: row + 0.5,
    color: floorColor(map, column, row, theme),
  }));

  const geometry = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  const group = new THREE.Group();
  group.add(buildInstancedMesh(geometry, material, placements));
  group.add(buildOuterGround(map, theme));
  return group;
}

/** How bare (0 = grass, 1 = bare ground) the floor is around a tile. */
function bareness(column: number, row: number): number {
  return smoothstep(0.66, 0.86, patchNoise(column, row, 5, 40));
}

function lushness(column: number, row: number): number {
  return smoothstep(0.64, 0.86, patchNoise(column, row, 4, 41));
}

/** A soft checkerboard, nudged a little per tile, with drifting patches of bare ground and lush grass. */
function floorColor(map: GameMap, column: number, row: number, theme: Theme): THREE.Color {
  const checker = (column + row) % 2 === 0 ? theme.floor.light : theme.floor.dark;
  const color = new THREE.Color(checker);
  color.lerp(new THREE.Color(theme.floor.lush), lushness(column, row) * 0.4);
  color.lerp(new THREE.Color(theme.floor.bare), bareness(column, row) * 0.4);
  color.lerp(new THREE.Color(theme.lava.warmth), lavaWarmth(map, column, row));
  const hue = (tileRandom(column, row, 1) - 0.5) * 2 * HUE_JITTER;
  const lightness = (tileRandom(column, row, 4) - 0.5) * 2 * (theme.floor.tileVariation ?? DEFAULT_TILE_VARIATION);
  return color.offsetHSL(hue, 0, lightness);
}

function lavaWarmth(map: GameMap, column: number, row: number): number {
  let nearest = Infinity;
  for (let dz = -LAVA_WARMTH_REACH; dz <= LAVA_WARMTH_REACH; dz++) {
    for (let dx = -LAVA_WARMTH_REACH; dx <= LAVA_WARMTH_REACH; dx++) {
      if (terrainAt(map, column + dx, row + dz) === 'lava') nearest = Math.min(nearest, Math.max(Math.abs(dx), Math.abs(dz)));
    }
  }
  if (nearest === Infinity) return 0;
  return LAVA_WARMTH * (1 - (nearest - 1) / LAVA_WARMTH_REACH);
}

function buildOuterGround(map: GameMap, theme: Theme): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(OUTER_GROUND_SIZE, OUTER_GROUND_SIZE);
  const material = new THREE.MeshStandardMaterial({ color: theme.outerGround, roughness: 1 });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(map.width / 2, OUTER_GROUND_HEIGHT, map.height / 2);
  return ground;
}
