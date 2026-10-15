import type { ClientSession, LobbyMessage, WelcomeMessage } from '../net/client-session';
import { HOST_PLAYER_ID } from '../net/messages';
import { joinLink } from '../net/peer';
import { LobbyScreen } from '../ui/lobby-screen';
import type { MenuArt } from './menu-art';
import { returnToMenu } from './navigation';

/** A joining player waits here until the host starts. Resolves with the welcome that starts the game. */
export function waitInLobby(session: ClientSession, first: LobbyMessage, code: string, art: MenuArt): Promise<WelcomeMessage> {
  const lobby = new LobbyScreen({
    code,
    link: joinLink(code),
    localId: first.playerId,
    hostId: HOST_PLAYER_ID,
    art,
    isHost: false,
    onLeave: returnToMenu,
  });
  lobby.update(first.players, first.settings);

  return new Promise((resolve, reject) => {
    session.setListener({
      onMessage: (message) => {
        if (message.type === 'lobby') lobby.update(message.players, message.settings);
        if (message.type !== 'welcome') return;
        session.pauseListener();
        lobby.hide();
        resolve(message);
      },
      onDisconnected: (reason) => {
        lobby.hide();
        reject(new Error(reason));
      },
    });
  });
}
