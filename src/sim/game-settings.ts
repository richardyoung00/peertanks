import { GAMEPLAY } from '../gameplay-config';
import { ITEM_IDS, type ItemId } from './items';

/** What the host picks in the lobby. Changes made during a game apply from the next round. */
export interface GameSettings {
  /** The map rotation: rounds play these maps in turn. Never empty. */
  mapIds: string[];
  roundSeconds: number;
  /** Weapons and powerups that may appear at pickup spots. */
  allowedItems: ItemId[];
}

export const DEFAULT_MAP_ID = 'arena-01';

/** Round lengths offered in the menus, always including the config default. */
export const ROUND_LENGTH_CHOICES = [...new Set([120, 180, 300, 480, 600, GAMEPLAY.round.lengthSeconds])].sort((a, b) => a - b);

export function defaultSettings(): GameSettings {
  return { mapIds: [DEFAULT_MAP_ID], roundSeconds: GAMEPLAY.round.lengthSeconds, allowedItems: [...ITEM_IDS] };
}

/** The map after `currentId` in the rotation, wrapping around. If the current map was taken out, starts over. */
export function nextMapId(settings: GameSettings, currentId: string): string {
  const index = settings.mapIds.indexOf(currentId);
  return settings.mapIds[(index + 1) % settings.mapIds.length];
}
