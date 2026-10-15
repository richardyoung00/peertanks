import type RAPIER from '@dimforge/rapier2d-compat';
import { NETWORK, SIM_DT } from '../config';
import { lerpAngle } from '../sim/angles';
import type { Point } from '../sim/game-events';
import type { GameMap, MapPoint } from '../sim/game-map';
import type { WeaponId } from '../sim/items';
import { selectWeapon } from '../sim/loadout';
import { createPhysicsWorld } from '../sim/physics';
import type { PlayerInput } from '../sim/player-input';
import { createTank, driveTank, rememberPreviousPose, syncTankPosition, type Tank } from '../sim/tank';
import { FirePrediction } from './fire-prediction';
import type { PlayerInfo } from './messages';
import type { InputFrame, OwnStatus, TankSnapshot } from './packets';
import { PredictedShots } from './predicted-shots';

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
export interface PredictedStep {
  frame: InputFrame;
  /** The weapon that (probably) fired. */
  fired: WeaponId | null;
  /** Where our predicted shots hit walls this tick. */
  impacts: Point[];
}

export class LocalPrediction {
  readonly tank: Tank;
  readonly shots: PredictedShots;
  private readonly physics: RAPIER.World;
  private readonly otherTanks = new Map<number, Tank>();
  private history: InputFrame[] = [];
  private nextSeq = 1;
  private correctionX = 0;
  private correctionY = 0;
  private readonly firePrediction = new FirePrediction();
  private alive = true;

  /**
   * `firstSeq` continues the input numbering from the previous map; the host only accepts inputs numbered
   * higher than ones it has already applied.
   */
  constructor(map: GameMap, player: PlayerInfo, start: MapPoint, firstSeq = 1) {
    this.nextSeq = firstSeq;
    this.physics = createPhysicsWorld(map);
    this.tank = createTank(this.physics, player.id, player.name, player.color, start);
    this.shots = new PredictedShots(this.physics);
  }

  get upcomingSeq(): number {
    return this.nextSeq;
  }

  dispose(): void {
    this.physics.free();
  }

  /** Applies a local input straight away, and fires our predicted shots. */
  step(input: PlayerInput): PredictedStep {
    rememberPreviousPose(this.tank);
    if (input.selectWeapon) selectWeapon(this.tank.loadout, input.selectWeapon);
    if (this.alive) this.simulate(input);

    const frame = { seq: this.nextSeq++, input };
    this.history.push(frame);
    if (this.history.length > MAX_HISTORY) this.history.shift();
    const fired = this.alive ? this.firePrediction.predict(this.tank.loadout, input) : null;
    const impacts = this.shots.step();
    if (fired) {
      // Shots leave the barrel as drawn, which includes any correction still being smoothed out.
      const blocked = this.shots.fire(fired, this.pose(1), this.tank.aimAngle);
      if (blocked) impacts.push(blocked);
    }
    return { frame, fired, impacts };
  }

  /** The latest few frames; sending them again covers packets that get lost on the way. */
  recentFrames(): InputFrame[] {
    return this.history.slice(-NETWORK.inputRedundancy);
  }

  /** Re-bases on the host's state. Returns true when the tank jumped rather than being smoothly corrected. */
  reconcile(state: TankSnapshot, own: OwnStatus, ackSeq: number): boolean {
    this.history = this.history.filter((frame) => frame.seq > ackSeq);
    this.syncLoadout(state, own);
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

  /** Takes what the host says we carry, then re-applies weapon switches it hasn't seen yet. */
  private syncLoadout(state: TankSnapshot, own: OwnStatus): void {
    const loadout = this.tank.loadout;
    loadout.ammo = { ...own.ammo };
    loadout.powerups = { ...own.powerups };
    if (loadout.selected !== state.weapon) loadout.grenadeCharge = 0;
    loadout.selected = state.weapon;
    for (const frame of this.history) {
      if (frame.input.selectWeapon) selectWeapon(loadout, frame.input.selectWeapon);
    }
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

  private createOtherTank(state: TankSnapshot): Tank {
    const other = createTank(this.physics, `net-${state.netId}`, '', 0, state, 'kinematic');
    this.otherTanks.set(state.netId, other);
    return other;
  }
}
