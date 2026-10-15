import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/gameplay-config';
import { defaultSettings } from '../src/sim/game-settings';
import { GameWorld } from '../src/sim/game-world';
import { activatePowerup, addWeapon } from '../src/sim/loadout';
import { teleportTank } from '../src/sim/tank';
import { ARENA, findEvent, setupWorld, ticks } from './helpers/sim-world';

const RIGHT = 0;
const DOWN = Math.PI / 2;
const LEFT = Math.PI;
const UP = -Math.PI / 2;

describe('pickups and switching', () => {
  it('collects a spot, switches to the new weapon and refills later', () => {
    const world = new GameWorld(ARENA, defaultSettings());
    const spot = world.pickups.spots[0];
    const tank = world.addTank('a', 'a', 1);
    teleportTank(tank, spot);
    const item = spot.item;

    const collected = findEvent(world.step(new Map()), 'pickupCollected');
    expect(collected?.item).toBe(item);
    expect(spot.item).toBeNull();
    expect(tank.loadout.selected).toBe(item);

    for (let i = 0; i < ticks(spot.respawnSeconds) + 2; i++) {
      teleportTank(tank, { x: 1.5, y: 1.5 });
      world.step(new Map());
    }
    expect(spot.item).not.toBeNull();
  });

  it('tops up ammo to the cap, switches only to owned weapons and falls back when dry', () => {
    const { tanks, run } = setupWorld({ a: [3.5, 1.5] });
    addWeapon(tanks.a.loadout, 'machine-gun');
    addWeapon(tanks.a.loadout, 'machine-gun');
    expect(tanks.a.loadout.ammo['machine-gun']).toBe(120);

    addWeapon(tanks.a.loadout, 'rocket');
    expect(tanks.a.loadout.selected).toBe('rocket');
    run({ a: { selectWeapon: 'machine-gun' } });
    expect(tanks.a.loadout.selected).toBe('machine-gun');
    run({ a: { selectWeapon: 'laser' } });
    expect(tanks.a.loadout.selected).toBe('machine-gun');

    run({ a: { aimAngle: DOWN, firing: true } }, 120 * ticks(GAMEPLAY.weapons['machine-gun'].cooldownSeconds) + 10);
    expect(tanks.a.loadout.ammo['machine-gun']).toBe(0);
    expect(tanks.a.loadout.selected).toBe('rocket');
  });

  it('keeps a separate cooldown per weapon', () => {
    const { tanks, run } = setupWorld({ a: [3.5, 1.5] });
    addWeapon(tanks.a.loadout, 'rocket');
    run({ a: { aimAngle: DOWN, firing: true } });
    run({ a: { selectWeapon: 'cannon' } });
    run({ a: { aimAngle: DOWN, firing: true } });
    expect(tanks.a.loadout.cooldowns.rocket).toBeGreaterThan(1);
    expect(tanks.a.loadout.cooldowns.cannon).toBeGreaterThan(0.3);
  });
});

describe('bouncy cannon and laser', () => {
  it('ricochets a bouncy shot back into its owner', () => {
    const { tanks, events, run } = setupWorld({ a: [2.5, 1.5] });
    addWeapon(tanks.a.loadout, 'bouncy-cannon');
    run({ a: { aimAngle: LEFT, firing: true } });
    run({ a: { aimAngle: LEFT } }, ticks(1));
    expect(findEvent(events, 'tankDamaged', (event) => event.tankId === 'a' && event.attackerId === 'a')).toBeDefined();
  });

  it('hits instantly for 40', () => {
    const { tanks, events, run } = setupWorld({ a: [3.5, 1.5], b: [12.5, 1.5] });
    addWeapon(tanks.a.loadout, 'laser');
    run({ a: { aimAngle: RIGHT, firing: true } });
    expect(tanks.b.health).toBe(60);
    expect(findEvent(events, 'laserFired')).toBeDefined();
  });

  it('reflects off walls', () => {
    const { tanks, events, run } = setupWorld({ a: [3.5, 1.5] });
    addWeapon(tanks.a.loadout, 'laser');
    run({ a: { aimAngle: -Math.PI / 4, firing: true } });
    expect(findEvent(events, 'laserFired')?.points.length).toBeGreaterThanOrEqual(3);
  });
});

describe('explosions', () => {
  it('kills with a direct rocket hit and hurts a neighbour less', () => {
    const { tanks, events, run } = setupWorld({ a: [3.5, 1.5], b: [9.5, 1.5], c: [10.5, 2.5] });
    addWeapon(tanks.a.loadout, 'rocket');
    run({ a: { aimAngle: RIGHT, firing: true } });
    run({}, ticks(1));
    expect(findEvent(events, 'tankKilled', (event) => event.tankId === 'b')).toMatchObject({ cause: 'rocket', killerId: 'a' });
    const splash = findEvent(events, 'tankDamaged', (event) => event.tankId === 'c');
    expect(splash?.amount).toBeGreaterThan(0);
    expect(splash?.amount).toBeLessThan(100);
  });

  it('is blocked by a wall between the blast and the tank', () => {
    // Wall at columns 9-11 of row 4; the tank sits just below it, the blast just above.
    const { world, tanks } = setupWorld({ a: [2.5, 1.5], b: [10.5, 5.6] });
    world.explode(10.5, 3.3, GAMEPLAY.weapons.rocket.explosion, 'a', 'rocket', 1);
    expect(tanks.b.health).toBe(100);
  });

  it('badly hurts a shooter who rockets a nearby wall', () => {
    const { tanks, run } = setupWorld({ a: [2.5, 1.5] });
    addWeapon(tanks.a.loadout, 'rocket');
    run({ a: { aimAngle: LEFT, firing: true } });
    run({}, ticks(0.5));
    expect(tanks.a.health).toBeLessThan(50);
  });

  it('kills a point-blank shooter without kill credit', () => {
    const { tanks, events, run } = setupWorld({ a: [1.5, 1.5] });
    addWeapon(tanks.a.loadout, 'rocket');
    run({ a: { aimAngle: LEFT, firing: true } });
    const death = findEvent(events, 'tankKilled', (event) => event.tankId === 'a');
    expect(death?.selfInflicted).toBe(true);
    expect(death?.killerId).toBeUndefined();
  });

  it('pushes tanks away', () => {
    const { world, tanks, run } = setupWorld({ a: [2.5, 18.5], b: [6.5, 18.5] });
    world.explode(5.0, 18.5, { innerRadius: 0, outerRadius: 3, damage: 0, knockback: 10 }, 'a', 'rocket', 1);
    run({}, ticks(0.6));
    expect(tanks.b.x).toBeGreaterThan(7.3);
  });
});

