import type { ProjectileKind } from '../../sim/projectiles';
import type { ProjectileViewState } from '../view-state';
import type { ParticlePools, ParticleSpawn } from './particles';

/** Grenades only leave a trail while they're up in the air, not while rolling. */
const GRENADE_AIRBORNE_HEIGHT = 0.2;

interface TrailPuff {
  /** Seconds between puffs. */
  every: number;
  pool: keyof ParticlePools;
  /** How far behind the projectile's centre the puff appears. */
  behind: number;
  puff: Omit<ParticleSpawn, 'x' | 'y' | 'z'>;
}

const TRAILS: Partial<Record<ProjectileKind, TrailPuff[]>> = {
  rocket: [
    { every: 0.022, pool: 'smoke', behind: 0.22, puff: { life: 0.55, startSize: 0.07, endSize: 0.2, vy: 0.25, drag: 2, color: 0xcfcfcf } },
    { every: 0.03, pool: 'glow', behind: 0.2, puff: { life: 0.12, startSize: 0.08, endSize: 0.03, color: 0xffb347 } },
  ],
  mortar: [{ every: 0.05, pool: 'smoke', behind: 0, puff: { life: 0.45, startSize: 0.05, endSize: 0.13, color: 0xbdbdbd } }],
  grenade: [{ every: 0.06, pool: 'smoke', behind: 0, puff: { life: 0.35, startSize: 0.04, endSize: 0.1, color: 0xd6d6d6 } }],
  bouncy: [{ every: 0.03, pool: 'glow', behind: 0, puff: { life: 0.25, startSize: 0.06, endSize: 0.02, color: 0x4ade80 } }],
};

/** Leaves puffs of smoke or sparkle behind rockets, mortars, thrown grenades and bouncy shots. */
export class ProjectileTrails {
  /** Seconds until each projectile's next puff, per trail. */
  private readonly timers = new Map<number, number[]>();

  constructor(private readonly pools: ParticlePools) {}

  update(projectiles: ProjectileViewState[], dt: number): void {
    const present = new Set<number>();
    for (const projectile of projectiles) {
      present.add(projectile.id);
      const trails = TRAILS[projectile.kind];
      const rolling = projectile.kind === 'grenade' && projectile.height < GRENADE_AIRBORNE_HEIGHT;
      if (!trails || rolling) continue;
      this.emit(projectile, trails, dt);
    }
    for (const id of this.timers.keys()) {
      if (!present.has(id)) this.timers.delete(id);
    }
  }

  private emit(projectile: ProjectileViewState, trails: TrailPuff[], dt: number): void {
    const timers = this.timers.get(projectile.id) ?? trails.map(() => 0);
    trails.forEach((trail, index) => {
      timers[index] -= dt;
      if (timers[index] > 0) return;
      timers[index] += trail.every;
      this.pools[trail.pool].spawn({
        ...trail.puff,
        x: projectile.x - Math.cos(projectile.angle) * trail.behind,
        y: projectile.height,
        z: projectile.y - Math.sin(projectile.angle) * trail.behind,
      });
    });
    this.timers.set(projectile.id, timers);
  }
}
