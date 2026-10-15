import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/gameplay-config';
import { addWeapon } from '../src/sim/loadout';
import { LaggedMatch } from './helpers/lagged-match';
import { findEvent, ticks } from './helpers/sim-world';

// 100 ms each way.
const DELAY_TICKS = 6;
const RIGHT = 0;
const LEFT = Math.PI;

/** Lets the first snapshots arrive, so the client knows its own tank. */
function connect(match: LaggedMatch): void {
  for (let tick = 0; tick < DELAY_TICKS * 3; tick++) match.step({});
}

function fireOnce(match: LaggedMatch, aimAngle: number): void {
  match.step({ aimAngle, firing: true });
  match.step({ aimAngle, firing: false });
}

describe('predicted shots over a laggy connection', () => {
  it('shows our shell leaving the barrel at once, and only ever one copy of it', () => {
    // Open ground along the bottom of Meadow.
    const match = new LaggedMatch(DELAY_TICKS, { x: 3.5, y: 18.5 }, { x: 24.5, y: 2.5 });
    connect(match);
    fireOnce(match, RIGHT);

    const [shell] = match.visibleProjectiles();
    expect(shell?.kind).toBe('shell');
    expect(shell.x - 3.5).toBeLessThan(GAMEPLAY.tank.barrelLength + 0.5);

    let mostSeenAtOnce = 0;
    for (let tick = 0; tick < ticks(1); tick++) {
      match.step({ aimAngle: RIGHT });
      mostSeenAtOnce = Math.max(mostSeenAtOnce, match.visibleProjectiles().length);
    }
    expect(mostSeenAtOnce).toBe(1);
  });

  it("removes our shell soon after the host says it hit a tank, rather than flying on", () => {
    const match = new LaggedMatch(DELAY_TICKS, { x: 3.5, y: 18.5 }, { x: 8.5, y: 18.5 });
    connect(match);
    fireOnce(match, RIGHT);

    let hitTick: number | null = null;
    let goneTick: number | null = null;
    for (let tick = 0; tick < ticks(2) && goneTick === null; tick++) {
      match.step({ aimAngle: RIGHT });
      if (hitTick === null && findEvent(match.hostEvents, 'tankDamaged')) hitTick = tick;
      if (hitTick !== null && match.visibleProjectiles().length === 0) goneTick = tick;
    }
    expect(hitTick).not.toBeNull();
    expect(goneTick).not.toBeNull();
    // About one delay for the snapshot to arrive, plus up to one snapshot interval.
    expect(goneTick! - hitTick!).toBeLessThanOrEqual(DELAY_TICKS + 4);
  });

  it("stops our shell at a wall straight away and doesn't show the host's late copy", () => {
    // Meadow's left wall face is at x = 1.
    const match = new LaggedMatch(DELAY_TICKS, { x: 3, y: 18.5 }, { x: 24.5, y: 2.5 });
    connect(match);
    fireOnce(match, LEFT);

    let shownAfterWall = 0;
    let reachedWall = false;
    for (let tick = 0; tick < ticks(1); tick++) {
      match.step({ aimAngle: LEFT });
      const visible = match.visibleProjectiles().length;
      if (!reachedWall && visible === 0) reachedWall = true;
      else if (reachedWall) shownAfterWall += visible;
    }
    expect(reachedWall).toBe(true);
    expect(shownAfterWall).toBe(0);
  });

  it('keeps a rocket at the wall it hit, never doubled, until the host has blown it up', () => {
    const match = new LaggedMatch(DELAY_TICKS, { x: 4, y: 18.5 }, { x: 24.5, y: 2.5 });
    addWeapon(match.world.tanks.get('client')!.loadout, 'rocket');
    connect(match);
    fireOnce(match, LEFT);

    let mostSeenAtOnce = 0;
    for (let tick = 0; tick < ticks(1.5); tick++) {
      match.step({ aimAngle: LEFT });
      mostSeenAtOnce = Math.max(mostSeenAtOnce, match.visibleProjectiles().length);
    }
    expect(findEvent(match.hostEvents, 'explosion')).toBeDefined();
    expect(mostSeenAtOnce).toBe(1);
    expect(match.visibleProjectiles()).toHaveLength(0);
  });
});
