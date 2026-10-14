import type { BuildInfo } from '../build-info';
import type { GameEvent } from '../sim/game-events';
import type { GameMap } from '../sim/game-map';
import type { GameSettings } from '../sim/game-settings';
import type { PlayerScore } from '../sim/scores';
import type { RejectionCode } from './version-check';

// JSON messages sent over the reliable PeerJS channel.

/** The host's player id; joining players get their PeerJS id instead. */
export const HOST_PLAYER_ID = 'host';

export interface PlayerInfo {
  id: string;
  /** Small number used in binary snapshots instead of the string id. */
  netId: number;
  name: string;
  color: number;
}

export interface JoinMetadata {
  name: string;
  /** Missing from builds made before version checks existed. */
  build?: BuildInfo;
}

export type HostMessage =
  | { type: 'welcome'; playerId: string; map: GameMap; players: PlayerInfo[]; scores: PlayerScore[] }
  | { type: 'rejected'; reason: string; code?: RejectionCode }
  /** Sent while the host is still setting up, and again whenever the players or settings change. */
  | { type: 'lobby'; playerId: string; players: PlayerInfo[]; settings: GameSettings }
  | { type: 'kicked' }
  | { type: 'gameEnded' }
  | { type: 'playerJoined'; player: PlayerInfo }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'events'; tick: number; events: GameEvent[] }
  | { type: 'scores'; scores: PlayerScore[] }
  | { type: 'pong'; sentAt: number };

export type ClientMessage = { type: 'ping'; sentAt: number };

function hasMessageType(value: unknown): value is { type: string } {
  return typeof value === 'object' && value !== null && typeof (value as { type: unknown }).type === 'string';
}

export function isHostMessage(value: unknown): value is HostMessage {
  return hasMessageType(value);
}

export function isClientMessage(value: unknown): value is ClientMessage {
  return hasMessageType(value);
}
