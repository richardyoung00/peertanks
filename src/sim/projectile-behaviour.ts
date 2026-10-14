import { GAMEPLAY, type ExplosionConfig } from '../gameplay-config';
import { damageTank } from './combat';
import { isInsideTerrain } from './physics';
import {
  findHitAlongPath,
  isExpired,
  moveProjectile,
  moveTo,
  reflectVelocity,
  type Projectile,
  type ProjectileHit,
} from './projectiles';
import type { WorldContext } from './world-context';

/** Moves a projectile one tick. Returns false once it's gone. */
export function stepProjectile(context: WorldContext, projectile: Projectile, dt: number): boolean {
  projectile.prevX = projectile.x;
  projectile.prevY = projectile.y;
  projectile.age += dt;

  switch (projectile.kind) {
    case 'shell':
    case 'bullet':
      return stepStraightShot(context, projectile, dt);
    case 'bouncy':
      return stepBouncyShot(context, projectile, dt);
    case 'rocket':
      return stepRocket(context, projectile, dt);
    case 'grenade':
      return stepGrenade(context, projectile, dt);
    case 'mortar':
      return stepMortar(context, projectile);
  }
}

const SURFACE_OFFSET = 0.02;
const ROCKET_BACK_OFF = 0.1;
const GRENADE_ARM_SECONDS = 0.3;
const GRENADE_RESTING_HEIGHT = 0.12;
const MORTAR_LAUNCH_HEIGHT = 0.45;

function stepStraightShot(context: WorldContext, projectile: Projectile, dt: number): boolean {
  const hit = findHitAlongPath(context, projectile, dt);
  if (!hit) {
    moveProjectile(projectile, dt);
    return !isExpired(projectile);
  }
  hitAndVanish(context, projectile, hit);
  return false;
}

function stepBouncyShot(context: WorldContext, projectile: Projectile, dt: number): boolean {
  const hit = findHitAlongPath(context, projectile, dt);
  if (!hit) {
    moveProjectile(projectile, dt);
    return !isExpired(projectile);
  }
  if (hit.tank || projectile.bouncesLeft === 0) {
    hitAndVanish(context, projectile, hit);
    return false;
  }
  bounceOff(projectile, hit, 1);
  projectile.bouncesLeft--;
  context.emit({ type: 'shellHit', x: hit.x, y: hit.y });
  return true;
}

function stepRocket(context: WorldContext, projectile: Projectile, dt: number): boolean {
  const hit = findHitAlongPath(context, projectile, dt);
  if (hit) {
    // Explode just in front of the surface, so the wall itself doesn't count as cover.
    const speed = Math.hypot(projectile.vx, projectile.vy);
    moveTo(projectile, hit.x - (projectile.vx / speed) * ROCKET_BACK_OFF, hit.y - (projectile.vy / speed) * ROCKET_BACK_OFF);
    explodeProjectile(context, projectile, GAMEPLAY.weapons.rocket.explosion);
    return false;
  }
  moveProjectile(projectile, dt);
  if (!isExpired(projectile)) return true;
  explodeProjectile(context, projectile, GAMEPLAY.weapons.rocket.explosion);
  return false;
}

/** Grenades fly an arc, then roll. High enough in the arc, they sail over terrain without touching it. */
function stepGrenade(context: WorldContext, projectile: Projectile, dt: number): boolean {
  const config = GAMEPLAY.weapons.grenade;
  if (projectile.age > GRENADE_ARM_SECONDS) projectile.canHitOwner = true;
  updateGrenadeFlight(context, projectile, dt);

  const clearsTerrain = projectile.height > config.terrainClearance;
  const hit = clearsTerrain ? null : findHitAlongPath(context, projectile, dt);
  if (hit) bounceOff(projectile, hit, config.bounciness);
  else moveProjectile(projectile, dt);
  if (clearsTerrain) bounceOffArenaEdge(context, projectile, config.bounciness);

  if (!isExpired(projectile)) return true;
  explodeProjectile(context, projectile, config.explosion);
  return false;
}

function updateGrenadeFlight(context: WorldContext, projectile: Projectile, dt: number): void {
  const config = GAMEPLAY.weapons.grenade;
  const flight = projectile.grenade;
  if (!flight || flight.landed) {
    projectile.height = GRENADE_RESTING_HEIGHT;
    slowDown(projectile, config.deceleration * dt);
    return;
  }

  const progress = projectile.age / flight.airSeconds;
  if (progress < 1) {
    projectile.height = GRENADE_RESTING_HEIGHT + flight.apexHeight * 4 * progress * (1 - progress);
    return;
  }
  // Coming down on top of a wall: keep gliding just over it until it's clear, rather than landing inside.
  if (isInsideTerrain(context.physics, projectile.x, projectile.y)) {
    projectile.height = config.terrainClearance + 0.01;
    return;
  }
  flight.landed = true;
  projectile.height = GRENADE_RESTING_HEIGHT;
  projectile.vx *= config.landingSpeedKept;
  projectile.vy *= config.landingSpeedKept;
}

/** Mortars ignore terrain: they fly a fixed arc from the barrel to the target. */
function stepMortar(context: WorldContext, projectile: Projectile): boolean {
  const flight = projectile.mortar;
  if (!flight) return false;
  const progress = Math.min(projectile.age / flight.flightSeconds, 1);
  moveTo(
    projectile,
    flight.startX + (flight.targetX - flight.startX) * progress,
    flight.startY + (flight.targetY - flight.startY) * progress,
  );
  projectile.height = MORTAR_LAUNCH_HEIGHT + GAMEPLAY.weapons.mortar.arcHeight * 4 * progress * (1 - progress);

  if (progress < 1) return true;
  explodeProjectile(context, projectile, GAMEPLAY.weapons.mortar.explosion);
  return false;
}

/** However high it flies, nothing leaves the arena: the edge acts like an endless wall. */
function bounceOffArenaEdge(context: WorldContext, projectile: Projectile, bounciness: number): void {
  const { width, height } = context.map;
  if (projectile.x < 0 || projectile.x > width) {
    projectile.x = Math.min(Math.max(projectile.x, 0), width);
    projectile.vx = -projectile.vx * bounciness;
  }
  if (projectile.y < 0 || projectile.y > height) {
    projectile.y = Math.min(Math.max(projectile.y, 0), height);
    projectile.vy = -projectile.vy * bounciness;
  }
}

function hitAndVanish(context: WorldContext, projectile: Projectile, hit: ProjectileHit): void {
  context.emit({ type: 'shellHit', x: hit.x, y: hit.y, tankId: hit.tank?.id });
  if (hit.tank) damageTank(context, hit.tank, projectile.damage, projectile.ownerId, projectile.weapon);
}

function bounceOff(projectile: Projectile, hit: ProjectileHit, bounciness: number): void {
  reflectVelocity(projectile, hit, bounciness);
  moveTo(projectile, hit.x + hit.normalX * SURFACE_OFFSET, hit.y + hit.normalY * SURFACE_OFFSET);
  projectile.canHitOwner = true;
}

function explodeProjectile(context: WorldContext, projectile: Projectile, config: ExplosionConfig): void {
  context.explode(projectile.x, projectile.y, config, projectile.ownerId, projectile.weapon, projectile.damageMultiplier);
}

function slowDown(projectile: Projectile, amount: number): void {
  const speed = Math.hypot(projectile.vx, projectile.vy);
  if (speed === 0) return;
  const scale = Math.max(0, speed - amount) / speed;
  projectile.vx *= scale;
  projectile.vy *= scale;
}
