import type { MapPoint } from '../sim/game-map';
import type { NavGrid } from './nav-grid';

/** Close enough to a waypoint to move on to the next. */
const WAYPOINT_REACH = 0.4;
/** How many waypoints ahead to check for a straight shortcut. */
const SHORTCUT_LOOKAHEAD = 5;
/** A little wider than a tank, so shortcuts don't scrape walls. */
export const DRIVING_CLEARANCE = 0.48;

/** Follows a route to a destination, cutting corners wherever a straight line is clear. */
export class PathFollower {
  destination: MapPoint | null = null;
  private waypoints: MapPoint[] = [];

  constructor(private readonly grid: NavGrid) {}

  get hasRoute(): boolean {
    return this.waypoints.length > 0;
  }

  /** Returns false when there's no way to get there. */
  goTo(from: MapPoint, to: MapPoint, hazardAwareness: number): boolean {
    const path = this.grid.findPath(from, to, hazardAwareness);
    this.destination = path ? to : null;
    this.waypoints = path ?? [];
    return path !== null;
  }

  clear(): void {
    this.destination = null;
    this.waypoints = [];
  }

  /** The direction to drive in now, or null once the destination is reached. */
  direction(position: MapPoint): MapPoint | null {
    this.skipReachedWaypoints(position);
    this.takeShortcuts(position);
    const next = this.waypoints[0];
    if (!next) return null;
    const dx = next.x - position.x;
    const dy = next.y - position.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  }

  private skipReachedWaypoints(position: MapPoint): void {
    while (this.waypoints.length > 0 && distance(position, this.waypoints[0]) < WAYPOINT_REACH) this.waypoints.shift();
    if (this.waypoints.length === 0) this.destination = null;
  }

  private takeShortcuts(position: MapPoint): void {
    const lastToCheck = Math.min(SHORTCUT_LOOKAHEAD, this.waypoints.length - 1);
    for (let index = lastToCheck; index > 0; index--) {
      if (this.grid.hasClearLine(position, this.waypoints[index], DRIVING_CLEARANCE)) {
        this.waypoints.splice(0, index);
        return;
      }
    }
  }
}

export function distance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
