import * as THREE from 'three';
import type { Projectile } from '../sim/projectiles';
import { BARREL_HEIGHT } from './tank-model';

const shellGeometry = new THREE.CapsuleGeometry(0.07, 0.14, 4, 8).rotateZ(Math.PI / 2);
const shellMaterial = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a,
  emissive: 0xffa040,
  emissiveIntensity: 0.35,
  roughness: 0.4,
});

/** Keeps one mesh per live projectile, adding and removing meshes as projectiles come and go. */
export class ProjectileView {
  readonly object = new THREE.Group();
  private readonly meshes = new Map<number, THREE.Mesh>();

  sync(projectiles: Projectile[], alpha: number): void {
    const alive = new Set<number>();
    for (const projectile of projectiles) {
      alive.add(projectile.id);
      const mesh = this.meshes.get(projectile.id) ?? this.createMesh(projectile.id);
      const x = THREE.MathUtils.lerp(projectile.prevX, projectile.x, alpha);
      const z = THREE.MathUtils.lerp(projectile.prevY, projectile.y, alpha);
      mesh.position.set(x, BARREL_HEIGHT, z);
      mesh.rotation.y = -Math.atan2(projectile.vy, projectile.vx);
    }
    this.removeMissing(alive);
  }

  private createMesh(id: number): THREE.Mesh {
    const mesh = new THREE.Mesh(shellGeometry, shellMaterial);
    mesh.castShadow = true;
    this.meshes.set(id, mesh);
    this.object.add(mesh);
    return mesh;
  }

  private removeMissing(alive: Set<number>): void {
    for (const [id, mesh] of this.meshes) {
      if (alive.has(id)) continue;
      this.object.remove(mesh);
      this.meshes.delete(id);
    }
  }
}
