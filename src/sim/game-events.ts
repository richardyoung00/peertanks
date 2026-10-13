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

export interface TankRespawnedEvent {
  type: 'tankRespawned';
  tankId: string;
}

export type GameEvent = ShotFiredEvent | ShellHitEvent | TankRespawnedEvent;
