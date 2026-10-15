export type GraphicsQuality = 'high' | 'low';

const STORAGE_KEY = 'tanks.graphics';
const listeners = new Set<(quality: GraphicsQuality) => void>();
let current: GraphicsQuality = loadQuality();

function loadQuality(): GraphicsQuality {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'low' ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

export function graphicsQuality(): GraphicsQuality {
  return current;
}

/** Changes the setting, remembers it for next time and tells anything drawing the game straight away. */
export function setGraphicsQuality(quality: GraphicsQuality): void {
  current = quality;
  try {
    localStorage.setItem(STORAGE_KEY, quality);
  } catch {
    // Storage can be blocked (e.g. private browsing); the choice just won't be remembered.
  }
  for (const listener of listeners) listener(quality);
}

/** Returns a function that stops listening. */
export function onGraphicsQualityChange(listener: (quality: GraphicsQuality) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
