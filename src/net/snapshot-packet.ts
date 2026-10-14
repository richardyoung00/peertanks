import {
  ITEM_IDS,
  PICKUP_WEAPON_IDS,
  POWERUP_IDS,
  WEAPON_IDS,
  type ItemId,
  type PickupWeaponId,
  type PowerupId,
  type WeaponId,
} from '../sim/items';
import { PROJECTILE_KINDS, type ProjectileKind } from '../sim/projectiles';
import type { RoundPhase } from '../sim/round';
import type { ByteReader, ByteWriter } from './binary';

const HEADER_BYTES = 15;
const TANK_BYTES = 16;
const PROJECTILE_BYTES = 12;
const OWN_STATUS_BYTES = PICKUP_WEAPON_IDS.length + POWERUP_IDS.length;

const FLAG_ALIVE = 1 << 0;
const FLAG_INVULNERABLE = 1 << 1;
const FIRST_POWERUP_FLAG = 2;
const ROUND_PHASES: RoundPhase[] = ['playing', 'results'];
const HEIGHT_SCALE = 20;
const EMPTY_SPOT = 0;

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
  weapon: WeaponId;
  powerups: PowerupId[];
}

export interface ProjectileSnapshot {
  id: number;
  kind: ProjectileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  height: number;
}

export interface RoundSnapshot {
  phase: RoundPhase;
  timeLeft: number;
}

/** Only sent to the player it belongs to: what they're carrying. */
export interface OwnStatus {
  ammo: Record<PickupWeaponId, number>;
  /** Whole seconds left on each powerup. */
  powerups: Record<PowerupId, number>;
}

export interface Snapshot {
  tick: number;
  /** The last input sequence number from this client that the host has applied. */
  ackSeq: number;
  round: RoundSnapshot;
  tanks: TankSnapshot[];
  projectiles: ProjectileSnapshot[];
  /** What each of the map's pickup spots holds, in map order. */
  pickups: (ItemId | null)[];
  own: OwnStatus;
}

export function snapshotSize(snapshot: Snapshot): number {
  return (
    HEADER_BYTES +
    snapshot.tanks.length * TANK_BYTES +
    snapshot.projectiles.length * PROJECTILE_BYTES +
    snapshot.pickups.length +
    OWN_STATUS_BYTES
  );
}

export function writeSnapshot(writer: ByteWriter, snapshot: Snapshot): void {
  writer.u32(snapshot.tick);
  writer.u32(snapshot.ackSeq);
  writer.u8(ROUND_PHASES.indexOf(snapshot.round.phase));
  writer.u16(Math.ceil(snapshot.round.timeLeft * 10));
  writer.u8(snapshot.tanks.length);
  writer.u16(snapshot.projectiles.length);
  writer.u8(snapshot.pickups.length);
  snapshot.tanks.forEach((tank) => writeTank(writer, tank));
  snapshot.projectiles.forEach((projectile) => writeProjectile(writer, projectile));
  snapshot.pickups.forEach((item) => writer.u8(item ? ITEM_IDS.indexOf(item) + 1 : EMPTY_SPOT));
  writeOwnStatus(writer, snapshot.own);
}

export function readSnapshot(reader: ByteReader): Snapshot {
  const tick = reader.u32();
  const ackSeq = reader.u32();
  const round = { phase: ROUND_PHASES[reader.u8()] ?? 'playing', timeLeft: reader.u16() / 10 };
  const tankCount = reader.u8();
  const projectileCount = reader.u16();
  const pickupCount = reader.u8();
  const tanks = Array.from({ length: tankCount }, () => readTank(reader));
  const projectiles = Array.from({ length: projectileCount }, () => readProjectile(reader));
  const pickups = Array.from({ length: pickupCount }, () => ITEM_IDS[reader.u8() - 1] ?? null);
  const own = readOwnStatus(reader);
  return { tick, ackSeq, round, tanks, projectiles, pickups, own };
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
  writer.u8(tankFlags(tank));
  writer.u8(WEAPON_IDS.indexOf(tank.weapon));
}

function tankFlags(tank: TankSnapshot): number {
  let flags = (tank.alive ? FLAG_ALIVE : 0) | (tank.invulnerable ? FLAG_INVULNERABLE : 0);
  POWERUP_IDS.forEach((powerup, index) => {
    if (tank.powerups.includes(powerup)) flags |= 1 << (FIRST_POWERUP_FLAG + index);
  });
  return flags;
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
  const weapon = WEAPON_IDS[reader.u8()] ?? 'cannon';
  return {
    ...tank,
    alive: (flags & FLAG_ALIVE) !== 0,
    invulnerable: (flags & FLAG_INVULNERABLE) !== 0,
    weapon,
    powerups: POWERUP_IDS.filter((_, index) => (flags & (1 << (FIRST_POWERUP_FLAG + index))) !== 0),
  };
}

function writeProjectile(writer: ByteWriter, projectile: ProjectileSnapshot): void {
  writer.u16(projectile.id & 0xffff);
  writer.u8(PROJECTILE_KINDS.indexOf(projectile.kind));
  writer.coord(projectile.x);
  writer.coord(projectile.y);
  writer.velocity(projectile.vx);
  writer.velocity(projectile.vy);
  writer.u8(Math.min(255, Math.round(projectile.height * HEIGHT_SCALE)));
}

function readProjectile(reader: ByteReader): ProjectileSnapshot {
  return {
    id: reader.u16(),
    kind: PROJECTILE_KINDS[reader.u8()] ?? 'shell',
    x: reader.coord(),
    y: reader.coord(),
    vx: reader.velocity(),
    vy: reader.velocity(),
    height: reader.u8() / HEIGHT_SCALE,
  };
}

function writeOwnStatus(writer: ByteWriter, own: OwnStatus): void {
  PICKUP_WEAPON_IDS.forEach((weapon) => writer.u8(Math.min(255, own.ammo[weapon])));
  POWERUP_IDS.forEach((powerup) => writer.u8(Math.min(255, Math.ceil(own.powerups[powerup]))));
}

function readOwnStatus(reader: ByteReader): OwnStatus {
  const ammo = Object.fromEntries(PICKUP_WEAPON_IDS.map((weapon) => [weapon, reader.u8()]));
  const powerups = Object.fromEntries(POWERUP_IDS.map((powerup) => [powerup, reader.u8()]));
  return { ammo: ammo as OwnStatus['ammo'], powerups: powerups as OwnStatus['powerups'] };
}
