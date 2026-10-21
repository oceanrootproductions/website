import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Water } from "three-stdlib";
import * as THREE from "three";

// Close enough under the planet that its reflection and light path land on screen.
export const WATER_LEVEL = -1;

/** Small seeded random generator, so the waves look the same on every visit. */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tileable wave normal map, generated here so nothing has to be downloaded. */
function makeWaveNormals(size = 256) {
  const random = seededRandom(7);
  const octaves = [4, 8, 16, 32].map((cells, i) => ({
    cells,
    amplitude: 1 / 2 ** i,
    grid: Float32Array.from({ length: cells * cells }, () => random()),
  }));
  const smooth = (t: number) => t * t * (3 - 2 * t);

  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      for (const { cells, amplitude, grid } of octaves) {
        const fx = (x / size) * cells;
        const fy = (y / size) * cells;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = (x0 + 1) % cells;
        const y1 = (y0 + 1) % cells;
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const top = grid[y0 * cells + x0] * (1 - tx) + grid[y0 * cells + x1] * tx;
        const bottom = grid[y1 * cells + x0] * (1 - tx) + grid[y1 * cells + x1] * tx;
        h += amplitude * (top * (1 - ty) + bottom * ty);
      }
      height[y * size + x] = h;
    }
  }

  const at = (x: number, y: number) =>
    height[((y + size) % size) * size + ((x + size) % size)];
  const strength = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = (-dx / length) * 127.5 + 127.5;
      data[i + 1] = (-dy / length) * 127.5 + 127.5;
      data[i + 2] = (1 / length) * 127.5 + 127.5;
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The night sea. Desktop gets real reflections and a glittering light path toward the planet;
 * phones get a cheaper, non-reflective surface.
 */
export default function Ocean({
  reflective,
  animate,
  lightDirection,
}: {
  reflective: boolean;
  animate: boolean;
  lightDirection: [number, number, number];
}) {
  return reflective ? (
    <ReflectiveWater animate={animate} lightDirection={lightDirection} />
  ) : (
    <SimpleWater animate={animate} />
  );
}

function ReflectiveWater({
  animate,
  lightDirection,
}: {
  animate: boolean;
  lightDirection: [number, number, number];
}) {
  const normals = useMemo(() => makeWaveNormals(), []);
  const water = useMemo(() => {
    const mesh = new Water(new THREE.PlaneGeometry(400, 400), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(0, 0.3, -1).normalize(),
      sunColor: 0xbff4ff,
      waterColor: 0x04263a,
      distortionScale: 1.8,
      fog: true,
    });
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = WATER_LEVEL;
    mesh.material.uniforms.size.value = 6;
    return mesh;
  }, [normals]);

  useEffect(() => {
    water.material.uniforms.sunDirection.value.set(...lightDirection).normalize();
  }, [water, lightDirection]);

  useFrame((_, dt) => {
    if (animate) water.material.uniforms.time.value += dt * 0.4;
  });

  return <primitive object={water} />;
}

function SimpleWater({ animate }: { animate: boolean }) {
  const normals = useMemo(() => {
    const texture = makeWaveNormals();
    texture.repeat.set(24, 24);
    return texture;
  }, []);
  const normalScale = useMemo(() => new THREE.Vector2(0.6, 0.6), []);

  useFrame((_, dt) => {
    if (!animate) return;
    normals.offset.x += dt * 0.004;
    normals.offset.y += dt * 0.006;
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position-y={WATER_LEVEL}>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial
        color="#04263a"
        roughness={0.22}
        metalness={0.6}
        normalMap={normals}
        normalScale={normalScale}
      />
    </mesh>
  );
}

/** Soft rings that spread across the water from under the planet. */
export function Ripples({ x, animate }: { x: number; animate: boolean }) {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.72, "rgba(255,255,255,0)");
    gradient.addColorStop(0.84, "rgba(255,255,255,1)");
    gradient.addColorStop(0.92, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    return result;
  }, []);
  const rings = useRef<THREE.Mesh[]>([]);

  useFrame(({ clock }) => {
    rings.current.forEach((ring, i) => {
      const t = (clock.elapsedTime / 4.5 + i / 3) % 1;
      const scale = 1.5 + t * 11;
      ring.scale.set(scale, scale, 1);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - t) ** 1.5;
    });
  });

  if (!animate) return null;

  return (
    <group position={[x, WATER_LEVEL + 0.03, 0]} rotation-x={-Math.PI / 2}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            if (mesh) rings.current[i] = mesh;
          }}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={texture}
            color="#7ee7ff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
