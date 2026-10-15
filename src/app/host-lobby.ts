import type { HostSession } from '../net/host-session';
import { joinLink } from '../net/peer';
import type { GameSettings } from '../sim/game-settings';
import { LobbyScreen } from '../ui/lobby-screen';
import type { MenuArt } from './menu-art';
import { returnToMenu } from './navigation';

/** Shows the host's lobby and resolves with the chosen settings when they press Start. */
export function runHostLobby(
  session: HostSession,
  code: string,
  hostId: string,
  art: MenuArt,
  initialSettings: GameSettings,
): Promise<GameSettings> {
  let settings = initialSettings;

  return new Promise((resolve) => {
    const lobby = new LobbyScreen({
      code,
      link: joinLink(code),
      localId: hostId,
      hostId,
      art,
      isHost: true,
      onSettingsChange: (changed) => {
        settings = changed;
        session.updateLobbySettings(settings);
        lobby.update(session.roster.all, settings);
      },
      onStart: () => {
        lobby.hide();
        resolve(settings);
      },
      onLeave: returnToMenu,
    });
    session.setListener({ onPlayersChanged: (players) => lobby.update(players, settings) });
    lobby.update(session.roster.all, settings);
  });
}
