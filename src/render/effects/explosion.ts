import * as THREE from 'three';
import type { Effect } from './effect';
import { debris, flames, smoke, sparks } from './particle-bursts';
import type { ParticlePools } from './particles';

const FIREBALL_SECONDS = 0.35;
/** Brighter than white, so bloom makes the fireball glow. */
const FIREBALL_GLOW = 1.15;
const SHOCKWAVE_SECONDS = 0.45;
const fireballGeometry = new THREE.IcosahedronGeometry(1, 1);
const shockwaveGeometry = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);

/** Particle counts for a blast of radius 2.6, the size of a rocket's; bigger and smaller blasts scale from it. */
const REFERENCE_RADIUS = 2.6;

/** A cartoon fireball and a ground shockwave the size of the blast, with flames, sparks, flying debris and smoke. */
export function createExplosion(x: number, z: number, radius: number, pools: ParticlePools): Effect {
  const size = radius / REFERENCE_RADIUS;
  const centre = { x, y: 0.4, z };
  flames(pools, centre, Math.round(14 * size), size * 1.3);
  sparks(pools, centre, Math.round(22 * size), size);
  debris(pools, { x, y: 0.15, z }, Math.round(10 * size), size);
  smoke(pools, centre, Math.round(10 * size), size);

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
      fireballMaterial.color.setHSL(0.1 - 0.08 * fire, 1, 0.6 - 0.25 * fire).multiplyScalar(FIREBALL_GLOW);

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
