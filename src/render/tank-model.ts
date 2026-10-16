import * as THREE from 'three';
import type { PowerupId, WeaponId } from '../sim/items';
import { PowerupVisuals } from './powerup-visuals';
import { buildBarrel } from './tank-barrels';

export const BARREL_HEIGHT = 0.42;

const RECOIL_DISTANCE = 0.14;
const RECOIL_RECOVERY = 7;
const TRACK_COLOR = 0x2c2c2e;
const BARREL_COLOR = 0x3b3d40;
const HIT_FLASH_COLOR = new THREE.Color(0xffffff);
const HIT_FLASH_RECOVERY = 6;
const HIT_SQUASH = 0.12;
const SHIELD_COLOR = new THREE.Color(0x7dd3fc);
const SHIELD_PULSE_SPEED = 12;
const SCORCHED_COLOR = new THREE.Color(0x231d1a);
const HEAT_COLOR = new THREE.Color(0xff4a12);

interface TankMaterials {
  body: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  track: THREE.MeshStandardMaterial;
  barrel: THREE.MeshStandardMaterial;
}

/** A low-poly tank built from primitives. Local +X is "forward" for both hull and turret. */
export class TankModel {
  readonly root = new THREE.Group();
  /** The parts move separately in death animations, e.g. the turret flying off. */
  readonly hull = new THREE.Group();
  readonly turret = new THREE.Group();
  private readonly powerups = new PowerupVisuals();
  private readonly materials: TankMaterials;
  private readonly baseColors: Map<THREE.MeshStandardMaterial, THREE.Color>;
  private barrel: THREE.Group;
  private currentWeapon: WeaponId = 'cannon';
  private recoil = 0;
  private hitFlash = 0;
  private shielded = false;
  private elapsed = 0;

  constructor(readonly color: number) {
    this.materials = createMaterials(color);
    this.baseColors = new Map(Object.values(this.materials).map((material) => [material, material.color.clone()]));
    buildHull(this.hull, this.materials);
    buildTurret(this.turret, this.materials);
    this.barrel = buildBarrel(this.currentWeapon, this.materials.barrel);
    this.turret.add(this.barrel);
    this.root.add(this.hull, this.turret);
    this.root.add(this.powerups.object);
  }

  get weapon(): WeaponId {
    return this.currentWeapon;
  }

  setWeapon(weapon: WeaponId): void {
    if (weapon === this.currentWeapon) return;
    this.currentWeapon = weapon;
    this.turret.remove(this.barrel);
    this.barrel = buildBarrel(weapon, this.materials.barrel);
    this.turret.add(this.barrel);
  }

  setPowerups(powerups: PowerupId[]): void {
    this.powerups.setActive(powerups);
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

  flashHit(): void {
    this.hitFlash = 1;
  }

  /** Spawn protection shows as a pulsing glow. */
  setShielded(shielded: boolean): void {
    this.shielded = shielded;
  }

  /** Blackens the paint, from 0 (as new) to 1 (burnt out). Used by wrecks. */
  setScorch(amount: number): void {
    for (const [material, base] of this.baseColors) material.color.copy(base).lerp(SCORCHED_COLOR, amount);
  }

  /** Makes the whole tank glow red-hot, from 0 to 1. Used by wrecks sinking into lava. */
  setHeat(amount: number): void {
    for (const material of this.baseColors.keys()) {
      material.emissive.copy(HEAT_COLOR);
      material.emissiveIntensity = amount * 1.4;
    }
  }

  /** Frees the hull and turret. Powerup visuals share their shapes with every tank, so they're left alone. */
  dispose(): void {
    for (const part of [this.hull, this.turret]) {
      part.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
    }
    for (const material of this.baseColors.keys()) material.dispose();
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.recoil = Math.max(0, this.recoil - RECOIL_RECOVERY * dt);
    this.hitFlash = Math.max(0, this.hitFlash - HIT_FLASH_RECOVERY * dt);

    const recoil = this.recoil * this.recoil;
    this.barrel.position.x = -RECOIL_DISTANCE * recoil;
    this.turret.scale.set(1 + 0.12 * recoil, 1 - 0.15 * recoil, 1 + 0.12 * recoil);

    const squash = HIT_SQUASH * this.hitFlash;
    this.hull.scale.set(1 + squash, 1 - squash, 1 + squash);
    this.updateGlow();
    this.powerups.update(this.elapsed);
  }

  private updateGlow(): void {
    const shieldPulse = this.shielded ? 0.35 + 0.25 * Math.sin(this.elapsed * SHIELD_PULSE_SPEED) : 0;
    for (const material of [this.materials.body, this.materials.accent]) {
      material.emissive.copy(SHIELD_COLOR).lerp(HIT_FLASH_COLOR, this.hitFlash);
      material.emissiveIntensity = Math.max(shieldPulse, this.hitFlash);
    }
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

function buildTurret(turret: THREE.Group, materials: TankMaterials): void {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.14, 8), materials.body);
  base.position.y = BARREL_HEIGHT - 0.02;
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), materials.accent);
  hatch.position.set(-0.06, BARREL_HEIGHT + 0.07, 0.04);
  turret.add(base, hatch);
}
