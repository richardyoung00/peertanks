import type { WeaponId } from './items';

export interface PlayerInput {
  /** Desired movement direction in screen/map space, each axis in the range -1..1. */
  moveX: number;
  moveY: number;
  aimAngle: number;
  /** Distance from the tank to the aim point; the mortar fires at this distance. */
  aimDistance: number;
  firing: boolean;
  /**
   * Set only on the tick the player asked to switch weapon. Sending the request rather than the current
   * choice means the host's own switches (new pickup, out of ammo) aren't undone by stale client input.
   */
  selectWeapon: WeaponId | null;
}

export const IDLE_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  aimAngle: 0,
  aimDistance: 0,
  firing: false,
  selectWeapon: null,
};
