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
  /** A joining player's first frames can stall for seconds while shaders compile on slow machines. */
  joinGraceMs: 15000,
  maxPlayers: 8,
  inputRedundancy: 3,
};

interface TurnRelay {
  server: string;
  username: string;
  credential: string;
}

/** From TURN_SERVER, TURN_USERNAME and TURN_PASSWORD at build time (.env locally, secrets on deploy); null without them. */
declare const __TURN_RELAY__: TurnRelay | null;

// STUN finds each player's public address so they can connect directly; that covers most home networks.
// When that fails (e.g. a phone connection behind the carrier's shared NAT), traffic goes through the TURN relay
// (ExpressTURN's free plan). Its login ships in the public JavaScript; at worst someone uses up the monthly
// allowance, and the login can be regenerated from the ExpressTURN dashboard.
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  ...relayServers(__TURN_RELAY__),
];

function relayServers(relay: TurnRelay | null): RTCIceServer[] {
  if (!relay) return [];
  const { server, username, credential } = relay;
  return [{ urls: [`turn:${server}?transport=udp`, `turn:${server}?transport=tcp`], username, credential }];
}

export const PLAYER_COLORS = [0x3b82f6, 0xef4444, 0xf59e0b, 0x10b981, 0xa855f7, 0xec4899, 0x14b8a6, 0xf97316];
