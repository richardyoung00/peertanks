import * as THREE from 'three';
import type { Effect } from './effect';

const BASE_LIFETIME = 0.45;
const BASE_PUFF_COUNT = 6;
const puffGeometry = new THREE.IcosahedronGeometry(0.09, 0);

export interface PuffOptions {
  /** 1 is a shell hitting a wall; bigger values make a bigger, longer burst. */
  size?: number;
  color?: number;
}

interface Puff {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

/** A cartoon dust burst, used for shell hits and (bigger) for destroyed tanks. */
export function createImpactPuff(x: number, y: number, z: number, options: PuffOptions = {}): Effect {
  const size = options.size ?? 1;
  const lifetime = BASE_LIFETIME * Math.sqrt(size);
  const material = new THREE.MeshStandardMaterial({ color: options.color ?? 0xd9d2c5, transparent: true, flatShading: true });
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const puffs = Array.from({ length: Math.round(BASE_PUFF_COUNT * size) }, () => createPuff(group, material, size));
  let age = 0;

  return {
    object: group,
    update(dt) {
      age += dt;
      const progress = Math.min(age / lifetime, 1);
      for (const puff of puffs) {
        puff.mesh.position.addScaledVector(puff.velocity, dt);
        puff.velocity.multiplyScalar(1 - 5 * dt);
        puff.mesh.scale.setScalar((1 + progress * 2) * Math.sqrt(size));
      }
      material.opacity = 1 - progress * progress;
      return progress < 1;
    },
    dispose() {
      material.dispose();
    },
  };
}

function createPuff(group: THREE.Group, material: THREE.Material, size: number): Puff {
  const mesh = new THREE.Mesh(puffGeometry, material);
  const angle = Math.random() * Math.PI * 2;
  const speed = (1 + Math.random() * 1.5) * Math.sqrt(size);
  const velocity = new THREE.Vector3(Math.cos(angle) * speed, 0.5 + Math.random() * size, Math.sin(angle) * speed);
  group.add(mesh);
  return { mesh, velocity };
}
