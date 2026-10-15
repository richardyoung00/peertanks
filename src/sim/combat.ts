import { GAMEPLAY, type ExplosionConfig } from '../gameplay-config';
import type { DeathCause, GameEvent, HazardType } from './game-events';
import { terrainAt, type GameMap } from './game-map';
import { depthIntoHazard } from './hazard-edge';
import { clearLoadout, tickPowerups } from './loadout';
import type { Scoreboard } from './scores';
import { chooseSpawn } from './spawns';
import { teleportTank, type Tank } from './tank';
import { TERRAIN_RULES } from './terrain';

export interface CombatContext {
  map: GameMap;
  tanks: ReadonlyMap<string, Tank>;
  scores: Scoreboard;
  emit(event: GameEvent): void;
  explode(x: number, y: number, config: ExplosionConfig, ownerId: string, cause: DeathCause, damageMultiplier: number): void;
}

export function damageTank(
  context: CombatContext,
  target: Tank,
  amount: number,
  attackerId: string,
  cause: DeathCause,
): void {
  if (!target.alive || target.invulnerableTimer > 0 || amount <= 0) return;

  const shielded = target.loadout.powerups.shield > 0;
  const damage = amount * (shielded ? GAMEPLAY.powerups.shield.damageTakenMultiplier : 1);
  target.health = Math.max(0, target.health - damage);
  if (attackerId !== target.id) {
    target.lastAttackerId = attackerId;
    target.lastAttackedTimer = GAMEPLAY.hazardKillCreditSeconds;
  }
  context.emit({ type: 'tankDamaged', tankId: target.id, attackerId, amount: damage, health: target.health });

  if (target.health === 0) killTank(context, target, cause, attackerId);
}

/** A tank falls in once its centre is far enough past the edge, so clipping a corner over the water is safe. */
export function killIfOnHazard(context: CombatContext, tank: Tank): void {
  if (!tank.alive) return;
  const terrain = terrainAt(context.map, tank.x, tank.y);
  if (!TERRAIN_RULES[terrain].killsTanks) return;
  const allowance = GAMEPLAY.hazardEdgeAllowance[terrain as HazardType];
  if (depthIntoHazard(context.map, tank.x, tank.y) < allowance) return;

  const recentAttacker = tank.lastAttackedTimer > 0 ? tank.lastAttackerId : null;
  killTank(context, tank, terrain as HazardType, recentAttacker ?? undefined);
}

/** Counts down spawn protection, kill credit, knockback, powerups and the respawn delay. */
export function updateLifeTimers(context: CombatContext, tank: Tank, dt: number): void {
  tank.invulnerableTimer = Math.max(0, tank.invulnerableTimer - dt);
  tank.lastAttackedTimer = Math.max(0, tank.lastAttackedTimer - dt);
  tank.knockbackTimer = Math.max(0, tank.knockbackTimer - dt);
  tickPowerups(tank.loadout, dt);
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
  tank.knockbackTimer = 0;
  clearLoadout(tank.loadout);
  context.emit({ type: 'tankRespawned', tankId: tank.id });
}

function killTank(context: CombatContext, tank: Tank, cause: DeathCause, killerId: string | undefined): void {
  const selfInflicted = killerId === tank.id;
  const creditedKiller = selfInflicted ? undefined : killerId;
  const hadDeadMansSwitch = tank.loadout.powerups['dead-mans-switch'] > 0;

  tank.alive = false;
  tank.health = 0;
  tank.respawnTimer = GAMEPLAY.respawn.delaySeconds;
  tank.body.setLinvel({ x: 0, y: 0 }, true);
  // A disabled body stops colliding, so wrecks don't block shells or other tanks.
  tank.body.setEnabled(false);
  clearLoadout(tank.loadout);

  context.scores.recordDeath(tank.id, creditedKiller);
  context.emit({ type: 'tankKilled', tankId: tank.id, killerId: creditedKiller, cause, selfInflicted, x: tank.x, y: tank.y });

  if (hadDeadMansSwitch) {
    context.explode(tank.x, tank.y, GAMEPLAY.powerups['dead-mans-switch'].explosion, tank.id, 'dead-mans-switch', 1);
  }
}
