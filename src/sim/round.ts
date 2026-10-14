import { GAMEPLAY } from '../gameplay-config';

export type RoundPhase = 'playing' | 'results';
export type RoundChange = 'ended' | 'started' | null;

/** Counts down the round, then the results screen, then starts the next round. */
export class RoundClock {
  phase: RoundPhase = 'playing';
  timeLeft: number;

  /** The length of the next round to start; the current round keeps its length. */
  constructor(public roundSeconds: number) {
    this.timeLeft = roundSeconds;
  }

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
    this.restart();
    return 'started';
  }

  /** Starts a fresh round at the current round length. */
  restart(): void {
    this.phase = 'playing';
    this.timeLeft = this.roundSeconds;
  }
}
