import type { MapPoint } from '../../sim/game-map';
import { TankModel } from '../tank-model';

export interface WreckSource {
  color: number;
  /** The tank as it looked when it died. */
  model: TankModel;
  x: number;
  z: number;
}

export interface HazardFall {
  /** The edge of safe ground the tank tipped over. */
  edge: MapPoint;
  /** Height of the water or lava surface. */
  surfaceHeight: number;
}

/** A copy of the dead tank, posed exactly as it died, for the death animation to play with. */
export function copyTank(source: WreckSource): TankModel {
  const copy = new TankModel(source.color);
  copy.setWeapon(source.model.weapon);
  copy.hull.rotation.y = source.model.hull.rotation.y;
  copy.turret.rotation.y = source.model.turret.rotation.y;
  return copy;
}
