import type RAPIER from '@dimforge/rapier2d-compat';
import { GAMEPLAY } from '../gameplay-config';
import type { MapPoint } from '../sim/game-map';
import type { PickupSpot } from '../sim/pickups';
import { findCover } from './cover';
import { KeyboardSteering, type KeyDirection } from './keyboard-steering';
import type { NavGrid } from './nav-grid';
import { distance, PathFollower } from './path-follower';
import type { KnownEnemy } from './perception';
import type { BotPersonality } from './personality';
import type { Plan } from './planner';

/** Re-plan a route once the place it leads to has moved this far. */
const ROUTE_DRIFT = 1.5;
/** Fighting range is kept within this much of the bot's preferred distance. */
const RANGE_SLACK = 1.5;
const STRAFE_SWITCH_SECONDS: readonly [number, number] = [0.6, 1.6];
const DODGE_SECONDS = 0.35;
const STUCK_CHECK_SECONDS = 1;
const STUCK_DISTANCE = 0.3;
const UNSTICK_SECONDS = 0.5;
const WANDER_MIN_DISTANCE = 5;
/** Careless bots now and then stop watching where they drive, for about this long. */
const INATTENTIVE_SECONDS = 1;
const INATTENTION_PER_SECOND = 0.05;
/** While not paying attention, a bot only notices a hazard when it's almost on it. */
const INATTENTIVE_LOOK_AHEAD = 0.1;

type Intent = { kind: 'route' } | { kind: 'direction'; direction: MapPoint } | { kind: 'stop' };

export interface MovementContext {
  position: MapPoint;
  now: number;
  target: KnownEnemy | null;
  /** The bot has a weapon that can hit the target from where it is. */
  canHitTarget: boolean;
  physics: RAPIER.World;
  spots: readonly PickupSpot[];
}

/** Turns the bot's plan into keys to press: following routes, circling an enemy, backing off or hiding. */
export class BotMovement {
  private readonly follower: PathFollower;
  private readonly steering: KeyboardSteering;
  private intent: Intent = { kind: 'stop' };
  private strafeSide: 1 | -1 = 1;
  private nextStrafeSwitchAt = 0;
  private coverPoint: MapPoint | null = null;
  private wanderGoal: MapPoint | null = null;
  private dodge: { direction: MapPoint; until: number } | null = null;
  private unstick: { direction: MapPoint; until: number } | null = null;
  private progress = { at: 0, x: 0, y: 0 };
  private inattentiveUntil = 0;

  constructor(
    private readonly grid: NavGrid,
    private readonly personality: BotPersonality,
    private readonly random: () => number,
  ) {
    this.follower = new PathFollower(grid);
    this.steering = new KeyboardSteering(grid);
  }

  reset(): void {
    this.follower.clear();
    this.intent = { kind: 'stop' };
    this.coverPoint = null;
    this.wanderGoal = null;
    this.dodge = null;
    this.unstick = null;
  }

  startDodge(direction: MapPoint, now: number): void {
    this.dodge = { direction, until: now + DODGE_SECONDS };
  }

  /** Called whenever the bot rethinks: works out what kind of movement the plan needs. */
  follow(plan: Plan, context: MovementContext, thinkSeconds: number): void {
    const carelessness = 1 - this.personality.hazardAwareness;
    if (this.random() < INATTENTION_PER_SECOND * carelessness * thinkSeconds) this.inattentiveUntil = context.now + INATTENTIVE_SECONDS;
    if (plan.kind !== 'retreat') this.coverPoint = null;
    if (plan.kind !== 'wander') this.wanderGoal = null;

    switch (plan.kind) {
      case 'fight':
        return this.fight(context);
      case 'chase':
        return context.target ? this.routeTo(context.target, context) : this.stop();
      case 'collect':
        return this.routeTo(context.spots[plan.spotIndex], context);
      case 'retreat':
        return this.retreat(context);
      case 'wander':
        return this.wander(context);
    }
  }

  /** Called every tick: the keys to hold right now. */
  keys(position: MapPoint, now: number, dt: number): KeyDirection {
    const attentive = now >= this.inattentiveUntil;
    const lookAhead = attentive ? 0.6 + 0.6 * this.personality.hazardAwareness : INATTENTIVE_LOOK_AHEAD;
    if (this.dodge && now < this.dodge.until) return this.steering.steer(this.dodge.direction, position, dt, lookAhead, true);
    this.watchForBeingStuck(position, now);
    if (this.unstick && now < this.unstick.until) return this.steering.steer(this.unstick.direction, position, dt, lookAhead, true);
    return this.steering.steer(this.wantedDirection(position), position, dt, lookAhead);
  }

