import type { GameEvent } from '../sim/game-events';
import type { GameMap } from '../sim/game-map';

// JSON messages sent over the reliable PeerJS channel.

export interface PlayerInfo {
  id: string;
  /** Small number used in binary snapshots instead of the string id. */
  netId: number;
  name: string;
  color: number;
}

export interface JoinMetadata {
  name: string;
}

export type HostMessage =
  | { type: 'welcome'; playerId: string; map: GameMap; players: PlayerInfo[] }
  | { type: 'rejected'; reason: string }
  | { type: 'playerJoined'; player: PlayerInfo }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'events'; tick: number; events: GameEvent[] }
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
