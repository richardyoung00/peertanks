import type { PlayerInfo } from '../net/messages';
import type { GameEvent } from '../sim/game-events';
import type { GameMap } from '../sim/game-map';
import type { PlayerInput } from '../sim/player-input';
import { BotBrain, type SquadView } from './bot-brain';
import type { BotWorld } from './bot-world';
import { NavGrid } from './nav-grid';
import { rollPersonality } from './personality';

/** All the bots in a game, run by the host. Each one turns what it can see into a player input every tick. */
export class BotSquad implements SquadView {
  private readonly brains = new Map<string, BotBrain>();
  private grid: NavGrid;

  constructor(
    map: GameMap,
    private readonly random: () => number = Math.random,
  ) {
    this.grid = new NavGrid(map);
  }

  /** Matches the bots to the roster: new bots get a brain (and a fresh personality), removed ones lose theirs. */
  sync(players: PlayerInfo[]): void {
    const botIds = new Set<string>();
    for (const player of players) {
      if (!player.bot) continue;
      botIds.add(player.id);
      if (!this.brains.has(player.id)) {
        this.brains.set(player.id, new BotBrain(player.id, rollPersonality(player.bot, this.random), this.grid, this.random));
      }
    }
    for (const id of this.brains.keys()) {
      if (!botIds.has(id)) this.brains.delete(id);
    }
  }

  /** On a new map every bot keeps its personality but starts its knowledge over. */
  changeMap(map: GameMap): void {
    this.grid = new NavGrid(map);
    for (const [id, brain] of this.brains) this.brains.set(id, new BotBrain(id, brain.personality, this.grid, this.random));
  }

  inputs(world: BotWorld): Map<string, PlayerInput> {
    const inputs = new Map<string, PlayerInput>();
    for (const [id, brain] of this.brains) {
      const tank = world.tanks.get(id);
      if (tank) inputs.set(id, brain.input(world, tank, this));
    }
    return inputs;
  }

  observe(events: GameEvent[], world: BotWorld): void {
    if (events.length === 0) return;
    for (const brain of this.brains.values()) brain.observe(events, world, this);
  }

  isBot(id: string): boolean {
    return this.brains.has(id);
  }

  attackersOf(enemyId: string, exceptId: string): number {
    let count = 0;
    for (const brain of this.brains.values()) {
      if (brain.id !== exceptId && brain.targetId === enemyId) count++;
    }
    return count;
  }
}
