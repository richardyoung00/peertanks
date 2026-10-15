import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { BotLevel } from '../bots/bot-level';
import { pickBotName } from '../bots/bot-names';
import { compareWithOurBuild } from '../build-info';
import { NETWORK } from '../config';
import type { GameEvent } from '../sim/game-events';
import type { GameSettings } from '../sim/game-settings';
import type { GameWorld } from '../sim/game-world';
import type { PlayerInput } from '../sim/player-input';
import { openFastChannel, sendIfOpen } from './fast-channel';
import { InputQueue } from './input-queue';
import { isClientMessage, type HostMessage, type JoinMetadata, type PlayerInfo } from './messages';
import { decodePacket, encodeSnapshot } from './packets';
import { Roster } from './roster';
import { buildSnapshot, ownStatusOf } from './snapshot-builder';
import { StallGuard } from './stall-guard';
import { OUTDATED_HOST_MESSAGE, OUTDATED_JOINER_MESSAGE, type RejectionCode } from './version-check';

// Time for a last message (kicked, rejected, game ended) to arrive before hanging up.
const GOODBYE_DELAY_MS = 500;
const SILENCE_CHECK_INTERVAL_MS = NETWORK.silenceTimeoutMs / 5;

interface RemotePlayer {
  info: PlayerInfo;
  connection: DataConnection;
  fastChannel: RTCDataChannel;
  inputs: InputQueue;
  lastHeardAt: number;
  /**
   * The client creates its end of the fast channel slightly after we do, and data arriving before then
   * can break the whole connection. So we only send once the client has sent us something on it.
   */
  fastChannelConfirmed: boolean;
}

export interface HostSessionListener {
  onPlayersChanged?(players: PlayerInfo[]): void;
  onPlayerJoined?(player: PlayerInfo): void;
  onPlayerLeft?(player: PlayerInfo): void;
  /** Someone on a newer build than ours was turned away, so the host should refresh. */
  onNewerBuildRejected?(): void;
}

/**
 * The host's side of the network. It admits players from the moment the game is hosted: first into the
 * lobby, then into the running game once `startGame` is called. It gathers inputs and broadcasts the state.
 */
export class HostSession {
  readonly roster = new Roster();
  private readonly remotePlayers = new Map<string, RemotePlayer>();
  private listener: HostSessionListener = {};
  private world: GameWorld | null = null;
  private mapId = '';
  private sentScoresVersion = -1;
  private nextBotNumber = 1;
  private readonly stallGuard = new StallGuard(SILENCE_CHECK_INTERVAL_MS);

  constructor(
    peer: Peer,
    private lobbySettings: GameSettings,
  ) {
    peer.on('connection', (connection) => {
      connection.on('open', () => void this.admit(connection));
    });
    setInterval(() => this.dropSilentPlayers(), SILENCE_CHECK_INTERVAL_MS);
  }

  setListener(listener: HostSessionListener): void {
    this.listener = listener;
  }

  addHostPlayer(id: string, name: string): PlayerInfo {
    const player = this.roster.add(id, name);
    this.listener.onPlayersChanged?.(this.roster.all);
    return player;
  }

  /** While in the lobby, shows everyone the host's latest choices. */
  updateLobbySettings(settings: GameSettings): void {
    this.lobbySettings = settings;
    this.broadcastLobby();
  }

  /**
   * Puts everyone into a world: when leaving the lobby, and again for each new map in the rotation.
   * Every player gets a tank, and every remote player is welcomed onto the map.
   */
  startMap(world: GameWorld, mapId: string): void {
    this.world = world;
    this.mapId = mapId;
    this.sentScoresVersion = -1;
    for (const player of this.roster.all) world.addTank(player.id, player.name, player.color);
    for (const player of this.remotePlayers.values()) this.sendWelcome(player);
  }

  /** Tells everyone in the game about new settings (they apply from the next round). */
  broadcastSettings(settings: GameSettings): void {
    this.broadcast({ type: 'settings', settings });
  }

  /** Adds a computer player, if there's room. Bots have no connection: the host plays them itself. */
  addBot(level: BotLevel): PlayerInfo | null {
    if (this.roster.isFull) return null;
    const name = pickBotName(this.roster.all.map((player) => player.name));
    const info = this.roster.add(`bot-${this.nextBotNumber++}`, name, level);
    this.welcomeToRoster(info);
    return info;
  }

  kick(id: string): void {
    if (this.roster.get(id)?.bot) {
      this.removeFromRoster(id, 'kicked by the host');
      return;
    }
    const player = this.remotePlayers.get(id);
    if (!player) return;
    this.removePlayer(id, 'kicked by the host');
    this.sayGoodbye(player.connection, { type: 'kicked' });
  }

  endGame(): void {
    for (const player of this.remotePlayers.values()) this.sayGoodbye(player.connection, { type: 'gameEnded' });
  }

  /** One input per remote player for the coming tick. */
  collectInputs(): Map<string, PlayerInput> {
    const inputs = new Map<string, PlayerInput>();
    for (const [id, player] of this.remotePlayers) inputs.set(id, player.inputs.next());
    return inputs;
  }

  /** Sends this tick's events, plus a snapshot every few ticks. */
  broadcastTick(events: GameEvent[]): void {
    if (!this.world) return;
    if (events.length > 0) this.broadcast({ type: 'events', tick: this.world.tick, events });
    if (this.world.tick % NETWORK.snapshotEveryTicks === 0) this.sendSnapshots(this.world);
    this.broadcastScoresIfChanged(this.world);
  }

