import type RAPIER from '@dimforge/rapier2d-compat';
import type { MapPoint } from '../sim/game-map';
import type { NavGrid } from './nav-grid';
import { hasLineOfFire } from './shooting';

const SEARCH_RADIUS = 7;
const CANDIDATES = 24;
/** Cover right beside water or lava isn't worth the risk. */
const MIN_HAZARD_DISTANCE = 2;

/** A nearby spot that walls hide from the threat, preferring ones close by and further from the threat. */
export function findCover(grid: NavGrid, physics: RAPIER.World, position: MapPoint, threat: MapPoint, random: () => number): MapPoint | null {
  let best: MapPoint | null = null;
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < CANDIDATES; attempt++) {
    const spot = grid.randomOpenTile(random, position, SEARCH_RADIUS);
    if (!spot || grid.hazardDistanceAt(spot.x, spot.y) < MIN_HAZARD_DISTANCE) continue;
    const hidden = !hasLineOfFire(physics, threat, spot);
    const travel = Math.hypot(spot.x - position.x, spot.y - position.y);
    const awayFromThreat = Math.hypot(spot.x - threat.x, spot.y - threat.y);
    const score = (hidden ? 3 : 0) - travel / SEARCH_RADIUS + awayFromThreat / 10;
    if (score > bestScore) {
      best = spot;
      bestScore = score;
    }
  }
  return best;
}
