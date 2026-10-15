interface Control {
  keys: string[];
  action: string;
}

const CONTROLS: Control[] = [
  { keys: ['W', 'A', 'S', 'D'], action: 'Drive (or arrow keys)' },
  { keys: ['Mouse'], action: 'Aim' },
  { keys: ['Click'], action: 'Fire' },
  { keys: ['Hold'], action: 'Charge a grenade throw' },
  { keys: ['1–7'], action: 'Pick a weapon (or mouse wheel)' },
  { keys: ['Esc'], action: 'Menu' },
];

/** How to play, drawn as keycaps. Shown in the lobby and the in-game menu. */
export function renderControlsGuide(container: HTMLElement): void {
  container.replaceChildren(
    ...CONTROLS.map((control) => {
      const row = document.createElement('div');
      row.className = 'control';
      const keys = document.createElement('span');
      keys.className = 'control-keys';
      for (const key of control.keys) {
        const cap = document.createElement('kbd');
        cap.textContent = key;
        keys.appendChild(cap);
      }
      const action = document.createElement('span');
      action.textContent = control.action;
      row.append(keys, action);
      return row;
    }),
  );
}
