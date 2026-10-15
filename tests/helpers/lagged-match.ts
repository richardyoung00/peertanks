import { SIM_DT } from '../../src/config';
import type { WelcomeMessage } from '../../src/net/client-session';
import { ClientGameState } from '../../src/net/client-state';
import { decodePacket, encodeSnapshot, type InputFrame } from '../../src/net/packets';
import { Roster } from '../../src/net/roster';
import { buildSnapshot, ownStatusOf } from '../../src/net/snapshot-builder';
import type { GameEvent } from '../../src/sim/game-events';
import { GameWorld } from '../../src/sim/game-world';
import { IDLE_INPUT, type PlayerInput } from '../../src/sim/player-input';
import { teleportTank } from '../../src/sim/tank';
import { ARENA, settingsWithoutPickups } from './sim-world';

const SNAPSHOT_EVERY_TICKS = 3;

interface InFlight<T> {
  arrivesAt: number;
  value: T;
}

/**
 * A host and one joining player, joined by a pretend connection that delays everything by a fixed number of
 * ticks each way. Snapshots go through the real binary encoding, like on the fast channel.
 */
export class LaggedMatch {
  readonly world = new GameWorld(ARENA, settingsWithoutPickups());
  readonly client: ClientGameState;
  /** Everything the host's world reported, as it happened. */
  readonly hostEvents: GameEvent[] = [];
  private readonly roster = new Roster();
  private tick = 0;
  private toHost: InFlight<InputFrame>[] = [];
  private toClient: InFlight<ArrayBuffer>[] = [];
  private lastAppliedSeq = 0;

  constructor(
    private readonly delayTicks: number,
    clientStart: { x: number; y: number },
    targetStart: { x: number; y: number },
  ) {
    for (const [id, start] of [['target', targetStart], ['client', clientStart]] as const) {
      const player = this.roster.add(id, id);
      const tank = this.world.addTank(player.id, player.name, player.color);
      teleportTank(tank, start);
      tank.invulnerableTimer = 0;
    }
    this.world.step(new Map());
    const welcome: WelcomeMessage = {
      type: 'welcome',
      playerId: 'client',
      mapId: 'arena-01',
      map: ARENA,
      startTick: 0,
      players: this.roster.all,
      scores: this.world.scores.all,
      settings: settingsWithoutPickups(),
    };
    this.client = new ClientGameState(welcome, 'client');
    teleportTank(this.client.prediction.tank, clientStart);
  }

  get now(): number {
    return this.tick * SIM_DT;
  }

  /** One tick on both sides: the client predicts and sends, the host applies what has arrived and replies. */
  step(input: Partial<PlayerInput>): void {
    const { frame } = this.client.prediction.step({ ...IDLE_INPUT, ...input });
    this.toHost.push({ arrivesAt: this.tick + this.delayTicks, value: frame });

    this.hostEvents.push(...this.world.step(new Map([['client', this.arrivedInput()]])));
    if (this.world.tick % SNAPSHOT_EVERY_TICKS === 0) this.sendSnapshot();

    this.tick++;
    for (const packet of this.take(this.toClient)) {
      const decoded = decodePacket(packet);
      if (decoded?.type === 'snapshot') this.client.receiveSnapshot(decoded.snapshot, this.now);
    }
  }

  /** What the joining player sees right now. */
  visibleProjectiles() {
    return this.client.viewState(this.now, 1).projectiles;
  }

  private arrivedInput(): PlayerInput {
    let input = IDLE_INPUT;
    for (const frame of this.take(this.toHost)) {
      if (frame.seq <= this.lastAppliedSeq) continue;
      this.lastAppliedSeq = frame.seq;
      input = frame.input;
    }
    return input;
  }

  private sendSnapshot(): void {
    const snapshot = buildSnapshot(this.world, this.roster);
    const own = ownStatusOf(this.world.tanks.get('client'));
    const packet = encodeSnapshot({ ...snapshot, ackSeq: this.lastAppliedSeq, own });
    this.toClient.push({ arrivesAt: this.tick + this.delayTicks, value: packet });
  }

  private take<T>(queue: InFlight<T>[]): T[] {
    const arrived = queue.filter((item) => item.arrivesAt <= this.tick).map((item) => item.value);
    const waiting = queue.filter((item) => item.arrivesAt > this.tick);
    queue.length = 0;
    queue.push(...waiting);
    return arrived;
  }
}
