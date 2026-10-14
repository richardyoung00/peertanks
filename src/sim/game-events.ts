import type { PlayerScore } from './scores';

export type HazardType = 'water' | 'lava' | 'pit';
export type DeathCause = 'cannon' | HazardType;

export interface ShotFiredEvent {
  type: 'shotFired';
  tankId: string;
  x: number;
  y: number;
  angle: number;
}

export interface ShellHitEvent {
  type: 'shellHit';
  x: number;
  y: number;
  tankId?: string;
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
  | RoundEndedEvent
  | RoundStartedEvent;
