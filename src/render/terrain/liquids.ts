import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { TerrainType } from '../../sim/terrain';
import type { Theme } from '../themes/theme';
import { buildInstancedMesh, tilesOfType } from './instancing';

const BED_TOP = -0.3;
const BED_THICKNESS = 0.3;
const WATER_LEVEL = -0.12;
const LAVA_LEVEL = -0.09;
const PIT_DEPTH = 1.2;

export interface LiquidsView {
  object: THREE.Object3D;
  update(time: number): void;
}

export function buildLiquids(map: GameMap, theme: Theme): LiquidsView {
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: theme.water.surface,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const lavaMaterial = new THREE.MeshStandardMaterial({
    color: theme.lava.surface,
    emissive: theme.lava.glow,
    emissiveIntensity: 0.9,
    roughness: 0.6,
    flatShading: true,
  });

  const water = buildSurface(map, 'water', waterMaterial, WATER_LEVEL);
  const lava = buildSurface(map, 'lava', lavaMaterial, LAVA_LEVEL);

  const group = new THREE.Group();
  group.add(water, lava);
  group.add(buildBeds(map, 'water', theme.water.bed, BED_TOP, BED_THICKNESS));
  group.add(buildBeds(map, 'lava', theme.lava.bed, BED_TOP, BED_THICKNESS));
  group.add(buildBeds(map, 'pit', theme.pit, BED_TOP - PIT_DEPTH, BED_THICKNESS));

  return {
    object: group,
    update(time: number) {
      water.position.y = Math.sin(time * 1.5) * 0.015;
      lavaMaterial.emissiveIntensity = 0.8 + Math.sin(time * 2.2) * 0.2;
    },
  };
}

function buildSurface(map: GameMap, type: TerrainType, material: THREE.Material, level: number): THREE.InstancedMesh {
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const placements = tilesOfType(map, [type]).map(({ column, row }) => ({ x: column + 0.5, y: level, z: row + 0.5 }));
  return buildInstancedMesh(geometry, material, placements, { receiveShadow: true });
}

function buildBeds(map: GameMap, type: TerrainType, color: number, top: number, thickness: number): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(1, thickness, 1);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  const placements = tilesOfType(map, [type]).map(({ column, row }) => ({
    x: column + 0.5,
    y: top - thickness / 2,
    z: row + 0.5,
  }));
  return buildInstancedMesh(geometry, material, placements, { receiveShadow: true });
}
