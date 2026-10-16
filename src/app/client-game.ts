import { ClientSession } from '../net/client-session';
import { weaponAutoSwitch } from '../settings/weapon-auto-switch';
import { ClientMatch } from './client-match';
import { waitInLobby } from './client-lobby';
import { loadMenuArt } from './menu-art';
import { showJoinLinkInAddressBar } from './navigation';

/** Joins someone else's game, waiting in their lobby first if they haven't started yet. */
export async function startClientGame(name: string, code: string, container: HTMLElement): Promise<void> {
  const { session, first } = await ClientSession.join(code, name);
  // Only sent once we're in: before that the host may not be listening yet.
  session.sendPreferences(weaponAutoSwitch.get());
  weaponAutoSwitch.onChange((on) => session.sendPreferences(on));
  showJoinLinkInAddressBar(code);
  const art = await loadMenuArt();
  const welcome = first.type === 'welcome' ? first : await waitInLobby(session, first, code, art);
  await session.openFastChannel();
  new ClientMatch(session, container, code, art, welcome).start();
}
