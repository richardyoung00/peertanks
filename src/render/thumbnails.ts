import * as THREE from 'three';
import type { GameMap } from '../sim/game-map';
import { ITEM_IDS, type ItemId } from '../sim/items';
import { createPickupModel } from './pickup-models';
import { buildTerrainView } from './terrain/terrain-view';
import { getTheme } from './themes';

const MAP_THUMBNAIL = { width: 360, height: 220 };
const ITEM_THUMBNAIL_SIZE = 128;
const MAP_TILT = THREE.MathUtils.degToRad(35);

export interface Thumbnails {
  maps: Record<string, string>;
  items: Record<ItemId, string>;
}

/**
 * Pictures for the menus, drawn from the game's own 3D models so they always match how things look in play.
 * Uses a short-lived renderer of its own, so it works before (and alongside) the game's scene.
 */
export function renderThumbnails(maps: Record<string, GameMap>): Thumbnails {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  try {
    return {
      maps: Object.fromEntries(Object.entries(maps).map(([id, map]) => [id, renderMap(renderer, map)])),
      items: Object.fromEntries(ITEM_IDS.map((item) => [item, renderItem(renderer, item)])) as Record<ItemId, string>,
    };
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}

function renderMap(renderer: THREE.WebGLRenderer, map: GameMap): string {
  const theme = getTheme(map.theme);
  const scene = litScene();
  scene.background = new THREE.Color(theme.outerGround);
  scene.add(buildTerrainView(map, theme).object);

  // A slightly tilted top-down view, fitted to show the whole arena.
  const aspect = MAP_THUMBNAIL.width / MAP_THUMBNAIL.height;
  const halfWidth = (map.width / 2) * 1.04;
  const halfHeight = Math.max(halfWidth / aspect, (map.height / 2) * Math.cos(MAP_TILT) + 1);
  const camera = new THREE.OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, 0.1, 200);
  const centre = new THREE.Vector3(map.width / 2, 0, map.height / 2);
  camera.position.set(centre.x, 40 * Math.cos(MAP_TILT), centre.z + 40 * Math.sin(MAP_TILT));
  camera.lookAt(centre);

  return snapshot(renderer, scene, camera, MAP_THUMBNAIL.width, MAP_THUMBNAIL.height);
}

function renderItem(renderer: THREE.WebGLRenderer, item: ItemId): string {
  const scene = litScene();
  const model = createPickupModel(item);
  model.rotation.y = -0.6;
  scene.add(model);

  // Frame the model's actual size, so long ones (rocket, laser) and round ones (grenade) both fill the picture.
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3()).length();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  const centre = bounds.getCenter(new THREE.Vector3());
  camera.position.copy(centre).add(new THREE.Vector3(0, size * 0.9, size * 1.6));
  camera.lookAt(centre);

  return snapshot(renderer, scene, camera, ITEM_THUMBNAIL_SIZE, ITEM_THUMBNAIL_SIZE);
}

function litScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x4d5c3a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(-6, 14, 5);
  scene.add(sun);
  return scene;
}

function snapshot(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, width: number, height: number): string {
  renderer.setSize(width, height, false);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}
