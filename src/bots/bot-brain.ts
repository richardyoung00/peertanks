import { SIM_DT } from '../config';
import { GAMEPLAY } from '../gameplay-config';
import type { GameEvent } from '../sim/game-events';
import type { WeaponId } from '../sim/items';
import { IDLE_INPUT, type PlayerInput } from '../sim/player-input';
import type { Tank } from '../sim/tank';
import { BotGunner, type GunnerContext } from './bot-gunner';
import { BotMovement, speedShare } from './bot-movement';
import type { BotWorld } from './bot-world';
import { dodgeDirection } from './dodge';
import type { NavGrid } from './nav-grid';
import { Perception, type KnownEnemy } from './perception';
import { roll, type BotPersonality } from './personality';
import { choosePlan, type Plan } from './planner';
import { chooseTarget } from './target-choice';

const config = GAMEPLAY.bots;
/** After retreating, a bot fights on for at least this long before it will run again. */
const RETREAT_COOLDOWN_SECONDS = 6;
/** Further than a tank can drive in one tick: it was moved to a spawn point, e.g. when a new round starts. */
const TELEPORT_DISTANCE = 1.5;

/** What a bot can ask about the other bots, so they don't all pile onto one player. */
export interface SquadView {
  isBot(id: string): boolean;
  /** How many bots other than `exceptId` are going after this enemy. */
  attackersOf(enemyId: string, exceptId: string): number;
}

/**
 * One bot's mind. It looks around, rethinks its plan several times a second, and each tick turns the
 * plan into the same input a human player would send: keys to drive, an aim angle and the fire button.
 */
export class BotBrain {
  plan: Plan = { kind: 'wander' };
  private readonly perception: Perception;
  private readonly movement: BotMovement;
  private readonly gunner: BotGunner;
  private target: KnownEnemy | null = null;
  private nextThinkAt = 0;
  private pausedUntil = 0;
  private retreatUntil = 0;
  private recentAttacker: { id: string; at: number } | null = null;
  private pendingWeapon: WeaponId | null = null;
  private wasAlive = false;
  private lastPosition = { x: 0, y: 0 };

  constructor(
    readonly id: string,
    readonly personality: BotPersonality,
    grid: NavGrid,
    private readonly random: () => number = Math.random,
  ) {
    this.perception = new Perception(personality, random);
    this.movement = new BotMovement(grid, personality, random);
    this.gunner = new BotGunner(personality, random);
  }

  /** The enemy this bot is currently going after, if any. */
  get targetId(): string | null {
    return this.plan.kind === 'fight' || this.plan.kind === 'chase' ? this.plan.targetId : null;
  }

  /** Forgets everything, e.g. after dying or on a new map. */
  reset(): void {
    this.plan = { kind: 'wander' };
    this.target = null;
    this.recentAttacker = null;
    this.retreatUntil = 0;
    this.pendingWeapon = null;
    this.perception.forgetAll();
    this.movement.reset();
    this.gunner.reset();
  }

  /** Learns from what just happened: mostly, who shot at it. */
  observe(events: GameEvent[], world: BotWorld, squad: SquadView): void {
    const now = world.tick * SIM_DT;
    for (const event of events) {
      if (event.type !== 'tankDamaged' || event.tankId !== this.id || event.attackerId === this.id) continue;
      this.recentAttacker = { id: event.attackerId, at: now };
      const attacker = world.tanks.get(event.attackerId);
      if (attacker) this.perception.revealAttacker(attacker, now, squad.isBot(attacker.id));
    }
  }

  input(world: BotWorld, self: Tank, squad: SquadView): PlayerInput {
    if (!self.alive) {
      if (this.wasAlive) this.reset();
      this.wasAlive = false;
      return { ...IDLE_INPUT, aimAngle: self.aimAngle };
    }
    this.wasAlive = true;
    if (Math.hypot(self.x - this.lastPosition.x, self.y - this.lastPosition.y) > TELEPORT_DISTANCE) this.reset();
    this.lastPosition = { x: self.x, y: self.y };

    const now = world.tick * SIM_DT;
    this.perception.update(world, self, now, (id) => squad.isBot(id));
    if (this.target) this.target = this.perception.enemy(this.target.id) ?? null;
    if (now >= this.nextThinkAt) {
      this.think(world, self, squad, now);
      this.nextThinkAt = now + config.thinkSeconds + config.thinkJitterSeconds * this.random();
    }
    if (!world.round.isPlaying) return { ...IDLE_INPUT, aimAngle: self.aimAngle };
    return this.act(world, self, now);
  }

  private think(world: BotWorld, self: Tank, squad: SquadView, now: number): void {
    if (this.random() < this.personality.hesitationsPerSecond * config.thinkSeconds) {
      this.pausedUntil = now + roll(config.hesitationSeconds, this.random);
    }
    if (this.recentAttacker && now - this.recentAttacker.at > config.memorySeconds) this.recentAttacker = null;

    this.target = chooseTarget(this.perception.enemies, {
      position: self,
      personality: this.personality,
      currentTargetId: this.targetId,
      recentAttackerId: this.recentAttacker?.id ?? null,
      attackersOf: (enemyId) => squad.attackersOf(enemyId, this.id),
    });
    this.updatePlan(world, self, now);

    this.pendingWeapon = this.gunner.think(this.gunnerContext(world, self, now), config.thinkSeconds);
    this.movement.follow(this.plan, {
      position: self,
      now,
      target: this.target,
      canHitTarget: this.gunner.canHitTarget,
      physics: world.physics,
      spots: world.pickups.spots,
    }, config.thinkSeconds);

    const dodge = dodgeDirection(self, this.perception.shotsToDodge(world, now), this.personality, this.random);
    if (dodge) this.movement.startDodge(dodge, now);
  }

  private updatePlan(world: BotWorld, self: Tank, now: number): void {
    const retreating = now < this.retreatUntil;
    const plan = choosePlan({
      position: self,
      healthShare: self.health / GAMEPLAY.tank.maxHealth,
      loadout: self.loadout,
      personality: this.personality,
      perception: this.perception,
      spots: world.pickups.spots,
      target: this.target,
      current: this.plan,
      retreating,
      retreatOnCooldown: now < this.retreatUntil + RETREAT_COOLDOWN_SECONDS,
      random: this.random,
    });
    if (plan.kind === 'retreat' && !retreating) this.retreatUntil = now + roll(config.retreatSeconds, this.random);
    this.plan = plan;
  }

  private act(world: BotWorld, self: Tank, now: number): PlayerInput {
    const paused = now < this.pausedUntil;
    const keys = paused ? { x: 0, y: 0 } : this.movement.keys(self, now, SIM_DT);
    const shot = this.gunner.aim(this.gunnerContext(world, self, now, keys), SIM_DT);
    const selectWeapon = this.pendingWeapon;
    this.pendingWeapon = null;
    return {
      moveX: keys.x,
      moveY: keys.y,
      aimAngle: shot.aimAngle,
      aimDistance: shot.aimDistance,
      firing: shot.firing && !paused,
      selectWeapon,
    };
  }

  private gunnerContext(world: BotWorld, self: Tank, now: number, keys?: { x: number; y: number }): GunnerContext {
    const moving = keys && (keys.x !== 0 || keys.y !== 0);
    return {
      position: self,
      loadout: self.loadout,
      physics: world.physics,
      target: this.target,
      travelDirection: moving ? keys : null,
      ownSpeedShare: speedShare(self.body.linvel()),
      now,
    };
  }
}
