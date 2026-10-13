import { SIM_DT } from './config';

const MAX_FRAME_TIME = 0.25;

/**
 * Runs the simulation at a fixed rate and renders as fast as the browser allows.
 * `alpha` tells the renderer how far it is between the last two ticks, for smooth interpolation.
 */
export function startGameLoop(tick: () => void, render: (alpha: number, frameDt: number) => void): void {
  let previousTime = performance.now();
  let accumulator = 0;

  function frame(now: number): void {
    const frameDt = Math.min((now - previousTime) / 1000, MAX_FRAME_TIME);
    previousTime = now;
    accumulator += frameDt;

    while (accumulator >= SIM_DT) {
      tick();
      accumulator -= SIM_DT;
    }

    render(accumulator / SIM_DT, frameDt);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
