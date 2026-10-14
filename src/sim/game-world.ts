import type RAPIER from '@dimforge/rapier2d-compat';
import { SIM_DT } from '../config';
import { GAMEPLAY, type ExplosionConfig } from '../gameplay-config';
import { killIfOnHazard, respawnTank, updateLifeTimers } from './combat';
import { explode } from './explosions';
import type { DeathCause, GameEvent } from './game-events';
import type { GameMap } from './game-map';
import type { GameSettings } from './game-settings';
import { createPhysicsWorld } from './physics';
import { PickupField } from './pickups';
import { IDLE_INPUT, type PlayerInput } from './player-input';
import { stepProjectile } from './projectile-behaviour';
import type { Projectile } from './projectiles';
import { RoundClock } from './round';
import { Scoreboard } from './scores';
import { chooseSpawn } from './spawns';
import { createTank, driveTank, rememberPreviousPose, syncTankPosition, type Tank } from './tank';
import { updateWeapon } from './weapons/weapon-control';
import type { WorldContext } from './world-context';

export class GameWorld implements WorldContext {
  readonly physics: RAPIER.World;
  readonly tanks = new Map<string, Tank>();
  readonly scores = new Scoreboard();
  readonly round: RoundClock;
  readonly pickups: PickupField;
  projectiles: Projectile[] = [];
  tick = 0;

  private events: GameEvent[] = [];
  private nextProjectileId = 1;
  private tanksByColliderHandle = new Map<number, Tank>();

  private nextRoundSettings: GameSettings | null = null;

  constructor(
    readonly map: GameMap,
    private settings: GameSettings,
  ) {
    this.physics = createPhysicsWorld(map);
    this.round = new RoundClock(settings.roundSeconds);
    this.pickups = new PickupField(map, settings.allowedItems);
    this.pickups.fillAll();
  }

  get currentSettings(): GameSettings {
    return this.nextRoundSettings ?? this.settings;
  }

  /** New round length and allowed items take effect when the next round starts. */
  changeSettings(settings: GameSettings): void {
    this.nextRoundSettings = settings;
  }

  addTank(id: string, name: string, color: number): Tank {
    const spawn = chooseSpawn(this.map, [...this.tanks.values()]);
    const tank = createTank(this.physics, id, name, color, spawn);
    tank.invulnerableTimer = GAMEPLAY.respawn.invulnerableSeconds;
    this.tanks.set(id, tank);
    this.tanksByColliderHandle.set(tank.body.collider(0).handle, tank);
    this.scores.add(id);
    return tank;
  }

  removeTank(id: string): void {
    const tank = this.tanks.get(id);
    if (!tank) return;
    this.tanksByColliderHandle.delete(tank.body.collider(0).handle);
    this.physics.removeRigidBody(tank.body);
    this.tanks.delete(id);
    this.scores.remove(id);
  }

  /** Advances the world by one fixed tick and returns what happened during it. */
  step(inputs: ReadonlyMap<string, PlayerInput>): GameEvent[] {
    this.stepRound();

    for (const tank of this.tanks.values()) {
      rememberPreviousPose(tank);
      if (tank.alive) this.applyInput(tank, this.round.isPlaying ? (inputs.get(tank.id) ?? IDLE_INPUT) : IDLE_INPUT);
    }

    this.physics.step();

    for (const tank of this.tanks.values()) {
      syncTankPosition(tank);
      killIfOnHazard(this, tank);
      updateLifeTimers(this, tank, SIM_DT);
    }
    this.projectiles = this.projectiles.filter((projectile) => stepProjectile(this, projectile, SIM_DT));
    if (this.round.isPlaying) this.pickups.step(this, SIM_DT);
    this.tick++;

    const events = this.events;
    this.events = [];
    return events;
  }

  spawnProjectile(projectile: Omit<Projectile, 'id'>): void {
    this.projectiles.push({ ...projectile, id: this.nextProjectileId++ });
  }

  emit(event: GameEvent): void {
    this.events.push(event);
  }

  explode(x: number, y: number, config: ExplosionConfig, ownerId: string, cause: DeathCause, damageMultiplier: number): void {
    explode(this, x, y, config, ownerId, cause, damageMultiplier);
  }

  tankByCollider(collider: RAPIER.Collider): Tank | undefined {
    return this.tanksByColliderHandle.get(collider.handle);
  }

  private stepRound(): void {
    const change = this.round.step(SIM_DT);
    if (change === 'ended') {
      this.projectiles = [];
      this.pickups.clear();
      this.emit({ type: 'roundEnded', standings: this.scores.all });
    } else if (change === 'started') {
      this.startNewRound();
    }
  }

  private startNewRound(): void {
    this.applyPendingSettings();
    this.round.restart();
    this.scores.reset();
    this.projectiles = [];
    this.pickups.fillAll();
    for (const tank of this.tanks.values()) respawnTank(this, tank);
    this.emit({ type: 'roundStarted' });
  }

  private applyPendingSettings(): void {
    if (!this.nextRoundSettings) return;
    this.settings = this.nextRoundSettings;
    this.nextRoundSettings = null;
    this.round.roundSeconds = this.settings.roundSeconds;
    this.pickups.setAllowed(this.settings.allowedItems);
  }

  private applyInput(tank: Tank, input: PlayerInput): void {
    driveTank(tank, input, SIM_DT);
    tank.aimAngle = input.aimAngle;
    updateWeapon(this, tank, input, SIM_DT);
  }
}
