import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  ContactShadows,
  Points,
  PointMaterial,
} from "@react-three/drei";
import { Water, RGBELoader } from "three-stdlib";
import * as THREE from "three";
import VRHeadset from "./VRHeadset";
import { useIsMobile } from "../hooks/useIsMobile";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

// Leva removed; simplified scene

export default function ThreeHero() {
  const isMobile = useIsMobile();
  const reduced = usePrefersReducedMotion();
  const autoRotate = !reduced;

  const height = isMobile ? "82vh" : "82vh";

  // Controls UI removed

  // Gentle tilt group for mobile/coarse pointer
  const tiltRef = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!tiltRef.current) return;
    const g = tiltRef.current;
    let cleanup: (() => void) | undefined;
    if (isMobile) {
      const onOrient = (e: DeviceOrientationEvent) => {
        const beta = (e.beta || 0) * (Math.PI / 180); // x
        const gamma = (e.gamma || 0) * (Math.PI / 180); // y
        g.rotation.x = THREE.MathUtils.clamp(beta * 0.05, -0.2, 0.2);
        g.rotation.y = THREE.MathUtils.clamp(gamma * 0.05, -0.2, 0.2);
      };
      window.addEventListener("deviceorientation", onOrient);
      cleanup = () => window.removeEventListener("deviceorientation", onOrient);
    } else {
      const onMove = (e: MouseEvent) => {
        const nx = (e.clientY / window.innerHeight) * 2 - 1;
        const ny = (e.clientX / window.innerWidth) * 2 - 1;
        g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, nx * -0.05, 0.1);
        g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, ny * 0.05, 0.1);
      };
      window.addEventListener("mousemove", onMove);
      cleanup = () => window.removeEventListener("mousemove", onMove);
    }
    return cleanup;
  }, [isMobile]);

  return (
    <div className="relative ocean-gradient" style={{ height }}>
      <Canvas
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [4, 2.4, 5], fov: 52 }}
        dpr={[1, 1.75]}
      >
        <color attach="background" args={["#000000"]} />
        {/* Heavy night fog */}
        <fogExp2 attach="fog" args={[new THREE.Color("#fff"), 0.04]} />

        {/* Lights */}
        <ambientLight intensity={0.35} color="#8fbfff" />
        <directionalLight
          position={[5, 8, 5]}
          intensity={0.7}
          color="#b0c7ff"
        />

        {/* Scene */}
        <group ref={tiltRef}>
          <VRHeadset autoRotate={!isMobile && autoRotate} />
        </group>

        {/* Water plane */}
        <RealisticOcean isMobile={isMobile} />

        {/* Particles */}
        <Specks count={isMobile ? 80 : 200} />

        {/* Skybox + reflections */}
        <Suspense fallback={null}>
          <FoggySky />
          <Environment
            files={HDRI_URL}
            background={false}
            resolution={4096}
            blur={0}
          />
        </Suspense>

        {/* Controls: auto-rotate camera (input disabled) */}
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableRotate={false}
          autoRotate={autoRotate}
          autoRotateSpeed={0.6}
        />
      </Canvas>

      {/* Controls UI removed */}
    </div>
  );
}

function Specks({ count = 150 }: { count?: number }) {
  const ref = useRef<any>();
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  useMemo(() => {
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = 4 + Math.random() * 5;
      const t = Math.random() * Math.PI * 2;
      const y = -0.6 + Math.random() * 2.2;
      positions[i3] = Math.cos(t) * r;
      positions[i3 + 1] = y;
      positions[i3 + 2] = Math.sin(t) * r;
    }
  }, [positions, count]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.05;
    if (!ref.current) return;
    ref.current.rotation.y = t;
  });

  return (
    <group position={[0, 0.5, 0]}>
      <Points ref={ref} positions={positions} stride={3} frustumCulled>
        <PointMaterial
          color="#7ee7ff"
          size={0.03}
          sizeAttenuation
          transparent
          opacity={0.75}
        />
      </Points>
    </group>
  );
}

function RealisticOcean({ isMobile }: { isMobile: boolean }) {
  const waterNormals = useLoader(
    THREE.TextureLoader,
    "https://threejs.org/examples/textures/waternormals.jpg",
    (loader) => {
      loader.setCrossOrigin("anonymous");
    }
  );
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;

  const ocean = useMemo(() => {
    const geometry = new THREE.CircleGeometry(60, 128);
    const water = new Water(geometry, {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals,
      sunDirection: new THREE.Vector3(1, 1, 0.5).normalize(),
      sunColor: "#ffffff",
      waterColor: "#0a2343",
      distortionScale: isMobile ? 1.6 : 2.5,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1.1;
    return water;
  }, [waterNormals, isMobile]);

  useFrame((_, delta) => {
    if (!ocean.material?.uniforms?.time) return;
    ocean.material.uniforms.time.value += delta;
  });

  return <primitive object={ocean} />;
}

const HDRI_URL =
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/citrus_orchard_road_puresky_4k.hdr";

function FoggySky() {
  const texture = useLoader(RGBELoader, HDRI_URL);
  useMemo(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh scale={-1}>
      <sphereGeometry args={[80, 64, 64]} />
      <meshBasicMaterial
        map={texture}
        color="#06080f"
        side={THREE.BackSide}
        fog
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
