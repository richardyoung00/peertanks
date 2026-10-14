import * as THREE from 'three';

const FIELD_OF_VIEW = 40;
const HEIGHT = 15;
const DISTANCE_BEHIND = 9.5;
const FOLLOW_SHARPNESS = 12;
const SHAKE_DECAY = 8;
const MAX_SHAKE = 0.6;

/** A tilted camera that looks down at a focus point from a fixed direction, so screen axes match map axes. */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly focus = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private shakeStrength = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, aspect, 0.5, 100);
  }

  get focusX(): number {
    return this.focus.x;
  }

  get focusZ(): number {
    return this.focus.z;
  }

  snapTo(x: number, z: number): void {
    this.focus.set(x, 0, z);
    this.applyFocus();
  }

  follow(x: number, z: number, dt: number): void {
    const blend = 1 - Math.exp(-FOLLOW_SHARPNESS * dt);
    this.focus.lerp(new THREE.Vector3(x, 0, z), blend);
    this.applyFocus();
  }

  /** Called every frame, including while dead, so shakes always settle. */
  updateShake(dt: number): void {
    this.shakeStrength *= Math.exp(-SHAKE_DECAY * dt);
    this.applyFocus();
  }

  /** A quick jolt, e.g. from a nearby explosion. Stronger shakes add up to a limit. */
  shake(strength: number): void {
    this.shakeStrength = Math.min(this.shakeStrength + strength, MAX_SHAKE);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Projects a screen position (normalised device coordinates) onto the ground. */
  groundPointAt(ndcX: number, ndcY: number): THREE.Vector3 | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    return this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
  }

  private applyFocus(): void {
    const jitterX = (Math.random() - 0.5) * this.shakeStrength;
    const jitterZ = (Math.random() - 0.5) * this.shakeStrength;
    this.camera.position.set(this.focus.x + jitterX, HEIGHT, this.focus.z + DISTANCE_BEHIND + jitterZ);
    this.camera.lookAt(this.focus.x + jitterX, 0, this.focus.z + jitterZ);
    this.camera.updateMatrixWorld();
  }
}
