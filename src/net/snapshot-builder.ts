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
    });
  }

  const projectiles = world.projectiles.map((projectile) => ({
    id: projectile.id,
    x: projectile.x,
    y: projectile.y,
    vx: projectile.vx,
    vy: projectile.vy,
  }));

  return { tick: world.tick, ackSeq: 0, tanks, projectiles };
}
