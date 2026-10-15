import RAPIER from '@dimforge/rapier2d-compat';
import { NETWORK, SIM_DT } from '../config';
import { GAMEPLAY } from '../gameplay-config';
import type { ProjectileViewState } from '../render/view-state';
import type { Point } from '../sim/game-events';
import type { WeaponId } from '../sim/items';
import { COVER_QUERY_GROUPS } from '../sim/physics';
import type { ProjectileKind } from '../sim/projectiles';
import type { ProjectileSnapshot } from './packets';

const DEGREES = Math.PI / 180;
const MUZZLE_HEIGHT = 0.42;
const SURFACE_OFFSET = 0.02;
const ROCKET_BACK_OFF = 0.1;
/** A real shot only pairs with a predicted one fired at most this long ago. */
const PAIRING_WINDOW_SECONDS = 1.5;
/** How long a real shot's id is remembered after it's gone, so it isn't paired twice. */
const FORGET_SECONDS = 2;
/** A rocket stuck on a wall gives up waiting for the host's explosion after this long. */
const STUCK_ROCKET_TIMEOUT = 1;

interface ShotSettings {
  kind: ProjectileKind;
  speed: number;
  lifetime: number;
  bounces: number;
  spreadDegrees: number;
}

const weapons = GAMEPLAY.weapons;

/** Fast straight shots get predicted. Lobbed ones (grenades, mortars) are slow enough to leave to the host. */
const PREDICTED: Partial<Record<WeaponId, ShotSettings>> = {
  cannon: { kind: 'shell', speed: weapons.cannon.speed, lifetime: weapons.cannon.lifetimeSeconds, bounces: 0, spreadDegrees: 0 },
  'machine-gun': {
    kind: 'bullet',
    speed: weapons['machine-gun'].speed,
    lifetime: weapons['machine-gun'].lifetimeSeconds,
    bounces: 0,
    spreadDegrees: weapons['machine-gun'].spreadDegrees,
  },
  'bouncy-cannon': {
    kind: 'bouncy',
    speed: weapons['bouncy-cannon'].speed,
    lifetime: weapons['bouncy-cannon'].lifetimeSeconds,
    bounces: weapons['bouncy-cannon'].bounces,
    spreadDegrees: 0,
  },
  rocket: { kind: 'rocket', speed: weapons.rocket.speed, lifetime: weapons.rocket.lifetimeSeconds, bounces: 0, spreadDegrees: 0 },
};
const PREDICTED_KINDS = new Set(Object.values(PREDICTED).map((settings) => settings.kind));

interface PredictedShot {
  viewId: number;
  kind: ProjectileKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
  bouncesLeft: number;
  /** The host's matching projectile, once it has turned up. */
  realId: number | null;
  /** The host's copy has been and gone. */
  realGone: boolean;
  /**
   * Flying, stuck (a rocket waiting at a wall for the host's explosion), or done. Done shots are kept, unseen,
   * for a while so the host's late copy of a shot that already hit a wall still gets paired and hidden.
   */
  state: 'flying' | 'stuck' | 'done';
  /** Seconds left before a stuck rocket gives up waiting, or since a shot was done. */
  timer: number;
}

/**
 * Our own shots, drawn the moment we fire instead of a round trip later. They bounce off and stop at walls
 * locally (the walls are the same everywhere), but fly straight through tanks: only the host decides hits,
 * so a predicted shot vanishes when the host's copy of it does. The host's copies of our shots are hidden.
 */
export class PredictedShots {
  private shots: PredictedShot[] = [];
  private nextViewId = -1;
  /** Real projectile ids we've already seen, and when we last saw them. */
  private readonly seenRealIds = new Map<number, number>();
  /** Our real shots that had no prediction to pair with, so they're drawn from the host as usual. */
  private readonly unpredictedIds = new Set<number>();
  private clock = 0;

  constructor(private readonly physics: RAPIER.World) {}

  /** Starts a predicted shot. Returns where it bursts instead if the barrel is pressed against a wall. */
  fire(weapon: WeaponId, tank: { x: number; y: number }, aimAngle: number): Point | null {
    const settings = PREDICTED[weapon];
    if (!settings) return null;
    const angle = aimAngle + (Math.random() - 0.5) * settings.spreadDegrees * DEGREES;
    const blocked = this.castToTerrain(tank, { x: Math.cos(angle), y: Math.sin(angle) }, GAMEPLAY.tank.barrelLength);
    // A rocket blocked at the barrel blows up in the host's world; that explosion comes from the host.
    if (blocked) return settings.kind === 'rocket' ? null : blocked.point;

    const x = tank.x + Math.cos(angle) * GAMEPLAY.tank.barrelLength;
    const y = tank.y + Math.sin(angle) * GAMEPLAY.tank.barrelLength;
    this.shots.push({
      viewId: this.nextViewId--,
      kind: settings.kind,
      x,
      y,
      prevX: x,
      prevY: y,
      vx: Math.cos(angle) * settings.speed,
      vy: Math.sin(angle) * settings.speed,
      age: 0,
      lifetime: settings.lifetime,
      bouncesLeft: settings.bounces,
      realId: null,
      realGone: false,
      state: 'flying',
      timer: 0,
    });
    return null;
  }

  /** Moves every shot one tick. Returns where shots hit walls, for impact puffs. */
  step(): Point[] {
    this.clock += SIM_DT;
    const impacts: Point[] = [];
    for (const shot of this.shots) {
      shot.prevX = shot.x;
      shot.prevY = shot.y;
      shot.age += SIM_DT;
      if (shot.state === 'flying') this.move(shot, impacts);
      else if (shot.state === 'stuck') this.waitForExplosion(shot);
      else shot.timer += SIM_DT;
    }
    this.shots = this.shots.filter((shot) => shot.state !== 'done' || shot.timer < PAIRING_WINDOW_SECONDS);
    return impacts;
  }

