import type { MapCard } from '../app/menu-art';
import type { GameSettings } from '../sim/game-settings';
import { ROUND_LENGTH_CHOICES } from '../sim/game-settings';
import { PICKUP_WEAPON_IDS, POWERUP_IDS, type ItemId } from '../sim/items';
import { POWERUP_NAMES, WEAPON_NAMES } from './item-names';

export interface SettingsFormOptions {
  maps: MapCard[];
  itemThumbnails: Record<ItemId, string>;
  /** Only the host can change settings; everyone else sees the same choices, read-only. */
  editable: boolean;
  onChange?(settings: GameSettings): void;
}

type Change = (update: Partial<GameSettings>) => void;

/** Map rotation, round length and allowed weapons and powerups, as chunky in-game controls. */
export function renderSettingsForm(container: HTMLElement, settings: GameSettings, options: SettingsFormOptions): void {
  const change: Change = (update) => options.onChange?.({ ...settings, ...update });
  container.replaceChildren(
    column(
      section('Maps', 'Picked maps play in turn, one per round.', mapCards(settings, options, change)),
      section('Round length', null, roundLengthPills(settings, options, change)),
    ),
    column(
      section('Weapons', null, itemTiles(PICKUP_WEAPON_IDS, WEAPON_NAMES, settings, options, change)),
      section('Powerups', null, itemTiles(POWERUP_IDS, POWERUP_NAMES, settings, options, change)),
    ),
  );
}

function mapCards(settings: GameSettings, options: SettingsFormOptions, change: Change): HTMLElement {
  const strip = element('div', 'map-strip');
  for (const map of options.maps) {
    const picked = settings.mapIds.includes(map.id);
    const card = toggleButton('map-card', picked, options.editable, () => {
      const rotation = toggleMap(options.maps, settings.mapIds, map.id);
      if (rotation.length > 0) change({ mapIds: rotation });
    });

    const picture = element('img', 'map-card-picture');
    picture.src = map.thumbnail;
    picture.alt = '';
    const size = element('span', 'map-card-size');
    size.textContent = map.size;
    size.title = { S: 'Small map', M: 'Medium map', L: 'Large map' }[map.size];
    const name = element('span', 'map-card-name');
    name.textContent = map.name;
    card.append(picture, size, name);
    strip.appendChild(card);
  }
  return strip;
}

/** The rotation with one map added or removed, kept in the same order as the map list. */
function toggleMap(maps: MapCard[], rotation: string[], mapId: string): string[] {
  const picked = new Set(rotation);
  if (picked.has(mapId)) picked.delete(mapId);
  else picked.add(mapId);
  return maps.map((map) => map.id).filter((id) => picked.has(id));
}

function roundLengthPills(settings: GameSettings, options: SettingsFormOptions, change: Change): HTMLElement {
  const row = element('div', 'pill-row');
  for (const seconds of ROUND_LENGTH_CHOICES) {
    const pill = toggleButton('pill', settings.roundSeconds === seconds, options.editable, () => change({ roundSeconds: seconds }));
    pill.textContent = `${seconds / 60} min`;
    row.appendChild(pill);
  }
  return row;
}

function itemTiles<T extends ItemId>(
  items: readonly T[],
  names: Record<T, string>,
  settings: GameSettings,
  options: SettingsFormOptions,
  change: Change,
): HTMLElement {
  const grid = element('div', 'item-grid');
  for (const item of items) {
    const allowed = settings.allowedItems.includes(item);
    const tile = toggleButton('item-tile', allowed, options.editable, () => {
      const others = settings.allowedItems.filter((other) => other !== item);
      change({ allowedItems: allowed ? others : [...others, item] });
    });
    const picture = element('img', 'item-tile-picture');
    picture.src = options.itemThumbnails[item];
    picture.alt = '';
    const name = element('span', 'item-tile-name');
    name.textContent = names[item];
    tile.append(picture, name);
    grid.appendChild(tile);
  }
  return grid;
}

/** A button that shows whether its option is on. Read-only buttons look the same but can't be pressed. */
function toggleButton(className: string, on: boolean, editable: boolean, onToggle: () => void): HTMLButtonElement {
  const button = element('button', className);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(on));
  button.disabled = !editable;
  button.onclick = onToggle;
  return button;
}

function column(...sections: HTMLElement[]): HTMLElement {
  const wrapper = element('div', 'settings-column');
  wrapper.append(...sections);
  return wrapper;
}

function section(title: string, hint: string | null, control: HTMLElement): HTMLElement {
  const wrapper = element('div', 'settings-section');
  const heading = element('h4', 'settings-heading');
  heading.textContent = title;
  wrapper.appendChild(heading);
  if (hint) {
    const note = element('p', 'settings-hint');
    note.textContent = hint;
    wrapper.appendChild(note);
  }
  wrapper.appendChild(control);
  return wrapper;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;
  return created;
}
