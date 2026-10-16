import { MatchAudio } from '../audio/match-audio';
import { BotSquad } from '../bots/bot-squad';
import { SIM_DT } from '../config';
import { startGameLoop } from '../game-loop';
import type { HostSession } from '../net/host-session';
import { HOST_PLAYER_ID } from '../net/messages';
import { joinLink } from '../net/peer';
import { OUTDATED_HOST_WARNING } from '../net/version-check';
import { GameView } from '../render/game-view';
import type { GameEvent } from '../sim/game-events';
import type { GameMap } from '../sim/game-map';
import type { GameSettings } from '../sim/game-settings';
import { GameWorld } from '../sim/game-world';
import type { Tank } from '../sim/tank';
import { GameMenu } from '../ui/game-menu';
import { showHud, showInvitePanel, updateStatusPanel } from '../ui/hud';
import { showWarningBanner } from '../ui/warning-banner';
import { enableDevCheats } from './dev-cheats';
import { GameHud } from './game-hud';
import { landingTarget } from './landing-target';
import { LocalControls } from './local-controls';
import { MapRotation } from './map-rotation';
import type { MenuArt } from './menu-art';
import { returnToMenu } from './navigation';
import { viewStateFromWorld } from './world-view-state';

const UNKNOWN_PLAYER_NAME = 'Someone';
// Long enough for the "game ended" message to reach everyone before the host's page reloads.
const END_GAME_DELAY_MS = 600;

/**
 * The host's running game. The world and its view are replaced whenever the map rotation moves on;
 * everything else (controls, HUD, menu) carries over.
 */
export class HostMatch {
  private world: GameWorld;
  private view: GameView;
  private readonly rotation: MapRotation;
  private readonly controls: LocalControls;
  private readonly hud: GameHud;
  private readonly menu: GameMenu;
  private readonly bots: BotSquad;
  private readonly audio = new MatchAudio(HOST_PLAYER_ID);

  constructor(
    private readonly session: HostSession,
    private readonly container: HTMLElement,
    code: string,
    art: MenuArt,
    settings: GameSettings,
    firstMap: { id: string; map: GameMap },
  ) {
    this.rotation = new MapRotation(firstMap.id, art);
    this.world = new GameWorld(firstMap.map, settings);
    this.bots = new BotSquad(firstMap.map);
    this.bots.sync(session.roster.all);
    session.startMap(this.world, firstMap.id);
    this.view = this.createView();
    this.controls = new LocalControls(container);
    this.hud = new GameHud(this.playerLookup(), HOST_PLAYER_ID);
    this.menu = this.createMenu(art);
    this.listenToSession();
    if (import.meta.env.DEV) enableDevCheats(() => this.world, HOST_PLAYER_ID);

    showHud();
    showInvitePanel(code, joinLink(code));
  }

  start(): void {
    startGameLoop(
      () => this.tick(),
      (alpha, frameDt) => this.render(alpha, frameDt),
    );
  }

  private get tank(): Tank | undefined {
    return this.world.tanks.get(HOST_PLAYER_ID);
  }

  private tick(): void {
    if (this.isMapChangeDue()) this.switchToNextMap();
    const tank = this.tank;
    const inputs = this.session.collectInputs();
    if (tank) inputs.set(tank.id, this.controls.read(this.view, tank));
    for (const [id, input] of this.bots.inputs(this.world)) inputs.set(id, input);

    const events = this.world.step(inputs);
    this.bots.observe(events, this.world);
    this.view.handleEvents(events);
    this.audio.handleEvents(events, this.view.cameraFocus);
    this.hud.handleEvents(events, nowSeconds());
    this.reactToEvents(events);
    this.session.broadcastTick(events);
  }

  private render(alpha: number, frameDt: number): void {
    const tank = this.tank;
    const aimPoint = this.controls.aimPoint(this.view);
    const target = tank?.alive ? landingTarget(tank, tank.loadout, aimPoint) : null;
    this.view.render(viewStateFromWorld(this.world, alpha, HOST_PLAYER_ID), frameDt, aimPoint, target);
    this.audio.update(this.world.round, this.world.currentSettings.roundSeconds);
    if (tank) {
      const nextMap = this.rotation.nextName(this.world.currentSettings);
      this.hud.update(this.world.round, this.world.scores.all, tank.loadout, nextMap, nowSeconds());
    }
  }

  private reactToEvents(events: GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'roundEnded') this.rotation.prepareNext(this.world.currentSettings);
      if (event.type === 'tankRespawned' && event.tankId === HOST_PLAYER_ID && this.tank) {
        this.view.snapCamera(this.tank.x, this.tank.y);
      }
    }
  }

  /** On the last tick of the results screen, if the next map is a different one and has loaded. */
  private isMapChangeDue(): boolean {
    const round = this.world.round;
    const endingResults = round.phase === 'results' && round.timeLeft <= SIM_DT;
    return endingResults && this.rotation.nextId(this.world.currentSettings) !== this.rotation.currentId;
  }

  private switchToNextMap(): void {
    const settings = this.world.currentSettings;
    const next = this.rotation.takeReadyMap(settings);
    if (!next) return;
    const previous = this.world;
    this.world = new GameWorld(next.map, settings, previous.tick + 1);
    previous.dispose();
    this.bots.changeMap(next.map);
    this.session.startMap(this.world, next.id);

    this.view.dispose();
    this.view = this.createView();
  }

  private createView(): GameView {
    const view = new GameView(this.container, this.world.map);
    const tank = this.world.tanks.get(HOST_PLAYER_ID);
    if (tank) view.snapCamera(tank.x, tank.y);
    return view;
  }

  private createMenu(art: MenuArt): GameMenu {
    return new GameMenu({
      localId: HOST_PLAYER_ID,
      hostId: HOST_PLAYER_ID,
      art,
      host: {
        onSettingsChange: (settings) => {
          this.world.changeSettings(settings);
          this.session.broadcastSettings(settings);
        },
        onKick: (playerId) => this.session.kick(playerId),
        onAddBot: (level) => this.session.addBot(level),
        onEndGame: () => {
          this.session.endGame();
          setTimeout(returnToMenu, END_GAME_DELAY_MS);
        },
      },
      onLeave: returnToMenu,
    });
  }

  private listenToSession(): void {
    this.session.setListener({
      onPlayersChanged: (players) => {
        this.bots.sync(players);
        updateStatusPanel(players.length, 'host');
        this.menu.update(players, this.world.currentSettings);
      },
      onPlayerJoined: (player) => this.hud.playerJoined(player),
      onPlayerLeft: (player) => this.hud.playerLeft(player),
      onNewerBuildRejected: () => showWarningBanner(OUTDATED_HOST_WARNING),
    });
    this.menu.update(this.session.roster.all, this.world.currentSettings);
    updateStatusPanel(this.session.roster.all.length, 'host');
  }

  private playerLookup() {
    return {
      name: (id: string) => this.world.tanks.get(id)?.name ?? UNKNOWN_PLAYER_NAME,
      color: (id: string) => this.world.tanks.get(id)?.color ?? 0xffffff,
      botLevel: (id: string) => this.session.roster.get(id)?.bot,
    };
  }
}

function nowSeconds(): number {
  return performance.now() / 1000;
}
