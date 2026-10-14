// Every number that affects game balance lives here. It's compiled into the game, so changes need a rebuild.
// Distances are in map tiles, times in seconds, speeds in tiles per second, damage in health points (tanks have 100).

export interface ExplosionConfig {
  /** Full damage inside this radius. */
  innerRadius: number;
  /** Damage and push fall off to nothing at this radius. */
  outerRadius: number;
  damage: number;
  /** Speed added to tanks at the centre, pushing them away. */
  knockback: number;
}

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
    lengthSeconds: 480,
    resultsSeconds: 20,
  },

  explosions: {
    /** After being knocked back, steering is weakened for this long, so a push actually carries you. */
    knockbackControlLossSeconds: 0.4,
    /** How much steering you keep while knocked back (1 = full control). */
    knockbackControlFactor: 0.2,
  },

  /** Each weapon's cooldownSeconds is the shortest time between shots; stronger weapons wait longer. */
  weapons: {
    cannon: {
      damage: 10,
      cooldownSeconds: 0.45,
      speed: 10,
      lifetimeSeconds: 2.5,
    },
    'machine-gun': {
      damage: 4,
      cooldownSeconds: 0.08,
      speed: 15,
      lifetimeSeconds: 1,
      spreadDegrees: 5,
      ammoPerPickup: 60,
    },
    'bouncy-cannon': {
      damage: 25,
      cooldownSeconds: 0.8,
      speed: 9,
      lifetimeSeconds: 4,
      bounces: 3,
      ammoPerPickup: 10,
    },
    laser: {
      damage: 40,
      cooldownSeconds: 1.2,
      range: 25,
      reflections: 3,
      ammoPerPickup: 5,
    },
    rocket: {
      cooldownSeconds: 1.6,
      speed: 11,
      lifetimeSeconds: 3,
      ammoPerPickup: 4,
      explosion: { innerRadius: 0.9, outerRadius: 2.6, damage: 100, knockback: 10 } satisfies ExplosionConfig,
    },
    grenade: {
      cooldownSeconds: 1.4,
      /** Holding fire this long gives the furthest throw. */
      maxChargeSeconds: 3,
      minThrowSpeed: 3,
      maxThrowSpeed: 12,
      /** Time in the air for the weakest and strongest throws. */
      minAirSeconds: 0.2,
      maxAirSeconds: 0.8,
      /** Peak height of the throw for the weakest and strongest throws. */
      minArcHeight: 0.3,
      maxArcHeight: 2,
      /** While higher than this, a grenade sails over walls, rocks and trees. */
      terrainClearance: 1.2,
      /** Share of speed kept when it hits the ground and starts rolling. */
      landingSpeedKept: 0.5,
      /** How quickly a rolling grenade slows down. */
      deceleration: 6,
      /** Share of speed kept when bouncing off walls and tanks. */
      bounciness: 0.6,
      fuseSeconds: 2,
      ammoPerPickup: 3,
      explosion: { innerRadius: 0.9, outerRadius: 2.8, damage: 100, knockback: 10 } satisfies ExplosionConfig,
    },
    mortar: {
      cooldownSeconds: 2,
      flightSeconds: 1.4,
      minRange: 2,
      maxRange: 12,
      /** How high the shell flies (visual only; mortars always fly over terrain). */
      arcHeight: 4,
      ammoPerPickup: 3,
      explosion: { innerRadius: 1, outerRadius: 2.6, damage: 100, knockback: 9 } satisfies ExplosionConfig,
    },
  },

  powerups: {
    shield: {
      durationSeconds: 20,
      damageTakenMultiplier: 0.5,
    },
    speed: {
      durationSeconds: 10,
      speedMultiplier: 1.4,
    },
    'damage-boost': {
      durationSeconds: 10,
      damageMultiplier: 1.5,
    },
    'dead-mans-switch': {
      durationSeconds: 30,
      explosion: { innerRadius: 1, outerRadius: 3, damage: 100, knockback: 12 } satisfies ExplosionConfig,
    },
  },

  pickups: {
    /** Used when a map's pickup spot doesn't set its own `respawnSeconds`. */
    defaultRespawnSeconds: 15,
    collectRadius: 0.7,
    /** Ammo can stack up to this many pickups' worth. */
    maxAmmoPickups: 2,
  },
};
