import * as THREE from 'three';
import type { Effect } from './effect';

const LIFETIME = 7;
const FADE_SECONDS = 2.5;
const SIZE_SHARE_OF_BLAST = 0.38;
const geometry = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
let texture: THREE.Texture | null = null;

/** A soft dark round, darkest in the middle; drawn once and shared by every scorch mark. */
function scorchTexture(): THREE.Texture {
  if (texture) return texture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(20, 16, 12, 0.85)');
  gradient.addColorStop(0.55, 'rgba(30, 24, 18, 0.5)');
  gradient.addColorStop(1, 'rgba(30, 24, 18, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/** A burnt patch left on the grass where something exploded. It fades away after a while. */
export function createScorchMark(x: number, z: number, blastRadius: number): Effect {
  const material = new THREE.MeshBasicMaterial({
    map: scorchTexture(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mark = new THREE.Mesh(geometry, material);
  mark.position.set(x, 0.005, z);
  mark.rotation.y = Math.random() * Math.PI * 2;
  mark.scale.setScalar(blastRadius * SIZE_SHARE_OF_BLAST * (0.85 + Math.random() * 0.3));
  mark.renderOrder = -1;
  let age = 0;

  return {
    object: mark,
    update(dt) {
      age += dt;
      material.opacity = Math.min(1, (LIFETIME - age) / FADE_SECONDS);
      return age < LIFETIME;
    },
    dispose() {
      material.dispose();
    },
  };
}
