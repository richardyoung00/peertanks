import * as THREE from 'three';
import type { PowerupId } from '../sim/items';

const ringGeometry = new THREE.RingGeometry(0.5, 0.58, 32).rotateX(-Math.PI / 2);

/** Shows a tank's active powerups so everyone can see them: a bubble, coloured rings and a warning light. */
export class PowerupVisuals {
  readonly object = new THREE.Group();
  private readonly shieldBubble: THREE.Mesh;
  private readonly speedRing: THREE.Mesh;
  private readonly damageRing: THREE.Mesh;
  private readonly switchLight: THREE.Mesh;
  private switchArmed = false;

  constructor() {
    this.shieldBubble = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.62, 1),
      new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x3b82f6, emissiveIntensity: 0.4, transparent: true, opacity: 0.22, flatShading: true, depthWrite: false }),
    );
    this.shieldBubble.position.y = 0.3;
    this.speedRing = ringMesh(0xfde047, 0.04);
    this.damageRing = ringMesh(0xef4444, 0.06);
    this.damageRing.scale.setScalar(1.15);
    this.switchLight = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2d2d }));
    this.switchLight.position.set(-0.08, 0.6, 0);
    this.object.add(this.shieldBubble, this.speedRing, this.damageRing, this.switchLight);
    this.setActive([]);
  }

  setActive(powerups: PowerupId[]): void {
    this.shieldBubble.visible = powerups.includes('shield');
    this.speedRing.visible = powerups.includes('speed');
    this.damageRing.visible = powerups.includes('damage-boost');
    this.switchArmed = powerups.includes('dead-mans-switch');
  }

  update(elapsed: number): void {
    this.shieldBubble.rotation.y = elapsed * 0.8;
    this.speedRing.rotation.y = elapsed * 4;
    this.switchLight.visible = this.switchArmed && Math.sin(elapsed * 14) > 0;
  }
}

function ringMesh(color: number, height: number): THREE.Mesh {
  const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.position.y = height;
  return ring;
}
