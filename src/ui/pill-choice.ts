export interface PillOption<T> {
  value: T;
  label: string;
  hint?: string;
}

/** A row of pill buttons where exactly one is picked, e.g. High / Low. */
export function renderPillChoice<T>(container: HTMLElement, options: PillOption<T>[], picked: T, onPick: (value: T) => void): void {
  const buttons = options.map(({ value, label, hint }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill';
    button.textContent = label;
    if (hint) button.title = hint;
    button.setAttribute('aria-pressed', String(value === picked));
    button.onclick = () => {
      onPick(value);
      renderPillChoice(container, options, value, onPick);
    };
    return button;
  });
  container.replaceChildren(...buttons);
}
