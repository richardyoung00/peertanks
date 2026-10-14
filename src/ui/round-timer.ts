import type { RoundPhase } from '../sim/round';
import { element } from './dom';

const ENDING_SOON_SECONDS = 30;

export function updateRoundTimer(phase: RoundPhase, timeLeft: number): void {
  const timer = element('round-timer');
  const playing = phase === 'playing';
  timer.textContent = playing ? formatTime(timeLeft) : 'Round over';
  timer.classList.toggle('ending', playing && timeLeft <= ENDING_SOON_SECONDS);
}

export function formatTime(seconds: number): string {
  const whole = Math.ceil(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}
