import Peer, { PeerErrorType, type PeerError } from 'peerjs';
import { ICE_SERVERS, NETWORK } from '../config';

// No 0/O or 1/I/L, so codes are easy to read out loud.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;
const MAX_HOST_ID_ATTEMPTS = 3;

const peerOptions = { config: { iceServers: ICE_SERVERS }, debug: 1 };

export function generateJoinCode(): string {
  const randomValues = crypto.getRandomValues(new Uint32Array(JOIN_CODE_LENGTH));
  return Array.from(randomValues, (value) => JOIN_CODE_ALPHABET[value % JOIN_CODE_ALPHABET.length]).join('');
}

export function normaliseJoinCode(code: string): string {
  return code.trim().toUpperCase();
}

export function hostPeerId(code: string): string {
  return NETWORK.peerIdPrefix + normaliseJoinCode(code);
}

export function joinLink(code: string): string {
  return `${location.origin}${location.pathname}#join=${code}`;
}

export function readJoinCodeFromUrl(): string | null {
  const match = location.hash.match(/join=([A-Za-z0-9]+)/);
  return match ? normaliseJoinCode(match[1]) : null;
}

function openPeer(id?: string): Promise<Peer> {
  const peer = id ? new Peer(id, peerOptions) : new Peer(peerOptions);
  return new Promise((resolve, reject) => {
    peer.once('open', () => resolve(peer));
    peer.once('error', (error) => {
      peer.destroy();
      reject(error);
    });
  });
}

/** Registers a host peer under a fresh join code, retrying if the code happens to be taken. */
export async function openHostPeer(): Promise<{ peer: Peer; code: string }> {
  for (let attempt = 1; ; attempt++) {
    const code = generateJoinCode();
    try {
      const peer = await openPeer(hostPeerId(code));
      keepRegistered(peer);
      closeOnPageExit(peer);
      return { peer, code };
    } catch (error) {
      const codeTaken = (error as PeerError<string>).type === PeerErrorType.UnavailableID;
      if (!codeTaken || attempt >= MAX_HOST_ID_ATTEMPTS) throw error;
    }
  }
}

export function openClientPeer(): Promise<Peer> {
  return openPeer();
}

/** Closing connections when the tab goes away lets the other side notice straight away. */
export function closeOnPageExit(peer: Peer): void {
  window.addEventListener('pagehide', () => peer.destroy());
}

/** The signalling server is only needed for new joins, so reconnect quietly if it drops. */
function keepRegistered(peer: Peer): void {
  peer.on('disconnected', () => {
    if (!peer.destroyed) peer.reconnect();
  });
}

export function describeConnectionError(error: unknown): string {
  const type = (error as PeerError<string> | undefined)?.type;
  switch (type) {
    case PeerErrorType.PeerUnavailable:
      return 'No game found with that code. Check the code, or ask the host for a new link.';
    case PeerErrorType.BrowserIncompatible:
      return 'This browser does not support peer-to-peer connections. Try a recent Chrome, Firefox or Safari.';
    case PeerErrorType.Network:
    case PeerErrorType.ServerError:
    case PeerErrorType.SocketError:
    case PeerErrorType.SocketClosed:
      return 'Could not reach the matchmaking server. Check your internet connection and try again.';
    case PeerErrorType.WebRTC:
      return 'A direct connection could not be made. One of the networks may be blocking peer-to-peer traffic.';
  }
  return error instanceof Error ? error.message : 'Something went wrong while connecting.';
}
