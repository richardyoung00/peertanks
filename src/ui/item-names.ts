import type { PowerupId, WeaponId } from '../sim/items';

export const WEAPON_NAMES: Record<WeaponId, string> = {
  cannon: 'Cannon',
  'machine-gun': 'Machine gun',
  'bouncy-cannon': 'Bouncy cannon',
  laser: 'Laser',
  rocket: 'Rocket',
  grenade: 'Grenade',
  mortar: 'Mortar',
};

export const POWERUP_NAMES: Record<PowerupId, string> = {
  shield: 'Shield',
  speed: 'Speed',
  'damage-boost': 'Damage boost',
  'dead-mans-switch': "Dead man's switch",
};

export const POWERUP_ICONS: Record<PowerupId, string> = {
  shield: '🛡️',
  speed: '⚡',
  'damage-boost': '💥',
  'dead-mans-switch': '☠️',
};
