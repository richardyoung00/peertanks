import * as THREE from 'three';
import type { GameMap } from '../../sim/game-map';
import type { Theme } from '../themes/theme';
import { buildLavaEmbers } from './lava-embers';
import { buildSurfaceGeometry, NOISE_GLSL, SHORE_GLSL, shoreUniforms, type LiquidSurface } from './liquid-shaders';
import type { ShoreField } from './shore-field';

const vertexShader = /* glsl */ `
  uniform float time;
  varying vec3 worldPosition;
  #include <common>
  #include <fog_pars_vertex>

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    // A slow, heavy swell.
    world.y += sin(world.x * 1.1 + time * 0.7) * sin(world.z * 0.9 - time * 0.5) * 0.012;
    worldPosition = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform float time;
  uniform float shoreline;
  uniform vec3 moltenColor;
  uniform vec3 crustColor;
  uniform vec3 glowColor;
  varying vec3 worldPosition;
  #include <common>
  #include <fog_pars_fragment>
  ${NOISE_GLSL}
  ${SHORE_GLSL}

  // Each cell of a loose grid has one bubble that swells, then pops in a bright ring.
  float bubbles(vec2 p) {
    vec2 scaled = p * 1.5;
    vec2 cell = floor(scaled);
    vec2 local = fract(scaled);
    float seed = hash(cell);
    vec2 centre = vec2(0.3 + 0.4 * hash(cell + 3.1), 0.3 + 0.4 * hash(cell + 7.7));
    float life = fract(time * (0.16 + 0.1 * seed) + seed);
    float radius = 0.04 + life * 0.14;
    float distanceToCentre = length(local - centre);
    float swelling = smoothstep(radius, radius - 0.03, distanceToCentre) * step(life, 0.88) * 0.35;
    float popAge = clamp((life - 0.88) / 0.12, 0.0, 1.0);
    float ring = smoothstep(0.03, 0.0, abs(distanceToCentre - radius - popAge * 0.08));
    float popping = step(0.88, life) * ring * (1.0 - popAge);
    return swelling + popping;
  }

  void main() {
    vec2 p = worldPosition.xz;
    vec2 flow = vec2(time * 0.06, time * 0.035);

    float crustPattern = fbm(p * 1.1 + flow);
    float crust = smoothstep(0.42, 0.56, crustPattern);
    float pulse = 0.85 + 0.15 * sin(time * 2.2 + crustPattern * 6.0);
    vec3 color = mix(moltenColor * pulse, crustColor, crust * 0.85);

    float ridges = 1.0 - abs(fbm(p * 1.8 - flow * 1.3) * 2.0 - 1.0);
    color += glowColor * smoothstep(0.93, 0.99, ridges) * 1.1;

    float nearShore = 1.0 - smoothstep(0.0, 0.18, shoreDistance(p) - shoreline);
    color = mix(color, glowColor, nearShore * 0.55);
    color += glowColor * bubbles(p) * 1.2;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** Molten lava with a slowly drifting dark crust, bright cracks, a glowing edge, popping bubbles and rising embers. */
export function buildLavaSurface(map: GameMap, field: ShoreField, theme: Theme, height: number, shoreline: number): LiquidSurface {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    fog: true,
    // The shore texture is added after merging, because merging would copy it.
    uniforms: {
      ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      time: { value: 0 },
      shoreline: { value: shoreline },
      moltenColor: { value: new THREE.Color(theme.lava.molten) },
      crustColor: { value: new THREE.Color(theme.lava.crust) },
      glowColor: { value: new THREE.Color(theme.lava.glow) },
      ...shoreUniforms(field),
    },
  });
  const surface = new THREE.Mesh(buildSurfaceGeometry(map, 'lava', height), material);
  const embers = buildLavaEmbers(map, theme, height);

  const group = new THREE.Group();
  group.add(surface, embers.object);
  return {
    object: group,
    update(time) {
      material.uniforms.time.value = time;
      embers.update(time);
    },
  };
}
