import * as THREE from 'three';
import type { Effect } from './effect';

const FIREBALL_SECONDS = 0.35;
const SHOCKWAVE_SECONDS = 0.45;
const fireballGeometry = new THREE.IcosahedronGeometry(1, 1);
const shockwaveGeometry = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);

/** A cartoon fireball with a ground shockwave ring the size of the blast. */
export function createExplosion(x: number, z: number, radius: number): Effect {
  const fireballMaterial = new THREE.MeshBasicMaterial({ color: 0xffb03b, transparent: true });
  const shockwaveMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1c1, transparent: true, depthWrite: false });
  const fireball = new THREE.Mesh(fireballGeometry, fireballMaterial);
  const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
  fireball.position.y = 0.4;
  shockwave.position.y = 0.05;

  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.add(fireball, shockwave);
  let age = 0;

  return {
    object: group,
    update(dt) {
      age += dt;
      const fire = Math.min(age / FIREBALL_SECONDS, 1);
      fireball.scale.setScalar(radius * (0.3 + 0.5 * Math.sqrt(fire)));
      fireballMaterial.opacity = 1 - fire;
      fireballMaterial.color.setHSL(0.1 - 0.08 * fire, 1, 0.6 - 0.25 * fire);

      const wave = Math.min(age / SHOCKWAVE_SECONDS, 1);
      shockwave.scale.setScalar(radius * (0.2 + 0.8 * wave));
      shockwaveMaterial.opacity = 0.8 * (1 - wave);
      return wave < 1;
    },
    dispose() {
      fireballMaterial.dispose();
      shockwaveMaterial.dispose();
    },
  };
}
