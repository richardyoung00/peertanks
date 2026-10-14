import RAPIER from '@dimforge/rapier2d-compat';
import { SHOT_QUERY_GROUPS } from './physics';

export interface Projectile {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
  damage: number;
}

export interface ProjectileHit {
  x: number;
  y: number;
  collider: RAPIER.Collider;
}

/** Moves a projectile one step, ray casting along its path so fast shots can't tunnel through thin walls. */
export function advanceProjectile(
  physics: RAPIER.World,
  projectile: Projectile,
  dt: number,
  ownerBody: RAPIER.RigidBody | undefined,
): ProjectileHit | null {
  projectile.prevX = projectile.x;
  projectile.prevY = projectile.y;
  projectile.age += dt;

  const ray = new RAPIER.Ray({ x: projectile.x, y: projectile.y }, { x: projectile.vx, y: projectile.vy });
  const hit = physics.castRay(ray, dt, true, undefined, SHOT_QUERY_GROUPS, undefined, ownerBody);
  if (hit) {
    const point = ray.pointAt(hit.timeOfImpact);
    projectile.x = point.x;
    projectile.y = point.y;
    return { x: point.x, y: point.y, collider: hit.collider };
  }

  projectile.x += projectile.vx * dt;
  projectile.y += projectile.vy * dt;
  return null;
}

export function isExpired(projectile: Projectile): boolean {
  return projectile.age >= projectile.lifetime;
}