describe('grenade and mortar', () => {
  function throwGrenade(from: [number, number], angle: number, holdSeconds: number, others: Record<string, [number, number]> = {}) {
    const test = setupWorld({ a: from, ...others });
    addWeapon(test.tanks.a.loadout, 'grenade');
    test.run({ a: { aimAngle: angle, firing: true } }, ticks(holdSeconds));
    test.run({ a: { aimAngle: angle, firing: false } });
    test.run({}, ticks(GAMEPLAY.weapons.grenade.fuseSeconds) + 2);
    return { ...test, blast: findEvent(test.events, 'explosion') };
  }

  it('throws a full charge about 12 tiles and badly hurts the tank it reaches', () => {
    const { tanks, events, blast } = throwGrenade([2.5, 18.5], RIGHT, 3, { b: [13.5, 18.5] });
    expect(findEvent(events, 'shotFired', (event) => event.weapon === 'grenade')).toBeDefined();
    expect(blast?.x).toBeGreaterThan(11);
    expect(blast?.x).toBeLessThan(15);
    expect(tanks.b.health).toBeLessThan(30);
  });

  it('clears a wall with a hard throw but not a weak one', () => {
    // Wall at columns 9-11 of row 4; throw straight down across it.
    expect(throwGrenade([10.5, 1.5], DOWN, 3).blast?.y).toBeGreaterThan(5);
    expect(throwGrenade([10.5, 1.5], DOWN, 0.5).blast?.y).toBeLessThan(4);
  });

  it('never leaves the arena', () => {
    const { blast } = throwGrenade([3.5, 1.5], UP, 3);
    expect(blast?.x).toBeGreaterThanOrEqual(0);
    expect(blast?.y).toBeGreaterThanOrEqual(0);
  });

  it('lobs a mortar over a wall to the aim point', () => {
    const { tanks, events, run } = setupWorld({ a: [10.5, 2.5], b: [10.5, 6.5] });
    addWeapon(tanks.a.loadout, 'mortar');
    run({ a: { aimAngle: DOWN, aimDistance: 4, firing: true } });
    run({}, ticks(GAMEPLAY.weapons.mortar.flightSeconds) + 2);
    expect(findEvent(events, 'mortarFired')?.targetY).toBeCloseTo(6.5, 2);
    expect(findEvent(events, 'explosion')?.y).toBeCloseTo(6.5, 2);
    expect(findEvent(events, 'tankKilled', (event) => event.tankId === 'b')).toBeDefined();
  });
});

describe('powerups', () => {
  it('halves damage with a shield', () => {
    const { world, tanks } = setupWorld({ a: [3.5, 1.5], b: [6.5, 1.5] });
    activatePowerup(tanks.b.loadout, 'shield');
    world.explode(6.5, 1.5, { innerRadius: 1, outerRadius: 2, damage: 40, knockback: 0 }, 'a', 'rocket', 1);
    expect(tanks.b.health).toBe(80);
  });

  it('multiplies damage with a damage boost', () => {
    const { tanks, run } = setupWorld({ a: [3.5, 1.5], b: [6.5, 1.5] });
    activatePowerup(tanks.a.loadout, 'damage-boost');
    run({ a: { aimAngle: RIGHT, firing: true } });
    run({}, ticks(0.5));
    expect(tanks.b.health).toBe(85);
  });

  it('raises top speed', () => {
    const { tanks, run } = setupWorld({ a: [2.5, 18.5] });
    activatePowerup(tanks.a.loadout, 'speed');
    run({ a: { moveX: 1 } }, ticks(1));
    expect(tanks.a.body.linvel().x).toBeGreaterThan(GAMEPLAY.tank.maxSpeed * 1.3);
  });

  it("sets off a dead man's switch on death and clears the loadout", () => {
    const { tanks, events, run } = setupWorld({ a: [3.5, 1.5], b: [8.5, 1.5], c: [9.5, 1.5] });
    activatePowerup(tanks.b.loadout, 'dead-mans-switch');
    addWeapon(tanks.a.loadout, 'rocket');
    run({ a: { aimAngle: RIGHT, firing: true } });
    run({}, ticks(1));
    expect(findEvent(events, 'tankKilled', (event) => event.tankId === 'c')).toBeDefined();
    expect(tanks.b.loadout.powerups['dead-mans-switch']).toBe(0);
    expect(tanks.b.loadout.selected).toBe('cannon');
  });
});
