import { BOT_LEVEL_NAMES, BOT_LEVELS, type BotLevel } from '../bots/bot-level';

export interface AddBotOptions {
  /** No more players fit, so the buttons are disabled. */
  full: boolean;
  onAdd(level: BotLevel): void;
}

/** A row of Easy / Medium / Hard buttons under the player list, for the host only. */
export function renderAddBotButtons(container: HTMLElement, options: AddBotOptions | null): void {
  container.hidden = !options;
  if (!options) return;

  const label = document.createElement('span');
  label.className = 'add-bots-label';
  label.textContent = options.full ? 'Game full' : 'Add bot';
  const buttons = BOT_LEVELS.map((level) => addButton(level, options));
  container.replaceChildren(label, ...buttons);
}

function addButton(level: BotLevel, options: AddBotOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pill bot-level-${level}`;
  button.textContent = BOT_LEVEL_NAMES[level];
  button.disabled = options.full;
  button.onclick = () => options.onAdd(level);
  return button;
}
