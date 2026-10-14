// Every number that affects game balance lives here. It's compiled into the game, so changes need a rebuild.
// Distances are in map tiles, times in seconds, speeds in tiles per second.

export const GAMEPLAY = {
  tank: {
    radius: 0.42,
    maxSpeed: 4.2,
    acceleration: 28,
    hullTurnRate: 9,
    barrelLength: 0.6,
    maxHealth: 100,
  },

  respawn: {
    delaySeconds: 3,
    invulnerableSeconds: 2,
  },

  /** If you were hit this recently before falling into a hazard, whoever hit you gets the kill. */
  hazardKillCreditSeconds: 4,

  round: {
    lengthSeconds: 180,
    resultsSeconds: 20,
  },

  weapons: {
    cannon: {
      damage: 10,
      cooldownSeconds: 0.45,
      shellSpeed: 10,
      shellLifetimeSeconds: 2.5,
    },
  },
};
