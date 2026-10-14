import type * as THREE from 'three';
import { GAMEPLAY } from '../gameplay-config';
import type { Point2D } from '../render/game-view';
import type { Loadout } from '../sim/loadout';

interface Aim {
  x: number;
  y: number;
  aimAngle: number;
}

/**
 * Where the local player's mortar would land, clamped to its range, for the on-ground target marker.
 * Grenades deliberately get no hint: judging the throw is part of the skill.
 */
export function landingTarget(tank: Aim, loadout: Loadout, aimPoint: THREE.Vector3 | null): Point2D | null {
  if (loadout.selected !== 'mortar' || !aimPoint) return null;
  const { minRange, maxRange } = GAMEPLAY.weapons.mortar;
  const aimDistance = Math.hypot(aimPoint.x - tank.x, aimPoint.z - tank.y);
  const distance = Math.min(Math.max(aimDistance, minRange), maxRange);
  return { x: tank.x + Math.cos(tank.aimAngle) * distance, y: tank.y + Math.sin(tank.aimAngle) * distance };
}
