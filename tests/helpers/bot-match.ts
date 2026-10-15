import type { BotLevel } from '../../src/bots/bot-level';
import { BotSquad } from '../../src/bots/bot-squad';
import type { PlayerInfo } from '../../src/net/messages';
import type { GameEvent } from '../../src/sim/game-events';
import type { GameMap } from '../../src/sim/game-map';
import { defaultSettings, type GameSettings } from '../../src/sim/game-settings';
import { GameWorld } from '../../src/sim/game-world';
import type { PlayerInput } from '../../src/sim/player-input';
import { ARENA, ticks } from './sim-world';

export interface BotMatch {
  world: GameWorld;
  squad: BotSquad;
  events: GameEvent[];
  /** Every input each bot sent, for checking what they press. */
  inputs: Map<string, PlayerInput[]>;
  run(seconds: number, extraInputs?: () => Map<string, PlayerInput>): void;
}

/** A world full of bots, run headless. Ids are `bot-<index>`; extra human tanks can be added on `world`. */
export function setupBotMatch(
  levels: BotLevel[],
  map: GameMap = ARENA,
  settings: GameSettings = defaultSettings(),
  random: () => number = Math.random,
): BotMatch {
  const world = new GameWorld(map, settings);
  const players: PlayerInfo[] = levels.map((level, index) => ({ id: `bot-${index}`, netId: index, name: `bot-${index}`, color: index, bot: level }));
  for (const player of players) world.addTank(player.id, player.name, player.color);
  const squad = new BotSquad(map, random);
  squad.sync(players);

  const events: GameEvent[] = [];
  const inputs = new Map<string, PlayerInput[]>();
  const run = (seconds: number, extraInputs?: () => Map<string, PlayerInput>) => {
    for (let tick = 0; tick < ticks(seconds); tick++) {
      const tickInputs = squad.inputs(world);
      for (const [id, input] of tickInputs) {
        if (!inputs.has(id)) inputs.set(id, []);
        inputs.get(id)?.push(input);
      }
      for (const [id, input] of extraInputs?.() ?? []) tickInputs.set(id, input);
      const stepEvents = world.step(tickInputs);
      squad.observe(stepEvents, world);
      events.push(...stepEvents);
    }
  };
  return { world, squad, events, inputs, run };
}
