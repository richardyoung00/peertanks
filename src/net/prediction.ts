import type RAPIER from '@dimforge/rapier2d-compat';
import { NETWORK, SIM_DT } from '../config';
import { GAMEPLAY } from '../gameplay-config';
import { lerpAngle } from '../sim/angles';
import type { GameMap, MapPoint } from '../sim/game-map';
import { createPhysicsWorld } from '../sim/physics';
import type { PlayerInput } from '../sim/player-input';
import { createTank, driveTank, rememberPreviousPose, syncTankPosition, type Tank } from '../sim/tank';
import type { PlayerInfo } from './messages';
import type { InputFrame, TankSnapshot } from './packets';

// A correction bigger than this is a teleport (e.g. respawn), so jump rather than glide.
const SNAP_DISTANCE = 2;
const CORRECTION_DECAY_RATE = 10;
const MAX_HISTORY = 120;

export interface PredictedPose {
  x: number;
  y: number;
  hullAngle: number;
  aimAngle: number;
}

/**
 * Moves the local player's tank immediately on their own machine, then quietly corrects it when the host's
 * authoritative position arrives by replaying the inputs the host has not processed yet.
 */
export class LocalPrediction {
  readonly tank: Tank;
  private readonly physics: RAPIER.World;
  private readonly otherTanks = new Map<number, Tank>();
  private history: InputFrame[] = [];
  private nextSeq = 1;
  private correctionX = 0;
  private correctionY = 0;
  private fireCooldown = 0;
  private alive = true;

  constructor(map: GameMap, player: PlayerInfo, start: MapPoint) {
    this.physics = createPhysicsWorld(map);
    this.tank = createTank(this.physics, player.id, player.name, player.color, start);
  }

  /** Applies a local input straight away. Returns the frame to send and whether a shot was (probably) fired. */
  step(input: PlayerInput): { frame: InputFrame; fired: boolean } {
    rememberPreviousPose(this.tank);
    if (this.alive) this.simulate(input);

    const frame = { seq: this.nextSeq++, input };
    this.history.push(frame);
    if (this.history.length > MAX_HISTORY) this.history.shift();
    return { frame, fired: this.alive && this.predictFire(input) };
  }

  /** The latest few frames; sending them again covers packets that get lost on the way. */
  recentFrames(): InputFrame[] {
    return this.history.slice(-NETWORK.inputRedundancy);
  }

  /** Re-bases on the host's state. Returns true when the tank jumped rather than being smoothly corrected. */
  reconcile(state: TankSnapshot, ackSeq: number): boolean {
    this.history = this.history.filter((frame) => frame.seq > ackSeq);
    const justRespawned = state.alive && !this.alive;
    this.alive = state.alive;
    if (!state.alive) {
      this.placeAt(state);
      return false;
    }

    const predictedX = this.tank.x;
    const predictedY = this.tank.y;
    const stepX = this.tank.x - this.tank.prevX;
    const stepY = this.tank.y - this.tank.prevY;

    this.placeAt(state);
    // Inputs made while dead were ignored by the host, so don't replay them onto the fresh tank.
    if (!justRespawned) for (const frame of this.history) this.simulate(frame.input);

    const errorX = predictedX - this.tank.x;
    const errorY = predictedY - this.tank.y;
    if (justRespawned || Math.hypot(errorX, errorY) > SNAP_DISTANCE) {
      this.correctionX = this.correctionY = 0;
      this.tank.prevX = this.tank.x;
      this.tank.prevY = this.tank.y;
      return true;
    }

    // Keep what's on screen exactly where it was, then let the difference fade out over a few frames.
    this.correctionX += errorX;
    this.correctionY += errorY;
    this.tank.prevX = this.tank.x - stepX;
    this.tank.prevY = this.tank.y - stepY;
    return false;
  }

  /** Other players' living tanks, so our own tank bumps into them locally. */
  placeOtherTanks(tanks: TankSnapshot[], ownNetId: number): void {
    const present = new Set<number>();
    for (const state of tanks) {
      if (state.netId === ownNetId || !state.alive) continue;
      present.add(state.netId);
      const other = this.otherTanks.get(state.netId) ?? this.createOtherTank(state);
      other.body.setNextKinematicTranslation({ x: state.x, y: state.y });
    }
    for (const [netId, other] of this.otherTanks) {
      if (present.has(netId)) continue;
      this.physics.removeRigidBody(other.body);
      this.otherTanks.delete(netId);
    }
  }

  pose(alpha: number): PredictedPose {
    return {
      x: this.tank.prevX + (this.tank.x - this.tank.prevX) * alpha + this.correctionX,
      y: this.tank.prevY + (this.tank.y - this.tank.prevY) * alpha + this.correctionY,
      hullAngle: lerpAngle(this.tank.prevHullAngle, this.tank.hullAngle, alpha),
      aimAngle: this.tank.aimAngle,
    };
  }

  decayCorrection(dt: number): void {
    const remaining = Math.exp(-CORRECTION_DECAY_RATE * dt);
    this.correctionX *= remaining;
    this.correctionY *= remaining;
  }

  private placeAt(state: TankSnapshot): void {
    this.tank.body.setTranslation({ x: state.x, y: state.y }, true);
    this.tank.body.setLinvel({ x: state.vx, y: state.vy }, true);
    this.tank.hullAngle = state.hullAngle;
    syncTankPosition(this.tank);
  }

  private simulate(input: PlayerInput): void {
    driveTank(this.tank, input, SIM_DT);
    this.tank.aimAngle = input.aimAngle;
    this.physics.step();
    syncTankPosition(this.tank);
  }

  private predictFire(input: PlayerInput): boolean {
    this.fireCooldown = Math.max(0, this.fireCooldown - SIM_DT);
    if (!input.firing || this.fireCooldown > 0) return false;
    this.fireCooldown = GAMEPLAY.weapons.cannon.cooldownSeconds;
    return true;
  }

  private createOtherTank(state: TankSnapshot): Tank {
    const other = createTank(this.physics, `net-${state.netId}`, '', 0, state, 'kinematic');
    this.otherTanks.set(state.netId, other);
    return other;
  }
}
