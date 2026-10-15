import * as THREE from 'three';
import { glowing } from '../glow';
import type { Effect } from './effect';

const LIFETIME = 0.09;
const flashGeometry = new THREE.OctahedronGeometry(0.16, 0);

export function createMuzzleFlash(x: number, y: number, z: number, angle: number): Effect {
  const material = new THREE.MeshBasicMaterial({ color: glowing(0xffd36b, 2), transparent: true });
  const flash = new THREE.Mesh(flashGeometry, material);
  flash.position.set(x, y, z);
  flash.rotation.y = -angle;
  let age = 0;

  return {
    object: flash,
    update(dt) {
      age += dt;
      const progress = Math.min(age / LIFETIME, 1);
      flash.scale.set(1 + progress * 1.5, 1 + progress * 0.6, 1 + progress * 0.6);
      material.opacity = 1 - progress;
      return progress < 1;
    },
    dispose() {
      material.dispose();
    },
  };
}
