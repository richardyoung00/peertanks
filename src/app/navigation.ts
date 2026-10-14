import { joinLink } from '../net/peer';

/** Puts the join link in the address bar, so it can be copied from there too. */
export function showJoinLinkInAddressBar(code: string): void {
  history.replaceState(null, '', joinLink(code));
}

/** Leaving a game is a clean page reload, which tears down the network connections and the 3D scene. */
export function returnToMenu(): void {
  history.replaceState(null, '', location.pathname);
  location.reload();
}
