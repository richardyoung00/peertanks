export interface PlayerInput {
  /** Desired movement direction in screen/map space, each axis in the range -1..1. */
  moveX: number;
  moveY: number;
  aimAngle: number;
  /** Distance from the tank to the aim point, used later for throw strength. */
  aimDistance: number;
  firing: boolean;
}

export const IDLE_INPUT: PlayerInput = { moveX: 0, moveY: 0, aimAngle: 0, aimDistance: 0, firing: false };
