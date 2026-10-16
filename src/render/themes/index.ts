import { grassland } from './grassland';
import { snow } from './snow';
import type { Theme } from './theme';
import { volcanic } from './volcanic';

const THEMES: Record<string, Theme> = { grassland, snow, volcanic };

export function getTheme(name: string): Theme {
  const theme = THEMES[name];
  if (theme) return theme;
  console.warn(`Unknown map theme "${name}", falling back to grassland`);
  return grassland;
}
