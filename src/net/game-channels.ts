// PeerJS's "unreliable" option only disables ordering; lost packets are still resent, which causes lag spikes.
// So alongside each PeerJS connection we open our own channels. Both sides create them with the same
// pre-agreed ids ("negotiated"), so no extra signalling is needed.
const FAST_CHANNEL_ID = 100;
const EVENT_CHANNEL_ID = 101;
const OPEN_TIMEOUT_MS = 5000;

export interface GameChannels {
  /** Inputs and snapshots. Never resends: a lost packet is replaced by the next one anyway. */
  fast: RTCDataChannel;
  /** Events. Resends lost packets, but without holding later ones back to keep them in order. */
  events: RTCDataChannel;
}

/** Creates both channels straight away, so they exist on our side before anything is sent on either. */
export async function openGameChannels(peerConnection: RTCPeerConnection): Promise<GameChannels> {
  const fast = createChannel(peerConnection, 'fast', { id: FAST_CHANNEL_ID, maxRetransmits: 0 });
  const events = createChannel(peerConnection, 'events', { id: EVENT_CHANNEL_ID });
  await Promise.all([waitForOpen(fast), waitForOpen(events)]);
  return { fast, events };
}

function createChannel(peerConnection: RTCPeerConnection, label: string, options: RTCDataChannelInit): RTCDataChannel {
  const channel = peerConnection.createDataChannel(label, { ...options, negotiated: true, ordered: false });
  channel.binaryType = 'arraybuffer';
  return channel;
}

function waitForOpen(channel: RTCDataChannel): Promise<void> {
  if (channel.readyState === 'open') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`The ${channel.label} data channel did not open`)), OPEN_TIMEOUT_MS);
    channel.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

export function sendIfOpen(channel: RTCDataChannel, data: ArrayBuffer): void {
  if (channel.readyState === 'open') channel.send(data);
}
