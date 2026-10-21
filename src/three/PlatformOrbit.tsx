import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Html, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import { useGlowTexture } from "./EngineCore";

type DeviceProps = { color: string };

const PLATFORMS: { label: string; color: string; Device: (props: DeviceProps) => JSX.Element }[] = [
  { label: "Web", color: "#7ee7ff", Device: BrowserWindow },
  { label: "Android", color: "#3ddc84", Device: Phone },
  { label: "Steam · PC", color: "#9d8cff", Device: Gamepad },
  { label: "VR", color: "#ff6b6b", Device: Headset },
];

const ORBIT_RADIUS = 3.3;
const BEAM_START = 1.45; // just outside the engine shell
const BEAM_END = ORBIT_RADIUS - 0.9;

/** The platforms Ocean Engine ships to, circling the core and linked to it by data beams. */
export default function PlatformOrbit({
  animate,
  showLabels,
}: {
  animate: boolean;
  showLabels: boolean;
}) {
  const orbit = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (animate && orbit.current) orbit.current.rotation.y += dt * 0.1;
  });

  return (
    <group ref={orbit}>
      {PLATFORMS.map((platform, i) => (
        <Satellite
          key={platform.label}
          index={i}
          angle={(i / PLATFORMS.length) * Math.PI * 2 + Math.PI / 4}
          orbit={orbit}
          animate={animate}
          showLabels={showLabels}
          {...platform}
        />
      ))}
    </group>
  );
}

function Satellite({
  index,
  angle,
  orbit,
  animate,
  showLabels,
  label,
  color,
  Device,
}: {
  index: number;
  angle: number;
  orbit: React.RefObject<THREE.Group>;
  animate: boolean;
  showLabels: boolean;
  label: string;
  color: string;
  Device: (props: DeviceProps) => JSX.Element;
}) {
  const facing = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Sprite>(null);
  const beam = useRef<any>(null);
  const tag = useRef<HTMLDivElement>(null);
  const glow = useGlowTexture();

  const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const position = direction.clone().multiplyScalar(ORBIT_RADIUS);
  const beamStart = direction.clone().multiplyScalar(BEAM_START);
  const beamEnd = direction.clone().multiplyScalar(BEAM_END);

  useFrame((state, dt) => {
    // Keep the device facing the viewer while the ring turns.
    if (facing.current && orbit.current) facing.current.rotation.y = -orbit.current.rotation.y;

    if (animate) {
      if (beam.current) beam.current.material.dashOffset -= dt * 0.6;
      if (pulse.current) {
        const t = (state.clock.elapsedTime * 0.35 + index * 0.25) % 1;
        pulse.current.position.lerpVectors(beamStart, beamEnd, t);
        pulse.current.material.opacity = Math.sin(t * Math.PI);
      }
    }

    // Labels fade out as their device passes behind the core (front: 1 = nearest the viewer, 0 = farthest).
    if (tag.current && orbit.current) {
      const front = (Math.sin(angle - orbit.current.rotation.y) + 1) / 2;
      tag.current.style.opacity = String(THREE.MathUtils.smoothstep(front, 0.3, 0.6));
    }
  });

  return (
    <group>
      <Line
        ref={beam}
        points={[beamStart, beamEnd]}
        color={color}
        lineWidth={1.4}
        dashed
        dashSize={0.18}
        gapSize={0.12}
        transparent
        opacity={0.7}
      />
      <sprite ref={pulse} scale={0.45} position={beamStart}>
        <spriteMaterial
          map={glow}
          color={color}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      <group position={position}>
        <group ref={facing}>
          <Float
            speed={animate ? 1.4 : 0}
            rotationIntensity={0.35}
            floatIntensity={0.6}
            floatingRange={[-0.08, 0.08]}
          >
            <group scale={1.1}>
              <Device color={color} />
            </group>
          </Float>
          {showLabels ? (
            <Html center position={[0, -1.05, 0]} distanceFactor={10} zIndexRange={[5, 0]}>
              <div
                ref={tag}
                className="pointer-events-none flex select-none items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-ink/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-seafoam backdrop-blur"
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: color }}
                />
                {label}
              </div>
            </Html>
          ) : null}
        </group>
      </group>
    </group>
  );
}

// ---- Devices: simple, stylised shapes so they read at a glance ----

function ShellMaterial() {
  return (
    <meshPhysicalMaterial
      color="#132131"
      metalness={0.55}
      roughness={0.28}
      clearcoat={1}
      clearcoatRoughness={0.2}
    />
  );
}

function useCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d")!, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }, [width, height, draw]);
}

