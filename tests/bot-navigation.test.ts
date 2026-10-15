import { describe, expect, it } from 'vitest';
import { KeyboardSteering } from '../src/bots/keyboard-steering';
import { NavGrid } from '../src/bots/nav-grid';
import { PathFollower } from '../src/bots/path-follower';
import { SIM_DT } from '../src/config';
import type { MapPoint } from '../src/sim/game-map';
import { ARENA, CROSSROADS } from './helpers/sim-world';

function closestHazardDistance(grid: NavGrid, path: MapPoint[]): number {
  return Math.min(...path.map((point) => grid.hazardDistanceAt(point.x, point.y)));
}

describe('nav grid', () => {
  it('crosses the river by a bridge, never through water', () => {
    const grid = new NavGrid(CROSSROADS);
    const path = grid.findPath({ x: 4.5, y: 8.5 }, { x: 4.5, y: 17.5 }, 1);
    expect(path).not.toBeNull();
    expect(path?.some((point) => grid.isHazardAt(point.x, point.y))).toBe(false);
    const onBridge = path?.filter((point) => point.y > 12 && point.y < 14) ?? [];
    expect(onBridge.every((point) => point.x > 8 && point.x < 11)).toBe(true);
  });

  it('keeps careful bots further from water than careless ones', () => {
    // Down the left side of Meadow, past the pond in columns 2-6.
    const grid = new NavGrid(ARENA);
    const careless = grid.findPath({ x: 1.5, y: 4.5 }, { x: 1.5, y: 11.5 }, 0);
    const careful = grid.findPath({ x: 1.5, y: 4.5 }, { x: 1.5, y: 11.5 }, 1);
    expect(careless && careful).toBeTruthy();
    expect(closestHazardDistance(grid, careful!)).toBeGreaterThan(closestHazardDistance(grid, careless!));
  });

  it('finds the nearest open tile to a point inside a wall', () => {
    const grid = new NavGrid(ARENA);
    const tile = grid.nearestOpenTile({ x: 10.5, y: 4.5 });
    expect(tile && grid.isOpenAt(tile.x, tile.y)).toBe(true);
  });

  it('sees walls and hazards in the way of a straight line', () => {
    const grid = new NavGrid(ARENA);
    expect(grid.hasClearLine({ x: 2.5, y: 1.5 }, { x: 20.5, y: 1.5 }, 0.45)).toBe(true);
    expect(grid.hasClearLine({ x: 10.5, y: 2.5 }, { x: 10.5, y: 6.5 }, 0.45)).toBe(false);
    expect(grid.hasClearLine({ x: 12.5, y: 8.5 }, { x: 19.5, y: 8.5 }, 0.45)).toBe(false);
  });
});

describe('path follower', () => {
  it('cuts straight across open ground instead of following every tile', () => {
    const grid = new NavGrid(ARENA);
    const follower = new PathFollower(grid);
    expect(follower.goTo({ x: 2.5, y: 18.5 }, { x: 15.5, y: 18.5 }, 1)).toBe(true);
    const direction = follower.direction({ x: 2.5, y: 18.5 });
    expect(direction?.x).toBeCloseTo(1, 3);
    expect(direction?.y).toBeCloseTo(0, 3);
  });
});

describe('keyboard steering', () => {
  it('only presses whole keys and holds them for a moment', () => {
    const steering = new KeyboardSteering(new NavGrid(ARENA));
    const position = { x: 3.5, y: 18.5 };
    const first = steering.steer({ x: 0.9, y: 0.3 }, position, SIM_DT, 0.6);
    expect(first).toEqual({ x: 1, y: 0 });

    const straightAfter = steering.steer({ x: 0, y: -1 }, position, SIM_DT, 0.6);
    expect(straightAfter).toEqual(first);

    let later = straightAfter;
    for (let i = 0; i < 12; i++) later = steering.steer({ x: 0, y: -1 }, position, SIM_DT, 0.6);
    expect(later).toEqual({ x: 0, y: -1 });
  });

  it('turns to a neighbouring direction rather than drive into water', () => {
    const steering = new KeyboardSteering(new NavGrid(ARENA));
    // Just right of Meadow's pond, wanting to drive left into it.
    const keys = steering.steer({ x: -1, y: 0 }, { x: 7.5, y: 7.5 }, SIM_DT, 1);
    expect(keys.x === -1 && keys.y === 0).toBe(false);
  });
});
