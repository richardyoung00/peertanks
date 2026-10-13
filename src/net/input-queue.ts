import { IDLE_INPUT, type PlayerInput } from '../sim/player-input';
import type { InputFrame } from './packets';

// If a client's inputs pile up (e.g. after a lag spike), drop the oldest so their controls don't feel delayed.
const MAX_QUEUED = 4;
const QUEUE_AFTER_TRIM = 2;
// If a client goes quiet for this many ticks, stop repeating their last input so their tank doesn't drive off.
const MAX_REPEATED_TICKS = 15;

/**
 * Buffers one client's inputs on the host. Packets can arrive late, twice or out of order,
 * so frames are de-duplicated and sorted by sequence number. One frame is used per tick.
 */
export class InputQueue {
  lastAppliedSeq = 0;
  private pending: InputFrame[] = [];
  private lastInput: PlayerInput = IDLE_INPUT;
  private ticksWithoutInput = 0;

  add(frames: InputFrame[]): void {
    for (const frame of frames) {
      const alreadyQueued = this.pending.some((queued) => queued.seq === frame.seq);
      if (frame.seq > this.lastAppliedSeq && !alreadyQueued) this.pending.push(frame);
    }
    this.pending.sort((a, b) => a.seq - b.seq);
  }

  /** The input to apply this tick. Briefly repeats the last input if nothing new has arrived. */
  next(): PlayerInput {
    if (this.pending.length > MAX_QUEUED) this.pending.splice(0, this.pending.length - QUEUE_AFTER_TRIM);
    const frame = this.pending.shift();
    if (frame) {
      this.lastInput = frame.input;
      this.lastAppliedSeq = frame.seq;
      this.ticksWithoutInput = 0;
      return frame.input;
    }
    this.ticksWithoutInput++;
    return this.ticksWithoutInput > MAX_REPEATED_TICKS ? IDLE_INPUT : this.lastInput;
  }
}
