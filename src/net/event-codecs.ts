import type { DeathCause, GameEvent, Point } from '../sim/game-events';
import { ITEM_IDS, WEAPON_IDS } from '../sim/items';
import type { PlayerScore } from '../sim/scores';
import type { ByteReader, ByteWriter } from './binary';

/** Sent in place of a player the host no longer knows, or when an event names nobody. */
export const NO_PLAYER = 255;

const DEATH_CAUSES: DeathCause[] = [...WEAPON_IDS, 'dead-mans-switch', 'water', 'lava', 'pit'];

type EventType = GameEvent['type'];
type EventOf<T extends EventType> = Extract<GameEvent, { type: T }>;

/** Writes events with players as their one-byte net ids. */
export class EventWriter {
  constructor(
    readonly bytes: ByteWriter,
    private readonly netIdOf: (playerId: string) => number | undefined,
  ) {}

  player(playerId: string | undefined): void {
    const netId = playerId === undefined ? undefined : this.netIdOf(playerId);
    this.bytes.u8(netId ?? NO_PLAYER);
  }

  point({ x, y }: Point): void {
    this.bytes.coord(x);
    this.bytes.coord(y);
  }
}

/** Reads events back, turning net ids into the player ids the rest of the game uses. */
export class EventReader {
  constructor(
    readonly bytes: ByteReader,
    private readonly playerIdOf: (netId: number) => string,
  ) {}

  player(): string {
    return this.playerIdOf(this.bytes.u8());
  }

  optionalPlayer(): string | undefined {
    const netId = this.bytes.u8();
    return netId === NO_PLAYER ? undefined : this.playerIdOf(netId);
  }

  point(): Point {
    return { x: this.bytes.coord(), y: this.bytes.coord() };
  }
}

interface EventCodec<T extends EventType> {
  write(out: EventWriter, event: EventOf<T>): void;
  read(input: EventReader): EventOf<T>;
}

// The position in this list is the event's kind byte on the wire.
const EVENT_TYPES: EventType[] = [
  'shotFired',
  'shellHit',
  'tankDamaged',
  'tankKilled',
  'tankRespawned',
  'explosion',
  'laserFired',
  'mortarFired',
  'pickupCollected',
  'roundEnded',
  'roundStarted',
];

const CODECS: { [T in EventType]: EventCodec<T> } = {
  shotFired: {
    write(out, event) {
      out.player(event.tankId);
      out.bytes.u8(WEAPON_IDS.indexOf(event.weapon));
      out.point(event);
      out.bytes.angle(event.angle);
    },
    read: (input) => ({
      type: 'shotFired',
      tankId: input.player(),
      weapon: WEAPON_IDS[input.bytes.u8()] ?? 'cannon',
      ...input.point(),
      angle: input.bytes.angle(),
    }),
  },
  shellHit: {
    write(out, event) {
      out.player(event.ownerId);
      out.player(event.tankId);
      out.point(event);
    },
    read: (input) => ({ type: 'shellHit', ownerId: input.player(), tankId: input.optionalPlayer(), ...input.point() }),
  },
  tankDamaged: {
    write(out, event) {
      out.player(event.tankId);
      out.player(event.attackerId);
      out.bytes.u8(wholeByte(event.amount));
      out.bytes.u8(wholeByte(event.health));
    },
    read: (input) => ({
      type: 'tankDamaged',
      tankId: input.player(),
      attackerId: input.player(),
      amount: input.bytes.u8(),
      health: input.bytes.u8(),
    }),
  },
  tankKilled: {
    write(out, event) {
      out.player(event.tankId);
      out.player(event.killerId);
      out.bytes.u8(DEATH_CAUSES.indexOf(event.cause));
      out.bytes.u8(event.selfInflicted ? 1 : 0);
      out.point(event);
    },
    read: (input) => ({
      type: 'tankKilled',
      tankId: input.player(),
      killerId: input.optionalPlayer(),
      cause: DEATH_CAUSES[input.bytes.u8()] ?? 'cannon',
      selfInflicted: input.bytes.u8() === 1,
      ...input.point(),
    }),
  },
  tankRespawned: {
    write: (out, event) => out.player(event.tankId),
    read: (input) => ({ type: 'tankRespawned', tankId: input.player() }),
  },
  explosion: {
    write(out, event) {
      out.point(event);
      out.bytes.distance(event.radius);
    },
    read: (input) => ({ type: 'explosion', ...input.point(), radius: input.bytes.distance() }),
  },
  laserFired: {
    write(out, event) {
      out.player(event.tankId);
      out.bytes.u8(event.points.length);
      event.points.forEach((point) => out.point(point));
    },
    read(input) {
      const tankId = input.player();
      const points = Array.from({ length: input.bytes.u8() }, () => input.point());
      return { type: 'laserFired', tankId, points };
    },
  },
  mortarFired: {
    write(out, event) {
      out.point({ x: event.targetX, y: event.targetY });
      out.bytes.u16(Math.round(event.flightSeconds * 1000));
    },
    read(input) {
      const target = input.point();
      return { type: 'mortarFired', targetX: target.x, targetY: target.y, flightSeconds: input.bytes.u16() / 1000 };
    },
  },
  pickupCollected: {
    write(out, event) {
      out.player(event.tankId);
      out.bytes.u8(ITEM_IDS.indexOf(event.item));
      out.point(event);
    },
    read: (input) => ({
      type: 'pickupCollected',
      tankId: input.player(),
      item: ITEM_IDS[input.bytes.u8()] ?? 'machine-gun',
      ...input.point(),
    }),
  },
  roundEnded: {
    write(out, event) {
      out.bytes.u8(event.standings.length);
      event.standings.forEach((score) => writeScore(out, score));
    },
    read: (input) => ({ type: 'roundEnded', standings: Array.from({ length: input.bytes.u8() }, () => readScore(input)) }),
  },
  roundStarted: {
    write() {},
    read: () => ({ type: 'roundStarted' }),
  },
};

export function writeEvent(out: EventWriter, event: GameEvent): void {
  out.bytes.u8(EVENT_TYPES.indexOf(event.type));
  const codec = CODECS[event.type] as EventCodec<EventType>;
  codec.write(out, event);
}

export function readEvent(input: EventReader): GameEvent {
  const type = EVENT_TYPES[input.bytes.u8()];
  if (!type) throw new Error('Unknown event kind');
  return CODECS[type].read(input);
}

function writeScore(out: EventWriter, score: PlayerScore): void {
  out.player(score.playerId);
  out.bytes.u16(score.kills);
  out.bytes.u16(score.deaths);
  out.bytes.u16(score.streak);
}

function readScore(input: EventReader): PlayerScore {
  return { playerId: input.player(), kills: input.bytes.u16(), deaths: input.bytes.u16(), streak: input.bytes.u16() };
}

function wholeByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
