// A browser tab can freeze for seconds (e.g. compiling shaders on a slow machine). When it wakes up,
// queued timers fire before queued network messages, so silence checks would wrongly blame the network.
const STALL_FACTOR = 3;

/** Tells a repeating check whether this run came so late that the page itself must have been frozen. */
export class StallGuard {
  private lastRunAt = performance.now();

  constructor(private readonly intervalMs: number) {}

  /** Call at the start of each run; true means skip this run's silence checks. */
  wasStalled(): boolean {
    const now = performance.now();
    const stalled = now - this.lastRunAt > this.intervalMs * STALL_FACTOR;
    this.lastRunAt = now;
    return stalled;
  }
}
