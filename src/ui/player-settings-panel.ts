import { playAnnouncerSample } from '../audio/announcer-lines';
import { playSoundEffect } from '../audio/sound-effects';
import { playOptionChanged } from '../audio/synth-sounds';
import { VOLUMES } from '../audio/volume-settings';
import { weaponAutoSwitch } from '../settings/weapon-auto-switch';
import { element } from './dom';
import { renderGraphicsToggle } from './graphics-toggle';
import { renderPillChoice } from './pill-choice';
import { createVolumeSlider } from './volume-slider';

let listeningForEscape = false;

/** Opens the player's own settings (graphics, audio, gameplay) on top of whatever screen is showing. */
export function openPlayerSettings(): void {
  renderGraphicsToggle(element('player-settings-graphics'));
  renderAudioSection(element('player-settings-audio'));
  renderPillChoice(
    element('player-settings-auto-switch'),
    [
      { value: true, label: 'On' },
      { value: false, label: 'Off' },
    ],
    weaponAutoSwitch.get(),
    (on) => weaponAutoSwitch.set(on),
  );
  element('player-settings-done').onclick = closePlayerSettings;
  listenForEscape();
  element('player-settings').hidden = false;
  element('player-settings-done').focus();
}

export function closePlayerSettings(): void {
  element('player-settings').hidden = true;
}

function isOpen(): boolean {
  return !element('player-settings').hidden;
}

function renderAudioSection(container: HTMLElement): void {
  // Letting go of a slider plays a sample on that channel, so the new level can be heard straight away.
  container.replaceChildren(
    createVolumeSlider('Master', VOLUMES.master, () => playOptionChanged('menus')),
    createVolumeSlider('Effects', VOLUMES.effects, () => playSoundEffect('cannon')),
    createVolumeSlider('Announcer', VOLUMES.announcer, () => playAnnouncerSample()),
    createVolumeSlider('Menus', VOLUMES.menus, () => playOptionChanged('menus')),
  );
}

/** Esc closes this panel first, without also toggling the in-game menu underneath. */
function listenForEscape(): void {
  if (listeningForEscape) return;
  listeningForEscape = true;
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.code !== 'Escape' || !isOpen()) return;
      event.stopImmediatePropagation();
      closePlayerSettings();
    },
    { capture: true },
  );
}
