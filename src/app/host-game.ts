import { startGameLoop } from '../game-loop';
import { HostSession } from '../net/host-session';
import { HOST_PLAYER_ID } from '../net/messages';
import { joinLink, openHostPeer } from '../net/peer';
import { OUTDATED_HOST_WARNING } from '../net/version-check';
import { GameView } from '../render/game-view';
import type { GameEvent } from '../sim/game-events';
import { defaultSettings } from '../sim/game-settings';
import { GameWorld } from '../sim/game-world';
import { fetchMapById, fetchMapList } from '../sim/map-loader';
import { GameMenu } from '../ui/game-menu';
import { showHud, showInvitePanel, updateStatusPanel } from '../ui/hud';
import { showLoading } from '../ui/notice';
import type { PlayerLookup } from '../ui/player-lookup';
import { showWarningBanner } from '../ui/warning-banner';
import { enableDevCheats } from './dev-cheats';
import { GameHud } from './game-hud';
import { runHostLobby } from './host-lobby';
import { landingTarget } from './landing-target';
import { LocalControls } from './local-controls';
import { returnToMenu } from './navigation';
import { viewStateFromWorld } from './world-view-state';

const UNKNOWN_PLAYER_NAME = 'Someone';
// Long enough for the "game ended" message to reach everyone before the host's page reloads.
const END_GAME_DELAY_MS = 600;

/** Hosts a game: the lobby first, then the authoritative game running in this browser. */
export async function startHostGame(name: string, container: HTMLElement): Promise<void> {
  const [{ peer, code }, maps] = await Promise.all([openHostPeer(), fetchMapList()]);
  const session = new HostSession(peer, defaultSettings());
  session.addHostPlayer(HOST_PLAYER_ID, name);

  const settings = await runHostLobby(session, code, HOST_PLAYER_ID, maps, defaultSettings());
  showLoading(true, 'Starting game…');
  const world = new GameWorld(await fetchMapById(settings.mapId), settings);
  session.startGame(world);
  showLoading(false);
  runHostGame(session, world, code, container);
}

function runHostGame(session: HostSession, world: GameWorld, code: string, container: HTMLElement): void {
  const tank = world.tanks.get(HOST_PLAYER_ID);
  if (!tank) throw new Error('Host tank missing');

  const hud = new GameHud(lookupFromWorld(world), HOST_PLAYER_ID);
  const menu = new GameMenu({
    localId: HOST_PLAYER_ID,
    hostId: HOST_PLAYER_ID,
    host: {
      onSettingsChange: (settings) => world.changeSettings(settings),
      onKick: (playerId) => session.kick(playerId),
      onEndGame: () => {
        session.endGame();
        setTimeout(returnToMenu, END_GAME_DELAY_MS);
      },
    },
    onLeave: returnToMenu,
  });
  session.setListener({
    onPlayersChanged: (players) => {
      updateStatusPanel(players.length, 'host');
      menu.update(players, world.currentSettings);
    },
    onPlayerJoined: (player) => hud.playerJoined(player),
    onPlayerLeft: (player) => hud.playerLeft(player),
    onNewerBuildRejected: () => showWarningBanner(OUTDATED_HOST_WARNING),
  });
  menu.update(session.roster.all, world.currentSettings);
  updateStatusPanel(session.roster.all.length, 'host');

  const view = new GameView(container, world.map);
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
