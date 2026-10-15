import * as THREE from 'three';
import type { HazardType } from '../../sim/game-events';
import type { TankModel } from '../tank-model';
import type { Effect } from './effect';
import { bubble, dust, smoke, sparks, splash } from './particle-bursts';
import { randomDirection, type ParticlePools } from './particles';
import { copyTank, type HazardFall, type WreckSource } from './wreck-model';

const DEGREES = Math.PI / 180;
const LAVA_SPARK_COLORS = [0xffd36b, 0xff7a1f, 0xff4a12];

/** One frame of a hazard death: how far the tank has tipped, sunk and melted. */
interface FallPose {
  tipAngle: number;
  /** How far the pivot has moved down (negative) and along the fall direction. */
  drop: number;
  slide: number;
  meltShare: number;
  heat: number;
}

interface HazardStyle {
  lifetime: number;
  pose(age: number): FallPose;
  /** Particles over time: splashes, bubbles, smoke. Called every frame with the tank's current position. */
  emit(pools: ParticlePools, age: number, dt: number, tank: THREE.Vector3, fall: HazardFall): void;
  /** A burst at the moment the tank hits the surface. */
  impact(pools: ParticlePools, at: THREE.Vector3, fall: HazardFall): void;
  impactAt: number;
}

const easeIn = (t: number) => t * t;
const share = (age: number, start: number, end: number) => THREE.MathUtils.clamp((age - start) / (end - start), 0, 1);

/** Tips over the edge, splashes in and sinks out of sight in a stream of bubbles. */
const WATER: HazardStyle = {
  lifetime: 2.4,
  impactAt: 0.3,
  pose: (age) => ({
    tipAngle: 70 * DEGREES * easeIn(share(age, 0, 0.45)),
    drop: -1.1 * easeIn(share(age, 0.2, 2.4)),
    slide: 0.35 * share(age, 0.2, 1.2),
    meltShare: 0,
    heat: 0,
  }),
  emit(pools, age, dt, tank, fall) {
    const bubblesPerSecond = age > 0.4 && age < 2.1 ? 14 : 0;
    if (Math.random() < bubblesPerSecond * dt) bubble(pools, { x: tank.x, y: Math.min(tank.y, fall.surfaceHeight - 0.05), z: tank.z }, fall.surfaceHeight);
  },
  impact(pools, at, fall) {
    splash(pools, { x: at.x, y: fall.surfaceHeight, z: at.z }, 16);
  },
};

/** Tips in, bobs on the surface glowing red-hot, then slumps and melts down with smoke and sparks. */
const LAVA: HazardStyle = {
  lifetime: 2.7,
  impactAt: 0.3,
  pose: (age) => ({
    tipAngle: 42 * DEGREES * easeIn(share(age, 0, 0.35)),
    drop: -0.14 * share(age, 0, 0.35) - 0.05 * Math.sin(age * 7) * Math.exp(-age * 1.2) - 0.6 * easeIn(share(age, 0.8, 2.7)),
    slide: 0.25 * share(age, 0.1, 0.8),
    meltShare: share(age, 0.5, 2.4),
    heat: share(age, 0.1, 1.1),
  }),
  emit(pools, age, dt, tank, fall) {
    const surface = { x: tank.x, y: fall.surfaceHeight + 0.1, z: tank.z };
    if (Math.random() < 9 * dt) smoke(pools, surface, 1, 0.6);
    if (age > 0.3 && Math.random() < 6 * dt) sparks(pools, surface, 1, 0.5, LAVA_SPARK_COLORS);
  },
  impact(pools, at, fall) {
    sparks(pools, { x: at.x, y: fall.surfaceHeight + 0.05, z: at.z }, 14, 0.7, LAVA_SPARK_COLORS);
  },
};

/** Tips over the rim and drops away, tumbling and shrinking into the dark. */
const PIT: HazardStyle = {
  lifetime: 1.5,
  impactAt: 0,
  pose: (age) => ({
    tipAngle: 50 * DEGREES * easeIn(share(age, 0, 0.25)) + 160 * DEGREES * easeIn(share(age, 0.25, 1.5)),
    drop: -4.5 * easeIn(share(age, 0.15, 1.5)),
    slide: 0.3 * share(age, 0, 0.5),
    meltShare: 0,
    heat: 0,
  }),
  emit() {},
  impact(pools, _at, fall) {
    dust(pools, { x: fall.edge.x, y: 0.05, z: fall.edge.y }, 4, 0.6);
  },
};

const STYLES: Record<HazardType, HazardStyle> = { water: WATER, lava: LAVA, pit: PIT };

/**
 * The tank tips over the edge it went off, falling away from the nearest dry ground, then sinks, melts or
 * drops depending on what it fell into. It pivots on the edge itself, so it really looks like it slipped off.
 */
export function createHazardWreck(source: WreckSource, hazard: HazardType, pools: ParticlePools, fall: HazardFall): Effect {
  const style = STYLES[hazard];
  const model = copyTank(source);
  const direction = fallDirection(source, fall);
  const tipAxis = new THREE.Vector3(direction.z, 0, -direction.x);

  const pivot = new THREE.Group();
  pivot.position.set(fall.edge.x, 0, fall.edge.y);
  model.root.position.set(source.x - fall.edge.x, 0, source.z - fall.edge.y);
  pivot.add(model.root);

  const tankPosition = new THREE.Vector3();
  let age = 0;
  let impacted = false;

  return {
    object: pivot,
    update(dt) {
      age += dt;
      applyPose(pivot, model, style.pose(age), tipAxis, direction, fall);
      model.root.getWorldPosition(tankPosition);
      if (!impacted && age >= style.impactAt) {
        impacted = true;
        style.impact(pools, tankPosition, fall);
      }
      style.emit(pools, age, dt, tankPosition, fall);
      return age < style.lifetime;
    },
    dispose() {
      model.dispose();
    },
  };
}

function applyPose(pivot: THREE.Group, model: TankModel, pose: FallPose, axis: THREE.Vector3, direction: THREE.Vector3, fall: HazardFall): void {
  pivot.quaternion.setFromAxisAngle(axis, pose.tipAngle);
  pivot.position.set(fall.edge.x + direction.x * pose.slide, pose.drop, fall.edge.y + direction.z * pose.slide);
  const spread = 1 + 0.25 * pose.meltShare;
  model.root.scale.set(spread, 1 - 0.65 * pose.meltShare, spread);
  model.setHeat(pose.heat);
  model.setScorch(Math.min(1, pose.heat * 2) * 0.9);
}

/** From the edge towards the tank: the way it topples. */
function fallDirection(source: WreckSource, fall: HazardFall): THREE.Vector3 {
  const direction = new THREE.Vector3(source.x - fall.edge.x, 0, source.z - fall.edge.y);
  if (direction.lengthSq() > 1e-6) return direction.normalize();
  const random = randomDirection();
  return new THREE.Vector3(random.x, 0, random.z);
}
