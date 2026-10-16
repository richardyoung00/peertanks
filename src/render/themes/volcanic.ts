import type { Theme } from './theme';

export const volcanic: Theme = {
  name: 'volcanic',
  outerGround: 0x231d1b,
  floor: { light: 0x4a4541, dark: 0x46413d, bare: 0x5f5955, lush: 0x4d3c35, tileVariation: 0.01 },
  wall: { side: 0x6b4a3a, top: 0x8a6550 },
  rocks: {
    colors: [0x2e2b2a, 0x3a3634, 0x27231f],
    moss: 0x5c2a1a,
    shapes: { boulder: 2, cluster: 3, slab: 2 },
  },
  trees: {
    trunk: 0x2b211c,
    deadWood: 0x2c2420,
    leaves: [0x4a4a3a],
    snow: 0xf2f6fa,
    shapes: { dead: 1 },
  },
  water: { shallow: 0x4f8fa8, deep: 0x1a4560, foam: 0xd8e4ea, sand: 0x5a524c, wetSand: 0x45403b, bed: 0x22323a },
  lava: {
    molten: 0xff6a14,
    crust: 0x2a120a,
    glow: 0xffc24d,
    scorched: 0x45403c,
    rock: 0x2e2a28,
    rim: 0x1c1210,
    bed: 0x2a0e06,
    warmth: 0x7a4430,
  },
  pit: 0x0e0a09,
};
