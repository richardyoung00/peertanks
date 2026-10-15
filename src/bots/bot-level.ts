export const BOT_LEVELS = ['easy', 'medium', 'hard'] as const;

export type BotLevel = (typeof BOT_LEVELS)[number];

export const BOT_LEVEL_NAMES: Record<BotLevel, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};
