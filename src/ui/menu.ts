import { element } from './dom';
import { renderGraphicsToggle } from './graphics-toggle';
import { loadPlayerName, savePlayerName } from './player-name';

export type MenuChoice = { mode: 'host'; name: string } | { mode: 'join'; name: string; code: string };

/** Shows the main menu and resolves once the player picks host or join. */
export function showMenu(prefilledCode: string | null): Promise<MenuChoice> {
  const menu = element<HTMLFormElement>('menu');
  const nameInput = element<HTMLInputElement>('menu-name');
  const codeInput = element<HTMLInputElement>('menu-code');

  nameInput.value = loadPlayerName();
  codeInput.value = prefilledCode ?? '';
  renderGraphicsToggle(element('menu-graphics'));
  menu.hidden = false;
  focusLikelyNextStep(nameInput, prefilledCode !== null);

  return new Promise((resolve) => {
    const finish = (choice: MenuChoice) => {
      savePlayerName(choice.name);
      menu.hidden = true;
      resolve(choice);
    };

    element('menu-host').addEventListener('click', () => {
      if (menu.reportValidity()) finish({ mode: 'host', name: nameInput.value.trim() });
    });

    menu.addEventListener('submit', (event) => {
      event.preventDefault();
      const code = codeInput.value.trim();
      if (!code) {
        codeInput.focus();
        return;
      }
      finish({ mode: 'join', name: nameInput.value.trim(), code });
    });
  });
}

function focusLikelyNextStep(nameInput: HTMLInputElement, hasJoinCode: boolean): void {
  if (!nameInput.value) nameInput.focus();
  else if (hasJoinCode) element('menu-join').focus();
  else element('menu-host').focus();
}
