import * as THREE from 'three';

/** A short-lived visual. `update` returns false once the effect has finished. */
export interface Effect {
  object: THREE.Object3D;
  update(dt: number): boolean;
  dispose(): void;
}

export class EffectsLayer {
  readonly object = new THREE.Group();
  private effects: Effect[] = [];

  add(effect: Effect): void {
    this.effects.push(effect);
    this.object.add(effect.object);
  }

  update(dt: number): void {
    this.effects = this.effects.filter((effect) => {
      if (effect.update(dt)) return true;
      this.object.remove(effect.object);
      effect.dispose();
      return false;
    });
  }
}
