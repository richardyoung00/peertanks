import type { PlayerInput } from '../sim/player-input';
import type { RoundPhase } from '../sim/round';
import { ByteReader, ByteWriter } from './binary';

// Binary packets sent over the fast (unreliable) channel.
const PACKET_INPUT = 1;
const PACKET_SNAPSHOT = 2;

const INPUT_FRAME_BYTES = 11;
const TANK_BYTES = 15;
const PROJECTILE_BYTES = 10;
const SNAPSHOT_HEADER_BYTES = 15;

const FLAG_ALIVE = 1;
const FLAG_INVULNERABLE = 2;
const ROUND_PHASES: RoundPhase[] = ['playing', 'results'];

export interface InputFrame {
  seq: number;
  input: PlayerInput;
}

export interface TankSnapshot {
  netId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hullAngle: number;
  aimAngle: number;
  health: number;
  alive: boolean;
  invulnerable: boolean;
}

export interface ProjectileSnapshot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Snapshot {
  tick: number;
  /** The last input sequence number from this client that the host has applied. */
  ackSeq: number;
  round: RoundSnapshot;
  tanks: TankSnapshot[];
  projectiles: ProjectileSnapshot[];
}

export interface RoundSnapshot {
  phase: RoundPhase;
  timeLeft: number;
}

export type DecodedPacket = { type: 'input'; frames: InputFrame[] } | { type: 'snapshot'; snapshot: Snapshot };

export function encodeInputPacket(frames: InputFrame[]): ArrayBuffer {
  const writer = new ByteWriter(2 + frames.length * INPUT_FRAME_BYTES);
  writer.u8(PACKET_INPUT);
  writer.u8(frames.length);
  for (const { seq, input } of frames) {
    writer.u32(seq);
    writer.i8(Math.sign(input.moveX));
    writer.i8(Math.sign(input.moveY));
    writer.angle(input.aimAngle);
    writer.distance(input.aimDistance);
    writer.u8(input.firing ? 1 : 0);
  }
  return writer.finish();
}

export function encodeSnapshot(snapshot: Snapshot): ArrayBuffer {
  const size =
    SNAPSHOT_HEADER_BYTES + snapshot.tanks.length * TANK_BYTES + snapshot.projectiles.length * PROJECTILE_BYTES;
  const writer = new ByteWriter(size);
  writer.u8(PACKET_SNAPSHOT);
  writer.u32(snapshot.tick);
  writer.u32(snapshot.ackSeq);
  writer.u8(ROUND_PHASES.indexOf(snapshot.round.phase));
  writer.u16(Math.ceil(snapshot.round.timeLeft * 10));
  writer.u8(snapshot.tanks.length);
  writer.u16(snapshot.projectiles.length);
  for (const tank of snapshot.tanks) writeTank(writer, tank);
  for (const projectile of snapshot.projectiles) writeProjectile(writer, projectile);
  return writer.finish();
}

export function decodePacket(data: ArrayBuffer): DecodedPacket | null {
  const reader = new ByteReader(data);
  const type = reader.u8();
  if (type === PACKET_INPUT) return { type: 'input', frames: readInputFrames(reader) };
  if (type === PACKET_SNAPSHOT) return { type: 'snapshot', snapshot: readSnapshot(reader) };
  return null;
}

function writeTank(writer: ByteWriter, tank: TankSnapshot): void {
  writer.u8(tank.netId);
  writer.coord(tank.x);
  writer.coord(tank.y);
  writer.velocity(tank.vx);
  writer.velocity(tank.vy);
  writer.angle(tank.hullAngle);
  writer.angle(tank.aimAngle);
  writer.u8(Math.round(tank.health));
  writer.u8((tank.alive ? FLAG_ALIVE : 0) | (tank.invulnerable ? FLAG_INVULNERABLE : 0));
}

function writeProjectile(writer: ByteWriter, projectile: ProjectileSnapshot): void {
  writer.u16(projectile.id & 0xffff);
  writer.coord(projectile.x);
  writer.coord(projectile.y);
  writer.velocity(projectile.vx);
  writer.velocity(projectile.vy);
}

function readInputFrames(reader: ByteReader): InputFrame[] {
  const count = reader.u8();
  return Array.from({ length: count }, () => ({
    seq: reader.u32(),
    input: {
      moveX: reader.i8(),
      moveY: reader.i8(),
      aimAngle: reader.angle(),
      aimDistance: reader.distance(),
      firing: reader.u8() === 1,
    },
  }));
}

function readSnapshot(reader: ByteReader): Snapshot {
  const tick = reader.u32();
  const ackSeq = reader.u32();
  const round = { phase: ROUND_PHASES[reader.u8()] ?? 'playing', timeLeft: reader.u16() / 10 };
  const tankCount = reader.u8();
  const projectileCount = reader.u16();
  const tanks = Array.from({ length: tankCount }, () => readTank(reader));
  const projectiles = Array.from({ length: projectileCount }, () => ({
    id: reader.u16(),
    x: reader.coord(),
    y: reader.coord(),
    vx: reader.velocity(),
    vy: reader.velocity(),
  }));
  return { tick, ackSeq, round, tanks, projectiles };
}

function readTank(reader: ByteReader): TankSnapshot {
  const tank = {
    netId: reader.u8(),
    x: reader.coord(),
    y: reader.coord(),
    vx: reader.velocity(),
    vy: reader.velocity(),
    hullAngle: reader.angle(),
    aimAngle: reader.angle(),
    health: reader.u8(),
  };
  const flags = reader.u8();
  return { ...tank, alive: (flags & FLAG_ALIVE) !== 0, invulnerable: (flags & FLAG_INVULNERABLE) !== 0 };
}
