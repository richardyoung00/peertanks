import { NETWORK, SIM_DT } from '../config';
import { lerpAngle } from '../sim/angles';
import type { ProjectileSnapshot, Snapshot, TankSnapshot } from './packets';

const BUFFER_SECONDS = 1;
const CLOCK_SMOOTHING = 0.05;

export interface InterpolatedState {
  tanks: TankSnapshot[];
  projectiles: ProjectileSnapshot[];
}

interface TimedSnapshot {
  /** Host simulation time in seconds. */
  time: number;
  snapshot: Snapshot;
}

/**
 * Keeps recent snapshots and blends between them. Other players are shown slightly in the past
 * (the interpolation delay) so there is almost always a snapshot either side of the moment being drawn.
 */
export class SnapshotTimeline {
  private snapshots: TimedSnapshot[] = [];
  private clockOffset: number | null = null;

  /** Returns false for snapshots that arrive after a newer one (the fast channel doesn't keep order). */
  push(snapshot: Snapshot, arrivalSeconds: number): boolean {
    const latest = this.snapshots.at(-1);
    if (latest && snapshot.tick <= latest.snapshot.tick) return false;

    const time = snapshot.tick * SIM_DT;
    const offset = arrivalSeconds - time;
    this.clockOffset = this.clockOffset === null ? offset : this.clockOffset + (offset - this.clockOffset) * CLOCK_SMOOTHING;

    this.snapshots.push({ time, snapshot });
    this.snapshots = this.snapshots.filter((entry) => entry.time >= time - BUFFER_SECONDS);
    return true;
  }

  /** The host time to draw other players at. */
  renderTime(nowSeconds: number): number {
    return nowSeconds - (this.clockOffset ?? 0) - NETWORK.interpolationDelay;
  }

  sample(renderTime: number): InterpolatedState | null {
    if (this.snapshots.length === 0) return null;
    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    if (renderTime <= first.time) return first.snapshot;
    if (renderTime >= last.time) return last.snapshot;

    const nextIndex = this.snapshots.findIndex((entry) => entry.time > renderTime);
    const before = this.snapshots[nextIndex - 1];
    const after = this.snapshots[nextIndex];
    const t = (renderTime - before.time) / (after.time - before.time);
    return {
      tanks: blendTanks(before.snapshot.tanks, after.snapshot.tanks, t),
      projectiles: blendProjectiles(before.snapshot.projectiles, after, renderTime),
    };
  }
}

function blendTanks(before: TankSnapshot[], after: TankSnapshot[], t: number): TankSnapshot[] {
  return after.map((next) => {
    const previous = before.find((tank) => tank.netId === next.netId);
    if (!previous) return next;
    return {
      ...next,
      x: previous.x + (next.x - previous.x) * t,
      y: previous.y + (next.y - previous.y) * t,
      hullAngle: lerpAngle(previous.hullAngle, next.hullAngle, t),
      aimAngle: lerpAngle(previous.aimAngle, next.aimAngle, t),
    };
  });
}

/**
 * Projectiles fly straight between snapshots, so work back from the later snapshot along their velocity.
 * A projectile fired between the two snapshots is shown where the later snapshot has it.
 */
function blendProjectiles(before: ProjectileSnapshot[], after: TimedSnapshot, renderTime: number): ProjectileSnapshot[] {
  const timeUntilAfter = after.time - renderTime;
  return after.snapshot.projectiles.map((projectile) => {
    const existedBefore = before.some((previous) => previous.id === projectile.id);
    const rewind = existedBefore ? timeUntilAfter : 0;
    return { ...projectile, x: projectile.x - projectile.vx * rewind, y: projectile.y - projectile.vy * rewind };
  });
}
