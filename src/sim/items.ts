// Weapons and powerups. The order of WEAPON_IDS is also the 1–7 key order.
export const WEAPON_IDS = ['cannon', 'machine-gun', 'bouncy-cannon', 'laser', 'rocket', 'grenade', 'mortar'] as const;
export const POWERUP_IDS = ['shield', 'speed', 'damage-boost', 'dead-mans-switch'] as const;

export type WeaponId = (typeof WEAPON_IDS)[number];
export type PowerupId = (typeof POWERUP_IDS)[number];
/** The cannon is always available, so it's never a pickup. */
export type PickupWeaponId = Exclude<WeaponId, 'cannon'>;
export type ItemId = PickupWeaponId | PowerupId;

export const PICKUP_WEAPON_IDS = WEAPON_IDS.filter((id): id is PickupWeaponId => id !== 'cannon');
export const ITEM_IDS: ItemId[] = [...PICKUP_WEAPON_IDS, ...POWERUP_IDS];

export function isItemId(value: unknown): value is ItemId {
  return ITEM_IDS.includes(value as ItemId);
}

export function isPickupWeapon(item: ItemId): item is PickupWeaponId {
  return (PICKUP_WEAPON_IDS as readonly string[]).includes(item);
}

export function isWeaponId(value: unknown): value is WeaponId {
  return (WEAPON_IDS as readonly unknown[]).includes(value);
}
