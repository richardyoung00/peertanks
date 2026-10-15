import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** One coloured piece of a shape, e.g. a tree's trunk or its leaves. */
export interface ShapeLayer {
  role: string;
  geometry: THREE.BufferGeometry;
}

export type PropShape = ShapeLayer[];

export interface PartOptions {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  /** Brightens (above 1) or darkens (below 1) this part against the rest of its layer. */
  shade?: number;
}

/** A primitive moved into place within its shape, ready to merge with the other parts of its layer. */
export function part(geometry: THREE.BufferGeometry, options: PartOptions = {}): THREE.BufferGeometry {
  const placed = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).deleteAttribute('uv');
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...(options.position ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(options.rotation ?? [0, 0, 0]))),
    new THREE.Vector3(...(options.scale ?? [1, 1, 1])),
  );
  placed.applyMatrix4(matrix);
  const shade = options.shade ?? 1;
  const shades = new Float32Array(placed.getAttribute('position').count * 3).fill(shade);
  placed.setAttribute('color', new THREE.BufferAttribute(shades, 3));
  return placed;
}

export function layer(role: string, parts: THREE.BufferGeometry[]): ShapeLayer {
  return { role, geometry: mergeGeometries(parts) };
}

export interface PropPlacement {
  shape: string;
  x: number;
  y?: number;
  z: number;
  rotationY: number;
  /** A small lean, in radians, so a row of trees doesn't stand perfectly straight. */
  tiltX?: number;
  tiltZ?: number;
  scale: [number, number, number];
  /** A colour for each role in the shape. */
  colors: Record<string, THREE.Color>;
}

export interface PropOptions {
  castShadow: boolean;
  receiveShadow: boolean;
}

/** Draws every placement of every shape, using one instanced mesh per shape layer. */
export function buildProps(shapes: Record<string, PropShape>, placements: PropPlacement[], options: PropOptions): THREE.Group {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true, vertexColors: true });
  const group = new THREE.Group();
  for (const [id, shape] of Object.entries(shapes)) {
    const ofShape = placements.filter((placement) => placement.shape === id);
    if (ofShape.length === 0) continue;
    for (const shapeLayer of shape) group.add(instancedLayer(shapeLayer, ofShape, material, options));
  }
  return group;
}

function instancedLayer(shapeLayer: ShapeLayer, placements: PropPlacement[], material: THREE.Material, options: PropOptions): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(shapeLayer.geometry, material, placements.length);
  mesh.castShadow = options.castShadow;
  mesh.receiveShadow = options.receiveShadow;
  placements.forEach((placement, index) => {
    mesh.setMatrixAt(index, placementMatrix(placement));
    mesh.setColorAt(index, placement.colors[shapeLayer.role] ?? new THREE.Color(0xffffff));
  });
  return mesh;
}

function placementMatrix(placement: PropPlacement): THREE.Matrix4 {
  const rotation = new THREE.Euler(placement.tiltX ?? 0, placement.rotationY, placement.tiltZ ?? 0, 'YXZ');
  return new THREE.Matrix4().compose(
    new THREE.Vector3(placement.x, placement.y ?? 0, placement.z),
    new THREE.Quaternion().setFromEuler(rotation),
    new THREE.Vector3(...placement.scale),
  );
}

/** Picks a shape at random, in proportion to its weight. `random` is a 0..1 value. */
export function pickWeighted<Id extends string>(weights: Partial<Record<Id, number>>, random: number): Id | null {
  const entries = Object.entries(weights) as [Id, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let remaining = random * total;
  for (const [id, weight] of entries) {
    remaining -= weight;
    if (remaining < 0) return id;
  }
  return entries.at(-1)?.[0] ?? null;
}
