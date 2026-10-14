import { GAMEPLAY } from '../gameplay-config';

export type RoundPhase = 'playing' | 'results';
export type RoundChange = 'ended' | 'started' | null;

/** Counts down the round, then the results screen, then starts the next round. */
export class RoundClock {
  phase: RoundPhase = 'playing';
  timeLeft: number = GAMEPLAY.round.lengthSeconds;

  get isPlaying(): boolean {
    return this.phase === 'playing';
  }

  step(dt: number): RoundChange {
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft > 0) return null;

    if (this.phase === 'playing') {
      this.phase = 'results';
      this.timeLeft = GAMEPLAY.round.resultsSeconds;
      return 'ended';
    }
    this.phase = 'playing';
    this.timeLeft = GAMEPLAY.round.lengthSeconds;
    return 'started';
  }
}
