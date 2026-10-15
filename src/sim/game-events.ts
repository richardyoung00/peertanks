import type { ItemId, WeaponId } from './items';
import type { PlayerScore } from './scores';

export type HazardType = 'water' | 'lava' | 'pit';
export type DeathCause = WeaponId | 'dead-mans-switch' | HazardType;

export interface Point {
  x: number;
  y: number;
}

export interface ShotFiredEvent {
  type: 'shotFired';
  tankId: string;
  weapon: WeaponId;
  x: number;
  y: number;
  angle: number;
}

export interface ShellHitEvent {
  type: 'shellHit';
  x: number;
  y: number;
  /** The tank it hit; missing when it hit a wall. */
  tankId?: string;
  /** Who fired it, so they can skip the effects they already showed themselves. */
  ownerId: string;
}

export interface TankDamagedEvent {
  type: 'tankDamaged';
  tankId: string;
  attackerId: string;
  amount: number;
  health: number;
}

export interface TankKilledEvent {
  type: 'tankKilled';
  tankId: string;
  /** Missing when nobody gets the credit, e.g. driving into lava unprovoked. */
  killerId?: string;
  cause: DeathCause;
  /** Killed by their own explosion or ricochet. */
  selfInflicted?: boolean;
  x: number;
  y: number;
}

export interface ExplosionEvent {
  type: 'explosion';
  x: number;
  y: number;
  radius: number;
}

export interface LaserFiredEvent {
  type: 'laserFired';
  tankId: string;
  /** The beam's path: muzzle, each reflection, and where it stopped. */
  points: Point[];
}

/** Not drawn (players get no danger-zone warning); kept for the incoming-shell sound in the audio milestone. */
export interface MortarFiredEvent {
  type: 'mortarFired';
  targetX: number;
  targetY: number;
  flightSeconds: number;
}

export interface PickupCollectedEvent {
  type: 'pickupCollected';
  tankId: string;
  item: ItemId;
  x: number;
  y: number;
}

export interface TankRespawnedEvent {
  type: 'tankRespawned';
  tankId: string;
}

export interface RoundEndedEvent {
  type: 'roundEnded';
  standings: PlayerScore[];
}

export interface RoundStartedEvent {
  type: 'roundStarted';
}

export type GameEvent =
  | ShotFiredEvent
  | ShellHitEvent
  | TankDamagedEvent
  | TankKilledEvent
  | TankRespawnedEvent
  | ExplosionEvent
  | LaserFiredEvent
  | MortarFiredEvent
  | PickupCollectedEvent
  | RoundEndedEvent
  | RoundStartedEvent;
