import { GAMEPLAY } from '../gameplay-config';
import { PICKUP_WEAPON_IDS, POWERUP_IDS, WEAPON_IDS, type PickupWeaponId, type PowerupId, type WeaponId } from './items';

/** What a tank is carrying. Owning a pickup weapon means having ammo for it; the cannon is always owned. */
export interface Loadout {
  selected: WeaponId;
  ammo: Record<PickupWeaponId, number>;
  /** Seconds left on each powerup (0 = not active). */
  powerups: Record<PowerupId, number>;
  /** Seconds until each weapon can fire again. Each weapon has its own, so switching doesn't reset it. */
  cooldowns: Record<WeaponId, number>;
  /** Seconds the fire button has been held with the grenade selected. */
  grenadeCharge: number;
  wasFiring: boolean;
}

export function emptyLoadout(): Loadout {
  return {
    selected: 'cannon',
    ammo: Object.fromEntries(PICKUP_WEAPON_IDS.map((id) => [id, 0])) as Record<PickupWeaponId, number>,
    powerups: Object.fromEntries(POWERUP_IDS.map((id) => [id, 0])) as Record<PowerupId, number>,
    cooldowns: Object.fromEntries(WEAPON_IDS.map((id) => [id, 0])) as Record<WeaponId, number>,
    grenadeCharge: 0,
    wasFiring: false,
  };
}

export function ownsWeapon(loadout: Loadout, weapon: WeaponId): boolean {
  return weapon === 'cannon' || loadout.ammo[weapon] > 0;
}

export function ownedWeapons(loadout: Loadout): WeaponId[] {
  return WEAPON_IDS.filter((weapon) => ownsWeapon(loadout, weapon));
}

export function selectWeapon(loadout: Loadout, weapon: WeaponId): void {
  if (!ownsWeapon(loadout, weapon) || weapon === loadout.selected) return;
  loadout.selected = weapon;
  loadout.grenadeCharge = 0;
}

/** The owned weapon after (or before) the selected one, wrapping around. Used for the mouse wheel. */
export function nextOwnedWeapon(loadout: Loadout, direction: 1 | -1): WeaponId {
  const owned = ownedWeapons(loadout);
  const index = owned.indexOf(loadout.selected);
  return owned[(index + direction + owned.length) % owned.length];
}

/** Picking up a weapon tops up its ammo, and switches to it only if it's new. */
export function addWeapon(loadout: Loadout, weapon: PickupWeaponId): void {
  const isNew = loadout.ammo[weapon] === 0;
  const perPickup = GAMEPLAY.weapons[weapon].ammoPerPickup;
  loadout.ammo[weapon] = Math.min(loadout.ammo[weapon] + perPickup, perPickup * GAMEPLAY.pickups.maxAmmoPickups);
  if (isNew) selectWeapon(loadout, weapon);
}

/** Uses one shot of the selected weapon, falling back to the best remaining weapon when it runs dry. */
export function spendAmmo(loadout: Loadout): void {
  if (loadout.selected === 'cannon') return;
  loadout.ammo[loadout.selected]--;
  if (loadout.ammo[loadout.selected] > 0) return;
  const remaining = ownedWeapons(loadout);
  loadout.selected = remaining[remaining.length - 1];
  loadout.grenadeCharge = 0;
}

export function activatePowerup(loadout: Loadout, powerup: PowerupId): void {
  loadout.powerups[powerup] = GAMEPLAY.powerups[powerup].durationSeconds;
}

export function tickPowerups(loadout: Loadout, dt: number): void {
  for (const powerup of POWERUP_IDS) loadout.powerups[powerup] = Math.max(0, loadout.powerups[powerup] - dt);
}

export function tickCooldowns(loadout: Loadout, dt: number): void {
  for (const weapon of WEAPON_IDS) loadout.cooldowns[weapon] = Math.max(0, loadout.cooldowns[weapon] - dt);
}

export function isReady(loadout: Loadout, weapon: WeaponId): boolean {
  return loadout.cooldowns[weapon] === 0;
}

export function startCooldown(loadout: Loadout, weapon: WeaponId): void {
  loadout.cooldowns[weapon] = GAMEPLAY.weapons[weapon].cooldownSeconds;
}

export function clearLoadout(loadout: Loadout): void {
  Object.assign(loadout, emptyLoadout());
}
