import * as THREE from 'three';
import { layer, part, type PropShape } from './props';

// Every shape stays inside its tile and stands taller than a tank's barrel, because trees block shots.

const pine: PropShape = [
  layer('trunk', [part(new THREE.CylinderGeometry(0.07, 0.1, 0.4, 6), { position: [0, 0.2, 0] })]),
  layer('leaves', [
    part(new THREE.ConeGeometry(0.46, 0.7, 7), { position: [0, 0.62, 0], shade: 0.9 }),
    part(new THREE.ConeGeometry(0.32, 0.55, 7), { position: [0, 0.98, 0], shade: 1.06 }),
  ]),
];

const round: PropShape = [
  layer('trunk', [part(new THREE.CylinderGeometry(0.07, 0.1, 0.5, 6), { position: [0, 0.25, 0] })]),
  layer('leaves', [
    part(new THREE.IcosahedronGeometry(0.4, 0), { position: [0, 0.78, 0], scale: [1, 0.85, 1] }),
    part(new THREE.IcosahedronGeometry(0.22, 0), { position: [0.16, 1.0, 0.1], shade: 1.12 }),
    part(new THREE.IcosahedronGeometry(0.2, 0), { position: [-0.18, 0.66, -0.12], shade: 0.88 }),
  ]),
];

const conifer: PropShape = [
  layer('trunk', [part(new THREE.CylinderGeometry(0.05, 0.08, 0.35, 5), { position: [0, 0.17, 0] })]),
  layer('leaves', [
    part(new THREE.ConeGeometry(0.3, 0.55, 6), { position: [0, 0.5, 0], shade: 0.86 }),
    part(new THREE.ConeGeometry(0.25, 0.5, 6), { position: [0, 0.85, 0] }),
    part(new THREE.ConeGeometry(0.18, 0.45, 6), { position: [0, 1.18, 0], shade: 1.1 }),
  ]),
];

const bush: PropShape = [
  layer('leaves', [
    part(new THREE.IcosahedronGeometry(0.32, 0), { position: [0, 0.3, 0], scale: [1, 0.9, 1] }),
    part(new THREE.IcosahedronGeometry(0.25, 0), { position: [0.22, 0.24, 0.12], shade: 1.08 }),
    part(new THREE.IcosahedronGeometry(0.23, 0), { position: [-0.2, 0.22, -0.14], shade: 0.9 }),
    part(new THREE.IcosahedronGeometry(0.2, 0), { position: [-0.04, 0.5, 0.18], shade: 1.14 }),
  ]),
];

const dead: PropShape = [
  layer('deadWood', [
    part(new THREE.CylinderGeometry(0.06, 0.11, 0.85, 5), { position: [0, 0.42, 0] }),
    part(new THREE.CylinderGeometry(0.03, 0.05, 0.38, 4), { position: [0.13, 0.66, 0], rotation: [0, 0, -0.9], shade: 0.92 }),
    part(new THREE.CylinderGeometry(0.025, 0.045, 0.32, 4), { position: [-0.11, 0.52, 0.05], rotation: [0.3, 0, 1], shade: 1.08 }),
    part(new THREE.CylinderGeometry(0.02, 0.035, 0.22, 4), { position: [0.02, 0.9, -0.06], rotation: [-0.6, 0, 0.2] }),
  ]),
];

export const TREE_SHAPES = { pine, round, conifer, bush, dead };

export type TreeShapeId = keyof typeof TREE_SHAPES;

export function isTreeShape(value: string | null): value is TreeShapeId {
  return value !== null && value in TREE_SHAPES;
}
