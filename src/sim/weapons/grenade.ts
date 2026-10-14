import { GAMEPLAY } from '../../gameplay-config';
import type { Tank } from '../tank';
import type { WorldContext } from '../world-context';
import { announceShot, launchProjectile, type LaunchOptions } from './launch';

const config = GAMEPLAY.weapons.grenade;

/** Charge is the seconds the fire button was held: longer throws go further and higher. */
export function throwGrenade(context: WorldContext, tank: Tank, chargeSeconds: number): void {
  announceShot(context, tank, 'grenade', tank.aimAngle);
  const launched = launchProjectile(context, tank, throwOptions(tank.aimAngle, chargeSeconds));
  // Pressed against a wall: drop it behind you instead.
  if (!launched) launchProjectile(context, tank, throwOptions(tank.aimAngle + Math.PI, 0));
}

function throwOptions(angle: number, chargeSeconds: number): LaunchOptions {
  const charge = Math.min(chargeSeconds / config.maxChargeSeconds, 1);
  const between = (min: number, max: number) => min + (max - min) * charge;
  return {
    kind: 'grenade',
    weapon: 'grenade',
    angle,
    speed: between(config.minThrowSpeed, config.maxThrowSpeed),
    lifetime: config.fuseSeconds,
    grenade: {
      airSeconds: between(config.minAirSeconds, config.maxAirSeconds),
      apexHeight: between(config.minArcHeight, config.maxArcHeight),
      landed: false,
    },
  };
}
