import { element } from './dom';

/** A full-screen message with a single button, used for errors and "host left". */
export function showNotice(message: string, actionLabel: string, onAction: () => void): void {
  element('notice-message').textContent = message;
  const action = element<HTMLButtonElement>('notice-action');
  action.textContent = actionLabel;
  action.onclick = onAction;
  element('notice').hidden = false;
  action.focus();
}

export function showLoading(visible: boolean, message = 'Loading…'): void {
  const loading = element('loading');
  loading.textContent = message;
  loading.hidden = !visible;
}
