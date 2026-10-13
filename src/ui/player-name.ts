const STORAGE_KEY = 'tanks.playerName';

export function loadPlayerName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Storage can be blocked (e.g. private browsing); the name just won't be remembered.
  }
}
