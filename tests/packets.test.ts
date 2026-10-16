import { describe, expect, it } from 'vitest';
import { decodeEventPacket, encodeEventPacket } from '../src/net/events-packet';
import { decodePacket, encodeInputPacket, encodeSnapshot, type Snapshot } from '../src/net/packets';
import type { GameEvent } from '../src/sim/game-events';

const SNAPSHOT: Snapshot = {
  tick: 1234,
  ackSeq: 99,
  round: { phase: 'results', timeLeft: 12.3 },
  tanks: [
    {
      netId: 3,
      x: 12.5,
      y: 7.25,
      vx: -1.5,
      vy: 2,
      hullAngle: 1,
      aimAngle: -2,
      health: 55,
      alive: true,
      invulnerable: false,
      weapon: 'mortar',
      powerups: ['speed', 'dead-mans-switch'],
    },
  ],
  projectiles: [{ id: 70000, kind: 'grenade', ownerNetId: 4, x: 3.1, y: 4.2, vx: 5, vy: -5, height: 0.6 }],
  pickups: ['rocket', null, 'shield'],
  own: {
    ammo: { 'machine-gun': 120, 'bouncy-cannon': 0, laser: 5, rocket: 0, grenade: 3, mortar: 2 },
    powerups: { shield: 0, speed: 8.2, 'damage-boost': 0, 'dead-mans-switch': 29.1 },
  },
};

const NET_IDS = new Map([
  ['host', 0],
  ['peer-a', 3],
]);

const EVERY_KIND_OF_EVENT: GameEvent[] = [
  { type: 'shotFired', tankId: 'host', weapon: 'rocket', x: 4.5, y: 6.25, angle: 1.2 },
  { type: 'shellHit', x: 2, y: 3, tankId: 'peer-a', ownerId: 'host' },
  { type: 'shellHit', x: 2, y: 3, ownerId: 'host' },
  { type: 'tankDamaged', tankId: 'peer-a', attackerId: 'host', amount: 12.5, health: 37.5 },
  { type: 'tankKilled', tankId: 'peer-a', killerId: 'host', cause: 'dead-mans-switch', selfInflicted: false, x: 1, y: 2 },
  { type: 'tankKilled', tankId: 'host', cause: 'lava', selfInflicted: true, x: 1, y: 2 },
  { type: 'tankRespawned', tankId: 'host' },
  { type: 'explosion', x: 10, y: 11, radius: 2.5 },
  { type: 'laserFired', tankId: 'peer-a', points: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 9 }] },
  { type: 'mortarFired', targetX: 7, targetY: 8, flightSeconds: 1.4 },
  { type: 'pickupCollected', tankId: 'host', item: 'dead-mans-switch', x: 3, y: 4 },
  { type: 'roundEnded', standings: [{ playerId: 'host', kills: 300, deaths: 2, streak: 4 }] },
  { type: 'roundStarted' },
];

function playerIdOf(netId: number): string {
  return [...NET_IDS].find(([, candidate]) => candidate === netId)?.[0] ?? `unknown-${netId}`;
}

describe('packets', () => {
  it('round-trips a snapshot', () => {
    const decoded = decodePacket(encodeSnapshot(SNAPSHOT));
    if (decoded?.type !== 'snapshot') throw new Error('expected a snapshot');
    const { snapshot } = decoded;
    const [tank] = snapshot.tanks;
    const [projectile] = snapshot.projectiles;

    expect(snapshot).toMatchObject({ tick: 1234, ackSeq: 99, round: { phase: 'results' } });
    expect(snapshot.round.timeLeft).toBeCloseTo(12.3, 0);
    expect(tank).toMatchObject({ weapon: 'mortar', powerups: ['speed', 'dead-mans-switch'], health: 55, alive: true, invulnerable: false });
    expect(tank.x).toBeCloseTo(12.5, 1);
    expect(tank.vx).toBeCloseTo(-1.5, 1);
    expect(projectile).toMatchObject({ kind: 'grenade', id: 70000 & 0xffff, ownerNetId: 4 });
    expect(projectile.height).toBeCloseTo(0.6, 1);
    expect(snapshot.pickups).toEqual(['rocket', null, 'shield']);
    expect(snapshot.own?.ammo).toMatchObject({ 'machine-gun': 120, mortar: 2 });
    expect(snapshot.own?.powerups).toMatchObject({ speed: 9, 'dead-mans-switch': 30 });
  });

  it('round-trips input frames, including weapon requests', () => {
    const encoded = encodeInputPacket([
      { seq: 5, input: { moveX: -1, moveY: 1, aimAngle: 0.5, aimDistance: 7.5, firing: true, selectWeapon: 'laser' } },
      { seq: 6, input: { moveX: 0, moveY: 0, aimAngle: 0, aimDistance: 0, firing: false, selectWeapon: null } },
    ]);
    const decoded = decodePacket(encoded);
    if (decoded?.type !== 'input') throw new Error('expected input');
    const [first, second] = decoded.frames;

    expect(first.input).toMatchObject({ selectWeapon: 'laser', firing: true });
    expect(first.input.aimDistance).toBeCloseTo(7.5, 1);
    expect(second.input.selectWeapon).toBeNull();
  });

  it('round-trips every kind of event, grouped by tick', () => {
    const encoded = encodeEventPacket(
      [
        { tick: 90, events: EVERY_KIND_OF_EVENT },
        { tick: 91, events: [{ type: 'roundStarted' }] },
      ],
      (id) => NET_IDS.get(id),
    );
    const [first, second] = decodeEventPacket(encoded, playerIdOf);

    expect(first.tick).toBe(90);
    expect(second).toEqual({ tick: 91, events: [{ type: 'roundStarted' }] });
    // Values are picked to survive the wire's precision, apart from the angle and the rounded damage numbers.
    const expected = EVERY_KIND_OF_EVENT.map((event) => {
      if (event.type === 'shotFired') return { ...event, angle: expect.closeTo(event.angle, 3) };
      if (event.type === 'tankDamaged') return { ...event, amount: 13, health: 38 };
      return event;
    });
    expect(first.events).toEqual(expected);
  });

  it('names players the host no longer knows as unknown', () => {
    const encoded = encodeEventPacket([{ tick: 1, events: [{ type: 'tankRespawned', tankId: 'gone' }] }], (id) => NET_IDS.get(id));
    const [{ events }] = decodeEventPacket(encoded, playerIdOf);

    expect(events).toEqual([{ type: 'tankRespawned', tankId: 'unknown-255' }]);
  });

  it('fits a busy moment that outgrows the starting buffer', () => {
    const shot: GameEvent = { type: 'shotFired', tankId: 'host', weapon: 'machine-gun', x: 1, y: 1, angle: 0 };
    const encoded = encodeEventPacket([{ tick: 5, events: Array(200).fill(shot) }], (id) => NET_IDS.get(id));
    const [{ events }] = decodeEventPacket(encoded, playerIdOf);

    expect(events).toHaveLength(200);
    expect(events[199]).toEqual(shot);
  });
});
