import { HostSession } from '../net/host-session';
import { HOST_PLAYER_ID } from '../net/messages';
import { openHostPeer } from '../net/peer';
import { defaultSettings } from '../sim/game-settings';
import { fetchMapById } from '../sim/map-loader';
import { showLoading } from '../ui/notice';
import { HostMatch } from './host-match';
import { runHostLobby } from './host-lobby';
import { loadMenuArt } from './menu-art';

/** Hosts a game: the lobby first, then the authoritative game running in this browser. */
export async function startHostGame(name: string, container: HTMLElement): Promise<void> {
  const [{ peer, code }, art] = await Promise.all([openHostPeer(), loadMenuArt()]);
  const session = new HostSession(peer, defaultSettings());
  session.addHostPlayer(HOST_PLAYER_ID, name);

  const settings = await runHostLobby(session, code, HOST_PLAYER_ID, art, defaultSettings());
  showLoading(true, 'Starting game…');
  const firstMapId = settings.mapIds[0];
  const firstMap = { id: firstMapId, map: await fetchMapById(firstMapId) };
  showLoading(false);
  new HostMatch(session, container, code, art, settings, firstMap).start();
}
