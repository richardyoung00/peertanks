import { describe, expect, it } from 'vitest';
import { findBankShot } from '../src/bots/bank-shot';
import { BOT_LEVELS } from '../src/bots/bot-level';
import { rollPersonality } from '../src/bots/personality';
import { grenadeHoldSeconds, leadPoint } from '../src/bots/shooting';
import { GAMEPLAY } from '../src/gameplay-config';
import type { GameEvent } from '../src/sim/game-events';
import { addWeapon } from '../src/sim/loadout';
import { IDLE_INPUT } from '../src/sim/player-input';
import { teleportTank } from '../src/sim/tank';
import { setupBotMatch } from './helpers/bot-match';
import { seededRandom } from './helpers/seeded-random';
import { CROSSROADS, findEvent, settingsWithoutPickups, setupWorld, ticks } from './helpers/sim-world';

const HAZARDS = ['water', 'lava', 'pit'];

function killsBy(events: GameEvent[], id: string): number {
  return events.filter((event) => event.type === 'tankKilled' && event.killerId === id).length;
}

describe('personality', () => {
  it('rolls every value within its level and archetype bounds', () => {
    const random = seededRandom(1);
    for (const level of BOT_LEVELS) {
      for (let i = 0; i < 50; i++) {
        const personality = rollPersonality(level, random);
        const skill = GAMEPLAY.bots.levels[level];
        const style = GAMEPLAY.bots.archetypes[personality.archetype];
        expect(personality.reactionSeconds).toBeGreaterThanOrEqual(skill.reactionSeconds[0]);
        expect(personality.reactionSeconds).toBeLessThanOrEqual(skill.reactionSeconds[1]);
        expect(personality.aggression).toBeGreaterThanOrEqual(style.aggression[0]);
        expect(personality.aggression).toBeLessThanOrEqual(style.aggression[1]);
        expect(personality.trickShots).toBeLessThanOrEqual(skill.trickShotLimit);
      }
    }
  });
});

describe('shooting maths', () => {
  it('leads a crossing target so a cannon shell meets it', () => {
    const target = { x: 10, y: 0, vx: 0, vy: 4 };
    const aim = leadPoint({ x: 0, y: 0 }, target, 'cannon', 1);
    const flightSeconds = Math.hypot(aim.x, aim.y) / GAMEPLAY.weapons.cannon.speed;
    expect(aim.y).toBeCloseTo(target.vy * flightSeconds, 1);
  });

  it('holds a grenade for about the right time to land at a distance', () => {
    const { tanks, events, run } = setupWorld({ a: [2.5, 18.5] });
    addWeapon(tanks.a.loadout, 'grenade');
    run({ a: { aimAngle: 0, firing: true } }, ticks(grenadeHoldSeconds(8)));
    run({ a: { aimAngle: 0, firing: false } });
    run({}, ticks(GAMEPLAY.weapons.grenade.fuseSeconds) + 2);
    expect(findEvent(events, 'explosion')?.x).toBeCloseTo(2.5 + 8, -0.5);
  });

  it('finds a laser bank shot that really does hit a target behind a wall', () => {
    // Meadow: a wall at column 9 (rows 4-6) stands between the two tanks.
    const shooter: [number, number] = [11.5, 5.5];
    const target: [number, number] = [7.5, 5.5];
    const { world, tanks, run } = setupWorld({ a: shooter, b: target });
    const shot = findBankShot(world.physics, tanks.a, tanks.b, 2, GAMEPLAY.weapons.laser.range);
    expect(shot).not.toBeNull();

    addWeapon(tanks.a.loadout, 'laser');
    run({ a: { aimAngle: shot!.angle, firing: true } });
    expect(tanks.b.health).toBeLessThan(GAMEPLAY.tank.maxHealth);
  });
});

describe('bot behaviour', () => {
  it('only ever presses whole keys, like a keyboard player', () => {
    const match = setupBotMatch(['easy', 'hard'], CROSSROADS, undefined, seededRandom(2));
    match.run(30);
    for (const inputs of match.inputs.values()) {
      expect(inputs.every((input) => [-1, 0, 1].includes(input.moveX) && [-1, 0, 1].includes(input.moveY))).toBe(true);
    }
  });

  it("doesn't shoot before it could have reacted", () => {
    const match = setupBotMatch(['hard'], undefined, settingsWithoutPickups(), seededRandom(3));
    const bot = match.world.tanks.get('bot-0')!;
    const human = match.world.addTank('human', 'human', 9);
    teleportTank(bot, { x: 3.5, y: 1.5 });
    teleportTank(human, { x: 8.5, y: 1.5 });
    human.invulnerableTimer = 0;

    let firstShotTick: number | null = null;
    for (let tick = 0; tick < ticks(3) && firstShotTick === null; tick++) {
      match.run(1 / 60, () => new Map([['human', IDLE_INPUT]]));
      if (findEvent(match.events, 'shotFired')) firstShotTick = tick;
    }
    expect(firstShotTick).not.toBeNull();
    expect(firstShotTick! / 60).toBeGreaterThanOrEqual(GAMEPLAY.bots.levels.hard.reactionSeconds[0]);
  });

  it('keeps hard bots out of the water while they roam a river map', () => {
    const match = setupBotMatch(['hard'], CROSSROADS, undefined, seededRandom(4));
    match.run(120);
    const hazardDeaths = match.events.filter((event) => event.type === 'tankKilled' && HAZARDS.includes(event.cause));
    expect(hazardDeaths).toHaveLength(0);
    expect(findEvent(match.events, 'pickupCollected')).toBeDefined();
  });

  it('makes hard bots beat easy bots', () => {
    let hardKills = 0;
    let easyKills = 0;
    for (const seed of [10, 11, 12]) {
      const match = setupBotMatch(['hard', 'easy'], undefined, settingsWithoutPickups(), seededRandom(seed));
      match.run(90);
      hardKills += killsBy(match.events, 'bot-0');
      easyKills += killsBy(match.events, 'bot-1');
    }
    expect(hardKills).toBeGreaterThan(easyKills * 1.5);
  });

  it("stops easy and medium bots ganging up on one human", () => {
    const match = setupBotMatch(['medium', 'medium', 'medium'], undefined, settingsWithoutPickups(), seededRandom(5));
    const human = match.world.addTank('human', 'human', 9);
    const placements = [
      { x: 4.5, y: 18.5 },
      { x: 12.5, y: 18.5 },
      { x: 8.5, y: 14.5 },
    ];
    placements.forEach((point, index) => teleportTank(match.world.tanks.get(`bot-${index}`)!, point));
    teleportTank(human, { x: 8.5, y: 17.5 });

    let crowdedChecks = 0;
    let checks = 0;
    for (let step = 0; step < 100; step++) {
      human.invulnerableTimer = 1;
      human.health = GAMEPLAY.tank.maxHealth;
      match.run(0.1, () => new Map([['human', IDLE_INPUT]]));
      checks++;
      if (match.squad.attackersOf('human', 'nobody') > GAMEPLAY.bots.gangUpLimit) crowdedChecks++;
    }
    expect(crowdedChecks / checks).toBeLessThan(0.1);
  });
});
