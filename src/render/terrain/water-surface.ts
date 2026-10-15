import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { buildSurfaceGeometry, FACET_NORMAL_GLSL, NOISE_GLSL, SHORE_GLSL, shoreUniforms, type LiquidSurface } from './liquid-shaders';
import type { ShoreField } from './shore-field';

const WAVE_HEIGHT = 0.025;
/** How far past the shoreline the water takes to reach its deepest colour. */
const DEPTH_FADE = 0.9;
const SUN_DIRECTION = new THREE.Vector3(-6, 14, -5).normalize();

const vertexShader = /* glsl */ `
  uniform float time;
  uniform float waveHeight;
  varying vec3 worldPosition;
  #include <common>
  #include <fog_pars_vertex>

  float wave(vec2 p) {
    return sin(p.x * 1.4 + time * 1.1) * 0.5 + sin(p.y * 1.9 - time * 0.8) * 0.35 + sin((p.x + p.y) * 2.6 + time * 1.7) * 0.2;
  }

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    world.y += wave(world.xz) * waveHeight;
    worldPosition = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform float time;
  uniform float shoreline;
  uniform float depthFade;
  uniform vec3 shallowColor;
  uniform vec3 deepColor;
  uniform vec3 foamColor;
  uniform vec3 sunDirection;
  varying vec3 worldPosition;
  #include <common>
  #include <fog_pars_fragment>
  ${NOISE_GLSL}
  ${SHORE_GLSL}
  ${FACET_NORMAL_GLSL}

  void main() {
    vec2 p = worldPosition.xz;
    vec3 normal = facetNormal(worldPosition);
    float fromShore = shoreDistance(p) - shoreline;
    float depth = smoothstep(0.0, depthFade, fromShore);

    vec3 color = mix(shallowColor, deepColor, depth);
    color *= 0.8 + 0.3 * max(dot(normal, sunDirection), 0.0);

    // Light ripples drifting across, and the odd glint of sun on a facet.
    float ripple = noise(p * 2.2 + vec2(time * 0.3, time * 0.2));
    color += smoothstep(0.66, 0.74, ripple) * 0.07;
    vec3 toCamera = normalize(cameraPosition - worldPosition);
    float glint = pow(max(dot(reflect(-sunDirection, normal), toCamera), 0.0), 50.0);
    float sparkle = step(0.93, noise(p * 16.0 + time * 0.8));
    color += glint * 0.3 + sparkle * glint * 1.5;

    // A broken foam line lapping at the shore.
    float nearShore = 1.0 - smoothstep(0.0, 0.12, fromShore);
    float lapping = noise(p * 5.0 + vec2(time * 0.7, -time * 0.5));
    float foam = nearShore * smoothstep(0.4, 0.62, lapping + nearShore * 0.35);
    color = mix(color, foamColor, foam * 0.85);

    // See-through near the edge, so the sandy bed shows.
    float alpha = max(mix(0.55, 0.92, depth), foam);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** One continuous sheet of water with gentle low-poly waves, deepening in colour away from the shore. */
export function buildWaterSurface(map: GameMap, field: ShoreField, theme: Theme, height: number, shoreline: number): LiquidSurface {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    fog: true,
    // The shore texture is added after merging, because merging would copy it.
    uniforms: {
      ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      time: { value: 0 },
      waveHeight: { value: WAVE_HEIGHT },
      shoreline: { value: shoreline },
      depthFade: { value: DEPTH_FADE },
      shallowColor: { value: new THREE.Color(theme.water.shallow) },
      deepColor: { value: new THREE.Color(theme.water.deep) },
      foamColor: { value: new THREE.Color(theme.water.foam) },
      sunDirection: { value: SUN_DIRECTION },
      ...shoreUniforms(field),
    },
  });
  const mesh = new THREE.Mesh(buildSurfaceGeometry(map, 'water', height), material);
  return {
    object: mesh,
    update(time) {
      material.uniforms.time.value = time;
    },
  };
}
