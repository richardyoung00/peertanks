import * as THREE from 'three';
import type { GraphicsQuality } from './graphics-quality';
import type { Theme } from './themes/theme';

const SUN_OFFSET = new THREE.Vector3(-6, 14, -5);
const SHADOW_AREA = 14;

export interface SceneParts {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
}

export function createScene(container: HTMLElement, theme: Theme): SceneParts {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.outerGround);
  scene.fog = new THREE.Fog(theme.outerGround, 28, 55);
  scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x4d5c3a, 1.6));

  const sun = createSun();
  scene.add(sun, sun.target);
  return { renderer, scene, sun };
}

function createSun(): THREE.DirectionalLight {
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -SHADOW_AREA;
  sun.shadow.camera.right = SHADOW_AREA;
  sun.shadow.camera.top = SHADOW_AREA;
  sun.shadow.camera.bottom = -SHADOW_AREA;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  return sun;
}

/** Low quality draws at one pixel per screen pixel and without shadows, which is much cheaper on slow machines. */
export function applyQuality(parts: SceneParts, quality: GraphicsQuality, width: number, height: number): void {
  const high = quality === 'high';
  parts.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
  parts.renderer.setSize(width, height);
  parts.renderer.shadowMap.enabled = high;
  parts.sun.castShadow = high;
  // Shadows are built into each material's shader, so they all need rebuilding.
  parts.scene.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    for (const each of Array.isArray(material) ? material : material ? [material] : []) each.needsUpdate = true;
  });
}

/** Keeps the shadow-casting area centred on what the camera is looking at. */
export function centreSunOn(sun: THREE.DirectionalLight, x: number, z: number): void {
  sun.target.position.set(x, 0, z);
  sun.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
}
