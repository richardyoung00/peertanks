import RAPIER from '@dimforge/rapier2d-compat';
import type { WeaponId } from './items';
import { SHOT_QUERY_GROUPS } from './physics';
import type { Tank } from './tank';
import type { WorldContext } from './world-context';

export const PROJECTILE_KINDS = ['shell', 'bullet', 'bouncy', 'rocket', 'grenade', 'mortar'] as const;
export type ProjectileKind = (typeof PROJECTILE_KINDS)[number];

export interface MortarFlight {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  flightSeconds: number;
}

export interface GrenadeFlight {
  airSeconds: number;
  apexHeight: number;
  landed: boolean;
}

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  ownerId: string;
  /** The weapon that fired it, for kill credit and kill messages. */
  weapon: WeaponId;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  /** Height above the ground, only for drawing; gameplay is all 2D. */
  height: number;
  age: number;
  lifetime: number;
  damage: number;
  bouncesLeft: number;
  /** Ricochets and rolling grenades can hit the tank that fired them. */
  canHitOwner: boolean;
  /** Ammo damage boost at the time of firing, applied to any explosion too. */
  damageMultiplier: number;
  mortar?: MortarFlight;
  grenade?: GrenadeFlight;
}

export interface ProjectileHit {
  x: number;
  y: number;
  normalX: number;
  normalY: number;
  tank?: Tank;
}

/** Ray casts along this tick's movement so fast shots can't tunnel through thin walls. */
export function findHitAlongPath(context: WorldContext, projectile: Projectile, dt: number): ProjectileHit | null {
  const owner = context.tanks.get(projectile.ownerId);
  const excludeBody = projectile.canHitOwner ? undefined : owner?.body;
  const ray = new RAPIER.Ray({ x: projectile.x, y: projectile.y }, { x: projectile.vx, y: projectile.vy });
  const hit = context.physics.castRayAndGetNormal(ray, dt, true, undefined, SHOT_QUERY_GROUPS, undefined, excludeBody);
  if (!hit) return null;

  const point = ray.pointAt(hit.timeOfImpact);
  return { x: point.x, y: point.y, normalX: hit.normal.x, normalY: hit.normal.y, tank: context.tankByCollider(hit.collider) };
}

export function moveProjectile(projectile: Projectile, dt: number): void {
  projectile.x += projectile.vx * dt;
  projectile.y += projectile.vy * dt;
}

export function moveTo(projectile: Projectile, x: number, y: number): void {
  projectile.x = x;
  projectile.y = y;
}

/** Mirrors the velocity off a surface, keeping `bounciness` of the speed. */
export function reflectVelocity(projectile: Projectile, hit: ProjectileHit, bounciness = 1): void {
  const along = projectile.vx * hit.normalX + projectile.vy * hit.normalY;
  projectile.vx = (projectile.vx - 2 * along * hit.normalX) * bounciness;
  projectile.vy = (projectile.vy - 2 * along * hit.normalY) * bounciness;
}

export function isExpired(projectile: Projectile): boolean {
  return projectile.age >= projectile.lifetime;
}