  /** Pairs new real shots of ours with predicted ones, and retires predicted shots whose real copy has gone. */
  reconcile(projectiles: ProjectileSnapshot[], ownNetId: number): void {
    const ours = projectiles.filter((projectile) => projectile.ownerNetId === ownNetId && isPredictedKind(projectile.kind));
    const present = new Set(ours.map((projectile) => projectile.id));
    for (const projectile of ours) {
      if (!this.seenRealIds.has(projectile.id)) this.pair(projectile);
      this.seenRealIds.set(projectile.id, this.clock);
    }
    for (const shot of this.shots) {
      if (shot.realId !== null && !shot.realGone && !present.has(shot.realId)) this.realCopyGone(shot);
    }
    this.forgetOldIds();
  }

  /** Whether the host's copy of a shot should be hidden because our prediction is drawn instead. */
  hides(projectile: ProjectileSnapshot, ownNetId: number): boolean {
    return projectile.ownerNetId === ownNetId && isPredictedKind(projectile.kind) && !this.unpredictedIds.has(projectile.id);
  }

  views(alpha: number): ProjectileViewState[] {
    return this.shots
      .filter((shot) => shot.state !== 'done')
      .map((shot) => ({
        id: shot.viewId,
        kind: shot.kind,
        x: shot.prevX + (shot.x - shot.prevX) * alpha,
        y: shot.prevY + (shot.y - shot.prevY) * alpha,
        height: MUZZLE_HEIGHT,
        angle: Math.atan2(shot.vy, shot.vx),
      }));
  }

  private move(shot: PredictedShot, impacts: Point[]): void {
    const hit = this.castToTerrain(shot, { x: shot.vx, y: shot.vy }, SIM_DT);
    if (!hit) {
      shot.x += shot.vx * SIM_DT;
      shot.y += shot.vy * SIM_DT;
      if (shot.age >= shot.lifetime) this.stopAt(shot, shot.x, shot.y);
      return;
    }
    if (shot.kind === 'bouncy' && shot.bouncesLeft > 0) {
      this.bounce(shot, hit);
      impacts.push(hit.point);
      return;
    }
    if (shot.kind !== 'rocket') impacts.push(hit.point);
    const speed = Math.hypot(shot.vx, shot.vy);
    this.stopAt(shot, hit.point.x - (shot.vx / speed) * ROCKET_BACK_OFF, hit.point.y - (shot.vy / speed) * ROCKET_BACK_OFF);
  }

  /** Shells vanish at once; a rocket stays put, burning, until the host's explosion arrives. */
  private stopAt(shot: PredictedShot, x: number, y: number): void {
    shot.x = shot.prevX = x;
    shot.y = shot.prevY = y;
    if (shot.kind === 'rocket' && !shot.realGone) {
      shot.state = 'stuck';
      shot.timer = STUCK_ROCKET_TIMEOUT;
    } else {
      this.done(shot);
    }
  }

  private waitForExplosion(shot: PredictedShot): void {
    shot.timer -= SIM_DT;
    if (shot.timer <= 0) this.done(shot);
  }

  private done(shot: PredictedShot): void {
    shot.state = 'done';
    shot.timer = 0;
  }

  private bounce(shot: PredictedShot, hit: { point: Point; normal: Point }): void {
    const along = shot.vx * hit.normal.x + shot.vy * hit.normal.y;
    shot.vx -= 2 * along * hit.normal.x;
    shot.vy -= 2 * along * hit.normal.y;
    shot.x = hit.point.x + hit.normal.x * SURFACE_OFFSET;
    shot.y = hit.point.y + hit.normal.y * SURFACE_OFFSET;
    shot.bouncesLeft--;
  }

  /**
   * The host's copy has gone: it hit a tank, a wall or burnt out. A flying shot vanishes; a rocket stuck at a
   * wall holds on until the host's explosion, which is drawn slightly in the past, is due on screen.
   */
  private realCopyGone(shot: PredictedShot): void {
    shot.realGone = true;
    if (shot.state === 'flying') this.done(shot);
    else if (shot.state === 'stuck') shot.timer = Math.min(shot.timer, NETWORK.interpolationDelay);
  }

  private pair(projectile: ProjectileSnapshot): void {
    const match = this.shots.find((shot) => shot.realId === null && shot.kind === projectile.kind && shot.age < PAIRING_WINDOW_SECONDS);
    if (match) match.realId = projectile.id;
    else this.unpredictedIds.add(projectile.id);
  }

  private forgetOldIds(): void {
    for (const [id, lastSeen] of this.seenRealIds) {
      if (this.clock - lastSeen < FORGET_SECONDS) continue;
      this.seenRealIds.delete(id);
      this.unpredictedIds.delete(id);
    }
  }

  /** Where a path runs into a wall, rock or tree, ignoring tanks. `direction` scaled by `reach` is the path. */
  private castToTerrain(from: Point, direction: Point, reach: number): { point: Point; normal: Point } | null {
    const ray = new RAPIER.Ray(from, direction);
    const hit = this.physics.castRayAndGetNormal(ray, reach, true, undefined, COVER_QUERY_GROUPS);
    if (!hit) return null;
    return { point: ray.pointAt(hit.timeOfImpact), normal: hit.normal };
  }
}

function isPredictedKind(kind: ProjectileKind): boolean {
  return PREDICTED_KINDS.has(kind);
}
