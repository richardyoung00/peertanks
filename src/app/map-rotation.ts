import { nextMapId, type GameSettings } from '../sim/game-settings';
import type { GameMap } from '../sim/game-map';
import { fetchMapById } from '../sim/map-loader';
import type { MenuArt } from './menu-art';

/**
 * Works out which map comes after the current round, and loads it during the results screen so the
 * switch is instant. If the next map fails to load, the current one simply plays again.
 */
export class MapRotation {
  private loading: { id: string; map: GameMap | null } | null = null;

  constructor(
    public currentId: string,
    private readonly art: MenuArt,
  ) {}

  nextId(settings: GameSettings): string {
    return nextMapId(settings, this.currentId);
  }

  nextName(settings: GameSettings): string {
    const id = this.nextId(settings);
    return this.art.maps.find((map) => map.id === id)?.name ?? id;
  }

  /** Called when a round ends: starts loading the next map if it's a different one. */
  prepareNext(settings: GameSettings): void {
    const id = this.nextId(settings);
    if (id === this.currentId) {
      this.loading = null;
      return;
    }
    const loading: { id: string; map: GameMap | null } = { id, map: null };
    this.loading = loading;
    fetchMapById(id)
      .then((map) => (loading.map = map))
      .catch((error) => {
        console.warn(`Could not load the next map "${id}"; replaying the current one`, error);
        if (this.loading === loading) this.loading = null;
      });
  }

  /**
   * The loaded next map, once it's ready and still the one that should come next (the host may have
   * changed the rotation during the results screen). Taking it makes it the current map.
   */
  takeReadyMap(settings: GameSettings): { id: string; map: GameMap } | null {
    if (!this.loading?.map || this.loading.id !== this.nextId(settings)) return null;
    const ready = { id: this.loading.id, map: this.loading.map };
    this.loading = null;
    this.currentId = ready.id;
    return ready;
  }
}
