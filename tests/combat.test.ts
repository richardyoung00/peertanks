import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../src/gameplay-config';
import { defaultSettings } from '../src/sim/game-settings';
import { GameWorld } from '../src/sim/game-world';
import { teleportTank } from '../src/sim/tank';
import { ARENA, findEvent, setupWorld, ticks } from './helpers/sim-world';

// Open floor along row 1 (y = 1.5) of the arena map.
const SHOOTER: [number, number] = [3.5, 1.5];
const TARGET: [number, number] = [7.5, 1.5];
const WATER = { x: 2.5, y: 7.5 };
const LAVA = { x: 14.5, y: 8.5 };

describe('combat', () => {
  it('wears off spawn protection', () => {
    const world = new GameWorld(ARENA, defaultSettings());
    const tank = world.addTank('a', 'a', 1);
    for (let i = 0; i < ticks(GAMEPLAY.respawn.invulnerableSeconds) + 2; i++) world.step(new Map());
    expect(tank.invulnerableTimer).toBe(0);
  });

  it('kills with 10 cannon hits and credits the shooter', () => {
    const { world, tanks, events, run } = setupWorld({ a: SHOOTER, b: TARGET });
    for (let i = 0; i < ticks(15) && tanks.b.alive; i++) run({ a: { aimAngle: 0, firing: true } });

    const hits = events.filter((event) => event.type === 'tankDamaged' && event.tankId === 'b');
    expect(tanks.b.alive).toBe(false);
    expect(hits).toHaveLength(10);
    expect(findEvent(events, 'tankKilled')).toMatchObject({ killerId: 'a', cause: 'cannon' });
    expect(world.scores.all.find((score) => score.playerId === 'a')).toMatchObject({ kills: 1, streak: 1 });
    expect(world.scores.all.find((score) => score.playerId === 'b')).toMatchObject({ deaths: 1 });
    expect(tanks.b.body.isEnabled()).toBe(false);
  });

  it('respawns after the delay with full health and protection', () => {
    const { tanks, events, run } = setupWorld({ a: SHOOTER, b: TARGET });
    tanks.b.health = 1;
    for (let i = 0; i < ticks(3) && tanks.b.alive; i++) run({ a: { aimAngle: 0, firing: true } });
    events.length = 0;
    run({}, ticks(GAMEPLAY.respawn.delaySeconds) + 1);

    expect(tanks.b.alive).toBe(true);
    expect(tanks.b.health).toBe(GAMEPLAY.tank.maxHealth);
    expect(tanks.b.invulnerableTimer).toBeGreaterThan(0);
    expect(findEvent(events, 'tankRespawned')).toBeDefined();
  });

  it('credits the attacker when a damaged tank falls into water', () => {
    const { tanks, events, run } = setupWorld({ a: SHOOTER, b: TARGET });
    for (let i = 0; i < ticks(3) && !findEvent(events, 'tankDamaged'); i++) run({ a: { aimAngle: 0, firing: true } });
    run({}, 5);
    teleportTank(tanks.b, WATER);
    run({}, 2);
    expect(findEvent(events, 'tankKilled')).toMatchObject({ cause: 'water', killerId: 'a' });
  });

  it('lets a tank hang a little way over the water before it falls in', () => {
    // Meadow's pond starts at column 2 on row 7; column 1 is grass.
    const { tanks, events, run } = setupWorld({ b: [2.1, 7.5] });
    run({}, 2);
    expect(tanks.b.alive).toBe(true);

    teleportTank(tanks.b, { x: 2.4, y: 7.5 });
    run({}, 2);
    expect(findEvent(events, 'tankKilled')).toMatchObject({ cause: 'water' });
  });

  it('gives nobody the kill for an unprovoked lava death', () => {
    const { tanks, events, run } = setupWorld({ b: TARGET });
    teleportTank(tanks.b, LAVA);
    run({}, 2);
    const death = findEvent(events, 'tankKilled');
    expect(death).toMatchObject({ cause: 'lava' });
    expect(death?.killerId).toBeUndefined();
  });

  it('ends the round, blocks shooting during results, then restarts with fresh scores', () => {
    const { world, events, run } = setupWorld({ a: SHOOTER, b: TARGET });
    world.round.timeLeft = 0.01;
    run({}, 2);
    expect(world.round.phase).toBe('results');
    expect(findEvent(events, 'roundEnded')).toBeDefined();

    run({ a: { firing: true } }, 30);
    expect(world.projectiles).toHaveLength(0);

    world.round.timeLeft = 0.01;
    run({}, 2);
    expect(world.round.phase).toBe('playing');
    expect(findEvent(events, 'roundStarted')).toBeDefined();
    expect(world.scores.all.every((score) => score.kills === 0 && score.deaths === 0)).toBe(true);
    expect([...world.tanks.values()].every((tank) => tank.alive)).toBe(true);
  });

  it('applies settings changed mid-game from the next round', () => {
    const world = new GameWorld(ARENA, defaultSettings());
    world.addTank('a', 'a', 1);
    world.changeSettings({ ...defaultSettings(), roundSeconds: 120, allowedItems: ['rocket'] });
    expect(world.round.timeLeft).toBe(defaultSettings().roundSeconds);

    world.round.timeLeft = 0.01;
    world.step(new Map());
    world.round.timeLeft = 0.01;
    world.step(new Map());
    expect(world.round.timeLeft).toBeCloseTo(120, 0);
    expect(world.pickups.spots.every((spot) => spot.item === null || spot.item === 'rocket')).toBe(true);
  });
});
