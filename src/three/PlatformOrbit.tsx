import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Html, Line } from "@react-three/drei";
import * as THREE from "three";

import type { Spin } from "./spin";

type DrawIcon = (ctx: CanvasRenderingContext2D) => void;

const PLATFORMS: { label: string; color: string; drawIcon: DrawIcon }[] = [
  { label: "Web", color: "#7ee7ff", drawIcon: drawBrowser },
  { label: "Android", color: "#3ddc84", drawIcon: drawPhone },
  { label: "Steam · PC", color: "#9d8cff", drawIcon: drawGamepad },
  { label: "VR", color: "#ff6b6b", drawIcon: drawHeadset },
];

export const ORBIT_RADIUS = 2.6;
const MOON_RADIUS = 0.42;
// All moons share one dark, glossy look with an aqua edge, so the white icons keep their contrast;
// colour only marks the labels.
const MOON_BODY = "#0b1d2c";
const MOON_EDGE = "#7ee7ff";

const MOON_ANGLES = PLATFORMS.map((_, i) => (i / PLATFORMS.length) * Math.PI * 2 + Math.PI / 4);
// The orbit line stops this far (in radians) either side of each moon, just outside its glowing edge.
const ARC_GAP = (MOON_RADIUS * 1.1 + 0.08) / ORBIT_RADIUS;

/** The platforms Ocean Engine ships to: small moons riding one thin orbit around the planet. */
export default function PlatformOrbit({
  animate,
  showLabels,
  spin,
}: {
  animate: boolean;
  showLabels: boolean;
  spin: Spin;
}) {
  const ring = useRef<THREE.Group>(null);
  const drift = useRef(0);
  // One arc between each pair of neighbouring moons, so the line never runs through a moon.
  const arcs = useMemo(
    () =>
      MOON_ANGLES.map((start, i) => {
        const end = i === MOON_ANGLES.length - 1 ? MOON_ANGLES[0] + Math.PI * 2 : MOON_ANGLES[i + 1];
        const from = start + ARC_GAP;
        const to = end - ARC_GAP;
        return Array.from({ length: 41 }, (_, j) => {
          const a = from + ((to - from) * j) / 40;
          return new THREE.Vector3(Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS);
        });
      }),
    []
  );

  // Priority -1: turn the ring before the moons place their icons (default priority) this frame.
  useFrame((_, dt) => {
    if (animate) drift.current += dt * 0.08;
    if (ring.current) ring.current.rotation.y = drift.current + spin.angle;
  }, -1);

  return (
    <group ref={ring}>
      {arcs.map((points, i) => (
        <Line key={i} points={points} color="#7ee7ff" lineWidth={1} transparent opacity={0.22} />
      ))}
      {PLATFORMS.map((platform, i) => (
        <Moon
          key={platform.label}
          angle={MOON_ANGLES[i]}
          ring={ring}
          animate={animate}
          showLabels={showLabels}
          {...platform}
        />
      ))}
    </group>
  );
}

function Moon({
  angle,
  ring,
  animate,
  showLabels,
  label,
  color,
  drawIcon,
}: {
  angle: number;
  ring: React.RefObject<THREE.Group>;
  animate: boolean;
  showLabels: boolean;
  label: string;
  color: string;
  drawIcon: DrawIcon;
}) {
  const tag = useRef<HTMLDivElement>(null);
  const iconMesh = useRef<THREE.Mesh>(null);
  const icon = useIconTexture(drawIcon, MOON_EDGE);
  const toCamera = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    // Sit the icon on the moon's surface on the line toward the camera, so it lines up with the
    // moon's centre from any angle (an icon pushed along the view axis drifts off-centre at the sides).
    const mesh = iconMesh.current;
    if (mesh?.parent) {
      // Pick up this frame's ring turn before measuring, or a fast spin leaves the icon a frame behind.
      mesh.parent.updateWorldMatrix(true, false);
      mesh.parent.worldToLocal(toCamera.copy(camera.position));
      mesh.position.copy(toCamera.normalize().multiplyScalar(MOON_RADIUS + 0.02));
      mesh.lookAt(camera.position);
    }

    // Labels fade out as their moon passes behind the planet (front: 1 = nearest the viewer).
    if (tag.current && ring.current) {
      const front = (Math.sin(angle - ring.current.rotation.y) + 1) / 2;
      tag.current.style.opacity = String(THREE.MathUtils.smoothstep(front, 0.3, 0.6));
    }
  });

  return (
    <group position={[Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS]}>
      <Float
        speed={animate ? 1.2 : 0}
        rotationIntensity={0}
        floatIntensity={0.5}
        floatingRange={[-0.06, 0.06]}
      >
        <mesh>
          <sphereGeometry args={[MOON_RADIUS, 48, 48]} />
          <meshPhysicalMaterial
            color={MOON_BODY}
            roughness={0.18}
            metalness={0.35}
            clearcoat={1}
            clearcoatRoughness={0.1}
            envMapIntensity={0.9}
          />
        </mesh>
        {/* A thin glowing edge: a slightly larger back-facing shell. */}
        <mesh scale={1.1}>
          <sphereGeometry args={[MOON_RADIUS, 32, 32]} />
          <meshBasicMaterial
            color={MOON_EDGE}
            transparent
            opacity={0.4}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={iconMesh}>
          <planeGeometry args={[0.58, 0.58]} />
          <meshBasicMaterial map={icon} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </Float>
      {showLabels ? (
        <Html center position={[0, -0.78, 0]} distanceFactor={10} zIndexRange={[5, 0]}>
          <div
            ref={tag}
            className="pointer-events-none flex select-none items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-ink/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-seafoam backdrop-blur"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            {label}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

// ---- Line icons, drawn on a 256px canvas: white strokes with a glow in the platform's colour ----

function useIconTexture(draw: DrawIcon, color: string) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    // Drawn twice: the second pass stacks the coloured glow so the icon holds up at small sizes.
    draw(ctx);
    draw(ctx);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }, [draw, color]);
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawBrowser(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.roundRect(46, 66, 164, 124, 18);
  ctx.moveTo(46, 100);
  ctx.lineTo(210, 100);
  ctx.stroke();
  [70, 89, 108].forEach((x) => dot(ctx, x, 83, 6));
}

function drawPhone(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.roundRect(86, 42, 84, 172, 20);
  ctx.moveTo(116, 64);
  ctx.lineTo(140, 64);
  ctx.stroke();
  dot(ctx, 128, 192, 7);
}

function drawGamepad(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.roundRect(40, 86, 176, 88, 44);
  ctx.moveTo(70, 130);
  ctx.lineTo(102, 130);
  ctx.moveTo(86, 114);
  ctx.lineTo(86, 146);
  ctx.stroke();
  dot(ctx, 162, 120, 8);
  dot(ctx, 182, 140, 8);
}

function drawHeadset(ctx: CanvasRenderingContext2D) {
  const x = 42;
  const y = 84;
  const w = 172;
  const h = 88;
  const r = 26;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  // The nose cut-out along the bottom edge.
  ctx.lineTo(150, y + h);
  ctx.arc(128, y + h, 22, 0, Math.PI, true);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.stroke();
}
