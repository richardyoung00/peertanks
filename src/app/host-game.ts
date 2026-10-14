import { startGameLoop } from '../game-loop';
import { HostSession } from '../net/host-session';
import { joinLink, openHostPeer } from '../net/peer';
import { GameView } from '../render/game-view';
import type { GameEvent } from '../sim/game-events';
import { OUTDATED_HOST_WARNING } from '../net/version-check';
import { GameWorld } from '../sim/game-world';
import { fetchMap } from '../sim/map-loader';
import { showHud, showInvitePanel, updateStatusPanel } from '../ui/hud';
import type { PlayerLookup } from '../ui/player-lookup';
import { showWarningBanner } from '../ui/warning-banner';
import { enableDevCheats } from './dev-cheats';
import { GameHud } from './game-hud';
import { landingTarget } from './landing-target';
import { LocalControls } from './local-controls';
import { viewStateFromWorld } from './world-view-state';

const MAP_URL = `${import.meta.env.BASE_URL}maps/arena-01.json`;
const HOST_PLAYER_ID = 'host';
const UNKNOWN_PLAYER_NAME = 'Someone';

/** Runs the authoritative game in this browser and lets others join it. */
export async function startHostGame(name: string, container: HTMLElement): Promise<void> {
  const map = await fetchMap(MAP_URL);
  const { peer, code } = await openHostPeer();
  const world = new GameWorld(map);
  const hud = new GameHud(lookupFromWorld(world), HOST_PLAYER_ID);
  const session = new HostSession(peer, world, {
    onPlayersChanged: (players) => updateStatusPanel(players.length, 'host'),
    onPlayerJoined: (player) => hud.playerJoined(player),
    onPlayerLeft: (player) => hud.playerLeft(player),
    onNewerBuildRejected: () => showWarningBanner(OUTDATED_HOST_WARNING),
  });

  const hostPlayer = session.addHostPlayer(HOST_PLAYER_ID, name);
  const tank = world.addTank(hostPlayer.id, hostPlayer.name, hostPlayer.color);
  const view = new GameView(container, map);
  view.snapCamera(tank.x, tank.y);
  const controls = new LocalControls(container);
  if (import.meta.env.DEV) enableDevCheats(tank);

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
      hud.handleEvents(events, nowSeconds());
      if (respawnedLocally(events)) view.snapCamera(tank.x, tank.y);
      session.broadcastTick(events);
    },
    (alpha, frameDt) => {
      const aimPoint = controls.aimPoint(view);
      const target = tank.alive ? landingTarget(tank, tank.loadout, aimPoint) : null;
      view.render(viewStateFromWorld(world, alpha, tank.id), frameDt, aimPoint, target);
      hud.update(world.round, world.scores.all, tank.loadout, nowSeconds());
    },
  );
}

function nowSeconds(): number {
  return performance.now() / 1000;
}

function lookupFromWorld(world: GameWorld): PlayerLookup {
  return {
    name: (id) => world.tanks.get(id)?.name ?? UNKNOWN_PLAYER_NAME,
    color: (id) => world.tanks.get(id)?.color ?? 0xffffff,
  };
}
