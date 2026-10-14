import type { GameWorld } from '../sim/game-world';
import type { Snapshot } from './packets';
import type { Roster } from './roster';

/** Builds the shared part of a snapshot; each client then gets its own `ackSeq`. */
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
    });
  }

  const projectiles = world.projectiles.map((projectile) => ({
    id: projectile.id,
    x: projectile.x,
    y: projectile.y,
    vx: projectile.vx,
    vy: projectile.vy,
  }));

  const round = { phase: world.round.phase, timeLeft: world.round.timeLeft };
  return { tick: world.tick, ackSeq: 0, round, tanks, projectiles };
}
