import type { ItemId, PowerupId, WeaponId } from '../sim/items';
import type { ProjectileKind } from '../sim/projectiles';

/** Everything the renderer needs for one frame, already interpolated. Hosts and clients build this differently. */
export interface TankViewState {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  hullAngle: number;
  aimAngle: number;
  health: number;
  alive: boolean;
  invulnerable: boolean;
  weapon: WeaponId;
  powerups: PowerupId[];
  /** How charged the grenade throw is (0 to 1). Only known for the local player's own tank. */
  grenadeCharge: number;
}

export interface ProjectileViewState {
  id: number;
  kind: ProjectileKind;
  x: number;
  y: number;
  height: number;
  angle: number;
}

export interface PickupViewState {
  x: number;
  y: number;
  item: ItemId | null;
}

export interface ViewState {
  tanks: TankViewState[];
  projectiles: ProjectileViewState[];
  pickups: PickupViewState[];
  /** Where the camera should look; null keeps it where it is. */
  cameraFocus: { x: number; y: number } | null;
}
