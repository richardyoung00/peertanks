import * as THREE from 'three';
import { BARREL_HEIGHT } from './tank-model';
import type { ProjectileViewState } from './view-state';

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

  sync(projectiles: ProjectileViewState[]): void {
    const alive = new Set<number>();
    for (const projectile of projectiles) {
      alive.add(projectile.id);
      const mesh = this.meshes.get(projectile.id) ?? this.createMesh(projectile.id);
      mesh.position.set(projectile.x, BARREL_HEIGHT, projectile.y);
      mesh.rotation.y = -projectile.angle;
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
