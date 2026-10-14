import * as THREE from 'three';
import type { ItemId, PickupWeaponId } from '../sim/items';

export const WEAPON_COLORS: Record<PickupWeaponId, number> = {
  'machine-gun': 0xfacc15,
  'bouncy-cannon': 0x4ade80,
  laser: 0xf43f5e,
  rocket: 0xf97316,
  grenade: 0x84cc16,
  mortar: 0x94a3b8,
};

const GUNMETAL = 0x3b3d40;

/** A small low-poly model of the item itself, so players can tell at a glance what they'd be picking up. */
export function createPickupModel(item: ItemId): THREE.Object3D {
  const model = new THREE.Group();
  BUILDERS[item](model);
  model.traverse((child) => (child.castShadow = true));
  return model;
}

const BUILDERS: Record<ItemId, (model: THREE.Group) => void> = {
  'machine-gun': (model) => {
    add(model, new THREE.BoxGeometry(0.34, 0.14, 0.16), solid(GUNMETAL), [-0.05, 0, 0]);
    add(model, barrel(0.025, 0.4), solid(GUNMETAL), [0.3, 0.02, 0.04]);
    add(model, barrel(0.025, 0.4), solid(GUNMETAL), [0.3, 0.02, -0.04]);
    add(model, new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10).rotateX(Math.PI / 2), glowing(WEAPON_COLORS['machine-gun'], 0.3), [-0.02, -0.11, 0]);
  },
  // Just the glowing ball, off-centre so it circles as the pickup spins.
  'bouncy-cannon': (model) => {
    add(model, new THREE.IcosahedronGeometry(0.11, 1), glowing(WEAPON_COLORS['bouncy-cannon'], 0.8), [0.3, 0, 0]);
  },
  laser: (model) => {
    add(model, barrel(0.035, 0.5), solid(0xd4d4d8), [0, 0, 0]);
    add(model, new THREE.BoxGeometry(0.16, 0.18, 0.02), solid(GUNMETAL), [-0.15, 0, 0]);
    add(model, new THREE.OctahedronGeometry(0.08, 0), glowing(WEAPON_COLORS.laser, 1), [0.29, 0, 0]);
  },
  rocket: (model) => {
    add(model, barrel(0.07, 0.4), solid(0xdc2626), [0, 0, 0]);
    add(model, new THREE.ConeGeometry(0.07, 0.16, 10).rotateZ(-Math.PI / 2), solid(0xe5e7eb), [0.28, 0, 0]);
    for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const fin = add(model, new THREE.BoxGeometry(0.1, 0.12, 0.015), solid(0xe5e7eb), [-0.16, 0, 0]);
      fin.rotation.x = angle;
      fin.translateY(0.08);
    }
  },
  grenade: (model) => {
    add(model, new THREE.IcosahedronGeometry(0.15, 1), solid(0x4d5d2a), [0, 0, 0]);
    add(model, new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), solid(GUNMETAL), [0, 0.16, 0]);
    add(model, new THREE.BoxGeometry(0.03, 0.14, 0.04), solid(GUNMETAL), [0.06, 0.12, 0]);
    add(model, new THREE.TorusGeometry(0.04, 0.01, 6, 12), glowing(0xe5e7eb, 0.2), [-0.06, 0.2, 0]);
  },
  mortar: (model) => {
    add(model, new THREE.BoxGeometry(0.34, 0.04, 0.34), solid(GUNMETAL), [0, -0.14, 0]);
    const tube = add(model, barrel(0.08, 0.4), solid(WEAPON_COLORS.mortar), [0, 0.02, 0]);
    tube.rotation.z = Math.PI / 4;
  },
  shield: (model) => {
    add(model, extruded(shieldShape(), 0.06), glowing(0x60a5fa, 0.5), [0, 0, 0]);
  },
  speed: (model) => {
    add(model, extruded(lightningShape(), 0.06), glowing(0xfde047, 0.7), [0, 0, 0]);
  },
  'damage-boost': (model) => {
    add(model, new THREE.OctahedronGeometry(0.2, 0), glowing(0xef4444, 0.6), [0, 0, 0]);
    add(model, new THREE.OctahedronGeometry(0.2, 0).rotateY(Math.PI / 4).rotateX(Math.PI / 4), glowing(0xef4444, 0.6), [0, 0, 0]);
  },
  'dead-mans-switch': (model) => {
    add(model, new THREE.IcosahedronGeometry(0.18, 1), solid(0x1f1f1f), [0, 0, 0]);
    add(model, new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), solid(GUNMETAL), [0, 0.18, 0]);
    add(model, new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4).rotateZ(0.5), solid(0xa16207), [0.03, 0.25, 0]);
    add(model, new THREE.OctahedronGeometry(0.035, 0), glowing(0xff7a1a, 1), [0.07, 0.31, 0]);
  },
};

function add(model: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  model.add(mesh);
  return mesh;
}

/** A tube lying along +X, centred on its middle. */
function barrel(radius: number, length: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius, radius, length, 10).rotateZ(-Math.PI / 2);
}

function solid(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true });
}

function glowing(color: number, intensity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, flatShading: true });
}

function extruded(shape: THREE.Shape, depth: number): THREE.BufferGeometry {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}

function shieldShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.18, 0.18);
  shape.lineTo(0.18, 0.18);
  shape.lineTo(0.18, 0);
  shape.quadraticCurveTo(0.16, -0.16, 0, -0.24);
  shape.quadraticCurveTo(-0.16, -0.16, -0.18, 0);
  shape.closePath();
  return shape;
}

function lightningShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0.04, 0.24);
  shape.lineTo(-0.12, -0.02);
  shape.lineTo(0.0, -0.02);
  shape.lineTo(-0.06, -0.24);
  shape.lineTo(0.12, 0.04);
  shape.lineTo(0.0, 0.04);
  shape.closePath();
  return shape;
}
