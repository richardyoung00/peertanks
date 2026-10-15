import type RAPIER from '@dimforge/rapier2d-compat';
import type { GameMap } from '../sim/game-map';
import type { PickupSpot } from '../sim/pickups';
import type { Projectile } from '../sim/projectiles';
import type { Tank } from '../sim/tank';

/** The parts of the game world a bot reads. Everything about other tanks goes through its perception first. */
export interface BotWorld {
  readonly map: GameMap;
  readonly physics: RAPIER.World;
  readonly tanks: ReadonlyMap<string, Tank>;
  readonly projectiles: readonly Projectile[];
  readonly pickups: { readonly spots: readonly PickupSpot[] };
  readonly round: { readonly isPlaying: boolean };
  readonly tick: number;
}
