import * as THREE from 'three';

/** A colour brighter than its base (`boost` above 1, clipped at white), so hot things like lava cracks stand out. */
export function glowing(color: number, boost: number): THREE.Color {
  return new THREE.Color(color).multiplyScalar(boost);
}
