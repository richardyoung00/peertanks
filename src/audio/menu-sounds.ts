import { playButtonPress, playOptionChanged } from './synth-sounds';

/** Buttons that pick an option rather than do something: they get the "changed" blip instead of a click. */
const OPTION_BUTTONS = '.pill, .item-tile, .map-card';

/** One listener for every button on every screen, so new menus get sounds without extra wiring. */
export function enableMenuSounds(): void {
  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest('button');
    if (!button || button.disabled) return;
    if (button.matches(OPTION_BUTTONS)) playOptionChanged();
    else playButtonPress();
  });
}
