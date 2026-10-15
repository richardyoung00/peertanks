import { renderThumbnails, type Thumbnails } from '../render/thumbnails';
import type { GameMap } from '../sim/game-map';
import { fetchMapById, fetchMapList } from '../sim/map-loader';

export type MapSize = 'S' | 'M' | 'L';

export interface MapCard {
  id: string;
  name: string;
  size: MapSize;
  thumbnail: string;
}

export interface MenuArt {
  maps: MapCard[];
  itemThumbnails: Thumbnails['items'];
}

// Tile counts (width × height) at or below which a map counts as small or medium.
const SMALL_MAP_TILES = 700;
const MEDIUM_MAP_TILES = 1400;

let cached: Promise<MenuArt> | null = null;

/** Map cards and item pictures for the lobby and the in-game menu, prepared once and shared. */
export function loadMenuArt(): Promise<MenuArt> {
  cached ??= prepareMenuArt();
  return cached;
}

async function prepareMenuArt(): Promise<MenuArt> {
  const listings = await fetchMapList();
  const maps = await Promise.all(listings.map((listing) => fetchMapById(listing.id)));
  const mapsById = Object.fromEntries(listings.map((listing, index) => [listing.id, maps[index]]));
  const thumbnails = renderThumbnails(mapsById);

  return {
    maps: listings.map((listing, index) => ({
      id: listing.id,
      name: listing.name,
      size: mapSize(maps[index]),
      thumbnail: thumbnails.maps[listing.id],
    })),
    itemThumbnails: thumbnails.items,
  };
}

function mapSize(map: GameMap): MapSize {
  const tiles = map.width * map.height;
  if (tiles <= SMALL_MAP_TILES) return 'S';
  if (tiles <= MEDIUM_MAP_TILES) return 'M';
  return 'L';
}
