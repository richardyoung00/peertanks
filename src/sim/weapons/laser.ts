import RAPIER from '@dimforge/rapier2d-compat';
import { GAMEPLAY } from '../../gameplay-config';
import { damageTank } from '../combat';
import type { Point } from '../game-events';
import { SHOT_QUERY_GROUPS } from '../physics';
import type { Tank } from '../tank';
import type { WorldContext } from '../world-context';
import { announceShot, damageMultiplier, muzzlePoint } from './launch';

const config = GAMEPLAY.weapons.laser;
const SURFACE_OFFSET = 0.01;

/** An instant beam that reflects off walls and stops at the first tank it touches. */
export function fireLaser(context: WorldContext, tank: Tank): void {
  announceShot(context, tank, 'laser', tank.aimAngle);
  const points: Point[] = [muzzlePoint(tank, tank.aimAngle)];

  let origin = { x: tank.x, y: tank.y };
  let direction = { x: Math.cos(tank.aimAngle), y: Math.sin(tank.aimAngle) };
  let remaining = config.range;
  let canHitOwner = false;

  for (let reflections = 0; ; reflections++) {
    const ray = new RAPIER.Ray(origin, direction);
    const excludeBody = canHitOwner ? undefined : tank.body;
    const hit = context.physics.castRayAndGetNormal(ray, remaining, true, undefined, SHOT_QUERY_GROUPS, undefined, excludeBody);
    if (!hit) {
      points.push(ray.pointAt(remaining));
      break;
    }

    const point = ray.pointAt(hit.timeOfImpact);
    points.push(point);
    const target = context.tankByCollider(hit.collider);
    if (target) {
      damageTank(context, target, config.damage * damageMultiplier(tank), tank.id, 'laser');
      break;
    }
    if (reflections === config.reflections) break;

    remaining -= hit.timeOfImpact;
    direction = reflect(direction, hit.normal);
    origin = { x: point.x + hit.normal.x * SURFACE_OFFSET, y: point.y + hit.normal.y * SURFACE_OFFSET };
    canHitOwner = true;
  }

  context.emit({ type: 'laserFired', tankId: tank.id, points });
}

function reflect(direction: Point, normal: Point): Point {
  const along = direction.x * normal.x + direction.y * normal.y;
  return { x: direction.x - 2 * along * normal.x, y: direction.y - 2 * along * normal.y };
}
