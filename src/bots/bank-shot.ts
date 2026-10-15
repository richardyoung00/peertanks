import RAPIER from '@dimforge/rapier2d-compat';
import { GAMEPLAY } from '../gameplay-config';
import type { MapPoint } from '../sim/game-map';
import { COVER_QUERY_GROUPS } from '../sim/physics';

const ANGLE_STEPS = 180;
/** How close to the target's centre a beam has to pass to count as a hit. */
const HIT_RADIUS = GAMEPLAY.tank.radius * 0.8;
const SURFACE_OFFSET = 0.01;

export interface BankShot {
  angle: number;
  /** Total distance the shot travels, so shorter (quicker) ones can be preferred. */
  pathLength: number;
}

/**
 * Looks for an angle that bounces a shot off walls into a target the bot can't hit directly.
 * It tries angles all the way round and follows each one off up to `bounces` walls.
 */
export function findBankShot(physics: RAPIER.World, from: MapPoint, target: MapPoint, bounces: number, range: number): BankShot | null {
  let best: BankShot | null = null;
  for (let step = 0; step < ANGLE_STEPS; step++) {
    const angle = (step / ANGLE_STEPS) * Math.PI * 2;
    const length = bouncedPathToTarget(physics, from, target, angle, bounces, range);
    if (length !== null && (!best || length < best.pathLength)) best = { angle, pathLength: length };
  }
  return best;
}

/** Follows one shot. Returns its length when it reaches the target after at least one bounce, else null. */
function bouncedPathToTarget(
  physics: RAPIER.World,
  from: MapPoint,
  target: MapPoint,
  angle: number,
  bounces: number,
  range: number,
): number | null {
  let origin = from;
  let direction = { x: Math.cos(angle), y: Math.sin(angle) };
  let travelled = 0;

  for (let bounce = 0; bounce <= bounces; bounce++) {
    const remaining = range - travelled;
    const hit = physics.castRayAndGetNormal(new RAPIER.Ray(origin, direction), remaining, true, undefined, COVER_QUERY_GROUPS);
    const segmentLength = hit ? hit.timeOfImpact : remaining;
    const end = { x: origin.x + direction.x * segmentLength, y: origin.y + direction.y * segmentLength };

    if (bounce > 0) {
      const toTarget = alongSegment(origin, end, target);
      // A ricochet that comes back through the shooter first would hit them instead.
      const toSelf = alongSegment(origin, end, from);
      if (toTarget !== null && (toSelf === null || toSelf > toTarget)) return travelled + toTarget;
      if (toSelf !== null) return null;
    }
    if (!hit) return null;

    travelled += segmentLength;
    const along = direction.x * hit.normal.x + direction.y * hit.normal.y;
    direction = { x: direction.x - 2 * along * hit.normal.x, y: direction.y - 2 * along * hit.normal.y };
    origin = { x: end.x + hit.normal.x * SURFACE_OFFSET, y: end.y + hit.normal.y * SURFACE_OFFSET };
  }
  return null;
}

/** How far along the segment it passes within hit range of the point, or null if it never does. */
function alongSegment(start: MapPoint, end: MapPoint, point: MapPoint): number | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const along = ((point.x - start.x) * dx + (point.y - start.y) * dy) / length;
  if (along < 0 || along > length) return null;
  const closestX = start.x + (dx / length) * along;
  const closestY = start.y + (dy / length) * along;
  return Math.hypot(point.x - closestX, point.y - closestY) <= HIT_RADIUS ? along : null;
}
