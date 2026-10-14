import { GAMEPLAY } from '../gameplay-config';
import type { CombatContext } from './combat';
import type { GameMap } from './game-map';
import { ITEM_IDS, isPickupWeapon, type ItemId } from './items';
import { activatePowerup, addWeapon } from './loadout';
import type { Tank } from './tank';

export interface PickupSpot {
  x: number;
  y: number;
  /** What this spot can hold, after the host's allowed list has been applied. */
  choices: ItemId[];
  respawnSeconds: number;
  item: ItemId | null;
  /** Seconds until an empty spot fills again. */
  timer: number;
}

/** The map's pickup spots: each holds one weapon or powerup, and fills again a while after it's taken. */
export class PickupField {
  readonly spots: PickupSpot[];

  constructor(map: GameMap, allowedItems: readonly ItemId[] = ITEM_IDS) {
    this.spots = map.pickups.map((point) => {
      const candidates = point.items.length > 0 ? point.items : ITEM_IDS;
      return {
        x: point.x,
        y: point.y,
        choices: candidates.filter((item) => allowedItems.includes(item)),
        respawnSeconds: point.respawnSeconds ?? GAMEPLAY.pickups.defaultRespawnSeconds,
        item: null,
        timer: 0,
      };
    });
  }

  fillAll(): void {
    for (const spot of this.spots) spot.item = randomChoice(spot.choices);
  }

  clear(): void {
    for (const spot of this.spots) {
      spot.item = null;
      spot.timer = spot.respawnSeconds;
    }
  }

  step(context: CombatContext, dt: number): void {
    for (const spot of this.spots) {
      if (spot.item) this.collectIfTouched(context, spot);
      else this.countDown(spot, dt);
    }
  }

  private countDown(spot: PickupSpot, dt: number): void {
    spot.timer = Math.max(0, spot.timer - dt);
    if (spot.timer === 0) spot.item = randomChoice(spot.choices);
  }

  private collectIfTouched(context: CombatContext, spot: PickupSpot): void {
    const reach = GAMEPLAY.pickups.collectRadius + GAMEPLAY.tank.radius;
    for (const tank of context.tanks.values()) {
      if (!tank.alive || Math.hypot(tank.x - spot.x, tank.y - spot.y) > reach) continue;
      const item = spot.item as ItemId;
      giveItem(tank, item);
      context.emit({ type: 'pickupCollected', tankId: tank.id, item, x: spot.x, y: spot.y });
      spot.item = null;
      spot.timer = spot.respawnSeconds;
      return;
    }
  }
}

function giveItem(tank: Tank, item: ItemId): void {
  if (isPickupWeapon(item)) addWeapon(tank.loadout, item);
  else activatePowerup(tank.loadout, item);
}

function randomChoice(choices: ItemId[]): ItemId | null {
  if (choices.length === 0) return null;
  return choices[Math.floor(Math.random() * choices.length)];
}
