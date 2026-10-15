import type RAPIER from '@dimforge/rapier2d-compat';
import { GAMEPLAY } from '../gameplay-config';
import { wrapAngle } from '../sim/angles';
import type { MapPoint } from '../sim/game-map';
import type { WeaponId } from '../sim/items';
import { isReady, ownsWeapon, type Loadout } from '../sim/loadout';
import { findBankShot, type BankShot } from './bank-shot';
import type { KnownEnemy } from './perception';
import type { BotPersonality } from './personality';
import { aimTolerance, grenadeHoldSeconds, hasLineOfFire, leadPoint } from './shooting';
import { TurretAim } from './turret-aim';
import { chooseWeapon, safeRocketDistance } from './weapon-choice';

const BANK_SHOT_SEARCH_SECONDS = 0.5;
const BANK_SHOT_BOUNCES = 2;
/** How much each shot's lead can be off from the bot's usual, as a share. */
const LEAD_VARIATION = 0.3;
/** Chance per second that a trigger-happy bot fires at an enemy it can't actually hit. */
const WASTED_SHOTS_PER_SECOND = 0.6;
const WASTED_SHOT_SECONDS = 0.4;

export interface GunnerContext {
  position: MapPoint;
  loadout: Loadout;
  physics: RAPIER.World;
  target: KnownEnemy | null;
  /** Where the bot is heading, so it can look that way when there's nothing to shoot. */
  travelDirection: MapPoint | null;
  ownSpeedShare: number;
  now: number;
}

export interface GunnerOutput {
  aimAngle: number;
  aimDistance: number;
  firing: boolean;
}

/** Picks the weapon, aims the turret like a person would and decides when to pull the trigger. */
export class BotGunner {
  private readonly turret: TurretAim;
  private targetId: string | null = null;
  private wantedWeapon: WeaponId | null = null;
  private lineOfFire = false;
  private bankShot: (BankShot & { weapon: WeaponId }) | null = null;
  private lastBankSearchAt = -Infinity;
  private leadShare: number;
  private grenadeHoldLeft: number | null = null;
  private wastingShotsUntil = 0;
  private holdFireOnProtected = false;

  constructor(
    private readonly personality: BotPersonality,
    private readonly random: () => number,
  ) {
    this.turret = new TurretAim(personality, random);
    this.leadShare = this.rollLeadShare();
  }

  /** Whether the chosen weapon can reach the current target from here. */
  get canHitTarget(): boolean {
    return this.wantedWeapon !== null;
  }

  reset(): void {
    this.targetId = null;
    this.wantedWeapon = null;
    this.bankShot = null;
    this.grenadeHoldLeft = null;
  }

  /** Called whenever the bot rethinks. Returns a weapon to switch to, if it wants a different one. */
  think(context: GunnerContext, thinkSeconds: number): WeaponId | null {
    const { target, loadout } = context;
    if (target?.id !== this.targetId) {
      this.targetId = target?.id ?? null;
      this.turret.newTarget();
      this.bankShot = null;
    }
    if (!target) {
      this.wantedWeapon = null;
      return null;
    }

    const distance = Math.hypot(target.x - context.position.x, target.y - context.position.y);
    this.lineOfFire = target.visible && hasLineOfFire(context.physics, context.position, target);
    this.updateBankShot(context);
    this.wantedWeapon = chooseWeapon(loadout, { distance, lineOfFire: this.lineOfFire, bankShot: this.bankShot !== null }, this.personality);

    const sloppiness = 1 - this.personality.triggerDiscipline;
    if (this.random() < WASTED_SHOTS_PER_SECOND * thinkSeconds * sloppiness) this.wastingShotsUntil = context.now + WASTED_SHOT_SECONDS;
    this.holdFireOnProtected = this.random() < this.personality.triggerDiscipline;

    const switching = this.wantedWeapon && this.wantedWeapon !== loadout.selected && this.grenadeHoldLeft === null;
    return switching ? this.wantedWeapon : null;
  }

