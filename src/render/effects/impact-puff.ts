import * as THREE from 'three';
import type { Effect } from './effect';

const LIFETIME = 0.45;
const PUFF_COUNT = 6;
const puffGeometry = new THREE.IcosahedronGeometry(0.09, 0);

interface Puff {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

/** A small cartoon dust burst where a shell hits something. */
export function createImpactPuff(x: number, y: number, z: number): Effect {
  const material = new THREE.MeshStandardMaterial({ color: 0xd9d2c5, transparent: true, flatShading: true });
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const puffs = Array.from({ length: PUFF_COUNT }, () => createPuff(group, material));
  let age = 0;

  return {
    object: group,
    update(dt) {
      age += dt;
      const progress = Math.min(age / LIFETIME, 1);
      for (const puff of puffs) {
        puff.mesh.position.addScaledVector(puff.velocity, dt);
        puff.velocity.multiplyScalar(1 - 5 * dt);
        puff.mesh.scale.setScalar(1 + progress * 2);
      }
      material.opacity = 1 - progress * progress;
      return progress < 1;
    },
    dispose() {
      material.dispose();
    },
  };
}

function createPuff(group: THREE.Group, material: THREE.Material): Puff {
  const mesh = new THREE.Mesh(puffGeometry, material);
  const angle = Math.random() * Math.PI * 2;
  const speed = 1 + Math.random() * 1.5;
  const velocity = new THREE.Vector3(Math.cos(angle) * speed, 0.5 + Math.random(), Math.sin(angle) * speed);
  group.add(mesh);
  return { mesh, velocity };
}
