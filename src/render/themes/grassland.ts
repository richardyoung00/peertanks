import type { Theme } from './theme';

export const grassland: Theme = {
  name: 'grassland',
  outerGround: 0x2f4a33,
  floor: { light: 0x93c66e, dark: 0x84b862 },
  wall: { side: 0x9b8f83, top: 0xc8bfae },
  rocks: [0x8a9097, 0x9ea4aa, 0x7d8289],
  tree: { trunk: 0x7a5230, leaves: [0x3f8f4a, 0x4ea357, 0x5cb160] },
  water: { surface: 0x45ace0, bed: 0x1e5a78 },
  lava: { surface: 0xff7a1f, glow: 0xff4500, bed: 0x5a1a0a },
  pit: 0x15110f,
};
