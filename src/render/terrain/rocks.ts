import type * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { tileRandom, tileRandomBetween } from '../tile-random';
import { tilesOfType, varyColor, type TileCoordinate } from './instancing';
import { buildProps, pickWeighted, type PropPlacement } from './props';
import { isRockShape, ROCK_SHAPES } from './rock-shapes';

export function buildRocks(map: GameMap, theme: Theme): THREE.Object3D {
  const placements = tilesOfType(map, ['rock']).map((tile) => placeRock(map, tile, theme));
  return buildProps(ROCK_SHAPES, placements, { castShadow: true, receiveShadow: true });
}

function placeRock(map: GameMap, tile: TileCoordinate, theme: Theme): PropPlacement {
  const { column, row } = tile;
  const variant = map.variants[row * map.width + column];
  const shape = isRockShape(variant) ? variant : (pickWeighted(theme.rocks.shapes, tileRandom(column, row, 14)) ?? 'boulder');
  const size = tileRandomBetween(column, row, 10, 0.9, 1.08);
  const stone = theme.rocks.colors[Math.floor(tileRandom(column, row, 13) * theme.rocks.colors.length)];
  return {
    shape,
    x: column + 0.5,
    z: row + 0.5,
    rotationY: tileRandom(column, row, 11) * Math.PI * 2,
    scale: [size, size * tileRandomBetween(column, row, 12, 0.9, 1.1), size],
    colors: {
      stone: varyColor(stone, tileRandom(column, row, 15)),
      moss: varyColor(theme.rocks.moss, tileRandom(column, row, 16), 0.05),
    },
  };
}
