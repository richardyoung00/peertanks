import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { TerrainType } from '../../sim/terrain';
import { smoothstep } from './patch-noise';
import type { ShoreField } from './shore-field';
import { tilesOfType } from './instancing';

/** Low-poly facets: each tile of bank is split into this many steps each way. */
const BANK_STEPS = 4;

/** The shape of a bank, as a height for each distance into the liquid. */
export interface BankProfile {
  /** A thin strip of level ground at the very edge, so the grass doesn't start sloping on the tile line. */
  lip: number;
  /** Where the slope reaches the bed. */
  slopeEnd: number;
  bedHeight: number;
  /** Height of the liquid's surface. */
  surfaceHeight: number;
  /** Bank colours by distance into the liquid, blended between stops. */
  colors: { distance: number; color: number }[];
}

export function bankHeight(profile: BankProfile, distance: number): number {
  return profile.bedHeight * smoothstep(profile.lip, profile.slopeEnd, distance);
}

/** How far into the liquid the bank dips below the surface: where the shoreline is drawn. */
export function shorelineDistance(profile: BankProfile): number {
  let low = profile.lip;
  let high = profile.slopeEnd;
  for (let step = 0; step < 20; step++) {
    const middle = (low + high) / 2;
    if (bankHeight(profile, middle) > profile.surfaceHeight) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/**
 * The ground under and around a liquid: level grass at the tile edge, sloping down to the bed.
 * It replaces the old straight drop, and the waterline appears where it meets the surface.
 */
export function buildBank(map: GameMap, field: ShoreField, liquid: TerrainType, profile: BankProfile): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const addCorner = (x: number, z: number) => {
    const distance = field.at(x, z);
    positions.push(x, bankHeight(profile, distance), z);
    const color = bankColor(profile, distance);
    colors.push(color.r, color.g, color.b);
  };
  // Corners listed in this order make the triangle face up.
  const addTriangle = (...corners: [number, number][]) => corners.forEach(([x, z]) => addCorner(x, z));

  for (const { column, row } of tilesOfType(map, [liquid])) {
    for (let stepZ = 0; stepZ < BANK_STEPS; stepZ++) {
      for (let stepX = 0; stepX < BANK_STEPS; stepX++) {
        const left = column + stepX / BANK_STEPS;
        const top = row + stepZ / BANK_STEPS;
        const right = left + 1 / BANK_STEPS;
        const bottom = top + 1 / BANK_STEPS;
        addTriangle([left, top], [left, bottom], [right, top]);
        addTriangle([right, top], [left, bottom], [right, bottom]);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function bankColor(profile: BankProfile, distance: number): THREE.Color {
  const stops = profile.colors;
  const next = stops.findIndex((stop) => stop.distance > distance);
  if (next === -1) return new THREE.Color(stops[stops.length - 1].color);
  if (next === 0) return new THREE.Color(stops[0].color);
  const from = stops[next - 1];
  const to = stops[next];
  const blend = (distance - from.distance) / (to.distance - from.distance);
  return new THREE.Color(from.color).lerp(new THREE.Color(to.color), blend);
}
