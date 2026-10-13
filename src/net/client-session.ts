import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { NETWORK } from '../config';
import { openFastChannel, sendIfOpen } from './fast-channel';
import { isHostMessage, type ClientMessage, type HostMessage, type JoinMetadata } from './messages';
import { decodePacket, encodeInputPacket, type InputFrame, type Snapshot } from './packets';
import { closeOnPageExit, hostPeerId, openClientPeer } from './peer';

export type WelcomeMessage = Extract<HostMessage, { type: 'welcome' }>;

export interface ClientSessionListener {
  onSnapshot(snapshot: Snapshot): void;
  onMessage(message: HostMessage): void;
  onPing(roundTripMs: number): void;
  onDisconnected(reason: string): void;
}

/** A joining player's side of the network: sends inputs to the host and receives the game state. */
export class ClientSession {
  private listener: ClientSessionListener | null = null;

  private constructor(
    private readonly peer: Peer,
    private readonly connection: DataConnection,
    private readonly fastChannel: RTCDataChannel,
    private messagesBeforeStart: unknown[],
  ) {
    connection.on('data', (data) => {
      if (this.listener) this.handleMessage(data);
      else this.messagesBeforeStart.push(data);
    });
  }

  static async join(code: string, name: string): Promise<{ session: ClientSession; welcome: WelcomeMessage }> {
    const peer = await openClientPeer();
    try {
      const metadata: JoinMetadata = { name };
      const connection = peer.connect(hostPeerId(code), { reliable: true, serialization: 'json', metadata });

      // The host may send the welcome (and more) before our fast channel is ready, so keep everything.
      const earlyMessages: unknown[] = [];
      const collect = (data: unknown) => earlyMessages.push(data);
      connection.on('data', collect);
      const welcomeArrival = waitForWelcome(connection);
      welcomeArrival.catch(() => {});

      await waitForConnection(peer, connection);
      const fastChannel = await openFastChannel(connection.peerConnection);
      const welcome = await welcomeArrival;
      connection.off('data', collect);

      const laterMessages = earlyMessages.filter((message) => message !== welcome);
      return { session: new ClientSession(peer, connection, fastChannel, laterMessages), welcome };
    } catch (error) {
      peer.destroy();
      throw error;
    }
  }

  start(listener: ClientSessionListener): void {
    this.listener = listener;
    this.messagesBeforeStart.forEach((data) => this.handleMessage(data));
    this.messagesBeforeStart = [];
    let lastSnapshotAt = performance.now();
    this.fastChannel.addEventListener('message', (event: MessageEvent<ArrayBuffer>) => {
      const packet = decodePacket(event.data);
      if (packet?.type !== 'snapshot') return;
      lastSnapshotAt = performance.now();
      listener.onSnapshot(packet.snapshot);
    });

    let disconnected = false;
    const disconnect = (reason: string) => {
      if (disconnected) return;
      disconnected = true;
      listener.onDisconnected(reason);
    };

    this.connection.on('close', () => disconnect('The host left the game.'));
    this.peer.on('error', () => disconnect('Lost connection to the host.'));
    setInterval(() => {
      this.send({ type: 'ping', sentAt: performance.now() });
      if (performance.now() - lastSnapshotAt > NETWORK.silenceTimeoutMs) disconnect('Lost connection to the host.');
    }, NETWORK.pingIntervalMs);
    closeOnPageExit(this.peer);
  }

  sendInputs(frames: InputFrame[]): void {
    sendIfOpen(this.fastChannel, encodeInputPacket(frames));
  }

  private handleMessage(data: unknown): void {
    if (!isHostMessage(data) || !this.listener) return;
    if (data.type === 'pong') this.listener.onPing(performance.now() - data.sentAt);
    else this.listener.onMessage(data);
  }

  private send(message: ClientMessage): void {
    if (this.connection.open) this.connection.send(message);
  }
}

function waitForConnection(peer: Peer, connection: DataConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out connecting to the host. Their network may be blocking peer-to-peer traffic.')),
      NETWORK.connectTimeoutMs,
    );
    connection.once('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    peer.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function waitForWelcome(connection: DataConnection): Promise<WelcomeMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('The host did not respond.')), NETWORK.connectTimeoutMs);
    const handleData = (data: unknown) => {
      if (!isHostMessage(data)) return;
      if (data.type === 'welcome') {
        clearTimeout(timeout);
        connection.off('data', handleData);
        resolve(data);
      } else if (data.type === 'rejected') {
        clearTimeout(timeout);
        reject(new Error(data.reason));
      }
    };
    connection.on('data', handleData);
  });
}
