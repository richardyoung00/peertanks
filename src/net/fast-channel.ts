// PeerJS's "unreliable" option only disables ordering; lost packets are still resent, which causes lag spikes.
// So alongside each PeerJS connection we open our own channel that never resends. Both sides create it with
// the same pre-agreed id ("negotiated"), so no extra signalling is needed.
const FAST_CHANNEL_ID = 100;
const OPEN_TIMEOUT_MS = 5000;

export function openFastChannel(peerConnection: RTCPeerConnection): Promise<RTCDataChannel> {
  const channel = peerConnection.createDataChannel('fast', {
    negotiated: true,
    id: FAST_CHANNEL_ID,
    ordered: false,
    maxRetransmits: 0,
  });
  channel.binaryType = 'arraybuffer';
  return waitForOpen(channel);
}

function waitForOpen(channel: RTCDataChannel): Promise<RTCDataChannel> {
  if (channel.readyState === 'open') return Promise.resolve(channel);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Fast data channel did not open')), OPEN_TIMEOUT_MS);
    channel.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve(channel);
    });
  });
}

export function sendIfOpen(channel: RTCDataChannel, data: ArrayBuffer): void {
  if (channel.readyState === 'open') channel.send(data);
}
