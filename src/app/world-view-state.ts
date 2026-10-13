import * as THREE from 'three';
import type { ViewState } from '../render/view-state';
import { lerpAngle } from '../sim/angles';
import type { GameWorld } from '../sim/game-world';

const { lerp } = THREE.MathUtils;

/** The host draws straight from its own simulation, blending between the last two ticks. */
export function viewStateFromWorld(world: GameWorld, alpha: number, localTankId: string): ViewState {
  const tanks = [...world.tanks.values()].map((tank) => ({
    id: tank.id,
    color: tank.color,
    x: lerp(tank.prevX, tank.x, alpha),
    y: lerp(tank.prevY, tank.y, alpha),
    hullAngle: lerpAngle(tank.prevHullAngle, tank.hullAngle, alpha),
    aimAngle: tank.aimAngle,
  }));

  const projectiles = world.projectiles.map((projectile) => ({
    id: projectile.id,
    x: lerp(projectile.prevX, projectile.x, alpha),
    y: lerp(projectile.prevY, projectile.y, alpha),
    angle: Math.atan2(projectile.vy, projectile.vx),
  }));

  const localTank = tanks.find((tank) => tank.id === localTankId);
  return { tanks, projectiles, cameraFocus: localTank ? { x: localTank.x, y: localTank.y } : null };
}
