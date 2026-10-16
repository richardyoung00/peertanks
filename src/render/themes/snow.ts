import type { Theme } from './theme';

export const snow: Theme = {
  name: 'snow',
  outerGround: 0x9fb0bf,
  floor: { light: 0xedf2f6, dark: 0xe8eef3, bare: 0xc9d1d8, lush: 0xd9e4ed },
  wall: { side: 0x8a96a3, top: 0xeef3f7 },
  rocks: {
    colors: [0x7d858e, 0x8e969f, 0x6e7680],
    moss: 0xf4f8fb,
    shapes: { mossy: 2, boulder: 2, cluster: 1.5, slab: 1 },
  },
  trees: {
    trunk: 0x5a3f2a,
    deadWood: 0x7d6e60,
    leaves: [0x2f5d45, 0x2a5440, 0x376b4e],
    snow: 0xf2f6fa,
    shapes: { snowyPine: 4, conifer: 1, dead: 0.3 },
  },
  water: { shallow: 0x8fc9e0, deep: 0x23506e, foam: 0xffffff, sand: 0xdde6ee, wetSand: 0xa7b9c8, bed: 0x2a4657 },
  lava: {
    molten: 0xff7a1f,
    crust: 0x4a1a0c,
    glow: 0xffd36b,
    scorched: 0x8f8a86,
    rock: 0x6e6460,
    rim: 0x3a2a24,
    bed: 0x3a1408,
    warmth: 0xd28a4a,
  },
  pit: 0x1b2128,
};
