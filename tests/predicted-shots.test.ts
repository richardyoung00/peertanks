import { describe, expect, it } from 'vitest';
import type { ProjectileSnapshot } from '../src/net/packets';
import { PredictedShots } from '../src/net/predicted-shots';
import { createPhysicsWorld } from '../src/sim/physics';
import { ARENA, ticks } from './helpers/sim-world';

const OWN = 3;
const LEFT = Math.PI;

function setup() {
  const physics = createPhysicsWorld(ARENA);
  // Rapier's ray casts only see colliders once the world has stepped.
  physics.step();
  return new PredictedShots(physics);
}

function realShot(id: number, kind: ProjectileSnapshot['kind'], ownerNetId = OWN): ProjectileSnapshot {
  return { id, kind, ownerNetId, x: 0, y: 0, vx: 0, vy: 0, height: 0.4 };
}

function runUntilImpact(shots: PredictedShots, maxSeconds: number) {
  for (let tick = 0; tick < ticks(maxSeconds); tick++) {
    const impacts = shots.step();
    if (impacts.length > 0) return impacts[0];
  }
  return null;
}

describe('predicted shots', () => {
  it('shows a shell straight away and stops it at the wall it hits', () => {
    const shots = setup();
    // Meadow's left wall is column 0, so its face is at x = 1.
    shots.fire('cannon', { x: 4.5, y: 1.5 }, LEFT);
    expect(shots.views(0)).toHaveLength(1);

    const impact = runUntilImpact(shots, 1);
    expect(impact?.x).toBeCloseTo(1, 1);
    expect(shots.views(0)).toHaveLength(0);
  });

  it('bounces a bouncy shot off walls instead of stopping', () => {
    const shots = setup();
    shots.fire('bouncy-cannon', { x: 4.5, y: 1.5 }, LEFT);
    runUntilImpact(shots, 1);
    shots.step();
    expect(shots.views(0)).toHaveLength(1);
    expect(Math.cos(shots.views(0)[0].angle)).toBeGreaterThan(0);
  });

  it("hides the host's copy of a predicted shot, and retires the prediction when the host's copy goes", () => {
    const shots = setup();
    shots.fire('cannon', { x: 10.5, y: 18.5 }, 0);
    shots.step();
    shots.reconcile([realShot(7, 'shell')], OWN);
    expect(shots.hides(realShot(7, 'shell'), OWN)).toBe(true);

    // The host says the shell hit something: it's gone from the next snapshot.
    shots.reconcile([], OWN);
    shots.step();
    expect(shots.views(0)).toHaveLength(0);
  });

  it('still hides a late host copy of a shell that already hit a nearby wall', () => {
    const shots = setup();
    shots.fire('cannon', { x: 2, y: 1.5 }, LEFT);
    runUntilImpact(shots, 0.5);
    shots.reconcile([realShot(8, 'shell')], OWN);
    expect(shots.hides(realShot(8, 'shell'), OWN)).toBe(true);
  });

  it("draws real shots that weren't predicted, and never hides other players' shots", () => {
    const shots = setup();
    shots.reconcile([realShot(9, 'rocket')], OWN);
    expect(shots.hides(realShot(9, 'rocket'), OWN)).toBe(false);
    expect(shots.hides(realShot(10, 'shell', OWN + 1), OWN)).toBe(false);
    expect(shots.hides(realShot(11, 'grenade'), OWN)).toBe(false);
  });

  it('bursts at the barrel when it is pressed against a wall', () => {
    const shots = setup();
    const blocked = shots.fire('cannon', { x: 1.45, y: 1.5 }, LEFT);
    expect(blocked).not.toBeNull();
    expect(shots.views(0)).toHaveLength(0);
  });
});
