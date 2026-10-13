/** Colours for one arena style. Adding a new theme should only need a new file like grassland.ts. */
export interface Theme {
  name: string;
  outerGround: number;
  floor: { light: number; dark: number };
  wall: { side: number; top: number };
  rocks: number[];
  tree: { trunk: number; leaves: number[] };
  water: { surface: number; bed: number };
  lava: { surface: number; glow: number; bed: number };
  pit: number;
}
