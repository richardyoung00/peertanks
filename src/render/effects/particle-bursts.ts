import { between, randomDirection, type ParticlePools } from './particles';

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

const SMOKE_COLORS = [0x8a8a8a, 0x9c9c9c, 0x787878];
const DEBRIS_COLORS = [0x2b2b2b, 0x3a3532, 0x52493f];
const FIRE_COLORS = [0xffd36b, 0xff9a3c, 0xff6a1f];
const WATER_COLORS = [0xe6f6ff, 0xb9e3f7, 0x8fd0ee];
const DUST_COLORS = [0xcbbf9f, 0xb8ad8f, 0xd9d0b8];

function pick(colors: number[]): number {
  return colors[Math.floor(Math.random() * colors.length)];
}

/** Sparks flying outwards and falling. `size` scales the whole burst. */
export function sparks(pools: ParticlePools, at: Point3, count: number, size = 1, colors = FIRE_COLORS): void {
  for (let index = 0; index < count; index++) {
    const direction = randomDirection();
    const speed = between(3, 7) * size;
    pools.glow.spawn({
      ...at,
      vx: direction.x * speed,
      vz: direction.z * speed,
      vy: between(1.5, 4.5) * size,
      gravity: 9,
      drag: 1.5,
      life: between(0.3, 0.6),
      startSize: 0.07 * size,
      endSize: 0.03,
      color: pick(colors),
    });
  }
}

/** Dark puffs that billow outwards then drift up. */
export function smoke(pools: ParticlePools, at: Point3, count: number, size = 1, colors = SMOKE_COLORS): void {
  for (let index = 0; index < count; index++) {
    const direction = randomDirection();
    const speed = between(0.5, 2) * size;
    pools.smoke.spawn({
      ...at,
      vx: direction.x * speed,
      vz: direction.z * speed,
      vy: between(0.4, 1.1),
      gravity: -0.4,
      drag: 3,
      life: between(0.8, 1.4) * Math.sqrt(size),
      startSize: 0.12 * size,
      endSize: 0.3 * size,
      color: pick(colors),
    });
  }
}

/** Chunks thrown into the air that bounce when they land. */
export function debris(pools: ParticlePools, at: Point3, count: number, size = 1): void {
  for (let index = 0; index < count; index++) {
    const direction = randomDirection();
    const speed = between(2, 5) * size;
    pools.solid.spawn({
      ...at,
      vx: direction.x * speed,
      vz: direction.z * speed,
      vy: between(3, 6),
      gravity: 16,
      bounce: 0.35,
      life: between(0.8, 1.3),
      startSize: between(0.05, 0.1),
      endSize: 0.05,
      color: pick(DEBRIS_COLORS),
    });
  }
}

/** A low ring of dust kicked up from the ground. */
export function dust(pools: ParticlePools, at: Point3, count: number, size = 1): void {
  smoke(pools, at, count, size, DUST_COLORS);
}

/** Droplets thrown up and out by something hitting the water. */
export function splash(pools: ParticlePools, at: Point3, count: number): void {
  for (let index = 0; index < count; index++) {
    const direction = randomDirection();
    const speed = between(1, 2.6);
    pools.solid.spawn({
      ...at,
      vx: direction.x * speed,
      vz: direction.z * speed,
      vy: between(2.5, 4.5),
      gravity: 11,
      life: between(0.5, 0.8),
      startSize: between(0.07, 0.12),
      endSize: 0.03,
      color: pick(WATER_COLORS),
    });
  }
}

/** One bubble rising to the surface, where it pops. */
export function bubble(pools: ParticlePools, at: Point3, surfaceHeight: number): void {
  const rise = between(0.6, 1);
  pools.solid.spawn({
    x: at.x + between(-0.2, 0.2),
    y: at.y,
    z: at.z + between(-0.2, 0.2),
    vy: rise,
    life: Math.max(0.1, (surfaceHeight - at.y) / rise),
    startSize: 0.03,
    endSize: between(0.06, 0.1),
    color: WATER_COLORS[0],
  });
}

/** A bright flash of flame, used at the heart of explosions and when a tank goes up. */
export function flames(pools: ParticlePools, at: Point3, count: number, size = 1): void {
  for (let index = 0; index < count; index++) {
    const direction = randomDirection();
    const speed = between(0.5, 2.2) * size;
    pools.glow.spawn({
      ...at,
      vx: direction.x * speed,
      vz: direction.z * speed,
      vy: between(0.8, 2),
      gravity: -1,
      drag: 4,
      life: between(0.2, 0.4),
      startSize: 0.22 * size,
      endSize: 0.1 * size,
      color: pick(FIRE_COLORS),
    });
  }
}
