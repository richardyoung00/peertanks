import type { GameMap, MapPoint } from '../sim/game-map';
import { TERRAIN_RULES } from '../sim/terrain';
import { MinHeap } from './min-heap';

type TileKind = 'open' | 'blocked' | 'hazard';

/** Tiles further than this from a hazard count as safe. */
const HAZARD_DISTANCE_CAP = 3;
/** Extra path cost, at full hazard awareness, for a tile this many steps from a hazard. */
const HAZARD_PENALTY: Record<number, number> = { 1: 6, 2: 1.5 };
/** Fine enough not to step over the corner of a tile. */
const LINE_STEP = 0.1;
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/** The map as bots see it for getting around: which tiles they can drive on and how close each is to danger. */
export class NavGrid {
  readonly width: number;
  readonly height: number;
  private readonly kinds: TileKind[];
  private readonly hazardDistances: number[];

  constructor(map: GameMap) {
    this.width = map.width;
    this.height = map.height;
    this.kinds = map.terrain.map((terrain) => {
      const rules = TERRAIN_RULES[terrain];
      if (rules.blocksTanks) return 'blocked';
      return rules.killsTanks ? 'hazard' : 'open';
    });
    this.hazardDistances = this.measureHazardDistances();
  }

  isOpenAt(x: number, y: number): boolean {
    return this.kindAt(Math.floor(x), Math.floor(y)) === 'open';
  }

  isHazardAt(x: number, y: number): boolean {
    return this.kindAt(Math.floor(x), Math.floor(y)) === 'hazard';
  }

  /** Steps from the nearest water, lava or pit tile (capped at a few). */
  hazardDistanceAt(x: number, y: number): number {
    const index = this.indexOf(Math.floor(x), Math.floor(y));
    return index === null ? HAZARD_DISTANCE_CAP : this.hazardDistances[index];
  }

