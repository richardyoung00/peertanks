import type * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { tileRandom, tileRandomBetween } from '../tile-random';
import { tilesOfType, varyColor, type TileCoordinate } from './instancing';
import { buildProps, pickWeighted, type PropPlacement } from './props';
import { isTreeShape, TREE_SHAPES } from './tree-shapes';

const MAX_LEAN = 0.08;

export function buildTrees(map: GameMap, theme: Theme): THREE.Object3D {
  const placements = tilesOfType(map, ['tree']).map((tile) => placeTree(map, tile, theme));
  return buildProps(TREE_SHAPES, placements, { castShadow: true, receiveShadow: true });
}

function placeTree(map: GameMap, tile: TileCoordinate, theme: Theme): PropPlacement {
  const { column, row } = tile;
  const variant = map.variants[row * map.width + column];
  const shape = isTreeShape(variant) ? variant : (pickWeighted(theme.trees.shapes, tileRandom(column, row, 34)) ?? 'pine');
  const size = tileRandomBetween(column, row, 30, 0.85, 1.12);
  const height = size * tileRandomBetween(column, row, 35, 0.92, 1.1);
  const leaves = theme.trees.leaves[Math.floor(tileRandom(column, row, 31) * theme.trees.leaves.length)];
  return {
    shape,
    x: column + 0.5,
    z: row + 0.5,
    rotationY: tileRandom(column, row, 32) * Math.PI * 2,
    tiltX: tileRandomBetween(column, row, 36, -MAX_LEAN, MAX_LEAN),
    tiltZ: tileRandomBetween(column, row, 37, -MAX_LEAN, MAX_LEAN),
    scale: [size, height, size],
    colors: {
      trunk: varyColor(theme.trees.trunk, tileRandom(column, row, 38), 0.04),
      deadWood: varyColor(theme.trees.deadWood, tileRandom(column, row, 39), 0.05),
      leaves: varyColor(leaves, tileRandom(column, row, 33), 0.05),
      snow: varyColor(theme.trees.snow, tileRandom(column, row, 40), 0.02),
    },
  };
}
