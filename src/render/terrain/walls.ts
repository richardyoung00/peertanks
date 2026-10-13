import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { tileRandom } from '../tile-random';
import { buildInstancedMesh, tilesOfType, varyColor } from './instancing';

const WALL_HEIGHT = 1;
const CAP_HEIGHT = 0.12;
const CAP_OVERHANG = 1.04;

export function buildWalls(map: GameMap, theme: Theme): THREE.Object3D {
  const tiles = tilesOfType(map, ['wall']);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });

  const blocks = tiles.map(({ column, row }) => ({
    x: column + 0.5,
    y: WALL_HEIGHT / 2,
    z: row + 0.5,
    color: varyColor(theme.wall.side, tileRandom(column, row, 2), 0.05),
  }));
  const caps = tiles.map(({ column, row }) => ({
    x: column + 0.5,
    y: WALL_HEIGHT,
    z: row + 0.5,
    color: varyColor(theme.wall.top, tileRandom(column, row, 3), 0.03),
  }));

  const group = new THREE.Group();
  const blockGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
  const capGeometry = new THREE.BoxGeometry(CAP_OVERHANG, CAP_HEIGHT, CAP_OVERHANG);
  group.add(buildInstancedMesh(blockGeometry, material, blocks, { castShadow: true, receiveShadow: true }));
  group.add(buildInstancedMesh(capGeometry, material, caps, { castShadow: true, receiveShadow: true }));
  return group;
}
