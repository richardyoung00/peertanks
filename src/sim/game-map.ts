import type { ItemId } from './items';
import type { TerrainType } from './terrain';

/** A position in tile units, where (0, 0) is the top-left corner of the map. */
export interface MapPoint {
  x: number;
  y: number;
}

export interface PickupPoint extends MapPoint {
  /** What can appear here; empty means anything. */
  items: ItemId[];
  respawnSeconds?: number;
}

export interface GameMap {
  name: string;
  theme: string;
  width: number;
  height: number;
  terrain: TerrainType[];
  /** Per tile, a named look the map wants (e.g. a "round" tree), or null to let the theme choose. Visual only. */
  variants: (string | null)[];
  spawns: MapPoint[];
  pickups: PickupPoint[];
}

export function terrainAt(map: GameMap, x: number, y: number): TerrainType {
  const column = Math.floor(x);
  const row = Math.floor(y);
  const outside = column < 0 || row < 0 || column >= map.width || row >= map.height;
  if (outside) return 'wall';
  return map.terrain[row * map.width + column];
}
