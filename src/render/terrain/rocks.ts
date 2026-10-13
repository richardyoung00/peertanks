import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { tileRandom, tileRandomBetween } from '../tile-random';
import { buildInstancedMesh, tilesOfType, varyColor, type TileCoordinate } from './instancing';

export function buildRocks(map: GameMap, theme: Theme): THREE.Object3D {
  const tiles = tilesOfType(map, ['rock']);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
  const shadows = { castShadow: true, receiveShadow: true };

  const group = new THREE.Group();
  group.add(buildInstancedMesh(new THREE.DodecahedronGeometry(0.42, 0), material, tiles.map((tile) => boulder(tile, theme)), shadows));
  group.add(buildInstancedMesh(new THREE.DodecahedronGeometry(0.16, 0), material, tiles.map((tile) => pebble(tile, theme)), shadows));
  return group;
}

function rockColor(theme: Theme, { column, row }: TileCoordinate, salt: number): THREE.Color {
  const base = theme.rocks[Math.floor(tileRandom(column, row, salt) * theme.rocks.length)];
  return varyColor(base, tileRandom(column, row, salt + 1));
}

function boulder(tile: TileCoordinate, theme: Theme) {
  const { column, row } = tile;
  const size = tileRandomBetween(column, row, 10, 0.9, 1.1);
  return {
    x: column + 0.5,
    y: 0.22,
    z: row + 0.5,
    rotationY: tileRandom(column, row, 11) * Math.PI * 2,
    scale: { x: size, y: size * tileRandomBetween(column, row, 12, 0.7, 0.9), z: size },
    color: rockColor(theme, tile, 13),
  };
}

function pebble(tile: TileCoordinate, theme: Theme) {
  const { column, row } = tile;
  const angle = tileRandom(column, row, 20) * Math.PI * 2;
  return {
    x: column + 0.5 + Math.cos(angle) * 0.38,
    y: 0.06,
    z: row + 0.5 + Math.sin(angle) * 0.38,
    rotationY: angle,
    color: rockColor(theme, tile, 21),
  };
}