  /** Whether a tank of the given radius can drive in a straight line from `from` to `to` without touching blocked or hazard tiles. */
  hasClearLine(from: MapPoint, to: MapPoint, clearance: number): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(length / LINE_STEP));
    const sideX = length > 0 ? (-dy / length) * clearance : 0;
    const sideY = length > 0 ? (dx / length) * clearance : 0;
    for (let step = 0; step <= steps; step++) {
      const x = from.x + (dx * step) / steps;
      const y = from.y + (dy * step) / steps;
      if (!this.isOpenAt(x, y) || !this.isOpenAt(x + sideX, y + sideY) || !this.isOpenAt(x - sideX, y - sideY)) return false;
    }
    return true;
  }

  /** The centre of the open tile closest to a point, searching outwards. */
  nearestOpenTile(point: MapPoint): MapPoint | null {
    const startColumn = Math.floor(point.x);
    const startRow = Math.floor(point.y);
    const maxRadius = Math.max(this.width, this.height);
    for (let radius = 0; radius < maxRadius; radius++) {
      let best: MapPoint | null = null;
      let bestDistance = Infinity;
      for (let row = startRow - radius; row <= startRow + radius; row++) {
        for (let column = startColumn - radius; column <= startColumn + radius; column++) {
          const onRing = Math.max(Math.abs(row - startRow), Math.abs(column - startColumn)) === radius;
          if (!onRing || this.kindAt(column, row) !== 'open') continue;
          const distance = Math.hypot(column + 0.5 - point.x, row + 0.5 - point.y);
          if (distance < bestDistance) {
            best = { x: column + 0.5, y: row + 0.5 };
            bestDistance = distance;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** A random open tile centre within `radius` of a point, or anywhere when no radius is given. */
  randomOpenTile(random: () => number, around?: MapPoint, radius = Infinity): MapPoint | null {
    for (let attempt = 0; attempt < 40; attempt++) {
      const column = around ? Math.floor(around.x + (random() * 2 - 1) * radius) : Math.floor(random() * this.width);
      const row = around ? Math.floor(around.y + (random() * 2 - 1) * radius) : Math.floor(random() * this.height);
      if (this.kindAt(column, row) === 'open') return { x: column + 0.5, y: row + 0.5 };
    }
    return null;
  }

  /**
   * The cheapest route over open tiles, as tile centres ending at `to`, or null if there's none.
   * Higher hazard awareness makes routes beside water and lava cost more, so careful bots keep their distance.
   */
  findPath(from: MapPoint, to: MapPoint, hazardAwareness: number): MapPoint[] | null {
    const start = this.indexOfPoint(this.isOpenAt(from.x, from.y) ? from : this.nearestOpenTile(from));
    const goalPoint = this.isOpenAt(to.x, to.y) ? to : this.nearestOpenTile(to);
    const goal = this.indexOfPoint(goalPoint);
    if (start === null || goal === null || !goalPoint) return null;

    const cameFrom = new Map<number, number>();
    const costSoFar = new Map<number, number>([[start, 0]]);
    const frontier = new MinHeap<number>();
    frontier.push(start, 0);

    while (frontier.size > 0) {
      const current = frontier.pop() as number;
      if (current === goal) return this.tracePath(cameFrom, start, goal, goalPoint);
      for (const { index, stepCost } of this.neighboursOf(current)) {
        const cost = (costSoFar.get(current) as number) + stepCost + this.hazardPenalty(index) * hazardAwareness;
        if (cost >= (costSoFar.get(index) ?? Infinity)) continue;
        costSoFar.set(index, cost);
        cameFrom.set(index, current);
        frontier.push(index, cost + this.estimate(index, goal));
      }
    }
    return null;
  }

  private tracePath(cameFrom: Map<number, number>, start: number, goal: number, goalPoint: MapPoint): MapPoint[] {
    const path: MapPoint[] = [goalPoint];
    let index = cameFrom.get(goal);
    while (index !== undefined && index !== start) {
      path.push(this.centreOf(index));
      index = cameFrom.get(index);
    }
    return path.reverse();
  }

  /** Diagonal steps are only allowed when both tiles beside them are open, so tanks don't clip corners. */
  private *neighboursOf(index: number): Generator<{ index: number; stepCost: number }> {
    const column = index % this.width;
    const row = Math.floor(index / this.width);
    for (const [dx, dy] of NEIGHBOURS) {
      if (this.kindAt(column + dx, row + dy) !== 'open') continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (this.kindAt(column + dx, row) !== 'open' || this.kindAt(column, row + dy) !== 'open')) continue;
      yield { index: index + dy * this.width + dx, stepCost: diagonal ? Math.SQRT2 : 1 };
    }
  }

  private hazardPenalty(index: number): number {
    return HAZARD_PENALTY[this.hazardDistances[index]] ?? 0;
  }

  /** Straight-line distance allowing diagonals, which never overestimates the real cost. */
  private estimate(from: number, to: number): number {
    const dx = Math.abs((from % this.width) - (to % this.width));
    const dy = Math.abs(Math.floor(from / this.width) - Math.floor(to / this.width));
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  }

  /** Breadth-first outwards from every hazard tile. */
  private measureHazardDistances(): number[] {
    const distances: number[] = this.kinds.map((kind) => (kind === 'hazard' ? 0 : HAZARD_DISTANCE_CAP));
    let frontier = distances.flatMap((distance, index) => (distance === 0 ? [index] : []));
    for (let distance = 1; distance < HAZARD_DISTANCE_CAP && frontier.length > 0; distance++) {
      const next: number[] = [];
      for (const index of frontier) {
        const column = index % this.width;
        const row = Math.floor(index / this.width);
        for (const [dx, dy] of NEIGHBOURS) {
          const neighbour = this.indexOf(column + dx, row + dy);
          if (neighbour === null || distances[neighbour] <= distance) continue;
          distances[neighbour] = distance;
          next.push(neighbour);
        }
      }
      frontier = next;
    }
    return distances;
  }

  private kindAt(column: number, row: number): TileKind {
    const index = this.indexOf(column, row);
    return index === null ? 'blocked' : this.kinds[index];
  }

  private indexOf(column: number, row: number): number | null {
    if (column < 0 || row < 0 || column >= this.width || row >= this.height) return null;
    return row * this.width + column;
  }

  private indexOfPoint(point: MapPoint | null): number | null {
    return point ? this.indexOf(Math.floor(point.x), Math.floor(point.y)) : null;
  }

  private centreOf(index: number): MapPoint {
    return { x: (index % this.width) + 0.5, y: Math.floor(index / this.width) + 0.5 };
  }
}
