export const TERRAIN_TYPES = ['floor', 'wall', 'rock', 'tree', 'water', 'lava', 'pit'] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];

export type ColliderShape = 'none' | 'box' | 'round';

export interface TerrainRules {
  blocksTanks: boolean;
  blocksShots: boolean;
  killsTanks: boolean;
  collider: ColliderShape;
}

export const TERRAIN_RULES: Record<TerrainType, TerrainRules> = {
  floor: { blocksTanks: false, blocksShots: false, killsTanks: false, collider: 'none' },
  wall: { blocksTanks: true, blocksShots: true, killsTanks: false, collider: 'box' },
  rock: { blocksTanks: true, blocksShots: true, killsTanks: false, collider: 'round' },
  tree: { blocksTanks: true, blocksShots: true, killsTanks: false, collider: 'round' },
  water: { blocksTanks: false, blocksShots: false, killsTanks: true, collider: 'none' },
  lava: { blocksTanks: false, blocksShots: false, killsTanks: true, collider: 'none' },
  pit: { blocksTanks: false, blocksShots: false, killsTanks: true, collider: 'none' },
};

export function isTerrainType(value: unknown): value is TerrainType {
  return TERRAIN_TYPES.includes(value as TerrainType);
}
