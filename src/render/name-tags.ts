import * as THREE from 'three';
import { GAMEPLAY } from '../gameplay-config';
import { cssColor } from '../ui/player-lookup';
import type { TankViewState } from './view-state';

const TAG_HEIGHT = 0.95;

interface NameTag {
  root: HTMLElement;
  fill: HTMLElement;
  charge: HTMLElement;
  chargeFill: HTMLElement;
}

/** HTML name and health labels that follow each tank on screen. HTML keeps the text crisp at any size. */
export class NameTags {
  private readonly layer = document.createElement('div');
  private readonly tags = new Map<string, NameTag>();
  private readonly projected = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.layer.className = 'name-tags';
    container.appendChild(this.layer);
  }

  update(tanks: TankViewState[], camera: THREE.Camera): void {
    const present = new Set<string>();
    for (const tank of tanks) {
      present.add(tank.id);
      const tag = this.tags.get(tank.id) ?? this.createTag(tank);
      this.place(tag, tank, camera);
    }
    for (const [id, tag] of this.tags) {
      if (present.has(id)) continue;
      tag.root.remove();
      this.tags.delete(id);
    }
  }

  private place(tag: NameTag, tank: TankViewState, camera: THREE.Camera): void {
    tag.root.hidden = !tank.alive;
    if (!tank.alive) return;

    this.projected.set(tank.x, TAG_HEIGHT, tank.y).project(camera);
    const x = (this.projected.x * 0.5 + 0.5) * this.layer.clientWidth;
    const y = (-this.projected.y * 0.5 + 0.5) * this.layer.clientHeight;
    tag.root.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;

    const fraction = tank.health / GAMEPLAY.tank.maxHealth;
    tag.fill.style.width = `${fraction * 100}%`;
    tag.fill.style.background = healthColor(fraction);

    tag.charge.hidden = tank.grenadeCharge === 0;
    if (tank.grenadeCharge > 0) tag.chargeFill.style.width = `${tank.grenadeCharge * 100}%`;
  }

  private createTag(tank: TankViewState): NameTag {
    const root = document.createElement('div');
    root.className = 'name-tag';
    const name = document.createElement('div');
    name.className = 'name-tag-name';
    name.textContent = tank.name;
    name.style.color = cssColor(tank.color);
    const bar = document.createElement('div');
    bar.className = 'name-tag-bar';
    const fill = document.createElement('div');
    fill.className = 'name-tag-fill';
    bar.appendChild(fill);
    const charge = document.createElement('div');
    charge.className = 'name-tag-charge';
    charge.hidden = true;
    const chargeFill = document.createElement('div');
    chargeFill.className = 'name-tag-charge-fill';
    charge.appendChild(chargeFill);
    root.append(name, bar, charge);
    this.layer.appendChild(root);

    const tag = { root, fill, charge, chargeFill };
    this.tags.set(tank.id, tag);
    return tag;
  }
}

function healthColor(fraction: number): string {
  if (fraction > 0.6) return '#4ade80';
  if (fraction > 0.3) return '#facc15';
  return '#f87171';
}
