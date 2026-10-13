export const SIM_TICK_RATE = 60;
export const SIM_DT = 1 / SIM_TICK_RATE;

export const TANK = {
  radius: 0.42,
  maxSpeed: 4.2,
  acceleration: 28,
  hullTurnRate: 9,
  barrelLength: 0.6,
};

export const NETWORK = {
  /** Namespaces our IDs on the shared public PeerJS server. Bump the version on breaking protocol changes. */
  peerIdPrefix: 'tanks-game-v1-',
  snapshotEveryTicks: 3,
  interpolationDelay: 0.1,
  pingIntervalMs: 1000,
  connectTimeoutMs: 10000,
  /** WebRTC can take 30s+ to notice a vanished peer, so give up on silent connections sooner. */
  silenceTimeoutMs: 5000,
  maxPlayers: 8,
  inputRedundancy: 3,
};

// STUN finds each player's public address; TURN relays traffic when a direct connection is impossible.
// The PeerJS TURN servers are free public ones. Add your own TURN entry here if players struggle to connect;
// note that anything added here ships in the public JavaScript.
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'],
    username: 'peerjs',
    credential: 'peerjsp',
  },
];

export const PLAYER_COLORS =[0x3b82f6, 0xef4444, 0xf59e0b, 0x10b981, 0xa855f7, 0xec4899, 0x14b8a6, 0xf97316];
