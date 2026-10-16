import type { RoundStatus } from '../app/game-hud';
import type { GameEvent } from '../sim/game-events';
import { roundOutcome } from '../sim/scores';
import { playAnnouncerLine } from './announcer-lines';

const FINAL_SECONDS = 30;
/** Joining this soon after a round started still counts as being there for the start. */
const FRESH_ROUND_SECONDS = 3;

/**
 * Calls out the round starting, the final seconds and the result. The start and the final seconds come from
 * the round clock (a new map starts its round without an event); the result comes from the round-end event,
 * which carries the final standings.
 */
export class Announcer {
  private lastRound: RoundStatus | null = null;

  constructor(private readonly localId: string) {}

  handleEvents(events: GameEvent[]): void {
    for (const event of events) {
      if (event.type !== 'roundEnded') continue;
      const outcome = roundOutcome(event.standings);
      const weWon = outcome.kind === 'won' && outcome.playerId === this.localId;
      playAnnouncerLine(weWon ? 'youWin' : 'roundOver');
    }
  }

  update(round: RoundStatus, roundSeconds: number): void {
    // A client's clock reads zero until its first snapshot arrives.
    if (round.timeLeft === 0 && round.phase === 'playing') return;
    const last = this.lastRound;
    this.lastRound = { ...round };
    if (round.phase !== 'playing') return;

    if (this.roundJustStarted(last, round, roundSeconds)) playAnnouncerLine('roundStart');
    else if (last && last.timeLeft > FINAL_SECONDS && round.timeLeft <= FINAL_SECONDS) playAnnouncerLine('finalSeconds');
  }

  private roundJustStarted(last: RoundStatus | null, round: RoundStatus, roundSeconds: number): boolean {
    if (last) return last.phase === 'results';
    return round.timeLeft > roundSeconds - FRESH_ROUND_SECONDS;
  }
}
