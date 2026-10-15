import { GAMEPLAY } from '../gameplay-config';
import { isPickupWeapon, type PowerupId } from '../sim/items';
import type { Loadout } from '../sim/loadout';
import type { SpotBelief } from './perception';

const POWERUP_VALUES: Record<PowerupId, number> = {
  shield: 0.75,
  speed: 0.45,
  'damage-boost': 0.65,
  'dead-mans-switch': 0.5,
};
const UNKNOWN_VALUE = 0.4;

/** How much a bot wants what it believes is at a spot (0–1). Hurt bots want shields more. */
export function pickupValue(belief: SpotBelief, loadout: Loadout, healthShare: number): number {
  if (belief === null) return 0;
  if (belief === 'unknown') return UNKNOWN_VALUE;
  if (isPickupWeapon(belief)) {
    const ammo = loadout.ammo[belief];
    const cap = GAMEPLAY.weapons[belief].ammoPerPickup * GAMEPLAY.pickups.maxAmmoPickups;
    if (ammo === 0) return 0.9;
    return ammo < cap ? 0.3 : 0;
  }
  const active = loadout.powerups[belief] > 0;
  const hurtBonus = belief === 'shield' ? (1 - healthShare) * 0.25 : 0;
  return (POWERUP_VALUES[belief] + hurtBonus) * (active ? 0.4 : 1);
}
