import type { BotLevel } from '../bots/bot-level';

/** How the HUD finds a player's display name and colour. Hosts and clients look these up differently. */
export interface PlayerLookup {
  name(id: string): string;
  color(id: string): number;
  botLevel(id: string): BotLevel | undefined;
}

export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** A player's name as a coloured span. Uses textContent, since names are typed in by players. */
export function playerNameElement(lookup: PlayerLookup, id: string, className = 'kill-name'): HTMLElement {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = lookup.name(id);
  span.style.color = cssColor(lookup.color(id));
  return span;
}
