import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Sparkles, Stars } from "@react-three/drei";
import * as THREE from "three";

import EngineCore from "./EngineCore";
import Ocean, { Ripples } from "./Ocean";
import PlatformOrbit, { ORBIT_RADIUS } from "./PlatformOrbit";
import { useIsMobile } from "../hooks/useIsMobile";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

// The horizon colour: the sky fades into it and the fog pulls the far sea toward it.
const HORIZON = "#0c2b40";

/**
 * Home hero: Ocean Engine as a planet of living water rising over a night sea, with the
 * platforms we ship to circling it as glass moons. Everything is generated in code.
 */
export default function ThreeHero() {
  const isMobile = useIsMobile();
  const reduced = usePrefersReducedMotion();
  const animate = !reduced;

  // Stop rendering once the hero has scrolled out of view.
  const container = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={container} className="relative ocean-gradient" style={{ height: "100svh" }}>
      <Canvas
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0.6, 13], fov: 38 }}
        dpr={isMobile ? [1, 1.5] : [1, 1.75]}
        frameloop={!animate ? "demand" : inView ? "always" : "never"}
      >
        <fog attach="fog" args={[HORIZON, 14, 70]} />
        <SkyDome />

        <ambientLight intensity={0.25} color="#8fbfff" />
        <directionalLight position={[-6, 5, -4]} intensity={0.6} color="#bfe9ff" />

        {/* Reflections for the glass moons, lit by a few soft panels instead of a downloaded HDRI. */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.5} color="#7ee7ff" position={[-5, 2, 3]} scale={[4, 6, 1]} />
          <Lightformer form="rect" intensity={1.5} color="#ff6b6b" position={[5, -1, 2]} scale={[3, 5, 1]} />
          <Lightformer form="circle" intensity={3} position={[0, 6, 0]} scale={4} />
        </Environment>

        <Stars radius={70} depth={30} count={isMobile ? 1200 : 3000} factor={3} saturation={0} fade speed={animate ? 0.5 : 0} />

        <Scene animate={animate} isMobile={isMobile} />

        <Camera animate={animate} />
      </Canvas>
    </div>
  );
}

/** A gradient night sky: dark overhead, lifting to the horizon colour. */
function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color("#02060b") },
          uHorizon: { value: new THREE.Color(HORIZON) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDirection;
          void main() {
            vDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uHorizon;
          varying vec3 vDirection;
          void main() {
            float height = clamp(vDirection.y, 0.0, 1.0);
            gl_FragColor = vec4(mix(uHorizon, uTop, pow(smoothstep(0.0, 0.55, height), 0.7)), 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    []
  );
  return (
    <mesh material={material}>
      <sphereGeometry args={[120, 32, 16]} />
    </mesh>
  );
}

// How far the planet and its moons reach from their centre, in their own units, with room for
// perspective and the lean toward the pointer.
const SCENE_RADIUS = ORBIT_RADIUS + 1;

type Layout = { beside: boolean; scale: number; x: number; y: number };

/**
 * Where the planet goes so it doesn't fight the headline: beside it when the screen is wide
 * enough, in the top-right corner on medium screens, and above it on phones.
 */
function useHeroLayout(): Layout {
  const { viewport, camera, size } = useThree();
  const { width, height, aspect } = viewport.getCurrentViewport(camera, [0, 0, 0]);

  if (aspect > 1.1 && size.width >= 1200) {
    // The hero text sits in the site's 1152px column and is about 640px wide; the scene stays clear of it.
    const textRightPx = Math.max((size.width - 1152) / 2, 0) + 16 + 640;
    const left = (textRightPx / size.width - 0.5) * width;
    const right = width / 2 - width * 0.03;
    const scale = Math.min(
      THREE.MathUtils.clamp((right - left) / 2 / SCENE_RADIUS, 0.55, 1.1),
      (height * 0.4) / 3
    );
    // Just above the water, so its reflection sits close beneath it.
    return { beside: true, scale, x: (left + right) / 2, y: 0.6 };
  }
  if (aspect > 1.1) {
    // Up in the sky above the headline, which spans the full width here.
    const scale = Math.min(0.55, (height * 0.4) / 3);
    return { beside: false, scale, x: width / 2 - SCENE_RADIUS * scale - width * 0.02, y: height * 0.2 };
  }
  return { beside: false, scale: Math.min(0.7, (width * 0.48) / SCENE_RADIUS), x: 0, y: height * 0.22 };
}

function Scene({ animate, isMobile }: { animate: boolean; isMobile: boolean }) {
  const layout = useHeroLayout();
  // The sea's glitter path runs from the planet toward the viewer, like moonlight.
  const lightDirection = useMemo<[number, number, number]>(
    () => [layout.x * 0.05, 0.22, -1],
    [layout.x]
  );

  return (
    <>
      <Ocean reflective={!isMobile} animate={animate} lightDirection={lightDirection} />
      <Ripples x={layout.x} animate={animate} />
      <Rig animate={animate} layout={layout}>
        <group scale={1.15}>
          <EngineCore animate={animate} />
        </group>
        <group rotation={[0.18, 0, 0]}>
          <PlatformOrbit animate={animate} showLabels={layout.beside && !isMobile} />
        </group>
        <Sparkles
          count={isMobile ? 30 : 60}
          scale={[7, 4, 7]}
          size={2.5}
          speed={animate ? 0.3 : 0}
          color="#9cefff"
          opacity={0.7}
          noise={0.5}
        />
      </Rig>
    </>
  );
}

/** Positions the planet and lets it lean gently toward the pointer. */
function Rig({
  animate,
  layout,
  children,
}: {
  animate: boolean;
  layout: Layout;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const { scale, x, y } = layout;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g || !animate) return;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, pointer.current.x * 0.25, 3, dt);
    // Kept small: the planet sits low, and a bigger tilt would dip the front moon into the sea.
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, pointer.current.y * 0.05, 3, dt);
    g.position.y = y + Math.sin(state.clock.elapsedTime * 0.6) * 0.08;
  });

  return (
    <group ref={group} position={[x, y, 0]} scale={scale}>
      {children}
    </group>
  );
}

/** Keeps the camera on the horizon, with a slow sway when motion is allowed. */
function Camera({ animate }: { animate: boolean }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.lookAt(0, 0.3, 0);
  }, [camera]);
  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.12) * 0.5;
    camera.position.y = 0.6 + Math.sin(t * 0.09) * 0.15;
    camera.lookAt(0, 0.3, 0);
  });
  return null;
}
