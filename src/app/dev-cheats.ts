import { PICKUP_WEAPON_IDS, POWERUP_IDS } from '../sim/items';
import { activatePowerup, addWeapon } from '../sim/loadout';
import type { Tank } from '../sim/tank';

/**
 * Testing shortcuts for the host: F9 gives every weapon with full ammo, F10 turns on every powerup.
 * Only called in local dev builds (`npm run dev`), so the bundler leaves it out of the deployed game.
 */
export function enableDevCheats(tank: Tank): void {
  window.addEventListener('keydown', (event) => {
    if (event.code === 'F9') {
      for (const weapon of PICKUP_WEAPON_IDS) {
        addWeapon(tank.loadout, weapon);
        addWeapon(tank.loadout, weapon);
      }
    }
    if (event.code === 'F10') POWERUP_IDS.forEach((powerup) => activatePowerup(tank.loadout, powerup));
  });
}
