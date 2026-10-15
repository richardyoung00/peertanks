import * as THREE from 'three';
import { layer, part, type PropShape } from './props';

// Rocks block shots, so even the flattest shape stands about as tall as a tank's barrel.

const boulder: PropShape = [
  layer('stone', [
    part(new THREE.DodecahedronGeometry(0.42, 0), { position: [0, 0.22, 0], scale: [1, 0.8, 1] }),
    part(new THREE.DodecahedronGeometry(0.16, 0), { position: [0.38, 0.06, 0], shade: 0.92 }),
  ]),
];

const cluster: PropShape = [
  layer('stone', [
    part(new THREE.DodecahedronGeometry(0.32, 0), { position: [-0.12, 0.22, -0.08] }),
    part(new THREE.DodecahedronGeometry(0.25, 0), { position: [0.2, 0.17, 0.12], shade: 1.08 }),
    part(new THREE.DodecahedronGeometry(0.17, 0), { position: [0.02, 0.11, 0.3], shade: 0.9 }),
  ]),
];

const slab: PropShape = [
  layer('stone', [
    part(new THREE.BoxGeometry(0.82, 0.28, 0.64), { position: [0, 0.14, 0], rotation: [0.04, 0.2, -0.05] }),
    part(new THREE.BoxGeometry(0.52, 0.2, 0.42), { position: [0.06, 0.37, -0.02], rotation: [-0.05, -0.3, 0.06], shade: 1.07 }),
  ]),
];

const mossy: PropShape = [
  layer('stone', [part(new THREE.DodecahedronGeometry(0.42, 0), { position: [0, 0.22, 0], scale: [1, 0.75, 1] })]),
  layer('moss', [part(new THREE.IcosahedronGeometry(0.36, 0), { position: [0, 0.42, 0], scale: [1, 0.32, 1] })]),
];

export const ROCK_SHAPES = { boulder, cluster, slab, mossy };

export type RockShapeId = keyof typeof ROCK_SHAPES;

export function isRockShape(value: string | null): value is RockShapeId {
  return value !== null && value in ROCK_SHAPES;
}
