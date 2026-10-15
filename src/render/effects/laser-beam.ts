import * as THREE from 'three';
import { glowing } from '../glow';
import type { Point } from '../../sim/game-events';
import type { Effect } from './effect';

const LIFETIME = 0.3;
const BEAM_HEIGHT = 0.42;
const coreGeometry = new THREE.CylinderGeometry(0.035, 0.035, 1, 6).rotateZ(Math.PI / 2);
const glowGeometry = new THREE.CylinderGeometry(0.11, 0.11, 1, 8).rotateZ(Math.PI / 2);

/** The laser's path as a glowing line that bends at each reflection, then fades. */
export function createLaserBeam(points: Point[]): Effect {
  const coreMaterial = new THREE.MeshBasicMaterial({ color: glowing(0xffe4e6, 2.5), transparent: true });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: glowing(0xf43f5e, 1.6),
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const group = new THREE.Group();
  for (let index = 1; index < points.length; index++) {
    group.add(segment(points[index - 1], points[index], coreGeometry, coreMaterial));
    group.add(segment(points[index - 1], points[index], glowGeometry, glowMaterial));
  }
  let age = 0;

  return {
    object: group,
    update(dt) {
      age += dt;
      const progress = Math.min(age / LIFETIME, 1);
      coreMaterial.opacity = 1 - progress;
      glowMaterial.opacity = 0.45 * (1 - progress);
      group.scale.y = 1 - progress * 0.7;
      return progress < 1;
    },
    dispose() {
      coreMaterial.dispose();
      glowMaterial.dispose();
    },
  };
}

function segment(from: Point, to: Point, geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set((from.x + to.x) / 2, BEAM_HEIGHT, (from.y + to.y) / 2);
  mesh.scale.x = Math.hypot(to.x - from.x, to.y - from.y);
  mesh.rotation.y = -Math.atan2(to.y - from.y, to.x - from.x);
  return mesh;
}
