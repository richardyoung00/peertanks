import type { PlayerScore } from '../sim/scores';
import { element } from './dom';
import { playerNameElement, type PlayerLookup } from './player-lookup';
import { killDeathRatio } from './scoreboard';

/** The end-of-round standings, shown while the next round counts down. */
export class ResultsScreen {
  private readonly panel = element('results');
  private lastDrawn = '';

  constructor(private readonly players: PlayerLookup) {}

  show(standings: PlayerScore[]): void {
    const key = JSON.stringify(standings);
    if (!this.panel.hidden && key === this.lastDrawn) return;
    this.lastDrawn = key;

    element('results-title').replaceChildren(...this.title(standings));
    element('results-table').replaceChildren(headerRow(), ...standings.map((score) => this.row(score)));
    this.panel.hidden = false;
  }

  hide(): void {
    this.panel.hidden = true;
  }

  updateCountdown(secondsLeft: number): void {
    if (this.panel.hidden) return;
    element('results-countdown').textContent = `Next round in ${Math.ceil(secondsLeft)}`;
  }

  private title(standings: PlayerScore[]): (string | HTMLElement)[] {
    const [first, second] = standings;
    if (!first || first.kills === 0) return ['Nobody scored!'];
    const tied = second && second.kills === first.kills && second.deaths === first.deaths;
    if (tied) return ["It's a draw!"];
    return [playerNameElement(this.players, first.playerId), ' wins!'];
  }

  private row(score: PlayerScore): HTMLTableRowElement {
    const row = document.createElement('tr');
    const name = document.createElement('td');
    name.append(playerNameElement(this.players, score.playerId));
    row.append(name, cell(score.kills), cell(score.deaths), cell(killDeathRatio(score)));
    return row;
  }
}

function headerRow(): HTMLTableRowElement {
  const row = document.createElement('tr');
  for (const label of ['', 'Kills', 'Deaths', 'K/D']) {
    const header = document.createElement('th');
    header.textContent = label;
    row.appendChild(header);
  }
  return row;
}

function cell(content: string | number): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = String(content);
  return td;
}
