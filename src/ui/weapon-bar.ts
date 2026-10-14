import { POWERUP_IDS, WEAPON_IDS, type WeaponId } from '../sim/items';
import { ownsWeapon, type Loadout } from '../sim/loadout';
import { element } from './dom';
import { POWERUP_ICONS, POWERUP_NAMES, WEAPON_NAMES } from './item-names';

/** The weapon slots and active powerups along the bottom of the screen. */
export class WeaponBar {
  private readonly slots = element('weapon-bar');
  private readonly powerups = element('powerup-bar');
  private lastDrawn = '';

  update(loadout: Loadout): void {
    const key = JSON.stringify([loadout.selected, loadout.ammo, roundedPowerups(loadout)]);
    if (key === this.lastDrawn) return;
    this.lastDrawn = key;

    this.slots.replaceChildren(...WEAPON_IDS.map((weapon, index) => slot(loadout, weapon, index + 1)));
    this.powerups.replaceChildren(...activePowerupChips(loadout));
  }
}

function slot(loadout: Loadout, weapon: WeaponId, key: number): HTMLElement {
  const owned = ownsWeapon(loadout, weapon);
  const element = document.createElement('div');
  element.className = ['weapon-slot', owned ? 'owned' : 'empty', loadout.selected === weapon ? 'selected' : '']
    .filter(Boolean)
    .join(' ');

  const keyLabel = document.createElement('span');
  keyLabel.className = 'weapon-key';
  keyLabel.textContent = String(key);
  const name = document.createElement('span');
  name.className = 'weapon-name';
  name.textContent = WEAPON_NAMES[weapon];
  const ammo = document.createElement('span');
  ammo.className = 'weapon-ammo';
  ammo.textContent = weapon === 'cannon' ? '∞' : owned ? String(loadout.ammo[weapon]) : '';

  element.append(keyLabel, name, ammo);
  return element;
}

function activePowerupChips(loadout: Loadout): HTMLElement[] {
  return POWERUP_IDS.filter((powerup) => loadout.powerups[powerup] > 0).map((powerup) => {
    const chip = document.createElement('div');
    chip.className = 'powerup-chip';
    chip.textContent = `${POWERUP_ICONS[powerup]} ${POWERUP_NAMES[powerup]} ${Math.ceil(loadout.powerups[powerup])}s`;
    return chip;
  });
}

function roundedPowerups(loadout: Loadout): number[] {
  return POWERUP_IDS.map((powerup) => Math.ceil(loadout.powerups[powerup]));
}
