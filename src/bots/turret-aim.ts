import { wrapAngle } from '../sim/angles';
import type { BotPersonality } from './personality';

const DEGREES = Math.PI / 180;
/** How quickly the aim wobble wanders; higher means a jumpier wobble. */
const WOBBLE_RATE = 1.6;
/** A freshly picked target starts with this much extra error, which fades as the bot keeps tracking it. */
const FRESH_TARGET_ERROR = 1.5;
const FOCUS_SECONDS = 0.9;
/** Extra error at full speed, for both the bot's own movement and the target crossing its view. */
const MOVING_ERROR = 0.6;
const CROSSING_ERROR_PER_RADIAN_PER_SECOND = 0.5;

/**
 * Moves the turret the way a person moves a mouse. It swings towards the aim point like a spring,
 * overshooting a little if the bot is rushed, and carries an error that drifts slowly rather than
 * jittering. The error is biggest on a new target and shrinks the longer the bot tracks it.
 */
export class TurretAim {
  angle = 0;
  private turnSpeed = 0;
  /** A slowly wandering value around 0, scaled into the aim error. */
  private wobble = 0;
  private trackedFor = 0;
  private lastAimAngle = 0;

  constructor(
    private readonly personality: BotPersonality,
    private readonly random: () => number,
  ) {}

  /** Starts the focus over, e.g. when switching to a new target. */
  newTarget(): void {
    this.trackedFor = 0;
  }

  /**
   * Turns towards `aimAngle`. `ownSpeedShare` is how fast the bot itself is driving (0–1).
   * Returns the angle to send as input.
   */
  update(aimAngle: number, ownSpeedShare: number, dt: number): number {
    this.trackedFor += dt;
    const crossingSpeed = Math.abs(wrapAngle(aimAngle - this.lastAimAngle)) / dt;
    this.lastAimAngle = aimAngle;
    this.updateWobble(dt);

    const target = aimAngle + this.wobble * this.errorSize(ownSpeedShare, crossingSpeed);
    this.swingTowards(target, dt);
    return this.angle;
  }

  private errorSize(ownSpeedShare: number, crossingSpeed: number): number {
    const freshness = FRESH_TARGET_ERROR * Math.exp(-this.trackedFor / FOCUS_SECONDS);
    // A sudden jump in aim point (a new target) isn't "crossing", so cap how much it counts.
    const crossing = Math.min(crossingSpeed, 3) * CROSSING_ERROR_PER_RADIAN_PER_SECOND;
    const scale = 1 + freshness + ownSpeedShare * MOVING_ERROR + crossing;
    return this.personality.aimErrorDegrees * DEGREES * scale;
  }

  /** A random walk pulled back towards 0, so it stays around ±1 and changes smoothly. */
  private updateWobble(dt: number): void {
    const kick = (this.random() * 2 - 1) * Math.sqrt(3);
    this.wobble += -WOBBLE_RATE * this.wobble * dt + Math.sqrt(2 * WOBBLE_RATE * dt) * kick;
  }

  /** A damped spring: low damping swings past the target and comes back, like a hurried flick. */
  private swingTowards(target: number, dt: number): void {
    const damping = this.personality.aimDamping;
    const stiffness = 4 / (damping * this.personality.aimSettleSeconds);
    const offset = wrapAngle(target - this.angle);
    this.turnSpeed += (stiffness * stiffness * offset - 2 * damping * stiffness * this.turnSpeed) * dt;
    this.angle = wrapAngle(this.angle + this.turnSpeed * dt);
  }
}
