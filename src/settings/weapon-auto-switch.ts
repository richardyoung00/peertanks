import { StoredSetting } from './stored-setting';

/** Whether picking up a new weapon switches to it straight away. On unless the player turned it off. */
export const weaponAutoSwitch = new StoredSetting<boolean>('tanks.autoSwitch', (stored) => stored !== 'false');
