import type { PlayerInfo } from '../net/messages';
import { cssColor } from './player-lookup';

export interface PlayerListOptions {
  localId: string;
  hostId: string;
  /** When given, every other player gets a Kick button. */
  onKick?(playerId: string): void;
}

export function renderPlayerList(container: HTMLElement, players: PlayerInfo[], options: PlayerListOptions): void {
  container.replaceChildren(...players.map((player) => playerRow(player, options)));
}

function playerRow(player: PlayerInfo, options: PlayerListOptions): HTMLElement {
  const row = document.createElement('li');
  const dot = document.createElement('span');
  dot.className = 'score-dot';
  dot.style.background = cssColor(player.color);
  const name = document.createElement('span');
  name.className = 'player-name';
  name.textContent = player.name;
  row.append(dot, name);

  const tags = [player.id === options.hostId ? 'host' : '', player.id === options.localId ? 'you' : ''].filter(Boolean);
  if (tags.length > 0) {
    const tag = document.createElement('span');
    tag.className = 'player-tag';
    tag.textContent = tags.join(', ');
    row.appendChild(tag);
  }

  if (options.onKick && player.id !== options.localId) {
    const kick = document.createElement('button');
    kick.type = 'button';
    kick.className = 'small danger';
    kick.textContent = 'Kick';
    kick.onclick = () => options.onKick?.(player.id);
    row.appendChild(kick);
  }
  return row;
}
