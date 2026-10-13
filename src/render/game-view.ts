import * as THREE from 'three';
import type { GameEvent } from '../sim/game-events';
import type { GameWorld } from '../sim/game-world';
import { lerpAngle } from '../sim/angles';
import { createAimReticle } from './aim-reticle';
import { EffectsLayer } from './effects/effect';
import { createImpactPuff } from './effects/impact-puff';
import { createMuzzleFlash } from './effects/muzzle-flash';
import { FollowCamera } from './follow-camera';
import { ProjectileView } from './projectile-view';
import { centreSunOn, createScene, type SceneParts } from './scene-setup';
import { BARREL_HEIGHT, TankModel } from './tank-model';
import { buildTerrainView, type TerrainView } from './terrain/terrain-view';
import { getTheme } from './themes';

/** Draws the game world. It only reads simulation state; it never changes it. */
export class GameView {
  private readonly parts: SceneParts;
  private readonly followCamera: FollowCamera;
  private readonly terrain: TerrainView;
  private readonly tankModels = new Map<string, TankModel>();
  private readonly projectileView = new ProjectileView();
  private readonly effects = new EffectsLayer();
  private readonly reticle = createAimReticle();
  private elapsed = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly world: GameWorld,
    private readonly localTankId: string,
  ) {
    const theme = getTheme(world.map.theme);
    this.parts = createScene(container, theme);
    this.followCamera = new FollowCamera(container.clientWidth / container.clientHeight);
    this.terrain = buildTerrainView(world.map, theme);
    this.parts.scene.add(this.terrain.object, this.projectileView.object, this.effects.object, this.reticle);

    const localTank = world.tanks.get(localTankId);
    if (localTank) this.followCamera.snapTo(localTank.x, localTank.y);
    window.addEventListener('resize', () => this.resize());
  }

  groundPointAt(ndcX: number, ndcY: number): THREE.Vector3 | null {
    return this.followCamera.groundPointAt(ndcX, ndcY);
  }

  handleEvents(events: GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'shotFired':
          this.tankModels.get(event.tankId)?.kick();
          this.effects.add(createMuzzleFlash(event.x, BARREL_HEIGHT, event.y, event.angle));
          break;
        case 'shellHit':
          this.effects.add(createImpactPuff(event.x, BARREL_HEIGHT, event.y));
          break;
        case 'tankRespawned':
          this.snapCameraIfLocal(event.tankId);
          break;
      }
    }
  }

  render(alpha: number, frameDt: number, aimPoint: THREE.Vector3 | null): void {
    this.elapsed += frameDt;
    this.syncTanks(alpha, frameDt);
    this.projectileView.sync(this.world.projectiles, alpha);
    this.effects.update(frameDt);
    this.terrain.update(this.elapsed);
    this.updateReticle(aimPoint);
    this.updateCamera(alpha, frameDt);
    this.parts.renderer.render(this.parts.scene, this.followCamera.camera);
  }

  private syncTanks(alpha: number, frameDt: number): void {
    for (const tank of this.world.tanks.values()) {
      const model = this.tankModels.get(tank.id) ?? this.createTankModel(tank.id, tank.color);
      const x = THREE.MathUtils.lerp(tank.prevX, tank.x, alpha);
      const z = THREE.MathUtils.lerp(tank.prevY, tank.y, alpha);
      model.setPose(x, z, lerpAngle(tank.prevHullAngle, tank.hullAngle, alpha), tank.aimAngle);
      model.update(frameDt);
    }
  }

  private createTankModel(id: string, color: number): TankModel {
    const model = new TankModel(color);
    this.tankModels.set(id, model);
    this.parts.scene.add(model.root);
    return model;
  }

  private updateCamera(alpha: number, frameDt: number): void {
    const tank = this.world.tanks.get(this.localTankId);
    if (tank) {
      const x = THREE.MathUtils.lerp(tank.prevX, tank.x, alpha);
      const z = THREE.MathUtils.lerp(tank.prevY, tank.y, alpha);
      this.followCamera.follow(x, z, frameDt);
    }
    centreSunOn(this.parts.sun, this.followCamera.focusX, this.followCamera.focusZ);
  }

  private updateReticle(aimPoint: THREE.Vector3 | null): void {
    this.reticle.visible = aimPoint !== null;
    if (aimPoint) this.reticle.position.set(aimPoint.x, 0.02, aimPoint.z);
  }

  private snapCameraIfLocal(tankId: string): void {
    const tank = this.world.tanks.get(tankId);
    if (tankId === this.localTankId && tank) this.followCamera.snapTo(tank.x, tank.y);
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.container;
    this.parts.renderer.setSize(clientWidth, clientHeight);
    this.followCamera.resize(clientWidth / clientHeight);
  }
}
