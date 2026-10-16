import { describe, expect, it } from 'vitest';
import listing from '../public/maps/index.json';
import { terrainAt } from '../src/sim/game-map';
import { parseTiledMap } from '../src/sim/map-loader';

type TiledJson = Parameters<typeof parseTiledMap>[0];

const mapFiles = import.meta.glob<TiledJson>('../public/maps/*.json', { eager: true, import: 'default' });

describe.each(listing)('map $name', ({ id, name }) => {
  const map = parseTiledMap(mapFiles[`../public/maps/${id}.json`]);

  it('loads with its listed name and room for a full game', () => {
    expect(map.name).toBe(name);
    expect(map.spawns.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps spawns and pickups on open floor', () => {
    for (const point of [...map.spawns, ...map.pickups]) {
      expect(terrainAt(map, Math.floor(point.x), Math.floor(point.y)), `${point.x}, ${point.y}`).toBe('floor');
    }
  });
});
