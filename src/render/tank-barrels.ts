import * as THREE from 'three';
import type { WeaponId } from '../sim/items';

// Every barrel points along +X from the turret's centre, at turret height.
const HEIGHT = 0.42;
const TILT_UP = (degrees: number) => (degrees * Math.PI) / 180;

function tube(radius: number, length: number, material: THREE.Material, startX: number, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8).rotateZ(-Math.PI / 2), material);
  mesh.position.set(startX + length / 2, 0, z);
  return mesh;
}

function glow(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 });
}

/** A distinct barrel for each weapon, so everyone can see what you're carrying. */
export function buildBarrel(weapon: WeaponId, material: THREE.Material): THREE.Group {
  const barrel = new THREE.Group();
  barrel.position.y = HEIGHT;

  switch (weapon) {
    case 'cannon':
      barrel.add(tube(0.048, 0.46, material, 0.14), tube(0.065, 0.08, material, 0.56));
      break;
    case 'machine-gun':
      barrel.add(tube(0.025, 0.5, material, 0.14, 0.05), tube(0.025, 0.5, material, 0.14, -0.05));
      barrel.add(tube(0.06, 0.12, material, 0.14));
      break;
    case 'bouncy-cannon':
      barrel.add(tube(0.08, 0.34, material, 0.14), tube(0.09, 0.05, glow(0x4ade80), 0.46));
      break;
    case 'laser':
      barrel.add(tube(0.03, 0.5, material, 0.14));
      barrel.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glow(0xf43f5e)).translateX(0.66));
      break;
    case 'rocket': {
      const launcher = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.16), material);
      launcher.position.x = 0.33;
      barrel.add(launcher, tube(0.05, 0.02, glow(0xf97316), 0.54));
      break;
    }
    case 'grenade': {
      const arm = tube(0.07, 0.24, material, 0.12);
      arm.rotation.z = TILT_UP(20);
      barrel.add(arm);
      break;
    }
    case 'mortar': {
      const mortarTube = tube(0.085, 0.3, material, 0.08);
      mortarTube.rotation.z = TILT_UP(45);
      barrel.add(mortarTube);
      break;
    }
  }
  return barrel;
}
