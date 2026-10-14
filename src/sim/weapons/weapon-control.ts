import { GAMEPLAY } from '../../gameplay-config';
import type { WeaponId } from '../items';
import { isReady, selectWeapon, spendAmmo, startCooldown, tickCooldowns } from '../loadout';
import type { PlayerInput } from '../player-input';
import type { Tank } from '../tank';
import type { WorldContext } from '../world-context';
import { throwGrenade } from './grenade';
import { fireBouncyCannon, fireCannon, fireMachineGun, fireRocket } from './guns';
import { fireLaser } from './laser';
import { fireMortar } from './mortar';

type FireFunction = (context: WorldContext, tank: Tank, input: PlayerInput) => void;

// The grenade is missing: it fires on release rather than while held (see updateGrenade).
const FIRE: Record<Exclude<WeaponId, 'grenade'>, FireFunction> = {
  cannon: fireCannon,
  'machine-gun': fireMachineGun,
  'bouncy-cannon': fireBouncyCannon,
  laser: fireLaser,
  rocket: fireRocket,
  mortar: (context, tank, input) => fireMortar(context, tank, input.aimDistance),
};

/** Handles weapon switching, cooldowns, ammo and firing for one tank on one tick. */
export function updateWeapon(context: WorldContext, tank: Tank, input: PlayerInput, dt: number): void {
  const loadout = tank.loadout;
  if (input.selectWeapon) selectWeapon(loadout, input.selectWeapon);
  tickCooldowns(loadout, dt);

  if (loadout.selected === 'grenade') updateGrenade(context, tank, input, dt);
  else if (input.firing && isReady(loadout, loadout.selected)) fire(context, tank, input, loadout.selected);

  loadout.wasFiring = input.firing;
}

function fire(context: WorldContext, tank: Tank, input: PlayerInput, weapon: Exclude<WeaponId, 'grenade'>): void {
  FIRE[weapon](context, tank, input);
  startCooldown(tank.loadout, weapon);
  spendAmmo(tank.loadout);
}

/** Holding fire charges the throw; letting go throws it. */
function updateGrenade(context: WorldContext, tank: Tank, input: PlayerInput, dt: number): void {
  const loadout = tank.loadout;
  if (input.firing) {
    if (isReady(loadout, 'grenade')) loadout.grenadeCharge = Math.min(loadout.grenadeCharge + dt, GAMEPLAY.weapons.grenade.maxChargeSeconds);
    return;
  }
  if (!loadout.wasFiring || loadout.grenadeCharge === 0) return;

  throwGrenade(context, tank, loadout.grenadeCharge);
  loadout.grenadeCharge = 0;
  startCooldown(loadout, 'grenade');
  spendAmmo(loadout);
}
