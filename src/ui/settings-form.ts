import type { GameSettings } from '../sim/game-settings';
import { ROUND_LENGTH_CHOICES } from '../sim/game-settings';
import { PICKUP_WEAPON_IDS, POWERUP_IDS, type ItemId } from '../sim/items';
import type { MapListing } from '../sim/map-loader';
import { POWERUP_NAMES, WEAPON_NAMES } from './item-names';

export interface SettingsFormOptions {
  /** The maps to choose from; leave out to hide the map choice (it can't change mid-game). */
  maps?: MapListing[];
  /** Read-only for everyone except the host. */
  editable: boolean;
  onChange?(settings: GameSettings): void;
}

/** Map, round length and allowed weapons and powerups, as an editable form or a read-only summary. */
export function renderSettingsForm(container: HTMLElement, settings: GameSettings, options: SettingsFormOptions): void {
  const change = (update: Partial<GameSettings>) => options.onChange?.({ ...settings, ...update });
  const sections: HTMLElement[] = [];

  if (options.maps) sections.push(field('Map', mapSelect(settings, options, change)));
  sections.push(field('Round length', roundLengthSelect(settings, options, change)));
  sections.push(itemGroup('Weapons', PICKUP_WEAPON_IDS, WEAPON_NAMES, settings, options, change));
  sections.push(itemGroup('Powerups', POWERUP_IDS, POWERUP_NAMES, settings, options, change));
  container.replaceChildren(...sections);
}

type Change = (update: Partial<GameSettings>) => void;

function mapSelect(settings: GameSettings, options: SettingsFormOptions, change: Change): HTMLSelectElement {
  const choices = (options.maps ?? []).map((map) => ({ value: map.id, label: map.name }));
  return select(choices, settings.mapId, options.editable, (mapId) => change({ mapId }));
}

function roundLengthSelect(settings: GameSettings, options: SettingsFormOptions, change: Change): HTMLSelectElement {
  const choices = ROUND_LENGTH_CHOICES.map((seconds) => ({ value: String(seconds), label: `${seconds / 60} min` }));
  return select(choices, String(settings.roundSeconds), options.editable, (value) => change({ roundSeconds: Number(value) }));
}

function itemGroup<T extends ItemId>(
  title: string,
  items: readonly T[],
  names: Record<T, string>,
  settings: GameSettings,
  options: SettingsFormOptions,
  change: Change,
): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'settings-items';
  for (const item of items) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = settings.allowedItems.includes(item);
    checkbox.disabled = !options.editable;
    checkbox.onchange = () => {
      const others = settings.allowedItems.filter((allowed) => allowed !== item);
      change({ allowedItems: checkbox.checked ? [...others, item] : others });
    };
    label.append(checkbox, names[item]);
    grid.appendChild(label);
  }
  return field(title, grid);
}

function select(
  choices: { value: string; label: string }[],
  selected: string,
  editable: boolean,
  onSelect: (value: string) => void,
): HTMLSelectElement {
  const element = document.createElement('select');
  for (const choice of choices) element.add(new Option(choice.label, choice.value, false, choice.value === selected));
  element.disabled = !editable;
  element.onchange = () => onSelect(element.value);
  return element;
}

function field(title: string, control: HTMLElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-field';
  const heading = document.createElement('div');
  heading.className = 'settings-label';
  heading.textContent = title;
  wrapper.append(heading, control);
  return wrapper;
}
