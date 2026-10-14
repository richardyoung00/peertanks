import { TANK } from '../config';
import { startGameLoop } from '../game-loop';
import { ClientSession, type ClientSessionListener } from '../net/client-session';
import { ClientGameState } from '../net/client-state';
import { joinLink } from '../net/peer';
import { GameView } from '../render/game-view';
import { showHud, showInvitePanel, updateStatusPanel } from '../ui/hud';
import { showNotice } from '../ui/notice';
import { LocalControls } from './local-controls';
import { returnToMenu, showJoinLinkInAddressBar } from './navigation';

const PING_SMOOTHING = 0.3;

function nowSeconds(): number {
  return performance.now() / 1000;
}

/** Joins someone else's game: predicts our own tank locally and draws everything else from the host's snapshots. */
export async function startClientGame(name: string, code: string, container: HTMLElement): Promise<void> {
  const { session, welcome } = await ClientSession.join(code, name);
  const state = new ClientGameState(welcome, welcome.playerId);
  const view = new GameView(container, welcome.map);
  const controls = new LocalControls(container);

  showHud();
  showInvitePanel(code, joinLink(code));
  showJoinLinkInAddressBar(code);
  session.start(createSessionListener(state, view));

  startGameLoop(
    () => {
      state.updatePredictionObstacles(nowSeconds());
      const { fired } = state.prediction.step(controls.read(view, state.prediction.tank));
      session.sendInputs(state.prediction.recentFrames());
      if (fired) showPredictedShot(state, view);
    },
    (alpha, frameDt) => {
      const now = nowSeconds();
      view.handleEvents(state.takeDueEvents(now));
      state.prediction.decayCorrection(frameDt);
      view.render(state.viewState(now, alpha), frameDt, controls.aimPoint(view));
    },
  );
}

function createSessionListener(state: ClientGameState, view: GameView): ClientSessionListener {
  let pingMs: number | null = null;
  const refreshStatus = () => updateStatusPanel(state.playerCount, pingMs);
  refreshStatus();

  return {
    onSnapshot(snapshot) {
      const jumped = state.receiveSnapshot(snapshot, nowSeconds());
      if (!jumped) return;
      const pose = state.prediction.pose(1);
      view.snapCamera(pose.x, pose.y);
    },
    onMessage(message) {
      if (message.type === 'playerJoined') state.addPlayer(message.player);
      if (message.type === 'playerLeft') state.removePlayer(message.playerId);
      if (message.type === 'events') state.queueEvents(message.tick, message.events);
      refreshStatus();
    },
    onPing(roundTripMs) {
      pingMs = pingMs === null ? roundTripMs : pingMs + (roundTripMs - pingMs) * PING_SMOOTHING;
      refreshStatus();
    },
    onDisconnected(reason) {
      showNotice(reason, 'Back to menu', returnToMenu);
    },
  };
}

/** Our shots get instant recoil and flash; the host still decides where the shell actually goes. */
function showPredictedShot(state: ClientGameState, view: GameView): void {
  const { x, y, aimAngle } = state.prediction.pose(1);
  const muzzleX = x + Math.cos(aimAngle) * TANK.barrelLength;
  const muzzleY = y + Math.sin(aimAngle) * TANK.barrelLength;
  view.showShot(state.ownPlayer.id, muzzleX, muzzleY, aimAngle);
}
