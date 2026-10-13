import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { tileRandom } from '../tile-random';
import { buildInstancedMesh, tilesOfType, varyColor } from './instancing';

const FLOOR_THICKNESS = 0.3;
const OUTER_GROUND_SIZE = 200;
const OUTER_GROUND_HEIGHT = -0.32;

/** Every solid tile sits on a grass block; liquids and pits leave a gap so their banks are visible. */
export function buildFloor(map: GameMap, theme: Theme): THREE.Object3D {
  const tiles = tilesOfType(map, ['floor', 'wall', 'rock', 'tree']);
  const placements = tiles.map(({ column, row }) => {
    const checker = (column + row) % 2 === 0 ? theme.floor.light : theme.floor.dark;
    return {
      x: column + 0.5,
      y: -FLOOR_THICKNESS / 2,
      z: row + 0.5,
      color: varyColor(checker, tileRandom(column, row, 1), 0.02),
    };
  });

  const geometry = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  const group = new THREE.Group();
  group.add(buildInstancedMesh(geometry, material, placements, { receiveShadow: true }));
  group.add(buildOuterGround(map, theme));
  return group;
}

function buildOuterGround(map: GameMap, theme: Theme): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(OUTER_GROUND_SIZE, OUTER_GROUND_SIZE);
  const material = new THREE.MeshStandardMaterial({ color: theme.outerGround, roughness: 1 });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(map.width / 2, OUTER_GROUND_HEIGHT, map.height / 2);
  ground.receiveShadow = true;
  return ground;
}