/** A little side-scrolling game, for the browser window's screen. */
function drawBrowserGame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#15426a");
  sky.addColorStop(1, "#0a1a2b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1b5784";
  [0.2, 0.55, 0.9].forEach((x, i) => {
    ctx.beginPath();
    ctx.ellipse(w * x, h * 0.8, w * 0.28, h * (0.28 + i * 0.05), 0, Math.PI, 0);
    ctx.fill();
  });
  ctx.fillStyle = "#1f9a77";
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  ctx.fillStyle = "#7ee7ff";
  ctx.beginPath();
  ctx.roundRect(w * 0.12, h * 0.56, w * 0.22, h * 0.05, 6);
  ctx.roundRect(w * 0.55, h * 0.42, w * 0.24, h * 0.05, 6);
  ctx.fill();
  ctx.fillStyle = "#ffd36b";
  [[0.6, 0.34], [0.67, 0.34], [0.74, 0.34], [0.2, 0.48]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(w * x, h * y, h * 0.025, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath();
  ctx.roundRect(w * 0.2, h * 0.44, w * 0.06, h * 0.12, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.roundRect(w * 0.04, h * 0.06, w * 0.18, h * 0.05, 4);
  ctx.roundRect(w * 0.8, h * 0.06, w * 0.16, h * 0.05, 4);
  ctx.fill();
}

/** A card battler on a floating island, for the phone's screen. */
function drawPhoneGame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const water = ctx.createLinearGradient(0, 0, 0, h);
  water.addColorStop(0, "#0f3354");
  water.addColorStop(1, "#081624");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#2f9e5f";
  ctx.beginPath();
  ctx.roundRect(w * 0.12, h * 0.12, w * 0.76, h * 0.58, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.setLineDash([10, 10]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.41);
  ctx.lineTo(w * 0.86, h * 0.41);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ff6b6b";
  ctx.fillRect(w * 0.42, h * 0.15, w * 0.16, h * 0.07);
  ctx.fillStyle = "#7ee7ff";
  ctx.fillRect(w * 0.42, h * 0.6, w * 0.16, h * 0.07);
  [["#ffd36b", 0.35, 0.3], ["#ff8a5c", 0.6, 0.27], ["#9d8cff", 0.4, 0.5], ["#ffffff", 0.66, 0.53]].forEach(
    ([c, x, y]) => {
      ctx.fillStyle = c as string;
      ctx.beginPath();
      ctx.arc(w * (x as number), h * (y as number), w * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  );
  ctx.fillStyle = "#c86b3c";
  ctx.fillRect(w * 0.12, h * 0.75, w * 0.76, h * 0.015);
  ["#ffd36b", "#9d8cff", "#ff8a5c"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.roundRect(w * (0.14 + i * 0.26), h * 0.79, w * 0.2, h * 0.15, 10);
    ctx.fill();
  });
}

function BrowserWindow({ color }: DeviceProps) {
  const screen = useCanvasTexture(512, 288, drawBrowserGame);
  return (
    <group>
      <RoundedBox args={[1.7, 1.12, 0.06]} radius={0.05} smoothness={4}>
        <ShellMaterial />
      </RoundedBox>
      <mesh position={[0, 0.47, 0.032]}>
        <planeGeometry args={[1.62, 0.12]} />
        <meshBasicMaterial color="#1b2a38" />
      </mesh>
      {["#ff6b6b", "#ffd36b", "#3ddc84"].map((c, i) => (
        <mesh key={c} position={[-0.73 + i * 0.08, 0.47, 0.034]}>
          <circleGeometry args={[0.025, 16]} />
          <meshBasicMaterial color={c} />
        </mesh>
      ))}
      <mesh position={[0.08, 0.47, 0.034]}>
        <planeGeometry args={[0.9, 0.05]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
      <mesh position={[0, -0.06, 0.032]}>
        <planeGeometry args={[1.62, 0.92]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Phone({ color }: DeviceProps) {
  const screen = useCanvasTexture(256, 512, drawPhoneGame);
  return (
    <group>
      <RoundedBox args={[0.66, 1.3, 0.07]} radius={0.08} smoothness={4}>
        <ShellMaterial />
      </RoundedBox>
      <mesh position={[0, -0.02, 0.037]}>
        <planeGeometry args={[0.58, 1.16]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.6, 0.038]}>
        <circleGeometry args={[0.018, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function Gamepad({ color }: DeviceProps) {
  return (
    <group>
      <RoundedBox args={[1.2, 0.5, 0.24]} radius={0.12} smoothness={4}>
        <ShellMaterial />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.44, -0.22, 0]} rotation={[0, 0, side * -0.35]}>
          <capsuleGeometry args={[0.16, 0.22, 6, 16]} />
          <ShellMaterial />
        </mesh>
      ))}
      {[
        [-0.2, -0.08],
        [0.16, -0.12],
      ].map(([x, y]) => (
        <mesh key={x} position={[x, y, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.06, 20]} />
          <meshStandardMaterial color="#0b1118" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[-0.4, 0.06, 0.125]}>
        <boxGeometry args={[0.15, 0.045, 0.03]} />
        <meshStandardMaterial color="#0b1118" />
      </mesh>
      <mesh position={[-0.4, 0.06, 0.125]}>
        <boxGeometry args={[0.045, 0.15, 0.03]} />
        <meshStandardMaterial color="#0b1118" />
      </mesh>
      {[
        [0.4, 0.12, "#7ee7ff"],
        [0.47, 0.05, "#ff6b6b"],
        [0.33, 0.05, "#3ddc84"],
        [0.4, -0.02, "#ffd36b"],
      ].map(([x, y, c]) => (
        <mesh key={c as string} position={[x as number, y as number, 0.125]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color={c as string} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.19, 0.123]}>
        <planeGeometry args={[0.36, 0.025]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Headset({ color }: DeviceProps) {
  return (
    <group>
      <RoundedBox args={[1.15, 0.6, 0.5]} radius={0.18} smoothness={5}>
        <ShellMaterial />
      </RoundedBox>
      <RoundedBox args={[1.02, 0.46, 0.06]} radius={0.12} smoothness={4} position={[0, 0, 0.24]}>
        <meshPhysicalMaterial
          color="#160c14"
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.1}
          metalness={0.2}
          clearcoat={1}
        />
      </RoundedBox>
      <mesh position={[0, -0.12, 0.275]}>
        <planeGeometry args={[0.7, 0.03]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.58, 0.05, 10, 48, Math.PI]} />
        <ShellMaterial />
      </mesh>
    </group>
  );
}
