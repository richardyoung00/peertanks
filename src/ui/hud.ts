import { makeCopyLinkButton } from './copy-link';
import { element } from './dom';

export function showHud(): void {
  element('hud').hidden = false;
}

export function showInvitePanel(code: string, link: string): void {
  element('invite-panel').hidden = false;
  element('invite-code').textContent = code;
  makeCopyLinkButton(element<HTMLButtonElement>('invite-copy'), link);
}

/** `ping` is the round trip in ms, 'host' for the host itself, or null while it is still being measured. */
export function updateStatusPanel(playerCount: number, ping: number | 'host' | null): void {
  const players = `${playerCount} player${playerCount === 1 ? '' : 's'}`;
  element('status-panel').textContent = `${players} · ${describePing(ping)}`;
}

function describePing(ping: number | 'host' | null): string {
  if (ping === 'host') return 'Host';
  if (ping === null) return 'Ping …';
  return `Ping ${Math.round(ping)} ms`;
}
