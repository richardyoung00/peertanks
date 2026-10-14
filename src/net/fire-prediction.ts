import { SIM_DT } from '../config';
import { GAMEPLAY } from '../gameplay-config';
import type { WeaponId } from '../sim/items';
import { isReady, startCooldown, tickCooldowns, type Loadout } from '../sim/loadout';
import type { PlayerInput } from '../sim/player-input';

/**
 * Guesses locally when the host will fire our weapon, so recoil, muzzle flash and the grenade charge meter
 * respond instantly. The host still decides what the shot actually does. Uses the same per-weapon cooldowns
 * as the host; they live only in our predicted loadout, since snapshots don't carry them.
 */
export class FirePrediction {
  /** Returns the weapon fired this tick, if any. */
  predict(loadout: Loadout, input: PlayerInput): WeaponId | null {
    tickCooldowns(loadout, SIM_DT);
    const fired = loadout.selected === 'grenade' ? predictGrenade(loadout, input) : predictTrigger(loadout, input);
    loadout.wasFiring = input.firing;
    return fired;
  }
}

function predictTrigger(loadout: Loadout, input: PlayerInput): WeaponId | null {
  if (!input.firing || !isReady(loadout, loadout.selected)) return null;
  startCooldown(loadout, loadout.selected);
  return loadout.selected;
}

function predictGrenade(loadout: Loadout, input: PlayerInput): WeaponId | null {
  if (input.firing) {
    if (isReady(loadout, 'grenade')) {
      loadout.grenadeCharge = Math.min(loadout.grenadeCharge + SIM_DT, GAMEPLAY.weapons.grenade.maxChargeSeconds);
    }
    return null;
  }
  if (!loadout.wasFiring || loadout.grenadeCharge === 0) return null;
  loadout.grenadeCharge = 0;
  startCooldown(loadout, 'grenade');
  return 'grenade';
}