  /** Called every tick. */
  aim(context: GunnerContext, dt: number): GunnerOutput {
    const aimPoint = this.aimPoint(context);
    const wantedAngle = aimPoint ? angleTo(context.position, aimPoint) : this.idleAngle(context);
    const turretAngle = this.turret.update(wantedAngle, context.ownSpeedShare, dt);
    const aimDistance = aimPoint ? Math.hypot(aimPoint.x - context.position.x, aimPoint.y - context.position.y) : 0;
    const lined = Math.abs(wrapAngle(turretAngle - wantedAngle)) < aimTolerance(context.loadout.selected, aimDistance, this.personality.triggerDiscipline);
    const firing = this.trigger(context, lined, aimDistance, dt);
    return { aimAngle: turretAngle, aimDistance, firing };
  }

  private aimPoint(context: GunnerContext): MapPoint | null {
    const target = context.target;
    if (!target) return null;
    const weapon = context.loadout.selected;
    if (this.bankShot && !this.lineOfFire && this.bankShot.weapon === weapon) {
      const reach = this.bankShot.pathLength;
      return { x: context.position.x + Math.cos(this.bankShot.angle) * reach, y: context.position.y + Math.sin(this.bankShot.angle) * reach };
    }
    const moving = target.visible ? target : { ...target, vx: 0, vy: 0 };
    return leadPoint(context.position, moving, weapon, this.leadShare);
  }

  /** With nothing to shoot at, a player tends to point where they're driving. */
  private idleAngle(context: GunnerContext): number {
    const direction = context.travelDirection;
    return direction ? Math.atan2(direction.y, direction.x) : this.turret.angle;
  }

  private trigger(context: GunnerContext, lined: boolean, aimDistance: number, dt: number): boolean {
    const { target, loadout } = context;
    const weapon = loadout.selected;
    if (!target || !lined) return this.keepChargingGrenade(weapon, dt);

    const usableWeapon = this.wantedWeapon === weapon;
    const wasting = context.now < this.wastingShotsUntil;
    if (!usableWeapon && !wasting) return this.keepChargingGrenade(weapon, dt);
    if (target.invulnerable && this.holdFireOnProtected) return false;
    if (weapon === 'rocket' && aimDistance < safeRocketDistance(this.personality)) return false;

    if (weapon === 'grenade') return this.chargeGrenade(loadout, aimDistance, dt);
    this.leadShare = this.rollLeadShare();
    return true;
  }

  /** Holds fire for long enough to throw the right distance, then lets go. */
  private chargeGrenade(loadout: Loadout, distance: number, dt: number): boolean {
    if (this.grenadeHoldLeft === null) {
      if (!isReady(loadout, 'grenade')) return false;
      this.grenadeHoldLeft = grenadeHoldSeconds(distance);
    }
    return this.keepChargingGrenade('grenade', dt);
  }

  private keepChargingGrenade(weapon: WeaponId, dt: number): boolean {
    if (weapon !== 'grenade' || this.grenadeHoldLeft === null) return false;
    this.grenadeHoldLeft -= dt;
    if (this.grenadeHoldLeft > 0) return true;
    this.grenadeHoldLeft = null;
    return false;
  }

  /** Trick shots: only worth looking for when there's no straight shot, and only by bots that like them. */
  private updateBankShot(context: GunnerContext): void {
    const { target, loadout, now } = context;
    if (this.lineOfFire || !target?.visible) {
      this.bankShot = null;
      return;
    }
    if (now - this.lastBankSearchAt < BANK_SHOT_SEARCH_SECONDS) return;
    this.lastBankSearchAt = now;
    this.bankShot = null;
    if (this.random() >= this.personality.trickShots) return;

    const weapon: WeaponId | null = ownsWeapon(loadout, 'laser') ? 'laser' : ownsWeapon(loadout, 'bouncy-cannon') ? 'bouncy-cannon' : null;
    if (!weapon) return;
    const range = weapon === 'laser' ? GAMEPLAY.weapons.laser.range : bouncyRange();
    const shot = findBankShot(context.physics, context.position, target, BANK_SHOT_BOUNCES, range);
    if (shot) this.bankShot = { ...shot, weapon };
  }

  private rollLeadShare(): number {
    return this.personality.leadSkill * (1 + (this.random() * 2 - 1) * LEAD_VARIATION);
  }
}

function bouncyRange(): number {
  const config = GAMEPLAY.weapons['bouncy-cannon'];
  return config.speed * config.lifetimeSeconds;
}

function angleTo(from: MapPoint, to: MapPoint): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}
