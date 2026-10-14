import * as THREE from 'three';
import type { GameEvent } from '../sim/game-events';
import type { GameMap } from '../sim/game-map';
import { createAimReticle } from './aim-reticle';
import { EffectsLayer } from './effects/effect';
import { createImpactPuff } from './effects/impact-puff';
import { createMuzzleFlash } from './effects/muzzle-flash';
import { FollowCamera } from './follow-camera';
import { NameTags } from './name-tags';
import { ProjectileView } from './projectile-view';
import { centreSunOn, createScene, type SceneParts } from './scene-setup';
import { BARREL_HEIGHT, TankModel } from './tank-model';
import { buildTerrainView, type TerrainView } from './terrain/terrain-view';
import { getTheme } from './themes';
import type { TankViewState, ViewState } from './view-state';

/** Draws the game. It only reads the view state it is given; it never changes the simulation. */
export class GameView {
  private readonly parts: SceneParts;
  private readonly followCamera: FollowCamera;
  private readonly terrain: TerrainView;
  private readonly tankModels = new Map<string, TankModel>();
  private readonly projectileView = new ProjectileView();
  private readonly effects = new EffectsLayer();
  private readonly reticle = createAimReticle();
  private readonly nameTags: NameTags;
  private elapsed = 0;

  constructor(
    private readonly container: HTMLElement,
    map: GameMap,
  ) {
    const theme = getTheme(map.theme);
    this.parts = createScene(container, theme);
    this.followCamera = new FollowCamera(container.clientWidth / container.clientHeight);
    this.terrain = buildTerrainView(map, theme);
    this.parts.scene.add(this.terrain.object, this.projectileView.object, this.effects.object, this.reticle);
    this.nameTags = new NameTags(container);
    window.addEventListener('resize', () => this.resize());
  }

  groundPointAt(ndcX: number, ndcY: number): THREE.Vector3 | null {
    return this.followCamera.groundPointAt(ndcX, ndcY);
  }

  snapCamera(x: number, y: number): void {
    this.followCamera.snapTo(x, y);
  }

  handleEvents(events: GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'shotFired':
          this.showShot(event.tankId, event.x, event.y, event.angle);
          break;
        case 'shellHit':
          this.effects.add(createImpactPuff(event.x, BARREL_HEIGHT, event.y));
          break;
        case 'tankDamaged':
          this.tankModels.get(event.tankId)?.flashHit();
          break;
        case 'tankKilled':
          this.showWreck(event.x, event.y);
          break;
      }
    }
  }

  showShot(tankId: string, x: number, y: number, angle: number): void {
    this.tankModels.get(tankId)?.kick();
    this.effects.add(createMuzzleFlash(x, BARREL_HEIGHT, y, angle));
  }

  render(state: ViewState, frameDt: number, aimPoint: THREE.Vector3 | null): void {
    this.elapsed += frameDt;
    this.syncTanks(state.tanks, frameDt);
    this.projectileView.sync(state.projectiles);
    this.effects.update(frameDt);
    this.terrain.update(this.elapsed);
    this.updateReticle(aimPoint);
    this.nameTags.update(state.tanks, this.followCamera.camera);
    if (state.cameraFocus) this.followCamera.follow(state.cameraFocus.x, state.cameraFocus.y, frameDt);
    centreSunOn(this.parts.sun, this.followCamera.focusX, this.followCamera.focusZ);
    this.parts.renderer.render(this.parts.scene, this.followCamera.camera);
  }

  private syncTanks(tanks: TankViewState[], frameDt: number): void {
    const present = new Set<string>();
    for (const tank of tanks) {
      present.add(tank.id);
      const model = this.tankModels.get(tank.id) ?? this.createTankModel(tank.id, tank.color);
      model.root.visible = tank.alive;
      model.setPose(tank.x, tank.y, tank.hullAngle, tank.aimAngle);
      model.setShielded(tank.invulnerable);
      model.update(frameDt);
    }
    this.removeMissingTanks(present);
  }

  // A placeholder burst until the turret-flying-off death animation in the polish milestone.
  private showWreck(x: number, y: number): void {
    this.effects.add(createImpactPuff(x, 0.4, y, { size: 2.5, color: 0xff9a3c }));
    this.effects.add(createImpactPuff(x, 0.5, y, { size: 3.5, color: 0x4a4a4a }));
  }

  private createTankModel(id: string, color: number): TankModel {
    const model = new TankModel(color);
    this.tankModels.set(id, model);
    this.parts.scene.add(model.root);
    return model;
  }

  private removeMissingTanks(present: Set<string>): void {
    for (const [id, model] of this.tankModels) {
      if (present.has(id)) continue;
      this.parts.scene.remove(model.root);
      this.tankModels.delete(id);
    }
  }

  private updateReticle(aimPoint: THREE.Vector3 | null): void {
    this.reticle.visible = aimPoint !== null;
    if (aimPoint) this.reticle.position.set(aimPoint.x, 0.02, aimPoint.z);
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.container;
    this.parts.renderer.setSize(clientWidth, clientHeight);
    this.followCamera.resize(clientWidth / clientHeight);
  }
}
