import type { ClientSession, LobbyMessage, WelcomeMessage } from '../net/client-session';
import { HOST_PLAYER_ID } from '../net/messages';
import { joinLink } from '../net/peer';
import { fetchMapList } from '../sim/map-loader';
import { LobbyScreen } from '../ui/lobby-screen';
import { returnToMenu } from './navigation';

/** A joining player waits here until the host starts. Resolves with the welcome that starts the game. */
export async function waitInLobby(session: ClientSession, first: LobbyMessage, code: string): Promise<WelcomeMessage> {
  const maps = await fetchMapList();
  const lobby = new LobbyScreen({
    code,
    link: joinLink(code),
    localId: first.playerId,
    hostId: HOST_PLAYER_ID,
    maps,
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
