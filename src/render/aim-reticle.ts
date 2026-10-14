import * as THREE from 'three';

export function createAimReticle(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.2, 0.28, 24).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
  const reticle = new THREE.Mesh(geometry, material);
  reticle.renderOrder = 1;
  return reticle;
}

/** Where the player's mortar will land. */
export function createTargetMarker(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.32, 0.42, 24).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: 0xff6b4a, transparent: true, opacity: 0.85, depthWrite: false });
  const marker = new THREE.Mesh(geometry, material);
  marker.renderOrder = 1;
  marker.visible = false;
  return marker;
}
