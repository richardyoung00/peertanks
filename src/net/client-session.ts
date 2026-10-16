import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { BUILD } from '../build-info';
import { NETWORK } from '../config';
import { openGameChannels, sendIfOpen } from './game-channels';
import { isHostMessage, type ClientMessage, type HostMessage, type JoinMetadata } from './messages';
import { decodePacket, encodeInputPacket, type InputFrame, type Snapshot } from './packets';
import { closeOnPageExit, hostPeerId, openClientPeer } from './peer';
import { StallGuard } from './stall-guard';
import { rejectionMessage } from './version-check';

export type WelcomeMessage = Extract<HostMessage, { type: 'welcome' }>;
export type LobbyMessage = Extract<HostMessage, { type: 'lobby' }>;

export interface ClientSessionListener {
  onMessage(message: HostMessage): void;
  onDisconnected(reason: string): void;
  onSnapshot?(snapshot: Snapshot): void;
  /** A batch of the host's events, still encoded: only the game state can turn net ids back into players. */
  onEvents?(packet: ArrayBuffer): void;
  onPing?(roundTripMs: number): void;
}

const HOST_LEFT = 'The host left the game.';
const CONNECTION_LOST = 'Lost connection to the host.';
const KICKED = 'The host removed you from the game.';
const GAME_ENDED = 'The host ended the game.';

/**
 * A joining player's side of the network. Messages are held until someone is listening, so nothing is lost
 * while switching between the lobby and the game. The fast and event channels only open once the game starts.
 */
export class ClientSession {
  private listener: ClientSessionListener | null = null;
  private heldMessages: HostMessage[] = [];
  private fastChannel: RTCDataChannel | null = null;
  private lastSnapshotAt = 0;
  private disconnectReason: string | null = null;
  private readonly stallGuard = new StallGuard(NETWORK.pingIntervalMs);

  private constructor(
    peer: Peer,
    private readonly connection: DataConnection,
  ) {
    connection.on('data', (data) => this.receive(data));
    connection.on('close', () => this.disconnect(HOST_LEFT));
    peer.on('error', () => this.disconnect(CONNECTION_LOST));
    setInterval(() => this.heartbeat(), NETWORK.pingIntervalMs);
    closeOnPageExit(peer);
  }

  /** Connects and waits for the host to either send us to the lobby or straight into the game. */
  static async join(code: string, name: string): Promise<{ session: ClientSession; first: WelcomeMessage | LobbyMessage }> {
    const peer = await openClientPeer();
    try {
      const metadata: JoinMetadata = { name, build: BUILD };
      const connection = peer.connect(hostPeerId(code), { reliable: true, serialization: 'json', metadata });
      const session = new ClientSession(peer, connection);
      await waitForConnection(peer, connection);
      const first = await session.waitForEntry();
      return { session, first };
    } catch (error) {
      peer.destroy();
      throw error;
    }
  }

  setListener(listener: ClientSessionListener): void {
    this.listener = listener;
    const held = this.heldMessages;
    this.heldMessages = [];
    held.forEach((message) => listener.onMessage(message));
    if (this.disconnectReason) listener.onDisconnected(this.disconnectReason);
  }

  /** Stop delivering messages for now; they're held for the next listener. */
  pauseListener(): void {
    this.listener = null;
  }

  async openGameChannels(): Promise<void> {
    const channels = await openGameChannels(this.connection.peerConnection);
    this.lastSnapshotAt = performance.now();
    channels.fast.addEventListener('message', (event: MessageEvent<ArrayBuffer>) => {
      const packet = decodePacket(event.data);
      if (packet?.type !== 'snapshot') return;
      this.lastSnapshotAt = performance.now();
      this.listener?.onSnapshot?.(packet.snapshot);
    });
    channels.events.addEventListener('message', (event: MessageEvent<ArrayBuffer>) => this.listener?.onEvents?.(event.data));
    this.fastChannel = channels.fast;
  }

  sendPreferences(autoSwitchWeapons: boolean): void {
    this.send({ type: 'preferences', autoSwitchWeapons });
  }

  sendInputs(frames: InputFrame[]): void {
    if (this.fastChannel) sendIfOpen(this.fastChannel, encodeInputPacket(frames));
  }

  private waitForEntry(): Promise<WelcomeMessage | LobbyMessage> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('The host did not respond.')), NETWORK.connectTimeoutMs);
      const finish = (outcome: () => void) => {
        clearTimeout(timeout);
        this.pauseListener();
        outcome();
      };
      this.setListener({
        onMessage: (message) => {
          if (message.type === 'welcome' || message.type === 'lobby') finish(() => resolve(message));
          else if (message.type === 'rejected') finish(() => reject(new Error(rejectionMessage(message))));
        },
        onDisconnected: (reason) => finish(() => reject(new Error(reason))),
      });
    });
  }

  private receive(data: unknown): void {
    if (!isHostMessage(data)) return;
    if (data.type === 'pong') return this.listener?.onPing?.(performance.now() - data.sentAt);
    if (data.type === 'kicked') return this.disconnect(KICKED);
    if (data.type === 'gameEnded') return this.disconnect(GAME_ENDED);
    if (this.listener) this.listener.onMessage(data);
    else this.heldMessages.push(data);
  }

  private heartbeat(): void {
    this.send({ type: 'ping', sentAt: performance.now() });
    if (this.stallGuard.wasStalled()) {
      this.lastSnapshotAt = performance.now();
      return;
    }
    const silent = this.fastChannel && performance.now() - this.lastSnapshotAt > NETWORK.silenceTimeoutMs;
    if (silent) this.disconnect(CONNECTION_LOST);
  }

  /** Only the first reason counts: a kick is followed by the connection closing, and that's not news. */
  private disconnect(reason: string): void {
    if (this.disconnectReason) return;
    this.disconnectReason = reason;
    this.listener?.onDisconnected(reason);
  }

  private send(message: ClientMessage): void {
    if (this.connection.open) this.connection.send(message);
  }
}

const DIRECT_CONNECTION_FAILED =
  "Couldn't connect to the host. One of the networks may be blocking peer-to-peer connections. " +
  'On a Mac, check your browser is allowed under System Settings → Privacy & Security → Local Network.';

function waitForConnection(peer: Peer, connection: DataConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    };
    const timeout = setTimeout(() => fail(new Error(DIRECT_CONNECTION_FAILED)), NETWORK.connectTimeoutMs);

    connection.once('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    // A failed ICE negotiation is reported on the connection rather than the peer.
    connection.once('error', () => fail(new Error(DIRECT_CONNECTION_FAILED)));
    peer.once('error', fail);
  });
}
