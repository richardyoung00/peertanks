import { describe, expect, it } from 'vitest';
import { decodePacket, encodeInputPacket, encodeSnapshot, type Snapshot } from '../src/net/packets';

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
  projectiles: [{ id: 70000, kind: 'grenade', x: 3.1, y: 4.2, vx: 5, vy: -5, height: 0.6 }],
  pickups: ['rocket', null, 'shield'],
  own: {
    ammo: { 'machine-gun': 120, 'bouncy-cannon': 0, laser: 5, rocket: 0, grenade: 3, mortar: 2 },
    powerups: { shield: 0, speed: 8.2, 'damage-boost': 0, 'dead-mans-switch': 29.1 },
  },
};

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
    expect(projectile).toMatchObject({ kind: 'grenade', id: 70000 & 0xffff });
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
});
