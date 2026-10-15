import type { DeathCause } from '../../sim/game-events';
import type { Effect } from './effect';
import type { ParticlePools } from './particles';
import { createDestroyedWreck } from './wreck-destroyed';
import { createHazardWreck } from './wreck-hazard';
import type { HazardFall, WreckSource } from './wreck-model';

/** Picks the death animation: tipping into water, lava or a pit, or blowing apart. */
export function createWreck(source: WreckSource, cause: DeathCause, pools: ParticlePools, fall: HazardFall | null): Effect {
  if ((cause === 'water' || cause === 'lava' || cause === 'pit') && fall) return createHazardWreck(source, cause, pools, fall);
  return createDestroyedWreck(source, pools);
}
