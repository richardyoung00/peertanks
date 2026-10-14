import { SIM_DT } from '../config';
import { GAMEPLAY } from '../gameplay-config';
import type { PickupViewState, TankViewState, ViewState } from '../render/view-state';
import type { GameEvent } from '../sim/game-events';
import type { MapPoint } from '../sim/game-map';
import { POWERUP_IDS, type ItemId } from '../sim/items';
import type { PlayerScore } from '../sim/scores';
import type { WelcomeMessage } from './client-session';
import type { PlayerInfo } from './messages';
import type { RoundSnapshot, Snapshot, TankSnapshot } from './packets';
import { LocalPrediction } from './prediction';
import { SnapshotTimeline } from './snapshot-timeline';

interface QueuedEvents {
  time: number;
  events: GameEvent[];
}

/** Everything a joining player knows about the game: the roster, their predicted tank and the host's snapshots. */
export class ClientGameState {
  readonly prediction: LocalPrediction;
  scores: PlayerScore[];
  round: RoundSnapshot = { phase: 'playing', timeLeft: 0 };
  /** What each pickup spot holds, from the latest snapshot. */
  pickups: (ItemId | null)[] = [];

  private readonly players = new Map<string, PlayerInfo>();
  private readonly timeline = new SnapshotTimeline();
  private queuedEvents: QueuedEvents[] = [];
  /** Our tank's latest health and status from the host; its position comes from prediction instead. */
  private ownState: TankSnapshot | null = null;
  private readonly pickupSpots: MapPoint[];

  constructor(
    welcome: WelcomeMessage,
    private readonly ownId: string,
  ) {
    welcome.players.forEach((player) => this.addPlayer(player));
    this.scores = welcome.scores;
    this.pickupSpots = welcome.map.pickups;
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

  player(id: string): PlayerInfo | undefined {
    return this.players.get(id);
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
    this.round = snapshot.round;
    this.pickups = snapshot.pickups;
    const ownState = snapshot.tanks.find((tank) => tank.netId === this.ownPlayer.netId);
    if (!ownState) return false;

    const firstState = this.ownState === null;
    this.ownState = ownState;
    const jumped = this.prediction.reconcile(ownState, snapshot.own, snapshot.ackSeq);
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
      if (player && player.id !== this.ownId) tanks.push(toTankView(player, tank, tank));
    }

    const pickups = this.pickupViews();
    if (!this.ownState) return { tanks, projectiles: [], pickups, cameraFocus: null };

    tanks.push(this.ownTankView(alpha, this.ownState));
    const projectiles = (sample?.projectiles ?? []).map((projectile) => ({
      id: projectile.id,
      kind: projectile.kind,
      x: projectile.x,
      y: projectile.y,
      height: projectile.height,
      angle: Math.atan2(projectile.vy, projectile.vx),
    }));
    // While dead, the camera holds still until the tank respawns.
    const own = tanks[tanks.length - 1];
    const cameraFocus = this.ownState.alive ? { x: own.x, y: own.y } : null;
    return { tanks, projectiles, pickups, cameraFocus };
  }

  /** Position and chosen weapon come from prediction, so they react instantly; the rest is the host's word. */
  private ownTankView(alpha: number, status: TankSnapshot): TankViewState {
    const loadout = this.prediction.tank.loadout;
    const view = toTankView(this.ownPlayer, this.prediction.pose(alpha), status);
    view.weapon = loadout.selected;
    view.powerups = POWERUP_IDS.filter((powerup) => loadout.powerups[powerup] > 0);
    view.grenadeCharge = loadout.grenadeCharge / GAMEPLAY.weapons.grenade.maxChargeSeconds;
    return view;
  }

  private pickupViews(): PickupViewState[] {
    return this.pickupSpots.map((spot, index) => ({ x: spot.x, y: spot.y, item: this.pickups[index] ?? null }));
  }

  private playerByNetId(netId: number): PlayerInfo | undefined {
    for (const player of this.players.values()) if (player.netId === netId) return player;
    return undefined;
  }

  private isOwnPredictedShot(event: GameEvent): boolean {
    return event.type === 'shotFired' && event.tankId === this.ownId;
  }
}

type Pose = Pick<TankSnapshot, 'x' | 'y' | 'hullAngle' | 'aimAngle'>;

function toTankView(player: PlayerInfo, pose: Pose, status: TankSnapshot): TankViewState {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    x: pose.x,
    y: pose.y,
    hullAngle: pose.hullAngle,
    aimAngle: pose.aimAngle,
    health: status.health,
    alive: status.alive,
    invulnerable: status.invulnerable,
    weapon: status.weapon,
    powerups: status.powerups,
    grenadeCharge: 0,
  };
}
