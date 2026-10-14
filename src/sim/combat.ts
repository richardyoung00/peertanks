import { GAMEPLAY } from '../gameplay-config';
import type { DeathCause, GameEvent, HazardType } from './game-events';
import { terrainAt, type GameMap } from './game-map';
import type { Scoreboard } from './scores';
import { chooseSpawn } from './spawns';
import { teleportTank, type Tank } from './tank';
import { TERRAIN_RULES } from './terrain';

export interface CombatContext {
  map: GameMap;
  tanks: ReadonlyMap<string, Tank>;
  scores: Scoreboard;
  emit(event: GameEvent): void;
}

export function damageTank(
  context: CombatContext,
  target: Tank,
  amount: number,
  attackerId: string,
  cause: DeathCause,
): void {
  if (!target.alive || target.invulnerableTimer > 0) return;

  target.health = Math.max(0, target.health - amount);
  target.lastAttackerId = attackerId;
  target.lastAttackedTimer = GAMEPLAY.hazardKillCreditSeconds;
  context.emit({ type: 'tankDamaged', tankId: target.id, attackerId, amount, health: target.health });

  if (target.health === 0) killTank(context, target, cause, attackerId);
}

export function killIfOnHazard(context: CombatContext, tank: Tank): void {
  if (!tank.alive) return;
  const terrain = terrainAt(context.map, tank.x, tank.y);
  if (!TERRAIN_RULES[terrain].killsTanks) return;

  const recentAttacker = tank.lastAttackedTimer > 0 ? tank.lastAttackerId : null;
  killTank(context, tank, terrain as HazardType, recentAttacker ?? undefined);
}

/** Counts down spawn protection, kill credit and the respawn delay. */
export function updateLifeTimers(context: CombatContext, tank: Tank, dt: number): void {
  tank.invulnerableTimer = Math.max(0, tank.invulnerableTimer - dt);
  tank.lastAttackedTimer = Math.max(0, tank.lastAttackedTimer - dt);
  if (tank.alive) return;

  tank.respawnTimer = Math.max(0, tank.respawnTimer - dt);
  if (tank.respawnTimer === 0) respawnTank(context, tank);
}

export function respawnTank(context: CombatContext, tank: Tank): void {
  const others = [...context.tanks.values()].filter((other) => other !== tank && other.alive);
  teleportTank(tank, chooseSpawn(context.map, others));
  tank.body.setEnabled(true);
  tank.alive = true;
  tank.health = GAMEPLAY.tank.maxHealth;
  tank.invulnerableTimer = GAMEPLAY.respawn.invulnerableSeconds;
  tank.lastAttackerId = null;
  tank.lastAttackedTimer = 0;
  tank.weaponCooldown = 0;
  context.emit({ type: 'tankRespawned', tankId: tank.id });
}

function killTank(context: CombatContext, tank: Tank, cause: DeathCause, killerId: string | undefined): void {
  tank.alive = false;
  tank.health = 0;
  tank.respawnTimer = GAMEPLAY.respawn.delaySeconds;
  tank.body.setLinvel({ x: 0, y: 0 }, true);
  // A disabled body stops colliding, so wrecks don't block shells or other tanks.
  tank.body.setEnabled(false);

  context.scores.recordDeath(tank.id, killerId);
  context.emit({ type: 'tankKilled', tankId: tank.id, killerId, cause, x: tank.x, y: tank.y });
}
