import { SIM_DT } from '../config';
import type { TankViewState, ViewState } from '../render/view-state';
import type { GameEvent } from '../sim/game-events';
import type { PlayerInfo } from './messages';
import type { WelcomeMessage } from './client-session';
import type { Snapshot } from './packets';
import { LocalPrediction } from './prediction';
import { SnapshotTimeline } from './snapshot-timeline';

interface QueuedEvents {
  time: number;
  events: GameEvent[];
}

/** Everything a joining player knows about the game: the roster, their predicted tank and the host's snapshots. */
export class ClientGameState {
  readonly prediction: LocalPrediction;
  private readonly players = new Map<string, PlayerInfo>();
  private readonly timeline = new SnapshotTimeline();
  private queuedEvents: QueuedEvents[] = [];
  private hasOwnState = false;

  constructor(
    welcome: WelcomeMessage,
    private readonly ownId: string,
  ) {
    welcome.players.forEach((player) => this.addPlayer(player));
    this.prediction = new LocalPrediction(welcome.map, this.ownPlayer, welcome.map.spawns[0]);
  }

  get ownPlayer(): PlayerInfo {
    const player = this.players.get(this.ownId);
    if (!player) throw new Error('Own player missing from roster');
    return player;
  }

  get playerCount(): number {
    return this.players.size;
  }

  addPlayer(player: PlayerInfo): void {
    this.players.set(player.id, player);
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  /** Returns true when our own tank jumped (e.g. it respawned), so the camera should cut rather than pan. */
  receiveSnapshot(snapshot: Snapshot, nowSeconds: number): boolean {
    if (!this.timeline.push(snapshot, nowSeconds)) return false;
    const ownState = snapshot.tanks.find((tank) => tank.netId === this.ownPlayer.netId);
    if (!ownState) return false;

    const jumped = this.prediction.reconcile(ownState, snapshot.ackSeq);
    const firstState = !this.hasOwnState;
    this.hasOwnState = true;
    return jumped || firstState;
  }

  queueEvents(tick: number, events: GameEvent[]): void {
    this.queuedEvents.push({ time: tick * SIM_DT, events });
  }

  /** Events whose moment has come in the (slightly delayed) view of other players. */
  takeDueEvents(nowSeconds: number): GameEvent[] {
    const renderTime = this.timeline.renderTime(nowSeconds);
    const due = this.queuedEvents.filter((queued) => queued.time <= renderTime);
    this.queuedEvents = this.queuedEvents.filter((queued) => queued.time > renderTime);
    return due.flatMap((queued) => queued.events).filter((event) => !this.isOwnPredictedShot(event));
  }

  /** Moves other tanks in our local physics so our predicted tank can bump into them. */
  updatePredictionObstacles(nowSeconds: number): void {
    const sample = this.timeline.sample(this.timeline.renderTime(nowSeconds));
    if (sample) this.prediction.placeOtherTanks(sample.tanks, this.ownPlayer.netId);
  }

  viewState(nowSeconds: number, alpha: number): ViewState {
    const sample = this.timeline.sample(this.timeline.renderTime(nowSeconds));
    const tanks: TankViewState[] = [];
    for (const tank of sample?.tanks ?? []) {
      const player = this.playerByNetId(tank.netId);
      if (!player || player.id === this.ownId) continue;
      tanks.push({ id: player.id, color: player.color, x: tank.x, y: tank.y, hullAngle: tank.hullAngle, aimAngle: tank.aimAngle });
    }

    if (!this.hasOwnState) return { tanks, projectiles: [], cameraFocus: null };

    const own = this.prediction.pose(alpha);
    tanks.push({ id: this.ownId, color: this.ownPlayer.color, ...own });
    const projectiles = (sample?.projectiles ?? []).map((projectile) => ({
      id: projectile.id,
      x: projectile.x,
      y: projectile.y,
      angle: Math.atan2(projectile.vy, projectile.vx),
    }));
    return { tanks, projectiles, cameraFocus: { x: own.x, y: own.y } };
  }

  private playerByNetId(netId: number): PlayerInfo | undefined {
    for (const player of this.players.values()) if (player.netId === netId) return player;
    return undefined;
  }

  private isOwnPredictedShot(event: GameEvent): boolean {
    return event.type === 'shotFired' && event.tankId === this.ownId;
  }
}
