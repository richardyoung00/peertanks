import type { DeathCause, HazardType, TankKilledEvent } from '../sim/game-events';

// {killer} and {victim} are swapped for coloured player names when shown.
const KILL_LINES: Record<Exclude<DeathCause, HazardType>, string[]> = {
  cannon: ['{killer} blasted {victim}', '{killer} shelled {victim}', '{killer} popped {victim}'],
  'machine-gun': ['{killer} riddled {victim}', '{killer} sprayed down {victim}'],
  'bouncy-cannon': ['{killer} bounced one off {victim}', '{killer} trick-shotted {victim}'],
  laser: ['{killer} zapped {victim}', '{killer} lasered {victim}'],
  rocket: ['{killer} rocketed {victim}', '{killer} sent {victim} to the moon'],
  grenade: ['{killer} fragged {victim}', '{killer} rolled a surprise to {victim}'],
  mortar: ['{killer} dropped a mortar on {victim}', '{killer} rained on {victim}'],
  'dead-mans-switch': ["{killer}'s wreck took {victim} with it", '{killer} exploded on {victim}'],
};

const SELF_KILL_LINES = [
  '{victim} blew themselves up',
  '{victim} played with their own explosives',
  '{victim} hugged their own blast',
];

const PUSHED_INTO_HAZARD: Record<HazardType, string[]> = {
  water: ['{killer} sent {victim} for a swim', '{killer} dunked {victim}'],
  lava: ['{killer} knocked {victim} into the lava', '{killer} served {victim} flambé'],
  pit: ['{killer} pushed {victim} into the void', '{killer} showed {victim} the way down'],
};

const FELL_INTO_HAZARD: Record<HazardType, string[]> = {
  water: ['{victim} went for a swim', "{victim} forgot tanks can't float", '{victim} sank like a rock'],
  lava: ['{victim} took a lava bath', '{victim} got a little too toasty', '{victim} melted'],
  pit: ['{victim} fell into the void', '{victim} took the long way down'],
};

export function isHazard(cause: DeathCause): cause is HazardType {
  return cause === 'water' || cause === 'lava' || cause === 'pit';
}

export function killMessageTemplate(event: TankKilledEvent): string {
  if (isHazard(event.cause)) {
    return pickRandom(event.killerId ? PUSHED_INTO_HAZARD[event.cause] : FELL_INTO_HAZARD[event.cause]);
  }
  if (event.selfInflicted || !event.killerId) return pickRandom(SELF_KILL_LINES);
  return pickRandom(KILL_LINES[event.cause]);
}

function pickRandom(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}
