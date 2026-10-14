import type { GameMap, MapPoint, PickupPoint } from './game-map';
import { isItemId, type ItemId } from './items';
import { isTerrainType, type TerrainType } from './terrain';

// The subset of the Tiled JSON format (https://doc.mapeditor.org/en/stable/reference/json-map-format/) we use.
interface TiledProperty {
  name: string;
  value: unknown;
}

interface TiledTile {
  id: number;
  properties?: TiledProperty[];
}

interface TiledTileset {
  firstgid: number;
  source?: string;
  tiles?: TiledTile[];
}

interface TiledObject {
  type?: string;
  x: number;
  y: number;
  properties?: TiledProperty[];
}

interface TiledLayer {
  name: string;
  type: 'tilelayer' | 'objectgroup' | string;
  data?: number[];
  encoding?: string;
  objects?: TiledObject[];
}

interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
}

const TERRAIN_LAYER = 'terrain';
const OBJECTS_LAYER = 'objects';
const TILED_FLIP_FLAGS_MASK = 0x1fffffff;
const MAX_MAP_SIZE = 100;

export interface MapListing {
  id: string;
  name: string;
}

// A function rather than a constant, so the simulation can load in tests that run outside Vite.
function mapsFolder(): string {
  return `${import.meta.env.BASE_URL}maps/`;
}

/** The maps a host can choose from, listed in public/maps/index.json. */
export async function fetchMapList(): Promise<MapListing[]> {
  const response = await fetch(`${mapsFolder()}index.json`);
  if (!response.ok) throw new Error(`Could not load the map list (${response.status})`);
  return response.json();
}

export function fetchMapById(id: string): Promise<GameMap> {
  return fetchMap(`${mapsFolder()}${encodeURIComponent(id)}.json`);
}

export async function fetchMap(url: string): Promise<GameMap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load map ${url} (${response.status})`);
  return parseTiledMap(await response.json());
}

export function parseTiledMap(tiled: TiledMap): GameMap {
  validateSize(tiled);
  const terrainByGid = buildTerrainLookup(tiled.tilesets);
  const objects = findLayer(tiled, OBJECTS_LAYER, 'objectgroup').objects ?? [];

  const map: GameMap = {
    name: stringProperty(tiled.properties, 'name') ?? 'Untitled',
    theme: stringProperty(tiled.properties, 'theme') ?? 'grassland',
    width: tiled.width,
    height: tiled.height,
    terrain: readTerrain(tiled, terrainByGid),
    spawns: readSpawns(tiled, objects),
    pickups: readPickups(tiled, objects),
  };

  if (map.spawns.length === 0) throw new Error('Map has no spawn points');
  return map;
}

function validateSize(tiled: TiledMap): void {
  const tooBig = tiled.width > MAX_MAP_SIZE || tiled.height > MAX_MAP_SIZE;
  if (tiled.width < 1 || tiled.height < 1 || tooBig) {
    throw new Error(`Map size ${tiled.width}x${tiled.height} is outside the allowed range`);
  }
}

function buildTerrainLookup(tilesets: TiledTileset[]): Map<number, TerrainType> {
  const terrainByGid = new Map<number, TerrainType>();
  for (const tileset of tilesets) {
    if (tileset.source) throw new Error('External tilesets are not supported; embed the tileset in the map');
    for (const tile of tileset.tiles ?? []) {
      const terrain = stringProperty(tile.properties, 'terrain');
      if (!isTerrainType(terrain)) throw new Error(`Tile ${tile.id} has unknown terrain "${terrain}"`);
      terrainByGid.set(tileset.firstgid + tile.id, terrain);
    }
  }
  return terrainByGid;
}

function readTerrain(tiled: TiledMap, terrainByGid: Map<number, TerrainType>): TerrainType[] {
  const layer = findLayer(tiled, TERRAIN_LAYER, 'tilelayer');
  if (layer.encoding && layer.encoding !== 'csv') {
    throw new Error('Terrain layer must use CSV encoding');
  }
  const data = layer.data ?? [];
  if (data.length !== tiled.width * tiled.height) throw new Error('Terrain layer size does not match map size');

  return data.map((rawGid) => {
    const gid = rawGid & TILED_FLIP_FLAGS_MASK;
    if (gid === 0) return 'floor';
    const terrain = terrainByGid.get(gid);
    if (!terrain) throw new Error(`Terrain layer uses unknown tile ${gid}`);
    return terrain;
  });
}

function readSpawns(tiled: TiledMap, objects: TiledObject[]): MapPoint[] {
  return objects.filter((object) => object.type === 'spawn').map((object) => toTileUnits(tiled, object));
}

function readPickups(tiled: TiledMap, objects: TiledObject[]): PickupPoint[] {
  return objects
    .filter((object) => object.type === 'pickup')
    .map((object) => ({
      ...toTileUnits(tiled, object),
      items: parseItemList(stringProperty(object.properties, 'items') ?? ''),
      respawnSeconds: numberProperty(object.properties, 'respawnSeconds'),
    }));
}

/** A comma-separated list such as "rocket, grenade, mortar". */
function parseItemList(text: string): ItemId[] {
  const names = text
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  for (const name of names) {
    if (!isItemId(name)) throw new Error(`Pickup spot lists unknown item "${name}"`);
  }
  return names as ItemId[];
}

function toTileUnits(tiled: TiledMap, object: TiledObject): MapPoint {
  return { x: object.x / tiled.tilewidth, y: object.y / tiled.tileheight };
}

function findLayer(tiled: TiledMap, name: string, type: TiledLayer['type']): TiledLayer {
  const layer = tiled.layers.find((candidate) => candidate.name === name && candidate.type === type);
  if (!layer) throw new Error(`Map is missing the "${name}" ${type} layer`);
  return layer;
}

function stringProperty(properties: TiledProperty[] | undefined, name: string): string | undefined {
  const value = properties?.find((property) => property.name === name)?.value;
  return typeof value === 'string' ? value : undefined;
}

function numberProperty(properties: TiledProperty[] | undefined, name: string): number | undefined {
  const value = properties?.find((property) => property.name === name)?.value;
  return typeof value === 'number' ? value : undefined;
}
