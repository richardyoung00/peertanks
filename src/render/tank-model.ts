import * as THREE from 'three';

export const BARREL_HEIGHT = 0.42;

const RECOIL_DISTANCE = 0.14;
const RECOIL_RECOVERY = 7;
const TRACK_COLOR = 0x2c2c2e;
const BARREL_COLOR = 0x3b3d40;

interface TankMaterials {
  body: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  track: THREE.MeshStandardMaterial;
  barrel: THREE.MeshStandardMaterial;
}

/** A low-poly tank built from primitives. Local +X is "forward" for both hull and turret. */
export class TankModel {
  readonly root = new THREE.Group();
  private readonly hull = new THREE.Group();
  private readonly turret = new THREE.Group();
  private readonly barrel = new THREE.Group();
  private recoil = 0;

  constructor(color: number) {
    const materials = createMaterials(color);
    buildHull(this.hull, materials);
    buildTurret(this.turret, this.barrel, materials);
    this.root.add(this.hull, this.turret);
    this.root.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }

  /** Angles are in map space (0 = east, increasing clockwise on screen). */
  setPose(x: number, z: number, hullAngle: number, aimAngle: number): void {
    this.root.position.set(x, 0, z);
    this.hull.rotation.y = -hullAngle;
    this.turret.rotation.y = -aimAngle;
  }

  kick(): void {
    this.recoil = 1;
  }

  update(dt: number): void {
    this.recoil = Math.max(0, this.recoil - RECOIL_RECOVERY * dt);
    const eased = this.recoil * this.recoil;
    this.barrel.position.x = -RECOIL_DISTANCE * eased;
    this.turret.scale.set(1 + 0.12 * eased, 1 - 0.15 * eased, 1 + 0.12 * eased);
  }
}

function createMaterials(color: number): TankMaterials {
  const accentColor = new THREE.Color(color).multiplyScalar(0.72);
  return {
    body: new THREE.MeshStandardMaterial({ color, roughness: 0.55, flatShading: true }),
    accent: new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6, flatShading: true }),
    track: new THREE.MeshStandardMaterial({ color: TRACK_COLOR, roughness: 0.9, flatShading: true }),
    barrel: new THREE.MeshStandardMaterial({ color: BARREL_COLOR, roughness: 0.5, metalness: 0.3 }),
  };
}

function addBox(parent: THREE.Object3D, material: THREE.Material, size: [number, number, number], position: [number, number, number]): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  parent.add(mesh);
}

function buildHull(hull: THREE.Group, materials: TankMaterials): void {
  addBox(hull, materials.track, [0.86, 0.2, 0.17], [0, 0.11, 0.3]);
  addBox(hull, materials.track, [0.86, 0.2, 0.17], [0, 0.11, -0.3]);
  addBox(hull, materials.accent, [0.74, 0.14, 0.48], [0, 0.16, 0]);
  addBox(hull, materials.body, [0.66, 0.12, 0.58], [-0.02, 0.28, 0]);
  addBox(hull, materials.accent, [0.12, 0.08, 0.4], [0.32, 0.27, 0]);
}

function buildTurret(turret: THREE.Group, barrel: THREE.Group, materials: TankMaterials): void {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.14, 8), materials.body);
  base.position.y = BARREL_HEIGHT - 0.02;
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), materials.accent);
  hatch.position.set(-0.06, BARREL_HEIGHT + 0.07, 0.04);

  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.46, 8).rotateZ(-Math.PI / 2), materials.barrel);
  tube.position.set(0.37, BARREL_HEIGHT, 0);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.08, 8).rotateZ(-Math.PI / 2), materials.barrel);
  muzzle.position.set(0.6, BARREL_HEIGHT, 0);
  barrel.add(tube, muzzle);

  turret.add(base, hatch, barrel);
}