  private wantedDirection(position: MapPoint): MapPoint | null {
    if (this.intent.kind === 'direction') return this.intent.direction;
    if (this.intent.kind === 'route') return this.follower.direction(position);
    return null;
  }

  private fight(context: MovementContext): void {
    const target = context.target;
    if (!target) return this.stop();
    const range = distance(context.position, target);
    const preferred = this.personality.preferredRange;
    if (!context.canHitTarget || range > preferred + RANGE_SLACK) return this.routeTo(target, context);

    const awayX = (context.position.x - target.x) / (range || 1);
    const awayY = (context.position.y - target.y) / (range || 1);
    if (range < preferred - RANGE_SLACK) return this.driveIn({ x: awayX, y: awayY });
    this.strafe(awayX, awayY, context.now);
  }

  /** Circles the target, switching sides every so often to be harder to hit. */
  private strafe(awayX: number, awayY: number, now: number): void {
    if (now >= this.nextStrafeSwitchAt) {
      this.strafeSide = this.random() < 0.5 ? 1 : -1;
      this.nextStrafeSwitchAt = now + STRAFE_SWITCH_SECONDS[0] + (STRAFE_SWITCH_SECONDS[1] - STRAFE_SWITCH_SECONDS[0]) * this.random();
    }
    this.driveIn({ x: -awayY * this.strafeSide, y: awayX * this.strafeSide });
  }

  private retreat(context: MovementContext): void {
    const threat = context.target;
    if (!this.coverPoint && threat) this.coverPoint = findCover(this.grid, context.physics, context.position, threat, this.random);
    if (!this.coverPoint || distance(context.position, this.coverPoint) < 0.5) return this.stop();
    this.routeTo(this.coverPoint, context);
  }

  /** Roams between pickup spots and random places, so bots don't patrol the same loop. */
  private wander(context: MovementContext): void {
    const reached = this.wanderGoal && distance(context.position, this.wanderGoal) < 1;
    if (!this.wanderGoal || reached) this.wanderGoal = this.pickWanderGoal(context);
    if (this.wanderGoal) this.routeTo(this.wanderGoal, context);
    else this.stop();
  }

  private pickWanderGoal(context: MovementContext): MapPoint | null {
    for (let attempt = 0; attempt < 10; attempt++) {
      const useSpot = context.spots.length > 0 && this.random() < 0.5;
      const goal = useSpot ? context.spots[Math.floor(this.random() * context.spots.length)] : this.grid.randomOpenTile(this.random);
      if (goal && distance(goal, context.position) >= WANDER_MIN_DISTANCE) return { x: goal.x, y: goal.y };
    }
    return null;
  }

  private routeTo(destination: MapPoint, context: MovementContext): void {
    const current = this.follower.destination;
    const needsRoute = !current || distance(current, destination) > ROUTE_DRIFT || !this.follower.hasRoute;
    if (needsRoute && !this.follower.goTo(context.position, destination, this.personality.hazardAwareness)) return this.stop();
    this.intent = { kind: 'route' };
  }

  private driveIn(direction: MapPoint): void {
    this.follower.clear();
    this.intent = { kind: 'direction', direction };
  }

  private stop(): void {
    this.follower.clear();
    this.intent = { kind: 'stop' };
  }

  /** If the bot has been trying to move but hasn't got anywhere for a while, it jiggles free and replans. */
  private watchForBeingStuck(position: MapPoint, now: number): void {
    if (this.intent.kind === 'stop') {
      this.progress = { at: now, x: position.x, y: position.y };
      return;
    }
    if (now - this.progress.at < STUCK_CHECK_SECONDS) return;
    const moved = distance(position, this.progress);
    this.progress = { at: now, x: position.x, y: position.y };
    if (moved >= STUCK_DISTANCE) return;

    const angle = this.random() * Math.PI * 2;
    this.unstick = { direction: { x: Math.cos(angle), y: Math.sin(angle) }, until: now + UNSTICK_SECONDS };
    this.strafeSide = this.strafeSide === 1 ? -1 : 1;
    this.follower.clear();
  }
}

/** How fast a tank is moving, as a share of its top speed (0–1). */
export function speedShare(velocity: MapPoint): number {
  return Math.min(Math.hypot(velocity.x, velocity.y) / GAMEPLAY.tank.maxSpeed, 1);
}
