import { GAMEPLAY } from '../gameplay-config';
import type { WeaponId } from '../sim/items';
import { ownedWeapons, type Loadout } from '../sim/loadout';
import type { BotPersonality } from './personality';
import { GRENADE_MAX_DISTANCE } from './shooting';

const weapons = GAMEPLAY.weapons;
const MACHINE_GUN_RANGE = weapons['machine-gun'].speed * weapons['machine-gun'].lifetimeSeconds * 0.6;

export interface ShotSituation {
  distance: number;
  /** A straight shot would reach the target. */
  lineOfFire: boolean;
  /** A bounce shot was found for the bouncy cannon or laser. */
  bankShot: boolean;
}

/** The owned weapon that suits the situation best, or null if none can usefully reach the target. */
export function chooseWeapon(loadout: Loadout, situation: ShotSituation, personality: BotPersonality): WeaponId | null {
  let best: WeaponId | null = null;
  let bestScore = 0;
  for (const weapon of ownedWeapons(loadout)) {
    const score = weaponScore(weapon, situation, personality);
    if (score > bestScore) {
      best = weapon;
      bestScore = score;
    }
  }
  return best;
}

/** Rough scores from 0 (useless here) to 1 (ideal). */
function weaponScore(weapon: WeaponId, { distance, lineOfFire, bankShot }: ShotSituation, personality: BotPersonality): number {
  const trickShots = personality.trickShots;
  switch (weapon) {
    case 'cannon':
      return lineOfFire ? 0.4 : 0;
    case 'machine-gun':
      if (!lineOfFire) return 0;
      return distance < MACHINE_GUN_RANGE ? 0.75 : 0.3;
    case 'bouncy-cannon':
      if (lineOfFire) return 0.6;
      return bankShot ? 0.4 + 0.4 * trickShots : 0;
    case 'laser':
      if (distance > weapons.laser.range) return 0;
      if (lineOfFire) return 0.9;
      return bankShot ? 0.5 + 0.4 * trickShots : 0;
    case 'rocket':
      if (!lineOfFire) return 0;
      return distance > safeRocketDistance(personality) ? 0.85 : 0.05;
    case 'grenade':
      if (distance < 2 || distance > GRENADE_MAX_DISTANCE) return 0;
      return lineOfFire ? 0.3 : 0.15 + 0.6 * trickShots;
    case 'mortar':
      if (distance < weapons.mortar.minRange + 1 || distance > weapons.mortar.maxRange) return 0;
      return lineOfFire ? 0.45 : 0.3 + 0.6 * trickShots;
  }
}

/** Careless bots fire rockets at close range and catch themselves in the blast. */
export function safeRocketDistance(personality: BotPersonality): number {
  return weapons.rocket.explosion.outerRadius * (0.5 + personality.hazardAwareness);
}
