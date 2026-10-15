import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/** Only colours brighter than full white glow, so grass, walls and water stay crisp. */
const THRESHOLD = 1;
const STRENGTH = 0.5;
const RADIUS = 0.4;
/** Anti-aliasing for the off-screen picture, which the renderer's own setting doesn't cover. */
const SAMPLES = 4;

/** Draws the scene with a soft glow around the brightest things: lava cracks, sparks, flames and lasers. */
export class Bloom {
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    const size = renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: SAMPLES });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(new UnrealBloomPass(size, STRENGTH, RADIUS, THRESHOLD));
    this.composer.addPass(new OutputPass());
    this.syncSize();
  }

  render(): void {
    this.composer.render();
  }

  /** Call after the renderer's size or pixel ratio changes. */
  syncSize(): void {
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(size.x, size.y);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
