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

/**
 * Hands out short-lived logins for Cloudflare's TURN relay (workers/turn-credentials). Cloudflare relays from the
 * location nearest each player, so relayed games stay quick. Asked just before hosting or joining.
 */
export const RELAY_LOGIN_URL = 'https://peertanks-turn.awesome-friends-recipes.workers.dev';

// Used only if the relay login can't be fetched. STUN finds each player's public address so they can connect
// directly, which covers most home networks; when that fails (e.g. a phone behind the carrier's shared NAT),
// traffic goes through ExpressTURN's free relay instead. It's in Amsterdam, so it's slow from far away. Its login
// ships in the public JavaScript; at worst someone uses up the monthly allowance, and it can be regenerated.
export const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
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
