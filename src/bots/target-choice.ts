import { GAMEPLAY } from '../gameplay-config';
import type { MapPoint } from '../sim/game-map';
import type { KnownEnemy } from './perception';
import type { BotPersonality } from './personality';

const SCORE_FADE_DISTANCE = 16;
const STICK_TO_TARGET = 0.25;
const GANG_UP_PENALTY = 0.3;

export interface TargetContext {
  position: MapPoint;
  personality: BotPersonality;
  currentTargetId: string | null;
  /** Whoever hit this bot most recently, if it still remembers. */
  recentAttackerId: string | null;
  /** How many other bots are already going after this enemy. */
  attackersOf(enemyId: string): number;
}

/** The enemy most worth going after, weighing distance, weakness, revenge and fair play. */
export function chooseTarget(enemies: KnownEnemy[], context: TargetContext): KnownEnemy | null {
  let best: KnownEnemy | null = null;
  let bestScore = 0;
  for (const enemy of enemies) {
    const score = targetScore(enemy, context);
    if (score > bestScore) {
      best = enemy;
      bestScore = score;
    }
  }
  return best;
}

function targetScore(enemy: KnownEnemy, context: TargetContext): number {
  const { personality } = context;
  const distance = Math.hypot(enemy.x - context.position.x, enemy.y - context.position.y);
  let score = Math.max(0.1, 1 - distance / SCORE_FADE_DISTANCE);
  score *= enemy.visible ? 1 : 0.5;
  score += (1 - enemy.health / GAMEPLAY.tank.maxHealth) * 0.3;
  if (enemy.id === context.recentAttackerId) score += personality.vengefulness * 0.6;
  if (enemy.id === context.currentTargetId) score += STICK_TO_TARGET;
  if (enemy.invulnerable) score *= 0.5;

  const crowded = context.attackersOf(enemy.id) >= GAMEPLAY.bots.gangUpLimit;
  if (personality.respectsGangUpLimit && !enemy.isBot && crowded) score *= GANG_UP_PENALTY;
  return score;
}
