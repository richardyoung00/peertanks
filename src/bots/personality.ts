import { GAMEPLAY, type Range } from '../gameplay-config';
import type { BotLevel } from './bot-level';

export type Archetype = keyof typeof GAMEPLAY.bots.archetypes;

const ARCHETYPES = Object.keys(GAMEPLAY.bots.archetypes) as Archetype[];

/** One bot's character: skill comes from its level, play style from its archetype, both with random variation. */
export interface BotPersonality {
  level: BotLevel;
  archetype: Archetype;

  reactionSeconds: number;
  aimErrorDegrees: number;
  aimSettleSeconds: number;
  aimDamping: number;
  leadSkill: number;
  dodgeSkill: number;
  hazardAwareness: number;
  triggerDiscipline: number;
  hesitationsPerSecond: number;
  respectsGangUpLimit: boolean;

  aggression: number;
  caution: number;
  pickupGreed: number;
  vengefulness: number;
  /** The archetype's keenness, capped by what the level allows. */
  trickShots: number;
  preferredRange: number;
}

export function rollPersonality(level: BotLevel, random = Math.random): BotPersonality {
  const skill = GAMEPLAY.bots.levels[level];
  const archetype = ARCHETYPES[Math.floor(random() * ARCHETYPES.length)];
  const style = GAMEPLAY.bots.archetypes[archetype];
  const pick = (range: Range) => roll(range, random);

  return {
    level,
    archetype,
    reactionSeconds: pick(skill.reactionSeconds),
    aimErrorDegrees: pick(skill.aimErrorDegrees),
    aimSettleSeconds: pick(skill.aimSettleSeconds),
    aimDamping: pick(skill.aimDamping),
    leadSkill: pick(skill.leadSkill),
    dodgeSkill: pick(skill.dodgeSkill),
    hazardAwareness: pick(skill.hazardAwareness),
    triggerDiscipline: pick(skill.triggerDiscipline),
    hesitationsPerSecond: pick(skill.hesitationsPerSecond),
    respectsGangUpLimit: skill.respectsGangUpLimit,
    aggression: pick(style.aggression),
    caution: pick(style.caution),
    pickupGreed: pick(style.pickupGreed),
    vengefulness: pick(style.vengefulness),
    trickShots: pick(style.trickShots) * skill.trickShotLimit,
    preferredRange: pick(style.preferredRange),
  };
}

/** A random number within a range. */
export function roll(range: Range, random: () => number): number {
  return range[0] + (range[1] - range[0]) * random();
}
