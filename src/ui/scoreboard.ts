import type { PlayerScore } from '../sim/scores';
import { element } from './dom';
import { cssColor, type PlayerLookup } from './player-lookup';

const STREAK_TO_SHOW = 2;

/** The always-visible score list under the ping bar. Only redraws when something changes. */
export class ScoreboardPanel {
  private readonly container = element('scoreboard');
  private lastDrawn = '';

  constructor(
    private readonly players: PlayerLookup,
    private readonly localId: string,
  ) {}

  update(scores: PlayerScore[]): void {
    const names = scores.map((score) => this.players.name(score.playerId));
    const key = JSON.stringify([scores, names]);
    if (key === this.lastDrawn) return;
    this.lastDrawn = key;

    this.container.replaceChildren(headerRow(), ...scores.map((score) => this.scoreRow(score)));
  }

  private scoreRow(score: PlayerScore): HTMLElement {
    const row = document.createElement('div');
    row.className = score.playerId === this.localId ? 'score-row local' : 'score-row';

    const name = document.createElement('span');
    name.className = 'score-name';
    const dot = document.createElement('span');
    dot.className = 'score-dot';
    dot.style.background = cssColor(this.players.color(score.playerId));
    name.append(dot, this.players.name(score.playerId));

    const streak = score.streak >= STREAK_TO_SHOW ? `🔥${score.streak}` : '';
    row.append(name, cell(score.kills), cell(score.deaths), cell(killDeathRatio(score)), cell(streak, 'score-streak'));
    return row;
  }
}

export function killDeathRatio(score: PlayerScore): string {
  if (score.deaths === 0) return score.kills.toFixed(1);
  return (score.kills / score.deaths).toFixed(1);
}

function headerRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'score-row header';
  row.append(cell(''), cell('K'), cell('D'), cell('K/D'), cell(''));
  return row;
}

function cell(content: string | number, className?: string): HTMLElement {
  const span = document.createElement('span');
  if (className) span.className = className;
  span.textContent = String(content);
  return span;
}
