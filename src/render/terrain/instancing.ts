import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { TerrainType } from '../../sim/terrain';

export interface TileCoordinate {
  column: number;
  row: number;
}

export interface InstancePlacement {
  x: number;
  y: number;
  z: number;
  rotationY?: number;
  scale?: THREE.Vector3Like;
  color?: THREE.Color;
}

export interface ShadowOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function tilesOfType(map: GameMap, types: TerrainType[]): TileCoordinate[] {
  const tiles: TileCoordinate[] = [];
  map.terrain.forEach((terrain, index) => {
    if (types.includes(terrain)) tiles.push({ column: index % map.width, row: Math.floor(index / map.width) });
  });
  return tiles;
}

export function buildInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  placements: InstancePlacement[],
  shadows: ShadowOptions = {},
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(placements.length, 1));
  mesh.count = placements.length;
  mesh.castShadow = shadows.castShadow ?? false;
  mesh.receiveShadow = shadows.receiveShadow ?? false;

  const transform = new THREE.Object3D();
  placements.forEach((placement, index) => {
    transform.position.set(placement.x, placement.y, placement.z);
    transform.rotation.set(0, placement.rotationY ?? 0, 0);
    transform.scale.copy(placement.scale ?? { x: 1, y: 1, z: 1 });
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    if (placement.color) mesh.setColorAt(index, placement.color);
  });
  return mesh;
}

/** Nudges a colour's lightness by up to `amount` either way, based on a 0..1 random value. */
export function varyColor(base: number, random: number, amount = 0.04): THREE.Color {
  return new THREE.Color(base).offsetHSL(0, 0, (random - 0.5) * 2 * amount);
}
