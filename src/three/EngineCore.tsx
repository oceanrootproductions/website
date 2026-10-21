import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshDistortMaterial } from "@react-three/drei";
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

const RINGS: { radius: number; tilt: [number, number, number]; speed: number }[] = [
  { radius: 2.05, tilt: [Math.PI / 2.2, 0, 0], speed: 0.35 },
  { radius: 2.3, tilt: [0.5, 0.8, 0], speed: -0.25 },
  { radius: 2.55, tilt: [-0.7, 0.2, 0.4], speed: 0.18 },
];

/** Ocean Engine, drawn as a liquid "ocean" core inside a wireframe engine shell, circled by gyroscope rings. */
export default function EngineCore({ animate }: { animate: boolean }) {
  const shell = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const glow = useGlowTexture();
  const shellGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.55, 1), []);

  useFrame((_, dt) => {
    if (!animate) return;
    if (shell.current) {
      shell.current.rotation.y += dt * 0.18;
      shell.current.rotation.x += dt * 0.07;
    }
    rings.current?.children.forEach((ring, i) => {
      ring.rotation.z += dt * RINGS[i].speed;
    });
  });

  return (
    <group scale={0.8}>
      <sprite scale={8}>
        <spriteMaterial
          map={glow}
          color="#2bb8ff"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      <mesh>
        <icosahedronGeometry args={[1.05, 20]} />
        <MeshDistortMaterial
          color="#0a4f74"
          emissive="#0d6f99"
          emissiveIntensity={0.55}
          roughness={0.08}
          metalness={0.15}
          distort={0.32}
          speed={animate ? 1.4 : 0}
        />
      </mesh>
      {/* Rim light: a slightly larger back-facing shell, added on top. */}
      <mesh scale={1.22}>
        <sphereGeometry args={[1.05, 48, 48]} />
        <meshBasicMaterial
          color="#5fdcff"
          transparent
          opacity={0.14}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <group ref={shell}>
        <lineSegments>
          <edgesGeometry args={[shellGeometry]} />
          <lineBasicMaterial color="#7ee7ff" transparent opacity={0.45} />
        </lineSegments>
        <points geometry={shellGeometry}>
          <pointsMaterial
            color="#d8fbff"
            size={0.07}
            sizeAttenuation
            transparent
            opacity={0.9}
          />
        </points>
      </group>

      <group ref={rings}>
        {RINGS.map((ring, i) => (
          <group key={i} rotation={ring.tilt}>
            <mesh>
              <torusGeometry args={[ring.radius, 0.01, 6, 180]} />
              <meshBasicMaterial color="#7ee7ff" transparent opacity={0.4} />
            </mesh>
            <mesh position={[ring.radius, 0, 0]}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <sprite position={[ring.radius, 0, 0]} scale={0.6}>
              <spriteMaterial
                map={glow}
                color="#7ee7ff"
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </sprite>
          </group>
        ))}
      </group>

      <pointLight color="#4fd2ff" intensity={30} distance={9} />
    </group>
  );
}
