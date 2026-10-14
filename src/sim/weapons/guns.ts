import { GAMEPLAY } from '../../gameplay-config';
import type { Tank } from '../tank';
import type { WorldContext } from '../world-context';
import { announceShot, barrelObstruction, damageMultiplier, launchProjectile } from './launch';

const DEGREES = Math.PI / 180;

export function fireCannon(context: WorldContext, tank: Tank): void {
  const config = GAMEPLAY.weapons.cannon;
  fireStraight(context, tank, tank.aimAngle, () =>
    launchProjectile(context, tank, {
      kind: 'shell',
      weapon: 'cannon',
      angle: tank.aimAngle,
      speed: config.speed,
      lifetime: config.lifetimeSeconds,
      damage: config.damage,
    }),
  );
}

export function fireMachineGun(context: WorldContext, tank: Tank): void {
  const config = GAMEPLAY.weapons['machine-gun'];
  const angle = tank.aimAngle + (Math.random() - 0.5) * config.spreadDegrees * DEGREES;
  fireStraight(context, tank, angle, () =>
    launchProjectile(context, tank, {
      kind: 'bullet',
      weapon: 'machine-gun',
      angle,
      speed: config.speed,
      lifetime: config.lifetimeSeconds,
      damage: config.damage,
    }),
  );
}

export function fireBouncyCannon(context: WorldContext, tank: Tank): void {
  const config = GAMEPLAY.weapons['bouncy-cannon'];
  fireStraight(context, tank, tank.aimAngle, () =>
    launchProjectile(context, tank, {
      kind: 'bouncy',
      weapon: 'bouncy-cannon',
      angle: tank.aimAngle,
      speed: config.speed,
      lifetime: config.lifetimeSeconds,
      damage: config.damage,
      bounces: config.bounces,
    }),
  );
}

export function fireRocket(context: WorldContext, tank: Tank): void {
  const config = GAMEPLAY.weapons.rocket;
  announceShot(context, tank, 'rocket', tank.aimAngle);
  const launched = launchProjectile(context, tank, {
    kind: 'rocket',
    weapon: 'rocket',
    angle: tank.aimAngle,
    speed: config.speed,
    lifetime: config.lifetimeSeconds,
  });
  // Firing a rocket into a wall you're touching blows up in your face.
  const blocked = launched ? null : barrelObstruction(context, tank, tank.aimAngle);
  if (blocked) context.explode(blocked.x, blocked.y, config.explosion, tank.id, 'rocket', damageMultiplier(tank));
}

/** Fires, or bursts on the wall if the barrel is pressed against one. */
function fireStraight(context: WorldContext, tank: Tank, angle: number, launch: () => boolean): void {
  const weapon = tank.loadout.selected;
  announceShot(context, tank, weapon, angle);
  if (launch()) return;
  const blocked = barrelObstruction(context, tank, angle);
  if (blocked) context.emit({ type: 'shellHit', x: blocked.x, y: blocked.y });
}
