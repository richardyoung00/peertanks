import RAPIER from '@dimforge/rapier2d-compat';
import { GAMEPLAY, type ExplosionConfig } from '../gameplay-config';
import { damageTank } from './combat';
import type { DeathCause } from './game-events';
import { COVER_QUERY_GROUPS, isInsideTerrain } from './physics';
import type { Tank } from './tank';
import type { WorldContext } from './world-context';

/**
 * Damages and pushes every tank in range. Damage is full inside the inner radius and falls off to nothing at
 * the outer radius. Walls between the blast and a tank shelter it completely.
 */
export function explode(
  context: WorldContext,
  x: number,
  y: number,
  config: ExplosionConfig,
  ownerId: string,
  cause: DeathCause,
  damageMultiplier: number,
): void {
  context.emit({ type: 'explosion', x, y, radius: config.outerRadius });
  // A mortar landing on top of a wall still hits the tanks around it.
  const insideTerrain = isInsideTerrain(context.physics, x, y);

  for (const tank of context.tanks.values()) {
    if (!tank.alive) continue;
    const distance = Math.hypot(tank.x - x, tank.y - y);
    if (distance > config.outerRadius) continue;
    if (!insideTerrain && isSheltered(context.physics, x, y, tank, distance)) continue;

    const strength = falloff(distance, config);
    knockBack(tank, x, y, distance, config.knockback * strength, ownerId);
    damageTank(context, tank, config.damage * strength * damageMultiplier, ownerId, cause);
  }
}

function falloff(distance: number, config: ExplosionConfig): number {
  if (distance <= config.innerRadius) return 1;
  return 1 - (distance - config.innerRadius) / (config.outerRadius - config.innerRadius);
}

function knockBack(tank: Tank, x: number, y: number, distance: number, speed: number, ownerId: string): void {
  // A tank right on top of the blast gets pushed in its own facing direction.
  const directionX = distance > 0.01 ? (tank.x - x) / distance : Math.cos(tank.hullAngle);
  const directionY = distance > 0.01 ? (tank.y - y) / distance : Math.sin(tank.hullAngle);
  const velocity = tank.body.linvel();
  tank.body.setLinvel({ x: velocity.x + directionX * speed, y: velocity.y + directionY * speed }, true);
  tank.knockbackTimer = GAMEPLAY.explosions.knockbackControlLossSeconds;

  // Being shoved counts as being attacked, so pushing someone into lava earns the kill.
  if (ownerId !== tank.id) {
    tank.lastAttackerId = ownerId;
    tank.lastAttackedTimer = GAMEPLAY.hazardKillCreditSeconds;
  }
}

function isSheltered(physics: RAPIER.World, x: number, y: number, tank: Tank, distance: number): boolean {
  if (distance < 0.01) return false;
  const ray = new RAPIER.Ray({ x, y }, { x: (tank.x - x) / distance, y: (tank.y - y) / distance });
  return physics.castRay(ray, distance, true, undefined, COVER_QUERY_GROUPS) !== null;
}
