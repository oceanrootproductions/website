import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Grid, Lightformer, Sparkles, Stars } from "@react-three/drei";
import * as THREE from "three";

import EngineCore from "./EngineCore";
import PlatformOrbit from "./PlatformOrbit";
import { useIsMobile } from "../hooks/useIsMobile";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

/**
 * Home hero: Ocean Engine at the centre, the platforms we ship to circling it,
 * over an engine-editor grid. Everything is generated in code, so nothing is downloaded.
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
        camera={{ position: [0, 1.2, 13], fov: 38 }}
        dpr={isMobile ? [1, 1.5] : [1, 1.75]}
        frameloop={!animate ? "demand" : inView ? "always" : "never"}
      >
        <fog attach="fog" args={["#07101a", 14, 34]} />

        <ambientLight intensity={0.35} color="#8fbfff" />
        <hemisphereLight args={["#7ee7ff", "#0b0f12", 0.4]} />
        <directionalLight position={[4, 6, 5]} intensity={1.1} color="#d6e6ff" />
        <pointLight position={[-7, 3, -2]} intensity={45} distance={22} color="#ff6b6b" />

        {/* Reflections for the glossy devices, lit by a few soft panels instead of a downloaded HDRI. */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.5} color="#7ee7ff" position={[-5, 2, 3]} scale={[4, 6, 1]} />
          <Lightformer form="rect" intensity={1.5} color="#ff6b6b" position={[5, -1, 2]} scale={[3, 5, 1]} />
          <Lightformer form="circle" intensity={3} position={[0, 6, 0]} scale={4} />
        </Environment>

        <Stars radius={50} depth={40} count={isMobile ? 1500 : 3500} factor={3.5} saturation={0} fade speed={animate ? 0.6 : 0} />

        <Scene animate={animate} isMobile={isMobile} />

        <Grid
          position={[0, -3.2, 0]}
          infiniteGrid
          cellSize={0.6}
          cellThickness={0.6}
          cellColor="#12324a"
          sectionSize={3}
          sectionThickness={1.1}
          sectionColor="#2a7fa3"
          fadeDistance={30}
          fadeStrength={1.5}
        />

        {animate ? <CameraDrift /> : null}
      </Canvas>
    </div>
  );
}

// How far the scene reaches from its centre, in its own units (orbit radius plus half a device).
const SCENE_RADIUS = 4.3;

type Layout = { beside: boolean; scale: number; x: number; y: number };

/**
 * Where the scene goes so it doesn't fight the headline: beside it when the screen is wide
 * enough, in the top-right corner on medium screens, and above it on phones.
 */
function useHeroLayout(): Layout {
  const { viewport, camera, size } = useThree();
  const { width, height, aspect } = viewport.getCurrentViewport(camera, [0, 0, 0]);

  if (aspect > 1.1 && size.width >= 1200) {
    // The hero text sits in the site's 1152px column and is about 640px wide. The scene may tuck
    // one unit under its end, where a gradient behind the text keeps it readable.
    const textRightPx = Math.max((size.width - 1152) / 2, 0) + 16 + 640;
    const left = (textRightPx / size.width - 0.5) * width - 1;
    const right = width / 2 - width * 0.03;
    const scale = Math.min(
      THREE.MathUtils.clamp((right - left) / 2 / SCENE_RADIUS, 0.55, 1),
      (height * 0.44) / 3.4
    );
    return { beside: true, scale, x: (left + right) / 2, y: 0.5 };
  }
  if (aspect > 1.1) {
    const scale = Math.min(0.6, (height * 0.44) / 3.4);
    return { beside: false, scale, x: width / 2 - SCENE_RADIUS * scale - width * 0.02, y: height * 0.17 };
  }
  return { beside: false, scale: Math.min(0.6, (width * 0.48) / SCENE_RADIUS), x: 0, y: height * 0.2 };
}

function Scene({ animate, isMobile }: { animate: boolean; isMobile: boolean }) {
  const layout = useHeroLayout();
  return (
    <Rig animate={animate} layout={layout}>
      <EngineCore animate={animate} />
      <group rotation={[0.3, 0, 0]}>
        <PlatformOrbit animate={animate} showLabels={layout.beside && !isMobile} />
      </group>
      <Sparkles
        count={isMobile ? 40 : 90}
        scale={[9, 6, 9]}
        size={3}
        speed={animate ? 0.35 : 0}
        color="#9cefff"
        opacity={0.8}
        noise={0.6}
      />
    </Rig>
  );
}

/** Positions the scene and lets it lean gently toward the pointer. */
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
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, pointer.current.y * 0.12, 3, dt);
    g.position.y = y + Math.sin(state.clock.elapsedTime * 0.6) * 0.08;
  });

  return (
    <group ref={group} position={[x, y, 0]} scale={scale}>
      {children}
    </group>
  );
}

/** A slow sway of the camera, so the scene never looks frozen. */
function CameraDrift() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.12) * 0.6;
    camera.position.y = 1.2 + Math.sin(t * 0.09) * 0.25;
    camera.lookAt(0, 0, 0);
  });
  return null;
}
