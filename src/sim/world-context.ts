import type RAPIER from '@dimforge/rapier2d-compat';
import type { CombatContext } from './combat';
import type { Projectile } from './projectiles';
import type { Tank } from './tank';

/** What weapons, projectiles and explosions are allowed to do to the world. */
export interface WorldContext extends CombatContext {
  physics: RAPIER.World;
  spawnProjectile(projectile: Omit<Projectile, 'id'>): void;
  tankByCollider(collider: RAPIER.Collider): Tank | undefined;
}
