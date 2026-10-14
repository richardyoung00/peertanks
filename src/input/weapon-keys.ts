import { WEAPON_IDS, type WeaponId } from '../sim/items';
import { nextOwnedWeapon, type Loadout } from '../sim/loadout';

/** Number keys 1–7 pick a weapon directly; the mouse wheel cycles through the ones you have. */
export class WeaponKeys {
  private requestedWeapon: WeaponId | null = null;
  private wheelDirection: 1 | -1 | null = null;

  constructor(wheelTarget: HTMLElement) {
    window.addEventListener('keydown', (event) => {
      const slot = Number(event.code.replace('Digit', ''));
      if (slot >= 1 && slot <= WEAPON_IDS.length) this.requestedWeapon = WEAPON_IDS[slot - 1];
    });
    wheelTarget.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        if (event.deltaY !== 0) this.wheelDirection = event.deltaY > 0 ? 1 : -1;
      },
      { passive: false },
    );
  }

  /** The switch the player asked for since the last call, if any. */
  takeRequest(loadout: Loadout): WeaponId | null {
    const request = this.wheelDirection ? nextOwnedWeapon(loadout, this.wheelDirection) : this.requestedWeapon;
    this.requestedWeapon = null;
    this.wheelDirection = null;
    return request === loadout.selected ? null : request;
  }
}
