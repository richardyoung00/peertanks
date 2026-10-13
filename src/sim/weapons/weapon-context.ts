import type RAPIER from '@dimforge/rapier2d-compat';
import type { GameEvent } from '../game-events';
import type { Projectile } from '../projectiles';

/** What a weapon is allowed to do to the world when it fires. */
export interface WeaponContext {
  physics: RAPIER.World;
  spawnProjectile(projectile: Omit<Projectile, 'id'>): void;
  emit(event: GameEvent): void;
}
