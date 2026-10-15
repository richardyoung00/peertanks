import type { Theme } from './theme';

export const grassland: Theme = {
  name: 'grassland',
  outerGround: 0x2f4a33,
  floor: { light: 0x93c66e, dark: 0x8abd66, bare: 0xc9b47a, lush: 0x74ad55 },
  wall: { side: 0x9b8f83, top: 0xc8bfae },
  rocks: {
    colors: [0x8a9097, 0x9ea4aa, 0x7d8289],
    moss: 0x5f9b45,
    shapes: { boulder: 3, cluster: 2, slab: 1.5, mossy: 2 },
  },
  trees: {
    trunk: 0x7a5230,
    deadWood: 0x8a7560,
    leaves: [0x3f8f4a, 0x4ea357, 0x5cb160],
    shapes: { pine: 3, round: 3, conifer: 2, bush: 2, dead: 0.4 },
  },
  water: { shallow: 0x5cc4e8, deep: 0x1f6f9e, foam: 0xf2fbff, sand: 0xd9c38c, wetSand: 0xb19a68, bed: 0x2d5f6e },
  lava: {
    molten: 0xff7a1f,
    crust: 0x4a1a0c,
    glow: 0xffd36b,
    scorched: 0xa29a62,
    rock: 0x8a7458,
    rim: 0x4a2a1c,
    bed: 0x3a1408,
    warmth: 0xd28a4a,
  },
  pit: 0x15110f,
};
