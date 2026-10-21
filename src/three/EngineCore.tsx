import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** A soft round glow, drawn once and used as an additive halo in place of post-processing bloom. */
export function useGlowTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.15, "rgba(255,255,255,0.45)");
    gradient.addColorStop(0.45, "rgba(255,255,255,0.08)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

// 3D simplex noise, by Ian McEwan and Ashima Arts (MIT licence).
const SIMPLEX_NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const planetVertexShader = /* glsl */ `
uniform float uTime;
varying vec3 vNormalW;
varying vec3 vPositionW;
varying vec3 vPositionL;
${SIMPLEX_NOISE}
void main() {
  // A slow wobble, so the sphere reads as liquid.
  float wobble = snoise(normal * 1.6 + vec3(uTime * 0.25));
  vec3 displaced = position + normal * wobble * 0.06;
  vPositionL = displaced;
  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vPositionW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const planetFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uGlow;
varying vec3 vNormalW;
varying vec3 vPositionW;
varying vec3 vPositionL;
${SIMPLEX_NOISE}
void main() {
  vec3 view = normalize(cameraPosition - vPositionW);
  vec3 normal = normalize(vNormalW);
  float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 2.5);

  // Deep water below, lighter where the light from above reaches, with a slow drifting swell.
  float swell = snoise(vPositionL * 1.3 + vec3(0.0, uTime * 0.12, 0.0));
  float depth = smoothstep(-0.9, 0.9, normal.y * 0.7 + swell * 0.35);
  vec3 color = mix(uDeep, uShallow, depth);

  // Fine shimmer where two drifting noise layers cross, like light moving through water.
  float n1 = snoise(vPositionL * 2.4 + vec3(uTime * 0.18));
  float n2 = snoise(vPositionL * 3.1 - vec3(uTime * 0.14));
  float shimmer = pow(1.0 - abs(n1 - n2), 12.0);
  color += uGlow * shimmer * 0.22;

  vec3 light = normalize(vec3(-0.4, 0.8, 0.6));
  color += vec3(0.85, 0.97, 1.0) * pow(max(dot(reflect(-light, normal), view), 0.0), 60.0) * 0.8;
  color += uGlow * pow(fresnel, 1.2) * 1.3;

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/** Ocean Engine: a sphere of living water inside a slowly turning geometric lattice. */
export default function EngineCore({ animate }: { animate: boolean }) {
  const lattice = useRef<THREE.Group>(null);
  const glow = useGlowTexture();
  const latticeGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.42, 1), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color("#021827") },
      uShallow: { value: new THREE.Color("#0b6a93") },
      uGlow: { value: new THREE.Color("#6fe6ff") },
    }),
    []
  );

  useFrame((_, dt) => {
    if (!animate) return;
    uniforms.uTime.value += dt;
    if (lattice.current) {
      lattice.current.rotation.y += dt * 0.12;
      lattice.current.rotation.x += dt * 0.05;
    }
  });

  return (
    <group>
      <sprite scale={7.5}>
        <spriteMaterial
          map={glow}
          color="#2bb8ff"
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      <mesh>
        <icosahedronGeometry args={[1.05, 32]} />
        <shaderMaterial
          vertexShader={planetVertexShader}
          fragmentShader={planetFragmentShader}
          uniforms={uniforms}
        />
      </mesh>

      <group ref={lattice}>
        <lineSegments>
          <edgesGeometry args={[latticeGeometry]} />
          <lineBasicMaterial color="#7ee7ff" transparent opacity={0.22} />
        </lineSegments>
        <points geometry={latticeGeometry}>
          <pointsMaterial
            color="#d8fbff"
            size={0.05}
            sizeAttenuation
            transparent
            opacity={0.8}
          />
        </points>
      </group>

      <pointLight color="#4fd2ff" intensity={25} distance={10} />
    </group>
  );
}
