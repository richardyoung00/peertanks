import * as THREE from 'three';
import type { Theme } from './themes/theme';

/** The sun shines from up and to the back left; a directional light only cares about its direction. */
const SUN_POSITION = new THREE.Vector3(-6, 14, -5);

export interface SceneParts {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
}

/**
 * Draws at one pixel per screen pixel, without shadows or glow: on high-density laptop screens anything more
 * costs several times the work (and fan noise) for little visible gain.
 */
export function createScene(container: HTMLElement, theme: Theme): SceneParts {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.outerGround);
  scene.fog = new THREE.Fog(theme.outerGround, 28, 55);
  scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x4d5c3a, 1.6));

  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.copy(SUN_POSITION);
  scene.add(sun);
  return { renderer, scene };
}
