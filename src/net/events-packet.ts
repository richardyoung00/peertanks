import type { GameEvent } from '../sim/game-events';
import { ByteReader, ByteWriter } from './binary';
import { EventReader, EventWriter, readEvent, writeEvent } from './event-codecs';

// Binary events sent over the events channel. The host gathers each tick's events and sends them together
// with every snapshot, each group tagged with its tick so they can arrive in any order.
const STARTING_CAPACITY = 256;

export interface EventGroup {
  tick: number;
  events: GameEvent[];
}

export function encodeEventPacket(groups: EventGroup[], netIdOf: (playerId: string) => number | undefined): ArrayBuffer {
  const out = new EventWriter(new ByteWriter(STARTING_CAPACITY), netIdOf);
  out.bytes.u16(groups.length);
  for (const { tick, events } of groups) {
    out.bytes.u32(tick);
    out.bytes.u16(events.length);
    events.forEach((event) => writeEvent(out, event));
  }
  return out.bytes.finish();
}

export function decodeEventPacket(data: ArrayBuffer, playerIdOf: (netId: number) => string): EventGroup[] {
  const input = new EventReader(new ByteReader(data), playerIdOf);
  return Array.from({ length: input.bytes.u16() }, () => {
    const tick = input.bytes.u32();
    const events = Array.from({ length: input.bytes.u16() }, () => readEvent(input));
    return { tick, events };
  });
}
