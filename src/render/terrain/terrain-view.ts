import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { buildFloor } from './floor';
import { buildLiquids } from './liquids';
import { buildRocks } from './rocks';
import { buildTrees } from './trees';
import { buildWalls } from './walls';

export interface TerrainView {
  object: THREE.Object3D;
  update(time: number): void;
}

export function buildTerrainView(map: GameMap, theme: Theme): TerrainView {
  const liquids = buildLiquids(map, theme);
  const group = new THREE.Group();
  group.add(
    buildFloor(map, theme),
    buildWalls(map, theme),
    buildRocks(map, theme),
    buildTrees(map, theme),
    liquids.object,
  );
  return { object: group, update: liquids.update };
}
