import { GAMEPLAY } from '../gameplay-config';
import type { MapPoint } from '../sim/game-map';
import type { ItemId } from '../sim/items';
import type { Projectile } from '../sim/projectiles';
import type { Tank } from '../sim/tank';
import type { BotWorld } from './bot-world';
import type { BotPersonality } from './personality';

const config = GAMEPLAY.bots;

export interface KnownEnemy {
  id: string;
  /** Where it was when last seen, and how it was moving. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  invulnerable: boolean;
  shielded: boolean;
  /** On screen right now, rather than remembered. */
  visible: boolean;
  lastSeenAt: number;
  isBot: boolean;
}

/** What a bot believes is at a pickup spot: an item, nothing, or "don't know". */
export type SpotBelief = ItemId | null | 'unknown';

interface Sighting {
  firstSeenAt: number;
  noticed: boolean;
  enemy: KnownEnemy;
}

interface ShotSighting {
  firstSeenAt: number;
  /** Rolled once per shot, so a bot doesn't get a fresh chance to dodge on every tick. */
  willDodge: boolean;
}

/**
 * What one bot knows. Like a player, it sees roughly one screen around itself, needs its reaction time
 * to notice something new, and remembers enemies for a while after they go out of view.
 */
export class Perception {
  private readonly sightings = new Map<string, Sighting>();
  private readonly shots = new Map<number, ShotSighting>();
  private spotBeliefs: { belief: SpotBelief; seenAt: number }[] = [];

  constructor(
    private readonly personality: BotPersonality,
    private readonly random: () => number,
  ) {}

  /** Enemies the bot has noticed, on screen or remembered. */
  get enemies(): KnownEnemy[] {
    return [...this.sightings.values()].filter((sighting) => sighting.noticed).map((sighting) => sighting.enemy);
  }

  enemy(id: string): KnownEnemy | undefined {
    const sighting = this.sightings.get(id);
    return sighting?.noticed ? sighting.enemy : undefined;
  }

  update(world: BotWorld, self: Tank, now: number, isBot: (id: string) => boolean): void {
    this.updateEnemies(world, self, now, isBot);
    this.updateShots(world, self, now);
    this.updateSpots(world, self, now);
  }

  /** Being hit gives away roughly where the attacker is, even off screen. */
  revealAttacker(attacker: Tank, now: number, isBot: boolean): void {
    if (!attacker.alive) return;
    const sighting = this.sightings.get(attacker.id);
    const enemy = describe(attacker, sighting?.enemy.visible ?? false, now, isBot);
    this.sightings.set(attacker.id, { firstSeenAt: sighting?.firstSeenAt ?? now, noticed: true, enemy });
  }

  /** Shots on screen that the bot has had time to react to, and will try to dodge. */
  shotsToDodge(world: BotWorld, now: number): Projectile[] {
    return world.projectiles.filter((projectile) => {
      const shot = this.shots.get(projectile.id);
      return shot?.willDodge && now - shot.firstSeenAt >= this.personality.reactionSeconds;
    });
  }

  spotBelief(index: number): SpotBelief {
    const memory = this.spotBeliefs[index];
    return memory ? memory.belief : 'unknown';
  }

  forgetAll(): void {
    this.sightings.clear();
    this.shots.clear();
    this.spotBeliefs = [];
  }

  isInView(self: MapPoint, point: MapPoint): boolean {
    return Math.abs(point.x - self.x) <= config.viewHalfWidth && Math.abs(point.y - self.y) <= config.viewHalfHeight;
  }

  private updateEnemies(world: BotWorld, self: Tank, now: number, isBot: (id: string) => boolean): void {
    for (const tank of world.tanks.values()) {
      if (tank === self) continue;
      if (!tank.alive) {
        this.sightings.delete(tank.id);
        continue;
      }
      if (this.isInView(self, tank)) this.see(tank, now, isBot(tank.id));
      else this.lose(tank.id);
    }
    for (const [id, sighting] of this.sightings) {
      const forgotten = now - sighting.enemy.lastSeenAt > config.memorySeconds;
      if (!world.tanks.has(id) || forgotten) this.sightings.delete(id);
    }
  }

  private see(tank: Tank, now: number, isBot: boolean): void {
    const sighting = this.sightings.get(tank.id) ?? { firstSeenAt: now, noticed: false, enemy: describe(tank, true, now, isBot) };
    sighting.enemy = describe(tank, true, now, isBot);
    sighting.noticed ||= now - sighting.firstSeenAt >= this.personality.reactionSeconds;
    this.sightings.set(tank.id, sighting);
  }

  /** Out of view: remembered if it had been noticed, otherwise it never registered. */
  private lose(id: string): void {
    const sighting = this.sightings.get(id);
    if (!sighting) return;
    if (!sighting.noticed) this.sightings.delete(id);
    else sighting.enemy.visible = false;
  }

  private updateShots(world: BotWorld, self: Tank, now: number): void {
    const inView = new Set<number>();
    for (const projectile of world.projectiles) {
      const dangerous = projectile.ownerId !== self.id || projectile.canHitOwner;
      if (!dangerous || projectile.kind === 'mortar' || !this.isInView(self, projectile)) continue;
      inView.add(projectile.id);
      if (!this.shots.has(projectile.id)) {
        this.shots.set(projectile.id, { firstSeenAt: now, willDodge: this.random() < this.personality.dodgeSkill });
      }
    }
    for (const id of this.shots.keys()) {
      if (!inView.has(id)) this.shots.delete(id);
    }
  }

  private updateSpots(world: BotWorld, self: Tank, now: number): void {
    world.pickups.spots.forEach((spot, index) => {
      if (this.isInView(self, spot)) {
        this.spotBeliefs[index] = { belief: spot.item, seenAt: now };
        return;
      }
      // An empty spot seen a while ago may well have filled again.
      const memory = this.spotBeliefs[index];
      if (memory?.belief === null && now - memory.seenAt > spot.respawnSeconds) memory.belief = 'unknown';
    });
  }
}

function describe(tank: Tank, visible: boolean, now: number, isBot: boolean): KnownEnemy {
  const velocity = tank.body.linvel();
  return {
    id: tank.id,
    x: tank.x,
    y: tank.y,
    vx: velocity.x,
    vy: velocity.y,
    health: tank.health,
    invulnerable: tank.invulnerableTimer > 0,
    shielded: tank.loadout.powerups.shield > 0,
    visible,
    lastSeenAt: now,
    isBot,
  };
}
