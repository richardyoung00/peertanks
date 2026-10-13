const FULL_TURN = Math.PI * 2;

/** Wraps an angle into the range (-PI, PI]. */
export function wrapAngle(angle: number): number {
  const wrapped = ((angle + Math.PI) % FULL_TURN + FULL_TURN) % FULL_TURN - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

export function rotateTowards(current: number, target: number, maxStep: number): number {
  const difference = wrapAngle(target - current);
  if (Math.abs(difference) <= maxStep) return target;
  return current + Math.sign(difference) * maxStep;
}

export function lerpAngle(from: number, to: number, t: number): number {
  return from + wrapAngle(to - from) * t;
}
