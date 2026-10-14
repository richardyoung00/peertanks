import RAPIER from '@dimforge/rapier2d-compat';
import { SIM_DT } from '../config';
import type { GameMap } from './game-map';
import { TERRAIN_RULES, type TerrainRules, type TerrainType } from './terrain';

const GROUP_TERRAIN = 0x0001;
const GROUP_TANK = 0x0002;
const GROUP_SHOT = 0x0004;

const ROUND_COLLIDER_RADIUS = 0.42;
const BOUNDARY_THICKNESS = 1;

// Rapier packs collision groups as 16 bits of membership followed by 16 bits of filter.
function interactionGroups(membership: number, filter: number): number {
  return (membership << 16) | filter;
}

export const TANK_COLLISION_GROUPS = interactionGroups(GROUP_TANK, GROUP_TERRAIN | GROUP_TANK | GROUP_SHOT);
export const SHOT_QUERY_GROUPS = interactionGroups(GROUP_SHOT, GROUP_TERRAIN | GROUP_TANK);
/** Terrain that blocks shots, ignoring tanks; used to check whether walls shelter a tank from an explosion. */
export const COVER_QUERY_GROUPS = interactionGroups(GROUP_SHOT, GROUP_TERRAIN);

/** Whether a point is inside a wall, rock or tree. */
export function isInsideTerrain(physics: RAPIER.World, x: number, y: number): boolean {
  return physics.projectPoint({ x, y }, true, undefined, COVER_QUERY_GROUPS)?.isInside ?? false;
}

export async function initPhysics(): Promise<void> {
  await RAPIER.init();
}

export function createPhysicsWorld(map: GameMap): RAPIER.World {
  const world = new RAPIER.World({ x: 0, y: 0 });
  world.timestep = SIM_DT;
  addTerrainColliders(world, map);
  addBoundaryColliders(world, map);
  return world;
}

function terrainCollisionGroups(rules: TerrainRules): number {
  const filter = (rules.blocksTanks ? GROUP_TANK : 0) | (rules.blocksShots ? GROUP_SHOT : 0);
  return interactionGroups(GROUP_TERRAIN, filter);
}

function addTerrainColliders(world: RAPIER.World, map: GameMap): void {
  for (let row = 0; row < map.height; row++) {
    for (let column = 0; column < map.width; column++) {
      const terrain = map.terrain[row * map.width + column];
      if (TERRAIN_RULES[terrain].collider === 'round') addRoundCollider(world, terrain, column, row);
    }
    addBoxRuns(world, map, row);
  }
}

function addRoundCollider(world: RAPIER.World, terrain: TerrainType, column: number, row: number): void {
  const collider = RAPIER.ColliderDesc.ball(ROUND_COLLIDER_RADIUS)
    .setTranslation(column + 0.5, row + 0.5)
    .setCollisionGroups(terrainCollisionGroups(TERRAIN_RULES[terrain]));
  world.createCollider(collider);
}

/** Merges horizontal runs of the same box terrain into a single collider, so walls are smooth to slide along. */
function addBoxRuns(world: RAPIER.World, map: GameMap, row: number): void {
  let column = 0;
  while (column < map.width) {
    const terrain = map.terrain[row * map.width + column];
    if (TERRAIN_RULES[terrain].collider !== 'box') {
      column++;
      continue;
    }
    let runEnd = column + 1;
    while (runEnd < map.width && map.terrain[row * map.width + runEnd] === terrain) runEnd++;
    addBox(world, column, row, runEnd - column, 1, terrainCollisionGroups(TERRAIN_RULES[terrain]));
    column = runEnd;
  }
}

function addBoundaryColliders(world: RAPIER.World, map: GameMap): void {
  const groups = terrainCollisionGroups(TERRAIN_RULES.wall);
  const t = BOUNDARY_THICKNESS;
  addBox(world, -t, -t, map.width + 2 * t, t, groups);
  addBox(world, -t, map.height, map.width + 2 * t, t, groups);
  addBox(world, -t, 0, t, map.height, groups);
  addBox(world, map.width, 0, t, map.height, groups);
}

function addBox(world: RAPIER.World, left: number, top: number, width: number, height: number, groups: number): void {
  const collider = RAPIER.ColliderDesc.cuboid(width / 2, height / 2)
    .setTranslation(left + width / 2, top + height / 2)
    .setCollisionGroups(groups);
  world.createCollider(collider);
}
