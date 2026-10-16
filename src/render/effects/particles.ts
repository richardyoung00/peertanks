import * as THREE from 'three';
import { glowing } from '../glow';

export interface ParticleSpawn {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Seconds before it disappears. */
  life: number;
  startSize: number;
  endSize: number;
  color: number;
  /** Downward pull; negative values make it rise faster over time. */
  gravity?: number;
  /** How quickly it slows down (0 = never). */
  drag?: number;
  /** When it reaches the ground it bounces with this share of its speed instead of sinking in. */
  bounce?: number;
}

interface Particle extends Required<ParticleSpawn> {
  age: number;
  spinX: number;
  spinY: number;
}

/** Particles shrink away over this last share of their life rather than fading, which suits the solid art style. */
const SHRINK_AWAY_SHARE = 0.25;
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
/** Only this share of the particles asked for is made: plenty for the look, at half the cost. */
const SPAWN_SHARE = 0.5;

/**
 * A fixed number of small particles drawn together as one instanced mesh. When it's full, new particles
 * replace the oldest. Explosions, trails and wrecks all share a couple of these.
 */
export class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private readonly particles: (Particle | null)[];
  private next = 0;
  private readonly transform = new THREE.Object3D();
  private readonly color = new THREE.Color();

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.particles = new Array(capacity).fill(null);
    for (let index = 0; index < capacity; index++) this.mesh.setMatrixAt(index, hidden);
    this.mesh.setColorAt(0, this.color);
  }

  spawn(spawn: ParticleSpawn): void {
    if (Math.random() > SPAWN_SHARE) return;
    const index = this.next;
    this.next = (this.next + 1) % this.particles.length;
    this.particles[index] = {
      vx: 0,
      vy: 0,
      vz: 0,
      gravity: 0,
      drag: 0,
      bounce: -1,
      ...spawn,
      age: 0,
      spinX: Math.random() * Math.PI,
      spinY: Math.random() * Math.PI,
    };
    this.mesh.setColorAt(index, this.color.set(spawn.color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    this.particles.forEach((particle, index) => {
      if (!particle) return;
      particle.age += dt;
      if (particle.age >= particle.life) {
        this.particles[index] = null;
        this.mesh.setMatrixAt(index, hidden);
        return;
      }
      move(particle, dt);
      this.mesh.setMatrixAt(index, this.matrixFor(particle));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private matrixFor(particle: Particle): THREE.Matrix4 {
    const progress = particle.age / particle.life;
    const shrink = Math.min(1, (1 - progress) / SHRINK_AWAY_SHARE);
    const size = THREE.MathUtils.lerp(particle.startSize, particle.endSize, progress) * shrink;
    this.transform.position.set(particle.x, particle.y, particle.z);
    this.transform.rotation.set(particle.spinX + particle.age * 2, particle.spinY + particle.age, 0);
    this.transform.scale.setScalar(Math.max(size, 0.0001));
    this.transform.updateMatrix();
    return this.transform.matrix;
  }
}

function move(particle: Particle, dt: number): void {
  const slowdown = Math.max(0, 1 - particle.drag * dt);
  particle.vx *= slowdown;
  particle.vz *= slowdown;
  particle.vy = particle.vy * slowdown - particle.gravity * dt;
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
  particle.z += particle.vz * dt;
  if (particle.bounce >= 0 && particle.y < 0) {
    particle.y = 0;
    particle.vy = -particle.vy * particle.bounce;
    particle.vx *= 0.6;
    particle.vz *= 0.6;
  }
}

export interface ParticlePools {
  /** Lit, solid particles: debris, bubbles and splashes. */
  solid: ParticlePool;
  /** Soft, slightly see-through puffs: smoke, dust and trails. */
  smoke: ParticlePool;
  /** Glowing particles that add light: sparks, flames and embers. */
  glow: ParticlePool;
}

export function createParticlePools(): ParticlePools {
  return {
    solid: new ParticlePool(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
      400,
    ),
    smoke: new ParticlePool(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true, transparent: true, opacity: 0.7, depthWrite: false }),
      700,
    ),
    glow: new ParticlePool(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: glowing(0xffffff, 2.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
      500,
    ),
  };
}

/** A random number between two values. */
export function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** A random horizontal direction, as x and z parts of a unit vector. */
export function randomDirection(): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  return { x: Math.cos(angle), z: Math.sin(angle) };
}
