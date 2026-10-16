import * as THREE from 'three';
import { glowing } from './glow';
import type { ProjectileKind } from '../sim/projectiles';

// Shared geometry and materials: projectiles come and go constantly, so they're never rebuilt.
const along = (geometry: THREE.BufferGeometry) => geometry.rotateZ(Math.PI / 2);

const geometries = {
  shell: along(new THREE.CapsuleGeometry(0.07, 0.14, 4, 8)),
  bullet: along(new THREE.CapsuleGeometry(0.035, 0.12, 3, 6)),
  bouncy: new THREE.IcosahedronGeometry(0.11, 1),
  rocketBody: along(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 8)),
  rocketNose: along(new THREE.ConeGeometry(0.06, 0.12, 8)).rotateZ(Math.PI),
  rocketFlame: new THREE.OctahedronGeometry(0.07, 0),
  grenade: new THREE.IcosahedronGeometry(0.1, 1),
  grenadeLight: new THREE.SphereGeometry(0.03, 6, 4),
  mortar: new THREE.IcosahedronGeometry(0.14, 1),
  shellStreak: streakGeometry(0.06, 0.55),
  bulletStreak: streakGeometry(0.03, 0.4),
};

/** A glowing cone tapering away behind a fast shot, so you can follow where it's going. */
function streakGeometry(radius: number, length: number): THREE.BufferGeometry {
  return new THREE.ConeGeometry(radius, length, 6).rotateZ(Math.PI / 2).translate(-length / 2 - 0.04, 0, 0);
}

function streakMaterial(color: number, glow: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: glowing(color, glow), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
}

export const projectileMaterials = {
  shell: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, emissive: 0xffa040, emissiveIntensity: 0.35, roughness: 0.4 }),
  bullet: new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffd34d, emissiveIntensity: 2.5 }),
  bouncy: new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 2, flatShading: true }),
  rocket: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5, flatShading: true }),
  rocketNose: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.5, flatShading: true }),
  flame: new THREE.MeshBasicMaterial({ color: glowing(0xffb347, 2) }),
  grenade: new THREE.MeshStandardMaterial({ color: 0x4d5d2a, roughness: 0.7, flatShading: true }),
  /** Blinks on and off; animated in ProjectileView. */
  grenadeLight: new THREE.MeshBasicMaterial({ color: glowing(0xff3b30, 3) }),
  mortar: new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.5, flatShading: true }),
  shellStreak: streakMaterial(0xffc46b, 1.6),
  bulletStreak: streakMaterial(0xfff1a8, 1.6),
};

export function createProjectileModel(kind: ProjectileKind): THREE.Object3D {
  const group = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, 0);
    group.add(mesh);
  };

  switch (kind) {
    case 'shell':
      add(geometries.shell, projectileMaterials.shell);
      add(geometries.shellStreak, projectileMaterials.shellStreak);
      break;
    case 'bullet':
      add(geometries.bullet, projectileMaterials.bullet);
      add(geometries.bulletStreak, projectileMaterials.bulletStreak);
      break;
    case 'bouncy':
      add(geometries.bouncy, projectileMaterials.bouncy);
      break;
    case 'rocket':
      add(geometries.rocketBody, projectileMaterials.rocket);
      add(geometries.rocketNose, projectileMaterials.rocketNose, 0.19);
      add(geometries.rocketFlame, projectileMaterials.flame, -0.17);
      break;
    case 'grenade':
      add(geometries.grenade, projectileMaterials.grenade);
      add(geometries.grenadeLight, projectileMaterials.grenadeLight, 0, 0.1);
      break;
    case 'mortar':
      add(geometries.mortar, projectileMaterials.mortar);
      break;
  }
  return group;
}
