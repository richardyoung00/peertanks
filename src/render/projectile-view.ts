import * as THREE from 'three';
import type { ProjectileKind } from '../sim/projectiles';
import { createProjectileModel, projectileMaterials } from './projectile-models';
import type { ProjectileViewState } from './view-state';

const GRENADE_BLINK_SPEED = 10;

interface ProjectileModel {
  kind: ProjectileKind;
  object: THREE.Object3D;
}

/** Keeps one model per live projectile, adding and removing models as projectiles come and go. */
export class ProjectileView {
  readonly object = new THREE.Group();
  private readonly models = new Map<number, ProjectileModel>();
  private elapsed = 0;

  sync(projectiles: ProjectileViewState[], frameDt: number): void {
    this.elapsed += frameDt;
    projectileMaterials.grenadeLight.visible = Math.sin(this.elapsed * GRENADE_BLINK_SPEED) > 0;

    const alive = new Set<number>();
    for (const projectile of projectiles) {
      alive.add(projectile.id);
      const model = this.modelFor(projectile);
      model.object.position.set(projectile.x, projectile.height, projectile.y);
      model.object.rotation.y = -projectile.angle;
    }
    this.removeMissing(alive);
  }

  private modelFor(projectile: ProjectileViewState): ProjectileModel {
    const existing = this.models.get(projectile.id);
    if (existing && existing.kind === projectile.kind) return existing;
    if (existing) this.object.remove(existing.object);

    const model = { kind: projectile.kind, object: createProjectileModel(projectile.kind) };
    this.models.set(projectile.id, model);
    this.object.add(model.object);
    return model;
  }

  private removeMissing(alive: Set<number>): void {
    for (const [id, model] of this.models) {
      if (alive.has(id)) continue;
      this.object.remove(model.object);
      this.models.delete(id);
    }
  }
}
