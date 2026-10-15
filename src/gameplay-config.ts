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

/** Bot personality values are rolled at random between these two numbers: [lowest, highest]. */
export type Range = readonly [number, number];

/** How good a bot is. Every level has its own bounds. */
export interface BotSkillBounds {
  /** Delay before noticing a new enemy or an incoming shot. Humans take about 0.2–0.35 s. */
  reactionSeconds: Range;
  /** Size of the slowly drifting aim wobble. */
  aimErrorDegrees: Range;
  /** Time for the turret to swing onto a new aim point. */
  aimSettleSeconds: Range;
  /** Below 1 the turret overshoots and swings back, like a hurried mouse flick; 1 means no overshoot. */
  aimDamping: Range;
  /** Share of the correct lead it gives a moving target (0 = aims where the target is now). */
  leadSkill: Range;
  /** Chance of dodging a shot that is about to hit it. */
  dodgeSkill: Range;
  /** The most trick shots a bot of this level goes for, whatever its play style. */
  trickShotLimit: number;
  /** How far it keeps from water and lava, and how careful it is with its own explosions (0–1). */
  hazardAwareness: Range;
  /** 0 = sprays at anything, 1 = only fires with a clean, well-aimed shot. */
  triggerDiscipline: Range;
  /** Brief pauses per second, like a player hesitating. */
  hesitationsPerSecond: Range;
  /** Whether it holds back from piling onto a human who is already fighting other bots. */
  respectsGangUpLimit: boolean;
}

/** How a bot likes to play. Each archetype has its own bounds, at every level. */
export interface BotStyleBounds {
  /** 0 = hangs back, 1 = chases and attacks. */
  aggression: Range;
  /** Share of health left at which it retreats to cover. */
  caution: Range;
  /** How far out of its way it goes for pickups (0–1). */
  pickupGreed: Range;
  /** How keen it is to turn on whoever just hit it (0–1). */
  vengefulness: Range;
  /** How keen it is on bounce shots, lasers off walls and lobs over cover (0–1). */
  trickShots: Range;
  /** Distance in tiles it likes to fight from. */
  preferredRange: Range;
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

  /**
   * A tank only falls in once its centre is this far (in tiles) past the edge, so it can hang over the bank
   * a little. Water and lava match roughly where the waterline is drawn; pits have a sheer edge, so less.
   */
  hazardEdgeAllowance: { water: 0.25, lava: 0.25, pit: 0.12 },

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

  bots: {
    /** How often bots rethink their plans. A random jitter keeps them from all acting on the same tick. */
    thinkSeconds: 0.1,
    thinkJitterSeconds: 0.05,
    /** Bots notice tanks within this distance across and up/down, roughly what a player sees on screen. */
    viewHalfWidth: 11,
    viewHalfHeight: 7.5,
    /** How long a bot remembers where it last saw an enemy. */
    memorySeconds: 4,
    /** Like a key held on a keyboard: the shortest time a bot keeps one movement direction. */
    minKeyHoldSeconds: 0.15,
    /** How long a hesitation pause lasts. */
    hesitationSeconds: [0.2, 0.5] as Range,
    /** A new plan has to beat the current one by this much before the bot changes its mind. */
    planCommitment: 0.15,
    /** Easy and medium bots won't join in on a human already fighting this many bots. */
    gangUpLimit: 2,
    /** How far ahead bots look for shots that will hit them. */
    dodgeLookAheadSeconds: 0.8,
    /** How long a bot stays in cover after retreating, before it gets brave again. */
    retreatSeconds: [3, 6] as Range,

    levels: {
      easy: {
        reactionSeconds: [0.45, 0.7],
        aimErrorDegrees: [8, 12],
        aimSettleSeconds: [0.4, 0.55],
        aimDamping: [0.45, 0.6],
        leadSkill: [0, 0.3],
        dodgeSkill: [0.1, 0.25],
        trickShotLimit: 0.25,
        hazardAwareness: [0.2, 0.45],
        triggerDiscipline: [0.1, 0.35],
        hesitationsPerSecond: [0.3, 0.6],
        respectsGangUpLimit: true,
      },
      medium: {
        reactionSeconds: [0.3, 0.45],
        aimErrorDegrees: [4, 7],
        aimSettleSeconds: [0.25, 0.35],
        aimDamping: [0.6, 0.75],
        leadSkill: [0.4, 0.7],
        dodgeSkill: [0.35, 0.6],
        trickShotLimit: 0.6,
        hazardAwareness: [0.5, 0.75],
        triggerDiscipline: [0.4, 0.65],
        hesitationsPerSecond: [0.1, 0.25],
        respectsGangUpLimit: true,
      },
      hard: {
        reactionSeconds: [0.18, 0.28],
        aimErrorDegrees: [1.5, 3],
        aimSettleSeconds: [0.13, 0.2],
        aimDamping: [0.75, 0.9],
        leadSkill: [0.75, 0.95],
        dodgeSkill: [0.65, 0.85],
        trickShotLimit: 1,
        hazardAwareness: [0.8, 1],
        triggerDiscipline: [0.7, 0.9],
        hesitationsPerSecond: [0, 0.08],
        respectsGangUpLimit: false,
      },
    } satisfies Record<string, BotSkillBounds>,

    archetypes: {
      brawler: {
        aggression: [0.75, 1],
        caution: [0, 0.15],
        pickupGreed: [0.1, 0.4],
        vengefulness: [0.7, 1],
        trickShots: [0, 0.2],
        preferredRange: [2, 4],
      },
      sentry: {
        aggression: [0.15, 0.4],
        caution: [0.35, 0.6],
        pickupGreed: [0.2, 0.5],
        vengefulness: [0.2, 0.5],
        trickShots: [0.3, 0.6],
        preferredRange: [6, 9],
      },
      scavenger: {
        aggression: [0.3, 0.6],
        caution: [0.2, 0.45],
        pickupGreed: [0.8, 1],
        vengefulness: [0.3, 0.6],
        trickShots: [0.2, 0.5],
        preferredRange: [4, 7],
      },
      trickster: {
        aggression: [0.4, 0.7],
        caution: [0.15, 0.4],
        pickupGreed: [0.4, 0.7],
        vengefulness: [0.3, 0.7],
        trickShots: [0.8, 1],
        preferredRange: [5, 8],
      },
      'all-rounder': {
        aggression: [0.4, 0.65],
        caution: [0.2, 0.4],
        pickupGreed: [0.35, 0.65],
        vengefulness: [0.35, 0.65],
        trickShots: [0.3, 0.6],
        preferredRange: [4, 6],
      },
    } satisfies Record<string, BotStyleBounds>,
  },
};
