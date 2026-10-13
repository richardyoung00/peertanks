import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { NETWORK } from '../config';
import type { GameEvent } from '../sim/game-events';
import type { GameWorld } from '../sim/game-world';
import type { PlayerInput } from '../sim/player-input';
import { openFastChannel, sendIfOpen } from './fast-channel';
import { InputQueue } from './input-queue';
import { isClientMessage, type HostMessage, type JoinMetadata, type PlayerInfo } from './messages';
import { decodePacket, encodeSnapshot } from './packets';
import { Roster } from './roster';
import { buildSnapshot } from './snapshot-builder';

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
  onPlayersChanged(players: PlayerInfo[]): void;
}

/** The host's side of the network: admits players, gathers their inputs and broadcasts the game state. */
export class HostSession {
  readonly roster = new Roster();
  private readonly remotePlayers = new Map<string, RemotePlayer>();

  constructor(
    peer: Peer,
    private readonly world: GameWorld,
    private readonly listener: HostSessionListener,
  ) {
    peer.on('connection', (connection) => {
      connection.on('open', () => void this.admit(connection));
    });
    setInterval(() => this.dropSilentPlayers(), NETWORK.silenceTimeoutMs / 5);
  }

  addHostPlayer(id: string, name: string): PlayerInfo {
    const player = this.roster.add(id, name);
    this.listener.onPlayersChanged(this.roster.all);
    return player;
  }

  /** One input per remote player for the coming tick. */
  collectInputs(): Map<string, PlayerInput> {
    const inputs = new Map<string, PlayerInput>();
    for (const [id, player] of this.remotePlayers) inputs.set(id, player.inputs.next());
    return inputs;
  }

  /** Sends this tick's events, plus a snapshot every few ticks. */
  broadcastTick(events: GameEvent[]): void {
    if (events.length > 0) this.broadcast({ type: 'events', tick: this.world.tick, events });
    if (this.world.tick % NETWORK.snapshotEveryTicks === 0) this.sendSnapshots();
  }

  private async admit(connection: DataConnection): Promise<void> {
    if (this.roster.isFull) {
      this.send(connection, { type: 'rejected', reason: 'This game is full.' });
      setTimeout(() => connection.close(), 500);
      return;
    }

    let fastChannel: RTCDataChannel;
    try {
      fastChannel = await openFastChannel(connection.peerConnection);
    } catch (error) {
      console.warn('Dropping player whose fast channel failed to open', error);
      connection.close();
      return;
    }

    const metadata = connection.metadata as JoinMetadata | undefined;
    const info = this.roster.add(connection.peer, metadata?.name ?? '');
    const player: RemotePlayer = { info, connection, fastChannel, inputs: new InputQueue(),
      lastHeardAt: performance.now(),
      fastChannelConfirmed: false,
    };

    this.world.addTank(info.id, info.name, info.color);
    this.remotePlayers.set(info.id, player);
    this.listenTo(player);

    this.send(connection, { type: 'welcome', playerId: info.id, map: this.world.map, players: this.roster.all });
    this.broadcast({ type: 'playerJoined', player: info }, info.id);
    this.listener.onPlayersChanged(this.roster.all);
  }

  private listenTo(player: RemotePlayer): void {
    player.fastChannel.addEventListener('message', (event: MessageEvent<ArrayBuffer>) => {
      player.lastHeardAt = performance.now();
      player.fastChannelConfirmed = true;
      const packet = decodePacket(event.data);
      if (packet?.type === 'input') player.inputs.add(packet.frames);
    });

    player.connection.on('data', (data) => {
      if (isClientMessage(data) && data.type === 'ping') this.send(player.connection, { type: 'pong', sentAt: data.sentAt });
    });

    player.connection.on('close', () => this.removePlayer(player.info.id, 'connection closed'));
    player.connection.on('error', (error) => this.removePlayer(player.info.id, `connection error: ${error.message}`));
  }

  private dropSilentPlayers(): void {
    const cutoff = performance.now() - NETWORK.silenceTimeoutMs;
    for (const player of this.remotePlayers.values()) {
      if (player.lastHeardAt >= cutoff) continue;
      player.connection.close();
      this.removePlayer(player.info.id, 'stopped responding');
    }
  }

  private removePlayer(id: string, reason: string): void {
    const player = this.remotePlayers.get(id);
    if (!player) return;
    console.info(`${player.info.name} left (${reason})`);
    this.remotePlayers.delete(id);
    this.world.removeTank(id);
    this.roster.remove(id);
    this.broadcast({ type: 'playerLeft', playerId: id });
    this.listener.onPlayersChanged(this.roster.all);
  }

  private sendSnapshots(): void {
    const snapshot = buildSnapshot(this.world, this.roster);
    for (const player of this.remotePlayers.values()) {
      if (!player.fastChannelConfirmed) continue;
      const packet = encodeSnapshot({ ...snapshot, ackSeq: player.inputs.lastAppliedSeq });
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
