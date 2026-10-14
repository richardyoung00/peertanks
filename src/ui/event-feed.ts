import type { TankKilledEvent } from '../sim/game-events';
import { element } from './dom';
import { killMessageTemplate } from './kill-messages';
import { cssColor, playerNameElement, type PlayerLookup } from './player-lookup';

const LINE_LIFETIME_MS = 6000;
const FADE_MS = 400;
const MAX_LINES = 5;

export interface FeedPlayer {
  name: string;
  color: number;
}

/** Recent kills, joins and leaves in the bottom-left corner, newest at the bottom. */
export class EventFeed {
  private readonly container = element('event-feed');

  constructor(private readonly players: PlayerLookup) {}

  addKill(event: TankKilledEvent): void {
    this.addLine(this.fillKillTemplate(killMessageTemplate(event), event));
  }

  /** Takes the name directly, because a player who has left is no longer in the lookup. */
  addPlayerJoined(player: FeedPlayer): void {
    this.addLine([nameElement(player), ' joined the game'], 'feed-line notice');
  }

  addPlayerLeft(player: FeedPlayer): void {
    this.addLine([nameElement(player), ' left the game'], 'feed-line notice');
  }

  private addLine(parts: (string | HTMLElement)[], className = 'feed-line'): void {
    const line = document.createElement('div');
    line.className = className;
    line.append(...parts);
    this.container.appendChild(line);

    while (this.container.children.length > MAX_LINES) this.container.firstElementChild?.remove();
    setTimeout(() => line.classList.add('fading'), LINE_LIFETIME_MS);
    setTimeout(() => line.remove(), LINE_LIFETIME_MS + FADE_MS);
  }

  private fillKillTemplate(template: string, event: TankKilledEvent): (string | HTMLElement)[] {
    return template.split(/(\{killer\}|\{victim\})/).map((part) => {
      if (part === '{victim}') return playerNameElement(this.players, event.tankId);
      if (part === '{killer}' && event.killerId) return playerNameElement(this.players, event.killerId);
      return part;
    });
  }
}

function nameElement(player: FeedPlayer): HTMLElement {
  const span = document.createElement('span');
  span.className = 'feed-name';
  span.textContent = player.name;
  span.style.color = cssColor(player.color);
  return span;
}
