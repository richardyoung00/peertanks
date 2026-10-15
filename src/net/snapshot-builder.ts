import { POWERUP_IDS } from '../sim/items';
import { emptyLoadout } from '../sim/loadout';
import type { GameWorld } from '../sim/game-world';
import type { Tank } from '../sim/tank';
import { NO_OWNER, type OwnStatus, type Snapshot } from './packets';
import type { Roster } from './roster';

/** Builds the shared part of a snapshot; each client then gets its own `ackSeq` and `own` status. */
export function buildSnapshot(world: GameWorld, roster: Roster): Snapshot {
  const tanks = [];
  for (const tank of world.tanks.values()) {
    const netId = roster.netIdOf(tank.id);
    if (netId === undefined) continue;
    const velocity = tank.body.linvel();
    tanks.push({
      netId,
      x: tank.x,
      y: tank.y,
      vx: velocity.x,
      vy: velocity.y,
      hullAngle: tank.hullAngle,
      aimAngle: tank.aimAngle,
      health: tank.health,
      alive: tank.alive,
      invulnerable: tank.invulnerableTimer > 0,
      weapon: tank.loadout.selected,
      powerups: POWERUP_IDS.filter((powerup) => tank.loadout.powerups[powerup] > 0),
    });
  }

  const projectiles = world.projectiles.map((projectile) => ({
    id: projectile.id,
    kind: projectile.kind,
    ownerNetId: roster.netIdOf(projectile.ownerId) ?? NO_OWNER,
    x: projectile.x,
    y: projectile.y,
    vx: projectile.vx,
    vy: projectile.vy,
    height: projectile.height,
  }));

  return {
    tick: world.tick,
    ackSeq: 0,
    round: { phase: world.round.phase, timeLeft: world.round.timeLeft },
    tanks,
    projectiles,
    pickups: world.pickups.spots.map((spot) => spot.item),
    own: ownStatusOf(undefined),
  };
}

export function ownStatusOf(tank: Tank | undefined): OwnStatus {
  const loadout = tank?.loadout ?? emptyLoadout();
  return { ammo: { ...loadout.ammo }, powerups: { ...loadout.powerups } };
}
