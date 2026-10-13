import { SIM_DT } from './config';

const MAX_FRAME_TIME = 0.25;

function secondsSince(previousMs: number, nowMs: number): number {
  return Math.min(Math.max((nowMs - previousMs) / 1000, 0), MAX_FRAME_TIME);
}

/**
 * Runs the simulation at a fixed rate and renders as fast as the browser allows.
 * `alpha` tells the renderer how far it is between the last two ticks, for smooth interpolation.
 */
export function startGameLoop(tick: () => void, render: (alpha: number, frameDt: number) => void): void {
  let lastTickCheck = performance.now();
  let lastFrame = performance.now();
  let accumulator = 0;

  function runDueTicks(now: number): void {
    accumulator += secondsSince(lastTickCheck, now);
    lastTickCheck = now;
    while (accumulator >= SIM_DT) {
      tick();
      accumulator -= SIM_DT;
    }
  }

  // Uses performance.now() rather than the requestAnimationFrame timestamp, which can lag behind it,
  // so both this and the background heartbeat measure time on the same clock.
  function frame(): void {
    const now = performance.now();
    runDueTicks(now);
    const frameDt = secondsSince(lastFrame, now);
    lastFrame = now;
    render(accumulator / SIM_DT, frameDt);
    requestAnimationFrame(frame);
  }

  const heartbeat = new Worker(new URL('./heartbeat-worker.ts', import.meta.url), { type: 'module' });
  heartbeat.onmessage = () => {
    if (document.hidden) runDueTicks(performance.now());
  };

  requestAnimationFrame(frame);
}
