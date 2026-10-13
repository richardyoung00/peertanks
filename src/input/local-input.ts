import type { PlayerInput } from '../sim/player-input';
import type { Tank } from '../sim/tank';
import type { Keyboard } from './keyboard';
import type { Mouse } from './mouse';

export interface GroundPoint {
  x: number;
  z: number;
}

/** Turns the local keyboard and mouse state into the same input format remote players will send. */
export function readLocalInput(keyboard: Keyboard, mouse: Mouse, aimPoint: GroundPoint | null, tank: Tank): PlayerInput {
  const move = keyboard.moveDirection();
  const aimX = aimPoint ? aimPoint.x - tank.x : Math.cos(tank.aimAngle);
  const aimY = aimPoint ? aimPoint.z - tank.y : Math.sin(tank.aimAngle);
  return {
    moveX: move.x,
    moveY: move.y,
    aimAngle: Math.atan2(aimY, aimX),
    aimDistance: Math.hypot(aimX, aimY),
    firing: mouse.buttonDown,
  };
}
