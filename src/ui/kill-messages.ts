import type { HazardType, TankKilledEvent } from '../sim/game-events';

// {killer} and {victim} are swapped for coloured player names when shown.
const SHOT_LINES = ['{killer} blasted {victim}', '{killer} shelled {victim}', '{killer} popped {victim}'];

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

export function killMessageTemplate(event: TankKilledEvent): string {
  if (event.cause === 'cannon') return pickRandom(SHOT_LINES);
  return pickRandom(event.killerId ? PUSHED_INTO_HAZARD[event.cause] : FELL_INTO_HAZARD[event.cause]);
}

function pickRandom(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}
