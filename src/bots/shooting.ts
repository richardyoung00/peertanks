import RAPIER from '@dimforge/rapier2d-compat';
import { GAMEPLAY } from '../gameplay-config';
import type { MapPoint } from '../sim/game-map';
import type { WeaponId } from '../sim/items';
import { COVER_QUERY_GROUPS } from '../sim/physics';

const weapons = GAMEPLAY.weapons;
const grenade = weapons.grenade;

export interface MovingTarget extends MapPoint {
  vx: number;
  vy: number;
}

/** Whether walls, rocks or trees stand between two points. Water and lava don't block shots. */
export function hasLineOfFire(physics: RAPIER.World, from: MapPoint, to: MapPoint): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const reach = distance - GAMEPLAY.tank.radius;
  if (reach <= 0) return true;
  const ray = new RAPIER.Ray(from, { x: dx / distance, y: dy / distance });
  return physics.castRay(ray, reach, true, undefined, COVER_QUERY_GROUPS) === null;
}

/** Weapons that fly over cover, so they don't need a clear line. */
export function isLobbed(weapon: WeaponId): boolean {
  return weapon === 'mortar' || weapon === 'grenade';
}

/**
 * Where to aim so the shot meets a moving target. `leadShare` is how much of the correct lead the bot
 * gives: 0 aims where the target is now, 1 is perfect.
 */
export function leadPoint(from: MapPoint, target: MovingTarget, weapon: WeaponId, leadShare: number): MapPoint {
  let time = 0;
  let point: MapPoint = target;
  // A few rounds of "how long until the shot gets there?" settle on the meeting point.
  for (let round = 0; round < 3; round++) {
    time = travelSeconds(weapon, Math.hypot(point.x - from.x, point.y - from.y));
    point = { x: target.x + target.vx * time, y: target.y + target.vy * time };
  }
  return { x: target.x + target.vx * time * leadShare, y: target.y + target.vy * time * leadShare };
}

function travelSeconds(weapon: WeaponId, distance: number): number {
  switch (weapon) {
    case 'laser':
      return 0;
    case 'mortar':
      return weapons.mortar.flightSeconds;
    case 'grenade':
      return grenade.fuseSeconds;
    default:
      return distance / weapons[weapon].speed;
  }
}

/** How far a grenade ends up from the thrower, for a charge from 0 (a tap) to 1 (fully held). */
export function grenadeDistance(charge: number): number {
  const between = (min: number, max: number) => min + (max - min) * charge;
  const throwSpeed = between(grenade.minThrowSpeed, grenade.maxThrowSpeed);
  const airSeconds = between(grenade.minAirSeconds, grenade.maxAirSeconds);
  const rollSpeed = throwSpeed * grenade.landingSpeedKept;
  const rollSeconds = Math.min(rollSpeed / grenade.deceleration, grenade.fuseSeconds - airSeconds);
  return throwSpeed * airSeconds + rollSpeed * rollSeconds - 0.5 * grenade.deceleration * rollSeconds ** 2;
}

/** Seconds to hold the fire button so a grenade stops about `distance` away. */
export function grenadeHoldSeconds(distance: number): number {
  let low = 0;
  let high = 1;
  for (let step = 0; step < 12; step++) {
    const middle = (low + high) / 2;
    if (grenadeDistance(middle) < distance) low = middle;
    else high = middle;
  }
  return Math.max((low + high) / 2, 0.05) * grenade.maxChargeSeconds;
}

export const GRENADE_MAX_DISTANCE = grenadeDistance(1);

/** How far from the aim point a shot can be and still count as lined up. Splash weapons allow more. */
export function aimTolerance(weapon: WeaponId, distance: number, triggerDiscipline: number): number {
  const sloppiness = 1 + (1 - triggerDiscipline) * 2.5;
  const reach = isLobbed(weapon) || weapon === 'rocket' ? 0.9 : GAMEPLAY.tank.radius;
  return Math.atan2(reach * sloppiness, Math.max(distance, 0.5));
}
