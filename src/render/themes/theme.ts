import type { RockShapeId } from '../terrain/rock-shapes';
import type { TreeShapeId } from '../terrain/tree-shapes';

/** How often each shape appears, relative to the others. Shapes left out never appear. */
export type ShapeWeights<Id extends string> = Partial<Record<Id, number>>;

/** Colours and shapes for one arena style. Adding a new theme should only need a new file like grassland.ts. */
export interface Theme {
  name: string;
  outerGround: number;
  floor: {
    light: number;
    dark: number;
    /** Patches of bare ground, and of lusher, darker grass, drift across the floor. */
    bare: number;
    lush: number;
  };
  wall: { side: number; top: number };
  rocks: { colors: number[]; moss: number; shapes: ShapeWeights<RockShapeId> };
  trees: { trunk: number; deadWood: number; leaves: number[]; shapes: ShapeWeights<TreeShapeId> };
  water: {
    shallow: number;
    deep: number;
    foam: number;
    /** The bank, from the grass edge down: dry sand, then wet sand, then the bed. */
    sand: number;
    wetSand: number;
    bed: number;
  };
  lava: {
    molten: number;
    crust: number;
    /** The brightest cracks, bubbles and embers. */
    glow: number;
    /** The bank, from the grass edge down: scorched grass, dark rock, then a charred rim at the lava line. */
    scorched: number;
    rock: number;
    rim: number;
    bed: number;
    /** A warm tint on ground near lava. */
    warmth: number;
  };
  pit: number;
}
