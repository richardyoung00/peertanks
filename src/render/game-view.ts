import * as THREE from 'three';
import type { GameEvent, TankKilledEvent } from '../sim/game-events';
import { terrainAt, type GameMap } from '../sim/game-map';
import { nearestSafePoint } from '../sim/hazard-edge';
import { isPickupWeapon, type ItemId } from '../sim/items';
import { TERRAIN_RULES } from '../sim/terrain';
import { createAimReticle, createTargetMarker } from './aim-reticle';
import { Bloom } from './bloom';
import { EffectsLayer } from './effects/effect';
import { createExplosion } from './effects/explosion';
import { createImpactPuff } from './effects/impact-puff';
import { createLaserBeam } from './effects/laser-beam';
import { createMuzzleFlash } from './effects/muzzle-flash';
import { createParticlePools, type ParticlePools } from './effects/particles';
import { ProjectileTrails } from './effects/projectile-trails';
import { createScorchMark } from './effects/scorch-mark';
import { createWreck } from './effects/tank-wreck';
import type { HazardFall } from './effects/wreck-model';
import { FollowCamera } from './follow-camera';
import { graphicsQuality, onGraphicsQualityChange, type GraphicsQuality } from './graphics-quality';
import { NameTags } from './name-tags';
import { WEAPON_COLORS } from './pickup-models';
import { PickupView } from './pickup-view';
import { ProjectileView } from './projectile-view';
import { applyQuality, centreSunOn, createScene, type SceneParts } from './scene-setup';
import { BARREL_HEIGHT, TankModel } from './tank-model';
import { LIQUID_LEVELS } from './terrain/liquids';
import { buildTerrainView, type TerrainView } from './terrain/terrain-view';
import { getTheme } from './themes';
import type { TankViewState, ViewState } from './view-state';

/** Shake strength from an explosion right next to the camera's focus; it fades with distance. */
const EXPLOSION_SHAKE = 0.5;
const SHAKE_RANGE = 10;
const POWERUP_SPARKLE_COLOR = 0xfff7ae;
const LOW_QUALITY_PARTICLE_DENSITY = 0.5;

export interface Point2D {
  x: number;
  y: number;
}

