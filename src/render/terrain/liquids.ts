import * as THREE from 'three';
import type { HazardType } from '../../sim/game-events';
import type { GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { buildInstancedMesh, tilesOfType } from './instancing';
import { buildLavaSurface } from './lava-surface';
import { buildBank, shorelineDistance, type BankProfile } from './liquid-bank';
import type { LiquidSurface } from './liquid-shaders';
import { ShoreField } from './shore-field';
import { buildWaterSurface } from './water-surface';

const WATER_LEVEL = -0.12;
const LAVA_LEVEL = -0.1;
const PIT_BED_TOP = -1.5;

/** Surface heights, for effects that sit on top of a liquid (a pit's "surface" is the ground it fell from). */
export const LIQUID_LEVELS: Record<HazardType, number> = { water: WATER_LEVEL, lava: LAVA_LEVEL, pit: 0 };
const PIT_BED_THICKNESS = 0.3;

function waterBank(theme: Theme): BankProfile {
  return {
    lip: 0.03,
    slopeEnd: 0.7,
    bedHeight: -0.42,
    surfaceHeight: WATER_LEVEL,
    colors: [
      { distance: 0, color: theme.floor.dark },
      { distance: 0.04, color: theme.water.sand },
      { distance: 0.2, color: theme.water.sand },
      { distance: 0.34, color: theme.water.wetSand },
      { distance: 0.65, color: theme.water.bed },
    ],
  };
}

function lavaBank(theme: Theme): BankProfile {
  return {
    lip: 0.03,
    slopeEnd: 0.5,
    bedHeight: -0.32,
    surfaceHeight: LAVA_LEVEL,
    colors: [
      // Grass fading to scorched ground; dark rock only in a thin band right at the lava line.
      { distance: 0, color: theme.floor.dark },
      { distance: 0.06, color: theme.lava.scorched },
      { distance: 0.14, color: theme.lava.rock },
      { distance: 0.19, color: theme.lava.rim },
      { distance: 0.3, color: theme.lava.bed },
    ],
  };
}

/** Water and lava with sloped banks and rounded shores, and pits as plain dark holes. */
export function buildLiquids(map: GameMap, theme: Theme): LiquidSurface {
  const group = new THREE.Group();
  const surfaces: LiquidSurface[] = [];

  if (map.terrain.includes('water')) {
    const field = new ShoreField(map, 'water');
    const profile = waterBank(theme);
    const water = buildWaterSurface(map, field, theme, WATER_LEVEL, shorelineDistance(profile));
    group.add(buildBank(map, field, 'water', profile), water.object);
    surfaces.push(water);
  }
  if (map.terrain.includes('lava')) {
    const field = new ShoreField(map, 'lava');
    const profile = lavaBank(theme);
    const lava = buildLavaSurface(map, field, theme, LAVA_LEVEL, shorelineDistance(profile));
    group.add(buildBank(map, field, 'lava', profile), lava.object);
    surfaces.push(lava);
  }
  group.add(buildPitBeds(map, theme));

  return {
    object: group,
    update(time) {
      for (const surface of surfaces) surface.update(time);
    },
  };
}

function buildPitBeds(map: GameMap, theme: Theme): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(1, PIT_BED_THICKNESS, 1);
  const material = new THREE.MeshStandardMaterial({ color: theme.pit, roughness: 1 });
  const placements = tilesOfType(map, ['pit']).map(({ column, row }) => ({
    x: column + 0.5,
    y: PIT_BED_TOP - PIT_BED_THICKNESS / 2,
    z: row + 0.5,
  }));
  return buildInstancedMesh(geometry, material, placements);
}
