import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { tileRandom, tileRandomBetween } from '../tile-random';
import { buildInstancedMesh, tilesOfType, varyColor, type InstancePlacement, type TileCoordinate } from './instancing';

interface TreePart {
  geometry: THREE.BufferGeometry;
  height: number;
  isLeaves: boolean;
}

const TREE_PARTS: TreePart[] = [
  { geometry: new THREE.CylinderGeometry(0.07, 0.1, 0.4, 6), height: 0.2, isLeaves: false },
  { geometry: new THREE.ConeGeometry(0.46, 0.7, 7), height: 0.62, isLeaves: true },
  { geometry: new THREE.ConeGeometry(0.32, 0.55, 7), height: 0.98, isLeaves: true },
];

export function buildTrees(map: GameMap, theme: Theme): THREE.Object3D {
  const tiles = tilesOfType(map, ['tree']);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
  const group = new THREE.Group();
  for (const part of TREE_PARTS) {
    const placements = tiles.map((tile) => placeTreePart(tile, part, theme));
    group.add(buildInstancedMesh(part.geometry, material, placements, { castShadow: true, receiveShadow: true }));
  }
  return group;
}

function placeTreePart(tile: TileCoordinate, part: TreePart, theme: Theme): InstancePlacement {
  const { column, row } = tile;
  const size = tileRandomBetween(column, row, 30, 0.85, 1.15);
  const leafColor = theme.tree.leaves[Math.floor(tileRandom(column, row, 31) * theme.tree.leaves.length)];
  return {
    x: column + 0.5,
    y: part.height * size,
    z: row + 0.5,
    rotationY: tileRandom(column, row, 32) * Math.PI * 2,
    scale: { x: size, y: size, z: size },
    color: part.isLeaves ? varyColor(leafColor, tileRandom(column, row, 33)) : new THREE.Color(theme.tree.trunk),
  };
}
