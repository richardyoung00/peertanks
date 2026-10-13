import { grassland } from './grassland';
import type { Theme } from './theme';

const THEMES: Record<string, Theme> = { grassland };

export function getTheme(name: string): Theme {
  const theme = THEMES[name];
  if (theme) return theme;
  console.warn(`Unknown map theme "${name}", falling back to grassland`);
  return grassland;
}
