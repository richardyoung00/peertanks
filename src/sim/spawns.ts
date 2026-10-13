import type { GameMap, MapPoint } from './game-map';
import type { Tank } from './tank';

/** Picks the spawn point whose nearest other tank is furthest away. */
export function chooseSpawn(map: GameMap, otherTanks: Tank[]): MapPoint {
  let best = map.spawns[0];
  let bestDistance = -1;
  for (const spawn of map.spawns) {
    const distance = distanceToNearestTank(spawn, otherTanks);
    if (distance > bestDistance) {
      best = spawn;
      bestDistance = distance;
    }
  }
  return best;
}

function distanceToNearestTank(point: MapPoint, tanks: Tank[]): number {
  let nearest = Infinity;
  for (const tank of tanks) nearest = Math.min(nearest, Math.hypot(tank.x - point.x, tank.y - point.y));
  return nearest;
}
