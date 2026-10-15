import * as THREE from 'three';

/** A colour brighter than white (`boost` above 1), so the bloom pass makes it glow. Without bloom it just looks bright. */
export function glowing(color: number, boost: number): THREE.Color {
  return new THREE.Color(color).multiplyScalar(boost);
}
