// Browsers pause requestAnimationFrame in background tabs, but timers in workers keep running.
// The game loop listens to this heartbeat so the simulation (and a host's game) continues while hidden.
const HEARTBEAT_MS = 20;

setInterval(() => (self as unknown as Worker).postMessage(null), HEARTBEAT_MS);
