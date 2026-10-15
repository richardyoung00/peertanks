import { GAMEPLAY } from '../gameplay-config';
import type { MapPoint } from '../sim/game-map';
import type { Projectile } from '../sim/projectiles';
import type { BotPersonality } from './personality';

/** Shots passing closer than this (plus the tank's size) are worth dodging. Explosives need more room. */
const DIRECT_MARGIN = 0.3;
const EXPLOSIVE_MARGIN = GAMEPLAY.weapons.rocket.explosion.innerRadius + 0.2;
/** Bots run from a grenade within this share of its blast radius. */
const GRENADE_FLEE_SHARE = 0.9;

/**
 * Which way to move to get out of the way of the most urgent shot, or null if nothing is about to hit.
 * Less skilful bots sometimes jump the wrong way.
 */
export function dodgeDirection(position: MapPoint, shots: Projectile[], personality: BotPersonality, random: () => number): MapPoint | null {
  let urgent: { direction: MapPoint; seconds: number } | null = null;
  for (const shot of shots) {
    const escape = shot.kind === 'grenade' ? fleeGrenade(position, shot) : sidestep(position, shot, random);
    if (escape && (!urgent || escape.seconds < urgent.seconds)) urgent = escape;
  }
  if (!urgent) return null;

  const wrongWay = random() < (1 - personality.dodgeSkill) * 0.3;
  return wrongWay ? { x: -urgent.direction.x, y: -urgent.direction.y } : urgent.direction;
}

/** Steps sideways off the line of a shot that will pass too close in the next moment. */
function sidestep(position: MapPoint, shot: Projectile, random: () => number): { direction: MapPoint; seconds: number } | null {
  const offsetX = position.x - shot.x;
  const offsetY = position.y - shot.y;
  const speedSquared = shot.vx * shot.vx + shot.vy * shot.vy;
  if (speedSquared === 0) return null;

  const seconds = (offsetX * shot.vx + offsetY * shot.vy) / speedSquared;
  if (seconds < 0 || seconds > GAMEPLAY.bots.dodgeLookAheadSeconds) return null;

  const missX = offsetX - shot.vx * seconds;
  const missY = offsetY - shot.vy * seconds;
  const missDistance = Math.hypot(missX, missY);
  const margin = shot.kind === 'rocket' ? EXPLOSIVE_MARGIN : DIRECT_MARGIN;
  if (missDistance > GAMEPLAY.tank.radius + margin) return null;

  // Dead centre: either side will do.
  if (missDistance < 0.05) {
    const side = random() < 0.5 ? 1 : -1;
    const speed = Math.sqrt(speedSquared);
    return { direction: { x: (-shot.vy / speed) * side, y: (shot.vx / speed) * side }, seconds };
  }
  return { direction: { x: missX / missDistance, y: missY / missDistance }, seconds };
}

function fleeGrenade(position: MapPoint, grenade: Projectile): { direction: MapPoint; seconds: number } | null {
  const offsetX = position.x - grenade.x;
  const offsetY = position.y - grenade.y;
  const distance = Math.hypot(offsetX, offsetY);
  const blastRadius = GAMEPLAY.weapons.grenade.explosion.outerRadius * GRENADE_FLEE_SHARE;
  if (distance > blastRadius || distance === 0) return null;
  return { direction: { x: offsetX / distance, y: offsetY / distance }, seconds: grenade.lifetime - grenade.age };
}
