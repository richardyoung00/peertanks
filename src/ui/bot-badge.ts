import { BOT_LEVEL_NAMES, type BotLevel } from '../bots/bot-level';

/** A small chip marking a computer player, coloured by level. It shows either the level name or just "Bot". */
export function botBadge(level: BotLevel, showLevel: boolean): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `bot-badge bot-level-${level}`;
  badge.textContent = showLevel ? BOT_LEVEL_NAMES[level] : 'Bot';
  badge.title = `${BOT_LEVEL_NAMES[level]} bot`;
  return badge;
}
