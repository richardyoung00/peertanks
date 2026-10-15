import { GAMEPLAY } from '../gameplay-config';
import { wrapAngle } from '../sim/angles';
import type { MapPoint } from '../sim/game-map';
import type { NavGrid } from './nav-grid';

const EIGHTH_TURN = Math.PI / 4;
/** Keep the current key while it's within this angle of where the bot wants to go. */
const KEEP_KEY_ANGLE = (35 * Math.PI) / 180;
/** Where along the look-ahead distance to check for hazards. */
const SAFETY_CHECK_POINTS = [0.35, 0.7, 1];

export interface KeyDirection {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}

const NO_KEYS: KeyDirection = { x: 0, y: 0 };

/**
 * Turns a wanted direction into what a keyboard player could press: one of 8 directions, held for at
 * least a moment. This is what makes bots drive like people rather than gliding smoothly along curves.
 */
export class KeyboardSteering {
  private keys: KeyDirection = NO_KEYS;
  private heldFor = Infinity;

  constructor(private readonly grid: NavGrid) {}

  /**
   * `urgent` skips the minimum hold, for dodging. `lookAhead` is how far ahead (in tiles) it checks
   * for hazards before pressing a key; careless bots look less far.
   */
  steer(wanted: MapPoint | null, position: MapPoint, dt: number, lookAhead: number, urgent = false): KeyDirection {
    this.heldFor += dt;
    // Like a player letting go just before the water's edge, a dangerous key never has to be held.
    const heldLongEnough = this.heldFor >= GAMEPLAY.bots.minKeyHoldSeconds;
    const mayChange = urgent || heldLongEnough || !this.isSafe(this.keys, position, lookAhead);
    if (!mayChange) return this.keys;

    const next = wanted ? this.chooseKeys(wanted, position, lookAhead) : NO_KEYS;
    if (next.x !== this.keys.x || next.y !== this.keys.y) {
      this.keys = next;
      this.heldFor = 0;
    }
    return this.keys;
  }

  private chooseKeys(wanted: MapPoint, position: MapPoint, lookAhead: number): KeyDirection {
    const wantedAngle = Math.atan2(wanted.y, wanted.x);
    const current = this.keys;
    const holdingKeys = current.x !== 0 || current.y !== 0;
    if (holdingKeys && angleBetween(keyAngle(current), wantedAngle) <= KEEP_KEY_ANGLE && this.isSafe(current, position, lookAhead)) {
      return current;
    }

    // Try the nearest of the 8 directions first, then the ones either side of it.
    const nearest = Math.round(wantedAngle / EIGHTH_TURN);
    for (const offset of [0, 1, -1, 2, -2]) {
      const keys = keysForAngle((nearest + offset) * EIGHTH_TURN);
      if (this.isSafe(keys, position, lookAhead)) return keys;
    }
    return NO_KEYS;
  }

  /** Checks the tank's whole width along the way, so it doesn't clip the corner of a pond. */
  private isSafe(keys: KeyDirection, position: MapPoint, lookAhead: number): boolean {
    const length = Math.hypot(keys.x, keys.y);
    if (length === 0) return true;
    const forwardX = keys.x / length;
    const forwardY = keys.y / length;
    const sideX = -forwardY * GAMEPLAY.tank.radius;
    const sideY = forwardX * GAMEPLAY.tank.radius;
    for (const share of SAFETY_CHECK_POINTS) {
      const aheadX = position.x + forwardX * lookAhead * share;
      const aheadY = position.y + forwardY * lookAhead * share;
      const blocked = [0, 1, -1].some((side) => this.grid.isHazardAt(aheadX + sideX * side, aheadY + sideY * side));
      if (blocked) return false;
    }
    return true;
  }
}

/** Only called with multiples of 45°, so rounding gives exactly -1, 0 or 1. */
function keysForAngle(angle: number): KeyDirection {
  return { x: Math.round(Math.cos(angle)) as KeyDirection['x'], y: Math.round(Math.sin(angle)) as KeyDirection['y'] };
}

function keyAngle(keys: KeyDirection): number {
  return Math.atan2(keys.y, keys.x);
}

function angleBetween(a: number, b: number): number {
  return Math.abs(wrapAngle(a - b));
}