  private async admit(connection: DataConnection): Promise<void> {
    const metadata = connection.metadata as JoinMetadata | undefined;
    const buildComparison = compareWithOurBuild(metadata?.build);
    if (buildComparison === 'older') return this.reject(connection, 'client-outdated', OUTDATED_JOINER_MESSAGE);
    if (buildComparison === 'newer') {
      this.listener.onNewerBuildRejected?.();
      return this.reject(connection, 'host-outdated', OUTDATED_HOST_MESSAGE);
    }
    if (this.roster.isFull) return this.reject(connection, 'full', 'This game is full.');

    let fastChannel: RTCDataChannel;
    try {
      fastChannel = await openFastChannel(connection.peerConnection);
    } catch (error) {
      console.warn('Dropping player whose fast channel failed to open', error);
      connection.close();
      return;
    }

    const info = this.roster.add(connection.peer, metadata?.name ?? '');
    const player: RemotePlayer = {
      info,
      connection,
      fastChannel,
      inputs: new InputQueue(),
      lastHeardAt: performance.now(),
      fastChannelConfirmed: false,
    };
    this.remotePlayers.set(info.id, player);
    this.listenTo(player);
    this.welcomeToRoster(info);
  }

  /** Puts a newly added player into the running game (or the lobby) and tells everyone else. */
  private welcomeToRoster(info: PlayerInfo): void {
    if (this.world) {
      this.world.addTank(info.id, info.name, info.color);
      const remote = this.remotePlayers.get(info.id);
      if (remote) this.sendWelcome(remote);
      this.broadcast({ type: 'playerJoined', player: info }, info.id);
    } else {
      this.broadcastLobby();
    }
    this.listener.onPlayersChanged?.(this.roster.all);
    this.listener.onPlayerJoined?.(info);
  }

  private sendWelcome(player: RemotePlayer): void {
    if (!this.world) return;
    this.send(player.connection, {
      type: 'welcome',
      playerId: player.info.id,
      mapId: this.mapId,
      map: this.world.map,
      startTick: this.world.tick,
      players: this.roster.all,
      scores: this.world.scores.all,
      settings: this.world.currentSettings,
    });
  }

  private broadcastLobby(): void {
    if (this.world) return;
    for (const [id, player] of this.remotePlayers) {
      this.send(player.connection, { type: 'lobby', playerId: id, players: this.roster.all, settings: this.lobbySettings });
    }
  }

  private reject(connection: DataConnection, code: RejectionCode, reason: string): void {
    this.sayGoodbye(connection, { type: 'rejected', reason, code });
  }

  private sayGoodbye(connection: DataConnection, message: HostMessage): void {
    this.send(connection, message);
    setTimeout(() => connection.close(), GOODBYE_DELAY_MS);
  }

  private listenTo(player: RemotePlayer): void {
    player.fastChannel.addEventListener('message', (event: MessageEvent<ArrayBuffer>) => {
      player.lastHeardAt = performance.now();
      player.fastChannelConfirmed = true;
      const packet = decodePacket(event.data);
      if (packet?.type === 'input') player.inputs.add(packet.frames);
    });

    player.connection.on('data', (data) => {
      player.lastHeardAt = performance.now();
      if (isClientMessage(data) && data.type === 'ping') this.send(player.connection, { type: 'pong', sentAt: data.sentAt });
    });

    player.connection.on('close', () => this.removePlayer(player.info.id, 'connection closed'));
    player.connection.on('error', (error) => this.removePlayer(player.info.id, `connection error: ${error.message}`));
  }

  private dropSilentPlayers(): void {
    const now = performance.now();
    if (this.stallGuard.wasStalled()) {
      for (const player of this.remotePlayers.values()) player.lastHeardAt = now;
      return;
    }
    for (const player of this.remotePlayers.values()) {
      // Lobby players only send pings, so they get the longer allowance too.
      const allowedSilence = player.fastChannelConfirmed ? NETWORK.silenceTimeoutMs : NETWORK.joinGraceMs;
      if (now - player.lastHeardAt <= allowedSilence) continue;
      player.connection.close();
      this.removePlayer(player.info.id, 'stopped responding');
    }
  }

  private removePlayer(id: string, reason: string): void {
    if (!this.remotePlayers.delete(id)) return;
    this.removeFromRoster(id, reason);
  }

  private removeFromRoster(id: string, reason: string): void {
    const info = this.roster.get(id);
    if (!info) return;
    console.info(`${info.name} left (${reason})`);
    this.roster.remove(id);
    if (this.world) {
      this.world.removeTank(id);
      this.broadcast({ type: 'playerLeft', playerId: id });
    } else {
      this.broadcastLobby();
    }
    this.listener.onPlayersChanged?.(this.roster.all);
    this.listener.onPlayerLeft?.(info);
  }

  private broadcastScoresIfChanged(world: GameWorld): void {
    if (world.scores.version === this.sentScoresVersion) return;
    this.sentScoresVersion = world.scores.version;
    this.broadcast({ type: 'scores', scores: world.scores.all });
  }

  private sendSnapshots(world: GameWorld): void {
    const snapshot = buildSnapshot(world, this.roster);
    for (const player of this.remotePlayers.values()) {
      if (!player.fastChannelConfirmed) continue;
      const own = ownStatusOf(world.tanks.get(player.info.id));
      const packet = encodeSnapshot({ ...snapshot, ackSeq: player.inputs.lastAppliedSeq, own });
      sendIfOpen(player.fastChannel, packet);
    }
  }

  private broadcast(message: HostMessage, exceptId?: string): void {
    for (const [id, player] of this.remotePlayers) {
      if (id !== exceptId) this.send(player.connection, message);
    }
  }

  private send(connection: DataConnection, message: HostMessage): void {
    if (connection.open) connection.send(message);
  }
}
