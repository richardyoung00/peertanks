// Frozen copies of the original maps, so the tests don't change when the game's maps are redesigned.
import arenaJson from '../fixtures/meadow-with-lava.json';
import crossroadsJson from '../fixtures/crossroads.json';
import type { GameEvent } from '../../src/sim/game-events';
import type { GameMap } from '../../src/sim/game-map';
import { defaultSettings, type GameSettings } from '../../src/sim/game-settings';
import { GameWorld } from '../../src/sim/game-world';
import { parseTiledMap } from '../../src/sim/map-loader';
import { IDLE_INPUT, type PlayerInput } from '../../src/sim/player-input';
import { teleportTank, type Tank } from '../../src/sim/tank';

type TiledJson = Parameters<typeof parseTiledMap>[0];

export const ARENA: GameMap = parseTiledMap(arenaJson as TiledJson);
export const CROSSROADS: GameMap = parseTiledMap(crossroadsJson as TiledJson);

/** Whole simulation ticks covering this many seconds. */
export function ticks(seconds: number): number {
  return Math.ceil(seconds * 60);
}

/** No pickups unless a test asks for them, so stray items don't change the outcome. */
export function settingsWithoutPickups(): GameSettings {
  return { ...defaultSettings(), allowedItems: [] };
}

export interface TestWorld {
  world: GameWorld;
  tanks: Record<string, Tank>;
  /** Every event since the world was set up. */
  events: GameEvent[];
  /** Steps the world, giving each named tank its input (missing fields are idle). */
  run(inputs: Record<string, Partial<PlayerInput>>, tickCount?: number): void;
}

/** A world with tanks placed at the given positions, spawn protection off and physics already stepped once. */
export function setupWorld(
  positions: Record<string, [number, number]>,
  map: GameMap = ARENA,
  settings: GameSettings = settingsWithoutPickups(),
): TestWorld {
  const world = new GameWorld(map, settings);
  const tanks: Record<string, Tank> = {};
  for (const [id, [x, y]] of Object.entries(positions)) {
    tanks[id] = world.addTank(id, id, 1);
    teleportTank(tanks[id], { x, y });
    tanks[id].invulnerableTimer = 0;
  }
  // Rapier's ray casts only see colliders once the world has stepped.
  world.step(new Map());

  const events: GameEvent[] = [];
  const run = (inputs: Record<string, Partial<PlayerInput>>, tickCount = 1) => {
    const full = new Map(Object.entries(inputs).map(([id, input]) => [id, { ...IDLE_INPUT, ...input }]));
    for (let i = 0; i < tickCount; i++) events.push(...world.step(full));
  };
  return { world, tanks, events, run };
}

export function findEvent<T extends GameEvent['type']>(
  events: GameEvent[],
  type: T,
  matches: (event: Extract<GameEvent, { type: T }>) => boolean = () => true,
): Extract<GameEvent, { type: T }> | undefined {
  return events.find((event): event is Extract<GameEvent, { type: T }> => event.type === type && matches(event as Extract<GameEvent, { type: T }>));
}
