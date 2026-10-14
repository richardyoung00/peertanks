import * as THREE from 'three';
import type { ItemId } from '../sim/items';
import { createPickupModel } from './pickup-models';
import type { PickupViewState } from './view-state';

const FLOAT_HEIGHT = 0.55;
const BOB_HEIGHT = 0.08;
const SPIN_SPEED = 1.6;
const PICKUP_SCALE = 1.5;

interface SpotModel {
  item: ItemId | null;
  model: THREE.Object3D | null;
}

/** Each pickup spot's current item, floating and spinning. Empty spots show nothing at all. */
export class PickupView {
  readonly object = new THREE.Group();
  private readonly spots: SpotModel[] = [];
  private elapsed = 0;

  sync(pickups: PickupViewState[], frameDt: number): void {
    this.elapsed += frameDt;
    pickups.forEach((pickup, index) => {
      const spot = (this.spots[index] ??= { item: null, model: null });
      if (spot.item !== pickup.item) this.swapModel(spot, pickup.item);
      if (spot.model) this.animate(spot.model, pickup, index);
    });
  }

  private swapModel(spot: SpotModel, item: ItemId | null): void {
    if (spot.model) this.object.remove(spot.model);
    spot.model = item ? createPickupModel(item) : null;
    spot.item = item;
    if (!spot.model) return;
    spot.model.scale.setScalar(PICKUP_SCALE);
    this.object.add(spot.model);
  }

  private animate(model: THREE.Object3D, pickup: PickupViewState, index: number): void {
    const phase = this.elapsed * 2 + index;
    model.position.set(pickup.x, FLOAT_HEIGHT + Math.sin(phase) * BOB_HEIGHT, pickup.y);
    model.rotation.y = this.elapsed * SPIN_SPEED + index;
  }
}
