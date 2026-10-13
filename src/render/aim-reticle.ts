import * as THREE from 'three';

export function createAimReticle(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.2, 0.28, 24).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
  const reticle = new THREE.Mesh(geometry, material);
  reticle.renderOrder = 1;
  return reticle;
}
