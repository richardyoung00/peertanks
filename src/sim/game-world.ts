import type RAPIER from '@dimforge/rapier2d-compat';
import { SIM_DT } from '../config';
import { GAMEPLAY } from '../gameplay-config';
import { damageTank, killIfOnHazard, respawnTank, updateLifeTimers, type CombatContext } from './combat';
import type { GameEvent } from './game-events';
import type { GameMap } from './game-map';
import { createPhysicsWorld } from './physics';
import { IDLE_INPUT, type PlayerInput } from './player-input';
import { advanceProjectile, isExpired, type Projectile } from './projectiles';
import { RoundClock } from './round';
import { Scoreboard } from './scores';
import { chooseSpawn } from './spawns';
import { createTank, driveTank, rememberPreviousPose, syncTankPosition, type Tank } from './tank';
import { fireCannon } from './weapons/cannon';
import type { WeaponContext } from './weapons/weapon-context';

export class GameWorld implements WeaponContext, CombatContext {
  readonly physics: RAPIER.World;
  readonly tanks = new Map<string, Tank>();
  readonly scores = new Scoreboard();
  readonly round = new RoundClock();
  projectiles: Projectile[] = [];
  tick = 0;

  private events: GameEvent[] = [];
  private nextProjectileId = 1;
  private tanksByColliderHandle = new Map<number, Tank>();

  constructor(readonly map: GameMap) {
    this.physics = createPhysicsWorld(map);
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
    this.stepProjectiles();
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

  private stepRound(): void {
    const change = this.round.step(SIM_DT);
    if (change === 'ended') {
      this.projectiles = [];
      this.emit({ type: 'roundEnded', standings: this.scores.all });
    } else if (change === 'started') {
      this.startNewRound();
    }
  }

  private startNewRound(): void {
    this.scores.reset();
    this.projectiles = [];
    for (const tank of this.tanks.values()) respawnTank(this, tank);
    this.emit({ type: 'roundStarted' });
  }

  private applyInput(tank: Tank, input: PlayerInput): void {
    driveTank(tank, input, SIM_DT);
    tank.aimAngle = input.aimAngle;
    tank.weaponCooldown = Math.max(0, tank.weaponCooldown - SIM_DT);

    if (input.firing && tank.weaponCooldown === 0) {
      fireCannon(this, tank);
      tank.weaponCooldown = GAMEPLAY.weapons.cannon.cooldownSeconds;
    }
  }

  private stepProjectiles(): void {
    this.projectiles = this.projectiles.filter((projectile) => {
      const owner = this.tanks.get(projectile.ownerId);
      const hit = advanceProjectile(this.physics, projectile, SIM_DT, owner?.body);
      if (!hit) return !isExpired(projectile);

      const tankHit = this.tanksByColliderHandle.get(hit.collider.handle);
      this.emit({ type: 'shellHit', x: hit.x, y: hit.y, tankId: tankHit?.id });
      if (tankHit) damageTank(this, tankHit, projectile.damage, projectile.ownerId, 'cannon');
      return false;
    });
  }
}
