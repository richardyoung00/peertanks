import * as THREE from 'three';
import type { Effect } from './effect';
import { debris, flames, smoke, sparks } from './particle-bursts';
import { between, randomDirection, type ParticlePools } from './particles';
import { copyTank, type WreckSource } from './wreck-model';

const LIFETIME = 2.7;
const SINK_START = 2.0;
const SINK_DEPTH = 0.5;
const GRAVITY = 14;
const TURRET_BOUNCE = 0.35;
const SMOKE_EVERY = 0.09;
const POP_SECONDS = 0.18;

/** The tank goes up in a burst: the turret flies off and tumbles, the hull is left burnt and smoking, then sinks away. */
export function createDestroyedWreck(source: WreckSource, pools: ParticlePools): Effect {
  const model = copyTank(source);
  const group = new THREE.Group();
  group.position.set(source.x, 0, source.z);
  group.add(model.root);

  const centre = { x: source.x, y: 0.35, z: source.z };
  flames(pools, centre, 10, 1.2);
  sparks(pools, centre, 14);
  debris(pools, centre, 8);
  smoke(pools, centre, 6);

  const throwDirection = randomDirection();
  const turretVelocity = new THREE.Vector3(throwDirection.x * between(0.8, 1.8), between(4.5, 6), throwDirection.z * between(0.8, 1.8));
  const turretSpin = new THREE.Vector3(between(-9, 9), between(-6, 6), between(-9, 9));
  let age = 0;
  let nextSmoke = 0;

  return {
    object: group,
    update(dt) {
      age += dt;
      flyTurret(model.turret, turretVelocity, turretSpin, dt);

      const pop = Math.min(age / POP_SECONDS, 1);
      model.hull.scale.set(1 + 0.25 * (1 - pop), 0.7 + 0.3 * pop, 1 + 0.25 * (1 - pop));
      model.setScorch(Math.min(age / 0.25, 1) * 0.9);

      nextSmoke -= dt;
      if (nextSmoke <= 0 && age < SINK_START) {
        nextSmoke = SMOKE_EVERY;
        smoke(pools, { x: source.x + between(-0.15, 0.15), y: 0.35, z: source.z + between(-0.15, 0.15) }, 1, 0.7);
      }
      const sinking = Math.max(0, (age - SINK_START) / (LIFETIME - SINK_START));
      group.position.y = -SINK_DEPTH * sinking * sinking;
      return age < LIFETIME;
    },
    dispose() {
      model.dispose();
    },
  };
}

/** The turret arcs through the air, spinning, and bounces when it lands. */
function flyTurret(turret: THREE.Object3D, velocity: THREE.Vector3, spin: THREE.Vector3, dt: number): void {
  velocity.y -= GRAVITY * dt;
  turret.position.addScaledVector(velocity, dt);
  turret.rotation.x += spin.x * dt;
  turret.rotation.y += spin.y * dt;
  turret.rotation.z += spin.z * dt;
  if (turret.position.y < -0.3 && velocity.y < 0) {
    turret.position.y = -0.3;
    velocity.set(velocity.x * 0.5, -velocity.y * TURRET_BOUNCE, velocity.z * 0.5);
    spin.multiplyScalar(0.4);
  }
}
