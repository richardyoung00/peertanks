import RAPIER from '@dimforge/rapier2d-compat';
import { GAMEPLAY } from '../../gameplay-config';
import { SHOT_QUERY_GROUPS } from '../physics';
import type { Tank } from '../tank';
import type { WeaponContext } from './weapon-context';

const CANNON = GAMEPLAY.weapons.cannon;

export function fireCannon(context: WeaponContext, tank: Tank): void {
  const directionX = Math.cos(tank.aimAngle);
  const directionY = Math.sin(tank.aimAngle);
  const muzzleX = tank.x + directionX * GAMEPLAY.tank.barrelLength;
  const muzzleY = tank.y + directionY * GAMEPLAY.tank.barrelLength;

  context.emit({ type: 'shotFired', tankId: tank.id, x: muzzleX, y: muzzleY, angle: tank.aimAngle });

  const blocked = findBarrelObstruction(context.physics, tank, directionX, directionY);
  if (blocked) {
    context.emit({ type: 'shellHit', x: blocked.x, y: blocked.y });
    return;
  }

  context.spawnProjectile({
    ownerId: tank.id,
    x: muzzleX,
    y: muzzleY,
    prevX: muzzleX,
    prevY: muzzleY,
    vx: directionX * CANNON.shellSpeed,
    vy: directionY * CANNON.shellSpeed,
    age: 0,
    lifetime: CANNON.shellLifetimeSeconds,
    damage: CANNON.damage,
  });
}

/** When the barrel is pushed into a wall the shell bursts on the wall instead of spawning inside it. */
function findBarrelObstruction(physics: RAPIER.World, tank: Tank, directionX: number, directionY: number) {
  const ray = new RAPIER.Ray({ x: tank.x, y: tank.y }, { x: directionX, y: directionY });
  const hit = physics.castRay(ray, GAMEPLAY.tank.barrelLength, true, undefined, SHOT_QUERY_GROUPS, undefined, tank.body);
  return hit ? ray.pointAt(hit.timeOfImpact) : null;
}
