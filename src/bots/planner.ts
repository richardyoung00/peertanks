import { GAMEPLAY } from '../gameplay-config';
import type { MapPoint } from '../sim/game-map';
import type { Loadout } from '../sim/loadout';
import type { PickupSpot } from '../sim/pickups';
import type { KnownEnemy, Perception } from './perception';
import type { BotPersonality } from './personality';
import { pickupValue } from './pickup-value';

export type Plan =
  | { kind: 'fight'; targetId: string }
  | { kind: 'chase'; targetId: string }
  | { kind: 'collect'; spotIndex: number }
  | { kind: 'retreat' }
  | { kind: 'wander' };

/** Small random wobble on every score, so bots don't always make the same choice in the same spot. */
const SCORE_NOISE = 0.06;
const WANDER_SCORE = 0.15;
/** Pickups further than this along the ground lose most of their appeal. */
const PICKUP_DISTANCE_SCALE = 8;

export interface PlanContext {
  position: MapPoint;
  healthShare: number;
  loadout: Loadout;
  personality: BotPersonality;
  perception: Perception;
  spots: readonly PickupSpot[];
  /** The enemy target choice settled on, if any. */
  target: KnownEnemy | null;
  current: Plan;
  /** The bot is part way through retreating and should stay in cover. */
  retreating: boolean;
  /** It retreated recently, so it won't run again just yet. */
  retreatOnCooldown: boolean;
  random: () => number;
}

/**
 * Scores every option and picks the best, in the style of utility AI. The current plan gets a bonus,
 * so bots stick with a choice instead of flickering between two close ones.
 */
export function choosePlan(context: PlanContext): Plan {
  const wander: ScoredPlan = { plan: { kind: 'wander' }, score: WANDER_SCORE };
  const options = [...fightOptions(context), collectOption(context), retreatOption(context), wander];

  let best: Plan = { kind: 'wander' };
  let bestScore = -Infinity;
  for (const option of options) {
    if (!option) continue;
    const commitment = isSamePlan(option.plan, context.current) ? GAMEPLAY.bots.planCommitment : 0;
    const score = option.score + commitment + (context.random() * 2 - 1) * SCORE_NOISE;
    if (score > bestScore) {
      best = option.plan;
      bestScore = score;
    }
  }
  return best;
}

interface ScoredPlan {
  plan: Plan;
  score: number;
}

function fightOptions({ target, personality, healthShare }: PlanContext): ScoredPlan[] {
  if (!target) return [];
  const bravery = healthShare > personality.caution ? 1 : 0.5;
  if (target.visible) return [{ plan: { kind: 'fight', targetId: target.id }, score: (0.45 + 0.45 * personality.aggression) * bravery }];
  return [{ plan: { kind: 'chase', targetId: target.id }, score: (0.2 + 0.5 * personality.aggression) * bravery }];
}

function collectOption(context: PlanContext): ScoredPlan | null {
  const { spots, perception, loadout, healthShare, personality, position } = context;
  let best: ScoredPlan | null = null;
  for (let spotIndex = 0; spotIndex < spots.length; spotIndex++) {
    const spot = spots[spotIndex];
    const value = pickupValue(perception.spotBelief(spotIndex), loadout, healthShare);
    if (value === 0) continue;
    const distance = Math.hypot(spot.x - position.x, spot.y - position.y);
    const score = (value * (0.25 + 0.75 * personality.pickupGreed)) / (1 + distance / PICKUP_DISTANCE_SCALE);
    if (!best || score > best.score) best = { plan: { kind: 'collect', spotIndex }, score };
  }
  return best;
}

function retreatOption({ retreating, retreatOnCooldown, healthShare, personality, target }: PlanContext): ScoredPlan | null {
  if (retreating) return { plan: { kind: 'retreat' }, score: 1 };
  const threatened = target?.visible ?? false;
  if (!threatened || retreatOnCooldown || healthShare > personality.caution) return null;
  return { plan: { kind: 'retreat' }, score: 0.95 };
}

function isSamePlan(a: Plan, b: Plan): boolean {
  if (a.kind !== b.kind) return false;
  if ((a.kind === 'fight' || a.kind === 'chase') && (b.kind === 'fight' || b.kind === 'chase')) return a.targetId === b.targetId;
  if (a.kind === 'collect' && b.kind === 'collect') return a.spotIndex === b.spotIndex;
  return true;
}
