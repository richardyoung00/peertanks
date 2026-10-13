import type RAPIER from '@dimforge/rapier2d-compat';
import { SIM_DT } from '../config';
import type { GameEvent } from './game-events';
import { terrainAt, type GameMap } from './game-map';
import { createPhysicsWorld } from './physics';
import { IDLE_INPUT, type PlayerInput } from './player-input';
import { advanceProjectile, isExpired, type Projectile } from './projectiles';
import { chooseSpawn } from './spawns';
import { createTank, driveTank, rememberPreviousPose, syncTankPosition, teleportTank, type Tank } from './tank';
import { TERRAIN_RULES } from './terrain';
import { CANNON, fireCannon } from './weapons/cannon';
import type { WeaponContext } from './weapons/weapon-context';

export class GameWorld implements WeaponContext {
  readonly physics: RAPIER.World;
  readonly tanks = new Map<string, Tank>();
  projectiles: Projectile[] = [];

  private events: GameEvent[] = [];
  private nextProjectileId = 1;
  private tanksByColliderHandle = new Map<number, Tank>();

  constructor(readonly map: GameMap) {
    this.physics = createPhysicsWorld(map);
  }

  addTank(id: string, name: string, color: number): Tank {
    const spawn = chooseSpawn(this.map, [...this.tanks.values()]);
    const tank = createTank(this.physics, id, name, color, spawn);
    this.tanks.set(id, tank);
    this.tanksByColliderHandle.set(tank.body.collider(0).handle, tank);
    return tank;
  }

  /** Advances the world by one fixed tick and returns what happened during it. */
  step(inputs: ReadonlyMap<string, PlayerInput>): GameEvent[] {
    for (const tank of this.tanks.values()) {
      rememberPreviousPose(tank);
      this.applyInput(tank, inputs.get(tank.id) ?? IDLE_INPUT);
    }

    this.physics.step();

    for (const tank of this.tanks.values()) {
      syncTankPosition(tank);
      this.respawnIfOnHazard(tank);
    }
    this.stepProjectiles();

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

  private applyInput(tank: Tank, input: PlayerInput): void {
    driveTank(tank, input, SIM_DT);
    tank.aimAngle = input.aimAngle;
    tank.weaponCooldown = Math.max(0, tank.weaponCooldown - SIM_DT);

    if (input.firing && tank.weaponCooldown === 0) {
      fireCannon(this, tank);
      tank.weaponCooldown = CANNON.cooldown;
    }
  }

  // Placeholder until milestone 3 adds proper death and respawn delays.
  private respawnIfOnHazard(tank: Tank): void {
    if (!TERRAIN_RULES[terrainAt(this.map, tank.x, tank.y)].killsTanks) return;
    const others = [...this.tanks.values()].filter((other) => other !== tank);
    teleportTank(tank, chooseSpawn(this.map, others));
    this.emit({ type: 'tankRespawned', tankId: tank.id });
  }

  private stepProjectiles(): void {
    this.projectiles = this.projectiles.filter((projectile) => {
      const owner = this.tanks.get(projectile.ownerId);
      const hit = advanceProjectile(this.physics, projectile, SIM_DT, owner?.body);
      if (hit) {
        const tankHit = this.tanksByColliderHandle.get(hit.collider.handle);
        this.emit({ type: 'shellHit', x: hit.x, y: hit.y, tankId: tankHit?.id });
        return false;
      }
      return !isExpired(projectile);
    });
  }
}
