import { element } from './dom';

/** A dismissable warning across the top of the screen. */
export function showWarningBanner(message: string): void {
  element('warning-message').textContent = message;
  element('warning-dismiss').onclick = () => (element('warning-banner').hidden = true);
  element('warning-banner').hidden = false;
}
