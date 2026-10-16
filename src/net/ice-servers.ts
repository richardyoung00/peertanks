import { FALLBACK_ICE_SERVERS, RELAY_LOGIN_URL } from '../config';

const RELAY_LOGIN_TIMEOUT_MS = 3000;

/**
 * The servers that help players find a route to each other: Cloudflare's STUN and TURN relay with a fresh login,
 * or the fallback list if the login can't be fetched in time.
 */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const response = await fetch(RELAY_LOGIN_URL, { signal: AbortSignal.timeout(RELAY_LOGIN_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const { iceServers } = (await response.json()) as { iceServers: RTCIceServer[] };
    return iceServers;
  } catch (error) {
    console.warn('Using the fallback relay: no relay login', error);
    return FALLBACK_ICE_SERVERS;
  }
}
