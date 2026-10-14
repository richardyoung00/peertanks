import * as THREE from 'three';
import type { ViewState } from '../render/view-state';
import { lerpAngle } from '../sim/angles';
import type { GameWorld } from '../sim/game-world';

const { lerp } = THREE.MathUtils;

/** The host draws straight from its own simulation, blending between the last two ticks. */
export function viewStateFromWorld(world: GameWorld, alpha: number, localTankId: string): ViewState {
  const tanks = [...world.tanks.values()].map((tank) => ({
    id: tank.id,
    name: tank.name,
    color: tank.color,
    x: lerp(tank.prevX, tank.x, alpha),
    y: lerp(tank.prevY, tank.y, alpha),
    hullAngle: lerpAngle(tank.prevHullAngle, tank.hullAngle, alpha),
    aimAngle: tank.aimAngle,
    health: tank.health,
    alive: tank.alive,
    invulnerable: tank.invulnerableTimer > 0,
  }));

  const projectiles = world.projectiles.map((projectile) => ({
    id: projectile.id,
    x: lerp(projectile.prevX, projectile.x, alpha),
    y: lerp(projectile.prevY, projectile.y, alpha),
    angle: Math.atan2(projectile.vy, projectile.vx),
  }));

  // While dead, the camera holds still until the tank respawns.
  const localTank = tanks.find((tank) => tank.id === localTankId);
  const cameraFocus = localTank?.alive ? { x: localTank.x, y: localTank.y } : null;
  return { tanks, projectiles, cameraFocus };
}
