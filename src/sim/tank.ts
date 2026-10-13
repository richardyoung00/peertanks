import RAPIER from '@dimforge/rapier2d-compat';
import { TANK } from '../config';
import { rotateTowards, wrapAngle } from './angles';
import type { MapPoint } from './game-map';
import { TANK_COLLISION_GROUPS } from './physics';
import type { PlayerInput } from './player-input';

export interface Tank {
  id: string;
  name: string;
  color: number;
  body: RAPIER.RigidBody;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  hullAngle: number;
  prevHullAngle: number;
  aimAngle: number;
  weaponCooldown: number;
}

/** Kinematic tanks are moved directly rather than by physics; clients use them for other players' tanks. */
export type TankBodyKind = 'dynamic' | 'kinematic';

export function createTank(
  world: RAPIER.World,
  id: string,
  name: string,
  color: number,
  spawn: MapPoint,
  kind: TankBodyKind = 'dynamic',
): Tank {
  const bodyDesc = kind === 'dynamic' ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.kinematicPositionBased();
  const body = world.createRigidBody(bodyDesc.setTranslation(spawn.x, spawn.y).lockRotations().setLinearDamping(2));
  world.createCollider(
    RAPIER.ColliderDesc.ball(TANK.radius).setCollisionGroups(TANK_COLLISION_GROUPS).setFriction(0),
    body,
  );

  return {
    id,
    name,
    color,
    body,
    x: spawn.x,
    y: spawn.y,
    prevX: spawn.x,
    prevY: spawn.y,
    hullAngle: 0,
    prevHullAngle: 0,
    aimAngle: 0,
    weaponCooldown: 0,
  };
}

export function rememberPreviousPose(tank: Tank): void {
  tank.prevX = tank.x;
  tank.prevY = tank.y;
  tank.prevHullAngle = tank.hullAngle;
}

/** Accelerates the tank towards the requested screen-relative direction and turns the hull to match. */
export function driveTank(tank: Tank, input: PlayerInput, dt: number): void {
  const length = Math.hypot(input.moveX, input.moveY);
  const directionX = length > 0 ? input.moveX / length : 0;
  const directionY = length > 0 ? input.moveY / length : 0;

  const velocity = tank.body.linvel();
  const changeX = directionX * TANK.maxSpeed - velocity.x;
  const changeY = directionY * TANK.maxSpeed - velocity.y;
  const changeLength = Math.hypot(changeX, changeY);
  const maxChange = TANK.acceleration * dt;
  const scale = changeLength > maxChange ? maxChange / changeLength : 1;
  tank.body.setLinvel({ x: velocity.x + changeX * scale, y: velocity.y + changeY * scale }, true);

  if (length > 0) turnHull(tank, Math.atan2(directionY, directionX), dt);
}

/** Tanks can drive either way, so the hull turns to whichever end is closest to the travel direction. */
function turnHull(tank: Tank, travelAngle: number, dt: number): void {
  const reversing = Math.abs(wrapAngle(travelAngle - tank.hullAngle)) > Math.PI / 2;
  const target = reversing ? travelAngle + Math.PI : travelAngle;
  tank.hullAngle = wrapAngle(rotateTowards(tank.hullAngle, target, TANK.hullTurnRate * dt));
}

export function syncTankPosition(tank: Tank): void {
  const position = tank.body.translation();
  tank.x = position.x;
  tank.y = position.y;
}

export function teleportTank(tank: Tank, point: MapPoint): void {
  tank.body.setTranslation(point, true);
  tank.body.setLinvel({ x: 0, y: 0 }, true);
  tank.x = tank.prevX = point.x;
  tank.y = tank.prevY = point.y;
  tank.prevHullAngle = tank.hullAngle;
}
