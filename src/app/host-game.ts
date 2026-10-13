import { startGameLoop } from '../game-loop';
import { HostSession } from '../net/host-session';
import { joinLink, openHostPeer } from '../net/peer';
import { GameView } from '../render/game-view';
import type { GameEvent } from '../sim/game-events';
import { GameWorld } from '../sim/game-world';
import { fetchMap } from '../sim/map-loader';
import { showHud, showInvitePanel, updateStatusPanel } from '../ui/hud';
import { LocalControls } from './local-controls';
import { viewStateFromWorld } from './world-view-state';

const MAP_URL = `${import.meta.env.BASE_URL}maps/arena-01.json`;
const HOST_PLAYER_ID = 'host';

/** Runs the authoritative game in this browser and lets others join it. */
export async function startHostGame(name: string, container: HTMLElement): Promise<void> {
  const map = await fetchMap(MAP_URL);
  const { peer, code } = await openHostPeer();
  const world = new GameWorld(map);
  const session = new HostSession(peer, world, {
    onPlayersChanged: (players) => updateStatusPanel(players.length, 'host'),
  });

  const hostPlayer = session.addHostPlayer(HOST_PLAYER_ID, name);
  const tank = world.addTank(hostPlayer.id, hostPlayer.name, hostPlayer.color);
  const view = new GameView(container, map);
  view.snapCamera(tank.x, tank.y);
  const controls = new LocalControls(container);

  showHud();
  showInvitePanel(code, joinLink(code));

  const respawnedLocally = (events: GameEvent[]) =>
    events.some((event) => event.type === 'tankRespawned' && event.tankId === tank.id);

  startGameLoop(
    () => {
      const inputs = session.collectInputs();
      inputs.set(tank.id, controls.read(view, tank));
      const events = world.step(inputs);
      view.handleEvents(events);
      if (respawnedLocally(events)) view.snapCamera(tank.x, tank.y);
      session.broadcastTick(events);
    },
    (alpha, frameDt) => view.render(viewStateFromWorld(world, alpha, tank.id), frameDt, controls.aimPoint(view)),
  );
}