/** Draws the game. It only reads the view state it is given; it never changes the simulation. */
export class GameView {
  private readonly parts: SceneParts;
  private readonly followCamera: FollowCamera;
  private readonly terrain: TerrainView;
  private readonly tankModels = new Map<string, TankModel>();
  private readonly projectileView = new ProjectileView();
  private readonly effects = new EffectsLayer();
  private readonly reticle = createAimReticle();
  private readonly targetMarker = createTargetMarker();
  private readonly pickupView = new PickupView();
  private readonly particles: ParticlePools = createParticlePools();
  private readonly trails = new ProjectileTrails(this.particles);
  private readonly nameTags: NameTags;
  private readonly bloom: Bloom;
  private readonly onResize = () => this.resize();
  private readonly stopWatchingQuality: () => void;
  private quality: GraphicsQuality = graphicsQuality();
  private elapsed = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly map: GameMap,
  ) {
    const theme = getTheme(map.theme);
    this.parts = createScene(container, theme);
    this.followCamera = new FollowCamera(container.clientWidth / container.clientHeight);
    this.terrain = buildTerrainView(map, theme);
    this.parts.scene.add(
      this.terrain.object,
      this.pickupView.object,
      this.projectileView.object,
      this.effects.object,
      this.reticle,
      this.targetMarker,
      this.particles.solid.mesh,
      this.particles.smoke.mesh,
      this.particles.glow.mesh,
    );
    this.nameTags = new NameTags(container);
    this.bloom = new Bloom(this.parts.renderer, this.parts.scene, this.followCamera.camera);
    this.setQuality(this.quality);
    this.stopWatchingQuality = onGraphicsQualityChange((quality) => this.setQuality(quality));
    window.addEventListener('resize', this.onResize);
    this.warmUp();
  }

  /**
   * Draws one frame straight away, so the graphics card builds its shaders now (which can freeze a slow
   * machine for a moment) rather than mid-game, after the player has started sending inputs.
   */
  private warmUp(): void {
    this.drawFrame();
  }

  /** Removes everything this view added to the page, so a new one can take over (e.g. on a map change). */
  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.stopWatchingQuality();
    this.bloom.dispose();
    this.nameTags.dispose();
    this.parts.renderer.domElement.remove();
    this.parts.renderer.dispose();
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
          this.showWreck(event);
          break;
        case 'explosion':
          this.showExplosion(event.x, event.y, event.radius);
          break;
        case 'laserFired':
          this.effects.add(createLaserBeam(event.points));
          break;
        case 'pickupCollected':
          this.effects.add(createImpactPuff(event.x, 0.5, event.y, { size: 1.5, color: pickupColor(event.item) }));
          break;
      }
    }
  }

  showShot(tankId: string, x: number, y: number, angle: number): void {
    this.tankModels.get(tankId)?.kick();
    this.effects.add(createMuzzleFlash(x, BARREL_HEIGHT, y, angle));
  }

  /** `target` marks where the player's mortar will land, if they have one selected. */
  render(state: ViewState, frameDt: number, aimPoint: THREE.Vector3 | null, target: Point2D | null): void {
    this.elapsed += frameDt;
    this.syncTanks(state.tanks, frameDt);
    this.projectileView.sync(state.projectiles, frameDt);
    this.trails.update(state.projectiles, frameDt);
    for (const pool of Object.values(this.particles)) pool.update(frameDt);
    this.pickupView.sync(state.pickups, frameDt);
    this.effects.update(frameDt);
    this.terrain.update(this.elapsed);
    this.updateReticle(aimPoint, target);
    this.nameTags.update(state.tanks, this.followCamera.camera);
    if (state.cameraFocus) this.followCamera.follow(state.cameraFocus.x, state.cameraFocus.y, frameDt);
    this.followCamera.updateShake(frameDt);
    centreSunOn(this.parts.sun, this.followCamera.focusX, this.followCamera.focusZ);
    this.drawFrame();
  }

  private drawFrame(): void {
    if (this.quality === 'high') this.bloom.render();
    else this.parts.renderer.render(this.parts.scene, this.followCamera.camera);
  }

  private setQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    applyQuality(this.parts, quality, this.container.clientWidth, this.container.clientHeight);
    this.bloom.syncSize();
    const density = quality === 'high' ? 1 : LOW_QUALITY_PARTICLE_DENSITY;
    for (const pool of Object.values(this.particles)) pool.density = density;
  }

  private syncTanks(tanks: TankViewState[], frameDt: number): void {
    const present = new Set<string>();
    for (const tank of tanks) {
      present.add(tank.id);
      const model = this.tankModels.get(tank.id) ?? this.createTankModel(tank.id, tank.color);
      model.root.visible = tank.alive;
      model.setPose(tank.x, tank.y, tank.hullAngle, tank.aimAngle);
      model.setShielded(tank.invulnerable);
      model.setWeapon(tank.weapon);
      model.setPowerups(tank.powerups);
      model.update(frameDt);
    }
    this.removeMissingTanks(present);
  }

  /** Plays the death animation on a copy of the tank, since the real one is hidden until it respawns. */
  private showWreck(event: TankKilledEvent): void {
    const model = this.tankModels.get(event.tankId);
    if (!model) return;
    const source = { color: model.color, model, x: event.x, z: event.y };
    this.effects.add(createWreck(source, event.cause, this.particles, this.hazardFall(event)));
  }

  /** Which edge a tank slipped over, for tipping it in the right direction. */
  private hazardFall(event: TankKilledEvent): HazardFall | null {
    if (event.cause !== 'water' && event.cause !== 'lava' && event.cause !== 'pit') return null;
    const edge = nearestSafePoint(this.map, event.x, event.y);
    return edge ? { edge, surfaceHeight: LIQUID_LEVELS[event.cause] } : null;
  }

  private showExplosion(x: number, y: number, radius: number): void {
    this.effects.add(createExplosion(x, y, radius, this.particles));
    if (!TERRAIN_RULES[terrainAt(this.map, x, y)].killsTanks) this.effects.add(createScorchMark(x, y, radius));
    const distance = Math.hypot(x - this.followCamera.focusX, y - this.followCamera.focusZ);
    if (distance < SHAKE_RANGE) this.followCamera.shake(EXPLOSION_SHAKE * (1 - distance / SHAKE_RANGE));
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

  private updateReticle(aimPoint: THREE.Vector3 | null, target: Point2D | null): void {
    this.reticle.visible = aimPoint !== null;
    if (aimPoint) this.reticle.position.set(aimPoint.x, 0.02, aimPoint.z);
    this.targetMarker.visible = target !== null;
    if (target) this.targetMarker.position.set(target.x, 0.03, target.y);
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.container;
    this.parts.renderer.setSize(clientWidth, clientHeight);
    this.bloom.syncSize();
    this.followCamera.resize(clientWidth / clientHeight);
  }
}

function pickupColor(item: ItemId): number {
  return isPickupWeapon(item) ? WEAPON_COLORS[item] : POWERUP_SPARKLE_COLOR;
}
