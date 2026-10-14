export const SIM_TICK_RATE = 60;
export const SIM_DT = 1 / SIM_TICK_RATE;

export const NETWORK = {
  /**
   * Namespaces our IDs on the shared public PeerJS server. Never change this: old and new builds must be able
   * to find each other so the join-time version check can tell players to refresh.
   */
  peerIdPrefix: 'peertanks-',
  snapshotEveryTicks: 3,
  interpolationDelay: 0.1,
  pingIntervalMs: 1000,
  connectTimeoutMs: 10000,
  /** WebRTC can take 30s+ to notice a vanished peer, so give up on silent connections sooner. */
  silenceTimeoutMs: 5000,
  maxPlayers: 8,
  inputRedundancy: 3,
};

// STUN finds each player's public address so they can connect directly; that covers most home networks.
// There is deliberately no TURN relay yet: the free no-signup ones (PeerJS, Open Relay static auth) are offline.
// If players on strict networks can't connect, add a TURN entry here (e.g. ExpressTURN or Metered, both need
// a free signup). Anything added here ships in the public JavaScript.
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export const PLAYER_COLORS = [0x3b82f6, 0xef4444, 0xf59e0b, 0x10b981, 0xa855f7, 0xec4899, 0x14b8a6, 0xf97316];
