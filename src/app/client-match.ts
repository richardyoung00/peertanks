import { MatchAudio } from '../audio/match-audio';
import { GAMEPLAY } from '../gameplay-config';
import { startGameLoop } from '../game-loop';
import type { ClientSession, ClientSessionListener, WelcomeMessage } from '../net/client-session';
import { ClientGameState } from '../net/client-state';
import { HOST_PLAYER_ID } from '../net/messages';
import { joinLink } from '../net/peer';
import { GameView } from '../render/game-view';
import { nextMapId } from '../sim/game-settings';
import type { WeaponId } from '../sim/items';
import { GameMenu } from '../ui/game-menu';
import { showHud, showInvitePanel, updateStatusPanel } from '../ui/hud';
import { showNotice } from '../ui/notice';
import type { PlayerLookup } from '../ui/player-lookup';
import { GameHud } from './game-hud';
import { landingTarget } from './landing-target';
import { LocalControls } from './local-controls';
import type { MenuArt } from './menu-art';
import { returnToMenu } from './navigation';

const PING_SMOOTHING = 0.3;
const UNKNOWN_PLAYER_NAME = 'Someone';

/**
 * A joining player's running game. Our own tank is predicted locally and everything else is drawn from the
 * host's snapshots. When the host moves to a new map it sends a fresh welcome, and the state and view are
 * rebuilt; controls, HUD and menu carry over.
 */
export class ClientMatch {
  private state: ClientGameState;
  private view: GameView;
  private readonly controls: LocalControls;
  private readonly hud: GameHud;
  private readonly menu: GameMenu;
  private readonly audio: MatchAudio;
  private pingMs: number | null = null;

  constructor(
    private readonly session: ClientSession,
    private readonly container: HTMLElement,
    code: string,
    private readonly art: MenuArt,
    welcome: WelcomeMessage,
  ) {
    this.state = new ClientGameState(welcome, welcome.playerId);
    this.view = new GameView(container, welcome.map);
    this.controls = new LocalControls(container);
    this.hud = new GameHud(this.playerLookup(), welcome.playerId);
    this.audio = new MatchAudio(welcome.playerId);
    this.menu = new GameMenu({ localId: welcome.playerId, hostId: HOST_PLAYER_ID, art, onLeave: returnToMenu });
    this.refreshStatus();

    showHud();
    showInvitePanel(code, joinLink(code));
    session.setListener(this.sessionListener());
  }

  start(): void {
    startGameLoop(
      () => this.tick(),
      (alpha, frameDt) => this.render(alpha, frameDt),
    );
  }

  private tick(): void {
    const state = this.state;
    state.updatePredictionObstacles(nowSeconds());
    const { fired, impacts } = state.prediction.step(this.controls.read(this.view, state.prediction.tank));
    this.session.sendInputs(state.prediction.recentFrames());
    if (fired) this.showPredictedShot(fired);
    const ownerId = state.ownPlayer.id;
    if (impacts.length > 0) {
      this.view.handleEvents(impacts.map(({ x, y }) => ({ type: 'shellHit', x, y, ownerId })));
      this.audio.playOwnWallHits(impacts, this.view.cameraFocus);
    }
  }

  private render(alpha: number, frameDt: number): void {
    const state = this.state;
    const now = nowSeconds();
    const events = state.takeDueEvents(now);
    this.view.handleEvents(events);
    this.audio.handleEvents(events, this.view.cameraFocus);
    this.hud.handleEvents(events, now);
    state.prediction.decayCorrection(frameDt);

    const aimPoint = this.controls.aimPoint(this.view);
    const viewState = state.viewState(now, alpha);
    const ownTank = viewState.tanks.find((tank) => tank.id === state.ownPlayer.id);
    const target = ownTank?.alive ? landingTarget(ownTank, state.prediction.tank.loadout, aimPoint) : null;
    this.view.render(viewState, frameDt, aimPoint, target);
    this.audio.update(state.round, state.settings.roundSeconds);
    this.hud.update(state.round, state.scores, state.prediction.tank.loadout, this.nextMapName(), now);
  }

  /** A new map: start over with a fresh state and view. */
  private switchMap(welcome: WelcomeMessage): void {
    const firstInputSeq = this.state.prediction.upcomingSeq;
    this.state.dispose();
    this.state = new ClientGameState(welcome, welcome.playerId, firstInputSeq);
    this.view.dispose();
    this.view = new GameView(this.container, welcome.map);
    this.menu.update(welcome.players, welcome.settings);
    this.refreshStatus();
  }

  private sessionListener(): ClientSessionListener {
    return {
      onEvents: (packet) => this.state.receiveEvents(packet),
      onSnapshot: (snapshot) => {
        const jumped = this.state.receiveSnapshot(snapshot, nowSeconds());
        if (!jumped) return;
        const pose = this.state.prediction.pose(1);
        this.view.snapCamera(pose.x, pose.y);
      },
      onMessage: (message) => {
        const state = this.state;
        switch (message.type) {
          case 'welcome':
            this.switchMap(message);
            return;
          case 'playerJoined':
            state.addPlayer(message.player);
            this.hud.playerJoined(message.player);
            break;
          case 'playerLeft': {
            const player = state.player(message.playerId);
            if (player) this.hud.playerLeft(player);
            state.removePlayer(message.playerId);
            break;
          }
          case 'scores':
            state.scores = message.scores;
            break;
          case 'settings':
            state.settings = message.settings;
            break;
        }
        this.refreshStatus();
      },
      onPing: (roundTripMs) => {
        this.pingMs = this.pingMs === null ? roundTripMs : this.pingMs + (roundTripMs - this.pingMs) * PING_SMOOTHING;
        this.refreshStatus();
      },
      onDisconnected: (reason) => showNotice(reason, 'Back to menu', returnToMenu),
    };
  }

  private refreshStatus(): void {
    updateStatusPanel(this.state.playerCount, this.pingMs);
    this.menu.update(this.state.players, this.state.settings);
  }

  private nextMapName(): string {
    const id = nextMapId(this.state.settings, this.state.mapId);
    return this.art.maps.find((map) => map.id === id)?.name ?? id;
  }

  /** Our shots get instant recoil, flash and sound; the host still decides where the shell actually goes. */
  private showPredictedShot(weapon: WeaponId): void {
    const { x, y, aimAngle } = this.state.prediction.pose(1);
    const muzzleX = x + Math.cos(aimAngle) * GAMEPLAY.tank.barrelLength;
    const muzzleY = y + Math.sin(aimAngle) * GAMEPLAY.tank.barrelLength;
    this.view.showShot(this.state.ownPlayer.id, muzzleX, muzzleY, aimAngle);
    this.audio.playOwnShot(weapon);
  }

  private playerLookup(): PlayerLookup {
    return {
      name: (id) => this.state.player(id)?.name ?? UNKNOWN_PLAYER_NAME,
      color: (id) => this.state.player(id)?.color ?? 0xffffff,
      botLevel: (id) => this.state.player(id)?.bot,
    };
  }
}

function nowSeconds(): number {
  return performance.now() / 1000;
}
