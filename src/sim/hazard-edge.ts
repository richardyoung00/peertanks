import { terrainAt, type GameMap, type MapPoint } from './game-map';
import { TERRAIN_RULES } from './terrain';

/** Only nearby tiles are searched; anything deeper than this counts as this deep. */
const SEARCH_TILES = 2;

/** The closest point on safe ground to a position, or null if there's none nearby. */
export function nearestSafePoint(map: GameMap, x: number, y: number): MapPoint | null {
  let nearest: MapPoint | null = null;
  let nearestDistance = Infinity;
  for (let row = Math.floor(y) - SEARCH_TILES; row <= Math.floor(y) + SEARCH_TILES; row++) {
    for (let column = Math.floor(x) - SEARCH_TILES; column <= Math.floor(x) + SEARCH_TILES; column++) {
      if (TERRAIN_RULES[terrainAt(map, column + 0.5, row + 0.5)].killsTanks) continue;
      const point = { x: Math.min(Math.max(x, column), column + 1), y: Math.min(Math.max(y, row), row + 1) };
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < nearestDistance) {
        nearest = point;
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}

/** How far a position is over water, lava or a pit: 0 on safe ground, otherwise the distance to the edge. */
export function depthIntoHazard(map: GameMap, x: number, y: number): number {
  if (!TERRAIN_RULES[terrainAt(map, x, y)].killsTanks) return 0;
  const safe = nearestSafePoint(map, x, y);
  return safe ? Math.hypot(safe.x - x, safe.y - y) : SEARCH_TILES;
}
