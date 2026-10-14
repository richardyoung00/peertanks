import { GAMEPLAY } from '../../gameplay-config';
import type { Tank } from '../tank';
import type { WorldContext } from '../world-context';
import { announceShot, damageMultiplier } from './launch';

const config = GAMEPLAY.weapons.mortar;
const LAUNCH_HEIGHT = 0.45;

/** Lobs a shell over everything to the aim point, clamped to the mortar's range. */
export function fireMortar(context: WorldContext, tank: Tank, aimDistance: number): void {
  const range = Math.min(Math.max(aimDistance, config.minRange), config.maxRange);
  const { width, height } = context.map;
  const targetX = clamp(tank.x + Math.cos(tank.aimAngle) * range, 0.5, width - 0.5);
  const targetY = clamp(tank.y + Math.sin(tank.aimAngle) * range, 0.5, height - 0.5);

  announceShot(context, tank, 'mortar', tank.aimAngle);
  context.emit({ type: 'mortarFired', targetX, targetY, flightSeconds: config.flightSeconds });
  context.spawnProjectile({
    kind: 'mortar',
    ownerId: tank.id,
    weapon: 'mortar',
    x: tank.x,
    y: tank.y,
    prevX: tank.x,
    prevY: tank.y,
    vx: (targetX - tank.x) / config.flightSeconds,
    vy: (targetY - tank.y) / config.flightSeconds,
    height: LAUNCH_HEIGHT,
    age: 0,
    lifetime: config.flightSeconds,
    damage: 0,
    bouncesLeft: 0,
    canHitOwner: true,
    damageMultiplier: damageMultiplier(tank),
    mortar: { startX: tank.x, startY: tank.y, targetX, targetY, flightSeconds: config.flightSeconds },
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
