import { NETWORK, PLAYER_COLORS } from '../config';
import type { PlayerInfo } from './messages';

const MAX_NAME_LENGTH = 16;

/** The host's list of players, handing out unique net ids and colours. */
export class Roster {
  private readonly players = new Map<string, PlayerInfo>();

  get all(): PlayerInfo[] {
    return [...this.players.values()];
  }

  get isFull(): boolean {
    return this.players.size >= NETWORK.maxPlayers;
  }

  add(id: string, name: string): PlayerInfo {
    const player = { id, name: cleanName(name), netId: this.freeNetId(), color: this.freeColor() };
    this.players.set(id, player);
    return player;
  }

  remove(id: string): void {
    this.players.delete(id);
  }

  netIdOf(id: string): number | undefined {
    return this.players.get(id)?.netId;
  }

  private freeNetId(): number {
    const used = new Set(this.all.map((player) => player.netId));
    let netId = 0;
    while (used.has(netId)) netId++;
    return netId;
  }

  private freeColor(): number {
    const used = new Set(this.all.map((player) => player.color));
    return PLAYER_COLORS.find((color) => !used.has(color)) ?? PLAYER_COLORS[0];
  }
}

export function cleanName(name: unknown): string {
  const text = typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LENGTH) : '';
  return text || 'Tank';
}
