import type { StoredSetting } from '../settings/stored-setting';

/** A labelled 0–100% slider that saves its volume as it moves, and plays `preview` when let go. */
export function createVolumeSlider(label: string, setting: StoredSetting<number>, preview: () => void): HTMLElement {
  const row = document.createElement('label');
  row.className = 'volume-row';

  const name = document.createElement('span');
  name.className = 'volume-name';
  name.textContent = label;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'volume-slider';
  slider.min = '0';
  slider.max = '100';
  slider.step = '5';

  const readout = document.createElement('span');
  readout.className = 'volume-readout';

  const show = (volume: number) => {
    slider.value = String(volume);
    slider.style.setProperty('--fill', String(volume / 100));
    readout.textContent = `${volume}%`;
  };
  show(setting.get());
  slider.oninput = () => {
    setting.set(Number(slider.value));
    show(setting.get());
  };
  slider.onchange = preview;

  row.append(name, slider, readout);
  return row;
}
