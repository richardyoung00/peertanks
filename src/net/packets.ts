import { ByteReader, ByteWriter } from './binary';
import { INPUT_FRAME_BYTES, readInputFrame, writeInputFrame, type InputFrame } from './input-packet';
import { readSnapshot, snapshotSize, writeSnapshot, type Snapshot } from './snapshot-packet';

export type { InputFrame } from './input-packet';
export type { OwnStatus, ProjectileSnapshot, RoundSnapshot, Snapshot, TankSnapshot } from './snapshot-packet';
export { NO_OWNER } from './snapshot-packet';

// Binary packets sent over the fast (unreliable) channel. The first byte says which kind it is.
const PACKET_INPUT = 1;
const PACKET_SNAPSHOT = 2;

export type DecodedPacket = { type: 'input'; frames: InputFrame[] } | { type: 'snapshot'; snapshot: Snapshot };

export function encodeInputPacket(frames: InputFrame[]): ArrayBuffer {
  const writer = new ByteWriter(2 + frames.length * INPUT_FRAME_BYTES);
  writer.u8(PACKET_INPUT);
  writer.u8(frames.length);
  frames.forEach((frame) => writeInputFrame(writer, frame));
  return writer.finish();
}

export function encodeSnapshot(snapshot: Snapshot): ArrayBuffer {
  const writer = new ByteWriter(1 + snapshotSize(snapshot));
  writer.u8(PACKET_SNAPSHOT);
  writeSnapshot(writer, snapshot);
  return writer.finish();
}

export function decodePacket(data: ArrayBuffer): DecodedPacket | null {
  const reader = new ByteReader(data);
  const type = reader.u8();
  if (type === PACKET_INPUT) {
    const count = reader.u8();
    return { type: 'input', frames: Array.from({ length: count }, () => readInputFrame(reader)) };
  }
  if (type === PACKET_SNAPSHOT) return { type: 'snapshot', snapshot: readSnapshot(reader) };
  return null;
}
