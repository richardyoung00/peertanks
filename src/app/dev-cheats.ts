import type { GameWorld } from '../sim/game-world';
import { PICKUP_WEAPON_IDS, POWERUP_IDS } from '../sim/items';
import { activatePowerup, addWeapon } from '../sim/loadout';

/**
 * Testing shortcuts for the host. Only called in local dev builds (`npm run dev`), so the bundler leaves it
 * out of the deployed game.
 * - F8 skips to the end of the current round, or of the results screen
 * - F9 gives the host every weapon with full ammo
 * - F10 turns on every powerup for the host
 */
export function enableDevCheats(currentWorld: () => GameWorld, hostId: string): void {
  window.addEventListener('keydown', (event) => {
    const world = currentWorld();
    const tank = world.tanks.get(hostId);
    if (event.code === 'F8') world.round.timeLeft = Math.min(world.round.timeLeft, 0.5);
    if (!tank) return;
    if (event.code === 'F9') {
      for (const weapon of PICKUP_WEAPON_IDS) {
        addWeapon(tank.loadout, weapon);
        addWeapon(tank.loadout, weapon);
      }
    }
    if (event.code === 'F10') POWERUP_IDS.forEach((powerup) => activatePowerup(tank.loadout, powerup));
  });
}
