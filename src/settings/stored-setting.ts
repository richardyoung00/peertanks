/**
 * One of the player's own settings: remembered in localStorage and announced to listeners as soon as it
 * changes, so it applies straight away.
 */
export class StoredSetting<T> {
  private value: T;
  private readonly listeners = new Set<(value: T) => void>();

  constructor(
    private readonly storageKey: string,
    parse: (stored: string | null) => T,
  ) {
    this.value = parse(readStored(storageKey));
  }

  get(): T {
    return this.value;
  }

  set(value: T): void {
    this.value = value;
    writeStored(this.storageKey, String(value));
    for (const listener of this.listeners) listener(value);
  }

  /** Returns a function that stops listening. */
  onChange(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (e.g. private browsing); the choice just won't be remembered.
  }
}
