import RAPIER from '@dimforge/rapier2d-compat';
import { GAMEPLAY } from '../../gameplay-config';
import type { WeaponId } from '../items';
import { SHOT_QUERY_GROUPS } from '../physics';
import type { GrenadeFlight, Projectile, ProjectileKind } from '../projectiles';
import type { Tank } from '../tank';
import type { WorldContext } from '../world-context';

const MUZZLE_HEIGHT = 0.42;

export interface LaunchOptions {
  kind: ProjectileKind;
  weapon: WeaponId;
  angle: number;
  speed: number;
  lifetime: number;
  damage?: number;
  bounces?: number;
  grenade?: GrenadeFlight;
}

export function damageMultiplier(tank: Tank): number {
  return tank.loadout.powerups['damage-boost'] > 0 ? GAMEPLAY.powerups['damage-boost'].damageMultiplier : 1;
}

export function muzzlePoint(tank: Tank, angle: number): { x: number; y: number } {
  return {
    x: tank.x + Math.cos(angle) * GAMEPLAY.tank.barrelLength,
    y: tank.y + Math.sin(angle) * GAMEPLAY.tank.barrelLength,
  };
}

/** Where the barrel runs into a wall, if the tank is pressed up against one. */
export function barrelObstruction(context: WorldContext, tank: Tank, angle: number): { x: number; y: number } | null {
  const ray = new RAPIER.Ray({ x: tank.x, y: tank.y }, { x: Math.cos(angle), y: Math.sin(angle) });
  const hit = context.physics.castRay(ray, GAMEPLAY.tank.barrelLength, true, undefined, SHOT_QUERY_GROUPS, undefined, tank.body);
  return hit ? ray.pointAt(hit.timeOfImpact) : null;
}

export function announceShot(context: WorldContext, tank: Tank, weapon: WeaponId, angle: number): void {
  const muzzle = muzzlePoint(tank, angle);
  context.emit({ type: 'shotFired', tankId: tank.id, weapon, x: muzzle.x, y: muzzle.y, angle });
}

/** Fires a projectile from the end of the barrel. Returns false if the barrel was blocked. */
export function launchProjectile(context: WorldContext, tank: Tank, options: LaunchOptions): boolean {
  if (barrelObstruction(context, tank, options.angle)) return false;
  const muzzle = muzzlePoint(tank, options.angle);
  const projectile: Omit<Projectile, 'id'> = {
    kind: options.kind,
    ownerId: tank.id,
    weapon: options.weapon,
    x: muzzle.x,
    y: muzzle.y,
    prevX: muzzle.x,
    prevY: muzzle.y,
    vx: Math.cos(options.angle) * options.speed,
    vy: Math.sin(options.angle) * options.speed,
    height: MUZZLE_HEIGHT,
    age: 0,
    lifetime: options.lifetime,
    damage: (options.damage ?? 0) * damageMultiplier(tank),
    bouncesLeft: options.bounces ?? 0,
    canHitOwner: false,
    damageMultiplier: damageMultiplier(tank),
    grenade: options.grenade,
  };
  context.spawnProjectile(projectile);
  return true;
}
